import { getField, SENSITIVITY_CLASSES, SEVERITIES, type DisclosureKind, type DistrictReport, type ExposureResult, type FieldKey, type Population, type Range, type Severity } from '@roster-radius/core';
import { channelLabel } from '../format/labels';

export interface VendorRow {
  readonly vendorId: string;
  readonly apps: readonly string[];
  readonly channels: readonly string[];
  readonly people: Range;
  readonly points: number;
  /** Share of the highest score in the table, from 0 to 1, for the bar. */
  readonly share: number;
  readonly topClass: string | undefined;
  /** The most sensitive fields received, by weight. */
  readonly topFields: readonly string[];
}

const unique = (values: Iterable<string>) => [...new Set(values)];

export function fieldLabel(key: FieldKey): string {
  return getField(key)?.label ?? key;
}

/** The fields of a result, most heavily weighted first. */
export function mostSensitive(result: ExposureResult, weights: DistrictReport['weights'], count = 3): string[] {
  const weightOf = (k: FieldKey) => weights[getField(k)?.sensitivity ?? 'organizational'];

  return [...result.fields]
    .sort((a, b) => weightOf(b) - weightOf(a) || fieldLabel(a).localeCompare(fieldLabel(b)))
    .slice(0, count)
    .map(fieldLabel);
}

/** One row per vendor that receives data about this population, highest exposure first. */
export function vendorRows(report: DistrictReport, population: Population): VendorRow[] {
  const results = report[population].byVendor.filter((v) => v.people.max > 0);
  const top = Math.max(1, ...results.map((v) => v.points.max));

  return results.map((v) => {
    const flows = report.flows.filter((f) => f.vendor === v.id && (population === 'students' ? f.students.kind !== 'none' : f.staff.kind !== 'none'));

    return {
      vendorId: v.id,
      apps: unique(flows.map((f) => f.app)),
      channels: unique(flows.map((f) => channelLabel(f.channel))),
      people: v.people,
      points: v.points.max,
      share: v.points.max / top,
      topClass: v.topClass ? SENSITIVITY_CLASSES[v.topClass].label : undefined,
      topFields: mostSensitive(v, report.weights),
    };
  });
}

/**
 * Shared fields, most students first. Many fields reach every student, so ties
 * show the most sensitive first: a district reads meal eligibility before grade level.
 */
export function sharedFieldsBySensitivity(report: DistrictReport): DistrictReport['sharedFields'] {
  const weightOf = (k: FieldKey) => report.weights[getField(k)?.sensitivity ?? 'organizational'];

  return [...report.sharedFields].sort((a, b) => b.students.max - a.students.max || weightOf(b.field) - weightOf(a.field) || fieldLabel(a.field).localeCompare(fieldLabel(b.field)));
}

export function alertCounts(report: DistrictReport): { readonly severity: Severity; readonly count: number }[] {
  return SEVERITIES.map((severity) => ({ severity, count: report.alerts.filter((a) => a.severity === severity).length })).filter((c) => c.count > 0);
}

/** True when the report used the methodology's own weights. */
export function usesDefaultWeights(report: DistrictReport): boolean {
  return Object.entries(report.weights).every(([c, w]) => SENSITIVITY_CLASSES[c as keyof typeof SENSITIVITY_CLASSES].weight === w);
}

export interface DisclosureSummary {
  readonly receiving: number;
  readonly disclosed: number;
  readonly counts: Readonly<Record<DisclosureKind, number>>;
}

export function disclosureSummary(report: DistrictReport): DisclosureSummary | undefined {
  const d = report.disclosure;
  if (!d) return undefined;

  const counts = { undisclosed_vendor: 0, undisclosed_app: 0, undisclosed_data: 0, no_longer_receives: 0 };
  for (const f of d.findings) counts[f.kind] += 1;

  return { receiving: d.vendorsReceiving, disclosed: d.vendorsDisclosed, counts };
}
