import { zipSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { parseCsv, readOneRosterFiles, readOneRosterZip, CsvParser, type CsvRecord } from '../src/index.js';

// A tiny synthetic district: two schools, five students, two teachers, one guardian.
const ORGS = `sourcedId,status,dateLastModified,name,type,identifier,parentSourcedId
d1,,,Synthetic USD,district,,
s1,,,Lincoln Elementary,school,,d1
s2,,,Roosevelt Middle,school,,d1
`;
const USERS = `sourcedId,status,dateLastModified,enabledUser,orgSourcedIds,role,username,userIds,givenName,familyName,middleName,identifier,email,sms,phone,agentSourcedIds,grades,password
u1,,,true,s1,student,,,Ana,Lee,,,,,,,KG,
u2,,,true,s1,student,,,Ben,Ray,,,,,,,03,
u3,,,true,s2,student,,,Cal,Diaz,,,,,,,"07,08",
u4,,,true,s2,student,,,Dee,Fox,,,,,,,TK,
u5,tobedeleted,,true,s2,student,,,Eve,Gray,,,,,,,07,
t1,,,true,"d1,s1",teacher,,,Fay,Hill,,,,,,,,
t2,,,true,s2,administrator,,,Gus,Ito,,,,,,,,
g1,,,true,s1,guardian,,,Hal,Lee,,,,,,,,
x1,,,true,s9,counselor,,,Ivy,Jo,,,,,,,,
`;
const MANIFEST = `propertyName,value
manifest.version,1.0
oneroster.version,1.1
file.orgs,bulk
file.users,bulk
file.demographics,bulk
`;
// Never opened by the reader.
const DEMOGRAPHICS = 'sourcedId,birthDate\nu1,2019-05-01\n';

describe('streaming csv', () => {
  it('gives the same records whatever the chunk boundaries', () => {
    const text = 'a,b\r\n"x, ""y""",2\r\n"multi\r\nline",3\n';
    const whole = parseCsv(text);
    for (let size = 1; size <= 5; size++) {
      const records: CsvRecord[] = [];
      const parser = new CsvParser((r) => records.push(r));
      for (let i = 0; i < text.length; i += size) parser.push(text.slice(i, i + size));
      parser.end();
      expect(records).toEqual(whole);
    }
  });
});

describe('OneRoster reader', () => {
  it('reads schools, students and staff, and nothing else', async () => {
    const roster = await readOneRosterFiles([
      ['manifest.csv', MANIFEST],
      ['orgs.csv', ORGS],
      ['users.csv', USERS],
      ['demographics.csv', DEMOGRAPHICS],
    ]);
    expect([...roster.schools.values()].map((s) => s.name)).toEqual(['Lincoln Elementary', 'Roosevelt Middle']);
    expect([...roster.students.keys()]).toEqual(['u1', 'u2', 'u3', 'u4']);
    expect(roster.students.get('u3')).toEqual({ schools: ['s2'], grades: ['07', '08'] });
    expect(roster.students.get('u4')?.grades).toEqual(['TK']);
    expect(roster.staff.get('t1')).toEqual({ schools: ['s1'], role: 'teacher' });
    expect(roster.staff.get('t2')?.role).toBe('administrator');
    expect(roster.files).toEqual(['manifest.csv', 'orgs.csv', 'users.csv']);
    // Names are never kept.
    expect(JSON.stringify([...roster.students.values(), ...roster.staff.values()])).not.toContain('Ana');
  });

  it('reports problems once, with how many rows have them', async () => {
    const roster = await readOneRosterFiles([
      ['orgs.csv', ORGS],
      ['users.csv', USERS],
    ]);
    const messages = roster.issues.map((i) => i.message);
    expect(messages).toContain("Unknown role 'counselor': these users are not counted.");
    expect(messages.some((m) => m.startsWith('Students with a grade other than'))).toBe(true);
    expect(messages.some((m) => m.includes('not in orgs.csv'))).toBe(true);
    expect(roster.issues.every((i) => i.severity === 'warning')).toBe(true);
  });

  it('reads files in chunks', async () => {
    async function* chunks(text: string) {
      for (let i = 0; i < text.length; i += 7) yield text.slice(i, i + 7);
    }
    const roster = await readOneRosterFiles([
      ['users.csv', chunks(USERS)],
      ['orgs.csv', chunks(ORGS)],
    ]);
    expect(roster.students.size).toBe(4);
    expect(roster.staff.size).toBe(2);
  });

  it('reads a zip, whole or in chunks, with files in a subfolder', async () => {
    const zip = zipSync({
      'export/manifest.csv': strToU8(MANIFEST),
      'export/orgs.csv': strToU8(ORGS),
      'export/users.csv': strToU8(USERS),
      'export/demographics.csv': strToU8(DEMOGRAPHICS),
    });
    const whole = await readOneRosterZip(zip);
    expect(whole.students.size).toBe(4);
    function* parts() {
      for (let i = 0; i < zip.length; i += 50) yield zip.slice(i, i + 50);
    }
    const chunked = await readOneRosterZip(parts());
    expect([...chunked.students.keys()]).toEqual([...whole.students.keys()]);
    expect(chunked.files).not.toContain('demographics.csv');
  });

  it('reports missing files, missing columns and delta exports as errors', async () => {
    const roster = await readOneRosterFiles([
      ['manifest.csv', 'propertyName,value\noneroster.version,1.2\nfile.users,delta\n'],
      ['users.csv', 'sourcedId,role\nu1,student\n'],
    ]);
    const errors = roster.issues.filter((i) => i.severity === 'error').map((i) => i.message);
    expect(errors).toContain('orgs.csv was not found.');
    expect(errors).toContain('Missing required column(s): orgSourcedIds.');
    expect(errors.some((m) => m.includes('delta'))).toBe(true);
    expect(roster.issues.some((i) => i.message.includes('OneRoster 1.2'))).toBe(true);
  });
});
