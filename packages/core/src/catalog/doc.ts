import { FIELDS } from './fields.js';
import { SENSITIVITY_CLASSES } from './sensitivity.js';
import { SUBJECTS, type FieldDefinition, type Subject } from './types.js';

/**
 * Renders the public table of accepted fields (docs/formats/fields.md) from the
 * catalog, so that the document can never drift from the code. `npm run fields`
 * writes it; a test fails when the file and the catalog differ.
 */

const SUBJECT_TITLES: Record<Subject, string> = {
  student: 'Student',
  guardian: 'Parent or guardian',
  staff: 'Staff',
  school: 'School',
  section: 'Class section',
};

const cell = (s: string): string => s.replace(/\|/g, '\\|');
const columns = (aliases: readonly string[] | undefined): string => (aliases && aliases.length > 0 ? aliases.map((a) => `\`${cell(a)}\``).join('<br>') : '');

export function renderFieldTable(): string {
  const out: string[] = [];
  out.push('<!-- Generated from packages/core/src/catalog/fields.ts by `npm run fields`. Do not edit by hand. -->');
  out.push('');
  out.push('# Accepted fields');
  out.push('');
  out.push(
    `These are the ${FIELDS.length} fields RosterRadius knows. In the [app inventory](inventory.md), the [contracts file](contracts.md) and the [declared list](declared.md), write a field by its **key** or its **label**. When RosterRadius reads a file, it also recognizes the Clever and OneRoster column names and the other common names listed here.`,
  );
  out.push('');
  out.push('The sensitivity weight is explained in the [methodology](../../METHODOLOGY.md#5-sensitivity-classes). Contracts and declared lists are compared by Exhibit B category; staff, school and section fields have none.');
  for (const subject of SUBJECTS) {
    const fields = (FIELDS as readonly FieldDefinition[]).filter((f) => f.subject === subject);
    if (fields.length === 0) continue;
    out.push('');
    out.push(`## ${SUBJECT_TITLES[subject]} (${fields.length})`);
    out.push('');
    out.push('| Key | Label | Sensitivity | Exhibit B | Clever column | OneRoster column | Other common names |');
    out.push('|---|---|---|---|---|---|---|');
    for (const f of fields) {
      const s = SENSITIVITY_CLASSES[f.sensitivity];
      out.push(`| \`${f.key}\` | ${cell(f.label)} | ${s.label} (${s.weight}) | ${f.exhibitB ?? ''} | ${columns(f.aliases.cleverCsv)} | ${columns(f.aliases.oneroster)} | ${columns(f.aliases.common)} |`);
    }
  }
  out.push('');
  return out.join('\n');
}
