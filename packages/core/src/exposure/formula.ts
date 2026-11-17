import { getField, type FieldKey } from '../catalog/index.js';
import { SENSITIVITY_CLASSES, type SensitivityClass } from '../catalog/sensitivity.js';

/**
 * Exposure formula, v0.1.
 *
 * For a vendor (or one app), every person is counted once. Their data is the
 * union of the fields received through all channels, and their exposure is
 * the sum of the weights of those fields:
 *
 *   Exposure(v) = sum over people i of sum over fields f in F_v(i) of w(f)
 *
 * - Counting each person once avoids double counting someone who reaches the
 *   same vendor through two channels or two apps.
 * - Summing weights means every field adds harm, so removing any field lowers
 *   the score. That is what makes reduction simulations meaningful.
 *
 * Students and staff are two separate populations, calculated separately and
 * never added together: the harm and the people to notify are different.
 * - Students: fields about students and their guardians. A guardian's phone is
 *   part of the student's record and is counted once per student.
 * - Staff: fields about staff (teachers, administrators, other employees).
 * School and section fields describe organizations and are never counted.
 *
 * The score is for ranking. Reports lead with the plain-language counts
 * (`peopleByClass`), which do not depend on the weights.
 */

export type Population = 'students' | 'staff';

/** People reached by a flow: their IDs (read in memory, never stored) or only a count. */
export type PeopleScope = ReadonlySet<string> | { readonly count: number };

/** One flow: an app receives these fields, for these people, through one channel. */
export interface ResolvedFlow {
  readonly appId: string;
  readonly vendorId: string;
  readonly channel: string;
  readonly fields: readonly FieldKey[];
  /** Students reached. Omit when the flow carries no student records. */
  readonly students?: PeopleScope;
  /** Staff reached. Omit when the flow carries no staff records. */
  readonly staff?: PeopleScope;
}

/** Replaces the default weight of some classes; reports must state the weights used. */
export type WeightOverrides = Readonly<Partial<Record<SensitivityClass, number>>>;

/**
 * A value that may be known only as a range. When every flow carries IDs,
 * `min` equals `max` and `exact` is true. Flows with only a count cannot be
 * deduplicated, so the result is a range between full overlap and no overlap.
 */
export interface Range {
  readonly min: number;
  readonly max: number;
  readonly exact: boolean;
}

export interface ExposureResult {
  /** App or vendor ID. */
  readonly id: string;
  readonly population: Population;
  /** Distinct people whose data reaches this app or vendor. */
  readonly people: Range;
  /** Exposure score: sum of field weights over distinct people. */
  readonly points: Range;
  /** For each sensitivity class, people with at least one field of that class exposed. */
  readonly peopleByClass: Readonly<Record<SensitivityClass, Range>>;
  /** Union of counted fields, sorted. */
  readonly fields: readonly FieldKey[];
  /** Fields received but not counted for this population, sorted. */
  readonly ignoredFields: readonly FieldKey[];
  /** The most sensitive class exposed (ties: first in SENSITIVITY_CLASSES), or null when none. */
  readonly topClass: SensitivityClass | null;
  /**
   * Flows that carry fields of this population but do not say which people
   * they reach. They are left out of the totals, so a non-zero value means the
   * result is incomplete and the report must say so.
   */
  readonly flowsWithoutScope: number;
}

export interface ExposureOptions {
  /** Default: students. */
  readonly population?: Population;
  readonly weights?: WeightOverrides;
}

const CLASSES = Object.keys(SENSITIVITY_CLASSES) as SensitivityClass[];

const PREFIXES: Record<Population, readonly string[]> = {
  students: ['student.', 'guardian.'],
  staff: ['staff.'],
};

/** The weight of each class after applying overrides. */
export function resolveWeights(overrides: WeightOverrides = {}): Record<SensitivityClass, number> {
  const weights = {} as Record<SensitivityClass, number>;
  for (const c of CLASSES) {
    const w = overrides[c] ?? SENSITIVITY_CLASSES[c].weight;
    if (!Number.isFinite(w) || w < 0) throw new RangeError(`Invalid weight for ${c}: ${w}`);
    weights[c] = w;
  }
  return weights;
}

function classOf(key: FieldKey): SensitivityClass {
  const field = getField(key);
  if (!field) throw new Error(`Unknown field: ${key}`);
  return field.sensitivity;
}

function isIdSet(scope: PeopleScope): scope is ReadonlySet<string> {
  return scope instanceof Set;
}

function exact(n: number): Range {
  return { min: n, max: n, exact: true };
}

