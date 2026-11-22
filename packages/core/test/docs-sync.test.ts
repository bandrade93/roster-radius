import { describe, expect, it } from 'vitest';
import { INVENTORY_COLUMNS, readInventory, renderFieldTable } from '../src/index.js';
import fieldsDoc from '../../../docs/formats/fields.md?raw';
import template from '../../../docs/formats/inventory-template.csv?raw';

// Git may check files out with Windows line endings.
const lf = (s: string): string => s.replace(/\r\n/g, '\n');

describe('documents generated from the code', () => {
  it('docs/formats/fields.md matches the catalog (run `npm run fields` after changing the catalog)', () => {
    expect(lf(fieldsDoc)).toBe(renderFieldTable());
  });

  it('the inventory template has every column, in order, and its example row is valid', () => {
    const [header] = lf(template).split('\n');
    expect(header).toBe(INVENTORY_COLUMNS.join(','));
    expect(readInventory(lf(template)).issues).toEqual([]);
  });
});
