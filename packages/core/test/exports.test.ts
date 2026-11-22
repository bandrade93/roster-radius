import { describe, expect, it } from 'vitest';
import { readExportHeader, readPeopleFile, recognizeHeader } from '../src/index.js';

describe('recognizing a header', () => {
  it('reads Clever file columns with their own names, including guardian contacts', () => {
    const r = recognizeHeader('students.csv', ['School_id', 'Student_id', 'First_name', 'Last_name', 'DOB', 'Grade', 'Ell_status', 'Contact_name', 'Contact_phone']);
    expect(r.format).toBe('clever');
    expect(r.fields).toEqual([
      'student.school',
      'student.sis_id',
      'student.first_name',
      'student.last_name',
      'student.birth_date',
      'student.grade_level',
      'student.ell_status',
      'guardian.name',
      'guardian.phone',
    ]);
  });

  it('reads Clever teacher files as staff', () => {
    expect(recognizeHeader('teachers.csv', ['Teacher_id', 'Teacher_email']).fields).toEqual(['staff.id', 'staff.email']);
  });

  it('reads an export from the student information system with any spelling, and lists what it does not know', () => {
    const r = recognizeHeader('mathpath_students.csv', ['Student ID', 'First Name', 'last_name', 'BirthDate', 'Address', 'Free/Reduced Lunch', 'Locker']);
    expect(r.format).toBe('generic');
    expect(r.fields).toEqual(['student.sis_id', 'student.first_name', 'student.last_name', 'student.birth_date', 'student.address', 'student.frl_status']);
    expect(r.columns.filter((c) => c.status === 'unknown').map((c) => c.column)).toEqual(['Locker']);
  });

  it('recognizes common SIS spellings and prefers the person\'s own field', () => {
    const r = recognizeHeader('sis_export.csv', ['ID', 'Name', 'Ethnicity', 'Lunch Status', 'IEP', '504', 'LEP', 'SSID', 'Bus Route', 'Parent Email']);
    const by = Object.fromEntries(r.columns.map((c) => [c.column, c.field ?? c.status]));
    expect(by).toEqual({
      ID: 'student.sis_id',
      // Could be the guardian's, the school's or the section's name: not guessed.
      Name: 'ambiguous',
      Ethnicity: 'student.race',
      'Lunch Status': 'student.frl_status',
      IEP: 'student.iep_status',
      '504': 'student.section_504_status',
      LEP: 'student.ell_status',
      SSID: 'student.state_id',
      'Bus Route': 'student.transportation',
      'Parent Email': 'guardian.email',
    });
    expect(recognizeHeader('staff_export.csv', ['ID', 'Email']).fields).toEqual(['staff.id', 'staff.email']);
  });

  it('accepts catalog keys and labels as column names', () => {
    expect(recognizeHeader('export.csv', ['student.birth_date', 'Date of birth']).fields).toEqual(['student.birth_date']);
  });
});

describe('reading the header of an export', () => {
  it('reads only the first row, and warns about unknown columns', async () => {
    async function* chunks() {
      yield 'Student ID,First Name,Locker\n';
      yield '1,Ana,12\n';
      throw new Error('should not read past the header');
    }
    const r = await readExportHeader('exports/mathpath_students.csv', chunks());
    expect(r.fields).toEqual(['student.sis_id', 'student.first_name']);
    expect(r.issues).toEqual([expect.objectContaining({ severity: 'warning', message: expect.stringContaining('Locker') })]);
  });

  it('is an error when nothing is recognized', async () => {
    const r = await readExportHeader('x.csv', 'Foo,Bar\n1,2\n');
    expect(r.issues.some((i) => i.severity === 'error')).toBe(true);
  });
});

describe('reading a file that lists who an app reaches', () => {
  const CLEVER_STUDENTS = 'School_id,Student_id,First_name,Last_name\ns1,1001,Ana,Lee\ns1,1002,Ben,Ray\ns2,1002,Ben,Ray\ns2,,No,Id\n';

  it('counts rows and keeps distinct identifiers, and no other value', async () => {
    const r = await readPeopleFile('clever/quizhub/students.csv', CLEVER_STUDENTS);
    expect(r.rows).toBe(4);
    expect([...(r.ids ?? [])]).toEqual(['1001', '1002']);
    expect(r.idColumn).toBe('Student_id');
    expect(JSON.stringify(r)).not.toContain('Ana');
    expect(r.issues[0]?.message).toContain('1 row(s) have no ID');
  });

  it('falls back to the row count when there is no ID column', async () => {
    const r = await readPeopleFile('roster.csv', 'First_name,Last_name\nAna,Lee\nBen,Ray\n');
    expect(r.rows).toBe(2);
    expect(r.ids).toBeUndefined();
    expect(r.issues[0]?.message).toContain('given as a range');
  });

  it('finds the ID in a column named just ID', async () => {
    const r = await readPeopleFile('roster.csv', 'ID,First Name\n1,Ana\n2,Ben\n');
    expect(r.ids?.size).toBe(2);
    expect(r.idColumn).toBe('ID');
  });

  it('reads staff files by their name', async () => {
    const r = await readPeopleFile('teachers.csv', 'School_id,Teacher_id\ns1,t1\ns1,t2\n');
    expect(r.ids?.size).toBe(2);
  });
});
