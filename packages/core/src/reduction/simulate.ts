import { getField, type FieldKey } from '../catalog/index.js';
import { exposureByVendor, exposureWithIds, type ExposureResult, type PeopleScope, type Population, type Range, type ResolvedFlow, type WeightOverrides } from '../exposure/formula.js';
import type { IncidentScope } from '../exposure/incident.js';

/**
 * Reduction simulation, v0.1 (task 1.4.8).
 *
 * Asks: if the district stopped sending these fields, how much would exposure
 * fall? It removes the fields from the flows the cut applies to and runs the
 * exposure formula again, before and after, for students and staff.
 *
 * Because the formula counts each person once per vendor, a field cut from one
 * app still counts for people who send it to the same vendor through another
 * app or channel. The simulation reports those people, so the district knows
 * the cut is not complete.
 *
 * The district total is the sum of the vendors' scores: each vendor is a
 * separate place where the data can be breached.
 */

/** Where a cut applies: one app, every app of a vendor, one channel, or every flow. */
export type CutScope = IncidentScope | { readonly kind: 'district' };

export interface Cut {
  /** Fields to stop sending. */
  readonly fields: readonly FieldKey[];
  readonly scope: CutScope;
}

export interface ReductionInput {
  /** Resolved flows, from analyzeDistrict. */
  readonly flows: readonly ResolvedFlow[];
  readonly cuts: readonly Cut[];
  readonly weights?: WeightOverrides;
  /** Enrollment and staff size, when known: ranges never go beyond them. */
  readonly maxStudents?: number;
  readonly maxStaff?: number;
}

/** A value before and after the cuts. `drop` is before minus after. */
export interface Change {
  readonly before: Range;
  readonly after: Range;
  readonly drop: Range;
  /** Drop as a share of the value before, from the upper ends (0 to 1). */
  readonly share: number;
}

export interface VendorChange {
  readonly vendorId: string;
  readonly points: Change;
  readonly people: Change;
  readonly before: ExposureResult;
  readonly after: ExposureResult;
}

/** A field cut from some flows that still reaches the same vendor through others. */
export interface StillReceived {
  readonly vendorId: string;
  readonly field: FieldKey;
  /** People reached by the cut flows whose field still reaches the vendor. */
  readonly people: Range;
  /** Apps that still send the field to the vendor. */
  readonly apps: readonly string[];
}

export interface PopulationReduction {
  /** Sum of the vendors' scores. */
  readonly total: Change;
  /** Vendors whose score or people changed, largest drop first. */
  readonly vendors: readonly VendorChange[];
  readonly stillReceived: readonly StillReceived[];
}

export interface ReductionIssue {
  /** Index of the cut in the input. */
  readonly cut: number;
  readonly field?: FieldKey;
  readonly message: string;
}

export interface ReductionResult {
  readonly cuts: readonly Cut[];
  readonly students: PopulationReduction;
  readonly staff: PopulationReduction;
  readonly issues: readonly ReductionIssue[];
}

function applies(flow: ResolvedFlow, scope: CutScope): boolean {
  switch (scope.kind) {
    case 'district':
      return true;
    case 'vendor':
      return flow.vendorId === scope.vendorId;
    case 'app':
      return flow.appId === scope.appId;
    case 'channel':
      return flow.channel === scope.channel;
  }
}

function describe(scope: CutScope): string {
  switch (scope.kind) {
    case 'district':
      return 'any flow';
    case 'vendor':
      return `vendor ${scope.vendorId}`;
    case 'app':
      return `app ${scope.appId}`;
    case 'channel':
      return `channel ${scope.channel}`;
  }
}

function populationOf(field: FieldKey): Population | undefined {
  if (field.startsWith('student.') || field.startsWith('guardian.')) return 'students';
  if (field.startsWith('staff.')) return 'staff';
  return undefined;
}

const sum = (rs: readonly Range[]): Range => ({
  min: rs.reduce((a, r) => a + r.min, 0),
  max: rs.reduce((a, r) => a + r.max, 0),
  exact: rs.every((r) => r.exact),
});

function change(before: Range, after: Range, unchanged = false): Change {
  const a = before.min - after.min;
  const b = before.max - after.max;
  return {
    before,
    after,
    drop: { min: Math.min(a, b), max: Math.max(a, b), exact: unchanged || (before.exact && after.exact) },
    share: before.max > 0 ? b / before.max : 0,
  };
}

const ZERO: Range = { min: 0, max: 0, exact: true };
const isIds = (s: PeopleScope): s is ReadonlySet<string> => s instanceof Set;

