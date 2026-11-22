import type { FieldKey } from '../catalog/index.js';
import { suggest } from '../csv/index.js';
import { readExportHeader, readPeopleFile, type PeopleKind } from '../exports/index.js';
import type { PeopleScope, ResolvedFlow } from '../exposure/formula.js';
import type { InventoryRow, PeopleSpec } from '../inventory/types.js';
import type { Roster, TextSource } from '../oneroster/read.js';

/**
 * Resolving an inventory, v0.1 (task 1.4.1).
 *
 * Turns each inventory row into a flow the exposure formula can use: the
 * fields the app receives, and the people it reaches, as OneRoster
 * identifiers. Each person is then counted once per vendor by the formula.
 *
 * - `all` and `teachers` are taken from the roster, limited by `schools`
 *   (name or sourcedId) and `grades`.
 * - `file:` lists are matched to the roster. Files from Clever or the student
 *   information system often use the district's own IDs, which OneRoster
 *   keeps in `identifier`, not in `sourcedId`: both are tried, and the one that
 *   matches more people is used. IDs found in neither are still counted, as
 *   separate people, and reported, because the same student might then be
 *   counted twice (methodology limitation 2.1).
 * - `count:` stays a count, so results that use it are ranges.
 *
 * Identifiers are held in memory only.
 */

export interface ResolveIssue {
  readonly severity: 'error' | 'warning';
  /** Where the problem is: the inventory, or a file it names. */
  readonly file: string;
  readonly line?: number;
  readonly message: string;
}

export interface PeopleResolution {
  /** How the people were found. */
  readonly kind: 'none' | 'roster' | 'file' | 'count';
  /** People reached: distinct identifiers, or the stated count. */
  readonly count: number;
  /**
   * Measured when taken from the roster or counted in a file; entered when
   * typed into the inventory as `count:`.
   */
  readonly source: 'entered' | 'measured';
  /** For files: the file, and the column that holds each person's ID, when it has one. */
  readonly path?: string;
  readonly idColumn?: string;
  /**
   * Which roster identifier the people were matched by. Roster selections use
   * the OneRoster sourcedId; files use sourcedId or identifier, whichever
   * matches more people. `unmatched` counts the file's IDs found in neither.
   */
  readonly matchedBy?: 'sourcedId' | 'identifier';
  readonly unmatched?: number;
}

export interface ResolvedRow {
  readonly row: InventoryRow;
  readonly flow: ResolvedFlow;
  /** Fields read from the file the vendor receives are measured; fields typed into the inventory are entered. */
  readonly fieldSource: 'entered' | 'measured';
  readonly students: PeopleResolution;
  readonly staff: PeopleResolution;
}

export interface ResolveInput {
  readonly rows: readonly InventoryRow[];
  readonly roster: Roster;
  /**
   * Opens a file the inventory names with `file:`, by its path relative to the
   * inventory's folder. Returns undefined when the file was not provided.
   * Called once per use, so it may return a fresh stream each time.
   */
  readonly openFile?: (path: string) => TextSource | undefined;
}

export interface ResolveResult {
  /** One per row that could be resolved, in inventory order. */
  readonly rows: readonly ResolvedRow[];
  readonly flows: readonly ResolvedFlow[];
  readonly issues: readonly ResolveIssue[];
}

/** Paths are compared with forward slashes and without a leading "./". */
export function normalizePath(path: string): string {
  return path.trim().replace(/\\/g, '/').replace(/^(\.\/)+/, '');
}

const INVENTORY = 'inventory';

