import { describe, expect, it } from 'vitest';
import { analyzeDistrict, analyzeFiles, generateSyntheticDistrict, readOneRosterFiles, METHODOLOGY_VERSION } from '../src/index.js';

const district = generateSyntheticDistrict();

describe('analyzing the synthetic district', async () => {
  const { report, flows } = await analyzeFiles(district.files, { today: district.today });

  it('keeps identifiers out of the report and in the flows only', () => {
    const json = JSON.stringify(report);
    expect(json).not.toContain('or-u-');
    expect(json).not.toContain('100001');
    expect(flows).toHaveLength(8);
    expect(report.methodologyVersion).toBe(METHODOLOGY_VERSION);
  });

  it('never gives a range above the enrollment', () => {
    // FamilyTalk gives only a count, so the total is a range; it cannot exceed 1,660 students.
    expect(report.totals.studentsReached).toEqual({ min: 1660, max: 1660, exact: false });
    expect(report.totals.staffReached).toEqual({ min: 77, max: 77, exact: true });
    expect(report.sharedFields.every((f) => f.students.max <= 1660)).toBe(true);
  });

  it('ranks vendors by exposure, students and staff apart', () => {
    expect(report.students.byVendor.map((v) => [v.id, v.points.max])).toEqual([
      ['Transit Apps LLC', 33200],
      ['Food Services Co', 31540],
      ['Family Messaging LLC', 30400],
      ['Library Systems Co', 29880],
      ['Acme Learning', 25050],
      ['Classroom Cloud Inc', 13580],
      ['QuizHub Inc', 1044],
    ]);
    expect(report.staff.byVendor.map((v) => [v.id, v.people.max])).toEqual([
      ['Acme Learning', 77],
      ['Classroom Cloud Inc', 50],
    ]);
  });

  it('raises every kind of alert the scenario is built for', () => {
    const count = (s: string) => report.alerts.filter((a) => a.severity === s).length;
    expect([count('critical'), count('high'), count('medium'), count('info')]).toEqual([1, 6, 0, 4]);
    expect(new Set(report.alerts.map((a) => a.rule))).toEqual(
      new Set(['password', 'contract_expired', 'no_contract', 'unexpected_field', 'contract_mismatch', 'review_field', 'contract_expiring', 'unclassified_app']),
    );
  });

  it('uses the inventory contract date only where the contracts file has nothing', () => {
    expect(report.contracts.map((c) => c.id)).toContain('inventory line 9');
    expect(report.alerts.some((a) => a.appId === 'RouteRider')).toBe(false);
  });

  it('lists a channel as its own scenario only when it differs from a vendor', () => {
    const ids = report.scenarios.map((s) => s.id);
    expect(ids).toContain('channel:clever');
    expect(ids).not.toContain('channel:sftp:Transit Apps LLC');
    expect(ids).toContain('channel:sftp:Acme Learning');
    expect(report.scenarios.find((s) => s.id === 'channel:clever')?.students.points.max).toBe(27728);
  });

  it('finds a file named in the inventory by its name alone, when it was loaded without its folder', async () => {
    const files: Record<string, string> = { ...district.files };
    files['mathpath_students.csv'] = files['exports/mathpath_students.csv']!;
    delete files['exports/mathpath_students.csv'];
    const { report: moved } = await analyzeFiles(files, { today: district.today });

    expect(moved.flows.find((f) => f.app === 'MathPath')?.fieldSource).toBe('measured');
    expect(moved.issues.some((i) => i.severity === 'error')).toBe(false);
  });

  it('says whether every row was used', async () => {
    expect(report.completeness).toEqual({ complete: true, rowsLeftOut: 0 });

    const files = { ...district.files, 'inventory.csv': `${district.files['inventory.csv']}BadApp,Nobody Inc,sftp,student.unknown_field,,,all,,,,,,,\n` };
    const { report: broken } = await analyzeFiles(files, { today: district.today });

    expect(broken.completeness).toEqual({ complete: false, rowsLeftOut: 1 });
    expect(broken.totals.apps).toBe(8);
    expect(broken.flows).toHaveLength(8);
  });

  it('collects issues from every file, with the file they come from', () => {
    // OldReader Co in the declared list is a disclosure finding, not an input issue.
    expect(report.issues.map((i) => i.file)).toEqual(['contracts', 'exports/mathpath_students.csv']);
  });

  it('shows the fields shared across the district', () => {
    const address = report.sharedFields.find((f) => f.field === 'student.address');
    expect(address?.students.max).toBe(1660);
    expect(address?.vendors).toEqual(['Acme Learning', 'Transit Apps LLC']);
  });
});

describe('analysis options and problems', async () => {
  const roster = await readOneRosterFiles(Object.entries(district.files).filter(([p]) => p.startsWith('oneroster/')));
  const base = { roster, today: district.today, openFile: (p: string) => district.files[p] };

  it('reports a contract date in the inventory that differs from the contracts file', async () => {
    const inventory = 'app,vendor,channel,fields,category,contract_end\nLunchLine,Food Services Co,sftp,student.frl_status,nutrition,2027-01-01\n';
    const { report } = await analyzeDistrict({ ...base, inventory, contracts: district.files['contracts.csv']! });
    expect(report.issues.some((i) => i.column === 'contract_end' && i.message.includes('differs from the contracts file'))).toBe(true);
    expect(report.alerts.some((a) => a.rule === 'contract_expired' && a.appId === 'LunchLine')).toBe(true);
  });

  it('applies weight overrides and states them', async () => {
    const { report } = await analyzeDistrict({ ...base, inventory: district.files['inventory.csv']!, weights: { location: 1 } });
    expect(report.weights.location).toBe(1);
    expect(report.students.byVendor.find((v) => v.id === 'Transit Apps LLC')?.points.max).toBe(33200 - 1660 * 4 * 2);
  });

  it('needs an inventory', async () => {
    await expect(analyzeFiles({}, { today: '2026-11-17' })).rejects.toThrow('inventory.csv');
  });
});
