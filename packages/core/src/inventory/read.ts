import { APP_CATEGORIES, type AppCategory } from '../baselines/index.js';
import { FIELDS, type FieldKey } from '../catalog/index.js';
import { CsvError, parseCsv } from './csv.js';
import {
  CHANNEL_TYPES,
  GRADE_CODES,
  INVENTORY_COLUMNS,
  LIST_SEPARATOR,
  REQUIRED_COLUMNS,
  defaultChannelId,
  normalizeGrade,
  type ChannelType,
  type FieldSource,
  type GradeCode,
  type InventoryColumn,
  type InventoryRow,
  type PeopleSpec,
} from './types.js';

/**
 * Reads and validates an app inventory (docs/formats/inventory.md).
 *
 * Every problem is reported with its line, and the column when there is one.
 * A row with an error is left out of `rows`; a row with only warnings is kept.
 * Reading never stops at the first problem, so the district sees all of them
 * at once.
 */

export type IssueSeverity = 'error' | 'warning';

export interface InventoryIssue {
  readonly severity: IssueSeverity;
  readonly line: number;
  readonly column?: string;
  readonly message: string;
}

export interface InventoryResult {
  readonly rows: readonly InventoryRow[];
  readonly issues: readonly InventoryIssue[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CATEGORY_KEYS = Object.keys(APP_CATEGORIES) as AppCategory[];
const FIELD_BY_NAME = new Map<string, FieldKey>();
for (const f of FIELDS) {
  FIELD_BY_NAME.set(f.key.toLowerCase(), f.key);
  FIELD_BY_NAME.set(f.label.toLowerCase(), f.key);
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

function suggest(value: string, options: Iterable<string>): string {
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

const list = (cell: string): string[] =>
  cell
    .split(LIST_SEPARATOR)
    .map((s) => s.trim())
    .filter((s) => s !== '');

function isValidDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function readInventory(text: string): InventoryResult {
  const issues: InventoryIssue[] = [];
  const rows: InventoryRow[] = [];

  let records;
  try {
    records = parseCsv(text);
  } catch (e) {
    if (e instanceof CsvError) return { rows, issues: [{ severity: 'error', line: e.line, message: e.message.replace(/^line \d+: /, '') }] };
    throw e;
  }
  const header = records[0];
  if (!header) return { rows, issues: [{ severity: 'error', line: 1, message: 'The file is empty.' }] };

  // Header: map each known column to its position.
  const position = new Map<InventoryColumn, number>();
  header.cells.forEach((raw, i) => {
    const name = raw.trim().toLowerCase();
    if ((INVENTORY_COLUMNS as readonly string[]).includes(name)) {
      const col = name as InventoryColumn;
      if (position.has(col)) issues.push({ severity: 'error', line: header.line, column: col, message: `Column '${col}' appears twice.` });
      else position.set(col, i);
    } else if (name !== '') {
      issues.push({
        severity: 'warning',
        line: header.line,
        column: raw.trim(),
        message: `Unknown column '${raw.trim()}' is ignored.${suggest(name, INVENTORY_COLUMNS)}`,
      });
    }
  });
  const missing = REQUIRED_COLUMNS.filter((c) => !position.has(c));
  if (missing.length > 0) {
    issues.push({ severity: 'error', line: header.line, message: `Missing required column(s): ${missing.join(', ')}.` });
    return { rows, issues };
  }
  if (issues.some((i) => i.severity === 'error')) return { rows, issues };

  const appInfo = new Map<string, { vendor: string; category: AppCategory | undefined; line: number }>();
  const flowLine = new Map<string, number>();

  for (const record of records.slice(1)) {
    const line = record.line;
    const rowIssues: InventoryIssue[] = [];
    const error = (column: InventoryColumn | undefined, message: string) =>
      rowIssues.push({ severity: 'error', line, ...(column ? { column } : {}), message });
    const warning = (column: InventoryColumn | undefined, message: string) =>
      rowIssues.push({ severity: 'warning', line, ...(column ? { column } : {}), message });
    const get = (col: InventoryColumn): string => {
      const i = position.get(col);
      return i === undefined ? '' : (record.cells[i] ?? '').trim();
    };

    if (record.cells.length > header.cells.length) error(undefined, `The row has ${record.cells.length} values but the header has ${header.cells.length} columns.`);

    const app = get('app');
    const vendor = get('vendor');
    if (app === '') error('app', 'The app name is empty.');
    if (vendor === '') error('vendor', 'The vendor name is empty.');

    // Channel
    const channelRaw = get('channel').toLowerCase();
    let channel: ChannelType | undefined;
    if (channelRaw === '') error('channel', 'The channel is empty.');
    else if ((CHANNEL_TYPES as readonly string[]).includes(channelRaw)) channel = channelRaw as ChannelType;
    else error('channel', `Unknown channel '${get('channel')}'.${suggest(channelRaw, CHANNEL_TYPES)} Valid channels: ${CHANNEL_TYPES.join(', ')}.`);

    // Fields
    const fieldsRaw = get('fields');
    let fields: FieldKey[] = [];
    let fieldSource: FieldSource = { kind: 'entered' };
    if (fieldsRaw === '') error('fields', 'The field list is empty.');
    else if (fieldsRaw.toLowerCase().startsWith('file:')) {
      const path = fieldsRaw.slice(5).trim();
      if (path === '') error('fields', "'file:' needs a path, for example file:exports/students.csv.");
      else fieldSource = { kind: 'file', path };
    } else {
      const seen = new Set<FieldKey>();
      for (const name of list(fieldsRaw)) {
        const key = FIELD_BY_NAME.get(name.toLowerCase());
        if (!key) error('fields', `Unknown field '${name}'.${suggest(name, FIELD_BY_NAME.keys())}`);
        else if (seen.has(key)) warning('fields', `Field '${name}' is listed twice.`);
        else seen.add(key);
      }
      fields = [...seen];
    }
    const hasStudentFields = fields.some((k) => k.startsWith('student.') || k.startsWith('guardian.'));
    const hasStaffFields = fields.some((k) => k.startsWith('staff.'));
    const fieldsKnown = fieldSource.kind === 'entered';

    // Category
    const categoryRaw = get('category').toLowerCase();
    let category: AppCategory | undefined;
    if (categoryRaw !== '') {
      if ((CATEGORY_KEYS as string[]).includes(categoryRaw)) category = categoryRaw as AppCategory;
      else error('category', `Unknown category '${get('category')}'.${suggest(categoryRaw, CATEGORY_KEYS)}`);
    }

    // People
    const people = (col: 'students' | 'staff'): PeopleSpec | undefined => {
      const raw = get(col);
      const v = raw.toLowerCase();
      if (v === '') {
        if (col === 'students') return { kind: fieldsKnown && !hasStudentFields ? 'none' : 'all' };
        if (fieldsKnown && hasStaffFields) {
          error('staff', "The row has staff fields, so 'staff' must say which staff are reached: all, teachers, count:N or file:PATH.");
          return undefined;
        }
        return { kind: 'none' };
      }
      if (v === 'all' || v === 'none') return { kind: v };
      if (v === 'teachers') {
        if (col === 'staff') return { kind: 'teachers' };
        error(col, "'teachers' is only valid in the 'staff' column.");
        return undefined;
      }
      if (v.startsWith('count:')) {
        const n = v.slice(6).trim();
        if (/^\d+$/.test(n) && Number(n) > 0) return { kind: 'count', count: Number(n) };
        error(col, `'${raw}' is not a valid count. Use count:N with a whole number above zero.`);
        return undefined;
      }
      if (v.startsWith('file:')) {
        const path = raw.slice(5).trim();
        if (path !== '') return { kind: 'file', path };
        error(col, "'file:' needs a path.");
        return undefined;
      }
      error(col, `'${raw}' is not valid. Use all, none, ${col === 'staff' ? 'teachers, ' : ''}count:N or file:PATH.`);
      return undefined;
    };
    const students = people('students');
    const staff = people('staff');
    if (fieldsKnown && students?.kind === 'none' && hasStudentFields) error('students', "The row has student or guardian fields, but 'students' is none.");
    if (fieldsKnown && staff?.kind === 'none' && hasStaffFields && get('staff') !== '') error('staff', "The row has staff fields, but 'staff' is none.");

    // Schools and grades
    const schools = list(get('schools'));
    const grades: GradeCode[] = [];
    for (const g of list(get('grades'))) {
      const code = normalizeGrade(g);
      if (code) grades.push(code);
      else error('grades', `Unknown grade '${g}'. Use PK, KG or 01 to 12.`);
    }
    if (grades.length > 0 && students && students.kind !== 'all') warning('grades', `'grades' only applies when 'students' is all; it is ignored here.`);

    // Contract columns
    const contractEnd = get('contract_end');
    if (contractEnd !== '' && !isValidDate(contractEnd)) error('contract_end', `'${contractEnd}' is not a valid date. Use YYYY-MM-DD.`);
    const deletionRaw = get('deletion_days');
    let deletionDays: number | undefined;
    if (deletionRaw !== '') {
      if (/^\d+$/.test(deletionRaw)) deletionDays = Number(deletionRaw);
      else error('deletion_days', `'${deletionRaw}' is not a valid number of days.`);
    }
    if (deletionDays !== undefined && contractEnd === '') warning('deletion_days', "'deletion_days' has no effect without 'contract_end'.");

    // Consistency across rows: an app belongs to one vendor and one category.
    if (app !== '' && vendor !== '') {
      const prev = appInfo.get(app);
      if (!prev) appInfo.set(app, { vendor, category, line });
      else {
        if (prev.vendor !== vendor) error('vendor', `App '${app}' has vendor '${prev.vendor}' on line ${prev.line}. An app belongs to one vendor.`);
        if (category && prev.category && prev.category !== category)
          error('category', `App '${app}' has category '${prev.category}' on line ${prev.line}. An app has one category.`);
      }
    }

    const channelId = get('channel_id') || (channel && vendor ? defaultChannelId(channel, vendor) : '');
    if (app !== '' && channelId !== '') {
      const flowKey = `${app}\u0000${channelId}`;
      const prevLine = flowLine.get(flowKey);
      if (prevLine !== undefined) warning(undefined, `App '${app}' already has a row for channel '${channelId}' on line ${prevLine}. Both rows are counted.`);
      else flowLine.set(flowKey, line);
    }

    issues.push(...rowIssues);
    if (rowIssues.some((i) => i.severity === 'error') || !channel || !students || !staff) continue;

    const notes = get('notes');
    rows.push({
      line,
      app,
      vendor,
      channel,
      channelId,
      fields,
      fieldSource,
      ...(category ? { category } : {}),
      students,
      staff,
      schools,
      grades,
      ...(contractEnd ? { contractEnd } : {}),
      ...(deletionDays !== undefined ? { deletionDays } : {}),
      ...(notes ? { notes } : {}),
    });
  }

  if (records.length === 1) issues.push({ severity: 'warning', line: header.line, message: 'The inventory has a header but no rows.' });
  return { rows, issues };
}
