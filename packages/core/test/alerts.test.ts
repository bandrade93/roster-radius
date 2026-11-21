import { describe, expect, it } from 'vitest';
import { evaluateAlerts, type AlertInput, type Contract, type ResolvedFlow } from '../src/index.js';

const ids = (prefix: string, from: number, to: number): Set<string> =>
  new Set(Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${from + i}`));

const reading: ResolvedFlow = {
  appId: 'reading',
  vendorId: 'acme',
  channel: 'clever',
  fields: [
    'student.first_name',
    'student.last_name',
    'student.grade_level',
    'student.school',
    'student.birth_date',
    'student.iep_status',
    'student.password',
    'staff.password',
  ],
  students: ids('s', 1, 1200),
  staff: ids('t', 1, 40),
};
const math: ResolvedFlow = {
  appId: 'math',
  vendorId: 'acme',
  channel: 'sftp',
  fields: ['student.first_name', 'student.last_name', 'student.frl_status', 'student.address'],
  students: { count: 800 },
};
const lunch: ResolvedFlow = {
  appId: 'lunch',
  vendorId: 'food',
  channel: 'sftp',
  fields: ['student.sis_id', 'student.first_name', 'student.last_name', 'student.frl_status'],
  students: ids('s', 1, 1700),
};
const quiz: ResolvedFlow = {
  appId: 'quiz',
  vendorId: 'other',
  channel: 'clever',
  fields: ['student.first_name'],
  students: ids('s', 1, 300),
};

const acmeContract: Contract = {
  id: 'C1',
  vendorId: 'acme',
  exhibitB: ['Student Name', 'Student Identifiers', 'Enrollment', 'Demographics'],
  expiresOn: '2027-06-30',
};
const foodContract: Contract = { id: 'C2', vendorId: 'food', exhibitB: ['Student Name', 'Special Indicator'], expiresOn: '2026-06-30' };

const input: AlertInput = {
  flows: [reading, math, lunch, quiz],
  apps: { reading: 'instructional_content', math: 'instructional_content', lunch: 'nutrition' },
  contracts: [acmeContract, foodContract],
  today: '2026-11-17',
};

const find = (alerts: ReturnType<typeof evaluateAlerts>, rule: string, appId: string) =>
  alerts.find((a) => a.rule === rule && a.appId === appId);

describe('flow alerts', () => {
  const alerts = evaluateAlerts(input);

  it('passwords are critical and come first', () => {
    const a = find(alerts, 'password', 'reading');
    expect(alerts[0]).toBe(a);
    expect(a?.severity).toBe('critical');
    expect(a?.fields).toEqual(['staff.password', 'student.password']);
    expect(a?.students).toBe(1200);
    expect(a?.staff).toBe(40);
  });

  it('unnecessary fields for the category, most sensitive first, without repeating passwords', () => {
    expect(find(alerts, 'unexpected_field', 'reading')?.fields).toEqual(['student.birth_date']);
    const math = find(alerts, 'unexpected_field', 'math');
    expect(math?.severity).toBe('high');
    expect(math?.fields).toEqual(['student.address', 'student.frl_status']);
    expect(math?.students).toBe(800);
  });

  it('the same field is fine for a category that needs it', () => {
    expect(find(alerts, 'unexpected_field', 'lunch')).toBeUndefined();
  });

  it('sensitive conditional fields are flagged for review only', () => {
    const a = find(alerts, 'review_field', 'reading');
    expect(a?.severity).toBe('info');
    expect(a?.fields).toEqual(['student.iep_status']);
  });

  it('apps without a category are reported, not guessed', () => {
    expect(find(alerts, 'unclassified_app', 'quiz')?.severity).toBe('info');
    expect(find(alerts, 'unexpected_field', 'quiz')).toBeUndefined();
  });
});

describe('contract alerts', () => {
  const alerts = evaluateAlerts(input);

  it('fields outside Exhibit B', () => {
    const reading = find(alerts, 'contract_mismatch', 'reading');
    expect(reading?.fields).toEqual(['student.iep_status']);
    expect(reading?.contractId).toBe('C1');
    expect(find(alerts, 'contract_mismatch', 'math')?.fields).toEqual(['student.address', 'student.frl_status']);
  });

  it('expired contract with data still flowing', () => {
    const a = find(alerts, 'contract_expired', 'lunch');
    expect(a?.severity).toBe('high');
    expect(a?.contractId).toBe('C2');
    expect(a?.students).toBe(1700);
    expect(find(alerts, 'contract_mismatch', 'lunch')).toBeUndefined();
  });

  it('no contract at all', () => {
    expect(find(alerts, 'no_contract', 'quiz')?.students).toBe(300);
  });

  it('contract about to expire', () => {
    expect(find(alerts, 'contract_expiring', 'reading')).toBeUndefined();
    const later = evaluateAlerts({ ...input, today: '2027-05-15' });
    expect(find(later, 'contract_expiring', 'reading')?.message).toContain('in 46 days');
  });

  it('a renewal keeps the app covered', () => {
    const renewal: Contract = { ...foodContract, id: 'C3', expiresOn: '2027-06-30' };
    const alerts = evaluateAlerts({ ...input, contracts: [acmeContract, foodContract, renewal] });
    expect(find(alerts, 'contract_expired', 'lunch')).toBeUndefined();
  });

  it('a contract can cover only some apps of a vendor', () => {
    const onlyReading: Contract = { ...acmeContract, appIds: ['reading'] };
    const alerts = evaluateAlerts({ ...input, contracts: [onlyReading, foodContract] });
    expect(find(alerts, 'no_contract', 'math')).toBeDefined();
    expect(find(alerts, 'no_contract', 'reading')).toBeUndefined();
  });

  it('skips the field comparison when Exhibit B was not recorded', () => {
    const datesOnly: Contract = { id: 'C9', vendorId: 'acme', expiresOn: '2027-06-30' };
    const alerts = evaluateAlerts({ ...input, contracts: [datesOnly, foodContract] });
    expect(find(alerts, 'contract_mismatch', 'reading')).toBeUndefined();
    expect(find(alerts, 'no_contract', 'reading')).toBeUndefined();
  });

  it('rejects invalid dates', () => {
    expect(() => evaluateAlerts({ ...input, today: '17/11/2026' })).toThrow(RangeError);
  });
});
