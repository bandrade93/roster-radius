import { getField, type FieldKey } from '../catalog/index.js';
import type { SensitivityClass } from '../catalog/sensitivity.js';
import { isValidDate } from '../csv/index.js';
import type { Range, ResolvedFlow, WeightOverrides } from '../exposure/formula.js';
import { exposureWithIds, resolveWeights } from '../exposure/formula.js';
import { METHODOLOGY_VERSION } from '../version.js';
import { flowsInScope, incidentImpact, type IncidentScope } from '../exposure/incident.js';
import { suggest } from '../csv/index.js';
import { LEGAL_DISCLAIMER, STATE_LAWS, type BreachDuty, type StateCode } from '../laws/states.js';
import type { Roster } from '../oneroster/read.js';

/**
 * Incident mode, v0.1 (task 1.4.7).
 *
 * When a vendor reports a breach, the district needs to know, quickly: who was
 * affected, with which data, by when it must act under its state's law, and
 * whom to notify.
 *
 * - `incidentReport` answers the first three. It holds no identifiers, so it
 *   can be shared with the district's counsel or board.
 * - `notificationCsv` builds the list of affected people, by identifier, with
 *   the kinds of data each had at the vendor. It has no names or contacts: the
 *   district joins it with its own system to reach families. It is built in
 *   memory, on the district's computer, and never stored.
 *
 * Deadlines and state rules are a summary for orientation, not legal advice.
 */

export interface IncidentInput {
  readonly flows: readonly ResolvedFlow[];
  readonly roster: Roster;
  readonly scope: IncidentScope;
  /** The date the district received the vendor's notice or determined the breach, as YYYY-MM-DD. */
  readonly notifiedOn: string;
  /** The district's state, for deadlines and state rules. Omit for federal rules only. */
  readonly state?: StateCode;
  readonly weights?: WeightOverrides;
}

export interface AffectedField {
  readonly field: FieldKey;
  readonly people: Range;
  /** Apps through which the vendor received it. */
  readonly apps: readonly string[];
  /** Inventory lines of those flows. */
  readonly lines: readonly number[];
}

export interface AffectedGroup {
  readonly people: Range;
  readonly byClass: Readonly<Record<SensitivityClass, Range>>;
  readonly byField: readonly AffectedField[];
  /** People reached through flows that give only a count: they are in the totals but cannot be listed. */
  readonly notListed: number;
  /** Share of the district's enrollment (or staff), from 0 to 1, using the upper end of the range. */
  readonly share: number | null;
  /** Inventory lines of the flows counted. */
  readonly lines: readonly number[];
}

export interface Deadline {
  readonly duty: BreachDuty;
  /** Last day, for a district duty with a fixed number of days. */
  readonly dueOn?: string;
}

export interface StateFinding {
  readonly id: string;
  readonly text: string;
  readonly citation: string;
}

export interface IncidentReport {
  readonly methodologyVersion: string;
  readonly weights: Readonly<Record<SensitivityClass, number>>;
  readonly id: string;
  readonly scope: IncidentScope;
  readonly notifiedOn: string;
  readonly state?: StateCode;
  readonly vendors: readonly string[];
  readonly apps: readonly string[];
  readonly channels: readonly string[];
  readonly students: AffectedGroup;
  readonly staff: AffectedGroup;
  /** The state's breach duties, the district's with their last day. Empty without a state. */
  readonly deadlines: readonly Deadline[];
  /** State rules applied to this incident. */
  readonly findings: readonly StateFinding[];
  readonly disclaimer: string;
}

const isStudent = (k: FieldKey) => k.startsWith('student.') || k.startsWith('guardian.');
const isStaff = (k: FieldKey) => k.startsWith('staff.');
const has = (fields: ReadonlySet<FieldKey>, ...keys: FieldKey[]) => keys.some((k) => fields.has(k));

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

function group(id: string, flows: readonly ResolvedFlow[], population: 'students' | 'staff', size: number, weights?: WeightOverrides): AffectedGroup {
  const counted = population === 'students' ? isStudent : isStaff;
  const options = { population, maxPeople: size, ...(weights ? { weights } : {}) };
  const all = exposureWithIds(id, flows, options).result;
  const keys = [...new Set(flows.flatMap((f) => f.fields.filter(counted)))];
  const byField = keys
    .map((field) => {
      const carrying = flows.filter((f) => f.fields.includes(field));
      const result = exposureWithIds(field, carrying.map((f) => ({ ...f, fields: [field] })), options).result;
      return {
        field,
        people: result.people,
        apps: [...new Set(carrying.map((f) => f.appId))].sort((a, b) => a.localeCompare(b)),
        lines: result.lines,
      };
    })
    .sort((a, b) => b.people.max - a.people.max || (getField(a.field)?.label ?? '').localeCompare(getField(b.field)?.label ?? ''));
  const scopeOf = (f: ResolvedFlow) => (population === 'students' ? f.students : f.staff);
  const notListed = flows
    .filter((f) => f.fields.some(counted))
    .reduce((n, f) => {
      const s = scopeOf(f);
      return n + (s && !(s instanceof Set) ? (s as { count: number }).count : 0);
    }, 0);
  return {
    people: all.people,
    byClass: all.peopleByClass,
    byField,
    notListed: Math.min(notListed, size || notListed),
    share: size > 0 ? Math.min(1, all.people.max / size) : null,
    lines: all.lines,
  };
}

