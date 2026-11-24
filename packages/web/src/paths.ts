/**
 * Paths relative to the folder the district chose. A folder picker gives
 * "district/inventory.csv"; the folder name is removed when every file has it.
 */
export function relativePaths(paths: readonly string[]): string[] {
  const normalized = paths.map((p) => p.replace(/\\/g, '/').replace(/^\/+/, ''));
  const first = normalized[0]?.split('/')[0];
  const shared = first !== undefined && normalized.length > 0 && normalized.every((p) => p.includes('/') && p.split('/')[0] === first);

  return shared ? normalized.map((p) => p.slice(first.length + 1)) : normalized;
}
