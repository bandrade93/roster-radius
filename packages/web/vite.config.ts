import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { contentSecurityPolicy } from './csp.ts';

export default defineConfig({
  // Relative paths, so the build works from any folder or subpath (such as GitHub Pages).
  base: './',
  plugins: [react(), contentSecurityPolicy()],
  resolve: {
    // The engine is used from its source until it has its own build (ADR 0002).
    alias: { '@roster-radius/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)) },
  },
  // The templates in docs/formats are offered as downloads from the page.
  server: { fs: { allow: ['../..'] } },
  worker: { format: 'es' },
  build: { target: 'es2022', sourcemap: true },
});
