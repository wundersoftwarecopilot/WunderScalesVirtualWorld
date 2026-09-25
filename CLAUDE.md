# Wunder Virtual World

A walkable showroom for Wunder Sa.Bi. scales, rendered **entirely in WebGL** (three.js 0.186).
Published as a claude.ai Artifact (`artifact/wunder-world.html`).

## Non-negotiable rules
- **No text in the page.** The DOM is only `<canvas id="gl">` and `#links` (invisible `<a>` over
  logos, `aria-label` only). No labels, captions, model names or letters drawn in the world either.
  Numbers on scale displays are 7-segment geometry (`scales/segments.ts`), which is allowed.
  One exception, asked for by the owner: while the mouse is locked the WebGL HUD shows a
  see-through watermark top right, "Press ESC to release the mouse" / "Premere ESC per rilasciare
  il mouse" (`ui/watermark.ts`, canvas-drawn with the system font). Add no other text.
- **Everything is geometry or code-generated textures** (DataTexture; the watermark's CanvasTexture).
  No image, font or model files.
- **Environment in greys only** (`world/materials.ts` GREY). Colour comes from the scales' real
  finishes and the brand: red `#D90000`, medicale `#009ADE`, industriale `#FFB300`, design `#116374`.
- **Logos** come from `brand/logo.ts` only (placeholder W monogram until the official SVG arrives;
  never rebuild or restyle it elsewhere). Every logo must be clickable: `ctx.logo()`,
  `ctx.painting()` or `kit.logoBadge()` (badges on scales are linked automatically).
- **Placement:** floor scales stand on the floor; table-top scales (baby, retail, lab/precision)
  stand on a museum pedestal the world creates from `SPECS[id].placement === 'pedestal'`.

## Layout
- `src/core/` renderer, input (click = pointer-lock mouse look, Esc releases, drag fallback; wheel/pinch
  zoom 1–4×, middle button resets; arrows/WASD only walk and strafe; touch: drag looks, pinch zooms,
  HUD arrows walk), player, collisions, link layer (while locked the logo in the crosshair opens
  on click). Nothing looks, zooms or locks before `input.enabled` (world ready).
- `src/world/layout.ts` floor plan (X east, Z south, metres); `building.ts` shell; `zones/*.ts` dressing.
- `src/scales/specs.ts` the 30 models (ids, placement, URLs, approximate sizes); one file per model
  under `scales/{medicale,industriale,design}/<id>.ts` (default export: one ScaleDef or an array);
  `_*.ts` files there are shared helpers with no default export; `kit.ts` shared parts; `stub.ts`
  stands in for any missing id.
- `docs/catalog-research.md` geometry recipes (cm) for every model.

## Scale model contract (`scales/types.ts`)
- Build in **cm** inside `createScaleRoot(id).cm`; return `root` in metres.
- Origin = centre of footprint on the floor; **front = +Z** (displays face +Z).
- `size` (m) must bound the geometry (lab checks ±35%). `standOn` for platforms you can step on
  (with `y` = platform top), `colliders` for solid parts, `weigh(active)` + `update(dt)` via
  `kit.weighing()`. Reuse `kit` parts (visore, wxHead, dial, lcd, caster, tubePath, …) and `MAT`.
- Static parts are merged per material after build; wrap anything that moves (needle, poise,
  slider, door) in `kit.keep()` or it is frozen into the merge.
- Reference implementation: `scales/medicale/r2020.ts`.

## Zone contract (`world/zone.ts`)
- A zone module builds props inside `shell.inner`, keeps `openings[].clear` free, and returns
  `slots` (world x/z/rotY) for its line's scale ids. Use `ctx.addStatic` for plain props (merged
  per material), `ctx.instanced` for repeats, `ctx.addSolid/addCollider` for collisions,
  `ctx.addOccluder` for tall things, `ctx.logo/painting` for clickable brand pieces.

## Rendering budget and culling
- Target: < 400 draw calls and < 1.2M triangles in any view (`window.__wunder.stats()`).
- `world/portals.ts` culls whole rooms: the plan is a star (plaza ↔ lobby through the glass
  front, lobby ↔ each wing through its doorway). Everything is sorted into rooms by its bounds
  once after `ctx.bake()`; a unit in another room is drawn only if it reaches into the wedge seen
  through the doorway chain. Hidden meshes move to layer 1 (never `.visible`, which zones use for
  their own finer checks). Keep new rooms/openings in `layout.ts` (OPENINGS with `top`,
  FACADE_GLASS) so the culler and the shell agree.
- A logo (`brand/logo.ts`) is ONE mesh with vertex colours: one draw call. A painting is its
  canvas face + logo; `ctx.painting()` merges the frame into the static batch.

## Commands
- `npx vite --port <port> --strictPort` dev server (index.html world, lab.html single scale)
- `node scripts/shots.mjs --port <port> lab <id> --angles 0,35,160` model screenshots → `shots/`
- `node scripts/shots.mjs --port <port> world lobby medicale …` world viewpoints (layout.ts VIEWPOINTS),
  prints render stats per view; `… sweep --step 4` walks the whole world and reports the worst views
- `npm run typecheck`, `npm test` (vitest), `npm run build` (→ artifact), `npm run e2e` (Playwright;
  rebuilds the artifact first, the tests load `artifact/wunder-world.html`)
- One test: `npx vitest run tests/unit/<file>.test.ts`, `npx playwright test -g "<name>"` (a direct
  `playwright` run does not rebuild: `npm run build` first)
- `npm run pages` → `site/index.html`. GitHub Pages deploys through `.github/workflows/pages.yml`
  on push; the repo's Pages Source must be "GitHub Actions" (a branch deploy serves raw `src/`).
- More context (boot order, links, input model, debugging hooks, open items): `Handoff.md`.
