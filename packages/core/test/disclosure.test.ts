import { describe, expect, it } from 'vitest';
import { analyzeFiles, compareDisclosure, generateSyntheticDistrict, readDeclaredList, type ResolvedFlow } from '../src/index.js';

const ids = (from: number, to: number): Set<string> => new Set(Array.from({ length: to - from + 1 }, (_, i) => `s${from + i}`));
const flow = (appId: string, vendorId: string, fields: ResolvedFlow['fields'], students: ResolvedFlow['students'] = ids(1, 100)): ResolvedFlow => ({
  appId,
  vendorId,
  channel: 'sftp',
  fields,
  ...(students ? { students } : {}),
});
const declared = (csv: string) => readDeclaredList(`vendor,apps,exhibit_b,fields\n${csv}\n`).declarations;

describe('disclosure versus flow', () => {
  it('finds vendors the publication does not name', () => {
    const r = compareDisclosure({ flows: [flow('quiz', 'QuizCo', ['student.first_name', 'student.email'])], declarations: [] });
    expect(r.vendorsReceiving).toBe(1);
    expect(r.vendorsDisclosed).toBe(0);
    expect(r.findings).toMatchObject([{ kind: 'undisclosed_vendor', severity: 'high', vendorId: 'QuizCo', students: { max: 100 } }]);
  });

  it('finds apps the publication leaves out for a vendor it names', () => {
    const r = compareDisclosure({
      flows: [flow('read', 'Acme', ['student.first_name']), flow('math', 'Acme', ['student.first_name'])],
      declarations: declared('Acme,read,Student Name,'),
    });
    expect(r.findings).toMatchObject([{ kind: 'undisclosed_app', apps: ['math'], lines: [2] }]);
    expect(r.findings[0]?.message).toContain('only for read');
  });

  it('finds data outside the listed categories and fields', () => {
    const r = compareDisclosure({
      flows: [flow('bus', 'Transit', ['student.first_name', 'student.address', 'student.transportation', 'student.school'])],
      declarations: declared('Transit,,Student Name|Enrollment,student.transportation'),
    });
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toMatchObject({
      kind: 'undisclosed_data',
      severity: 'high',
      fields: ['student.address'],
      categories: ['Student Contact Information'],
      students: { min: 100, max: 100, exact: true },
    });
  });

  it('only counts the students whose undisclosed data flows', () => {
    const r = compareDisclosure({
      flows: [flow('lms', 'Cloud', ['student.first_name'], ids(1, 300)), flow('lms', 'Cloud', ['student.first_name', 'student.gender'], ids(201, 250))],
      declarations: declared('Cloud,,Student Name,'),
    });
    expect(r.findings[0]).toMatchObject({ kind: 'undisclosed_data', fields: ['student.gender'], students: { max: 50 } });
  });

  it('does not report a publication that lists more than what flows', () => {
    const r = compareDisclosure({
      flows: [flow('read', 'Acme', ['student.first_name'])],
      declarations: declared('Acme,,Student Name|Demographics|Special Indicator,'),
    });
    expect(r.findings).toEqual([]);
    expect(r.vendorsDisclosed).toBe(1);
  });

  it('counts a vendor named without its data as disclosed, but does not compare it', () => {
    const r = compareDisclosure({ flows: [flow('read', 'Acme', ['student.iep_status'])], declarations: declared('Acme,,,') });
    expect(r.findings).toEqual([]);
    expect(r.notCompared).toEqual(['Acme']);
  });

  it('ignores staff data and flows that reach no students', () => {
    const r = compareDisclosure({
      flows: [flow('hr', 'Payroll', ['staff.id', 'staff.email']), flow('idle', 'Idle', ['student.first_name'], new Set())],
      declarations: [],
    });
    expect(r.vendorsReceiving).toBe(0);
    expect(r.findings).toEqual([]);
  });

  it('says when the number of students is unknown', () => {
    const unscoped: ResolvedFlow = { appId: 'quiz', vendorId: 'QuizCo', channel: 'sftp', fields: ['student.first_name'] };
    const r = compareDisclosure({ flows: [unscoped], declarations: [] });
    expect(r.findings[0]?.message).toContain('an unknown number of students');
  });

  it('finds entries for vendors that no longer receive data', () => {
    const r = compareDisclosure({ flows: [flow('read', 'Acme', ['student.first_name'])], declarations: declared('Acme,,Student Name,\nOldCo,,Student Name,') });
    expect(r.findings).toMatchObject([{ kind: 'no_longer_receives', severity: 'info', vendorId: 'OldCo', lines: [3] }]);
  });
});

describe('disclosure versus flow on the synthetic district', async () => {
  const district = generateSyntheticDistrict();
  const { report } = await analyzeFiles(district.files, { today: district.today });

  it('compares the published list with what flows', () => {
    const r = report.disclosure!;
    expect(r.vendorsReceiving).toBe(7);
    expect(r.vendorsDisclosed).toBe(5);
    const found = r.findings.map((f) => `${f.kind} ${f.apps.join('|') || f.vendorId} ${f.students.max}`);
    expect(found).toEqual([
      'undisclosed_vendor FamilyTalk 1600',
      'undisclosed_vendor QuizHub 116',
      'undisclosed_data RouteRider 1660',
      'undisclosed_data ReadWell 690',
      'undisclosed_data MathPath 450',
      'no_longer_receives OldReader Co 0',
    ]);
    expect(r.findings.find((f) => f.apps[0] === 'MathPath')?.fields).toEqual(['student.address', 'student.frl_status']);
  });

  it('is left out when no declared list is given', async () => {
    const files: Record<string, string> = { ...district.files };
    delete files['declared.csv'];
    const { report: without } = await analyzeFiles(files, { today: district.today });
    expect(without.disclosure).toBeUndefined();
  });
});
