import { DECLARED_COLUMNS, inputRole, parseCsv, REQUIRED_COLUMNS } from '@roster-radius/core';
import { relativePaths } from '../paths';
import type { LoadedFile } from '../worker/protocol';

/** The groups of files the load screen asks for. */
export type Slot = 'oneroster' | 'inventory' | 'contracts' | 'declared' | 'vendorFiles';

/** A file with the path it will have in the analysis, relative to the district's folder. */
export interface DistrictFile extends LoadedFile {
  readonly slot: Slot;
  /** The name the district sees. */
  readonly name: string;
}

export interface FileSet {
  readonly files: readonly DistrictFile[];
  /** Files left out because they are not CSV or zip. */
  readonly ignored: readonly string[];
}

export const EMPTY: FileSet = { files: [], ignored: [] };

const ONEROSTER_NAMES = new Set(['manifest.csv', 'orgs.csv', 'users.csv']);
const nameOf = (path: string) => path.split('/').pop() ?? path;
const folderOf = (path: string) => path.split('/').slice(0, -1).join('/');
const isUsable = (path: string) => /\.(csv|zip)$/i.test(path);

/** A file from a folder or a drop, with its path relative to the folder the district chose. */
export interface PickedFile {
  readonly path: string;
  readonly content: File;
}

type TableKind = 'inventory' | 'contracts' | 'declared';

/** What a CSV is, from its header row, for files whose names say nothing. */
export function kindFromHeader(header: string): TableKind | undefined {
  const line = header.replace(/^\uFEFF/, '').split(/\r?\n/)[0] ?? '';
  const columns = new Set((parseCsv(line)[0]?.cells ?? []).map((c) => c.trim().toLowerCase()));
  const has = (names: readonly string[]) => names.every((n) => columns.has(n));

  if (has(REQUIRED_COLUMNS)) return 'inventory';
  if (has(['contract_id', 'vendor'])) return 'contracts';
  if (has(['vendor']) && !columns.has('app') && !columns.has('contract_id') && DECLARED_COLUMNS.some((c) => c !== 'vendor' && c !== 'notes' && columns.has(c))) return 'declared';

  return undefined;
}

const PATHS: Record<TableKind, string> = { inventory: 'inventory.csv', contracts: 'contracts.csv', declared: 'declared.csv' };

/**
 * Sorts the files of a whole folder into slots, by their names and places.
 * A CSV whose name says nothing is recognized by its header row, so an
 * inventory saved as "Apps 2026.csv" still goes to its place.
 */
export async function fromFolder(picked: readonly PickedFile[]): Promise<FileSet> {
  const paths = relativePaths(picked.map((f) => f.path));
  const all = picked.map((f, i) => ({ path: paths[i]!, content: f.content }));
  const usable = all.filter((f) => isUsable(f.path));
  const rosterFolders = new Set(usable.filter((f) => ONEROSTER_NAMES.has(nameOf(f.path).toLowerCase())).map((f) => folderOf(f.path)));
  const named = new Set(usable.map((f) => inputRole(f.path)));

  const files: DistrictFile[] = [];
  for (const f of usable) {
    const role = inputRole(f.path);
    if (role !== 'vendor_file') {
      files.push({ slot: role, path: f.path, name: f.path, content: f.content });
      continue;
    }

    const folder = folderOf(f.path);
    if (folder !== '' && rosterFolders.has(folder)) {
      files.push({ slot: 'oneroster', path: f.path, name: f.path, content: f.content });
      continue;
    }

    const kind = f.path.toLowerCase().endsWith('.csv') ? kindFromHeader(await f.content.slice(0, 4096).text()) : undefined;
    if (kind && !named.has(kind)) {
      named.add(kind);
      files.push({ slot: kind, path: PATHS[kind], name: f.path, content: f.content });
      continue;
    }

    files.push({ slot: 'vendorFiles', path: f.path, name: f.path, content: f.content });
  }

  return { files, ignored: all.filter((f) => !isUsable(f.path)).map((f) => f.path) };
}

/** The path a file chosen for one slot will have, whatever its name on disk. */
export function pathFor(slot: Slot, file: File): string {
  switch (slot) {
    case 'inventory':
      return 'inventory.csv';
    case 'contracts':
      return 'contracts.csv';
    case 'declared':
      return 'declared.csv';
    case 'oneroster':
      return /\.zip$/i.test(file.name) ? file.name : `oneroster/${file.name}`;
    case 'vendorFiles':
      return file.name;
  }
}

/** Files chosen for one slot. The inventory, contracts and published list hold one file each. */
export function forSlot(slot: Slot, chosen: readonly File[]): DistrictFile[] {
  const files = slot === 'oneroster' || slot === 'vendorFiles' ? chosen : chosen.slice(0, 1);

  return files.map((file) => ({ slot, path: pathFor(slot, file), name: file.name, content: file }));
}

/** Adds files; a file with the same path replaces the earlier one. */
export function merge(set: FileSet, added: FileSet): FileSet {
  const paths = new Set(added.files.map((f) => f.path));

  return { files: [...set.files.filter((f) => !paths.has(f.path)), ...added.files], ignored: [...set.ignored, ...added.ignored] };
}

export function withoutSlot(set: FileSet, slot: Slot): FileSet {
  return { ...set, files: set.files.filter((f) => f.slot !== slot) };
}

/** What is still missing before the analysis can run. */
export function missing(set: FileSet): string[] {
  const has = (slot: Slot) => set.files.some((f) => f.slot === slot);
  const out: string[] = [];

  if (!has('inventory')) out.push('the app inventory');
  if (!has('oneroster')) out.push('the OneRoster export');

  return out;
}

/** Today as YYYY-MM-DD, in the computer's own time zone. */
export function localToday(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
