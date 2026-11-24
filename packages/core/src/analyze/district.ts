import { APP_CATEGORIES, type AppCategory } from '../baselines/index.js';
import type { FieldKey } from '../catalog/index.js';
import { getField } from '../catalog/index.js';
import { evaluateAlerts, type Alert } from '../alerts/index.js';
import { readContracts } from '../contracts/read.js';
import type { Contract } from '../contracts/types.js';
import { readDeclaredList, type Declaration } from '../declared/read.js';
import { compareDisclosure, type DisclosureResult } from '../disclosure/compare.js';
import { exposureByApp, exposureByVendor, exposureWithIds, resolveWeights, type ExposureResult, type Range, type ResolvedFlow, type WeightOverrides } from '../exposure/formula.js';
import { incidentScenarios } from '../exposure/incident.js';
import { readInventory } from '../inventory/read.js';
import type { InventoryRow } from '../inventory/types.js';
import { ONEROSTER_FILES, readOneRosterFiles, type Roster, type TextSource } from '../oneroster/read.js';
import { resolveInventory, normalizePath, type PeopleResolution, type ResolvedRow } from '../resolve/inventory.js';
import { checkNames } from '../resolve/names.js';
import type { SensitivityClass } from '../catalog/sensitivity.js';
import { METHODOLOGY_VERSION } from '../version.js';
import { hashing, type InputFile } from '../trace/inputs.js';
import { Sha256 } from '../trace/sha256.js';

/**
 * Analyzing a district, v0.1 (tasks 1.4.2 to 1.4.6, 1.4.9 and 1.4.10).
 *
 * Reads the inventory, contracts and declared list, resolves the inventory
 * against the roster, and runs the exposure formula, the alert rules, the
 * incident ranking and the comparison with the published list in one call.
 *
 * Every number can be traced: results and alerts list the inventory lines
 * they come from, each flow says whether its fields and people were measured
 * or entered and which identifier matched them, and the report gives the
 * methodology version, the weights and the hash of every input file.
 *
 * The result has two parts:
 * - `report`: everything a report shows. It holds no student or staff
 *   identifier, so it can be saved, exported or sent.
 * - `flows`: the resolved flows, with identifiers, kept in memory for incident
 *   mode and reduction simulations. Never store or export them.
 */

export interface AnalyzeInput {
  /** The app inventory's text. */
  readonly inventory: string;
  readonly contracts?: string;
  readonly declared?: string;
  /** The district's roster, read with readOneRosterFiles or readOneRosterZip. */
  readonly roster: Roster;
  /** Opens files the inventory names with `file:`, relative to the inventory's folder. */
  readonly openFile?: (path: string) => TextSource | undefined;
  /** The date the analysis is for, as YYYY-MM-DD: contract dates are checked against it. */
  readonly today: string;
  readonly weights?: WeightOverrides;
  readonly expiringWithinDays?: number;
  /**
   * Hashes of the input files' bytes, when the caller read them. They replace
   * the hashes computed from the text for the same path. A OneRoster file the
   * analysis did not read as text, such as a zip, is added. Other files given
   * here but not read are left out. The
   * inventory, contracts and declared list are named inventory.csv,
   * contracts.csv and declared.csv.
   */
  readonly inputs?: readonly InputFile[];
}

export interface AnalysisIssue {
  readonly severity: 'error' | 'warning';
  /** inventory, contracts, declared, oneroster/<file>, or the path of a file the inventory names. */
  readonly file: string;
  readonly line?: number;
  readonly column?: string;
  readonly count?: number;
  readonly message: string;
}

/** One inventory row as resolved, without identifiers. */
export interface FlowSummary {
  readonly line: number;
  readonly app: string;
  readonly vendor: string;
  readonly channel: string;
  readonly category?: AppCategory;
  readonly fields: readonly FieldKey[];
  readonly fieldSource: ResolvedRow['fieldSource'];
  /** The file the fields were read from, when they were measured. */
  readonly fieldsFile?: string;
  readonly students: PeopleResolution;
  readonly staff: PeopleResolution;
  readonly subprocessors: InventoryRow['subprocessors'];
}

/** How many students have a field at one vendor or more, and at how many vendors. */
export interface SharedField {
  readonly field: FieldKey;
  readonly students: Range;
  readonly vendors: readonly string[];
}

