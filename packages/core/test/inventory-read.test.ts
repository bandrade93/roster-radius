import { describe, expect, it } from 'vitest';
import { readInventory } from '../src/index.js';

// Same content as docs/formats/inventory-example.csv.
const EXAMPLE = `app,vendor,channel,fields,category,channel_id,students,staff,schools,grades,contract_end,deletion_days,notes
ReadWell,Acme Learning,clever,student.sis_id|student.first_name|student.last_name|student.grade_level|student.school|student.birth_date|staff.id|staff.first_name|staff.last_name|staff.email,instructional_content,,all,teachers,,KG|01|02|03|04|05,2027-06-30,60,Elementary reading
MathPath,Acme Learning,sftp,file:exports/mathpath_students.csv,instructional_content,,all,,Lincoln Middle|Roosevelt Middle,,2027-06-30,60,Nightly SFTP export to the vendor
LunchLine,Food Services Co,sftp,student.sis_id|student.student_number|student.first_name|student.last_name|student.school|student.grade_level|student.frl_status,nutrition,,all,,,,2026-06-30,30,Cafeteria point of sale
QuizHub,QuizHub Inc,clever,student.first_name|student.last_name|student.email,,,file:clever/quizhub/students.csv,,,,,,Teacher-requested app
FamilyTalk,Family Messaging LLC,manual_upload,student.first_name|student.last_name|guardian.name|guardian.phone|guardian.email|student.home_language,family_communication,,count:1700,,,,2027-12-31,90,Uploaded by the front office twice a year
`;

const header = 'app,vendor,channel,fields,students,staff,grades,category,contract_end,deletion_days';
const one = (row: string) => readInventory(`${header}\n${row}`);
const messages = (row: string) => one(row).issues.map((i) => `${i.line}:${i.column ?? ''}:${i.severity}:${i.message}`);

describe('reading the example inventory', () => {
  const { rows, issues } = readInventory(EXAMPLE);

  it('reads every row without issues', () => {
    expect(issues).toEqual([]);
    expect(rows.map((r) => r.app)).toEqual(['ReadWell', 'MathPath', 'LunchLine', 'QuizHub', 'FamilyTalk']);
  });

  it('fills defaults and parses each column', () => {
    const [readWell, mathPath, , quizHub, familyTalk] = rows;
    expect(readWell?.channelId).toBe('clever');
    expect(readWell?.staff).toEqual({ kind: 'teachers' });
    expect(readWell?.grades).toEqual(['KG', '01', '02', '03', '04', '05']);
    expect(readWell?.contractEnd).toBe('2027-06-30');
    expect(readWell?.deletionDays).toBe(60);
    expect(mathPath?.channelId).toBe('sftp:Acme Learning');
    expect(mathPath?.fieldSource).toEqual({ kind: 'file', path: 'exports/mathpath_students.csv' });
    expect(mathPath?.schools).toEqual(['Lincoln Middle', 'Roosevelt Middle']);
    expect(quizHub?.category).toBeUndefined();
    expect(quizHub?.students).toEqual({ kind: 'file', path: 'clever/quizhub/students.csv' });
    expect(familyTalk?.students).toEqual({ kind: 'count', count: 1700 });
    expect(familyTalk?.line).toBe(6);
  });
});

describe('header problems', () => {
  it('reports missing required columns and stops', () => {
    const r = readInventory('app,vendor\nX,Y');
    expect(r.rows).toEqual([]);
    expect(r.issues[0]?.message).toContain('channel, fields');
  });

  it('warns about unknown columns, with a suggestion', () => {
    const r = readInventory('app,vendor,channel,fields,catgory\nX,Y,clever,student.first_name,');
    expect(r.rows).toHaveLength(1);
    expect(r.issues[0]).toMatchObject({ severity: 'warning', message: expect.stringContaining("Did you mean 'category'?") });
  });

  it('matches column names without regard to case', () => {
    expect(readInventory('App,VENDOR,Channel,Fields\nX,Y,clever,student.first_name').rows).toHaveLength(1);
  });

  it('reports an empty file', () => {
    expect(readInventory('').issues[0]?.message).toBe('The file is empty.');
  });
});

describe('row problems, each with its line and column', () => {
  it('suggests the closest field, channel and category', () => {
    expect(messages("X,Y,clevr,student.dob|student.birth_date,,,,instructional,,")).toEqual([
      expect.stringContaining("2:channel:error:Unknown channel 'clevr'. Did you mean 'clever'?"),
      expect.stringContaining("2:fields:error:Unknown field 'student.dob'."),
      expect.stringContaining("2:category:error:Unknown category 'instructional'. Did you mean 'instructional_content'?"),
    ]);
  });

  it('accepts catalog labels as well as keys', () => {
    expect(one('X,Y,sftp,Date of birth|student first name,,,,,,').rows[0]?.fields).toEqual(['student.birth_date', 'student.first_name']);
  });

  it('requires a staff value when the row has staff fields', () => {
    const r = one('X,Y,clever,staff.email,,,,,,');
    expect(r.rows).toEqual([]);
    expect(r.issues[0]).toMatchObject({ column: 'staff', severity: 'error' });
  });

  it('rejects contradictions and invalid values', () => {
    expect(messages('X,Y,clever,student.first_name,none,,,,,')[0]).toContain("but 'students' is none");
    expect(messages('X,Y,clever,student.first_name,teachers,,,,,')[0]).toContain("only valid in the 'staff' column");
    expect(messages('X,Y,clever,student.first_name,count:0,,,,,')[0]).toContain('not a valid count');
    expect(messages('X,Y,clever,student.first_name,,,13,,,')[0]).toContain("Unknown grade '13'");
    expect(messages('X,Y,clever,student.first_name,,,,,2027-02-30,')[0]).toContain('not a valid date');
    expect(messages('X,Y,clever,student.first_name,,,,,,ten')[0]).toContain('not a valid number of days');
  });

  it('normalizes grade spellings', () => {
    expect(one('X,Y,clever,student.first_name,,,K|1|12|pk,,,').rows[0]?.grades).toEqual(['KG', '01', '12', 'PK']);
  });

  it('keeps rows with warnings and drops rows with errors', () => {
    const r = readInventory(`${header}\nA,V,clever,student.first_name|student.first_name,,,,,,\nB,V,clever,,,,,,,`);
    expect(r.rows.map((x) => x.app)).toEqual(['A']);
    expect(r.issues.map((i) => i.severity)).toEqual(['warning', 'error']);
  });

  it('an app belongs to one vendor and one category', () => {
    const r = readInventory(`${header}\nA,V1,clever,student.first_name,,,,library,,\nA,V2,sftp,student.first_name,,,,nutrition,,`);
    expect(r.issues.map((i) => i.column)).toEqual(['vendor', 'category']);
    expect(r.issues[0]?.message).toContain('line 2');
  });

  it('warns about a repeated app and channel', () => {
    const r = readInventory(`${header}\nA,V,clever,student.first_name,,,,,,\nA,V,clever,student.last_name,,,,,,`);
    expect(r.rows).toHaveLength(2);
    expect(r.issues[0]?.message).toContain("already has a row for channel 'clever' on line 2");
  });

  it('reports a broken quote instead of throwing', () => {
    expect(readInventory(`${header}\nA,V,clever,"student.first_name`).issues[0]).toMatchObject({ severity: 'error', line: 2 });
  });
});
