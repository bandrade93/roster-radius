import { describe, expect, it } from 'vitest';
import { CsvError, CsvParser, detectSeparator, parseCsv, parseCsvWithSeparator, type CsvRecord } from '../src/index.js';

describe('csv reader', () => {
  it('reads plain rows, CRLF endings and a byte order mark', () => {
    expect(parseCsv('﻿a,b\r\n1,2\r\n')).toEqual([
      { line: 1, cells: ['a', 'b'] },
      { line: 2, cells: ['1', '2'] },
    ]);
  });

  it('reads quoted values with commas, quotes and line breaks, keeping the start line', () => {
    const records = parseCsv('a,b\n"x, y","say ""hi"""\n"two\nlines",z\nlast,row');
    expect(records[1]?.cells).toEqual(['x, y', 'say "hi"']);
    expect(records[2]).toEqual({ line: 3, cells: ['two\nlines', 'z'] });
    expect(records[3]?.line).toBe(5);
  });

  it('skips blank lines and keeps empty cells', () => {
    expect(parseCsv('a,b\n\n1,\n')).toEqual([
      { line: 1, cells: ['a', 'b'] },
      { line: 3, cells: ['1', ''] },
    ]);
  });

  it('reports an unclosed quote with its line', () => {
    expect(() => parseCsv('a\n"open')).toThrow(CsvError);
    try {
      parseCsv('a\n"open');
    } catch (e) {
      expect((e as CsvError).line).toBe(2);
    }
  });

  it('skips rows that hold only separators, as spreadsheet programs leave them', () => {
    expect(parseCsv('a,b\n1,2\n,\n , \n')).toEqual([
      { line: 1, cells: ['a', 'b'] },
      { line: 2, cells: ['1', '2'] },
    ]);
  });

  it('detects semicolons and tabs from the header line, outside quotes', () => {
    expect(detectSeparator('a;b;c')).toBe(';');
    expect(detectSeparator('a\tb\tc')).toBe('\t');
    expect(detectSeparator('"x;y",b')).toBe(',');
    expect(parseCsvWithSeparator('a;b\n"1;5";2\n')).toEqual({ records: [{ line: 1, cells: ['a', 'b'] }, { line: 2, cells: ['1;5', '2'] }], separator: ';' });
  });

  it('detects the separator even when the header line arrives in pieces', () => {
    const records: CsvRecord[] = [];
    const parser = new CsvParser((r) => records.push(r));
    for (const piece of ['ap', 'p;ven', 'dor\nX;', 'Y\n']) parser.push(piece);
    parser.end();
    expect(parser.detectedSeparator).toBe(';');
    expect(records[1]?.cells).toEqual(['X', 'Y']);
  });
});
