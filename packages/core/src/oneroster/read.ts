import { Unzip, UnzipInflate } from 'fflate';
import { CsvError, CsvParser, type CsvRecord } from '../inventory/csv.js';
import { normalizeGrade } from '../inventory/types.js';

/**
 * OneRoster 1.1 CSV reader, v0.1.
 *
 * Reads only what RosterRadius needs to know who an app reaches: schools from
 * orgs.csv, and from users.csv each person's identifier, role, schools and
 * grades. Names, emails and every other column are skipped as the file is
 * read, and other files, such as demographics.csv, are never opened.
 *
 * Files are read in chunks, so a large district's users.csv is never held in
 * memory as a whole. The result keeps identifiers in memory only, to count
 * distinct people; nothing is stored.
 */

export type StaffRole = 'teacher' | 'administrator' | 'aide' | 'proctor';

export interface RosterSchool {
  readonly id: string;
  readonly name: string;
}

export interface RosterStudent {
  readonly schools: readonly string[];
  /** Grades normalized to PK, KG and 01 to 12 when recognized; other OneRoster codes kept as given. */
  readonly grades: readonly string[];
}

export interface RosterStaff {
  readonly schools: readonly string[];
  readonly role: StaffRole;
}

export interface RosterIssue {
  readonly severity: 'error' | 'warning';
  readonly file: string;
  /** First line where the problem appears. */
  readonly line?: number;
  /** How many rows have the problem, when it repeats. */
  readonly count?: number;
  readonly message: string;
}

export interface Roster {
  readonly schools: ReadonlyMap<string, RosterSchool>;
  readonly students: ReadonlyMap<string, RosterStudent>;
  readonly staff: ReadonlyMap<string, RosterStaff>;
  readonly issues: readonly RosterIssue[];
  /** The files that were read. */
  readonly files: readonly string[];
}

/** The only files the reader opens. */
export const ONEROSTER_FILES = ['manifest.csv', 'orgs.csv', 'users.csv'] as const;
export type OneRosterFile = (typeof ONEROSTER_FILES)[number];

const STAFF_ROLES: readonly string[] = ['teacher', 'administrator', 'aide', 'proctor'];
const IGNORED_ROLES: readonly string[] = ['guardian', 'parent', 'relative'];

/** Splits a OneRoster list value ("09,10"). */
const values = (cell: string | undefined): string[] =>
  (cell ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v !== '');

interface Sink {
  push(text: string): void;
  end(): void;
}

/**
 * Builds a roster from OneRoster files fed in chunks, in any order. Most
 * callers use `readOneRosterFiles` or `readOneRosterZip` instead.
 */
export class OneRosterBuilder {
  private readonly orgs = new Map<string, { name: string; type: string }>();
  private readonly users = new Map<string, { role: string; orgs: string[]; grades: string[]; line: number }>();
  private readonly manifest = new Map<string, string>();
  private readonly issues: RosterIssue[] = [];
  private readonly repeated = new Map<string, { file: string; line: number; count: number; message: string; severity: 'error' | 'warning' }>();
  private readonly seen: string[] = [];

  /** Opens one file; returns undefined for files the reader never reads. */
  file(name: string): Sink | undefined {
    const base = (name.split(/[\\/]/).pop() ?? name).toLowerCase();
    if (!(ONEROSTER_FILES as readonly string[]).includes(base)) return undefined;
    const file = base as OneRosterFile;
    this.seen.push(file);
    let columns: Map<string, number> | undefined;
    let failed = false;
    const parser = new CsvParser((record) => {
      if (failed) return;
      if (!columns) {
        columns = new Map(record.cells.map((c, i) => [c.trim().toLowerCase(), i]));
        const missing = REQUIRED[file].filter((c) => !columns!.has(c.toLowerCase()));
        if (missing.length > 0) {
          this.issues.push({ severity: 'error', file, line: record.line, message: `Missing required column(s): ${missing.join(', ')}.` });
          failed = true;
        }
        return;
      }
      this.row(file, record, columns);
    });
    return {
      push: (text) => {
        if (!failed) parser.push(text);
      },
      end: () => {
        try {
          parser.end();
        } catch (e) {
          if (!(e instanceof CsvError)) throw e;
          this.issues.push({ severity: 'error', file, line: e.line, message: e.message.replace(/^line \d+: /, '') });
        }
      },
    };
  }

  private note(file: string, line: number, key: string, message: string, severity: 'error' | 'warning' = 'warning'): void {
    const k = `${file}\u0000${key}`;
    const r = this.repeated.get(k);
    if (r) r.count++;
    else this.repeated.set(k, { file, line, count: 1, message, severity });
  }

