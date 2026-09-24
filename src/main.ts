import * as THREE from 'three';
import { Input } from './core/input';
import { LinkLayer } from './core/links';
import { Player } from './core/player';
import { addLights, applyEnvironment, createRenderer, detectQuality } from './core/renderer';
import { createSky } from './world/building';
import { WorldContext } from './world/context';
import { buildWorld, type PlacedScale } from './world/index';
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
      renderer: THREE.WebGLRenderer;
      teleport(name: string): boolean;
      stats(): { calls: number; triangles: number; geometries: number; textures: number };
    };
  }
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
  scene.fog = new THREE.Fog('#dfe1e4', 70, 170);
  const camera = new THREE.PerspectiveCamera(quality.mobile ? 72 : 64, 1, 0.05, 400);
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
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    hud.resize(w, h);
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
  const sun = addLights(scene, quality);
  scene.add(createSky());

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
  renderer.shadowMap.needsUpdate = true;
  void sun;

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

  hud.progress = 1;
  hud.loading = false;
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
    renderer,
    teleport,
    stats: () => ({
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
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
    renderer.clear();
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(hud.scene, hud.camera);
    links.update(camera, window.innerWidth, window.innerHeight);
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
