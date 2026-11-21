import { EXHIBIT_B_CATEGORIES, FIELDS, type ExhibitBCategory, type FieldKey } from '../catalog/index.js';
import { CsvError, parseCsv } from '../inventory/csv.js';
import { LIST_SEPARATOR } from '../inventory/types.js';
import { AGREEMENT_TYPES, type AgreementType, type Contract } from './types.js';

/**
 * Reads and validates a contracts file (docs/formats/contracts.md). Same rules
 * as the inventory: every problem reported with its line and column, rows with
 * errors left out, rows with warnings kept.
 */

export const CONTRACT_COLUMNS = ['contract_id', 'vendor', 'apps', 'exhibit_b', 'fields', 'end_date', 'deletion_days', 'agreement', 'source', 'notes'] as const;
export type ContractColumn = (typeof CONTRACT_COLUMNS)[number];
const REQUIRED: readonly ContractColumn[] = ['contract_id', 'vendor'];

export interface ContractIssue {
  readonly severity: 'error' | 'warning';
  readonly line: number;
  readonly column?: string;
  readonly message: string;
}

export interface ContractsResult {
  readonly contracts: readonly Contract[];
  readonly issues: readonly ContractIssue[];
}

const loose = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const CATEGORY_BY_NAME = new Map<string, ExhibitBCategory>(EXHIBIT_B_CATEGORIES.map((c) => [loose(c), c]));
const FIELD_BY_NAME = new Map<string, FieldKey>();
for (const f of FIELDS) {
  FIELD_BY_NAME.set(f.key.toLowerCase(), f.key);
  FIELD_BY_NAME.set(f.label.toLowerCase(), f.key);
}
const list = (cell: string): string[] =>
  cell
    .split(LIST_SEPARATOR)
    .map((s) => s.trim())
    .filter((s) => s !== '');

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function readContracts(text: string): ContractsResult {
  const issues: ContractIssue[] = [];
  const contracts: Contract[] = [];
  let records;
  try {
    records = parseCsv(text);
  } catch (e) {
    if (e instanceof CsvError) return { contracts, issues: [{ severity: 'error', line: e.line, message: e.message.replace(/^line \d+: /, '') }] };
    throw e;
  }
  const header = records[0];
  if (!header) return { contracts, issues: [{ severity: 'error', line: 1, message: 'The file is empty.' }] };

  const position = new Map<ContractColumn, number>();
  header.cells.forEach((raw, i) => {
    const name = raw.trim().toLowerCase();
    if ((CONTRACT_COLUMNS as readonly string[]).includes(name)) {
      if (position.has(name as ContractColumn)) issues.push({ severity: 'error', line: 1, column: name, message: `Column '${name}' appears twice.` });
      else position.set(name as ContractColumn, i);
    } else if (name !== '') issues.push({ severity: 'warning', line: 1, column: raw.trim(), message: `Unknown column '${raw.trim()}' is ignored.` });
  });
  const missing = REQUIRED.filter((c) => !position.has(c));
  if (missing.length > 0) {
    issues.push({ severity: 'error', line: 1, message: `Missing required column(s): ${missing.join(', ')}.` });
    return { contracts, issues };
  }
  if (issues.some((i) => i.severity === 'error')) return { contracts, issues };

  const seenIds = new Map<string, number>();
  for (const record of records.slice(1)) {
    const line = record.line;
    const rowIssues: ContractIssue[] = [];
    const error = (column: ContractColumn, message: string) => rowIssues.push({ severity: 'error', line, column, message });
    const warning = (column: ContractColumn, message: string) => rowIssues.push({ severity: 'warning', line, column, message });
    const get = (col: ContractColumn): string => {
      const i = position.get(col);
      return i === undefined ? '' : (record.cells[i] ?? '').trim();
    };

    const id = get('contract_id');
    const vendor = get('vendor');
    if (id === '') error('contract_id', 'The contract ID is empty.');
    else if (seenIds.has(id)) error('contract_id', `Contract ID '${id}' is already used on line ${seenIds.get(id)}.`);
    else seenIds.set(id, line);
    if (vendor === '') error('vendor', 'The vendor name is empty.');

    const apps = list(get('apps'));

    const exhibitBRaw = list(get('exhibit_b'));
    const exhibitB: ExhibitBCategory[] = [];
    for (const name of exhibitBRaw) {
      const category = CATEGORY_BY_NAME.get(loose(name));
      if (category) {
        if (!exhibitB.includes(category)) exhibitB.push(category);
      } else error('exhibit_b', `Unknown Exhibit B category '${name}'. Valid categories: ${EXHIBIT_B_CATEGORIES.join(', ')}.`);
    }

    const fieldsRaw = list(get('fields'));
    const fields: FieldKey[] = [];
    for (const name of fieldsRaw) {
      const key = FIELD_BY_NAME.get(name.toLowerCase());
      if (!key) error('fields', `Unknown field '${name}'.`);
      else if (!key.startsWith('student.') && !key.startsWith('guardian.')) warning('fields', `'${name}' is not student or guardian data; contracts are compared on student data only.`);
      else if (!fields.includes(key)) fields.push(key);
    }
    if (exhibitBRaw.length === 0 && fieldsRaw.length === 0)
      warning('exhibit_b', 'No Exhibit B categories or fields recorded: dates are checked, but fields are not compared with this contract.');

    const endDate = get('end_date');
    if (endDate !== '' && !isValidDate(endDate)) error('end_date', `'${endDate}' is not a valid date. Use YYYY-MM-DD.`);
    const deletionRaw = get('deletion_days');
    let deletionDays: number | undefined;
    if (deletionRaw !== '') {
      if (/^\d+$/.test(deletionRaw)) deletionDays = Number(deletionRaw);
      else error('deletion_days', `'${deletionRaw}' is not a valid number of days.`);
    }
    const agreementRaw = get('agreement').toLowerCase();
    let agreement: AgreementType | undefined;
    if (agreementRaw !== '') {
      if ((AGREEMENT_TYPES as readonly string[]).includes(agreementRaw)) agreement = agreementRaw as AgreementType;
      else error('agreement', `Unknown agreement type '${get('agreement')}'. Use ${AGREEMENT_TYPES.join(', ')}.`);
    }
    const source = get('source');

    issues.push(...rowIssues);
    if (rowIssues.some((i) => i.severity === 'error')) continue;
    contracts.push({
      id,
      vendorId: vendor,
      ...(apps.length > 0 ? { appIds: apps } : {}),
      ...(exhibitBRaw.length > 0 ? { exhibitB } : {}),
      ...(fieldsRaw.length > 0 ? { fields } : {}),
      ...(endDate ? { expiresOn: endDate } : {}),
      ...(deletionDays !== undefined ? { deletionDays } : {}),
      ...(agreement ? { agreement } : {}),
      ...(source ? { source } : {}),
      line,
    });
  }
  return { contracts, issues };
}