/** An incident scenario without identifiers. */
export interface ScenarioSummary {
  readonly id: string;
  readonly kind: 'vendor' | 'channel';
  readonly vendors: readonly string[];
  readonly apps: readonly string[];
  readonly students: ExposureResult;
  readonly staff: ExposureResult;
}

export interface DistrictReport {
  readonly methodologyVersion: string;
  readonly today: string;
  readonly weights: Readonly<Record<SensitivityClass, number>>;
  /** Every file the analysis read, with its hash, so the report can be tied to them. */
  readonly inputs: readonly InputFile[];
  readonly totals: {
    readonly schools: number;
    readonly students: number;
    readonly staff: number;
    readonly apps: number;
    readonly vendors: number;
    readonly channels: number;
    /** Distinct students whose data reaches at least one vendor. */
    readonly studentsReached: Range;
    readonly staffReached: Range;
  };
  readonly flows: readonly FlowSummary[];
  readonly students: { readonly byVendor: readonly ExposureResult[]; readonly byApp: readonly ExposureResult[] };
  readonly staff: { readonly byVendor: readonly ExposureResult[]; readonly byApp: readonly ExposureResult[] };
  /** Student and guardian fields shared with at least one vendor, most students first. */
  readonly sharedFields: readonly SharedField[];
  readonly alerts: readonly Alert[];
  /** Every vendor and channel as a breach scenario, worst first. */
  readonly scenarios: readonly ScenarioSummary[];
  /** Contracts used, including those built from the inventory's contract columns. */
  readonly contracts: readonly Contract[];
  readonly declarations: readonly Declaration[];
  /**
   * Whether every row of every file was used. Rows with errors are left out of
   * the results, so a report with errors is incomplete and must say so
   * wherever it is shown or shared.
   */
  readonly completeness: { readonly complete: boolean; readonly rowsLeftOut: number };
  /** Published list versus what flows. Present only when a declared list was given. */
  readonly disclosure?: DisclosureResult;
  readonly issues: readonly AnalysisIssue[];
}

export interface DistrictAnalysis {
  readonly report: DistrictReport;
  /** In memory only: resolved flows with identifiers. */
  readonly flows: readonly ResolvedFlow[];
}

/** Each error leaves its row out, or as many rows as it repeats in. */
export function completenessOf(issues: readonly AnalysisIssue[]): DistrictReport['completeness'] {
  const rowsLeftOut = issues.filter((i) => i.severity === 'error').reduce((n, i) => n + (i.count ?? 1), 0);

  return { complete: rowsLeftOut === 0, rowsLeftOut };
}

const isStudentField = (k: FieldKey) => k.startsWith('student.') || k.startsWith('guardian.');

/**
 * Contracts from the contracts file, plus one per inventory row that records a
 * `contract_end` for an app the file does not cover. When the file covers the
 * app, the file wins, and a different date in the inventory is reported.
 */
function contractsFor(rows: readonly InventoryRow[], fromFile: readonly Contract[], issues: AnalysisIssue[]): Contract[] {
  const contracts = [...fromFile];
  const covers = (c: Contract, r: InventoryRow) => c.vendorId === r.vendor && (!c.appIds || c.appIds.includes(r.app));
  const done = new Set<string>();
  for (const r of rows) {
    if (!r.contractEnd || done.has(r.app)) continue;
    done.add(r.app);
    const covering = fromFile.filter((c) => covers(c, r));
    if (covering.length > 0) {
      if (!covering.some((c) => c.expiresOn === r.contractEnd))
        issues.push({
          severity: 'warning',
          file: 'inventory',
          line: r.line,
          column: 'contract_end',
          message: `'contract_end' for ${r.app} (${r.contractEnd}) differs from the contracts file, which is used instead.`,
        });
      continue;
    }
    contracts.push({ id: `inventory line ${r.line}`, vendorId: r.vendor, appIds: [r.app], expiresOn: r.contractEnd, ...(r.deletionDays !== undefined ? { deletionDays: r.deletionDays } : {}), line: r.line });
  }
  return contracts;
}

