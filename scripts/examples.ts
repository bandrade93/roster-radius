/**
 * The example results of the synthetic district: the district report and one
 * incident report, as saved documents. Written by `npm run synthetic` into
 * examples/synthetic-district/results/, and checked by a test so they never
 * drift from the code.
 */
import { analyzeFiles, generateSyntheticDistrict, incidentReport, readOneRosterFiles, serializeDocument } from '../packages/core/src/index.js';

export const RESULTS_FOLDER = 'results';

export async function buildExamples(): Promise<Record<string, string>> {
  const district = generateSyntheticDistrict();
  const { report, flows } = await analyzeFiles(district.files, { today: district.today });
  const roster = await readOneRosterFiles(Object.entries(district.files).filter(([p]) => p.startsWith('oneroster/')));
  const incident = incidentReport({ flows, roster, scope: { kind: 'vendor', vendorId: 'Acme Learning' }, notifiedOn: '2026-12-15', state: 'IL' });
  return {
    [`${RESULTS_FOLDER}/report.json`]: serializeDocument('district-report', report),
    [`${RESULTS_FOLDER}/incident-acme-il.json`]: serializeDocument('incident-report', incident),
  };
}
