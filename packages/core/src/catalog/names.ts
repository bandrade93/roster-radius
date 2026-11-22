import { FIELDS, type FieldKey } from './fields.js';
import { EXHIBIT_B_CATEGORIES, type ExhibitBCategory } from './types.js';

/**
 * Lookups by name for files the district writes by hand: a field by its key or
 * label, and an Exhibit B category by its name, without regard to case, spaces
 * or punctuation for categories.
 */

const FIELD_BY_NAME = new Map<string, FieldKey>();
for (const f of FIELDS) {
  FIELD_BY_NAME.set(f.key.toLowerCase(), f.key);
  FIELD_BY_NAME.set(f.label.toLowerCase(), f.key);
}

const loose = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const CATEGORY_BY_NAME = new Map<string, ExhibitBCategory>(EXHIBIT_B_CATEGORIES.map((c) => [loose(c), c]));

/** A field by its catalog key (`student.birth_date`) or label (`Date of birth`), case-insensitive. */
export function fieldByName(name: string): FieldKey | undefined {
  return FIELD_BY_NAME.get(name.trim().toLowerCase());
}

/** An Exhibit B category by name, ignoring case, spaces and punctuation. */
export function exhibitBCategoryByName(name: string): ExhibitBCategory | undefined {
  return CATEGORY_BY_NAME.get(loose(name));
}
