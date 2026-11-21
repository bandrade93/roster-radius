import { FIELDS, findFieldKey, type FieldKey } from '../catalog/index.js';
import type { Source, Subject } from '../catalog/types.js';
import { CsvError, CsvParser, type CsvRecord } from '../inventory/csv.js';
import type { TextSource } from '../oneroster/read.js';

/**
 * Readers for the files an inventory row points to with `file:`.
 *
 * - `readExportHeader` reads the header row of a file the vendor receives (an
 *   SFTP export, an upload) and recognizes its columns as catalog fields. Only
 *   the header is read. Fields found this way are measured, not entered.
 * - `readPeopleFile` reads a file that lists who an app reaches, such as
 *   Clever's "Application Receives" students file. It counts the rows and keeps
 *   the identifiers in memory, to count distinct people; every other value is
 *   discarded as it is read. Its header is not treated as the app's fields:
 *   Clever says these files hold only basic details, and the app may receive
 *   more through Field Access (ADR 0001).
 */

export type PeopleKind = 'students' | 'staff';

/** Clever file names (SFTP specification v2.1.1 and "Application Receives" exports) and the subjects of their columns. */
const CLEVER_FILES: Record<string, readonly Subject[]> = {
  students: ['student', 'guardian'],
  teachers: ['staff'],
  staff: ['staff'],
  schools: ['school'],
  sections: ['section'],
};

export interface ColumnReading {
  readonly column: string;
  readonly status: 'matched' | 'unknown' | 'ambiguous';
  readonly field?: FieldKey;
  /** For ambiguous columns, the fields the column could be. */
  readonly candidates?: readonly FieldKey[];
}

export interface HeaderReading {
  /** Recognized fields, in column order, without repeats. */
  readonly fields: readonly FieldKey[];
  readonly columns: readonly ColumnReading[];
  /** How the columns were recognized. */
  readonly format: 'clever' | 'oneroster' | 'generic';
}

export interface FileIssue {
  readonly severity: 'error' | 'warning';
  readonly file: string;
  readonly line?: number;
  readonly message: string;
}

/** Loose spelling for generic files: "Birth Date", "birth_date" and "birthDate" all become "birthdate". */
const loose = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, '');
const lastSegment = (alias: string): string => loose(alias.split('.').pop() ?? alias);

/** Any spelling of a column, from any source, to the fields it can be, per subject. */
const GENERIC = new Map<string, Map<Subject, Set<FieldKey>>>();
const add = (name: string, subject: Subject, key: FieldKey) => {
  let bySubject = GENERIC.get(name);
  if (!bySubject) GENERIC.set(name, (bySubject = new Map()));
  let keys = bySubject.get(subject);
  if (!keys) bySubject.set(subject, (keys = new Set()));
  keys.add(key);
};
for (const f of FIELDS) {
  add(loose(f.key.split('.')[1] ?? f.key), f.subject, f.key);
  add(loose(f.label), f.subject, f.key);
  for (const aliases of Object.values(f.aliases) as (readonly string[])[]) for (const a of aliases) add(lastSegment(a), f.subject, f.key);
}

const baseName = (name: string): string =>
  (name.split(/[\\/]/).pop() ?? name).replace(/\.[^.]*$/, '').toLowerCase();

/** Guesses whose data a file holds from its name: teacher or staff files hold staff, anything else students. */
export function guessPeopleKind(fileName: string): PeopleKind {
  return /teacher|staff|admin/.test(baseName(fileName)) ? 'staff' : 'students';
}

/**
 * Recognizes header columns as catalog fields. Clever files (students.csv,
 * teachers.csv...) and OneRoster users.csv are matched against their own column
 * names; any other file, such as an export from the student information system,
 * is matched against every known spelling, the catalog keys and the labels.
 */
export function recognizeHeader(fileName: string, header: readonly string[], kind: PeopleKind = guessPeopleKind(fileName)): HeaderReading {
  const base = baseName(fileName);
  const cleverSubjects = CLEVER_FILES[base];
  const subjects: readonly Subject[] =
    cleverSubjects ?? (kind === 'staff' ? ['staff', 'school', 'section'] : ['student', 'guardian', 'school', 'section']);
  const format: HeaderReading['format'] = cleverSubjects ? 'clever' : base === 'users' ? 'oneroster' : 'generic';

  const columns: ColumnReading[] = [];
  const fields: FieldKey[] = [];
  for (const raw of header) {
    const column = raw.trim();
    if (column === '') continue;
    let candidates: FieldKey[] = [];
    if (format !== 'generic') {
      const source: Source = format === 'clever' ? 'cleverCsv' : 'oneroster';
      const prefix = format === 'clever' ? base : 'users';
      for (const s of subjects) {
        const key = findFieldKey(source, s, `${prefix}.${column}`);
        if (key && !candidates.includes(key)) candidates.push(key);
      }
    }
    if (candidates.length === 0) {
      const bySubject = GENERIC.get(loose(column));
      for (const s of subjects) for (const key of bySubject?.get(s) ?? []) if (!candidates.includes(key)) candidates.push(key);
    }
    // A column that names both a student and a guardian field ("phone") is resolved to the student's own field.
    if (candidates.length > 1 && kind === 'students') {
      const own = candidates.filter((k) => k.startsWith('student.'));
      if (own.length === 1) candidates = own;
    }
    if (candidates.length === 1) {
      const field = candidates[0]!;
      columns.push({ column, status: 'matched', field });
      if (!fields.includes(field)) fields.push(field);
    } else if (candidates.length > 1) {
      columns.push({ column, status: 'ambiguous', candidates });
    } else {
      columns.push({ column, status: 'unknown' });
    }
  }
  return { fields, columns, format };
}

