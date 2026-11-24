import { describe, expect, it } from 'vitest';
import { formatDate, formatNumber, formatPercent, formatRange, plural } from '../src/format/numbers';

describe('formatting for the page', () => {
  it('writes numbers the way a U.S. reader expects', () => {
    expect(formatNumber(25050)).toBe('25,050');
    expect(formatPercent(0.687)).toBe('68.7%');
    expect(plural(1, 'vendor')).toBe('1 vendor');
    expect(plural(1660, 'student')).toBe('1,660 students');
  });

  it('writes a value when it is known, and its bounds when it is not', () => {
    expect(formatRange({ min: 1660, max: 1660, exact: true })).toBe('1,660');
    expect(formatRange({ min: 1600, max: 1600, exact: false })).toBe('1,600');
    expect(formatRange({ min: 1600, max: 3260, exact: false })).toBe('1,600 to 3,260');
  });

  it('writes dates in words, whatever the time zone', () => {
    expect(formatDate('2026-11-17')).toBe('November 17, 2026');
    expect(formatDate('not a date')).toBe('not a date');
  });
});

describe('labels', async () => {
  const { channelLabel } = await import('../src/format/labels');

  it('names channels the way people say them', () => {
    expect(channelLabel('clever')).toBe('Clever');
    expect(channelLabel('sftp')).toBe('SFTP');
    expect(channelLabel('manual_upload:Family Messaging LLC')).toBe('Manual upload');
    expect(channelLabel('google_classroom')).toBe('Google classroom');
  });
});
