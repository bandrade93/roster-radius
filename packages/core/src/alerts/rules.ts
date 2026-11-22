import { getField, type FieldKey } from '../catalog/index.js';
import { recordsAllowedData, type Contract } from '../contracts/types.js';
import { SENSITIVITY_CLASSES } from '../catalog/sensitivity.js';
import { fieldNeed, type AppCategory } from '../baselines/index.js';
import { exposureWithIds, type PeopleScope, type ResolvedFlow } from '../exposure/formula.js';

/**
 * Alert rules, v0.1.
 *
 * Each rule points to one thing the district can fix: a field to stop sharing,
 * a contract to sign, renew or amend. Alerts about data flows are raised per
 * flow (app and channel), because the fix is made in that channel's sharing
 * settings. Alerts about contracts are raised per app.
 *
 * | Rule              | Severity    | When                                                         |
 * | ----------------- | ----------- | ------------------------------------------------------------ |
 * | password          | critical    | A flow carries student or staff passwords                    |
 * | unexpected_field  | high/medium | A field the app's category does not need (high if weight >= 4) |
 * | no_contract       | high        | An app receives student data and no contract covers it       |
 * | contract_expired  | high        | Every contract covering the app has expired, data still flows |
 * | contract_mismatch | high/medium | A field's Exhibit B category is not authorized by the contract (when recorded) |
 * | review_field      | info        | A sensitive field the category uses only sometimes            |
 * | contract_expiring | info        | The contract covering the app expires soon                    |
 * | unclassified_app  | info        | The app has no category, so unnecessary data is not checked   |
 *
 * Contract rules look only at student and guardian fields: the NDPA Exhibit B
 * lists student data. A flow is compared with the contract, never the other
 * way around: a contract that authorizes more than what flows is not an alert.
 */

export const ALERT_RULES = [
  'password',
  'unexpected_field',
  'no_contract',
  'contract_expired',
  'contract_mismatch',
  'review_field',
  'contract_expiring',
  'unclassified_app',
] as const;
export type AlertRule = (typeof ALERT_RULES)[number];

/** Most severe first. */
export const SEVERITIES = ['critical', 'high', 'medium', 'info'] as const;
export type Severity = (typeof SEVERITIES)[number];

export interface AlertInput {
  readonly flows: readonly ResolvedFlow[];
  /** Category of each app, by app ID. Apps without one are reported as unclassified. */
  readonly apps: Readonly<Record<string, AppCategory>>;
  readonly contracts: readonly Contract[];
  /** Today, as YYYY-MM-DD. Passed in so that results are reproducible. */
  readonly today: string;
  /** How many days before expiry to warn. Default 60. */
  readonly expiringWithinDays?: number;
}

