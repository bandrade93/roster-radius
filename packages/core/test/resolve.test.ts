import { describe, expect, it } from 'vitest';
import {
  checkNames,
  exposureByVendor,
  generateSyntheticDistrict,
  readContracts,
  readDeclaredList,
  readInventory,
  readOneRosterFiles,
  resolveInventory,
  type InventoryRow,
} from '../src/index.js';

const district = generateSyntheticDistrict();
const files = district.files;
const openFile = (path: string) => files[path];
const rosterOf = () => readOneRosterFiles(Object.entries(files).filter(([p]) => p.startsWith('oneroster/')));
const inventoryRows = (text: string): readonly InventoryRow[] => {
  const r = readInventory(text);
  expect(r.issues.filter((i) => i.severity === 'error')).toEqual([]);
  return r.rows;
};

describe('resolving the synthetic district', async () => {
  const roster = await rosterOf();
  const result = await resolveInventory({ rows: inventoryRows(files['inventory.csv']!), roster, openFile });
  const byApp = Object.fromEntries(result.rows.map((r) => [r.row.app, r]));

  it('resolves every row, with only the expected warning', () => {
    expect(result.rows).toHaveLength(8);
    expect(result.issues.map((i) => `${i.severity}:${i.file}`)).toEqual(['warning:exports/mathpath_students.csv']);
  });

  it('takes students and teachers from the roster, by grade and by school', () => {
    expect(byApp.ReadWell?.students).toEqual({ kind: 'roster', count: 690, source: 'measured', matchedBy: 'sourcedId' });
    expect(byApp.ReadWell?.staff).toEqual({ kind: 'roster', count: 77, source: 'measured', matchedBy: 'sourcedId' });
    expect(byApp.ClassCloud?.students.count).toBe(970);
    expect(byApp.ClassCloud?.staff.count).toBe(50);
    expect(byApp.LunchLine?.students.count).toBe(1660);
  });

  it('reads measured fields from the export file', () => {
    expect(byApp.MathPath?.fieldSource).toBe('measured');
    expect(byApp.MathPath?.flow.fields).toContain('student.frl_status');
    expect(byApp.MathPath?.students.count).toBe(450);
    expect(byApp.ReadWell?.fieldSource).toBe('entered');
  });

  it('matches a Clever file to the roster through the OneRoster identifier', () => {
    expect(byApp.QuizHub?.students).toEqual({ kind: 'file', count: 116, source: 'measured', path: 'clever/quizhub/students.csv', idColumn: 'Student_id', matchedBy: 'identifier', unmatched: 0 });
  });

  it('keeps a count as a count', () => {
    expect(byApp.FamilyTalk?.students).toEqual({ kind: 'count', count: 1600, source: 'entered' });
  });

  it('gives the exposure numbers shown in the example screens', () => {
    const acme = exposureByVendor(result.flows).find((v) => v.id === 'Acme Learning');
    expect(acme?.people).toEqual({ min: 1140, max: 1140, exact: true });
    expect(acme?.points.max).toBe(25050);
    const transit = exposureByVendor(result.flows).find((v) => v.id === 'Transit Apps LLC');
    expect(transit?.points.max).toBe(33200);
  });
});

describe('problems while resolving', async () => {
  const roster = await rosterOf();
  const header = 'app,vendor,channel,fields,students,staff,schools,grades';
  const resolve = async (row: string) => resolveInventory({ rows: inventoryRows(`${header}\n${row}`), roster, openFile });

  it('an unknown school is an error, with a suggestion, and the row is left out', async () => {
    const r = await resolve('A,V,clever,student.first_name,all,,Synthetic Middle Schol,');
    expect(r.rows).toEqual([]);
    expect(r.issues[0]?.message).toContain("Did you mean 'Synthetic Middle School'?");
  });

  it('a missing file is an error', async () => {
    const r = await resolve('A,V,clever,student.first_name,file:clever/other/students.csv,,,');
    expect(r.issues[0]).toMatchObject({ severity: 'error', message: expect.stringContaining('was not provided') });
  });

  it('a filter that reaches nobody is a warning', async () => {
    const r = await resolve('A,V,clever,student.first_name,all,,Synthetic Elementary North,09');
    expect(r.rows[0]?.students.count).toBe(0);
    expect(r.issues[0]?.message).toContain('resolves to nobody');
  });

  it('IDs not in the roster are counted apart and reported', async () => {
    const extra = { ...files, 'extra/students.csv': 'Student_id\n100001\n999999\n' };
    const r = await resolveInventory({
      rows: inventoryRows(`${header}\nA,V,clever,student.first_name,file:extra/students.csv,,,`),
      roster,
      openFile: (p) => extra[p as keyof typeof extra],
    });
    expect(r.rows[0]?.students).toEqual({ kind: 'file', count: 2, source: 'measured', path: 'extra/students.csv', idColumn: 'Student_id', matchedBy: 'identifier', unmatched: 1 });
    expect(r.issues[0]?.message).toContain('1 of 2 IDs');
  });

  it('accepts Windows paths and a leading ./', async () => {
    const r = await resolve('A,V,clever,student.first_name,file:.\\clever\\quizhub\\students.csv,,,');
    expect(r.rows[0]?.students.count).toBe(116);
  });
});

describe('names across files', () => {
  const inventory = readInventory(files['inventory.csv']!).rows;

  it('the synthetic files agree, except a vendor the district no longer uses', () => {
    const issues = checkNames({ inventory, contracts: readContracts(files['contracts.csv']!).contracts, declarations: readDeclaredList(files['declared.csv']!).declarations });
    expect(issues.map((i) => i.message)).toEqual(["The declared list names vendor 'OldReader Co', which has no app in the inventory."]);
  });

  it('suggests the vendor or app a misspelling meant', () => {
    const contracts = readContracts('contract_id,vendor,apps\nC1,Acme Learnin,\nC2,Acme Learning,ReadWel\nC3,Acme Learning,LunchLine\n').contracts;
    const messages = checkNames({ inventory, contracts }).map((i) => i.message);
    expect(messages[0]).toContain("Did you mean 'Acme Learning'?");
    expect(messages[1]).toContain("Did you mean 'ReadWell'?");
    expect(messages[2]).toContain("the inventory lists it under 'Food Services Co'");
  });
});
