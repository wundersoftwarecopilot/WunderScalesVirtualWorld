import { defineConfig } from '@playwright/test';

// E2E runs against the built artifact (artifact/wunder-world.html). three.js requests to
// jsdelivr are served from node_modules by the test fixture, so no network is needed.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 240_000,
  expect: { timeout: 30_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    viewport: { width: 1280, height: 800 },
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
    },
  },
});
