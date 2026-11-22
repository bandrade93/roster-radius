import { exposureWithIds, type ExposureResult, type ResolvedFlow, type WeightOverrides } from './formula.js';

/**
 * Incident scenarios, v0.1.
 *
 * An incident scenario asks: if this part of the data flow were breached, who
 * would be affected and with which data? It applies the exposure formula to
 * the flows inside the breached scope, for students and staff separately.
 *
 * Three scopes:
 * - vendor: the vendor's systems are breached. Everything it received, from
 *   all of its apps and channels, is exposed.
 * - app: only the data of one app is exposed.
 * - channel: the channel itself is breached, for example the rostering
 *   platform or the district's SFTP account. Every vendor that receives data
 *   through that channel is affected.
 *
 * The scenario is the worst case: it assumes every field received inside the
 * scope was taken. It covers only data the district sends. It does not know
 * when data was deleted (flows have no dates in v0.1) and does not follow data
 * to the vendor's subprocessors.
 */

export type IncidentScope =
  | { readonly kind: 'vendor'; readonly vendorId: string }
  | { readonly kind: 'app'; readonly appId: string }
  | { readonly kind: 'channel'; readonly channel: string };

export interface IncidentImpact {
  readonly scope: IncidentScope;
  /** Stable ID of the scenario, such as "vendor:acme" or "channel:clever". */
  readonly id: string;
  readonly vendors: readonly string[];
  readonly apps: readonly string[];
  readonly channels: readonly string[];
  readonly students: ExposureResult;
  readonly staff: ExposureResult;
  /**
   * IDs of the affected people, to prepare notifications. Only people reached
   * through flows with IDs are listed, so the list is complete only when the
   * matching result is exact. Kept in memory and never stored.
   */
  readonly studentIds: ReadonlySet<string>;
  readonly staffIds: ReadonlySet<string>;
}

export interface IncidentOptions {
  readonly weights?: WeightOverrides;
  /** Enrollment and staff size, when known: ranges never go beyond them. */
  readonly maxStudents?: number;
  readonly maxStaff?: number;
}

function scopeId(scope: IncidentScope): string {
  switch (scope.kind) {
    case 'vendor':
      return `vendor:${scope.vendorId}`;
    case 'app':
      return `app:${scope.appId}`;
    case 'channel':
      return `channel:${scope.channel}`;
  }
}

function inScope(flow: ResolvedFlow, scope: IncidentScope): boolean {
  switch (scope.kind) {
    case 'vendor':
      return flow.vendorId === scope.vendorId;
    case 'app':
      return flow.appId === scope.appId;
    case 'channel':
      return flow.channel === scope.channel;
  }
}

/** The flows inside a breached scope. */
export function flowsInScope(flows: readonly ResolvedFlow[], scope: IncidentScope): ResolvedFlow[] {
  return flows.filter((f) => inScope(f, scope));
}

const distinct = (values: Iterable<string>): string[] => [...new Set(values)].sort((a, b) => a.localeCompare(b));

/** Who would be affected, and with which data, if this scope were breached. */
export function incidentImpact(
  flows: readonly ResolvedFlow[],
  scope: IncidentScope,
  options: IncidentOptions = {},
): IncidentImpact {
  const id = scopeId(scope);
  const hit = flows.filter((f) => inScope(f, scope));
  const common = options.weights ? { weights: options.weights } : {};
  const students = exposureWithIds(id, hit, { ...common, population: 'students', ...(options.maxStudents !== undefined ? { maxPeople: options.maxStudents } : {}) });
  const staff = exposureWithIds(id, hit, { ...common, population: 'staff', ...(options.maxStaff !== undefined ? { maxPeople: options.maxStaff } : {}) });
  return {
    scope,
    id,
    vendors: distinct(hit.map((f) => f.vendorId)),
    apps: distinct(hit.map((f) => f.appId)),
    channels: distinct(hit.map((f) => f.channel)),
    students: students.result,
    staff: staff.result,
    studentIds: students.ids,
    staffIds: staff.ids,
  };
}

/**
 * Every vendor and every channel as an incident scenario, worst first: by
 * student exposure, then staff exposure. Answers "which single breach would
 * hurt our students the most?".
 */
export function incidentScenarios(flows: readonly ResolvedFlow[], options: IncidentOptions = {}): IncidentImpact[] {
  const scopes: IncidentScope[] = [
    ...distinct(flows.map((f) => f.vendorId)).map((vendorId) => ({ kind: 'vendor' as const, vendorId })),
    ...distinct(flows.map((f) => f.channel)).map((channel) => ({ kind: 'channel' as const, channel })),
  ];
  return scopes
    .map((scope) => incidentImpact(flows, scope, options))
    .sort(
      (a, b) =>
        b.students.points.max - a.students.points.max ||
        b.staff.points.max - a.staff.points.max ||
        a.id.localeCompare(b.id),
    );
}
