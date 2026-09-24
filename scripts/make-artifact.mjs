#!/usr/bin/env node
/**
 * dist/ (Vite build) → artifact/wunder-world.html: one self-contained page for claude.ai
 * Artifacts. The artifact frame wraps the file in its own <html>/<head>/<body>, so the file
 * starts with <title> and <style>, then the canvas, an importmap that loads three.js from
 * jsdelivr (allowed CDN, pinned version), and the app inlined as a module script.
 */
import { mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const pkg = JSON.parse(readFileSync('node_modules/three/package.json', 'utf8'));
const THREE_VERSION = pkg.version;
const CDN = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}`;

const dist = 'dist';
const findFile = (dir, re) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) {
      const hit = findFile(p, re);
      if (hit) return hit;
    } else if (re.test(f)) return p;
  }
  return null;
};
const appPath = findFile(dist, /^app\.js$/);
if (!appPath) throw new Error('dist/app.js not found — run vite build first');
let app = readFileSync(appPath, 'utf8');
const cssPath = findFile(dist, /\.css$/);
const css = cssPath ? readFileSync(cssPath, 'utf8') : readFileSync('src/page.css', 'utf8');

// Keep the inline script from closing early.
app = app.replace(/<\/script/gi, '<\\/script');

const importmap = {
  imports: {
    three: `${CDN}/build/three.module.js`,
    'three/addons/': `${CDN}/examples/jsm/`,
  },
};

const html = `<title>Wunder Virtual World</title>
<meta name="description" content="Showroom Wunder Sa.Bi. in WebGL: cammina tra ambulatorio, magazzino e galleria e scopri 30 bilance medicali, industriali e design.">
<style>${css}</style>
<canvas id="gl" tabindex="0" aria-label="Showroom Wunder in 3D: frecce per camminare, trascina per guardare"></canvas>
<div id="links"></div>
<script type="importmap">${JSON.stringify(importmap)}</script>
<script type="module">${app}</script>
`;

mkdirSync('artifact', { recursive: true });
writeFileSync('artifact/wunder-world.html', html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
console.log(`artifact/wunder-world.html  ${kb} KB  (three@${THREE_VERSION} from jsdelivr)`);
if (Buffer.byteLength(html) > 16 * 1024 * 1024) {
  console.error('artifact exceeds 16 MB');
  process.exit(1);
}
