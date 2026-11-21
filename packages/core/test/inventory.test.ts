import { describe, expect, it } from 'vitest';
import { INVENTORY_COLUMNS, REQUIRED_COLUMNS, defaultChannelId } from '../src/index.js';

describe('inventory format', () => {
  it('required columns are part of the template', () => {
    for (const c of REQUIRED_COLUMNS) expect(INVENTORY_COLUMNS).toContain(c);
  });

  it('shared channels have one instance per district, others one per vendor', () => {
    expect(defaultChannelId('clever', 'Acme')).toBe('clever');
    expect(defaultChannelId('classlink', 'Acme')).toBe('classlink');
    expect(defaultChannelId('sftp', 'Acme')).toBe('sftp:Acme');
  });

});
