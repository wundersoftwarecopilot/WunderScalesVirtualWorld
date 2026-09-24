#!/usr/bin/env node
/**
 * Screenshot helper (Playwright + Chromium with SwiftShader WebGL).
 *
 *   node scripts/shots.mjs --port 5173 world lobby medicale design     # world viewpoints
 *   node scripts/shots.mjs --port 5173 world -20,4,1.57,0.1            # x,z,yaw[,pitch] custom view
 *   node scripts/shots.mjs --port 5173 lab r2020 c202                   # single scales in lab.html
 *   node scripts/shots.mjs --port 5173 lab r2020 --angles 0,35,90,180   # several angles
 *   node scripts/shots.mjs --port 5173 line medicale                    # a whole line side by side
 *
 * Needs a dev server: `npx vite --port 5173 --strictPort`. Images go to shots/ (git-ignored).
 * Prints console errors and lab sanity errors; exits 1 if any occurred.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  if (i < 0) return def;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const port = opt('port', '5173');
const angles = opt('angles', '30').split(',');
const out = opt('out', 'shots');
const size = opt('size', '1280x800').split('x').map(Number);
const [mode, ...names] = args;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const page = await browser.newPage({ viewport: { width: size[0], height: size[1] } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));

const base = `http://127.0.0.1:${port}`;
try {
  if (mode === 'world') {
    await page.goto(`${base}/index.html`);
    await page.waitForFunction(() => window.__wunder?.ready, null, { timeout: 180000 });
    for (const n of names.length ? names : ['plaza']) {
      const custom = /^-?\d/.test(n) ? n.split(',').map(Number) : null;
      const ok = custom
        ? await page.evaluate(([x, z, yaw, pitch]) => (window.__wunder.player.teleport(x, z, yaw, pitch ?? 0), true), custom)
        : await page.evaluate((v) => window.__wunder.teleport(v), n);
      if (!ok) errors.push('unknown viewpoint ' + n);
      await page.waitForTimeout(1200);
      const file = `${out}/world-${n.replace(/[^\w.-]+/g, '_')}.png`;
      await page.screenshot({ path: file });
      console.log(file);
    }
    const stats = await page.evaluate(() => window.__wunder.stats());
    console.log('render stats', JSON.stringify(stats));
  } else if (mode === 'lab' || mode === 'line') {
    for (const n of names) {
      for (const a of angles) {
        const q = mode === 'line' ? `all=${n}&angle=${a}` : `scale=${n}&angle=${a}&weigh=1`;
        await page.goto(`${base}/lab.html?${q}`);
        await page.waitForFunction(() => window.__lab?.ready, null, { timeout: 120000 });
        const labErrors = await page.evaluate(() => window.__lab.errors);
        errors.push(...labErrors);
        const file = `${out}/${mode}-${n}-${a}.png`;
        await page.screenshot({ path: file });
        console.log(file);
      }
    }
  } else {
    console.error('usage: shots.mjs --port N (world <viewpoints…> | lab <ids…> | line <line>)');
    process.exitCode = 2;
  }
} finally {
  await browser.close();
}
const real = errors.filter((e) => !/GPU stall|swiftshader|WebGL-|Automatic fallback/i.test(e));
if (real.length) {
  console.log('ERRORS:\n' + real.join('\n'));
  process.exitCode = 1;
}
