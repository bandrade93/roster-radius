import {
  analyzeFiles,
  generateSyntheticDistrict,
  incidentReport,
  notificationCsv,
  completenessOf,
  readOneRosterFiles,
  simulateReduction,
  type DistrictAnalysis,
  type Roster,
} from '@roster-radius/core';
import { readFiles } from './files';
import type { AnalysisRequest, Answer, RequestType } from './protocol';

interface Current {
  readonly analysis: DistrictAnalysis;
  readonly roster: Roster;
}

/**
 * What the worker does, kept apart from the worker itself so it can be tested
 * without a browser. The last analysis, with its identifiers, stays here.
 */
export class AnalysisSession {
  private current: Current | undefined;

  get hasAnalysis(): boolean {
    return this.current !== undefined;
  }

  async handle<R extends AnalysisRequest>(request: R): Promise<Answer<R['type']>> {
    try {
      return (await this.answer(request)) as Answer<R['type']>;
    } catch (e) {
      if (request.type === 'sample' || request.type === 'analyze') this.current = undefined;

      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  private async answer(request: AnalysisRequest): Promise<Answer<RequestType>> {
    switch (request.type) {
      case 'sample': {
        const district = generateSyntheticDistrict();
        const roster = await readOneRosterFiles(Object.entries(district.files).filter(([p]) => p.startsWith('oneroster/')));
        const analysis = await analyzeFiles(district.files, { today: district.today, roster });
        this.current = { analysis, roster };

        return { ok: true, report: analysis.report };
      }

      case 'analyze': {
        const read = await readFiles(request.files);
        const analysis = await analyzeFiles(read.texts, { today: request.today, inputs: read.inputs, ...(read.roster ? { roster: read.roster } : {}) });
        const issues = [...read.issues, ...analysis.report.issues];
        const report = read.issues.length > 0 ? { ...analysis.report, issues, completeness: completenessOf(issues) } : analysis.report;
        this.current = { analysis: { ...analysis, report }, roster: read.roster! };

        return { ok: true, report };
      }

      case 'incident': {
        const { analysis, roster } = this.require();
        const incident = incidentReport({ flows: analysis.flows, roster, scope: request.scope, notifiedOn: request.notifiedOn, ...(request.state ? { state: request.state } : {}) });

        return { ok: true, incident };
      }

      case 'notification': {
        const { analysis, roster } = this.require();

        return { ok: true, csv: notificationCsv({ flows: analysis.flows, roster, scope: request.scope }) };
      }

      case 'reduce': {
        const { analysis } = this.require();
        const { totals } = analysis.report;
        const reduction = simulateReduction({ flows: analysis.flows, cuts: request.cuts, maxStudents: totals.students, maxStaff: totals.staff });

        return { ok: true, reduction };
      }
    }
  }

  private require(): Current {
    if (!this.current) throw new Error('Run an analysis first.');

    return this.current;
  }
}
