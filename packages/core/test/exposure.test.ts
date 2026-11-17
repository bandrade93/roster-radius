import { describe, expect, it } from 'vitest';
import { exposureByApp, exposureByVendor, resolveWeights, type ResolvedFlow } from '../src/exposure/index.js';

const ids = (prefix: string, from: number, to: number): Set<string> =>
  new Set(Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${from + i}`));

// Example from the methodology: one vendor, two apps, two channels.
// Reading app via Clever: students 1-1200, name, grade, school and date of birth (weight 12).
// Math app via SFTP: students 901-1700 (300 overlap), name, meal status and address (weight 16).
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

describe('exposure by app', () => {
  it('multiplies students by the sum of field weights', () => {
    const [r, m] = exposureByApp([reading, math]);
    expect(r?.id).toBe('reading');
    expect(r?.people).toEqual({ min: 1200, max: 1200, exact: true });
    expect(r?.points.max).toBe(1200 * 12);
    expect(m?.id).toBe('math');
    expect(m?.points.max).toBe(800 * 16);
  });
});

describe('exposure by vendor', () => {
  it('counts each student once, with the union of fields across apps and channels', () => {
    const [acme] = exposureByVendor([reading, math]);
    expect(acme?.people).toEqual({ min: 1700, max: 1700, exact: true });
    // 900 reading only x 12 + 500 math only x 16 + 300 both x 22
    expect(acme?.points).toEqual({ min: 25400, max: 25400, exact: true });
  });

  it('reports students per sensitivity class, independent of weights', () => {
    const [acme] = exposureByVendor([reading, math]);
    expect(acme?.peopleByClass.birth.max).toBe(1200);
    expect(acme?.peopleByClass.special_status.max).toBe(800);
    expect(acme?.peopleByClass.location.max).toBe(800);
    expect(acme?.peopleByClass.credential.max).toBe(0);
    expect(acme?.topClass).toBe('special_status');
  });

  it('gives a range when a flow has only a count and cannot be deduplicated', () => {
    const counted: ResolvedFlow = { ...math, students: { count: 800 } };
    const [acme] = exposureByVendor([reading, counted]);
    expect(acme?.people).toEqual({ min: 1200, max: 2000, exact: false });
    expect(acme?.points.min).toBe(14400);
    expect(acme?.points.max).toBe(14400 + 800 * 16);
  });
});

describe('what is counted', () => {
  it('ignores staff, school and section fields and lists them', () => {
    const flow: ResolvedFlow = {
      appId: 'lms',
      vendorId: 'v',
      channel: 'clever',
      fields: ['student.first_name', 'staff.email', 'school.name', 'section.period'],
      students: ids('s', 1, 10),
    };
    const [r] = exposureByApp([flow]);
    expect(r?.points.max).toBe(10 * 3);
    expect(r?.fields).toEqual(['student.first_name']);
    expect(r?.ignoredFields).toEqual(['school.name', 'section.period', 'staff.email']);
  });

  it('counts guardian fields as part of the student record', () => {
    const flow: ResolvedFlow = {
      appId: 'msg',
      vendorId: 'v',
      channel: 'sftp',
      fields: ['student.first_name', 'guardian.phone'],
      students: ids('s', 1, 10),
    };
    expect(exposureByApp([flow])[0]?.points.max).toBe(10 * (3 + 3));
  });

  it('lowers the score when any field is removed', () => {
    const before = exposureByVendor([reading, math])[0]?.points.max ?? 0;
    const trimmed = { ...reading, fields: reading.fields.filter((f) => f !== 'student.birth_date') };
    const after = exposureByVendor([trimmed, math])[0]?.points.max ?? 0;
    expect(after).toBe(before - 1200 * 4);
  });
});

describe('weights', () => {
  it('accepts overrides and rejects invalid values', () => {
    expect(resolveWeights({ birth: 5 }).birth).toBe(5);
    expect(exposureByApp([reading], { weights: { birth: 5 } })[0]?.points.max).toBe(1200 * 13);
    expect(() => resolveWeights({ birth: -1 })).toThrow(RangeError);
  });
});

describe('staff exposure', () => {
  // An LMS via Clever: 1,000 students and 40 teachers, including teacher passwords.
  const lms: ResolvedFlow = {
    appId: 'lms',
    vendorId: 'v',
    channel: 'clever',
    fields: ['student.first_name', 'staff.first_name', 'staff.last_name', 'staff.email', 'staff.password', 'school.name'],
    students: ids('s', 1, 1000),
    staff: ids('t', 1, 40),
  };

  it('is calculated separately from student exposure', () => {
    const [staff] = exposureByApp([lms], { population: 'staff' });
    expect(staff?.population).toBe('staff');
    expect(staff?.people).toEqual({ min: 40, max: 40, exact: true });
    expect(staff?.points.max).toBe(40 * (3 + 3 + 3 + 5));
    expect(staff?.topClass).toBe('credential');
    expect(staff?.ignoredFields).toEqual(['school.name', 'student.first_name']);

    const [students] = exposureByApp([lms]);
    expect(students?.population).toBe('students');
    expect(students?.points.max).toBe(1000 * 3);
    expect(students?.peopleByClass.credential.max).toBe(0);
  });

  it('counts each staff member once across apps of the same vendor', () => {
    const second: ResolvedFlow = { ...lms, appId: 'gradebook', fields: ['staff.first_name', 'staff.phone'], staff: ids('t', 31, 50) };
    const [v] = exposureByVendor([lms, second], { population: 'staff' });
    expect(v?.people.max).toBe(50);
    // 30 only in lms x 14 + 10 in both x 17 + 10 only in gradebook x 6
    expect(v?.points.max).toBe(30 * 14 + 10 * 17 + 10 * 6);
  });

  it('flags flows with staff fields but no staff scope instead of guessing', () => {
    const noScope: ResolvedFlow = { ...lms, staff: undefined };
    const [staff] = exposureByApp([noScope], { population: 'staff' });
    expect(staff?.flowsWithoutScope).toBe(1);
    expect(staff?.people.max).toBe(0);
    expect(exposureByApp([noScope])[0]?.flowsWithoutScope).toBe(0);
  });
});
