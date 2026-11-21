import { describe, expect, it } from 'vitest';
import { evaluateAlerts, readContracts, type ResolvedFlow } from '../src/index.js';

// Same content as docs/formats/contracts-example.csv.
const EXAMPLE = `contract_id,vendor,apps,exhibit_b,fields,end_date,deletion_days,agreement,source,notes
ACME-2025,Acme Learning,,Student Name|Student Identifiers|Enrollment|Student In App Performance,student.birth_date,2027-06-30,60,ndpa,https://sdpc.a4l.org/,Covers every Acme app; date of birth checked individually
FOOD-2023,Food Services Co,LunchLine,Student Name|Student Identifiers|Enrollment|Special Indicator,,2026-06-30,30,state_dpa,,Renewal pending
QUIZ-TOS,QuizHub Inc,QuizHub,,,,,vendor_terms,https://example.com/terms,Click-through terms; Exhibit B not available
`;

describe('reading contracts', () => {
  const { contracts, issues } = readContracts(EXAMPLE);

  it('reads the example', () => {
    expect(contracts.map((c) => c.id)).toEqual(['ACME-2025', 'FOOD-2023', 'QUIZ-TOS']);
    expect(contracts[0]).toMatchObject({
      vendorId: 'Acme Learning',
      exhibitB: ['Student Name', 'Student Identifiers', 'Enrollment', 'Student In App Performance'],
      fields: ['student.birth_date'],
      expiresOn: '2027-06-30',
      deletionDays: 60,
      agreement: 'ndpa',
      line: 2,
    });
    expect(contracts[0]?.appIds).toBeUndefined();
    expect(contracts[1]?.appIds).toEqual(['LunchLine']);
  });

  it('warns when a contract records no categories or fields', () => {
    expect(issues).toEqual([expect.objectContaining({ severity: 'warning', line: 4, column: 'exhibit_b' })]);
    expect(contracts[2]?.exhibitB).toBeUndefined();
    expect(contracts[2]?.fields).toBeUndefined();
  });

  it('matches category names loosely and rejects unknown ones', () => {
    const r = readContracts('contract_id,vendor,exhibit_b\nC1,V,parent/guardian contact information|SPECIAL INDICATOR|Grades');
    expect(r.contracts).toEqual([]);
    expect(r.issues[0]?.message).toContain("Unknown Exhibit B category 'Grades'");
    const ok = readContracts('contract_id,vendor,exhibit_b\nC1,V,parent guardian contact information|SPECIAL INDICATOR');
    expect(ok.contracts[0]?.exhibitB).toEqual(['Parent/Guardian Contact Information', 'Special Indicator']);
  });

  it('rejects repeated IDs and invalid values', () => {
    const r = readContracts('contract_id,vendor,end_date,agreement,deletion_days\nC1,V,2027-02-30,dpa,x\nC1,V,,,');
    const messages = r.issues.map((i) => `${i.line}:${i.column}:${i.message}`);
    expect(messages.some((m) => m.startsWith('2:end_date:'))).toBe(true);
    expect(messages.some((m) => m.startsWith('2:agreement:'))).toBe(true);
    expect(messages.some((m) => m.startsWith('2:deletion_days:'))).toBe(true);
    expect(messages.some((m) => m.startsWith("3:contract_id:Contract ID 'C1' is already used on line 2"))).toBe(true);
  });
});

describe('contracts in the alert rules', () => {
  const flow: ResolvedFlow = {
    appId: 'ReadWell',
    vendorId: 'Acme Learning',
    channel: 'clever',
    fields: ['student.first_name', 'student.birth_date', 'student.race'],
    students: new Set(['s1', 's2']),
  };
  const run = () =>
    evaluateAlerts({ flows: [flow], apps: { ReadWell: 'instructional_content' }, contracts: readContracts(EXAMPLE).contracts, today: '2026-11-17' });

  it('allows a single field listed in the contract, but not the rest of its category', () => {
    const mismatch = run().find((a) => a.rule === 'contract_mismatch');
    // Date of birth is allowed as a field; race shares its category (Demographics) but is not allowed.
    expect(mismatch?.fields).toEqual(['student.race']);
  });
});
