import type { DistrictReport } from '@roster-radius/core';

/**
 * Messages between the page and the analysis worker (ADR 0002).
 *
 * The worker keeps the resolved flows, with student and staff identifiers, in
 * its own memory. Responses carry only reports, which hold no identifiers.
 */

/** A file the district loaded, with its path inside the folder it chose. */
export interface InputFile {
  readonly path: string;
  readonly content: Blob;
}

export type AnalysisRequest =
  | { readonly type: 'analyze'; readonly files: readonly InputFile[]; readonly today: string }
  | { readonly type: 'sample' };

export type AnalysisResult = { readonly ok: true; readonly report: DistrictReport } | { readonly ok: false; readonly error: string };

/** A request as sent to the worker, numbered so each answer finds its caller. */
export type WorkerRequest = AnalysisRequest & { readonly id: number };
export type WorkerResponse = AnalysisResult & { readonly id: number };
