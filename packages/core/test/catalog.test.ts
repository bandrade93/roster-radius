import { describe, expect, it } from 'vitest';
import {
  EXHIBIT_B_CATEGORIES,
  FIELDS,
  SENSITIVITY_CLASSES,
  SOURCES,
  findFieldKey,
  getField,
  normalizeColumnName,
  type FieldDefinition,
  type Source,
} from '../src/catalog/index.js';

const fields = FIELDS as readonly FieldDefinition[];

describe('field catalog', () => {
  it('has unique keys', () => {
    const keys = fields.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('uses <subject>.<snake_case> keys that start with the field subject', () => {
    for (const f of fields) {
      expect(f.key).toMatch(/^[a-z]+\.[a-z0-9]+(_[a-z0-9]+)*$/);
      expect(f.key.split('.')[0]).toBe(f.subject);
    }
  });

  it('maps every student and guardian field to an Exhibit B category', () => {
    for (const f of fields) {
      if (f.subject === 'student' || f.subject === 'guardian') {
        expect(f.exhibitB, f.key).not.toBeNull();
        expect(EXHIBIT_B_CATEGORIES).toContain(f.exhibitB);
      }
    }
  });

  it('never maps the same column of a source to two fields of the same subject', () => {
    const seen = new Map<string, string>();
    for (const f of fields) {
      for (const [source, aliases] of Object.entries(f.aliases) as [Source, readonly string[]][]) {
        expect(SOURCES).toContain(source);
        for (const alias of aliases) {
          const id = `${source}|${f.subject}|${normalizeColumnName(alias)}`;
          expect(seen.get(id), `${alias} is used by ${seen.get(id)} and ${f.key}`).toBeUndefined();
          seen.set(id, f.key);
        }
      }
    }
  });
});

describe('normalizeColumnName', () => {
  it('treats case, spaces, hyphens and underscores alike', () => {
    expect(normalizeColumnName('students.Ell status')).toBe('students.ell_status');
    expect(normalizeColumnName('  STUDENTS.ELL-STATUS ')).toBe('students.ell_status');
    expect(normalizeColumnName('students.ell__status')).toBe('students.ell_status');
  });
});

describe('findFieldKey', () => {
  it('finds the same fact under each source spelling', () => {
    expect(findFieldKey('oneroster', 'student', 'demographics.birthDate')).toBe('student.birth_date');
    expect(findFieldKey('cleverCsv', 'student', 'students.DOB')).toBe('student.birth_date');
    expect(findFieldKey('cleverApi', 'student', 'roles.student.dob')).toBe('student.birth_date');
  });

  it('maps all six OneRoster race columns to one field', () => {
    for (const column of [
      'demographics.americanIndianOrAlaskaNative',
      'demographics.asian',
      'demographics.blackOrAfricanAmerican',
      'demographics.nativeHawaiianOrOtherPacificIslander',
      'demographics.white',
      'demographics.demographicRaceTwoOrMoreRaces',
    ]) {
      expect(findFieldKey('oneroster', 'student', column)).toBe('student.race');
    }
  });

  it('uses the subject to tell apart columns shared by students and staff', () => {
    expect(findFieldKey('oneroster', 'student', 'users.givenName')).toBe('student.first_name');
    expect(findFieldKey('oneroster', 'staff', 'users.givenName')).toBe('staff.first_name');
    expect(findFieldKey('oneroster', 'guardian', 'users.givenName')).toBe('guardian.name');
  });

  it('flags passwords in both OneRoster and Clever files', () => {
    expect(findFieldKey('oneroster', 'student', 'users.password')).toBe('student.password');
    expect(findFieldKey('cleverCsv', 'staff', 'teachers.Password')).toBe('staff.password');
  });

  it('returns undefined for unknown columns, such as district extension fields', () => {
    expect(findFieldKey('cleverCsv', 'student', 'students.ext.iep_plan')).toBeUndefined();
  });
});

describe('getField', () => {
  it('returns the entry for a key and undefined otherwise', () => {
    expect(getField('student.iep_status')?.exhibitB).toBe('Special Indicator');
    expect(getField('student.unknown')).toBeUndefined();
  });
});

describe('sensitivity classes', () => {
  it('use integer weights from 1 to 5', () => {
    for (const [name, c] of Object.entries(SENSITIVITY_CLASSES)) {
      expect(Number.isInteger(c.weight), name).toBe(true);
      expect(c.weight).toBeGreaterThanOrEqual(1);
      expect(c.weight).toBeLessThanOrEqual(5);
    }
  });

  it('give every field a known class', () => {
    for (const f of fields) {
      expect(Object.keys(SENSITIVITY_CLASSES), f.key).toContain(f.sensitivity);
    }
  });

  it('put the highest-harm fields in the top classes', () => {
    expect(getField('student.password')?.sensitivity).toBe('credential');
    expect(getField('staff.password')?.sensitivity).toBe('credential');
    expect(getField('student.address')?.sensitivity).toBe('location');
    expect(getField('student.frl_status')?.sensitivity).toBe('special_status');
    expect(getField('student.iep_status')?.sensitivity).toBe('special_status');
    expect(getField('student.birth_date')?.sensitivity).toBe('birth');
  });
});