export async function analyzeDistrict(input: AnalyzeInput): Promise<DistrictAnalysis> {
  const issues: AnalysisIssue[] = [];
  const { roster } = input;
  for (const i of roster.issues) issues.push({ severity: i.severity, file: `oneroster/${i.file}`, ...(i.line ? { line: i.line } : {}), ...(i.count ? { count: i.count } : {}), message: i.message });

  const inventory = readInventory(input.inventory);
  for (const i of inventory.issues) issues.push({ ...i, file: 'inventory' });

  let fileContracts: readonly Contract[] = [];
  if (input.contracts !== undefined) {
    const r = readContracts(input.contracts);
    fileContracts = r.contracts;
    for (const i of r.issues) issues.push({ ...i, file: 'contracts' });
  }
  let declarations: readonly Declaration[] = [];
  if (input.declared !== undefined) {
    const r = readDeclaredList(input.declared);
    declarations = r.declarations;
    for (const i of r.issues) issues.push({ ...i, file: 'declared' });
  }
  for (const i of checkNames({ inventory: inventory.rows, contracts: fileContracts, declarations, declaredCompared: input.declared !== undefined })) issues.push(i);

  // Files named by the inventory are hashed as they are read.
  const vendorFiles = new Map<string, InputFile>();
  const openFile = input.openFile
    ? (path: string) => {
        const source = input.openFile!(path);
        if (source === undefined) return undefined;
        return hashing(source, (sha256, bytes) => {
          if (!vendorFiles.has(path)) vendorFiles.set(path, { path, role: 'vendor_file', sha256, bytes });
        });
      }
    : undefined;
  const resolved = await resolveInventory({ rows: inventory.rows, roster, ...(openFile ? { openFile } : {}) });
  for (const i of resolved.issues) issues.push(i);
  const flows = resolved.flows;

  const contracts = contractsFor(inventory.rows, fileContracts, issues);
  const apps: Record<string, AppCategory> = {};
  for (const r of inventory.rows) if (r.category && r.category in APP_CATEGORIES) apps[r.app] = r.category;
  const options = input.weights ? { weights: input.weights } : {};
  const studentOptions = { ...options, population: 'students' as const, maxPeople: roster.students.size };
  const staffOptions = { ...options, population: 'staff' as const, maxPeople: roster.staff.size };

  const alerts = evaluateAlerts({
    flows,
    apps,
    contracts,
    today: input.today,
    ...(input.expiringWithinDays !== undefined ? { expiringWithinDays: input.expiringWithinDays } : {}),
  });

  // Fields shared district-wide: one exposure per field over the flows that carry it.
  const fieldKeys = [...new Set(flows.flatMap((f) => f.fields.filter(isStudentField)))];
  const sharedFields = fieldKeys
    .map((field) => {
      const carrying = flows.filter((f) => f.fields.includes(field)).map((f) => ({ ...f, fields: [field] }));
      return {
        field,
        students: exposureWithIds(field, carrying, studentOptions).result.people,
        vendors: [...new Set(carrying.map((f) => f.vendorId))].sort((a, b) => a.localeCompare(b)),
      };
    })
    .sort((a, b) => b.students.max - a.students.max || (getField(a.field)?.label ?? '').localeCompare(getField(b.field)?.label ?? ''));

  // A channel used by a single vendor, and only by it, is the same breach as that vendor: keep the vendor.
  const appsOf = (vendor: string) => new Set(flows.filter((f) => f.vendorId === vendor).map((f) => f.appId));
  const sameAsVendor = (vendors: readonly string[], apps: readonly string[]) =>
    vendors.length === 1 && appsOf(vendors[0]!).size === apps.length && apps.every((a) => appsOf(vendors[0]!).has(a));
  const scenarios: ScenarioSummary[] = incidentScenarios(flows, { ...options, maxStudents: roster.students.size, maxStaff: roster.staff.size })
    .filter((s) => s.scope.kind !== 'channel' || !sameAsVendor(s.vendors, s.apps))
    .map((s) => ({
    id: s.id,
    kind: s.scope.kind === 'vendor' ? 'vendor' : 'channel',
    vendors: s.vendors,
    apps: s.apps,
    students: s.students,
    staff: s.staff,
  }));

  const text = (path: string, role: InputFile['role'], content: string): InputFile => {
    const h = new Sha256().update(content);
    return { path, role, sha256: h.hex(), bytes: h.bytes };
  };
  const given = new Map((input.inputs ?? []).map((f) => [f.path, f]));
  const ROLES: readonly InputFile['role'][] = ['inventory', 'contracts', 'declared', 'oneroster', 'vendor_file'];
  const computed = [
    text('inventory.csv', 'inventory', input.inventory),
    ...(input.contracts !== undefined ? [text('contracts.csv', 'contracts', input.contracts)] : []),
    ...(input.declared !== undefined ? [text('declared.csv', 'declared', input.declared)] : []),
    ...roster.hashes.map((h): InputFile => ({ ...h, role: 'oneroster' })),
    ...vendorFiles.values(),
  ]
    .map((f) => given.get(f.path) ?? f);
  const known = new Set(computed.map((f) => f.path));
  const rosterSources = [...given.values()].filter((f) => f.role === 'oneroster' && !known.has(f.path));
  const inputs = [...computed, ...rosterSources].sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.path.localeCompare(b.path));

  const report: DistrictReport = {
    methodologyVersion: METHODOLOGY_VERSION,
    today: input.today,
    weights: resolveWeights(input.weights),
    inputs,
    totals: {
      schools: roster.schools.size,
      students: roster.students.size,
      staff: roster.staff.size,
      apps: new Set(inventory.rows.map((r) => r.app)).size,
      vendors: new Set(inventory.rows.map((r) => r.vendor)).size,
      channels: new Set(inventory.rows.map((r) => r.channelId)).size,
      studentsReached: exposureWithIds('district', flows, studentOptions).result.people,
      staffReached: exposureWithIds('district', flows, staffOptions).result.people,
    },
    flows: resolved.rows.map((r) => ({
      line: r.row.line,
      app: r.row.app,
      vendor: r.row.vendor,
      channel: r.row.channelId,
      ...(r.row.category ? { category: r.row.category } : {}),
      fields: r.flow.fields,
      fieldSource: r.fieldSource,
      ...(r.row.fieldSource.kind === 'file' ? { fieldsFile: normalizePath(r.row.fieldSource.path) } : {}),
      students: r.students,
      staff: r.staff,
      subprocessors: r.row.subprocessors,
    })),
    students: { byVendor: exposureByVendor(flows, studentOptions), byApp: exposureByApp(flows, studentOptions) },
    staff: {
      byVendor: exposureByVendor(flows, staffOptions).filter((v) => v.people.max > 0),
      byApp: exposureByApp(flows, staffOptions).filter((v) => v.people.max > 0),
    },
    sharedFields,
    alerts,
    scenarios,
    contracts,
    declarations,
    ...(input.declared !== undefined
      ? { disclosure: compareDisclosure({ flows, declarations, ...(input.weights ? { weights: input.weights } : {}), maxStudents: roster.students.size }) }
      : {}),
    completeness: completenessOf(issues),
    issues,
  };
  return { report, flows };
}

