import * as THREE from 'three';
import { Input } from './core/input';
import { LinkLayer } from './core/links';
import { Player } from './core/player';
import { addLights, applyEnvironment, bindEnvironment, createRenderer, detectQuality, pixelRatioFor } from './core/renderer';
import { createSky } from './world/building';
import { WorldContext } from './world/context';
import { buildWorld, type PlacedScale } from './world/index';
import { PortalCuller } from './world/portals';
import { SPAWN, VIEWPOINTS } from './world/layout';
import { Hud } from './ui/hud';
import { createKeySign } from './ui/keysign';

/**
 * Wunder Virtual World — a walkable showroom rendered entirely with WebGL.
 * The DOM holds only the canvas and a layer of invisible real links over the logos.
 */
declare global {
  interface Window {
    __wunder?: {
      ready: boolean;
      frames: number;
      player: Player;
      input: Input;
      scales: PlacedScale[];
      links: LinkLayer;
      hud: Hud;
      renderer: THREE.WebGLRenderer;
      /** Scene graph, for tests and debugging tools. */
      scene: THREE.Scene;
      teleport(name: string): boolean;
      stats(): { calls: number; triangles: number; geometries: number; textures: number; culled: number };
    };
  }
}

/**
 * Vertical field of view for an aspect ratio: 64° on landscape screens, opened up on portrait
 * ones so the view keeps at least ~56° across (a phone held upright would otherwise see a 37°
 * slice of each room), and closed down on very wide ones so it never goes past ~100° across.
 */
const BASE_FOV = 64;
const MIN_HFOV = 56;
const MAX_HFOV = 100;
const MAX_VFOV = 100;
function fovFor(aspect: number): number {
  const d2r = THREE.MathUtils.DEG2RAD;
  const vFromH = (h: number) => 2 * Math.atan(Math.tan((h * d2r) / 2) / aspect) / d2r;
  const hFromV = (v: number) => 2 * Math.atan(Math.tan((v * d2r) / 2) * aspect) / d2r;
  const h = hFromV(BASE_FOV);
  if (h < MIN_HFOV) return Math.min(MAX_VFOV, vFromH(MIN_HFOV));
  if (h > MAX_HFOV) return vFromH(MAX_HFOV);
  return BASE_FOV;
}

const canvas = document.getElementById('gl') as HTMLCanvasElement;
const linkLayer = document.getElementById('links') as HTMLElement;
const quality = detectQuality();
const renderer = createRenderer(canvas, quality);

if (!renderer) {
  showNoWebGL();
} else {
  start(renderer).catch((err) => console.error('[main] failed to start', err));
}

