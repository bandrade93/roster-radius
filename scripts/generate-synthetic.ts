/**
 * Writes the synthetic district to a folder, with its example results.
 *
 *   npm run synthetic                      # writes examples/synthetic-district
 *   npm run synthetic -- path/to/folder
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { generateSyntheticDistrict } from '../packages/core/src/index.js';
import { buildExamples } from './examples.js';

const out = process.argv[2] ?? 'examples/synthetic-district';
const district = generateSyntheticDistrict();
const results = await buildExamples();
for (const [path, content] of [...Object.entries(district.files), ...Object.entries(results)]) {
  const target = join(out, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, 'utf-8');
}
console.log(`Wrote ${Object.keys(district.files).length} files and ${Object.keys(results).length} results to ${out}: ${district.counts.students} students, ${district.counts.staff} staff, ${district.counts.schools} schools.`);
