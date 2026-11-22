import { describe, expect, it } from 'vitest';
import { analyzeFiles, generateSyntheticDistrict, incidentReport, notificationCsv, parseCsv, readOneRosterFiles } from '../src/index.js';

const district = generateSyntheticDistrict();

describe('incident mode on the synthetic district', async () => {
  const { flows } = await analyzeFiles(district.files, { today: district.today });
  const roster = await readOneRosterFiles(Object.entries(district.files).filter(([p]) => p.startsWith('oneroster/')));
  const acme = { kind: 'vendor', vendorId: 'Acme Learning' } as const;

  it('says who was affected and with which data, without identifiers', () => {
    const r = incidentReport({ flows, roster, scope: acme, notifiedOn: '2026-12-15', state: 'IL' });
    expect(r.students.people).toEqual({ min: 1140, max: 1140, exact: true });
    expect(r.staff.people.max).toBe(77);
    const byField = Object.fromEntries(r.students.byField.map((f) => [f.field, f.people.max]));
    expect(byField['student.birth_date']).toBe(1140);
    expect(byField['student.iep_status']).toBe(690);
    expect(byField['student.address']).toBe(450);
    expect(byField['student.frl_status']).toBe(450);
    expect(r.students.byField.find((f) => f.field === 'student.address')?.apps).toEqual(['MathPath']);
    expect(JSON.stringify(r)).not.toContain('or-u-');
  });

  it('gives the Illinois deadlines from the date the district was notified', () => {
    const r = incidentReport({ flows, roster, scope: acme, notifiedOn: '2026-12-15', state: 'IL' });
    const parent = r.deadlines.find((d) => d.duty.id === 'il.parent_notice');
    expect(parent?.dueOn).toBe('2027-01-14');
    // The vendor's own duty is shown, but its clock does not start on the district's date.
    expect(r.deadlines.find((d) => d.duty.id === 'il.operator_notice')?.dueOn).toBeUndefined();
    expect(r.findings[0]).toMatchObject({ id: 'il.breach_list', text: expect.stringContaining('must be included') });
    expect(r.disclaimer).toContain('not legal advice');
  });

  it('applies the Colorado definition of personal information', () => {
    const r = incidentReport({ flows, roster, scope: acme, notifiedOn: '2026-12-15', state: 'CO' });
    expect(r.deadlines.find((d) => d.duty.id === 'co.resident_notice')?.dueOn).toBe('2027-01-14');
    expect(r.findings[0]?.text).toContain('names with student ID numbers');
    const shelf = incidentReport({ flows, roster, scope: { kind: 'vendor', vendorId: 'Library Systems Co' }, notifiedOn: '2026-12-15', state: 'CO' });
    expect(shelf.findings[0]?.text).toContain('usernames or emails with passwords');
  });

  it('a small breach may be left out of the Illinois breach list', () => {
    const r = incidentReport({ flows, roster, scope: { kind: 'vendor', vendorId: 'QuizHub Inc' }, notifiedOn: '2026-12-15', state: 'IL' });
    expect(r.students.people.max).toBe(116);
    expect(r.findings[0]?.text).toContain('may be left out');
  });

  it('works without a state, with federal rules only', () => {
    const r = incidentReport({ flows, roster, scope: acme, notifiedOn: '2026-12-15' });
    expect(r.deadlines).toEqual([]);
    expect(r.findings).toEqual([]);
  });

  it('counts people known only by a count, but cannot list them', () => {
    const r = incidentReport({ flows, roster, scope: { kind: 'vendor', vendorId: 'Family Messaging LLC' }, notifiedOn: '2026-12-15', state: 'IL' });
    expect(r.students.notListed).toBe(1600);
    expect(r.students.people.exact).toBe(false);
  });

  it('builds the notification list: one row per person, IDs and kinds of data, no names', () => {
    const csv = notificationCsv({ flows, roster, scope: acme });
    const rows = parseCsv(csv);
    expect(rows[0]?.cells).toEqual(['population', 'oneroster_sourced_id', 'district_id', 'data', 'apps']);
    expect(rows.filter((r) => r.cells[0] === 'student')).toHaveLength(1140);
    expect(rows.filter((r) => r.cells[0] === 'staff')).toHaveLength(77);
    const first = rows.find((r) => r.cells[1] === 'or-u-00001');
    expect(first?.cells[2]).toBe('100001');
    expect(first?.cells[3]).toContain('Date of birth');
    expect(first?.cells[4]).toBe('ReadWell');
    // No names: the synthetic family names never appear.
    expect(csv).not.toMatch(/Sample|Fixture|Mockwell|Placeholder/);
  });

  it('rejects an invalid date', () => {
    expect(() => incidentReport({ flows, roster, scope: acme, notifiedOn: '15/12/2026' })).toThrow(RangeError);
  });
});
