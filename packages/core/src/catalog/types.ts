/**
 * Types for the field catalog.
 *
 * The catalog lists every piece of personal data RosterRadius knows how to
 * recognize, gives each one a stable key, and records the names the same data
 * goes by in each source format.
 */

import type { SensitivityClass } from './sensitivity.js';

/** Whose data the field describes. */
export const SUBJECTS = ['student', 'guardian', 'staff', 'school', 'section'] as const;
export type Subject = (typeof SUBJECTS)[number];

/**
 * Student data categories of Exhibit B ("Schedule of Data") of the National
 * Data Privacy Agreement (NDPA) published by the Student Data Privacy
 * Consortium. Contracts list allowed data by these categories, so every
 * student-related field maps to one of them.
 */
export const EXHIBIT_B_CATEGORIES = [
  'Application Technology Meta Data',
  'Application Use Statistics',
  'Assessment',
  'Attendance',
  'Communications',
  'Conduct',
  'Demographics',
  'Enrollment',
  'Parent/Guardian Contact Information',
  'Parent/Guardian ID',
  'Parent/Guardian Name',
  'Schedule',
  'Special Indicator',
  'Student Contact Information',
  'Student Identifiers',
  'Student In App Performance',
  'Student Name',
  'Student Program Membership',
  'Student Survey Responses',
  'Student Work',
  'Transcript',
  'Transportation',
] as const;
export type ExhibitBCategory = (typeof EXHIBIT_B_CATEGORIES)[number];

/**
 * Source formats whose column names the catalog knows.
 *
 * - `oneroster`: OneRoster 1.1 CSV binding, written as `file.column`
 *   (for example `demographics.birthDate`).
 * - `cleverCsv`: Clever's CSV vocabulary, written as `file.Column name`
 *   (for example `students.DOB`). Taken from Clever's SFTP upload
 *   specification v2.1.1; we assume the "Application Receives" downloads use
 *   the same names until a real export confirms it (ADR 0001).
 * - `cleverApi`: Clever Data API v3.x user fields (for example
 *   `roles.student.dob`). Only fields confirmed in Clever's public docs.
 */
export const SOURCES = ['oneroster', 'cleverCsv', 'cleverApi'] as const;
export type Source = (typeof SOURCES)[number];

export interface FieldDefinition {
  /**
   * Stable identifier: `<subject>.<field>`, lowercase, snake_case.
   * Never renamed once published: results are compared over time by key.
   */
  readonly key: string;
  readonly subject: Subject;
  /** Short English label for reports. */
  readonly label: string;
  /** How much harm exposing this field can cause; see `SENSITIVITY_CLASSES`. */
  readonly sensitivity: SensitivityClass;
  /**
   * NDPA Exhibit B category for student-related data.
   * `null` for staff data and for data that describes classes rather than
   * students, which Exhibit B does not cover.
   */
  readonly exhibitB: ExhibitBCategory | null;
  /**
   * Column names in each source. Matching is case-insensitive and treats
   * spaces, hyphens and underscores as the same (see `normalizeColumnName`).
   * A field may have no aliases: it can still be declared by hand in the
   * inventory (for example assessment results).
   */
  readonly aliases: Readonly<Partial<Record<Source, readonly string[]>>>;
  /** Why a mapping was chosen, when it is a judgment call. */
  readonly note?: string;
}
