import type { PickedFile } from './districtFiles';

const fileOf = (entry: FileSystemFileEntry) => new Promise<File>((resolve, reject) => entry.file(resolve, reject));

async function entriesOf(directory: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const reader = directory.createReader();
  const all: FileSystemEntry[] = [];

  // readEntries returns the entries in batches until it returns none.
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (batch.length === 0) return all;
    all.push(...batch);
  }
}

async function walk(entry: FileSystemEntry, prefix: string, out: PickedFile[]): Promise<void> {
  const path = prefix ? `${prefix}/${entry.name}` : entry.name;

  if (entry.isFile) {
    out.push({ path, content: await fileOf(entry as FileSystemFileEntry) });
    return;
  }

  for (const child of await entriesOf(entry as FileSystemDirectoryEntry)) await walk(child, path, out);
}

/** The files dropped on the page, with their paths, including the contents of dropped folders. */
export async function filesFromDrop(data: DataTransfer): Promise<PickedFile[]> {
  const entries = [...data.items].map((item) => item.webkitGetAsEntry()).filter((e): e is FileSystemEntry => e !== null);
  if (entries.length === 0) return [...data.files].map((file) => ({ path: file.name, content: file }));

  const out: PickedFile[] = [];
  for (const entry of entries) await walk(entry, '', out);

  return out;
}

/** The files of a folder chosen with a folder picker. */
export function filesFromFolderInput(list: FileList): PickedFile[] {
  return [...list].map((file) => ({ path: file.webkitRelativePath || file.name, content: file }));
}