/** Simulates stopping some fields and returns the change in exposure. */
export function simulateReduction(input: ReductionInput): ReductionResult {
  const { flows, cuts } = input;
  const issues: ReductionIssue[] = [];

  // Which fields each flow stops sending.
  const removed = flows.map(() => new Set<FieldKey>());
  cuts.forEach((cut, index) => {
    const matched = flows.map((f, i) => [f, i] as const).filter(([f]) => applies(f, cut.scope));
    if (matched.length === 0) {
      issues.push({ cut: index, message: `No flow matches ${describe(cut.scope)}; this cut changes nothing.` });
      return;
    }
    for (const field of cut.fields) {
      if (!getField(field)) {
        issues.push({ cut: index, field, message: `Unknown field: ${field}.` });
        continue;
      }
      const carrying = matched.filter(([f]) => f.fields.includes(field));
      if (carrying.length === 0) {
        issues.push({ cut: index, field, message: `${describe(cut.scope)} does not receive ${getField(field)!.label}; this cut changes nothing.` });
        continue;
      }
      if (!populationOf(field))
        issues.push({ cut: index, field, message: `${getField(field)!.label} describes an organization, not a person, and is not counted in exposure.` });
      for (const [, i] of carrying) removed[i]!.add(field);
    }
  });

  const after: ResolvedFlow[] = flows.map((f, i) => (removed[i]!.size === 0 ? f : { ...f, fields: f.fields.filter((k) => !removed[i]!.has(k)) }));

  const forPopulation = (population: Population, maxPeople?: number): PopulationReduction => {
    const options = { population, ...(input.weights ? { weights: input.weights } : {}), ...(maxPeople !== undefined ? { maxPeople } : {}) };
    const beforeByVendor = exposureByVendor(flows, options);
    const afterByVendor = new Map(exposureByVendor(after, options).map((r) => [r.id, r]));

    const vendors: VendorChange[] = [];
    for (const b of beforeByVendor) {
      const a = afterByVendor.get(b.id)!;
      const points = change(b.points, a.points);
      const people = change(b.people, a.people);
      if (points.drop.max === 0 && points.drop.min === 0 && people.drop.max === 0 && people.drop.min === 0) continue;
      vendors.push({ vendorId: b.id, points, people, before: b, after: a });
    }
    vendors.sort((x, y) => y.points.drop.max - x.points.drop.max || x.vendorId.localeCompare(y.vendorId));

    // Fields cut from some flows of a vendor that other flows still send it.
    const stillReceived: StillReceived[] = [];
    const pairs = new Map<string, { vendorId: string; field: FieldKey; cut: number[] }>();
    removed.forEach((fields, i) => {
      for (const field of fields) {
        if (populationOf(field) !== population) continue;
        const vendorId = flows[i]!.vendorId;
        const key = `${vendorId}\u0000${field}`;
        const p = pairs.get(key) ?? { vendorId, field, cut: [] };
        p.cut.push(i);
        pairs.set(key, p);
      }
    });
    for (const { vendorId, field, cut } of pairs.values()) {
      const keeping = after.filter((f) => f.vendorId === vendorId && f.fields.includes(field));
      if (keeping.length === 0) continue;
      const scopeOf = (f: ResolvedFlow) => (population === 'students' ? f.students : f.staff);
      const cutScopes = cut.map((i) => scopeOf(flows[i]!)).filter((s): s is PeopleScope => s !== undefined);
      const keepScopes = keeping.map(scopeOf).filter((s): s is PeopleScope => s !== undefined);
      let people: Range = ZERO;
      if (cutScopes.length > 0 && keepScopes.length > 0) {
        if (cutScopes.every(isIds) && keepScopes.every(isIds)) {
          const kept = new Set<string>();
          for (const s of keepScopes) for (const id of s) kept.add(id);
          const both = new Set<string>();
          for (const s of cutScopes) for (const id of s) if (kept.has(id)) both.add(id);
          people = { min: both.size, max: both.size, exact: true };
        } else {
          const one = { ...options, population };
          const cutPeople = exposureWithIds('cut', cut.map((i) => ({ ...flows[i]!, fields: [field] })), one).result.people;
          const keepPeople = exposureWithIds('kept', keeping.map((f) => ({ ...f, fields: [field] })), one).result.people;
          people = { min: 0, max: Math.min(cutPeople.max, keepPeople.max), exact: false };
        }
      }
      if (people.max === 0) continue;
      stillReceived.push({ vendorId, field, people, apps: [...new Set(keeping.map((f) => f.appId))].sort((x, y) => x.localeCompare(y)) });
    }
    stillReceived.sort((x, y) => y.people.max - x.people.max || x.vendorId.localeCompare(y.vendorId) || x.field.localeCompare(y.field));

    return {
      total: change(sum(beforeByVendor.map((r) => r.points)), sum([...afterByVendor.values()].map((r) => r.points)), removed.every((s) => s.size === 0)),
      vendors,
      stillReceived,
    };
  };

  return {
    cuts,
    students: forPopulation('students', input.maxStudents),
    staff: forPopulation('staff', input.maxStaff),
    issues,
  };
}
