import { describe, expect, it } from 'vitest';
import { declaresData, exhibitBCategoryByName, fieldByName, readDeclaredList } from '../src/index.js';

// Same content as docs/formats/declared-example.csv.
const EXAMPLE = `vendor,apps,exhibit_b,fields,published_on,source,notes
Acme Learning,,Student Name|Student Identifiers|Enrollment|Demographics,,2026-08-15,https://www.example-district.org/privacy,Copied from the district's privacy page
Food Services Co,LunchLine,Student Name|Student Identifiers|Enrollment|Special Indicator,,2026-08-15,https://www.example-district.org/privacy,
Transit Apps LLC,,Student Name|Student Identifiers,student.transportation,2026-08-15,https://www.example-district.org/privacy,The page lists bus stop as a separate item
`;

describe('name lookups', () => {
  it('finds fields by key or label and categories by loose name', () => {
    expect(fieldByName('Date of birth')).toBe('student.birth_date');
    expect(fieldByName(' STUDENT.BIRTH_DATE ')).toBe('student.birth_date');
    expect(exhibitBCategoryByName('parent guardian contact information')).toBe('Parent/Guardian Contact Information');
    expect(exhibitBCategoryByName('Grades')).toBeUndefined();
  });
});

describe('reading the declared list', () => {
  it('reads the example', () => {
    const { declarations, issues } = readDeclaredList(EXAMPLE);
    expect(issues).toEqual([]);
    expect(declarations.map((d) => d.vendorId)).toEqual(['Acme Learning', 'Food Services Co', 'Transit Apps LLC']);
    expect(declarations[1]).toMatchObject({ appIds: ['LunchLine'], publishedOn: '2026-08-15', line: 3 });
    expect(declarations[2]?.fields).toEqual(['student.transportation']);
    expect(declarations[0]?.appIds).toBeUndefined();
  });

  it('accepts a vendor with no data listed, with a warning', () => {
    const r = readDeclaredList('vendor,exhibit_b\nAcme,');
    expect(r.declarations).toHaveLength(1);
    expect(declaresData(r.declarations[0]!)).toBe(false);
    expect(r.issues[0]).toMatchObject({ severity: 'warning', line: 2 });
  });

  it('reports unknown categories, fields and dates with their line', () => {
    const r = readDeclaredList('vendor,exhibit_b,fields,published_on\nAcme,Grades,student.dob,15/08/2026');
    expect(r.declarations).toEqual([]);
    expect(r.issues.map((i) => i.column)).toEqual(['exhibit_b', 'fields', 'published_on']);
  });

  it('requires the vendor column', () => {
    expect(readDeclaredList('apps\nX').issues[0]?.message).toContain('vendor');
  });
});
