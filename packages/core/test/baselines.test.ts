import { describe, expect, it } from 'vitest';
import { APP_CATEGORIES, fieldNeed, type AppCategory, type CategoryBaseline } from '../src/baselines/index.js';
import { getField } from '../src/catalog/index.js';

const categories = Object.entries(APP_CATEGORIES) as [AppCategory, CategoryBaseline][];

describe('app category baselines', () => {
  it('only use fields that exist in the catalog', () => {
    for (const [name, c] of categories) {
      for (const key of [...c.needed, ...c.conditional]) {
        expect(getField(key), `${name}: ${key}`).toBeDefined();
      }
    }
  });

  it('never list a field as both needed and conditional, or twice', () => {
    for (const [name, c] of categories) {
      const all = [...c.needed, ...c.conditional];
      expect(new Set(all).size, name).toBe(all.length);
    }
  });

  it('never expect passwords: apps should use single sign-on', () => {
    for (const [name, c] of categories) {
      for (const key of [...c.needed, ...c.conditional]) {
        expect(getField(key)?.sensitivity, `${name}: ${key}`).not.toBe('credential');
      }
    }
  });

  it('only list people fields; school and section fields are not checked', () => {
    for (const [name, c] of categories) {
      for (const key of [...c.needed, ...c.conditional]) {
        expect(key.startsWith('school.') || key.startsWith('section.'), `${name}: ${key}`).toBe(false);
      }
    }
  });
});

describe('fieldNeed', () => {
  it('flags a reading app that receives date of birth or meal status', () => {
    expect(fieldNeed('instructional_content', 'student.first_name')).toBe('needed');
    expect(fieldNeed('instructional_content', 'student.ell_status')).toBe('conditional');
    expect(fieldNeed('instructional_content', 'student.birth_date')).toBe('not_expected');
    expect(fieldNeed('instructional_content', 'student.frl_status')).toBe('not_expected');
    expect(fieldNeed('instructional_content', 'student.password')).toBe('not_expected');
  });

  it('accepts sensitive fields where the function requires them', () => {
    expect(fieldNeed('nutrition', 'student.frl_status')).toBe('needed');
    expect(fieldNeed('transportation', 'student.address')).toBe('needed');
    expect(fieldNeed('special_education', 'student.iep_status')).toBe('needed');
  });

  it('does not check the system of record or organization fields', () => {
    expect(fieldNeed('student_information_system', 'student.birth_date')).toBe('not_checked');
    expect(fieldNeed('instructional_content', 'school.name')).toBe('not_checked');
    expect(fieldNeed('instructional_content', 'section.period')).toBe('not_checked');
  });
});
