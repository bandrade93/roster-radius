import type { AnalysisIssue, DistrictReport, FlowSummary, InputFile } from '@roster-radius/core';
import { formatNumber, plural } from '../format/numbers';

export type FileStatus = 'read' | 'warning' | 'error' | 'unused';

export interface FileRow {
  readonly title: string;
  readonly detail: string;
  readonly status: FileStatus;
  readonly errors: number;
  readonly warnings: number;
}

const LABELS: Readonly<Record<string, string>> = { inventory: 'App inventory', contracts: 'Contracts', declared: 'Published list' };

/** How an issue's file is shown: the analysis names the inventory "inventory", a OneRoster file "oneroster/users.csv". */
export function fileLabel(file: string): string {
  return LABELS[file] ?? file;
}

const nameOf = (path: string) => path.split('/').pop() ?? path;
const isRosterIssue = (file: string, roster: readonly InputFile[]) => file.startsWith('oneroster/') || roster.some((f) => f.path === file);

function status(issues: readonly AnalysisIssue[], unused = false): Pick<FileRow, 'status' | 'errors' | 'warnings'> {
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.length - errors;

  return { status: errors > 0 ? 'error' : warnings > 0 ? 'warning' : unused ? 'unused' : 'read', errors, warnings };
}

function vendorFileDetail(path: string, flows: readonly FlowSummary[]): string | undefined {
  const fields = flows.filter((f) => f.fieldsFile === path);
  const people = flows.filter((f) => f.students.path === path || f.staff.path === path);
  const parts: string[] = [];

  if (fields.length > 0) parts.push(`Columns read as the fields ${fields.map((f) => f.app).join(', ')} receives, reported as measured.`);

  for (const f of people) {
    const who = f.students.path === path ? f.students : f.staff;
    const population = f.students.path === path ? 'students' : 'staff';
    const id = who.idColumn ? `, identified by ${who.idColumn}` : ', with no ID column, so only counted';
    parts.push(`The ${population} ${f.app} reaches: ${formatNumber(who.count)}${id}.`);
  }

  return parts.length > 0 ? parts.join(' ') : undefined;
}

/** One row per file or group of files the analysis read, with what was found in it. */
export function describeFiles(report: DistrictReport): FileRow[] {
  const { inputs, issues, totals } = report;
  const roster = inputs.filter((f) => f.role === 'oneroster');
  const rows: FileRow[] = [];
  const issuesOf = (test: (file: string) => boolean) => issues.filter((i) => test(i.file));

  rows.push({
    title: 'OneRoster export',
    detail: `${roster.map((f) => nameOf(f.path)).join(', ')} · ${plural(totals.schools, 'school')}, ${plural(totals.students, 'student')}, ${formatNumber(totals.staff)} staff.`,
    ...status(issuesOf((file) => isRosterIssue(file, roster))),
  });

  rows.push({
    title: 'App inventory',
    detail: `${plural(totals.apps, 'app')} from ${plural(totals.vendors, 'vendor')}, ${plural(report.flows.length, 'row')} read.`,
    ...status(issuesOf((file) => file === 'inventory')),
  });

  if (inputs.some((f) => f.role === 'contracts')) {
    const agreements = report.contracts.filter((c) => !c.id.startsWith('inventory line')).length;
    rows.push({ title: 'Contracts', detail: `${plural(agreements, 'agreement')}.`, ...status(issuesOf((file) => file === 'contracts')) });
  }

  if (inputs.some((f) => f.role === 'declared')) {
    rows.push({ title: 'Published list', detail: `${plural(report.declarations.length, 'entry', 'entries')}.`, ...status(issuesOf((file) => file === 'declared')) });
  }

  for (const file of inputs.filter((f) => f.role === 'vendor_file')) {
    const detail = vendorFileDetail(file.path, report.flows);
    rows.push({ title: file.path, detail: detail ?? 'Not named in the inventory, so not used.', ...status(issuesOf((f) => f === file.path), detail === undefined) });
  }

  return rows;
}

/** Errors first, then by file and line. */
export function sortIssues(issues: readonly AnalysisIssue[]): AnalysisIssue[] {
  return [...issues].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1) || a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0));
}

/** Plain sentences on how the people of each inventory row were found. */
export function matchingNotes(flows: readonly FlowSummary[]): string[] {
  const notes: string[] = [];
  const fromRoster = flows.filter((f) => f.students.kind === 'roster' || f.staff.kind === 'roster');

  if (fromRoster.length > 0) notes.push(`${plural(fromRoster.length, 'row')} take their people from the OneRoster export directly, by school, grade and role.`);

  for (const f of flows) {
    for (const [who, population] of [[f.students, 'students'], [f.staff, 'staff']] as const) {
      if (who.kind === 'file') {
        const listed = who.count;
        const matched = listed - (who.unmatched ?? 0);
        const via = who.matchedBy === 'identifier' ? 'its identifier column (your district IDs)' : 'its sourcedId';
        const extra = who.unmatched ? ` ${formatNumber(who.unmatched)} were not found and are counted apart, so some ${population} may be counted twice.` : '';
        notes.push(`${f.app}: ${formatNumber(matched)} of ${formatNumber(listed)} ${population} in ${who.path} matched the OneRoster export through ${via}.${extra}`);
      }

      if (who.kind === 'count') {
        const origin = who.source === 'entered' ? 'a number typed in the inventory' : `a file with no ID column (${who.path})`;
        notes.push(`${f.app}: ${formatNumber(who.count)} ${population} come from ${origin}, so they cannot be matched. Results that include them are given as ranges.`);
      }
    }
  }

  return notes;
}

/** No result is possible: the roster gave nobody, or no inventory row could be read. */
export function isFatal(report: DistrictReport): boolean {
  return report.flows.length === 0 || (report.totals.students === 0 && report.totals.staff === 0);
}

/**
 * Whether the results can be shown (TASKS 1.5.4.4). They are blocked while any
 * file has an error, unless the district chose to see them anyway, knowing
 * they are incomplete. Warnings never block them.
 */
export function resultsAccess(report: DistrictReport, acceptedIncomplete: boolean): 'open' | 'needs-confirmation' | 'blocked' {
  if (isFatal(report)) return 'blocked';
  if (report.completeness.complete || acceptedIncomplete) return 'open';

  return 'needs-confirmation';
}
