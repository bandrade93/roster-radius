import { describe, expect, it } from 'vitest';
import { analyzeFiles, generateSyntheticDistrict, incidentReport, readOneRosterFiles, readOneRosterZip, sha256, Sha256 } from '../src/index.js';
import { zipSync, strToU8 } from 'fflate';

describe('sha256', () => {
  it('matches the published test vectors', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
    expect(sha256('a'.repeat(1_000_000))).toBe('cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0');
  });

  it('gives the same hash in chunks, and encodes text as UTF-8', () => {
    const text = 'name\nJosé,Zoë\n'.repeat(50);
    const h = new Sha256();
    for (let i = 0; i < text.length; i += 7) h.update(text.slice(i, i + 7));
    expect(h.hex()).toBe(sha256(text));
    expect(sha256('é')).toBe(sha256(new Uint8Array([0xc3, 0xa9])));
  });
});

describe('traceability on the synthetic district', async () => {
  const district = generateSyntheticDistrict();
  const { report, flows } = await analyzeFiles(district.files, { today: district.today });

  it('states the methodology version and weights, and hashes every input file', () => {
    expect(report.methodologyVersion).toBe('0.1');
    expect(Object.keys(report.weights).length).toBeGreaterThan(0);
    const byPath = Object.fromEntries(report.inputs.map((f) => [f.path, f]));
    expect(byPath['inventory.csv']).toEqual({ path: 'inventory.csv', role: 'inventory', sha256: sha256(district.files['inventory.csv']!), bytes: expect.any(Number) });
    expect(byPath['oneroster/users.csv']?.role).toBe('oneroster');
    expect(byPath['oneroster/users.csv']?.sha256).toBe(sha256(district.files['oneroster/users.csv']!));
    expect(byPath['exports/mathpath_students.csv']?.role).toBe('vendor_file');
    expect(byPath['clever/quizhub/students.csv']?.role).toBe('vendor_file');
    expect(report.inputs.map((f) => f.role)).toEqual([...report.inputs.map((f) => f.role)].sort((a, b) => ['inventory', 'contracts', 'declared', 'oneroster', 'vendor_file'].indexOf(a) - ['inventory', 'contracts', 'declared', 'oneroster', 'vendor_file'].indexOf(b)));
  });

  it('uses the hashes of the bytes when the caller gives them', async () => {
    const given = { path: 'inventory.csv', role: 'inventory' as const, sha256: 'f'.repeat(64), bytes: 1 };
    const { report: r } = await analyzeFiles(district.files, { today: district.today, inputs: [given] });
    expect(r.inputs.find((f) => f.path === 'inventory.csv')).toEqual(given);
  });

  it('points each result and alert to the inventory lines it comes from', () => {
    const acme = report.students.byVendor.find((v) => v.id === 'Acme Learning');
    expect(acme?.lines).toEqual([2, 3]);
    const mathpath = report.students.byApp.find((v) => v.id === 'MathPath');
    expect(mathpath?.lines).toEqual([3]);
    for (const alert of report.alerts) expect(alert.lines.length).toBeGreaterThan(0);
    const family = report.disclosure?.findings.find((f) => f.vendorId === 'Family Messaging LLC');
    expect(family?.inventoryLines).toEqual([6]);
  });

  it('says whether each value was measured or entered, and how people were matched', () => {
    const row = (app: string) => report.flows.find((f) => f.app === app)!;
    expect(row('MathPath').fieldSource).toBe('measured');
    expect(row('ReadWell').fieldSource).toBe('entered');
    expect(row('ReadWell').students).toMatchObject({ source: 'measured', matchedBy: 'sourcedId' });
    expect(row('QuizHub').students).toMatchObject({ source: 'measured', idColumn: 'Student_id', matchedBy: 'identifier' });
    expect(row('FamilyTalk').students).toMatchObject({ kind: 'count', source: 'entered' });
  });

  it('carries the lines, version and weights into incident mode', async () => {
    const roster = await readOneRosterFiles(Object.entries(district.files).filter(([p]) => p.startsWith('oneroster/')));
    const r = incidentReport({ flows, roster, scope: { kind: 'vendor', vendorId: 'Acme Learning' }, notifiedOn: '2026-12-15' });
    expect(r.methodologyVersion).toBe('0.1');
    expect(r.students.lines).toEqual([2, 3]);
    expect(r.students.byField.find((f) => f.field === 'student.address')?.lines).toEqual([3]);
  });

  it('hashes the bytes of files inside a OneRoster zip', async () => {
    const users = district.files['oneroster/users.csv']!;
    const zip = zipSync({
      'oneroster/manifest.csv': strToU8(district.files['oneroster/manifest.csv']!),
      'oneroster/orgs.csv': strToU8(district.files['oneroster/orgs.csv']!),
      'oneroster/users.csv': new Uint8Array([0xef, 0xbb, 0xbf, ...strToU8(users)]),
    });
    const roster = await readOneRosterZip(zip);
    const hash = roster.hashes.find((h) => h.path === 'oneroster/users.csv');
    // The byte order mark is part of the file's bytes, so it is in the hash.
    expect(hash?.sha256).toBe(sha256(new Uint8Array([0xef, 0xbb, 0xbf, ...strToU8(users)])));
    expect(hash?.sha256).not.toBe(sha256(users));
  });
});