export async function resolveInventory(input: ResolveInput): Promise<ResolveResult> {
  const { roster } = input;
  const issues: ResolveIssue[] = [];
  const rows: ResolvedRow[] = [];

  // Schools by sourcedId and by name, for the `schools` column.
  const schoolByName = new Map<string, string>();
  for (const s of roster.schools.values()) schoolByName.set(s.name.trim().toLowerCase(), s.id);
  const schoolNames = [...roster.schools.values()].map((s) => s.name);

  // Roster identifiers, to match files that use the district's own IDs.
  const byIdentifier = {
    students: new Map<string, string>(),
    staff: new Map<string, string>(),
  };
  for (const [id, s] of roster.students) if (s.identifier) byIdentifier.students.set(s.identifier, id);
  for (const [id, s] of roster.staff) if (s.identifier) byIdentifier.staff.set(s.identifier, id);

  const open = (path: string): TextSource | undefined => input.openFile?.(normalizePath(path));

  for (const row of input.rows) {
    const rowIssues: ResolveIssue[] = [];
    const error = (message: string, file = INVENTORY) => rowIssues.push({ severity: 'error', file, ...(file === INVENTORY ? { line: row.line } : {}), message });
    const warning = (message: string, file = INVENTORY) => rowIssues.push({ severity: 'warning', file, ...(file === INVENTORY ? { line: row.line } : {}), message });

    // Schools named in the row.
    const schools: string[] = [];
    for (const s of row.schools) {
      const id = roster.schools.has(s) ? s : schoolByName.get(s.trim().toLowerCase());
      if (id) schools.push(id);
      else error(`School '${s}' is not in the OneRoster export.${suggest(s, schoolNames)}`);
    }
    const inSchools = (personSchools: readonly string[]) => row.schools.length === 0 || personSchools.some((x) => schools.includes(x));

    // Fields.
    let fields: readonly FieldKey[] = row.fields;
    let fieldSource: ResolvedRow['fieldSource'] = 'entered';
    if (row.fieldSource.kind === 'file') {
      const path = row.fieldSource.path;
      const content = open(path);
      if (content === undefined) error(`The file '${path}' named in 'fields' was not provided.`);
      else {
        const header = await readExportHeader(path, content);
        for (const i of header.issues) rowIssues.push({ severity: i.severity, file: path, ...(i.line ? { line: i.line } : {}), message: i.message });
        fields = header.fields;
        fieldSource = 'measured';
      }
    }

    // People.
    const resolvePeople = async (spec: PeopleSpec, kind: PeopleKind): Promise<{ scope?: PeopleScope; info: PeopleResolution }> => {
      switch (spec.kind) {
        case 'none':
          return { info: { kind: 'none', count: 0, source: 'entered' } };
        case 'count':
          return { scope: { count: spec.count }, info: { kind: 'count', count: spec.count, source: 'entered' } };
        case 'all':
        case 'teachers': {
          const set = new Set<string>();
          if (kind === 'students') {
            for (const [id, s] of roster.students) {
              if (!inSchools(s.schools)) continue;
              if (row.grades.length > 0 && !s.grades.some((g) => (row.grades as readonly string[]).includes(g))) continue;
              set.add(id);
            }
          } else {
            for (const [id, s] of roster.staff) {
              if (spec.kind === 'teachers' && s.role !== 'teacher') continue;
              if (inSchools(s.schools)) set.add(id);
            }
          }
          if (set.size === 0) warning(`'${kind}' resolves to nobody in the OneRoster export: check 'schools' and 'grades'.`);
          return { scope: set, info: { kind: 'roster', count: set.size, source: 'measured', matchedBy: 'sourcedId' } };
        }
        case 'file': {
          const content = open(spec.path);
          if (content === undefined) {
            error(`The file '${spec.path}' named in '${kind}' was not provided.`);
            return { info: { kind: 'none', count: 0, source: 'entered' } };
          }
          const file = await readPeopleFile(spec.path, content, kind);
          for (const i of file.issues) rowIssues.push({ severity: i.severity, file: spec.path, ...(i.line ? { line: i.line } : {}), message: i.message });
          if (!file.ids) return { scope: { count: file.rows }, info: { kind: 'count', count: file.rows, source: 'measured', path: spec.path } };

          const pool = kind === 'students' ? roster.students : roster.staff;
          const idents = byIdentifier[kind];
          let bySourced = 0;
          let byIdent = 0;
          for (const id of file.ids) {
            if (pool.has(id)) bySourced++;
            if (idents.has(id)) byIdent++;
          }
          const via: 'sourcedId' | 'identifier' = byIdent > bySourced ? 'identifier' : 'sourcedId';
          const set = new Set<string>();
          let unmatched = 0;
          for (const id of file.ids) {
            const rosterId = via === 'identifier' ? idents.get(id) : pool.has(id) ? id : undefined;
            if (rosterId) set.add(rosterId);
            else {
              unmatched++;
              // Kept apart from roster IDs so it can never collide with one.
              set.add(`${spec.path}#${id}`);
            }
          }
          if (unmatched > 0)
            warning(
              `${unmatched} of ${file.ids.size} IDs in '${spec.path}' are not in the OneRoster export. They are counted as separate people, so a student could be counted twice.`,
              spec.path,
            );
          return { scope: set, info: { kind: 'file', count: set.size, source: 'measured', path: spec.path, ...(file.idColumn ? { idColumn: file.idColumn } : {}), matchedBy: via, unmatched } };
        }
      }
    };

    const students = await resolvePeople(row.students, 'students');
    const staff = await resolvePeople(row.staff, 'staff');

    issues.push(...rowIssues);
    if (rowIssues.some((i) => i.severity === 'error')) continue;
    const flow: ResolvedFlow = {
      appId: row.app,
      vendorId: row.vendor,
      channel: row.channelId,
      fields,
      line: row.line,
      ...(students.scope ? { students: students.scope } : {}),
      ...(staff.scope ? { staff: staff.scope } : {}),
    };
    rows.push({ row, flow, fieldSource, students: students.info, staff: staff.info });
  }
  return { rows, flows: rows.map((r) => r.flow), issues };
}
