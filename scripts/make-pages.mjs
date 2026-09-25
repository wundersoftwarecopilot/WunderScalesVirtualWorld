#!/usr/bin/env node
/**
 * artifact/wunder-world.html → site/index.html for GitHub Pages.
 * The artifact file is a page body (the claude.ai viewer adds the document skeleton); here we
 * add the skeleton ourselves: doctype, charset, viewport and an inline logo favicon.
 * Run after `npm run build`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const src = 'artifact/wunder-world.html';
if (!existsSync(src)) throw new Error(`${src} not found — run npm run build first`);
const body = readFileSync(src, 'utf8');

// Same placeholder monogram as src/brand/logo.ts: white W on the red disc.
const favicon =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 2 2"><circle r="1" fill="#D90000"/>' +
  '<g fill="#fff" transform="scale(1,-1)">' +
  '<polygon points="-.285,-.4 -.115,-.4 -.445,.4 -.615,.4"/><polygon points="-.285,-.4 -.115,-.4 .085,.16 -.085,.16"/>' +
  '<polygon points=".115,-.4 .285,-.4 .085,.16 -.085,.16"/><polygon points=".115,-.4 .285,-.4 .615,.4 .445,.4"/></g></svg>';

const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(favicon)}">
</head>
<body>
${body}
</body>
</html>
`;

mkdirSync('site', { recursive: true });
writeFileSync('site/index.html', html);
writeFileSync('site/.nojekyll', '');
console.log(`site/index.html  ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