function computeGroup(
  id: string,
  flows: readonly ResolvedFlow[],
  population: Population,
  weights: Record<SensitivityClass, number>,
): { result: ExposureResult; ids: ReadonlySet<string> } {
  const isCounted = (key: FieldKey): boolean => PREFIXES[population].some((p) => key.startsWith(p));
  const scopeOf = (flow: ResolvedFlow): PeopleScope | undefined =>
    population === 'students' ? flow.students : flow.staff;
  const weightOf = (keys: Iterable<FieldKey>): number => {
    let sum = 0;
    for (const k of keys) if (isCounted(k)) sum += weights[classOf(k)];
    return sum;
  };
  const hasClass = (keys: Iterable<FieldKey>, c: SensitivityClass): boolean => {
    for (const k of keys) if (isCounted(k) && classOf(k) === c) return true;
    return false;
  };

  const counted = new Set<FieldKey>();
  const ignored = new Set<FieldKey>();
  let flowsWithoutScope = 0;
  const fieldsByPerson = new Map<string, Set<FieldKey>>();
  const countFlows: { count: number; fields: readonly FieldKey[] }[] = [];

  for (const flow of flows) {
    const own = flow.fields.filter(isCounted);
    for (const key of flow.fields) if (!isCounted(key)) ignored.add(key);
    if (own.length === 0) continue;
    const scope = scopeOf(flow);
    if (!scope) {
      flowsWithoutScope += 1;
      continue;
    }
    for (const key of own) counted.add(key);
    if (isIdSet(scope)) {
      // Exact part: merge fields per person.
      for (const person of scope) {
        let set = fieldsByPerson.get(person);
        if (!set) fieldsByPerson.set(person, (set = new Set()));
        for (const k of own) set.add(k);
      }
    } else if (scope.count > 0) {
      countFlows.push({ count: scope.count, fields: own });
    }
  }

  let exactPoints = 0;
  const exactByClass = Object.fromEntries(CLASSES.map((c) => [c, 0])) as Record<SensitivityClass, number>;
  for (const set of fieldsByPerson.values()) {
    exactPoints += weightOf(set);
    for (const c of CLASSES) if (hasClass(set, c)) exactByClass[c] += 1;
  }

  // Count-only part: bounds between full overlap (min) and no overlap (max).
  const isExact = countFlows.length === 0;
  const range = (exactValue: number, perFlow: number[]): Range =>
    isExact
      ? exact(exactValue)
      : {
          min: Math.max(exactValue, ...perFlow),
          max: exactValue + perFlow.reduce((a, b) => a + b, 0),
          exact: false,
        };

  const people = range(
    fieldsByPerson.size,
    countFlows.map((f) => f.count),
  );
  const points = range(
    exactPoints,
    countFlows.map((f) => f.count * weightOf(f.fields)),
  );
  const peopleByClass = Object.fromEntries(
    CLASSES.map((c) => [c, range(exactByClass[c], countFlows.map((f) => (hasClass(f.fields, c) ? f.count : 0)))]),
  ) as Record<SensitivityClass, Range>;

  // Highest weight wins; ties go to the class listed first in SENSITIVITY_CLASSES.
  let topClass: SensitivityClass | null = null;
  for (const c of CLASSES) {
    if (!hasClass(counted, c)) continue;
    if (topClass === null || weights[c] > weights[topClass]) topClass = c;
  }

  const result: ExposureResult = {
    id,
    population,
    people,
    points,
    peopleByClass,
    fields: [...counted].sort((a, b) => a.localeCompare(b)),
    ignoredFields: [...ignored].sort((a, b) => a.localeCompare(b)),
    topClass,
    flowsWithoutScope,
  };
  return { result, ids: new Set(fieldsByPerson.keys()) };
}

/**
 * Exposure of one group of flows, with the IDs of the people reached through
 * flows that carry IDs. Internal: used by incident scenarios, not exported by
 * the package, because ranking reports must not carry IDs.
 */
export function exposureWithIds(
  id: string,
  flows: readonly ResolvedFlow[],
  options: ExposureOptions = {},
): { result: ExposureResult; ids: ReadonlySet<string> } {
  return computeGroup(id, flows, options.population ?? 'students', resolveWeights(options.weights));
}

function byGroup(flows: readonly ResolvedFlow[], keyOf: (f: ResolvedFlow) => string, options: ExposureOptions): ExposureResult[] {
  const population = options.population ?? 'students';
  const weights = resolveWeights(options.weights);
  const groups = new Map<string, ResolvedFlow[]>();
  for (const flow of flows) {
    const key = keyOf(flow);
    const list = groups.get(key);
    if (list) list.push(flow);
    else groups.set(key, [flow]);
  }
  return [...groups.entries()]
    .map(([id, group]) => computeGroup(id, group, population, weights).result)
    .sort((a, b) => b.points.max - a.points.max || a.id.localeCompare(b.id));
}

/** Exposure of each app, highest first. */
export function exposureByApp(flows: readonly ResolvedFlow[], options: ExposureOptions = {}): ExposureResult[] {
  return byGroup(flows, (f) => f.appId, options);
}

/** Exposure of each vendor, across all of its apps and channels, highest first. */
export function exposureByVendor(flows: readonly ResolvedFlow[], options: ExposureOptions = {}): ExposureResult[] {
  return byGroup(flows, (f) => f.vendorId, options);
}
