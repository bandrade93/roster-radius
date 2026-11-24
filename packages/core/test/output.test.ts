import { describe, expect, it } from 'vitest';
import { analyzeFiles, canRead, CORE_VERSION, DocumentError, FORMAT_VERSION, generateSyntheticDistrict, parseDocument, serializeDocument } from '../src/index.js';
import { buildExamples } from '../../../scripts/examples.js';
import pkg from '../package.json?raw';
import exampleReport from '../../../examples/synthetic-district/results/report.json?raw';
import exampleIncident from '../../../examples/synthetic-district/results/incident-acme-il.json?raw';

const lf = (s: string): string => s.replace(/\r\n/g, '\n');

describe('saved documents', async () => {
  const district = generateSyntheticDistrict();
  const { report } = await analyzeFiles(district.files, { today: district.today });

  it('wraps a report in an envelope with the format, kind and versions', () => {
    const doc = JSON.parse(serializeDocument('district-report', report));
    expect(doc).toMatchObject({ format: 'rosterradius', kind: 'district-report', formatVersion: FORMAT_VERSION, generator: { name: '@roster-radius/core', version: CORE_VERSION } });
    expect(doc.generatedAt).toBeUndefined();
    expect(doc.data.methodologyVersion).toBe('0.1');
  });

  it('is reproducible, unless a generation time is asked for', () => {
    expect(serializeDocument('district-report', report)).toBe(serializeDocument('district-report', report));
    const timed = JSON.parse(serializeDocument('district-report', report, { generatedAt: new Date('2026-11-21T12:00:00Z') }));
    expect(timed.generatedAt).toBe('2026-11-21T12:00:00.000Z');
  });

  it('reads back what it writes', () => {
    const text = serializeDocument('district-report', report, { indent: 0 });
    expect(text.split('\n')).toHaveLength(2);
    expect(parseDocument(text, 'district-report').data).toEqual(report);
    expect(parseDocument(`﻿${text}`).kind).toBe('district-report');
  });

  it('refuses files it cannot read, with a plain message', () => {
    const doc = JSON.parse(serializeDocument('district-report', report));
    const as = (change: object) => JSON.stringify({ ...doc, ...change });
    expect(() => parseDocument('{nope')).toThrow('not valid JSON');
    expect(() => parseDocument('{"name":"x"}')).toThrow('not a RosterRadius document');
    expect(() => parseDocument(as({ kind: 'roster' }))).toThrow('Unknown document kind');
    expect(() => parseDocument(as({}), 'incident-report')).toThrow('Expected a incident-report, but the file is a district-report');
    expect(() => parseDocument(as({ formatVersion: '9.0.0' }))).toThrow('a newer version');
    expect(() => parseDocument(as({ formatVersion: 'one' }))).toThrow('no valid format version');
    expect(() => parseDocument(as({ data: { ...doc.data, totals: undefined } }))).toThrow('missing totals');
    expect(() => parseDocument(as({ data: [] }))).toThrow(DocumentError);
  });

  it('follows semantic versioning, with 0.x minors treated as breaking', () => {
    expect(canRead('0.1.0', '0.1.3')).toBe(true);
    expect(canRead('0.1.5', '0.1.0')).toBe(true);
    expect(canRead('0.2.0', '0.1.0')).toBe(false);
    expect(canRead('1.4.0', '1.0.0')).toBe(true);
    expect(canRead('2.0.0', '1.9.0')).toBe(false);
    expect(canRead('1.0', '1.0.0')).toBe(false);
  });

  it('states the package version from package.json', () => {
    expect(CORE_VERSION).toBe(JSON.parse(pkg).version);
  });

  it('the example results match the code (run `npm run synthetic` after a change)', async () => {
    const examples = await buildExamples();
    expect(lf(exampleReport)).toBe(examples['results/report.json']);
    expect(lf(exampleIncident)).toBe(examples['results/incident-acme-il.json']);
    expect(parseDocument(lf(exampleIncident), 'incident-report').data.deadlines.length).toBeGreaterThan(0);
  });
});
