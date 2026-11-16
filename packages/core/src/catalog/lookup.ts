import { FIELDS, type FieldKey } from './fields.js';
import type { FieldDefinition, Source, Subject } from './types.js';

/**
 * Normalizes a column name so that different spellings of the same column
 * match: lowercase, trimmed, and spaces, hyphens and underscores collapsed into
 * one underscore. Dots are kept because they separate file and column
 * (`students.DOB`) or API path segments (`roles.student.dob`).
 *
 * `students.Ell status`, `students.ell_status` and `STUDENTS.ELL-STATUS`
 * all become `students.ell_status`.
 */
export function normalizeColumnName(name: string): string {
  return name.trim().toLowerCase().replace(/[\s_-]+/g, '_');
}

function indexKey(source: Source, subject: Subject, column: string): string {
  return `${source}|${subject}|${normalizeColumnName(column)}`;
}

const byAlias = new Map<string, FieldKey>();
const byKey = new Map<string, FieldDefinition>();

for (const field of FIELDS as readonly FieldDefinition[]) {
  byKey.set(field.key, field);
  for (const [source, aliases] of Object.entries(field.aliases) as [Source, readonly string[]][]) {
    for (const alias of aliases) {
      byAlias.set(indexKey(source, field.subject, alias), field.key as FieldKey);
    }
  }
}

/**
 * Finds the catalog key for a column of a source file.
 *
 * The subject is required because some formats reuse a column for different
 * people: in OneRoster, `users.givenName` is a student's name or a teacher's
 * name depending on the row's role.
 *
 * Returns `undefined` for unknown columns, which callers report for review
 * instead of dropping (ADR 0001).
 */
export function findFieldKey(source: Source, subject: Subject, column: string): FieldKey | undefined {
  return byAlias.get(indexKey(source, subject, column));
}

/** Returns the catalog entry for a key, or `undefined` if the key does not exist. */
export function getField(key: string): FieldDefinition | undefined {
  return byKey.get(key);
}
