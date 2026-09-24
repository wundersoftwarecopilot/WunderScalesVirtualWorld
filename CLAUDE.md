# Wunder Virtual World

A walkable showroom for Wunder Sa.Bi. scales, rendered **entirely in WebGL** (three.js 0.186).
Published as a claude.ai Artifact (`artifact/wunder-world.html`).

## Non-negotiable rules
- **No text in the page.** The DOM is only `<canvas id="gl">` and `#links` (invisible `<a>` over
  logos, `aria-label` only). No labels, captions, model names or letters drawn in the world either.
  Numbers on scale displays are 7-segment geometry (`scales/segments.ts`), which is allowed.
- **Everything is geometry or code-generated textures** (DataTexture). No image, font or model files.
- **Environment in greys only** (`world/materials.ts` GREY). Colour comes from the scales' real
  finishes and the brand: red `#D90000`, medicale `#009ADE`, industriale `#FFB300`, design `#116374`.
- **Logos** come from `brand/logo.ts` only (placeholder W monogram until the official SVG arrives;
  never rebuild or restyle it elsewhere). Every logo must be clickable: `ctx.logo()`,
  `ctx.painting()` or `kit.logoBadge()` (badges on scales are linked automatically).
- **Placement:** floor scales stand on the floor; table-top scales (baby, retail, lab/precision)
  stand on a museum pedestal the world creates from `SPECS[id].placement === 'pedestal'`.

## Layout
- `src/core/` renderer, input (arrows/WASD, drag to look, touch HUD), player, collisions, link layer.
- `src/world/layout.ts` floor plan (X east, Z south, metres); `building.ts` shell; `zones/*.ts` dressing.
- `src/scales/specs.ts` the 30 models (ids, placement, URLs, approximate sizes); one file per model
  under `scales/{medicale,industriale,design}/<id>.ts`; `kit.ts` shared parts; `stub.ts` placeholder.
- `docs/catalog-research.md` geometry recipes (cm) for every model.

## Scale model contract (`scales/types.ts`)
- Build in **cm** inside `createScaleRoot(id).cm`; return `root` in metres.
- Origin = centre of footprint on the floor; **front = +Z** (displays face +Z).
- `size` (m) must bound the geometry (lab checks ±35%). `standOn` for platforms you can step on
  (with `y` = platform top), `colliders` for solid parts, `weigh(active)` + `update(dt)` via
  `kit.weighing()`. Reuse `kit` parts (visore, wxHead, dial, lcd, caster, tubePath, …) and `MAT`.
- Reference implementation: `scales/medicale/r2020.ts`.

## Zone contract (`world/zone.ts`)
- A zone module builds props inside `shell.inner`, keeps `openings[].clear` free, and returns
  `slots` (world x/z/rotY) for its line's scale ids. Use `ctx.addStatic` for plain props (merged
  per material), `ctx.instanced` for repeats, `ctx.addSolid/addCollider` for collisions,
  `ctx.addOccluder` for tall things, `ctx.logo/painting` for clickable brand pieces.

## Commands
- `npx vite --port <port> --strictPort` dev server (index.html world, lab.html single scale)
- `node scripts/shots.mjs --port <port> lab <id> --angles 0,35,160` model screenshots → `shots/`
- `node scripts/shots.mjs --port <port> world lobby medicale …` world viewpoints (layout.ts VIEWPOINTS)
- `npm run typecheck`, `npm test` (vitest), `npm run build` (→ artifact), `npm run e2e` (Playwright)
