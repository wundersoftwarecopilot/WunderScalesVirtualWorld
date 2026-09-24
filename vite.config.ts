import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// The artifact loads three.js from jsdelivr through an importmap (see scripts/make-artifact.mjs),
// so the production bundle keeps `three` and `three/addons/*` as external bare imports.
export default defineConfig(({ command }) => ({
  // Parallel dev servers (one per agent) each get their own dependency cache.
  cacheDir: process.env.VITE_CACHE_DIR ?? 'node_modules/.vite',
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html') },
      external: command === 'build' ? [/^three$/, /^three\/addons\//] : [],
      output: { inlineDynamicImports: true, entryFileNames: 'app.js' },
    },
  },
  server: { host: '127.0.0.1' },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
}));
