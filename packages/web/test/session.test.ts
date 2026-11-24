import { describe, expect, it } from 'vitest';
import { generateSyntheticDistrict } from '@roster-radius/core';
import { AnalysisSession } from '../src/worker/session';
import { CONTENT_SECURITY_POLICY } from '../csp.ts';

describe('the analysis worker', () => {
  it('analyzes the sample district and answers with the report only', async () => {
    const session = new AnalysisSession();
    const result = await session.handle({ type: 'sample' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.totals.students).toBe(1660);
    expect(Object.keys(result)).toEqual(['ok', 'report']);
    expect(JSON.stringify(result)).not.toContain('or-u-');
    expect(session.hasAnalysis).toBe(true);
  });

  it('reads the files the district loaded', async () => {
    const district = generateSyntheticDistrict();
    const files = Object.entries(district.files).map(([path, text]) => ({ path, content: new Blob([text]) }));
    const session = new AnalysisSession();
    const result = await session.handle({ type: 'analyze', files, today: district.today });
    const sample = await new AnalysisSession().handle({ type: 'sample' });
    expect(result).toEqual(sample);
  });

  it('answers with an error, not an exception, and forgets the previous analysis', async () => {
    const session = new AnalysisSession();
    await session.handle({ type: 'sample' });
    const result = await session.handle({ type: 'analyze', files: [], today: '2026-11-22' });
    expect(result).toEqual({ ok: false, error: 'inventory.csv was not provided.' });
    expect(session.hasAnalysis).toBe(false);
  });
});

describe('the content security policy', () => {
  it('blocks every connection and allows nothing from outside the page', () => {
    expect(CONTENT_SECURITY_POLICY).toContain("connect-src 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("default-src 'none'");
    expect(CONTENT_SECURITY_POLICY).not.toContain('unsafe-inline');
    expect(CONTENT_SECURITY_POLICY).not.toContain('unsafe-eval');
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/https?:/);
  });
});
