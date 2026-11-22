import { describe, expect, it } from 'vitest';
import { analyzeFiles, generateSyntheticDistrict, simulateReduction, type ResolvedFlow } from '../src/index.js';

const ids = (prefix: string, from: number, to: number): Set<string> =>
  new Set(Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${from + i}`));

// The worked example of the methodology (section 6.4): vendor score 25,400.
const reading: ResolvedFlow = {
  appId: 'reading',
  vendorId: 'acme',
  channel: 'clever',
  fields: ['student.first_name', 'student.last_name', 'student.grade_level', 'student.school', 'student.birth_date'],
  students: ids('s', 1, 1200),
};
const math: ResolvedFlow = {
  appId: 'math',
  vendorId: 'acme',
  channel: 'sftp',
  fields: ['student.first_name', 'student.last_name', 'student.frl_status', 'student.address'],
  students: ids('s', 901, 1700),
};
const flows = [reading, math];
const app = (appId: string) => ({ kind: 'app', appId }) as const;

describe('reduction simulation', () => {
  it('gives the drop when fields stop being sent', () => {
    const r = simulateReduction({ flows, cuts: [{ fields: ['student.frl_status', 'student.address'], scope: app('math') }] });
    const [acme] = r.students.vendors;
    expect(acme?.vendorId).toBe('acme');
    expect(acme?.points.before.max).toBe(25_400);
    expect(acme?.points.after.max).toBe(17_400);
    expect(acme?.points.drop).toEqual({ min: 8_000, max: 8_000, exact: true });
    expect(acme?.points.share).toBeCloseTo(0.315, 3);
    // Names still reach the vendor: nobody stops being reached.
    expect(acme?.people.drop.max).toBe(0);
    expect(r.students.total.drop.max).toBe(8_000);
    expect(r.issues).toEqual([]);
  });

  it('reports people who still send the field to the same vendor through another app', () => {
    const r = simulateReduction({ flows, cuts: [{ fields: ['student.first_name'], scope: app('math') }] });
    // Only the 500 students in math alone lose their first name at the vendor.
    expect(r.students.vendors[0]?.points.drop.max).toBe(500 * 3);
    expect(r.students.stillReceived).toEqual([
      { vendorId: 'acme', field: 'student.first_name', people: { min: 300, max: 300, exact: true }, apps: ['reading'] },
    ]);
    // Cutting it from the vendor removes it for everyone.
    const all = simulateReduction({ flows, cuts: [{ fields: ['student.first_name'], scope: { kind: 'vendor', vendorId: 'acme' } }] });
    expect(all.students.vendors[0]?.points.drop.max).toBe(1_700 * 3);
    expect(all.students.stillReceived).toEqual([]);
  });

  it('counts people who are no longer reached', () => {
    const r = simulateReduction({ flows, cuts: [{ fields: math.fields, scope: app('math') }] });
    expect(r.students.vendors[0]?.people.before.max).toBe(1_700);
    expect(r.students.vendors[0]?.people.after.max).toBe(1_200);
  });

  it('gives a range when a flow has only a count', () => {
    const counted: ResolvedFlow = { appId: 'msg', vendorId: 'talk', channel: 'upload', fields: ['guardian.phone', 'student.first_name'], students: { count: 400 } };
    const r = simulateReduction({ flows: [reading, counted], cuts: [{ fields: ['guardian.phone'], scope: app('msg') }], maxStudents: 1_700 });
    const talk = r.students.vendors.find((v) => v.vendorId === 'talk');
    expect(talk?.points.drop.max).toBeGreaterThan(0);
    expect(talk?.points.drop.min).toBe(talk?.points.drop.max);
    expect(r.students.total.drop.max).toBe(talk?.points.drop.max);
  });

  it('says when a cut changes nothing', () => {
    const r = simulateReduction({
      flows,
      cuts: [
        { fields: ['student.birth_date'], scope: app('math') },
        { fields: ['student.address'], scope: app('nothing') },
      ],
    });
    expect(r.students.vendors).toEqual([]);
    expect(r.issues.map((i) => i.cut)).toEqual([0, 1]);
    expect(r.issues[0]?.message).toContain('does not receive');
  });
});

describe('reduction simulation on the synthetic district', async () => {
  const district = generateSyntheticDistrict();
  const { report, flows: resolved } = await analyzeFiles(district.files, { today: district.today });
  const options = { flows: resolved, maxStudents: report.totals.students, maxStaff: report.totals.staff };

  it('stopping home address and meal eligibility at MathPath lowers Acme by 4,500 points (18%)', () => {
    const r = simulateReduction({ ...options, cuts: [{ fields: ['student.address', 'student.frl_status'], scope: app('MathPath') }] });
    const acme = r.students.vendors.find((v) => v.vendorId === 'Acme Learning');
    expect(acme?.points.before.max).toBe(25_050);
    expect(acme?.points.drop.max).toBe(4_500);
    expect(Math.round((acme?.points.share ?? 0) * 100)).toBe(18);
    expect(acme?.people.after.max).toBe(1_140);
    expect(r.students.vendors).toHaveLength(1);
    expect(r.staff.vendors).toEqual([]);
  });

  it('stopping date of birth at both Acme apps lowers Acme by 4,560 points', () => {
    const r = simulateReduction({ ...options, cuts: [{ fields: ['student.birth_date'], scope: { kind: 'vendor', vendorId: 'Acme Learning' } }] });
    expect(r.students.vendors[0]?.points.drop.max).toBe(4_560);
  });

  it('a cut on a channel reaches every vendor behind it', () => {
    const r = simulateReduction({ ...options, cuts: [{ fields: ['student.email'], scope: { kind: 'channel', channel: 'clever' } }] });
    expect(r.students.vendors.map((v) => v.vendorId).sort()).toEqual(['Classroom Cloud Inc', 'QuizHub Inc']);
    expect(r.students.total.drop.max).toBe(r.students.vendors.reduce((a, v) => a + v.points.drop.max, 0));
  });
});
