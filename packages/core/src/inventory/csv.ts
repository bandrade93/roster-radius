/**
 * A small CSV reader (RFC 4180): commas between fields, double quotes around
 * fields that contain commas, quotes or line breaks, and "" for a quote inside
 * a quoted field. Accepts LF and CRLF line endings and a UTF-8 byte order mark.
 *
 * `CsvParser` reads text in chunks, so large files (a district's users.csv)
 * can be streamed without holding them in memory. `parseCsv` reads a whole
 * string at once. Neither depends on Node.js, so the same code runs in the
 * browser and in the command line.
 */

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

  constructor(private readonly onRecord: (record: CsvRecord) => void) {}

  /** Reads the next chunk of text. */
  push(chunk: string): void {
    let text = chunk;
    if (this.first && text.length > 0) {
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      this.first = false;
    }
    for (const ch of text) this.char(ch);
  }

  /** Ends the input. Throws CsvError if a quoted value was never closed. */
  end(): void {
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
    } else if (ch === ',') {
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
    // Blank lines are skipped.
    if (!(this.cells.length === 1 && this.cells[0] === '')) this.onRecord({ line: this.start, cells: this.cells });
    this.cells = [];
  }
}

/** Reads a whole CSV text at once. */
export function parseCsv(text: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  const parser = new CsvParser((r) => records.push(r));
  parser.push(text);
  parser.end();
  return records;
}