/**
 * Analyzes a district from its files, by path: `inventory.csv`, optional
 * `contracts.csv` and `declared.csv`, and the OneRoster files (`orgs.csv`,
 * `users.csv`, `manifest.csv`) in any folder, such as `oneroster/`. Any other
 * path is available to the inventory's `file:` values, which also find a file
 * by its name alone when only one file has that name. Useful for a folder or
 * the sample district.
 */
export async function analyzeFiles(
  files: Readonly<Record<string, string>>,
  options: {
    readonly today: string;
    readonly weights?: WeightOverrides;
    readonly expiringWithinDays?: number;
    readonly inputs?: readonly InputFile[];
    /** A roster already read, such as from a OneRoster zip. When given, OneRoster files among `files` are not read. */
    readonly roster?: Roster;
  },
): Promise<DistrictAnalysis> {
  const byPath = new Map(Object.entries(files).map(([p, c]) => [normalizePath(p), c]));
  const base = (p: string) => (p.split('/').pop() ?? p).toLowerCase();
  const inventory = byPath.get('inventory.csv');
  if (inventory === undefined) throw new Error('inventory.csv was not provided.');
  // A file named in the inventory is found by its path, or by its name alone when one loaded file has that name.
  const byName = (p: string): string | undefined => {
    const name = base(normalizePath(p));
    const matches = [...byPath.keys()].filter((k) => base(k) === name);

    return matches.length === 1 ? byPath.get(matches[0]!) : undefined;
  };
    const { roster: given, ...rest } = options;
  const roster = given ?? (await readOneRosterFiles([...byPath].filter(([p]) => (ONEROSTER_FILES as readonly string[]).includes(base(p)) && p.includes('/'))));

  return analyzeDistrict({
    inventory,
    ...(byPath.has('contracts.csv') ? { contracts: byPath.get('contracts.csv')! } : {}),
    ...(byPath.has('declared.csv') ? { declared: byPath.get('declared.csv')! } : {}),
    roster,
    openFile: (p) => byPath.get(normalizePath(p)) ?? byName(p),
    ...rest,
  });
}
