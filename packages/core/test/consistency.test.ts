import { describe, expect, it } from 'vitest';
import { analyzeFiles, generateSyntheticDistrict, incidentReport, notificationCsv, readOneRosterFiles, simulateReduction } from '../src/index.js';

// Checks across modules, from the review of block 1.4 (21/11/2026).
describe('one district, one set of numbers', async () => {
  const district = generateSyntheticDistrict();
  const { report, flows } = await analyzeFiles(district.files, { today: district.today });
  const roster = await readOneRosterFiles(Object.entries(district.files).filter(([p]) => p.startsWith('oneroster/')));
  const json = JSON.stringify(report);

  it('the report is plain JSON and the same on every run', async () => {
    expect(JSON.parse(json)).toEqual(report);
    const again = await analyzeFiles(district.files, { today: district.today });
    expect(JSON.stringify(again.report)).toBe(json);
  });

  it('the report holds no student or staff identifier', () => {
    const people = [...roster.students.values(), ...roster.staff.values()];
    for (const id of [...roster.students.keys(), ...roster.staff.keys()]) expect(json).not.toContain(id);
    for (const p of people) if (p.identifier) expect(json).not.toContain(`"${p.identifier}"`);
    expect(json).not.toContain('#');
  });

  it('vendor exposure, breach scenarios and incident mode agree', () => {
    for (const v of report.students.byVendor) {
      expect(report.scenarios.find((s) => s.id === `vendor:${v.id}`)?.students.points).toEqual(v.points);
      const incident = incidentReport({ flows, roster, scope: { kind: 'vendor', vendorId: v.id }, notifiedOn: '2026-12-15' });
      expect(incident.students.people).toEqual(v.people);
    }
  });

  it('the reduction total is the sum of the vendors, and an empty cut changes nothing', () => {
    const r = simulateReduction({ flows, cuts: [], maxStudents: report.totals.students });
    expect(r.students.total.before.max).toBe(report.students.byVendor.reduce((a, v) => a + v.points.max, 0));
    expect(r.students.total.drop).toEqual({ min: 0, max: 0, exact: true });
  });

  it('undisclosed vendors carry the same students as their exposure', () => {
    for (const f of report.disclosure!.findings.filter((f) => f.kind === 'undisclosed_vendor'))
      expect(f.students).toEqual(report.students.byVendor.find((v) => v.id === f.vendorId)?.people);
  });

  it('alerts count the people the app reaches', () => {
    const quiz = report.alerts.find((a) => a.rule === 'unclassified_app' && a.appId === 'QuizHub');
    expect(quiz?.students).toBe(116);
  });

  it('a declared vendor without apps is a disclosure finding, not also an input warning', () => {
    expect(report.issues.some((i) => i.file === 'declared' && i.message.includes('OldReader'))).toBe(false);
    expect(report.disclosure!.findings.some((f) => f.kind === 'no_longer_receives' && f.vendorId === 'OldReader Co')).toBe(true);
  });

  it('an incident for a vendor that is not in the inventory is an error, never zero affected', () => {
    const scope = { kind: 'vendor', vendorId: 'Acme Learnin' } as const;
    expect(() => incidentReport({ flows, roster, scope, notifiedOn: '2026-12-15', state: 'IL' })).toThrow("Did you mean 'Acme Learning'?");
    expect(() => notificationCsv({ flows, roster, scope })).toThrow('Acme Learnin');
  });
});
