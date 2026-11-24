import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { generateSyntheticDistrict, sha256 } from '@roster-radius/core';
import { AnalysisSession } from '../src/worker/session';
import { decode, relativePaths } from '../src/worker/files';
import { CONTENT_SECURITY_POLICY } from '../csp.ts';

const district = generateSyntheticDistrict();
const loaded = (prefix = '') => Object.entries(district.files).map(([path, text]) => ({ path: `${prefix}${path}`, content: new Blob([text]) }));

describe('the analysis worker', () => {
  it('analyzes the sample district and answers with the report only', async () => {
    const session = new AnalysisSession();
    const answer = await session.handle({ type: 'sample' });

    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    expect(answer.report.totals.students).toBe(1660);
    expect(Object.keys(answer)).toEqual(['ok', 'report']);
    expect(JSON.stringify(answer)).not.toContain('or-u-');
  });

  it('reads the files the district loaded, from a chosen folder, as the sample', async () => {
    const answer = await new AnalysisSession().handle({ type: 'analyze', files: loaded('my-district/'), today: district.today });
    const sample = await new AnalysisSession().handle({ type: 'sample' });

    expect(answer).toEqual(sample);
  });

  it('hashes the bytes as loaded, and reads Windows-1252 files with a warning', async () => {
    const inventory = district.files['inventory.csv']!.replace('Elementary reading', 'Lecture élémentaire');
    const bytes = new Uint8Array([...inventory].map((c) => c.charCodeAt(0)));
    const files = [...loaded().filter((f) => f.path !== 'inventory.csv'), { path: 'inventory.csv', content: new Blob([bytes]) }];
    const answer = await new AnalysisSession().handle({ type: 'analyze', files, today: district.today });

    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    expect(answer.report.inputs.find((f) => f.path === 'inventory.csv')?.sha256).toBe(sha256(bytes));
    expect(answer.report.issues[0]).toMatchObject({ file: 'inventory', message: expect.stringContaining('Windows-1252') });
    expect(answer.report.totals.apps).toBe(8);
  });

  it('reads the roster from a OneRoster zip, and lists the zip among the inputs', async () => {
    const entries = Object.fromEntries(Object.entries(district.files).filter(([p]) => p.startsWith('oneroster/')).map(([p, t]) => [p, strToU8(t)]));
    const zip = zipSync(entries);
    const files = [...loaded().filter((f) => !f.path.startsWith('oneroster/')), { path: 'roster.zip', content: new Blob([zip]) }];
    const answer = await new AnalysisSession().handle({ type: 'analyze', files, today: district.today });

    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    expect(answer.report.totals.students).toBe(1660);
    expect(answer.report.inputs).toContainEqual({ path: 'roster.zip', role: 'oneroster', sha256: sha256(zip), bytes: zip.length });
  });

  it('answers incident, notification and reduction requests from the flows it keeps', async () => {
    const session = new AnalysisSession();
    await session.handle({ type: 'sample' });
    const scope = { kind: 'vendor', vendorId: 'Acme Learning' } as const;

    const incident = await session.handle({ type: 'incident', scope, notifiedOn: '2026-12-15', state: 'IL' });
    expect(incident.ok && incident.incident.students.people.max).toBe(1140);
    expect(JSON.stringify(incident)).not.toContain('or-u-');

    const notification = await session.handle({ type: 'notification', scope });
    expect(notification.ok && notification.csv.split('\n')[0]).toBe('population,oneroster_sourced_id,district_id,data,apps');

    const reduction = await session.handle({ type: 'reduce', cuts: [{ fields: ['student.address', 'student.frl_status'], scope: { kind: 'app', appId: 'MathPath' } }] });
    expect(reduction.ok && reduction.reduction.students.vendors[0]?.points.drop.max).toBe(4500);
  });

  it('answers with an error, not an exception', async () => {
    const session = new AnalysisSession();

    expect(await session.handle({ type: 'reduce', cuts: [] })).toEqual({ ok: false, error: 'Run an analysis first.' });
    await session.handle({ type: 'sample' });
    expect(await session.handle({ type: 'analyze', files: [], today: '2026-11-22' })).toEqual({ ok: false, error: 'inventory.csv was not provided.' });
    expect(session.hasAnalysis).toBe(false);
    await session.handle({ type: 'sample' });
    expect(await session.handle({ type: 'incident', scope: { kind: 'vendor', vendorId: 'Nobody' }, notifiedOn: '2026-12-15' })).toMatchObject({ ok: false });
    expect(session.hasAnalysis).toBe(true);
  });
});

describe('reading the files', () => {
  it('removes the folder the district chose from the paths', () => {
    expect(relativePaths(['d/inventory.csv', 'd/oneroster/users.csv'])).toEqual(['inventory.csv', 'oneroster/users.csv']);
    expect(relativePaths(['inventory.csv', 'oneroster/users.csv'])).toEqual(['inventory.csv', 'oneroster/users.csv']);
    expect(relativePaths(['a\\inventory.csv', 'a\\users.csv'])).toEqual(['inventory.csv', 'users.csv']);
  });

  it('reads UTF-8, and falls back to Windows-1252', () => {
    expect(decode(strToU8('café'))).toEqual({ text: 'café', encoding: 'utf-8' });
    expect(decode(new Uint8Array([0x63, 0x61, 0x66, 0xe9]))).toEqual({ text: 'café', encoding: 'windows-1252' });
    expect(decode(new Uint8Array([0xef, 0xbb, 0xbf, 0x61])).text).toBe('a');
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
