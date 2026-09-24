import { test as base, expect, type Page } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ARTIFACT = 'artifact/wunder-world.html';

/** Serve the artifact at a fake https origin and three.js from node_modules (offline CDN). */
export async function openArtifact(page: Page, errors: string[]): Promise<void> {
  if (!existsSync(ARTIFACT)) throw new Error('Run `npm run build` first');
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://cdn.jsdelivr.net/npm/three@*/**', async (route) => {
    const url = new URL(route.request().url());
    const rel = url.pathname.replace(/^\/npm\/three@[^/]+\//, '');
    const file = join('node_modules/three', rel);
    if (!existsSync(file)) return route.fulfill({ status: 404, body: 'missing ' + rel });
    await route.fulfill({
      status: 200,
      body: readFileSync(file),
      headers: { 'content-type': 'text/javascript', 'access-control-allow-origin': '*' },
    });
  });
  // The artifact viewer wraps the file in its own document; emulate that skeleton here.
  const body = readFileSync(ARTIFACT, 'utf8');
  await page.route('https://artifact.test/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${body}</body></html>`,
    }),
  );
  await page.goto('https://artifact.test/index.html');
  await page.waitForFunction(() => window.__wunder?.ready === true, null, { timeout: 200_000 });
}

export const test = base;
export { expect };
