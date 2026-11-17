import { describe, expect, it } from 'vitest';
import { ALERT_FEDERAL_BASIS, ALERT_RULES, CLASS_FEDERAL_BASIS, FEDERAL_LAWS, FEDERAL_PROVISIONS, getProvision } from '../src/index.js';

describe('federal basis', () => {
  it('every provision belongs to a known law and has a citation', () => {
    const ids = new Set<string>();
    for (const p of FEDERAL_PROVISIONS) {
      expect(FEDERAL_LAWS[p.law]).toBeDefined();
      expect(p.citation).not.toBe('');
      expect(ids.has(p.id)).toBe(false);
      ids.add(p.id);
    }
  });

  it('every alert rule is mapped, and only the operational one has no basis', () => {
    for (const rule of ALERT_RULES) expect(ALERT_FEDERAL_BASIS[rule]).toBeDefined();
    expect(ALERT_RULES.filter((r) => ALERT_FEDERAL_BASIS[r].length === 0)).toEqual(['unclassified_app']);
  });

  it('special status rests on the school lunch act and IDEA', () => {
    expect(CLASS_FEDERAL_BASIS.special_status?.map((id) => getProvision(id).law)).toEqual(['nsla', 'idea']);
  });

  it('every law has a source and a verification date', () => {
    for (const law of Object.values(FEDERAL_LAWS)) {
      expect(law.sources.length).toBeGreaterThan(0);
      expect(law.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
