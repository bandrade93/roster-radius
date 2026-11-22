import { getField, SENSITIVITY_CLASSES, type ExhibitBCategory, type FieldKey } from '../catalog/index.js';
import { declaresData, type Declaration } from '../declared/read.js';
import { exposureWithIds, type Range, type ResolvedFlow, type WeightOverrides } from '../exposure/formula.js';

/**
 * Disclosure versus flow, v0.1 (task 1.4.10).
 *
 * Compares what the district published about the vendors that receive student
 * data (the declared list, docs/formats/declared.md) with what actually flows.
 * Illinois and Colorado require districts to publish this information; see
 * docs/methodology/state-laws.md.
 *
 * Four findings:
 * - undisclosed_vendor: a vendor receives student data and the publication
 *   does not name it;
 * - undisclosed_app: the publication names the vendor, but only for other apps;
 * - undisclosed_data: an app receives data that the entries covering it do not
 *   list, by Exhibit B category or by field;
 * - no_longer_receives: an entry covers apps that no longer receive student
 *   data, so the publication can be updated.
 *
 * As for contracts, only student and guardian fields are compared, and only in
 * one direction: a publication that lists more than what flows is not a
 * finding. Entries that name a vendor without its data make the vendor
 * disclosed, but its data is not compared.
 */

export const DISCLOSURE_FINDINGS = ['undisclosed_vendor', 'undisclosed_app', 'undisclosed_data', 'no_longer_receives'] as const;
export type DisclosureKind = (typeof DISCLOSURE_FINDINGS)[number];

export interface DisclosureFinding {
  readonly kind: DisclosureKind;
  readonly severity: 'high' | 'medium' | 'info';
  readonly vendorId: string;
  /** Apps involved. For no_longer_receives, the apps the entry covers (empty: every app). */
  readonly apps: readonly string[];
  /** Fields that flow and are not disclosed, most sensitive first. Empty for no_longer_receives. */
  readonly fields: readonly FieldKey[];
  /** Exhibit B categories of those fields. */
  readonly categories: readonly ExhibitBCategory[];
  /** Students whose undisclosed data flows. Zero for no_longer_receives. */
  readonly students: Range;
  /** Lines of the declared list involved. */
  readonly lines: readonly number[];
  /** Inventory lines of the flows involved. Empty for no_longer_receives. */
  readonly inventoryLines: readonly number[];
  readonly message: string;
}

export interface DisclosureResult {
  /** Vendors that receive student data, and how many of them the publication names. */
  readonly vendorsReceiving: number;
  readonly vendorsDisclosed: number;
  /** Vendors named without their data: disclosed, but not compared. */
  readonly notCompared: readonly string[];
  /** Most severe first. */
  readonly findings: readonly DisclosureFinding[];
}

export interface DisclosureInput {
  readonly flows: readonly ResolvedFlow[];
  readonly declarations: readonly Declaration[];
  readonly weights?: WeightOverrides;
  /** Enrollment, when known: ranges never go beyond it. */
  readonly maxStudents?: number;
}

const isStudentField = (k: FieldKey) => k.startsWith('student.') || k.startsWith('guardian.');
/** Default weight, as in the alert rules: severity does not depend on custom weights. */
const weightOf = (k: FieldKey) => SENSITIVITY_CLASSES[getField(k)!.sensitivity].weight;
const bySensitivity = (keys: Iterable<FieldKey>) => [...new Set(keys)].sort((a, b) => weightOf(b) - weightOf(a) || a.localeCompare(b));
const categoriesOf = (keys: readonly FieldKey[]) =>
  [...new Set(keys.map((k) => getField(k)!.exhibitB).filter((c): c is ExhibitBCategory => c !== null))].sort((a, b) => a.localeCompare(b));
const hasStudents = (f: ResolvedFlow) => f.students === undefined || (f.students instanceof Set ? f.students.size > 0 : (f.students as { count: number }).count > 0);
const sortStrings = (xs: Iterable<string>) => [...new Set(xs)].sort((a, b) => a.localeCompare(b));
const list = (keys: readonly FieldKey[]) => keys.map((k) => getField(k)!.label).join(', ');
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
const people = (r: Range) =>
  r.max === 0 ? 'an unknown number of students' : r.min === r.max ? plural(r.max, 'student') : `${r.min.toLocaleString('en-US')} to ${plural(r.max, 'student')}`;
const covers = (d: Declaration, f: ResolvedFlow) => d.vendorId === f.vendorId && (!d.appIds || d.appIds.includes(f.appId));
const inventoryLines = (flows: readonly ResolvedFlow[]) => [...new Set(flows.flatMap((f) => (f.line !== undefined ? [f.line] : [])))].sort((a, b) => a - b);
const SEVERITY_ORDER = { high: 0, medium: 1, info: 2 } as const;

