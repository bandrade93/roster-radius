import { inputRole, readOneRosterFiles, readOneRosterZip, Sha256, type AnalysisIssue, type InputFile, type Roster } from '@roster-radius/core';
import { relativePaths } from '../paths';
import type { LoadedFile } from './protocol';

export { relativePaths };

/** The district's files, read as the analysis needs them. */
export interface ReadFiles {
  /** Text files by path, relative to the folder the district chose. */
  readonly texts: Record<string, string>;
  /** The roster, when it came as a zip. */
  readonly roster?: Roster;
  /** Hash of each file's bytes, as loaded. */
  readonly inputs: readonly InputFile[];
  readonly issues: readonly AnalysisIssue[];
}

const utf8 = new TextDecoder('utf-8', { fatal: true });
const windows1252 = new TextDecoder('windows-1252');

/**
 * Text from bytes. Files are expected in UTF-8; spreadsheets saved on Windows
 * are often in Windows-1252, which is read instead, with a note.
 */
export function decode(bytes: Uint8Array): { readonly text: string; readonly encoding: 'utf-8' | 'windows-1252' } {
  try {
    return { text: utf8.decode(bytes), encoding: 'utf-8' };
  } catch {
    return { text: windows1252.decode(bytes), encoding: 'windows-1252' };
  }
}

const isZip = (path: string) => path.toLowerCase().endsWith('.zip');

/** How the analysis names a file in its issues: inventory, contracts, declared, oneroster/<file>, or the path. */
export function issueFile(path: string): string {
  const role = inputRole(path);
  if (role === 'vendor_file') return path;
  if (role === 'oneroster') return isZip(path) ? path : `oneroster/${(path.split('/').pop() ?? path).toLowerCase()}`;

  return role;
}

export async function readFiles(files: readonly LoadedFile[]): Promise<ReadFiles> {
  const paths = relativePaths(files.map((f) => f.path));
  const texts: Record<string, string> = {};
  const inputs: InputFile[] = [];
  const issues: AnalysisIssue[] = [];
  let roster: Roster | undefined;

  for (const [i, file] of files.entries()) {
    const path = paths[i]!;
    const bytes = new Uint8Array(await file.content.arrayBuffer());
    const hash = new Sha256().update(bytes);
    inputs.push({ path, role: inputRole(path), sha256: hash.hex(), bytes: hash.bytes });

    if (isZip(path)) {
      if (roster) issues.push({ severity: 'warning', file: issueFile(path), message: 'More than one zip was loaded; only the first is read as the OneRoster export.' });
      else roster = await readOneRosterZip(bytes);
      continue;
    }

    const { text, encoding } = decode(bytes);
    texts[path] = text;

    if (encoding === 'windows-1252') {
      issues.push({ severity: 'warning', file: issueFile(path), message: 'The file is not in UTF-8, so it was read as Windows-1252. Check that accented letters look right, or save it again as "CSV UTF-8".' });
    }
  }

  if (!roster) {
    const oneroster = Object.entries(texts).filter(([p]) => inputRole(p) === 'oneroster');
    roster = await readOneRosterFiles(oneroster);
  }

  return { texts, roster, inputs, issues };
}
