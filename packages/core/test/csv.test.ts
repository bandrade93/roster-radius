import { describe, expect, it } from 'vitest';
import { CsvError, parseCsv } from '../src/index.js';

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
});
