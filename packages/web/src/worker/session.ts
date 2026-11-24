import { analyzeFiles, generateSyntheticDistrict, type DistrictAnalysis } from '@roster-radius/core';
import type { AnalysisRequest, AnalysisResult } from './protocol';

/**
 * What the worker does, kept apart from the worker itself so it can be tested
 * without a browser.
 *
 * The last analysis, with its identifiers, stays here. Incident reports,
 * reduction simulations and the notification list will be answered from it
 * (task 1.5.4); the page never receives the flows.
 */
export class AnalysisSession {
  private current: DistrictAnalysis | undefined;

  /** True once an analysis was run, so later requests can use its flows. */
  get hasAnalysis(): boolean {
    return this.current !== undefined;
  }

  async handle(request: AnalysisRequest): Promise<AnalysisResult> {
    try {
      switch (request.type) {
        case 'sample': {
          const district = generateSyntheticDistrict();
          return this.keep(await analyzeFiles(district.files, { today: district.today }));
        }
        case 'analyze': {
          const files: Record<string, string> = {};
          for (const f of request.files) files[f.path] = await f.content.text();
          return this.keep(await analyzeFiles(files, { today: request.today }));
        }
      }
    } catch (e) {
      this.current = undefined;
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  private keep(analysis: DistrictAnalysis): AnalysisResult {
    this.current = analysis;
    return { ok: true, report: analysis.report };
  }
}
