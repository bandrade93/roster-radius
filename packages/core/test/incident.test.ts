import { describe, expect, it } from 'vitest';
import { incidentImpact, incidentScenarios, type ResolvedFlow } from '../src/exposure/index.js';

const ids = (prefix: string, from: number, to: number): Set<string> =>
  new Set(Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${from + i}`));

// Vendor acme: reading app via Clever (weight 12) and math app via SFTP (weight 16), 300 students in both.
// Vendor other: quiz app via Clever, names only (weight 6), students 1-500, plus 40 teachers.
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
const quiz: ResolvedFlow = {
  appId: 'quiz',
  vendorId: 'other',
  channel: 'clever',
  fields: ['student.first_name', 'student.last_name', 'staff.email', 'staff.password'],
  students: ids('s', 1, 500),
  staff: ids('t', 1, 40),
};
const flows = [reading, math, quiz];

describe('incident impact', () => {
  it('vendor breach: everything the vendor received, each person once', () => {
    const impact = incidentImpact(flows, { kind: 'vendor', vendorId: 'acme' });
    expect(impact.id).toBe('vendor:acme');
    expect(impact.apps).toEqual(['math', 'reading']);
    expect(impact.channels).toEqual(['clever', 'sftp']);
    expect(impact.students.people.max).toBe(1700);
    expect(impact.students.points.max).toBe(25400);
    expect(impact.studentIds.size).toBe(1700);
    expect(impact.staff.people.max).toBe(0);
  });

  it('app breach: only that app', () => {
    const impact = incidentImpact(flows, { kind: 'app', appId: 'math' });
    expect(impact.students.people.max).toBe(800);
    expect(impact.students.peopleByClass.location.max).toBe(800);
    expect(impact.studentIds.has('s901')).toBe(true);
    expect(impact.studentIds.has('s1')).toBe(false);
  });

  it('channel breach: every vendor that receives through it', () => {
    const impact = incidentImpact(flows, { kind: 'channel', channel: 'clever' });
    expect(impact.vendors).toEqual(['acme', 'other']);
    // Students 1-500 are in both apps, but the quiz fields are already in the reading fields.
    expect(impact.students.people.max).toBe(1200);
    expect(impact.students.points.max).toBe(1200 * 12);
    expect(impact.staff.people.max).toBe(40);
    expect(impact.staff.topClass).toBe('credential');
    expect(impact.staffIds.size).toBe(40);
  });
});

describe('incident scenarios', () => {
  it('ranks every vendor and channel, worst first', () => {
    expect(incidentScenarios(flows).map((s) => s.id)).toEqual([
      'vendor:acme', // 25,400
      'channel:clever', // 14,400
      'channel:sftp', // 12,800
      'vendor:other', // 3,000
    ]);
  });
});
