import { describe, expect, it } from 'vitest';
import {
  FIELDS,
  SENSITIVITY_CLASSES,
  exposureByVendor,
  incidentImpact,
  incidentScenarios,
  type FieldKey,
  type ResolvedFlow,
} from '../src/index.js';

// Cross-checks the formula against a naive reference on random districts.
// Seeded, so a failure is reproducible.
function rng(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

const ALL = FIELDS.map((f) => f.key) as FieldKey[];
const weight = (k: FieldKey): number => SENSITIVITY_CLASSES[FIELDS.find((f) => f.key === k)!.sensitivity].weight;

function randomDistrict(rand: () => number, withCounts: boolean): ResolvedFlow[] {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
  const people = (prefix: string, max: number): Set<string> => {
    const s = new Set<string>();
    const n = Math.floor(rand() * max);
    for (let i = 0; i < n; i++) s.add(`${prefix}${Math.floor(rand() * max)}`);
    return s;
  };
  return Array.from({ length: 1 + Math.floor(rand() * 8) }, (_, i) => {
    const fields = ALL.filter(() => rand() < 0.15);
    const students = withCounts && rand() < 0.3 ? { count: Math.floor(rand() * 50) } : people('s', 60);
    return {
      appId: `app${i}`,
      vendorId: pick(['v1', 'v2', 'v3']),
      channel: pick(['clever', 'sftp', 'classlink']),
      fields,
      students,
      ...(rand() < 0.7 ? { staff: people('t', 20) } : {}),
    };
  });
}

/** Naive reference: build every person's field set, then add up. */
function reference(flows: ResolvedFlow[], prefixes: string[], scopeOf: (f: ResolvedFlow) => unknown) {
  const byPerson = new Map<string, Set<FieldKey>>();
  for (const f of flows) {
    const scope = scopeOf(f);
    if (!(scope instanceof Set)) continue;
    const own = f.fields.filter((k) => prefixes.some((p) => k.startsWith(p)));
    if (own.length === 0) continue;
    for (const id of scope as Set<string>) {
      const set = byPerson.get(id) ?? new Set<FieldKey>();
      own.forEach((k) => set.add(k));
      byPerson.set(id, set);
    }
  }
  let points = 0;
  for (const set of byPerson.values()) for (const k of set) points += weight(k);
  return { people: byPerson.size, points, ids: new Set(byPerson.keys()) };
}

describe('formula matches a naive reference on random districts', () => {
  it('exact case: people, points and IDs for every vendor and channel', () => {
    const rand = rng(42);
    for (let run = 0; run < 300; run++) {
      const flows = randomDistrict(rand, false);
      for (const v of exposureByVendor(flows)) {
        const ref = reference(flows.filter((f) => f.vendorId === v.id), ['student.', 'guardian.'], (f) => f.students);
        expect(v.people).toEqual({ min: ref.people, max: ref.people, exact: true });
        expect(v.points.max).toBe(ref.points);
      }
      for (const s of incidentScenarios(flows)) {
        const hit = flows.filter((f) =>
          s.scope.kind === 'vendor' ? f.vendorId === s.scope.vendorId : s.scope.kind === 'channel' && f.channel === s.scope.channel,
        );
        const stu = reference(hit, ['student.', 'guardian.'], (f) => f.students);
        const stf = reference(hit, ['staff.'], (f) => f.staff);
        expect(s.students.points.max).toBe(stu.points);
        expect(s.staff.points.max).toBe(stf.points);
        expect([...s.studentIds].sort()).toEqual([...stu.ids].sort());
        expect([...s.staffIds].sort()).toEqual([...stf.ids].sort());
      }
    }
  });

  it('count-only flows: the range is ordered and never below what the IDs prove', () => {
    const rand = rng(7);
    for (let run = 0; run < 300; run++) {
      const flows = randomDistrict(rand, true);
      for (const v of exposureByVendor(flows)) {
        expect(v.people.min).toBeLessThanOrEqual(v.people.max);
        expect(v.points.min).toBeLessThanOrEqual(v.points.max);
        // The true value is unknown, but the part with IDs is a floor.
        const known = reference(flows.filter((f) => f.vendorId === v.id), ['student.', 'guardian.'], (f) => f.students);
        expect(v.people.min).toBeGreaterThanOrEqual(known.people);
        expect(v.points.min).toBeGreaterThanOrEqual(known.points);
      }
    }
  });

  it('removing any field never raises a score', () => {
    const rand = rng(99);
    for (let run = 0; run < 100; run++) {
      const flows = randomDistrict(rand, true);
      const before = new Map(exposureByVendor(flows).map((v) => [v.id, v.points.max]));
      const i = Math.floor(rand() * flows.length);
      const flow = flows[i]!;
      if (flow.fields.length === 0) continue;
      const trimmed = flows.map((f, j) => (j === i ? { ...f, fields: f.fields.slice(1) } : f));
      for (const v of exposureByVendor(trimmed)) expect(v.points.max).toBeLessThanOrEqual(before.get(v.id)!);
    }
  });

  it('a vendor breach equals the vendor exposure', () => {
    const rand = rng(3);
    for (let run = 0; run < 100; run++) {
      const flows = randomDistrict(rand, true);
      for (const v of exposureByVendor(flows)) {
        expect(incidentImpact(flows, { kind: 'vendor', vendorId: v.id }).students.points).toEqual(v.points);
      }
    }
  });
});
