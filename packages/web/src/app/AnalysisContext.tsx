import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { DistrictReport, StateCode } from '@roster-radius/core';
import type { AnalysisClient } from '../worker/client';

interface AnalysisState {
  readonly client: AnalysisClient;
  /** The current report, or undefined before any analysis. It never holds student identifiers. */
  readonly report: DistrictReport | undefined;
  /** Replaces the report. A new report starts without the choice to see incomplete results. */
  readonly setReport: (report: DistrictReport | undefined) => void;
  /** The district chose to see results that leave out rows with errors. */
  readonly acceptedIncomplete: boolean;
  readonly acceptIncomplete: () => void;
  /** The district's state, for deadlines and state rules. Undefined means federal rules only. */
  readonly stateCode: StateCode | undefined;
  readonly setStateCode: (state: StateCode | undefined) => void;
}

const AnalysisContext = createContext<AnalysisState | undefined>(undefined);

export function AnalysisProvider({ client, children }: { readonly client: AnalysisClient; readonly children: ReactNode }) {
  const [report, setReportState] = useState<DistrictReport>();
  const [acceptedIncomplete, setAcceptedIncomplete] = useState(false);
  const [stateCode, setStateCode] = useState<StateCode>();

  const value = useMemo(() => {
    const setReport = (next: DistrictReport | undefined) => {
      setReportState(next);
      setAcceptedIncomplete(false);
    };

    return { client, report, setReport, acceptedIncomplete, acceptIncomplete: () => setAcceptedIncomplete(true), stateCode, setStateCode };
  }, [client, report, acceptedIncomplete, stateCode]);

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}

export function useAnalysis(): AnalysisState {
  const state = useContext(AnalysisContext);
  if (!state) throw new Error('useAnalysis must be used inside AnalysisProvider.');

  return state;
}

/** The report, for screens that are only reachable once one exists. */
export function useReport(): DistrictReport {
  const { report } = useAnalysis();
  if (!report) throw new Error('No report yet.');

  return report;
}
