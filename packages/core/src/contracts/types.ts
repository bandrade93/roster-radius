import type { ExhibitBCategory, FieldKey } from '../catalog/index.js';

/** The kind of agreement, for the report. */
export const AGREEMENT_TYPES = ['ndpa', 'state_dpa', 'vendor_terms', 'other'] as const;
export type AgreementType = (typeof AGREEMENT_TYPES)[number];

/**
 * A data privacy agreement as recorded by the district. Specified in
 * docs/formats/contracts.md.
 *
 * What the contract allows is the union of the Exhibit B categories it
 * authorizes and the individual fields it lists. When neither was recorded
 * (only dates are known), the field comparison is skipped instead of flagging
 * every field.
 */
export interface Contract {
  readonly id: string;
  readonly vendorId: string;
  /** Apps covered. Omit when the contract covers every app of the vendor. */
  readonly appIds?: readonly string[];
  /** Exhibit B categories authorized as a whole. */
  readonly exhibitB?: readonly ExhibitBCategory[];
  /** Individual fields authorized, for agreements that check single data elements. */
  readonly fields?: readonly FieldKey[];
  /** Last day the contract is in force, as YYYY-MM-DD. Omit when it has no end date. */
  readonly expiresOn?: string;
  /** Days after the end of the agreement by which the vendor must delete the data. */
  readonly deletionDays?: number;
  readonly agreement?: AgreementType;
  /** Where the agreement can be found, such as a link to the SDPC registry. */
  readonly source?: string;
  /** Line in the contracts file, for traceability. */
  readonly line?: number;
}

/** True when the contract records what it allows (categories or fields). */
export function recordsAllowedData(contract: Contract): boolean {
  return contract.exhibitB !== undefined || contract.fields !== undefined;
}