export function compareDisclosure(input: DisclosureInput): DisclosureResult {
  const options = { population: 'students' as const, ...(input.weights ? { weights: input.weights } : {}), ...(input.maxStudents !== undefined ? { maxPeople: input.maxStudents } : {}) };
  const studentsOf = (flows: readonly ResolvedFlow[]) => exposureWithIds('x', flows, options).result.people;

  // Flows that carry student data, reduced to their student fields.
  const flows = input.flows
    .map((f) => ({ ...f, fields: f.fields.filter(isStudentField) }))
    .filter((f) => f.fields.length > 0 && hasStudents(f));
  const findings: DisclosureFinding[] = [];
  const notCompared = new Set<string>();

  const vendors = sortStrings(flows.map((f) => f.vendorId));
  let disclosed = 0;
  for (const vendorId of vendors) {
    const own = flows.filter((f) => f.vendorId === vendorId);
    const entries = input.declarations.filter((d) => d.vendorId === vendorId);
    if (entries.length === 0) {
      const fields = bySensitivity(own.flatMap((f) => f.fields));
      const students = studentsOf(own);
      findings.push({
        kind: 'undisclosed_vendor',
        severity: 'high',
        vendorId,
        apps: sortStrings(own.map((f) => f.appId)),
        fields,
        categories: categoriesOf(fields),
        students,
        lines: [],
        inventoryLines: inventoryLines(own),
        message: `${vendorId} receives data about ${people(students)} (${list(fields)}), but the district's published list does not name it. Add it to the publication, or stop the flow.`,
      });
      continue;
    }
    disclosed += 1;

    for (const appId of sortStrings(own.map((f) => f.appId))) {
      const appFlows = own.filter((f) => f.appId === appId);
      const covering = entries.filter((d) => covers(d, appFlows[0]!));
      if (covering.length === 0) {
        const fields = bySensitivity(appFlows.flatMap((f) => f.fields));
        const students = studentsOf(appFlows);
        const named = sortStrings(entries.flatMap((d) => d.appIds ?? []));
        findings.push({
          kind: 'undisclosed_app',
          severity: 'high',
          vendorId,
          apps: [appId],
          fields,
          categories: categoriesOf(fields),
          students,
          lines: entries.map((d) => d.line),
          inventoryLines: inventoryLines(appFlows),
          message: `The published list names ${vendorId} only for ${named.join(', ')}, but ${appId} also receives data about ${people(students)} (${list(fields)}). Add the app to the publication.`,
        });
        continue;
      }
      if (!covering.every(declaresData)) {
        notCompared.add(vendorId);
        continue;
      }
      const categories = new Set(covering.flatMap((d) => d.exhibitB ?? []));
      const named = new Set(covering.flatMap((d) => d.fields ?? []));
      const outsideOf = (k: FieldKey) => {
        if (named.has(k)) return false;
        const c = getField(k)!.exhibitB;
        return c !== null && !categories.has(c);
      };
      const fields = bySensitivity(appFlows.flatMap((f) => f.fields).filter(outsideOf));
      if (fields.length === 0) continue;
      const carrying = appFlows.map((f) => ({ ...f, fields: f.fields.filter(outsideOf) })).filter((f) => f.fields.length > 0);
      const students = studentsOf(carrying);
      const cats = categoriesOf(fields);
      findings.push({
        kind: 'undisclosed_data',
        severity: fields.some((k) => weightOf(k) >= 4) ? 'high' : 'medium',
        vendorId,
        apps: [appId],
        fields,
        categories: cats,
        students,
        lines: covering.map((d) => d.line),
        inventoryLines: inventoryLines(carrying),
        message: `${appId} receives ${list(fields)} for ${people(students)}, but the published list for ${vendorId} does not include ${cats.join(', ')}. Update the publication, or stop sharing these fields.`,
      });
    }
  }

  // Entries for apps or vendors that no longer receive student data.
  for (const d of input.declarations) {
    if (flows.some((f) => covers(d, f))) continue;
    const what = d.appIds ? `${d.appIds.join(', ')} (${d.vendorId})` : d.vendorId;
    findings.push({
      kind: 'no_longer_receives',
      severity: 'info',
      vendorId: d.vendorId,
      apps: d.appIds ? [...d.appIds] : [],
      fields: [],
      categories: [],
      students: { min: 0, max: 0, exact: true },
      lines: [d.line],
      inventoryLines: [],
      message: `The published list names ${what}, but the inventory shows no student data flowing to it. If it no longer receives data, remove it from the publication and confirm the data was deleted.`,
    });
  }

  findings.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      DISCLOSURE_FINDINGS.indexOf(a.kind) - DISCLOSURE_FINDINGS.indexOf(b.kind) ||
      b.students.max - a.students.max ||
      a.vendorId.localeCompare(b.vendorId),
  );
  return { vendorsReceiving: vendors.length, vendorsDisclosed: disclosed, notCompared: sortStrings(notCompared), findings };
}
