# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Handoff notes for the next session. `CLAUDE.md` holds the standing rules and contracts; this file
> adds how the pieces fit together, how the project is built and shipped, and where it was left.

## What this is

A walkable first-person showroom for Wunder Sa.Bi. scales (Italian scale maker), rendered entirely
in WebGL with three.js 0.186 (Vite + TypeScript, no framework). It contains 30 real Wunder models
built procedurally (10 medicale, 10 industriale, 10 design) in a minimal grey building: plaza and
lobby, clinic wing, supermarket/warehouse wing, design gallery. The owner writes in Italian.

Hard rules (details in `CLAUDE.md`): no text anywhere (DOM or world, 7-segment digits allowed; the
only exception is the owner's bilingual ESC watermark in the HUD while the mouse is locked), no
image/font/model files, greys for the environment, logos only from `src/brand/logo.ts` and always
clickable, table-top scales on pedestals.

## Commands

```bash
npm install
npx vite --port 5173 --strictPort          # dev: /index.html (world), /lab.html?scale=<id> (one model)
npm run typecheck                          # tsc --noEmit
npm test                                   # vitest (tests/unit)
npx vitest run tests/unit/zoom.test.ts     # a single unit test file
npm run build                              # tsc + vite build + scripts/make-artifact.mjs → artifact/wunder-world.html
npm run e2e                                # Playwright against artifact/wunder-world.html (build first!)
npx playwright test -g "pointer locked"    # a single e2e test by name
npm run pages                              # build + scripts/make-pages.mjs → site/index.html (GitHub Pages)
node scripts/shots.mjs --port 5173 world lobby medicale   # screenshots + render stats (see script header)
node scripts/shots.mjs --port 5173 lab r2020 --angles 0,35,160
node scripts/shots.mjs --port 5173 sweep --step 4          # worst draw-call/triangle views over the walkable area
```

- e2e and screenshots use the preinstalled Chromium (`/opt/pw-browsers`, Playwright 1.56.1 pinned to
  match) with SwiftShader, so frames are slow: tests wait on `window.__wunder.frames` or on state,
  never on wall-clock time. The e2e fixture serves the artifact at a fake https origin and answers
  the jsdelivr three.js requests from `node_modules` (the container cannot reach the CDN).
- Parallel dev servers: give each its own `VITE_CACHE_DIR=node_modules/.vite-<port>`. `ss` is not
  installed; find server PIDs via `/proc`. Never `pkill -f` a pattern that also appears in your own
  command line (it kills your shell).

## Build and delivery

- `vite build` keeps `three` and `three/addons/*` external; `make-artifact.mjs` inlines the app into
  one HTML body (title/style first, no `<html>/<head>/<body>`, as claude.ai Artifacts require) with an
  importmap to `cdn.jsdelivr.net/npm/three@<version from node_modules>`. `artifact/wunder-world.html`
  is committed and republished to the claude.ai Artifact (URL recorded in the session, private).
- GitHub Pages: `.github/workflows/pages.yml` (push to the branch or `workflow_dispatch`) runs tests,
  builds, wraps the artifact into `site/index.html` and deploys. Pages **Source must be "GitHub
  Actions"**: "Deploy from a branch" serves raw sources (`/src/main.ts` 404) and its run can finish
  after ours and overwrite the site. Site: https://wundersoftwarecopilot.github.io/WunderScalesVirtualWorld/
- Only branch: `claude/relaxed-mendel-oc1px1` (also the repo default).

## Architecture (the parts that span files)

**Boot (`src/main.ts`)**: renderer + HUD loading loop → environment/lights/sky → `buildWorld()` (async,
yields a frame between steps so the WebGL loader animates) → key signs → `ctx.bake()` (merges all
`addStatic` meshes per material) → `bindEnvironment()` → shadow map rendered **once**
(`shadowMap.autoUpdate = false`; anything that moves after the bake does not update shadows) →
`PortalCuller` → per-frame loop: player → `ctx.updaters` → HUD → culler → render world + HUD →
`links.update()`.

**World assembly (`src/world/index.ts`)**: `buildShell` (floors, walls with doorways, roofs, facade,
doors, facade signs) → each zone module returns `slots` → `loadCatalog()` builds every scale →
`mergeModel()` merges a model's static parts per material (anything that moves must be under
`kit.keep()`, or it is frozen into the merge) → pedestals sized by `pedestalSize()` for
`placement: 'pedestal'` → every `userData.scaleLogo` badge is registered as a link to the product
URL → colliders → one updater drives `weigh(active)`: stepping into `standOn` for floor scales
(also raises the eye), proximity for pedestal pieces and floor scales without `standOn`.

**Catalogue**: `src/scales/specs.ts` is the source of truth (ids, line, placement, product URL,
approx size). `catalog.ts` globs `scales/{medicale,industriale,design}/*.ts`; files starting with
`_` are shared helpers without a default export; a missing id falls back to `stub.ts`, so the world
always has 30 pieces. Geometry recipes live in `docs/catalog-research.md`.

