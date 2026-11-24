import { describe, expect, it } from 'vitest';
import { analyzeFiles, generateSyntheticDistrict } from '@roster-radius/core';
import { describeFiles, fileLabel, isFatal, matchingNotes, resultsAccess, sortIssues } from '../src/app/check';

const district = generateSyntheticDistrict();

describe('checking the files', async () => {
  const { report } = await analyzeFiles(district.files, { today: district.today });

  it('describes each file the analysis read', () => {
    const rows = describeFiles(report);

    expect(rows.map((r) => `${r.title}: ${r.status}`)).toEqual([
      'OneRoster export: read',
      'App inventory: read',
      'Contracts: warning',
      'Published list: read',
      'clever/quizhub/students.csv: read',
      'exports/mathpath_students.csv: warning',
    ]);
    expect(rows[0]?.detail).toBe('manifest.csv, orgs.csv, users.csv · 4 schools, 1,660 students, 85 staff.');
    expect(rows[1]?.detail).toBe('8 apps from 7 vendors, 8 rows read.');
    expect(rows[4]?.detail).toBe('The students QuizHub reaches: 116, identified by Student_id.');
    expect(rows[5]?.detail).toContain('Columns read as the fields MathPath receives');
  });

  it('marks a file the inventory does not name as not used', async () => {
    const { report: extra } = await analyzeFiles({ ...district.files, 'notes/other.csv': 'a,b\n1,2' }, { today: district.today, inputs: [] });
    const withExtra = { ...extra, inputs: [...extra.inputs, { path: 'notes/other.csv', role: 'vendor_file' as const, sha256: 'x', bytes: 7 }] };

    expect(describeFiles(withExtra).at(-1)).toMatchObject({ title: 'notes/other.csv', status: 'unused' });
  });

  it('lists errors before warnings, and names files the way the district knows them', () => {
    const sorted = sortIssues([
      { severity: 'warning', file: 'contracts', line: 4, message: 'w' },
      { severity: 'error', file: 'inventory', line: 9, message: 'e' },
    ]);

    expect(sorted.map((i) => i.severity)).toEqual(['error', 'warning']);
    expect(fileLabel('inventory')).toBe('App inventory');
    expect(fileLabel('oneroster/users.csv')).toBe('oneroster/users.csv');
  });

  it('explains how people were matched', () => {
    const notes = matchingNotes(report.flows);

    expect(notes[0]).toContain('take their people from the OneRoster export directly');
    expect(notes).toContain('QuizHub: 116 of 116 students in clever/quizhub/students.csv matched the OneRoster export through its identifier column (your district IDs).');
    expect(notes.some((n) => n.startsWith('FamilyTalk: 1,600 students come from a number typed in the inventory'))).toBe(true);
  });

  it('blocks results with errors until the district chooses to see them anyway', () => {
    const broken = { ...report, completeness: { complete: false, rowsLeftOut: 1 } };

    expect(resultsAccess(report, false)).toBe('open');
    expect(resultsAccess(broken, false)).toBe('needs-confirmation');
    expect(resultsAccess(broken, true)).toBe('open');
  });

  it('never shows results when none can be calculated', () => {
    expect(isFatal(report)).toBe(false);
    expect(resultsAccess({ ...report, flows: [] }, true)).toBe('blocked');
    expect(resultsAccess({ ...report, totals: { ...report.totals, students: 0, staff: 0 } }, true)).toBe('blocked');
  });
});
