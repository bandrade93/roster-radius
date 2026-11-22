import type { TextSource } from '../oneroster/read.js';
import { Sha256 } from './sha256.js';

/**
 * An input file of an analysis, identified by its hash, so a report can be
 * tied to the exact files it was computed from.
 *
 * The hash is of the file's bytes when the reader has them (inside a OneRoster
 * zip), and otherwise of its text encoded as UTF-8. For a UTF-8 file without a
 * byte order mark both are the same, and match `sha256sum` or
 * `Get-FileHash -Algorithm SHA256`. A caller that reads the bytes itself, such
 * as the command line tool, can pass hashes of the bytes instead.
 */
export interface InputFile {
  /** The path as given, with forward slashes. */
  readonly path: string;
  readonly role: 'inventory' | 'contracts' | 'declared' | 'oneroster' | 'vendor_file';
  readonly sha256: string;
  /** Size of what was hashed, in bytes. */
  readonly bytes: number;
}

/** Hashes a source while it is read, and calls `done` once it was read to the end. */
export function hashing(source: TextSource, done: (sha256: string, bytes: number) => void): TextSource {
  if (typeof source === 'string') {
    const h = new Sha256().update(source);
    done(h.hex(), h.bytes);
    return source;
  }
  const finish = (h: Sha256) => done(h.hex(), h.bytes);
  if (Symbol.asyncIterator in source) {
    const inner = source as AsyncIterable<string>;
    return {
      async *[Symbol.asyncIterator]() {
        const h = new Sha256();
        for await (const chunk of inner) {
          h.update(chunk);
          yield chunk;
        }
        finish(h);
      },
    };
  }
  const inner = source as Iterable<string>;
  return {
    *[Symbol.iterator]() {
      const h = new Sha256();
      for (const chunk of inner) {
        h.update(chunk);
        yield chunk;
      }
      finish(h);
    },
  };
}
