import { expect, it } from 'vitest';
import { PROJECT_NAME } from '../src/index.js';

it('loads the project', () => {
  expect(PROJECT_NAME).toBe('RosterRadius');
});
