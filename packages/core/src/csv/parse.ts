/**
 * A small CSV reader (RFC 4180): double quotes around values that contain the
 * separator, quotes or line breaks, and "" for a quote inside a quoted value.
 * Accepts LF and CRLF line endings and a UTF-8 byte order mark.
 *
 * The separator is detected from the header line: commas by default, or
 * semicolons or tabs when the header has more of those, as spreadsheet programs
 * in many countries save them. Rows that hold only separators, which
 * spreadsheet programs often leave at the end of a file, are skipped like
 * blank lines.
 *
 * `CsvParser` reads text in chunks, so large files (a district's users.csv)
 * can be streamed without holding them in memory. `parseCsv` reads a whole
 * string at once. Neither depends on Node.js, so the same code runs in the
 * browser and in the command line.
 */

export type CsvSeparator = ',' | ';' | '\t';

/** Picks the separator from a header line: the most frequent of comma, semicolon and tab, outside quotes; comma on a tie. */
export function detectSeparator(headerLine: string): CsvSeparator {
  const count: Record<CsvSeparator, number> = { ',': 0, ';': 0, '\t': 0 };
  let quoted = false;
  for (const ch of headerLine) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === ',' || ch === ';' || ch === '\t')) count[ch]++;
  }
  if (count[';'] > count[','] && count[';'] >= count['\t']) return ';';
  if (count['\t'] > count[','] && count['\t'] > count[';']) return '\t';
  return ',';
}

export interface CsvRecord {
  /** Line where the record starts, counting from 1. A quoted field can span several lines. */
  readonly line: number;
  readonly cells: readonly string[];
}

export class CsvError extends Error {
  constructor(
    readonly line: number,
    message: string,
  ) {
    super(`line ${line}: ${message}`);
  }
}

export class CsvParser {
  private cells: string[] = [];
  private cell = '';
  private line = 1;
  private start = 1;
  private quoted = false;
  private fieldStarted = false;
  /** A quote was seen inside a quoted value: the next character decides whether it is "" or the end of the value. */
  private quotePending = false;
  /** A carriage return was seen: a following \n belongs to it. */
  private crPending = false;
  private first = true;
  /** Text held until the header line is complete, to detect the separator. */
  private pending: string | undefined = '';
  private sep: CsvSeparator = ',';

  /**
   * @param separator a fixed separator, or 'auto' (default) to detect it from the header line.
   */
  constructor(
    private readonly onRecord: (record: CsvRecord) => void,
    private readonly separator: CsvSeparator | 'auto' = 'auto',
  ) {
    if (separator !== 'auto') {
      this.sep = separator;
      this.pending = undefined;
    }
  }

  /** The separator in use: the fixed one, or the one detected from the header line. */
  get detectedSeparator(): CsvSeparator {
    return this.sep;
  }

  /** Reads the next chunk of text. */
  push(chunk: string): void {
    let text = chunk;
    if (this.first && text.length > 0) {
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      this.first = false;
    }
    if (this.pending !== undefined) {
      this.pending += text;
      const nl = this.pending.search(/[\r\n]/);
      if (nl < 0) return;
      this.startWith(this.pending.slice(0, nl));
      text = this.pending;
      this.pending = undefined;
    }
    for (const ch of text) this.char(ch);
  }

  private startWith(headerLine: string): void {
    this.sep = detectSeparator(headerLine);
  }

  /** Ends the input. Throws CsvError if a quoted value was never closed. */
  end(): void {
    if (this.pending !== undefined) {
      const text = this.pending;
      this.pending = undefined;
      this.startWith(text);
      for (const ch of text) this.char(ch);
    }
    if (this.quotePending) {
      this.quotePending = false;
      this.quoted = false;
    }
    if (this.quoted) throw new CsvError(this.start, 'a quoted value is never closed');
    if (this.cell !== '' || this.cells.length > 0) this.endRecord();
  }

  private char(ch: string): void {
    if (this.crPending) {
      this.crPending = false;
      if (ch === '\n') return;
    }
    if (this.quotePending) {
      this.quotePending = false;
      if (ch === '"') {
        this.cell += '"';
        return;
      }
      this.quoted = false;
    }
    if (this.quoted) {
      if (ch === '"') this.quotePending = true;
      else {
        if (ch === '\n') this.line++;
        this.cell += ch;
      }
      return;
    }
    if (ch === '"') {
      if (this.fieldStarted && this.cell.trim() !== '') throw new CsvError(this.line, 'a quote appears in the middle of an unquoted value');
      this.quoted = true;
      this.fieldStarted = true;
      this.cell = '';
    } else if (ch === this.sep) {
      this.endCell();
    } else if (ch === '\n' || ch === '\r') {
      this.endRecord();
      this.line++;
      this.start = this.line;
      if (ch === '\r') this.crPending = true;
    } else {
      this.cell += ch;
      this.fieldStarted = true;
    }
  }

  private endCell(): void {
    this.cells.push(this.cell);
    this.cell = '';
    this.fieldStarted = false;
  }

  private endRecord(): void {
    this.endCell();
    // Blank lines, and rows that hold only separators, are skipped.
    if (this.cells.some((c) => c.trim() !== '')) this.onRecord({ line: this.start, cells: this.cells });
    this.cells = [];
  }
}

/** Reads a whole CSV text at once. */
export function parseCsv(text: string, separator: CsvSeparator | 'auto' = 'auto'): CsvRecord[] {
  return parseCsvWithSeparator(text, separator).records;
}

/** Reads a whole CSV text at once and says which separator was used. */
export function parseCsvWithSeparator(text: string, separator: CsvSeparator | 'auto' = 'auto'): { records: CsvRecord[]; separator: CsvSeparator } {
  const records: CsvRecord[] = [];
  const parser = new CsvParser((r) => records.push(r), separator);
  parser.push(text);
  parser.end();
  return { records, separator: parser.detectedSeparator };
}
