import { APP_CATEGORIES, type AppCategory } from '../baselines/index.js';
import { FIELDS, fieldByName, type FieldKey } from '../catalog/index.js';
import { isValidDate, readTable, splitList as list, suggest } from '../csv/index.js';
import {
  CHANNEL_TYPES,
  GRADE_CODES,
  INVENTORY_COLUMNS,
  REQUIRED_COLUMNS,
  defaultChannelId,
  normalizeGrade,
  type ChannelType,
  type FieldSource,
  type GradeCode,
  type InventoryColumn,
  type InventoryRow,
  type PeopleSpec,
  type Subprocessor,
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

const CATEGORY_KEYS = Object.keys(APP_CATEGORIES) as AppCategory[];
/** Every key and label, for suggestions. */
const FIELD_NAMES = FIELDS.flatMap((f) => [f.key, f.label]);

export function readInventory(text: string): InventoryResult {
  const issues: InventoryIssue[] = [];
  const rows: InventoryRow[] = [];

  const table = readTable(text, INVENTORY_COLUMNS, REQUIRED_COLUMNS);
  issues.push(...table.issues);
  if (!table.ok) return { rows, issues };

  const appInfo = new Map<string, { vendor: string; category: AppCategory | undefined; line: number }>();
  const flowLine = new Map<string, number>();

  for (const record of table.rows) {
    const line = record.line;
    const rowIssues: InventoryIssue[] = [];
    const error = (column: InventoryColumn | undefined, message: string) =>
      rowIssues.push({ severity: 'error', line, ...(column ? { column } : {}), message });
    const warning = (column: InventoryColumn | undefined, message: string) =>
      rowIssues.push({ severity: 'warning', line, ...(column ? { column } : {}), message });
    const get = (col: InventoryColumn): string => record.get(col);

    if (record.tooLong) error(undefined, `The row has more values than the header has columns (${table.columnCount}).`);

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
        const key = fieldByName(name);
        if (!key) error('fields', `Unknown field '${name}'.${suggest(name, FIELD_NAMES)}`);
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

    // Subprocessors: names separated by |, an AI provider marked [ai].
    const subprocessors: Subprocessor[] = [];
    for (const item of list(get('subprocessors'))) {
      const tags = [...item.matchAll(/\[([^\]]*)\]/g)].map((m) => m[1]!.trim().toLowerCase());
      const name = item.replace(/\[[^\]]*\]/g, '').trim();
      const unknown = tags.filter((t) => t !== 'ai');
      if (name === '') {
        error('subprocessors', `'${item}' has no name.`);
        continue;
      }
      if (unknown.length > 0) warning('subprocessors', `Unknown mark [${unknown.join('], [')}] on '${name}' is ignored. The only mark is [ai].`);
      if (subprocessors.some((x) => x.name.toLowerCase() === name.toLowerCase())) {
        warning('subprocessors', `Subprocessor '${name}' is listed twice.`);
        continue;
      }
      subprocessors.push({ name, ai: tags.includes('ai') });
    }

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
      subprocessors,
      ...(notes ? { notes } : {}),
    });
  }

  if (table.rows.length === 0) issues.push({ severity: 'warning', line: table.headerLine, message: 'The inventory has a header but no rows.' });
  return { rows, issues };
}