async function* chunksOf(content: TextSource): AsyncIterable<string> {
  if (typeof content === 'string') yield content;
  else yield* content as AsyncIterable<string>;
}

export interface ExportHeaderResult extends HeaderReading {
  readonly issues: readonly FileIssue[];
}

/** Reads only the header row of a file the vendor receives, and recognizes its columns. */
export async function readExportHeader(fileName: string, content: TextSource, kind?: PeopleKind): Promise<ExportHeaderResult> {
  let header: CsvRecord | undefined;
  const parser = new CsvParser((r) => {
    header ??= r;
  });
  try {
    for await (const chunk of chunksOf(content)) {
      parser.push(chunk);
      if (header) break;
    }
    if (!header) parser.end();
  } catch (e) {
    if (!(e instanceof CsvError)) throw e;
    return { fields: [], columns: [], format: 'generic', issues: [{ severity: 'error', file: fileName, line: e.line, message: e.message.replace(/^line \d+: /, '') }] };
  }
  if (!header) return { fields: [], columns: [], format: 'generic', issues: [{ severity: 'error', file: fileName, message: 'The file is empty.' }] };

  const reading = recognizeHeader(fileName, header.cells, kind);
  const issues: FileIssue[] = [];
  const unknown = reading.columns.filter((c) => c.status === 'unknown').map((c) => c.column);
  if (unknown.length > 0)
    issues.push({ severity: 'warning', file: fileName, line: 1, message: `Columns not recognized, so not counted: ${unknown.join(', ')}. List their fields in the inventory instead, or ask for them to be added to the catalog.` });
  for (const c of reading.columns.filter((c) => c.status === 'ambiguous'))
    issues.push({ severity: 'warning', file: fileName, line: 1, message: `Column '${c.column}' could be ${c.candidates!.join(' or ')}; it is not counted. List the right field in the inventory.` });
  if (reading.fields.length === 0) issues.push({ severity: 'error', file: fileName, line: 1, message: 'No column was recognized as a known field.' });
  return { ...reading, issues };
}

export interface PeopleFileResult {
  /** Rows in the file, not counting the header. */
  readonly rows: number;
  /** Distinct identifiers, kept in memory only; undefined when no identifier column was found. */
  readonly ids?: ReadonlySet<string>;
  /** The column the identifiers came from. */
  readonly idColumn?: string;
  /** The columns present, for the report. They are not the app's fields. */
  readonly columns: readonly string[];
  readonly issues: readonly FileIssue[];
}

const ID_FIELD: Record<PeopleKind, FieldKey> = { students: 'student.sis_id', staff: 'staff.id' };

/**
 * Reads a file listing who an app reaches. Counts the rows and keeps the
 * identifiers of one column in memory; every other value is discarded.
 */
export async function readPeopleFile(fileName: string, content: TextSource, kind: PeopleKind = guessPeopleKind(fileName)): Promise<PeopleFileResult> {
  const issues: FileIssue[] = [];
  let columns: string[] | undefined;
  let idIndex = -1;
  let rows = 0;
  const ids = new Set<string>();
  let missingIds = 0;

  const parser = new CsvParser((r) => {
    if (!columns) {
      columns = r.cells.map((c) => c.trim());
      const reading = recognizeHeader(fileName, columns, kind);
      idIndex = reading.columns.findIndex((c) => c.field === ID_FIELD[kind]);
      // recognizeHeader skips empty columns; map back to the original position.
      if (idIndex >= 0) idIndex = columns.indexOf(reading.columns[idIndex]!.column);
      return;
    }
    rows++;
    if (idIndex >= 0) {
      const id = (r.cells[idIndex] ?? '').trim();
      if (id === '') missingIds++;
      else ids.add(id);
    }
  });
  try {
    for await (const chunk of chunksOf(content)) parser.push(chunk);
    parser.end();
  } catch (e) {
    if (!(e instanceof CsvError)) throw e;
    return { rows: 0, columns: columns ?? [], issues: [{ severity: 'error', file: fileName, line: e.line, message: e.message.replace(/^line \d+: /, '') }] };
  }
  if (!columns) return { rows: 0, columns: [], issues: [{ severity: 'error', file: fileName, message: 'The file is empty.' }] };

  if (idIndex < 0) {
    issues.push({ severity: 'warning', file: fileName, line: 1, message: `No ${kind === 'students' ? 'student' : 'staff'} ID column was found, so only the number of rows is used. Results that use this file are given as a range.` });
    return { rows, columns, issues };
  }
  if (missingIds > 0) issues.push({ severity: 'warning', file: fileName, message: `${missingIds} row(s) have no ID and are not counted.` });
  return { rows, ids, idColumn: columns[idIndex]!, columns, issues };
}