  private row(file: OneRosterFile, record: CsvRecord, columns: Map<string, number>): void {
    const get = (name: string): string => {
      const i = columns.get(name.toLowerCase());
      return i === undefined ? '' : (record.cells[i] ?? '').trim();
    };
    if (get('status').toLowerCase() === 'tobedeleted') return;

    if (file === 'manifest.csv') {
      this.manifest.set(get('propertyName').toLowerCase(), get('value'));
      return;
    }
    const id = get('sourcedId');
    if (id === '') {
      this.note(file, record.line, 'no-id', 'Rows without a sourcedId are skipped.');
      return;
    }
    if (file === 'orgs.csv') {
      this.orgs.set(id, { name: get('name'), type: get('type').toLowerCase() });
      return;
    }
    // users.csv
    if (this.users.has(id)) {
      this.note(file, record.line, 'duplicate', 'Repeated sourcedId: the later row replaces the earlier one.');
    }
    this.users.set(id, { role: get('role').toLowerCase(), orgs: values(get('orgSourcedIds')), grades: values(get('grades')), line: record.line });
  }

  /** Ends reading and returns the roster. Call after every file has ended. */
  finish(): Roster {
    for (const required of ['orgs.csv', 'users.csv'] as const) {
      if (!this.seen.includes(required)) this.issues.push({ severity: 'error', file: required, message: `${required} was not found.` });
    }
    const version = this.manifest.get('oneroster.version');
    if (version !== undefined && version !== '1.1') {
      this.issues.push({ severity: 'warning', file: 'manifest.csv', message: `The manifest declares OneRoster ${version}; this reader is built for 1.1.` });
    }
    const usersMode = this.manifest.get('file.users')?.toLowerCase();
    if (usersMode === 'delta') {
      this.issues.push({ severity: 'error', file: 'manifest.csv', message: 'users.csv is a delta file. Export a bulk (full) file so every person is counted.' });
    }

    const schools = new Map<string, RosterSchool>();
    for (const [id, org] of this.orgs) if (org.type === 'school') schools.set(id, { id, name: org.name });

    const students = new Map<string, RosterStudent>();
    const staff = new Map<string, RosterStaff>();
    for (const [id, u] of this.users) {
      const inSchools = u.orgs.filter((o) => schools.has(o));
      const unknown = u.orgs.filter((o) => !this.orgs.has(o));
      if (unknown.length > 0) this.note('users.csv', u.line, 'unknown-org', 'Users refer to an org that is not in orgs.csv.');
      if (u.role === 'student') {
        const grades = u.grades.map((g) => normalizeGrade(g) ?? g.toUpperCase());
        if (u.grades.some((g) => normalizeGrade(g) === undefined)) {
          this.note('users.csv', u.line, 'grade', 'Students with a grade other than PK, KG or 01 to 12 are counted, but are left out when an app is limited to certain grades.');
        }
        students.set(id, { schools: inSchools, grades });
      } else if (STAFF_ROLES.includes(u.role)) {
        staff.set(id, { schools: inSchools, role: u.role as StaffRole });
      } else if (!IGNORED_ROLES.includes(u.role)) {
        this.note('users.csv', u.line, `role:${u.role}`, `Unknown role '${u.role}': these users are not counted.`);
      }
      if (inSchools.length === 0 && (u.role === 'student' || STAFF_ROLES.includes(u.role))) {
        this.note('users.csv', u.line, 'no-school', 'People with no school are counted in "all", but not when an app is limited to certain schools.');
      }
    }

    const issues = [
      ...this.issues,
      ...[...this.repeated.values()].map((r) => ({
        severity: r.severity,
        file: r.file,
        line: r.line,
        ...(r.count > 1 ? { count: r.count } : {}),
        message: r.message,
      })),
    ];
    return { schools, students, staff, issues, files: [...this.seen] };
  }
}

const REQUIRED: Record<OneRosterFile, readonly string[]> = {
  'manifest.csv': ['propertyName', 'value'],
  'orgs.csv': ['sourcedId', 'name', 'type'],
  'users.csv': ['sourcedId', 'role', 'orgSourcedIds'],
};

/** A file's content as text, whole or in chunks. */
export type TextSource = string | Iterable<string> | AsyncIterable<string>;

/** Reads OneRoster files from a folder or any other source, given by name. */
export async function readOneRosterFiles(files: Iterable<readonly [name: string, content: TextSource]>): Promise<Roster> {
  const builder = new OneRosterBuilder();
  for (const [name, content] of files) {
    const sink = builder.file(name);
    if (!sink) continue;
    if (typeof content === 'string') sink.push(content);
    else for await (const chunk of content) sink.push(chunk);
    sink.end();
  }
  return builder.finish();
}

/** Reads a OneRoster zip, whole or in chunks. Files may sit in a subfolder of the zip. */
export async function readOneRosterZip(zip: Uint8Array | Iterable<Uint8Array> | AsyncIterable<Uint8Array>): Promise<Roster> {
  const builder = new OneRosterBuilder();
  let failure: unknown;
  const unzip = new Unzip((entry) => {
    const sink = builder.file(entry.name);
    if (!sink) return;
    const decoder = new TextDecoder('utf-8');
    entry.ondata = (err, chunk, final) => {
      if (err) {
        failure ??= err;
        return;
      }
      sink.push(decoder.decode(chunk, { stream: !final }));
      if (final) sink.end();
    };
    entry.start();
  });
  unzip.register(UnzipInflate);
  if (zip instanceof Uint8Array) unzip.push(zip, true);
  else {
    for await (const chunk of zip) unzip.push(chunk);
    unzip.push(new Uint8Array(0), true);
  }
  if (failure) throw failure;
  return builder.finish();
}