**Links (`src/core/links.ts`)**: Artifact viewers block `window.open`, so every visible, unoccluded
logo gets a transparent real `<a target=_blank>` positioned over its projected bounds each frame
(occlusion = ray vs `ctx.addOccluder` boxes; the portal culler's layers hide links in unseen rooms).
With the pointer locked the layer is hidden, the logo under the crosshair is `aimed` (it glows) and a
click calls `links.open()` (`anchor.click()` inside the trusted click, after releasing the lock).

**Input model (`src/core/input.ts`, `player.ts`, `ui/hud.ts`)**: a mouse click on the canvas requests
pointer lock (first-person look; Esc releases, and while locked `ui/watermark.ts` shows the
bilingual "press ESC" watermark top right, fading in and out with the lock). One request at a time; each is judged 1 s later by
its outcome (a lock that lands clears any verdict), and two refusals outside the post-Esc cooldown
fall back to drag-to-look (sandboxed frames). The first mouse move after the lock and warp spikes
are dropped; a locked click within 400 ms of the lock (the rest of a double-click) opens nothing.
The wheel zooms 1–4× (eased, look sensitivity divided by zoom, middle button resets without
opening a link); Safari's trackpad pinch arrives as `gesture*` events. Arrows/WASD only walk
(←/→ strafe), Shift runs. Touch: one-finger drag looks, two-finger pinch zooms, the WebGL HUD arrows
walk (a press on an arrow swallows the click of any link under it); a finger while the mouse is
locked releases the lock. Nothing looks, zooms or locks before `input.enabled` (world ready). The
HUD hints follow `input.pointerType` (the pointer in use: mouse icon or touch hint), not device
sniffing, so touch laptops get both. Base FOV depends on aspect
(`fovFor` in main.ts, wider on portrait phones); the player applies the zoom on top via `setBaseFov`.

**Culling and visibility**: `world/portals.ts` sorts everything into rooms (star plan: plaza ↔ lobby
via the glass front, lobby ↔ each wing via its doorway; `ctx.addSubRoom` for the warehouse behind a
partition) and moves hidden meshes to layer 1. Zones may still toggle `.visible` for their own finer
checks (medicale and industriale do), so the culler never uses `.visible`. Budget: < 400 draw calls,
< 1.2M triangles in any view.

**Materials**: mirror-like materials that need a reflection strength different from the scene's use
`kit.withEnvGain()`; `bindEnvironment()` (renderer.ts) must run after building and after a WebGL
context restore, because three.js otherwise overrides `envMapIntensity` with the scene's.

## Debugging hooks

- `window.__wunder`: `ready`, `frames`, `player` (`teleport(x, z, yaw, pitch)`, `zoom`), `input`
  (`locked`, `setIntent`), `links` (`links`, `aimed`), `hud`, `scene`, `scales` (placed instances),
  `teleport(<viewpoint>)`, `stats()` (calls, triangles, culled). Named viewpoints: `VIEWPOINTS` in
  `world/layout.ts` (also `?view=<name>` in dev). Yaw 0 looks north (−Z), +π/2 west.
- `lab.html?scale=<id>&angle=..&elev=..&zoom=..&fy=..&weigh=1`, `lab.html?all=<line>`; `window.__lab.errors`
  reports size mismatches (±35%) and models above 60 draw objects after merging.

## State at handoff

- The logo is a placeholder (white W on a red disc): the official SVG was never supplied. Swap it
  in `src/brand/logo.ts` only; callers rely on "faces +Z, centred, `diameter` = disc, `setHover`".
- wunder.it is blocked from the container: models come from web research; sizes marked `est`, and
  the names/links "960 Tarsie", the `/it/` slug of 960 Gold and NHB are unverified.
- Small division-colour accents remain (doorway stripes, a teal line in the gallery); the owner
  has not yet said whether they may stay in an all-grey environment.
- Everything was verified only in headless SwiftShader. Headless Chromium grants a real pointer
  lock (after refusing `unadjustedMovement` on Linux), and the e2e suite uses it; only the mouse-delta
  test fakes the lock, because CDP mouse moves carry no movementX/Y while locked. Safari's
  `gesture*` pinch was only checked with emulated events. Real GPU/phone checks are still open.
- `npm run e2e` rebuilds the artifact first (`pree2e`): the fixture loads `artifact/wunder-world.html`.
- The mouse-look change (3295b08) went through a review from three angles (browsers, touch,
  regressions); the commit after it fixes all 21 findings, and the e2e suite covers the real lock,
  a sandboxed frame without lock permission, and phone look/pinch/walk. Still unchecked outside
  Chromium: touch laptops in Firefox/Safari; the locked mouse filter drops any single move larger
  than max(300 px, 40% of the viewport).
