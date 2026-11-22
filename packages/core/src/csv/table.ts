import { CsvError, parseCsvWithSeparator, type CsvSeparator } from './parse.js';

/**
 * Shared reading for the files a district writes by hand (inventory,
 * contracts, declared list): the header is matched to known columns, and every
 * problem is reported with its line and column, without stopping at the first.
 */

/** Separator between items in a list inside a cell. */
export const LIST_SEPARATOR = '|';

export interface TableIssue {
  readonly severity: 'error' | 'warning';
  readonly line: number;
  readonly column?: string;
  readonly message: string;
}

export interface TableRow<C extends string> {
  readonly line: number;
  /** The trimmed value of a column, or '' when the column is absent. */
  get(column: C): string;
  /** True when the row has more values than the header has columns. */
  readonly tooLong: boolean;
}

export interface Table<C extends string> {
  /** False when the file cannot be read: no rows are returned. */
  readonly ok: boolean;
  readonly rows: readonly TableRow<C>[];
  readonly issues: readonly TableIssue[];
  readonly headerLine: number;
  readonly columnCount: number;
  readonly separator: CsvSeparator;
}

const SEPARATOR_NAMES: Record<CsvSeparator, string> = { ',': 'commas', ';': 'semicolons', '\t': 'tabs' };

export function readTable<C extends string>(text: string, columns: readonly C[], required: readonly C[]): Table<C> {
  const issues: TableIssue[] = [];
  const fail = (): Table<C> => ({ ok: false, rows: [], issues, headerLine: 1, columnCount: 0, separator: ',' });

  let parsed;
  try {
    parsed = parseCsvWithSeparator(text);
  } catch (e) {
    if (!(e instanceof CsvError)) throw e;
    issues.push({ severity: 'error', line: e.line, message: e.message.replace(/^line \d+: /, '') });
    return fail();
  }
  const { records, separator } = parsed;
  const header = records[0];
  if (!header) {
    issues.push({ severity: 'error', line: 1, message: 'The file is empty.' });
    return fail();
  }
  if (separator !== ',')
    issues.push({ severity: 'warning', line: header.line, message: `The file uses ${SEPARATOR_NAMES[separator]} between columns instead of commas; it was read that way.` });

  const position = new Map<C, number>();
  header.cells.forEach((raw, i) => {
    const name = raw.trim().toLowerCase();
    if ((columns as readonly string[]).includes(name)) {
      const col = name as C;
      if (position.has(col)) issues.push({ severity: 'error', line: header.line, column: col, message: `Column '${col}' appears twice.` });
      else position.set(col, i);
    } else if (name !== '') {
      issues.push({ severity: 'warning', line: header.line, column: raw.trim(), message: `Unknown column '${raw.trim()}' is ignored.${suggest(name, columns)}` });
    }
  });
  const missing = required.filter((c) => !position.has(c));
  if (missing.length > 0) issues.push({ severity: 'error', line: header.line, message: `Missing required column(s): ${missing.join(', ')}.` });
  if (issues.some((i) => i.severity === 'error')) return { ...fail(), headerLine: header.line, separator };

  const rows = records.slice(1).map((record) => ({
    line: record.line,
    tooLong: record.cells.length > header.cells.length,
    get(column: C): string {
      const i = position.get(column);
      return i === undefined ? '' : (record.cells[i] ?? '').trim();
    },
  }));
  return { ok: true, rows, issues, headerLine: header.line, columnCount: header.cells.length, separator };
}

/** Splits a cell into its `|`-separated items, trimmed, without empty ones. */
export function splitList(cell: string): string[] {
  return cell
    .split(LIST_SEPARATOR)
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

/** True for a real calendar date written as YYYY-MM-DD. */
export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Edit distance, for "did you mean" suggestions. */
function distance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}

/** " Did you mean 'x'?" for the closest option, or '' when none is close. */
export function suggest(value: string, options: Iterable<string>): string {
  const v = value.toLowerCase();
  const all = [...options];
  // A value that starts an option ("instructional" for "instructional_content") is a likely abbreviation.
  const prefixed = all.filter((o) => v.length >= 4 && o.toLowerCase().startsWith(v)).sort((a, b) => a.length - b.length);
  if (prefixed.length > 0) return ` Did you mean '${prefixed[0]}'?`;
  let best: string | undefined;
  let bestD = Infinity;
  for (const o of all) {
    const d = distance(v, o.toLowerCase());
    if (d < bestD) [best, bestD] = [o, d];
  }
  return best !== undefined && bestD <= Math.max(2, Math.floor(v.length / 3)) ? ` Did you mean '${best}'?` : '';
}
