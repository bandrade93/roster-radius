/**
 * Writes the public table of accepted fields from the catalog.
 *
 *   npm run fields
 */
import { writeFile } from 'node:fs/promises';
import { renderFieldTable } from '../packages/core/src/index.js';

const target = 'docs/formats/fields.md';
await writeFile(target, renderFieldTable(), 'utf-8');
console.log(`Wrote ${target}.`);
