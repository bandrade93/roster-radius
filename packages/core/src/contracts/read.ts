import { EXHIBIT_B_CATEGORIES, exhibitBCategoryByName, fieldByName, type ExhibitBCategory, type FieldKey } from '../catalog/index.js';
import { isValidDate, readTable, splitList as list } from '../csv/index.js';
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

export function readContracts(text: string): ContractsResult {
  const issues: ContractIssue[] = [];
  const contracts: Contract[] = [];
  const table = readTable(text, CONTRACT_COLUMNS, REQUIRED);
  issues.push(...table.issues);
  if (!table.ok) return { contracts, issues };

  const seenIds = new Map<string, number>();
  for (const record of table.rows) {
    const line = record.line;
    const rowIssues: ContractIssue[] = [];
    const error = (column: ContractColumn, message: string) => rowIssues.push({ severity: 'error', line, column, message });
    const warning = (column: ContractColumn, message: string) => rowIssues.push({ severity: 'warning', line, column, message });
    const get = (col: ContractColumn): string => record.get(col);
    if (record.tooLong) rowIssues.push({ severity: 'error', line, message: `The row has more values than the header has columns (${table.columnCount}).` });

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
      const category = exhibitBCategoryByName(name);
      if (category) {
        if (!exhibitB.includes(category)) exhibitB.push(category);
      } else error('exhibit_b', `Unknown Exhibit B category '${name}'. Valid categories: ${EXHIBIT_B_CATEGORIES.join(', ')}.`);
    }

    const fieldsRaw = list(get('fields'));
    const fields: FieldKey[] = [];
    for (const name of fieldsRaw) {
      const key = fieldByName(name);
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