async function start(renderer: THREE.WebGLRenderer): Promise<void> {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e4e6e8');
  // Close enough that the ground plane melts into the sky past the plaza's hedges (no hard
  // horizon line); far enough to leave every room clear (the longest indoor view is ~40 m).
  scene.fog = new THREE.Fog('#dfe1e4', 35, 120);
  const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.05, 400);
  scene.add(camera);

  const input = new Input(canvas);
  const links = new LinkLayer(linkLayer);
  const hud = new Hud(input);
  const ctx = new WorldContext(scene, links);
  const player = new Player(camera, input, ctx.collisions, SPAWN);
  player.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // The pixel ratio follows the window (zoom, a move to another screen), within the budget cap.
    renderer.setPixelRatio(pixelRatioFor(quality));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // The player applies its zoom on top of this base field of view.
    player.setBaseFov(fovFor(camera.aspect));
    hud.resize(w, h, renderer.getPixelRatio());
  };
  window.addEventListener('resize', resize);
  resize();

  // Loading screen runs on its own loop until the world is ready.
  const clock = new THREE.Timer();
  let ready = false;
  let frames = 0;
  const renderHudOnly = () => {
    if (ready) return;
    const dt = Math.min(0.05, (clock.update(), clock.getDelta()));
    hud.update(dt, clock.getElapsed());
    renderer.clear();
    renderer.render(hud.scene, hud.camera);
    requestAnimationFrame(renderHudOnly);
  };
  requestAnimationFrame(renderHudOnly);

  applyEnvironment(renderer, scene);
  addLights(scene, quality);
  scene.add(createSky());
  // A lost WebGL context (phones drop it for background tabs or under memory pressure) comes
  // back with every GPU-only resource gone: three.js re-uploads geometry and textures, but the
  // PMREM environment and the one-off static shadow map must be generated again.
  canvas.addEventListener('webglcontextrestored', () => {
    applyEnvironment(renderer, scene);
    bindEnvironment(scene);
    renderer.shadowMap.needsUpdate = true;
  });

  const placed = await buildWorld(ctx, () => player, (p) => (hud.progress = p));

  // "How to move" signs: one on the plaza in front of the visitor, one inside the lobby.
  for (const at of [
    { x: 1.9, z: 24.6, rotY: -0.35 },
    { x: 2.6, z: 13.2, rotY: -0.5 },
  ]) {
    const sign = createKeySign(input);
    sign.object.position.set(at.x, 0, at.z);
    sign.object.rotation.y = at.rotY;
    ctx.addDynamic(sign.object);
    ctx.addCollider({ minX: at.x - 0.22, maxX: at.x + 0.22, minZ: at.z - 0.18, maxZ: at.z + 0.18 }, 'sign');
    ctx.onUpdate((dt) => sign.update(dt));
  }

  ctx.bake();
  bindEnvironment(scene);
  renderer.shadowMap.needsUpdate = true;
  // Rooms behind walls are drawn only when seen through a doorway (see world/portals.ts).
  const culler = new PortalCuller([ctx.dynamic, ctx.statics], ctx.subRooms);

  const url = new URL(location.href);
  const view = url.searchParams.get('view') ?? (location.hash.length > 1 ? location.hash.slice(1) : null);
  const teleport = (name: string): boolean => {
    const v = VIEWPOINTS[name];
    if (!v) return false;
    player.teleport(v.x, v.z, v.yaw, v.pitch ?? 0);
    return true;
  };
  if (view) teleport(view);
  player.update(0);

  // Mouse look: a click while the pointer is locked follows the logo under the crosshair. The
  // lock is released first, so the visitor gets the cursor back (and a blocked popup can still
  // be opened by clicking the logo itself).
  input.onLockedClick = () => {
    const t = links.aimed;
    if (!t) return;
    input.unlock();
    links.open(t);
  };

  hud.progress = 1;
  hud.loading = false;
  // Look, zoom and click-to-lock start with the world: nothing made on the loading screen
  // carries over into the first view.
  input.enabled = true;
  ready = true;
  canvas.focus({ preventScroll: true });

  window.__wunder = {
    ready: true,
    get frames() {
      return frames;
    },
    player,
    input,
    scales: placed,
    links,
    hud,
    renderer,
    scene,
    teleport,
    stats: () => ({
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      culled: culler.hidden,
    }),
  };

  // Two renders per frame (world + HUD): count them together for stats.
  renderer.info.autoReset = false;
  const loop = () => {
    renderer.info.reset();
    const dt = Math.min(0.05, (clock.update(), clock.getDelta()));
    const t = clock.getElapsed();
    player.update(dt);
    for (const fn of ctx.updaters) fn(dt, t);
    hud.update(dt, t);
    culler.update(camera, renderer.shadowMap.needsUpdate);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(hud.scene, hud.camera);
    links.update(camera, window.innerWidth, window.innerHeight, input.locked, player.zoom);
    hud.aimed = links.aimed !== null;
    frames++;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function showNoWebGL(): void {
  // Without WebGL, fall back to the one thing that still makes sense: the logo as a link.
  canvas.remove();
  const box = document.createElement('div');
  box.id = 'nogl';
  box.innerHTML =
    '<a href="https://www.wunder.it/" target="_blank" rel="noopener" aria-label="Wunder Sa.Bi.">' +
    '<svg viewBox="-1 -1 2 2" width="100%" height="100%" aria-hidden="true"><circle r="1" fill="#D90000"/>' +
    '<g fill="#fff"><polygon points="-.285,-.4 -.115,-.4 -.445,.4 -.615,.4" transform="scale(1,-1)"/>' +
    '<polygon points="-.285,-.4 -.115,-.4 .085,.16 -.085,.16" transform="scale(1,-1)"/>' +
    '<polygon points=".115,-.4 .285,-.4 .085,.16 -.085,.16" transform="scale(1,-1)"/>' +
    '<polygon points=".115,-.4 .285,-.4 .615,.4 .445,.4" transform="scale(1,-1)"/></g></svg></a>';
  document.body.appendChild(box);
}
