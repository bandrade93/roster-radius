import type { AppCategory } from '../baselines/index.js';
import type { FieldKey } from '../catalog/index.js';

/**
 * App inventory format, v0.1. Specified in docs/formats/inventory.md.
 *
 * One row is one flow: one app receiving data through one channel. Parsing and
 * validation are separate (see the inventory reader); these types describe a
 * row once it has been read.
 */

/** Columns, in the order used by the template. */
export const INVENTORY_COLUMNS = [
  'app',
  'vendor',
  'channel',
  'fields',
  'category',
  'channel_id',
  'students',
  'staff',
  'schools',
  'grades',
  'contract_end',
  'deletion_days',
  'notes',
] as const;
export type InventoryColumn = (typeof INVENTORY_COLUMNS)[number];

export const REQUIRED_COLUMNS = ['app', 'vendor', 'channel', 'fields'] as const satisfies readonly InventoryColumn[];

/** Separator for lists inside a cell. */
export const LIST_SEPARATOR = '|';

export const CHANNEL_TYPES = ['clever', 'classlink', 'sftp', 'oneroster', 'manual_upload', 'sso', 'other'] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

/** Channels with one instance per district; the others default to one instance per vendor. */
export const SHARED_CHANNELS: readonly ChannelType[] = ['clever', 'classlink'];

/** OneRoster grade codes accepted in the `grades` column. */
export const GRADE_CODES = ['PK', 'KG', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'] as const;
export type GradeCode = (typeof GRADE_CODES)[number];

/** Who a flow reaches, as written in the `students` or `staff` column. */
export type PeopleSpec =
  | { readonly kind: 'all' }
  | { readonly kind: 'teachers' }
  | { readonly kind: 'none' }
  | { readonly kind: 'count'; readonly count: number }
  | { readonly kind: 'file'; readonly path: string };

/** Where the field list came from: typed into the inventory, or read from the header of a file. */
export type FieldSource = { readonly kind: 'entered' } | { readonly kind: 'file'; readonly path: string };

/** One inventory row, after reading and validation. */
export interface InventoryRow {
  /** Line number in the file, counting the header as line 1, for error messages and traceability. */
  readonly line: number;
  readonly app: string;
  readonly vendor: string;
  readonly channel: ChannelType;
  /** The channel instance; defaults per `defaultChannelId`. */
  readonly channelId: string;
  readonly fields: readonly FieldKey[];
  readonly fieldSource: FieldSource;
  /** Undefined when the district did not classify the app. */
  readonly category?: AppCategory;
  readonly students: PeopleSpec;
  readonly staff: PeopleSpec;
  /** School names or OneRoster sourcedIds; empty means every school. */
  readonly schools: readonly string[];
  /** Empty means every grade. */
  readonly grades: readonly GradeCode[];
  /** Last day of the agreement, as YYYY-MM-DD. */
  readonly contractEnd?: string;
  readonly deletionDays?: number;
  readonly notes?: string;
}

/** The channel instance used when `channel_id` is empty. */
export function defaultChannelId(channel: ChannelType, vendor: string): string {
  return SHARED_CHANNELS.includes(channel) ? channel : `${channel}:${vendor}`;
}

/**
 * Normalizes a grade to a OneRoster code: "K" and "kg" become KG, "1" becomes
 * 01. Returns undefined for anything outside PK, KG and 01 to 12.
 */
export function normalizeGrade(value: string): GradeCode | undefined {
  const v = value.trim().toUpperCase();
  if (v === 'K') return 'KG';
  if (/^\d{1,2}$/.test(v)) {
    const n = Number(v);
    if (n >= 1 && n <= 12) return String(n).padStart(2, '0') as GradeCode;
  }
  return (GRADE_CODES as readonly string[]).includes(v) ? (v as GradeCode) : undefined;
}