export interface Alert {
  readonly rule: AlertRule;
  readonly severity: Severity;
  readonly vendorId: string;
  readonly appId: string;
  /** Set on flow alerts. */
  readonly channel?: string;
  /** Set on contract alerts that refer to one contract. */
  readonly contractId?: string;
  /** Fields involved, most sensitive first. Empty for contract dates. */
  readonly fields: readonly FieldKey[];
  /** Students and staff affected. An upper bound when a flow has only a count. */
  readonly students: number;
  readonly staff: number;
  /** Plain-language explanation for the report. */
  readonly message: string;
  /** Inventory lines of the flows the alert is about, sorted. */
  readonly lines: readonly number[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function toDay(date: string, what: string): number {
  const time = DATE.test(date) ? Date.parse(`${date}T00:00:00Z`) : Number.NaN;
  if (Number.isNaN(time)) throw new RangeError(`Invalid date for ${what}: ${date}`);
  return time / 86_400_000;
}

const weightOf = (key: FieldKey): number => SENSITIVITY_CLASSES[getField(key)!.sensitivity].weight;
const isStudentField = (key: FieldKey): boolean => key.startsWith('student.') || key.startsWith('guardian.');
const isStaffField = (key: FieldKey): boolean => key.startsWith('staff.');
const bySensitivity = (keys: Iterable<FieldKey>): FieldKey[] =>
  [...new Set(keys)].sort((a, b) => weightOf(b) - weightOf(a) || a.localeCompare(b));
const sizeOf = (scope: PeopleScope | undefined): number =>
  scope === undefined ? 0 : scope instanceof Set ? scope.size : (scope as { count: number }).count;
const list = (keys: readonly FieldKey[]): string => keys.map((k) => getField(k)!.label).join(', ');

function flowAlerts(flow: ResolvedFlow, category: AppCategory | undefined): Alert[] {
  const base = { vendorId: flow.vendorId, appId: flow.appId, channel: flow.channel, lines: flow.line !== undefined ? [flow.line] : [] };
  const affected = (fields: readonly FieldKey[]) => ({
    students: fields.some(isStudentField) ? sizeOf(flow.students) : 0,
    staff: fields.some(isStaffField) ? sizeOf(flow.staff) : 0,
  });
  const alerts: Alert[] = [];

  const passwords = bySensitivity(flow.fields.filter((k) => getField(k)!.sensitivity === 'credential'));
  if (passwords.length > 0) {
    alerts.push({
      ...base,
      rule: 'password',
      severity: 'critical',
      fields: passwords,
      ...affected(passwords),
      message: `${flow.appId} receives passwords through ${flow.channel}. Use single sign-on instead and stop sending ${list(passwords)}.`,
    });
  }

  if (category === undefined) {
    alerts.push({
      ...base,
      rule: 'unclassified_app',
      severity: 'info',
      fields: [],
      ...affected(flow.fields),
      message: `${flow.appId} has no category, so unnecessary data was not checked. Assign a category.`,
    });
    return alerts;
  }

  const notCredential = flow.fields.filter((k) => getField(k)!.sensitivity !== 'credential');
  const unexpected = bySensitivity(notCredential.filter((k) => fieldNeed(category, k) === 'not_expected'));
  if (unexpected.length > 0) {
    alerts.push({
      ...base,
      rule: 'unexpected_field',
      severity: unexpected.some((k) => weightOf(k) >= 4) ? 'high' : 'medium',
      fields: unexpected,
      ...affected(unexpected),
      message: `${flow.appId} receives data its category does not need: ${list(unexpected)}. Stop sharing these fields in ${flow.channel}, or record why the app needs them.`,
    });
  }

  const review = bySensitivity(notCredential.filter((k) => fieldNeed(category, k) === 'conditional' && weightOf(k) >= 4));
  if (review.length > 0) {
    alerts.push({
      ...base,
      rule: 'review_field',
      severity: 'info',
      fields: review,
      ...affected(review),
      message: `${flow.appId} receives sensitive data that only some apps of its category use: ${list(review)}. Confirm that a feature in use needs it.`,
    });
  }
  return alerts;
}

function contractAlerts(appId: string, flows: readonly ResolvedFlow[], input: AlertInput): Alert[] {
  const vendorId = flows[0]!.vendorId;
  const studentFields = bySensitivity(flows.flatMap((f) => f.fields.filter(isStudentField)));
  if (studentFields.length === 0) return [];

  const students = exposureWithIds(appId, flows, { population: 'students' }).result.people.max;
  const lines = [...new Set(flows.filter((f) => f.fields.some(isStudentField) && f.line !== undefined).map((f) => f.line!))].sort((a, b) => a - b);
  const base = { vendorId, appId, students, staff: 0, lines };
  const today = toDay(input.today, 'today');
  const covering = input.contracts.filter((c) => c.vendorId === vendorId && (!c.appIds || c.appIds.includes(appId)));

  if (covering.length === 0) {
    return [
      {
        ...base,
        rule: 'no_contract',
        severity: 'high',
        fields: studentFields,
        message: `${appId} receives data about ${students} students and no data privacy agreement with ${vendorId} covers it.`,
      },
    ];
  }

  const active = covering.filter((c) => c.expiresOn === undefined || toDay(c.expiresOn, c.id) >= today);
  if (active.length === 0) {
    const last = [...covering].sort((a, b) => b.expiresOn!.localeCompare(a.expiresOn!))[0]!;
    return [
      {
        ...base,
        rule: 'contract_expired',
        severity: 'high',
        contractId: last.id,
        fields: [],
        message: `Contract ${last.id} with ${vendorId} expired on ${last.expiresOn}, and ${appId} still receives data about ${students} students. Renew it or stop the flow and ask for deletion.`,
      },
    ];
  }

  const alerts: Alert[] = [];
  // Compare fields only when every contract in force records what it allows.
  const recorded = active.every(recordsAllowedData);
  const categories = new Set(active.flatMap((c) => c.exhibitB ?? []));
  const allowedFields = new Set(active.flatMap((c) => c.fields ?? []));
  const outside = !recorded
    ? []
    : studentFields.filter((k) => {
        if (allowedFields.has(k)) return false;
        const category = getField(k)!.exhibitB;
        return category !== null && !categories.has(category);
      });
  if (outside.length > 0) {
    const categories = [...new Set(outside.map((k) => getField(k)!.exhibitB))].join(', ');
    alerts.push({
      ...base,
      rule: 'contract_mismatch',
      severity: outside.some((k) => weightOf(k) >= 4) ? 'high' : 'medium',
      contractId: active.length === 1 ? active[0]!.id : undefined,
      fields: outside,
      message: `${appId} receives ${list(outside)}, but the contract does not authorize ${categories} in Exhibit B. Stop sharing these fields or amend the contract.`,
    });
  }

  // Coverage ends when the last active contract ends.
  if (active.every((c) => c.expiresOn !== undefined)) {
    const last = [...active].sort((a, b) => b.expiresOn!.localeCompare(a.expiresOn!))[0]!;
    const days = toDay(last.expiresOn!, last.id) - today;
    if (days <= (input.expiringWithinDays ?? 60)) {
      alerts.push({
        ...base,
        rule: 'contract_expiring',
        severity: 'info',
        contractId: last.id,
        fields: [],
        message: `Contract ${last.id} with ${vendorId} expires on ${last.expiresOn}, in ${days} days. Plan the renewal or the end of the flow.`,
      });
    }
  }
  return alerts;
}

/** Every alert for a district, most severe first, then by people affected. */
export function evaluateAlerts(input: AlertInput): Alert[] {
  const alerts: Alert[] = [];
  const byApp = new Map<string, ResolvedFlow[]>();
  for (const flow of input.flows) {
    alerts.push(...flowAlerts(flow, input.apps[flow.appId]));
    const group = byApp.get(flow.appId);
    if (group) group.push(flow);
    else byApp.set(flow.appId, [flow]);
  }
  for (const [appId, flows] of byApp) alerts.push(...contractAlerts(appId, flows, input));

  return alerts.sort(
    (a, b) =>
      SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) ||
      b.students + b.staff - (a.students + a.staff) ||
      a.appId.localeCompare(b.appId) ||
      ALERT_RULES.indexOf(a.rule) - ALERT_RULES.indexOf(b.rule),
  );
}
