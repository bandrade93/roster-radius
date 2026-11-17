import { describe, expect, it } from 'vitest';
import { STATE_LAWS, breachDueDates } from '../src/index.js';

describe('state laws', () => {
  it('every entry has sources, a verification date and citations', () => {
    for (const law of Object.values(STATE_LAWS)) {
      expect(law.sources.length).toBeGreaterThan(0);
      expect(law.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const item of [...law.publication, ...law.breach]) expect(item.citation).not.toBe('');
      for (const duty of law.breach) expect(duty.days === null).toBe(duty.startsAt === null);
    }
  });

  it('marks the publications that describe data elements, for disclosure versus flow', () => {
    expect(STATE_LAWS.IL.publication.filter((p) => p.describesDataElements)).toHaveLength(1);
    expect(STATE_LAWS.CO.publication.filter((p) => p.describesDataElements)).toHaveLength(2);
  });

  it('computes the last day of each fixed deadline, in calendar days', () => {
    expect(breachDueDates('IL', '2026-12-15').map((d) => [d.duty.id, d.dueOn])).toEqual([
      ['il.operator_notice', '2027-01-14'],
      ['il.parent_notice', '2027-01-14'],
    ]);
    expect(breachDueDates('CO', '2027-02-10').map((d) => [d.duty.id, d.dueOn])).toEqual([['co.resident_notice', '2027-03-12']]);
    expect(() => breachDueDates('IL', 'yesterday')).toThrow(RangeError);
  });
});
