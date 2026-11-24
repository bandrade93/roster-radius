import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Same alias as packages/web/vite.config.ts: the page uses the engine from its source.
    alias: { '@roster-radius/core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)) },
  },
});