function findingsFor(state: StateCode | undefined, students: AffectedGroup, staffFields: ReadonlySet<FieldKey>, studentFields: ReadonlySet<FieldKey>): StateFinding[] {
  const out: StateFinding[] = [];
  if (state === 'IL' && students.share !== null && students.people.max > 0) {
    const pct = Math.round(students.share * 1000) / 10;
    out.push(
      students.share >= 0.1
        ? { id: 'il.breach_list', text: `The breach affects about ${pct}% of enrollment, so it must be included in the list of breaches the district publishes.`, citation: '105 ILCS 85/27(a)(5)' }
        : { id: 'il.breach_list', text: `The breach affects about ${pct}% of enrollment, under 10%, so it may be left out of the list of breaches the district publishes.`, citation: '105 ILCS 85/27(a)(5)' },
    );
  }
  if (state === 'CO') {
    const name = has(studentFields, 'student.first_name') && has(studentFields, 'student.last_name');
    const studentId = has(studentFields, 'student.sis_id', 'student.student_number', 'student.state_id');
    const login = has(studentFields, 'student.username', 'student.email') && has(studentFields, 'student.password');
    const staffLogin = has(staffFields, 'staff.username', 'staff.email') && has(staffFields, 'staff.password');
    if ((name && studentId) || login || staffLogin)
      out.push({
        id: 'co.personal_information',
        text: `The data includes ${[name && studentId ? 'names with student ID numbers' : '', login || staffLogin ? 'usernames or emails with passwords' : ''].filter(Boolean).join(' and ')}, which the state breach law for governmental entities treats as personal information: the 30-day notice to affected residents likely applies.`,
        citation: 'C.R.S. 24-73-103',
      });
  }
  return out;
}

/**
 * The flows inside the scope. A scope that matches nothing is an error, not an
 * incident with nobody affected: a misspelled vendor must never read as "no
 * students were affected".
 */
function hitFlows(flows: readonly ResolvedFlow[], scope: IncidentScope): ResolvedFlow[] {
  const hit = flowsInScope(flows, scope);
  if (hit.length > 0) return hit;
  const [what, value, options] =
    scope.kind === 'vendor'
      ? (['vendor', scope.vendorId, flows.map((f) => f.vendorId)] as const)
      : scope.kind === 'app'
        ? (['app', scope.appId, flows.map((f) => f.appId)] as const)
        : (['channel', scope.channel, flows.map((f) => f.channel)] as const);
  throw new RangeError(`No ${what} '${value}' in the inventory.${suggest(value, new Set(options))}`);
}

export function incidentReport(input: IncidentInput): IncidentReport {
  if (!isValidDate(input.notifiedOn)) throw new RangeError(`Invalid date: ${input.notifiedOn}`);
  const hit = hitFlows(input.flows, input.scope);
  const impact = incidentImpact(hit, input.scope);
  const students = group(impact.id, hit, 'students', input.roster.students.size, input.weights);
  const staff = group(impact.id, hit, 'staff', input.roster.staff.size, input.weights);

  const law = input.state ? STATE_LAWS[input.state] : undefined;
  const deadlines: Deadline[] = (law?.breach ?? []).map((duty) =>
    duty.party === 'district' && duty.days !== null ? { duty, dueOn: addDays(input.notifiedOn, duty.days) } : { duty },
  );
  const studentFields = new Set(hit.flatMap((f) => f.fields.filter(isStudent)));
  const staffFields = new Set(hit.flatMap((f) => f.fields.filter(isStaff)));
  return {
    methodologyVersion: METHODOLOGY_VERSION,
    weights: resolveWeights(input.weights),
    id: impact.id,
    scope: input.scope,
    notifiedOn: input.notifiedOn,
    ...(input.state ? { state: input.state } : {}),
    vendors: impact.vendors,
    apps: impact.apps,
    channels: impact.channels,
    students,
    staff,
    deadlines,
    findings: findingsFor(input.state, students, staffFields, studentFields),
    disclaimer: LEGAL_DISCLAIMER,
  };
}

/** Prevents a spreadsheet from running a value as a formula. */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * The people affected, one row each: population, OneRoster sourcedId, the
 * district's own ID when the roster has it, and the kinds of data the vendor
 * held about them. People known only by a count are not listed (see
 * `notListed` in the report). Build it on the district's computer; never store it.
 */
export function notificationCsv(input: Omit<IncidentInput, 'notifiedOn' | 'state'>): string {
  const hit = hitFlows(input.flows, input.scope);
  const rows: string[][] = [['population', 'oneroster_sourced_id', 'district_id', 'data', 'apps']];
  for (const population of ['students', 'staff'] as const) {
    const counted = population === 'students' ? isStudent : isStaff;
    const people = new Map<string, { fields: Set<FieldKey>; apps: Set<string> }>();
    for (const f of hit) {
      const scope = population === 'students' ? f.students : f.staff;
      const own = f.fields.filter(counted);
      if (!(scope instanceof Set) || own.length === 0) continue;
      for (const id of scope) {
        let p = people.get(id);
        if (!p) people.set(id, (p = { fields: new Set(), apps: new Set() }));
        own.forEach((k) => p!.fields.add(k));
        p.apps.add(f.appId);
      }
    }
    const roster = population === 'students' ? input.roster.students : input.roster.staff;
    for (const id of [...people.keys()].sort()) {
      const p = people.get(id)!;
      const inRoster = roster.get(id);
      // IDs from a file that matched no roster entry are kept as "<file>#<id>".
      const sourced = inRoster ? id : '';
      const districtId = inRoster ? (inRoster.identifier ?? '') : id.slice(id.lastIndexOf('#') + 1);
      const labels = [...p.fields].map((k) => getField(k)?.label ?? k).sort((a, b) => a.localeCompare(b));
      rows.push([population === 'students' ? 'student' : 'staff', sourced, districtId, labels.join('; '), [...p.apps].sort().join('; ')]);
    }
  }
  return rows.map((r) => r.map(cell).join(',')).join('\n') + '\n';
}
