import { EXHIBIT_B_CATEGORIES, exhibitBCategoryByName, fieldByName, type ExhibitBCategory, type FieldKey } from '../catalog/index.js';
import { isValidDate, readTable, splitList as list } from '../csv/index.js';

/**
 * The declared list, v0.1: what the district has published about which vendors
 * receive student data and which data they receive. Specified in
 * docs/formats/declared.md.
 *
 * Several state laws require this publication (Illinois 105 ILCS 85/27(a)(1),
 * Colorado C.R.S. 22-16-107(1) and 22-16-108(1)). RosterRadius compares it with
 * what actually flows, to find vendors or data the publication leaves out.
 * In v0.1 it is entered by hand; reading SDPC or LearnPlatform exports is
 * planned for v0.2.
 */

export interface Declaration {
  readonly vendorId: string;
  /** Apps the entry covers. Omit when it covers every app of the vendor. */
  readonly appIds?: readonly string[];
  /** Exhibit B categories the publication lists as a whole. */
  readonly exhibitB?: readonly ExhibitBCategory[];
  /** Individual fields the publication lists. */
  readonly fields?: readonly FieldKey[];
  /** When the district published or last updated the list, as YYYY-MM-DD. */
  readonly publishedOn?: string;
  /** Where the publication is, such as the district's privacy page. */
  readonly source?: string;
  readonly line: number;
}

export const DECLARED_COLUMNS = ['vendor', 'apps', 'exhibit_b', 'fields', 'published_on', 'source', 'notes'] as const;
export type DeclaredColumn = (typeof DECLARED_COLUMNS)[number];

export interface DeclaredIssue {
  readonly severity: 'error' | 'warning';
  readonly line: number;
  readonly column?: string;
  readonly message: string;
}

export interface DeclaredResult {
  readonly declarations: readonly Declaration[];
  readonly issues: readonly DeclaredIssue[];
}


/** True when the declaration says which data the vendor receives, not only that it receives some. */
export function declaresData(d: Declaration): boolean {
  return d.exhibitB !== undefined || d.fields !== undefined;
}

export function readDeclaredList(text: string): DeclaredResult {
  const issues: DeclaredIssue[] = [];
  const declarations: Declaration[] = [];
  const table = readTable(text, DECLARED_COLUMNS, ['vendor'] as const);
  issues.push(...table.issues);
  if (!table.ok) return { declarations, issues };

  for (const record of table.rows) {
    const line = record.line;
    const rowIssues: DeclaredIssue[] = [];
    const error = (column: DeclaredColumn, message: string) => rowIssues.push({ severity: 'error', line, column, message });
    const get = (col: DeclaredColumn): string => record.get(col);
    if (record.tooLong) rowIssues.push({ severity: 'error', line, message: `The row has more values than the header has columns (${table.columnCount}).` });

    const vendor = get('vendor');
    if (vendor === '') error('vendor', 'The vendor name is empty.');
    const apps = list(get('apps'));

    const categoriesRaw = list(get('exhibit_b'));
    const exhibitB: ExhibitBCategory[] = [];
    for (const name of categoriesRaw) {
      const c = exhibitBCategoryByName(name);
      if (!c) error('exhibit_b', `Unknown Exhibit B category '${name}'. Valid categories: ${EXHIBIT_B_CATEGORIES.join(', ')}.`);
      else if (!exhibitB.includes(c)) exhibitB.push(c);
    }
    const fieldsRaw = list(get('fields'));
    const fields: FieldKey[] = [];
    for (const name of fieldsRaw) {
      const k = fieldByName(name);
      if (!k) error('fields', `Unknown field '${name}'. Use a catalog key or label.`);
      else if (!fields.includes(k)) fields.push(k);
    }
    if (categoriesRaw.length === 0 && fieldsRaw.length === 0)
      rowIssues.push({
        severity: 'warning',
        line,
        column: 'exhibit_b',
        message: `No data listed for ${vendor || 'this vendor'}: the vendor counts as disclosed, but its data cannot be compared.`,
      });

    const publishedOn = get('published_on');
    if (publishedOn !== '' && !isValidDate(publishedOn)) error('published_on', `'${publishedOn}' is not a valid date. Use YYYY-MM-DD.`);
    const source = get('source');

    issues.push(...rowIssues);
    if (rowIssues.some((i) => i.severity === 'error')) continue;
    declarations.push({
      vendorId: vendor,
      ...(apps.length > 0 ? { appIds: apps } : {}),
      ...(categoriesRaw.length > 0 ? { exhibitB } : {}),
      ...(fieldsRaw.length > 0 ? { fields } : {}),
      ...(publishedOn ? { publishedOn } : {}),
      ...(source ? { source } : {}),
      line,
    });
  }
  return { declarations, issues };
}
