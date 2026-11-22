import { describe, expect, it } from 'vitest';
import { generateSyntheticDistrict, readContracts, readDeclaredList, readExportHeader, readInventory, readOneRosterFiles, readPeopleFile } from '../src/index.js';

describe('synthetic district', () => {
  const district = generateSyntheticDistrict();
  const { files } = district;

  it('is the same every time for the same seed, and different for another seed', () => {
    expect(generateSyntheticDistrict().files).toEqual(files);
    expect(generateSyntheticDistrict({ seed: 7 }).files['oneroster/users.csv']).not.toEqual(files['oneroster/users.csv']);
  });

  it('has a OneRoster export the reader accepts without errors', async () => {
    const roster = await readOneRosterFiles(Object.entries(files).filter(([p]) => p.startsWith('oneroster/')));
    expect(roster.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(roster.schools.size).toBe(district.counts.schools);
    expect(roster.students.size).toBe(district.counts.students);
    expect(roster.staff.size).toBe(district.counts.staff);
    expect(roster.files).not.toContain('demographics.csv');
  });

  it('has an inventory with no issues and one row per app', () => {
    const { rows, issues } = readInventory(files['inventory.csv']!);
    expect(issues).toEqual([]);
    expect(rows.map((r) => r.app)).toEqual(['ReadWell', 'MathPath', 'LunchLine', 'QuizHub', 'FamilyTalk', 'ClassCloud', 'ShelfScan', 'RouteRider']);
  });

  it('has contracts, one of them without Exhibit B on purpose', () => {
    const { contracts, issues } = readContracts(files['contracts.csv']!);
    expect(contracts).toHaveLength(5);
    expect(issues.map((i) => `${i.severity}:${i.line}`)).toEqual(['warning:4']);
  });

  it('has a declared list that leaves out two vendors on purpose', () => {
    const { declarations, issues } = readDeclaredList(files['declared.csv']!);
    expect(issues).toEqual([]);
    const listed = new Set(declarations.map((d) => d.vendorId));
    expect(listed.has('Family Messaging LLC')).toBe(false);
    expect(listed.has('QuizHub Inc')).toBe(false);
    expect(listed.has('OldReader Co')).toBe(true);
  });

  it('has an SFTP export whose header is recognized, with one unknown column on purpose', async () => {
    const r = await readExportHeader('exports/mathpath_students.csv', files['exports/mathpath_students.csv']!);
    expect(r.fields).toContain('student.frl_status');
    expect(r.fields).toContain('student.address');
    expect(r.columns.filter((c) => c.status === 'unknown').map((c) => c.column)).toEqual(['Locker']);
  });

  it('has a Clever students file with district IDs', async () => {
    const r = await readPeopleFile('clever/quizhub/students.csv', files['clever/quizhub/students.csv']!);
    expect(r.ids?.size).toBe(r.rows);
    expect([...(r.ids ?? [])].every((id) => /^1\d{5}$/.test(id))).toBe(true);
  });
});
