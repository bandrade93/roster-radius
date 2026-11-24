import type { DistrictReport } from '../analyze/district.js';
import type { IncidentReport } from '../incident/report.js';
import { CORE_VERSION, FORMAT_VERSION } from '../version.js';

/**
 * Saved documents, v0.1 (task 1.5.1). Specified in docs/formats/report.md.
 *
 * A district report or an incident report is saved as one JSON document with
 * an envelope that says what it is and which version of the format it uses,
 * so that any later version of the tool, or another program, can read it or
 * refuse it with a clear message.
 *
 * Documents hold no student or staff identifier: the reports they wrap never
 * do. They are deterministic: the same inputs give the same bytes, unless a
 * generation time is added.
 */

export const DOCUMENT_FORMAT = 'rosterradius';

export interface DocumentKinds {
  readonly 'district-report': DistrictReport;
  readonly 'incident-report': IncidentReport;
}
export type DocumentKind = keyof DocumentKinds;
export const DOCUMENT_KINDS: readonly DocumentKind[] = ['district-report', 'incident-report'];

export interface RosterRadiusDocument<K extends DocumentKind = DocumentKind> {
  readonly format: typeof DOCUMENT_FORMAT;
  readonly kind: K;
  readonly formatVersion: string;
  readonly generator: { readonly name: string; readonly version: string };
  /** When the document was written, as an ISO 8601 time. Omitted unless asked for, so documents are reproducible. */
  readonly generatedAt?: string;
  readonly data: DocumentKinds[K];
}

export interface SerializeOptions {
  /** Adds the generation time. Leave it out for reproducible documents. */
  readonly generatedAt?: Date | string;
  /** Indentation; default 2. Use 0 for the smallest file. */
  readonly indent?: number;
}

/** Wraps a report in a document. */
export function toDocument<K extends DocumentKind>(kind: K, data: DocumentKinds[K], options: SerializeOptions = {}): RosterRadiusDocument<K> {
  const at = options.generatedAt;
  return {
    format: DOCUMENT_FORMAT,
    kind,
    formatVersion: FORMAT_VERSION,
    generator: { name: '@roster-radius/core', version: CORE_VERSION },
    ...(at !== undefined ? { generatedAt: typeof at === 'string' ? at : at.toISOString() } : {}),
    data,
  };
}

/** A report as a JSON document, ending with a newline. */
export function serializeDocument<K extends DocumentKind>(kind: K, data: DocumentKinds[K], options: SerializeOptions = {}): string {
  return `${JSON.stringify(toDocument(kind, data, options), null, options.indent ?? 2)}\n`;
}

export class DocumentError extends Error {
  override readonly name = 'DocumentError';
}

const parseVersion = (v: string): [number, number, number] | undefined => {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : undefined;
};

/**
 * True when a reader of `current` can read a document of `version`: same
 * major, and, while the major is 0, same minor. A newer minor (1.x) adds
 * fields this reader ignores; an older one lacks fields added since.
 */
export function canRead(version: string, current: string = FORMAT_VERSION): boolean {
  const a = parseVersion(version);
  const b = parseVersion(current);
  if (!a || !b) return false;
  return a[0] === b[0] && (a[0] !== 0 || a[1] === b[1]);
}

/** Fields every document of each kind must have, checked when reading. */
const REQUIRED: Record<DocumentKind, readonly string[]> = {
  'district-report': ['methodologyVersion', 'today', 'weights', 'inputs', 'totals', 'flows', 'students', 'staff', 'alerts', 'scenarios', 'issues'],
  'incident-report': ['methodologyVersion', 'weights', 'id', 'scope', 'notifiedOn', 'students', 'staff', 'deadlines', 'findings', 'disclaimer'],
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Reads a saved document. Throws a DocumentError with a plain message when the
 * text is not a RosterRadius document, is of another kind than expected, or
 * uses a format version this reader cannot read. It checks the envelope and
 * the report's main fields, not every value.
 */
export function parseDocument<K extends DocumentKind>(text: string, expected?: K): RosterRadiusDocument<K> {
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    throw new DocumentError('The file is not valid JSON.');
  }
  if (!isObject(value) || value.format !== DOCUMENT_FORMAT) throw new DocumentError('The file is not a RosterRadius document.');
  const kind = value.kind;
  if (typeof kind !== 'string' || !(DOCUMENT_KINDS as readonly string[]).includes(kind)) throw new DocumentError(`Unknown document kind: ${String(kind)}.`);
  if (expected !== undefined && kind !== expected) throw new DocumentError(`Expected a ${expected}, but the file is a ${kind}.`);
  const version = value.formatVersion;
  if (typeof version !== 'string' || !parseVersion(version)) throw new DocumentError('The document has no valid format version.');
  if (!canRead(version)) {
    const [a, b] = [parseVersion(version)!, parseVersion(FORMAT_VERSION)!];
    const older = a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
    const which = older < 0 ? 'an older' : 'a newer';
    throw new DocumentError(`The document uses format ${version}, ${which} version than this tool reads (${FORMAT_VERSION}). Open it with a matching version of RosterRadius, or recreate it from the input files.`);
  }
  if (!isObject(value.data)) throw new DocumentError('The document has no data.');
  const missing = REQUIRED[kind as DocumentKind].filter((k) => !(k in (value.data as object)));
  if (missing.length > 0) throw new DocumentError(`The document is incomplete: missing ${missing.join(', ')}.`);
  return value as unknown as RosterRadiusDocument<K>;
}
