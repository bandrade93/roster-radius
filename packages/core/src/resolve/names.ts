import type { Contract } from '../contracts/types.js';
import { suggest } from '../csv/index.js';
import type { Declaration } from '../declared/read.js';
import type { InventoryRow } from '../inventory/types.js';

/**
 * Checks that contracts and the declared list name vendors and apps the way
 * the inventory does. A misspelled vendor would make a contract cover nothing
 * and raise a false "no contract" alert, so close spellings are reported with
 * a suggestion. A vendor that is not in the inventory at all may be legitimate
 * (an app the district stopped using): it is reported more softly.
 */

export interface NameIssue {
  readonly severity: 'warning';
  readonly file: 'contracts' | 'declared';
  readonly line?: number;
  readonly message: string;
}

export interface NameCheckInput {
  readonly inventory: readonly InventoryRow[];
  readonly contracts?: readonly Contract[];
  readonly declarations?: readonly Declaration[];
  /**
   * Set when the declared list is compared with what flows: a declared vendor
   * with no app is then a disclosure finding ("no longer receives data"), so it
   * is not reported here too. Close spellings are still reported.
   */
  readonly declaredCompared?: boolean;
}

export function checkNames(input: NameCheckInput): NameIssue[] {
  const issues: NameIssue[] = [];
  const vendors = new Set(input.inventory.map((r) => r.vendor));
  const vendorOfApp = new Map(input.inventory.map((r) => [r.app, r.vendor]));
  const vendorList = [...vendors];
  const appList = [...vendorOfApp.keys()];

  const check = (file: NameIssue['file'], what: string, vendor: string, apps: readonly string[] | undefined, line: number | undefined) => {
    const at = line !== undefined ? { line } : {};
    if (!vendors.has(vendor)) {
      const hint = suggest(vendor, vendorList);
      if (!hint && file === 'declared' && input.declaredCompared) return;
      issues.push({
        severity: 'warning',
        file,
        ...at,
        message: hint
          ? `${what} names vendor '${vendor}', which is not in the inventory.${hint} Until it matches, it applies to no app.`
          : `${what} names vendor '${vendor}', which has no app in the inventory.`,
      });
      return;
    }
    for (const app of apps ?? []) {
      const owner = vendorOfApp.get(app);
      if (owner === undefined) issues.push({ severity: 'warning', file, ...at, message: `${what} names app '${app}', which is not in the inventory.${suggest(app, appList)} It applies to no app until it matches.` });
      else if (owner !== vendor) issues.push({ severity: 'warning', file, ...at, message: `${what} names app '${app}' under '${vendor}', but the inventory lists it under '${owner}'.` });
    }
  };

  for (const c of input.contracts ?? []) check('contracts', `Contract ${c.id}`, c.vendorId, c.appIds, c.line);
  for (const d of input.declarations ?? []) check('declared', 'The declared list', d.vendorId, d.appIds, d.line);
  return issues;
}
