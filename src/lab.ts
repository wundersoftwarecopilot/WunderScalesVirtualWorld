import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { applyEnvironment, createRenderer, detectQuality } from './core/renderer';
import { loadCatalog } from './scales/catalog';
import { mergeModel } from './world/batch';
import { createPedestal } from './world/pedestal';

/**
 * Scale lab: renders ONE scale on a neutral stage for modelling and screenshots.
 *   lab.html?scale=r2020            orbit view
 *   lab.html?scale=r2020&angle=35   fixed camera angle (degrees around Y, 0 = front)
 *   lab.html?scale=r2020&weigh=1    trigger weigh(true) so displays show a reading
 *   lab.html?all=medicale           every scale of a line side by side
 *   &zoom=0.4&fy=0.5                closer camera (0..1 = fraction of the fit distance), aimed at
 *                                   fy × height (0 = floor, 1 = top); &elev=deg camera elevation
 * Sets window.__lab = { ready: true } when the frame is stable.
 */
declare global {
  interface Window {
    __lab?: { ready: boolean; errors: string[] };
  }
}
window.__lab = { ready: false, errors: [] };

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('gl') as HTMLCanvasElement;
const q = detectQuality();
const renderer = createRenderer(canvas, { ...q, pixelRatio: 1 })!;
renderer.shadowMap.autoUpdate = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#d7d9dc');
applyEnvironment(renderer, scene);
scene.add(new THREE.HemisphereLight('#ffffff', '#8a8d91', 1.3));
const sun = new THREE.DirectionalLight('#ffffff', 2.0);
sun.position.set(2.5, 6, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 20 });
sun.shadow.bias = -0.0003;
scene.add(sun);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: '#b7babd', roughness: 0.8 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

const defs = loadCatalog();
const updates: Array<(dt: number, t: number) => void> = [];
const line = params.get('all');
const id = params.get('scale') ?? defs[0].spec.id;
const chosen = line ? defs.filter((d) => d.spec.line === line) : defs.filter((d) => d.spec.id === id);
if (!chosen.length) window.__lab.errors.push('unknown scale ' + id);

let x = 0;
const bounds = new THREE.Box3();
for (const def of chosen) {
  try {
    const inst = def.build();
    const merged = mergeModel(inst.root);
    console.info(`[lab] ${def.spec.id}: ${merged.before} meshes → ${merged.after} draw objects after merge`);
    if (merged.after > 60) window.__lab!.errors.push(`${def.spec.id}: ${merged.after} separate meshes after merging (budget 60) — mark fewer parts keep, share materials`);
    const g = new THREE.Group();
    let baseY = 0;
    if (def.spec.placement === 'pedestal') {
      const w = Math.max(0.36, inst.size.w + 0.2);
      const d = Math.max(0.32, inst.size.d + 0.2);
      baseY = (def.spec.pedestalHeight ?? 85) / 100;
      g.add(createPedestal({ w, d, h: baseY, division: def.spec.line }).group);
    }
    inst.root.position.y = baseY;
    g.add(inst.root);
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.receiveShadow = true;
    });
    const width = Math.max(inst.size.w, 0.4);
    g.position.x = x + width / 2;
    x += width + 0.5;
    scene.add(g);
    if (params.get('weigh') === '1') inst.weigh?.(true);
    if (inst.update) updates.push((dt, t) => inst.update!(dt, t));
    bounds.expandByObject(g);
    // Sanity checks that tests and agents rely on.
    const size = new THREE.Box3().setFromObject(inst.root).getSize(new THREE.Vector3());
    const tol = 1.35;
    if (size.x > inst.size.w * tol + 0.05 || size.z > inst.size.d * tol + 0.05 || size.y > inst.size.h * tol + 0.05)
      window.__lab.errors.push(`${def.spec.id}: geometry ${size.toArray().map((v) => v.toFixed(2))} exceeds declared size ${JSON.stringify(inst.size)}`);
  } catch (err) {
    window.__lab.errors.push(`${def.spec.id}: ${(err as Error).message}`);
    console.error(err);
  }
}
// Centre the row.
const shift = new THREE.Vector3();
bounds.getCenter(shift);
scene.children.filter((c) => c.type === 'Group').forEach((g) => (g.position.x -= shift.x));
bounds.translate(new THREE.Vector3(-shift.x, 0, 0));

const size = bounds.getSize(new THREE.Vector3());
const center = bounds.getCenter(new THREE.Vector3());
const radius = Math.max(size.x, size.y, size.z) * 0.62 + 0.15;
const angle = THREE.MathUtils.degToRad(Number(params.get('angle') ?? 30));
const elev = THREE.MathUtils.degToRad(Number(params.get('elev') ?? 22));
const dist = (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 0.95 * Number(params.get('zoom') ?? 1);
if (params.has('fy')) center.y = bounds.min.y + size.y * Number(params.get('fy'));
camera.position.set(center.x + Math.sin(angle) * Math.cos(elev) * dist, center.y + Math.sin(elev) * dist, center.z + Math.cos(angle) * Math.cos(elev) * dist);
controls.target.copy(center);
controls.update();

const resize = () => {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
};
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Timer();
let frames = 0;
const loop = () => {
  const dt = Math.min(0.05, (clock.update(), clock.getDelta()));
  for (const u of updates) u(dt, clock.getElapsed());
  controls.update();
  renderer.clear();
  renderer.render(scene, camera);
  if (++frames === 90) window.__lab!.ready = true;
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);
