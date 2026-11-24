import type { Cut, DistrictReport, IncidentReport, IncidentScope, ReductionResult, StateCode } from '@roster-radius/core';

/**
 * Messages between the page and the analysis worker (ADR 0002).
 *
 * The worker keeps the resolved flows, with student and staff identifiers, in
 * its own memory. Answers carry reports, which hold no identifiers. The one
 * exception is the notification list, which the district asks for on purpose
 * to reach the people affected: the page only turns it into a download.
 */

/** A file the district loaded, with its path inside the folder it chose. */
export interface LoadedFile {
  readonly path: string;
  readonly content: Blob;
}

interface Exchanges {
  readonly sample: { readonly request: object; readonly answer: { readonly report: DistrictReport } };
  readonly analyze: {
    readonly request: { readonly files: readonly LoadedFile[]; readonly today: string };
    readonly answer: { readonly report: DistrictReport };
  };
  readonly incident: {
    readonly request: { readonly scope: IncidentScope; readonly notifiedOn: string; readonly state?: StateCode };
    readonly answer: { readonly incident: IncidentReport };
  };
  readonly notification: { readonly request: { readonly scope: IncidentScope }; readonly answer: { readonly csv: string } };
  readonly reduce: { readonly request: { readonly cuts: readonly Cut[] }; readonly answer: { readonly reduction: ReductionResult } };
}

export type RequestType = keyof Exchanges;

export type AnalysisRequest = { [K in RequestType]: { readonly type: K } & Exchanges[K]['request'] }[RequestType];

export type Answer<K extends RequestType> = ({ readonly ok: true } & Exchanges[K]['answer']) | { readonly ok: false; readonly error: string };

/** A request as sent to the worker, numbered so each answer finds its caller. */
export type WorkerRequest = AnalysisRequest & { readonly id: number };
export type WorkerResponse = Answer<RequestType> & { readonly id: number };
