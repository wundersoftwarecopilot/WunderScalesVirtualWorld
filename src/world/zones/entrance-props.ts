import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BRAND } from '../../brand/colors';
import type { Division } from '../../brand/urls';

/**
 * Props for the entrance zone (lobby + plaza).
 *
 * Every prop shares ONE palette material: a tiny colour / emissive / roughness-metalness texture
 * strip, and each part's UVs point at its swatch. The static batcher keeps UVs, so the whole
 * reception, waiting area, planters and plaza furniture merge into a single draw call (plus one
 * flat-shaded variant for the low-poly foliage). Greys only, brand colours in small accents.
 *
 * Builders return groups in local coordinates: origin = centre of the footprint on the floor,
 * front = +Z. Place them, then hand them to ctx.addStatic.
 */

interface Swatch {
  c: string;
  r: number;
  m?: number;
  /** Emissive colour (sRGB). */
  e?: string;
}

function dim(hex: string, k: number): string {
  return '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
}

const SWATCHES = {
  white: { c: '#eceef0', r: 0.45 },
  light: { c: '#d6d8db', r: 0.7 },
  mid: { c: '#a4a7ab', r: 0.8 },
  concrete: { c: '#b6b9bc', r: 0.95 },
  concreteDark: { c: '#909397', r: 0.95 },
  slat: { c: '#96999d', r: 0.68 },
  fabric: { c: '#55595e', r: 0.97 },
  fabricLight: { c: '#a2a6aa', r: 0.97 },
  felt: { c: '#3f4246', r: 1 },
  rug: { c: '#66696e', r: 1 },
  stone: { c: '#383b40', r: 0.2 },
  stoneLight: { c: '#9c9fa3', r: 0.62 },
  inlay: { c: '#d3d5d7', r: 0.28 },
  joint: { c: '#74777b', r: 0.8 },
  dark: { c: '#2f3236', r: 0.55 },
  black: { c: '#16171a', r: 0.22 },
  rubber: { c: '#232528', r: 0.9 },
  steel: { c: '#c6cacd', r: 0.28, m: 0.9 },
  steelDark: { c: '#63676d', r: 0.4, m: 0.85 },
  soil: { c: '#393b3e', r: 1 },
  pebble: { c: '#8a8d91', r: 0.9 },
  leafA: { c: '#7a8084', r: 0.88 },
  leafB: { c: '#989ea2', r: 0.88 },
  leafC: { c: '#5f6468', r: 0.88 },
  bark: { c: '#484a4e', r: 0.9 },
  lamp: { c: '#ffffff', r: 1, e: '#ffffff' },
  lampSoft: { c: '#f2f3f4', r: 1, e: '#9c9ea1' },
  screen: { c: '#202328', r: 0.15, e: '#2a2e35' },
  red: { c: BRAND.red, r: 0.4, e: dim(BRAND.red, 0.3) },
  medicale: { c: BRAND.medicale, r: 0.4, e: dim(BRAND.medicale, 0.3) },
  industriale: { c: BRAND.industriale, r: 0.4, e: dim(BRAND.industriale, 0.3) },
  design: { c: BRAND.design, r: 0.4, e: dim(BRAND.design, 0.35) },
} satisfies Record<string, Swatch>;

export type SwatchKey = keyof typeof SWATCHES;

const KEYS = Object.keys(SWATCHES) as SwatchKey[];
const TEX_W = 64;

function strip(fill: (s: Swatch) => [number, number, number], srgb: boolean): THREE.DataTexture {
  const data = new Uint8Array(TEX_W * 4);
  KEYS.forEach((k, i) => {
    const [r, g, b] = fill(SWATCHES[k] as Swatch);
    data.set([r, g, b, 255], i * 4);
  });
  const t = new THREE.DataTexture(data, TEX_W, 1);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

const hexBytes = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const colorTex = strip((s) => hexBytes(s.c), true);
const emissiveTex = strip((s) => (s.e ? hexBytes(s.e) : [0, 0, 0]), true);
// roughnessMap reads G, metalnessMap reads B.
const ormTex = strip((s) => [255, Math.round(s.r * 255), Math.round((s.m ?? 0) * 255)], false);

function paletteMaterial(flat: boolean): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    map: colorTex,
    emissiveMap: emissiveTex,
    emissive: '#ffffff',
    emissiveIntensity: 1.35,
    roughnessMap: ormTex,
    metalnessMap: ormTex,
    roughness: 1,
    metalness: 1,
    flatShading: flat,
  });
  m.name = flat ? 'entrance-foliage' : 'entrance-props';
  return m;
}

/** The one material for every entrance prop. */
export const PROP = paletteMaterial(false);
/** Same palette, flat shaded: faceted low-poly foliage. */
export const LEAF = paletteMaterial(true);

/** Point every vertex of `geo` at a swatch (returns the same geometry). */
export function tint<G extends THREE.BufferGeometry>(geo: G, key: SwatchKey): G {
  const u = (KEYS.indexOf(key) + 0.5) / TEX_W;
  const n = geo.getAttribute('position').count;
  const uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    uv[i * 2] = u;
    uv[i * 2 + 1] = 0.5;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

// ------------------------------------------------------------------ light decals

function gradientTexture(kind: 'radial' | 'linear'): THREE.DataTexture {
  const N = 64;
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let a: number;
      if (kind === 'radial') {
        const d = Math.hypot((x + 0.5) / N - 0.5, (y + 0.5) / N - 0.5) * 2;
        a = Math.max(0, 1 - d);
        a = a * a * (3 - 2 * a);
      } else {
        // Bright at the top edge (v = 1), fading down; soft at both sides.
        const v = (y + 0.5) / N;
        const u = Math.abs((x + 0.5) / N - 0.5) * 2;
        a = Math.pow(v, 2.2) * (1 - Math.pow(u, 6));
      }
      const i = (y * N + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  }
  const t = new THREE.DataTexture(data, N, N);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

export function glowMaterial(tex: THREE.Texture, opacity: number, name: string): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({
    map: tex,
    color: '#ffffff',
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    fog: false,
  });
  m.name = name;
  return m;
}

export const radialTexture = gradientTexture('radial');

/** Soft additive "light pool" (radial) and "wash" (linear, bright at the top) decals. */
export const GLOW = glowMaterial(radialTexture, 0.3, 'entrance-glow');
export const WASH = glowMaterial(gradientTexture('linear'), 0.22, 'entrance-wash');

/** A light pool on the floor (or any horizontal surface): w × d metres at height y. */
export function lightPool(w: number, d: number, x: number, y: number, z: number, mat = GLOW): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}

// ------------------------------------------------------------------ primitive helpers

export function part(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  key: SwatchKey,
  x = 0,
  y = 0,
  z = 0,
  rx = 0,
  ry = 0,
  rz = 0,
  mat: THREE.Material = PROP,
): THREE.Mesh {
  const m = new THREE.Mesh(tint(geo, key), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Box with its BOTTOM at y0. */
export function blk(p: THREE.Object3D, key: SwatchKey, w: number, h: number, d: number, x: number, y0: number, z: number, ry = 0): THREE.Mesh {
  return part(p, new THREE.BoxGeometry(w, h, d), key, x, y0 + h / 2, z, 0, ry);
}

/** Rounded box with its BOTTOM at y0. */
export function rblk(p: THREE.Object3D, key: SwatchKey, w: number, h: number, d: number, r: number, x: number, y0: number, z: number, seg = 2): THREE.Mesh {
  return part(p, new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.999), key, x, y0 + h / 2, z);
}

/** Cylinder with its BOTTOM at y0. */
export function cyl(p: THREE.Object3D, key: SwatchKey, rTop: number, rBot: number, h: number, seg: number, x: number, y0: number, z: number): THREE.Mesh {
  return part(p, new THREE.CylinderGeometry(rTop, rBot, h, seg), key, x, y0 + h / 2, z);
}

/** Rounded "stadium" slab (a long rectangle with semicircular ends), bottom at y0, centred in XZ. */
export function stadium(len: number, depth: number, h: number, y0: number, seg = 8): THREE.BufferGeometry {
  const r = depth / 2;
  const hx = len / 2 - r;
  const s = new THREE.Shape();
  s.moveTo(-hx, -r);
  s.lineTo(hx, -r);
  s.absarc(hx, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-hx, r);
  s.absarc(-hx, 0, r, Math.PI / 2, (3 * Math.PI) / 2, false);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: seg });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  return g;
}

/** Thin strip lying on the floor (top at y), for inlays and joints. */
export function floorStrip(p: THREE.Object3D, key: SwatchKey, x0: number, z0: number, x1: number, z1: number, top: number, thick = 0.002): THREE.Mesh {
  const m = blk(p, key, Math.abs(x1 - x0), thick, Math.abs(z1 - z0), (x0 + x1) / 2, top - thick, (z0 + z1) / 2);
  m.castShadow = false;
  return m;
}

// ------------------------------------------------------------------ deterministic noise

function hash3(x: number, y: number, z: number, seed: number): number {
  let h = Math.imul(Math.round(x * 400) | 0, 73856093) ^ Math.imul(Math.round(y * 400) | 0, 19349663) ^ Math.imul(Math.round(z * 400) | 0, 83492791) ^ Math.imul(seed | 0, 2654435761 | 0);
  h = Math.imul(h ^ (h >>> 15), 2246822507 | 0);
  h = Math.imul(h ^ (h >>> 13), 3266489909 | 0);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function rand(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Low-poly foliage blob: an icosahedron with its vertices pushed in/out (shared vertices move together). */
export function blobGeo(r: number, seed: number, amount = 0.28, squashY = 0.86, detail = 1): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k = 1 + (hash3(x / r, y / r, z / r, seed) - 0.5) * amount;
    p.setXYZ(i, x * k, y * k * squashY, z * k);
  }
  g.computeVertexNormals();
  return g;
}

/** Cone "blade" of a grass / sansevieria clump, tilted outward. */
function blade(p: THREE.Object3D, key: SwatchKey, h: number, w: number, x: number, y0: number, z: number, tilt: number, dir: number): void {
  const g = new THREE.ConeGeometry(w, h, 3, 1, true);
  g.translate(0, h / 2, 0);
  const m = part(p, g, key, x, y0, z, 0, 0, 0, LEAF);
  // Tilt away from the clump centre.
  m.quaternion.setFromEuler(new THREE.Euler(tilt, dir, 0, 'YXZ'));
}

// ------------------------------------------------------------------ planters and plants

/** Round tapered concrete pot with a rim and soil. Returns the soil height. */
export function roundPot(p: THREE.Object3D, r: number, h: number, key: SwatchKey = 'concrete', x = 0, z = 0): number {
  cyl(p, key, r, r * 0.84, h - 0.03, 20, x, 0, z);
  cyl(p, key === 'concrete' ? 'concreteDark' : 'mid', r + 0.012, r + 0.012, 0.03, 20, x, h - 0.03, z);
  cyl(p, 'soil', r - 0.025, r - 0.025, 0.012, 16, x, h - 0.045, z);
  // Pebble mulch: a few flat stones.
  const rnd = rand(Math.round(r * 1000 + h * 77 + x * 13 + z * 7));
  for (let i = 0; i < 5; i++) {
    const a = rnd() * Math.PI * 2;
    const d = (0.25 + rnd() * 0.55) * (r - 0.08);
    const s = part(p, blobGeo(0.035 + rnd() * 0.02, i + 3, 0.4, 0.45, 0), 'pebble', x + Math.cos(a) * d, h - 0.03, z + Math.sin(a) * d, 0, rnd() * 3);
    s.castShadow = false;
  }
  return h - 0.035;
}

/** Square concrete planter box with a rim and soil. Returns the soil height. */
export function boxPot(p: THREE.Object3D, w: number, d: number, h: number, key: SwatchKey = 'concrete', x = 0, z = 0): number {
  blk(p, key, w, h - 0.03, d, x, 0, z);
  // Rim as four bars so the soil sits inside.
  const t = 0.05;
  const rim: SwatchKey = key === 'concrete' ? 'concreteDark' : 'mid';
  blk(p, rim, w + 0.02, 0.03, t, x, h - 0.03, z - d / 2 + t / 2 - 0.01);
  blk(p, rim, w + 0.02, 0.03, t, x, h - 0.03, z + d / 2 - t / 2 + 0.01);
  blk(p, rim, t, 0.03, d - 2 * t + 0.02, x - w / 2 + t / 2 - 0.01, h - 0.03, z);
  blk(p, rim, t, 0.03, d - 2 * t + 0.02, x + w / 2 - t / 2 + 0.01, h - 0.03, z);
  blk(p, 'soil', w - 2 * t + 0.02, 0.012, d - 2 * t + 0.02, x, h - 0.045, z);
  // Recessed shadow plinth so the box floats a touch above the floor.
  return h - 0.035;
}

/** Stylised broadleaf tree: slim trunk, a couple of branches, a canopy of faceted blobs. */
export function treeCrown(p: THREE.Object3D, seed: number, soil: number, trunkH: number, crownR: number, x = 0, z = 0): void {
  const rnd = rand(seed);
  const lean = (rnd() - 0.5) * 0.08;
  const trunk = part(p, new THREE.CylinderGeometry(crownR * 0.045, crownR * 0.075, trunkH, 7).translate(0, trunkH / 2, 0), 'bark', x, soil, z, lean, 0, lean * 0.7, LEAF);
  trunk.castShadow = true;
  // Two branches forking into the crown.
  for (let i = 0; i < 2; i++) {
    const a = rnd() * Math.PI * 2;
    const bl = trunkH * 0.35;
    const b = part(p, new THREE.CylinderGeometry(crownR * 0.022, crownR * 0.035, bl, 5).translate(0, bl / 2, 0), 'bark', x, soil + trunkH * (0.55 + 0.15 * i), z, 0, 0, 0, LEAF);
    b.quaternion.setFromEuler(new THREE.Euler(0.6 + rnd() * 0.3, a, 0, 'YXZ'));
  }
  const cy = soil + trunkH + crownR * 0.25;
  const blobs = 5 + Math.floor(rnd() * 2);
  const keys: SwatchKey[] = ['leafA', 'leafB', 'leafC'];
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2 + rnd() * 0.6;
    const d = i === 0 ? 0 : crownR * (0.45 + rnd() * 0.25);
    const r = crownR * (i === 0 ? 0.75 : 0.5 + rnd() * 0.18);
    const y = cy + (i === 0 ? crownR * 0.2 : (rnd() - 0.35) * crownR * 0.6);
    part(p, blobGeo(r, seed * 31 + i), keys[i % 3], x + Math.cos(a) * d, y, z + Math.sin(a) * d, 0, rnd() * 3, 0, LEAF);
  }
}

/** Grass / sansevieria clump: n blades radiating from the soil. */
export function grassClump(p: THREE.Object3D, seed: number, soil: number, r: number, n: number, hMin: number, hMax: number, x = 0, z = 0): void {
  const rnd = rand(seed);
  const keys: SwatchKey[] = ['leafA', 'leafB', 'leafC'];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.5;
    const d = r * Math.sqrt(rnd()) * 0.8;
    const h = hMin + rnd() * (hMax - hMin);
    const tilt = 0.08 + (d / r) * 0.35 + rnd() * 0.1;
    blade(p, keys[i % 3], h, 0.02 + rnd() * 0.02 + h * 0.02, x + Math.cos(a) * d, soil - 0.01, z + Math.sin(a) * d, tilt, a + Math.PI / 2);
  }
}

/** Clipped ball topiary on a short stem. */
export function topiary(p: THREE.Object3D, seed: number, soil: number, r: number, stem: number, x = 0, z = 0): void {
  if (stem > 0) part(p, new THREE.CylinderGeometry(0.018, 0.026, stem + r * 0.5, 6).translate(0, (stem + r * 0.5) / 2, 0), 'bark', x, soil, z, 0, 0, 0, LEAF);
  part(p, blobGeo(r, seed, 0.12, 0.95, 1), seed % 2 ? 'leafA' : 'leafC', x, soil + stem + r * 0.9, z, 0, seed, 0, LEAF);
}

/** Columnar cypress: stacked faceted cones. */
export function cypress(p: THREE.Object3D, seed: number, soil: number, h: number, r: number, x = 0, z = 0): void {
  const rnd = rand(seed);
  part(p, new THREE.CylinderGeometry(0.03, 0.04, 0.35, 6).translate(0, 0.175, 0), 'bark', x, soil, z, 0, 0, 0, LEAF);
  const tiers = 3;
  for (let i = 0; i < tiers; i++) {
    const th = (h / tiers) * 1.35;
    const tr = r * (1 - i * 0.2);
    const g = blobGeo(1, seed * 7 + i, 0.18, 1, 1);
    g.scale(tr, th / 2, tr);
    part(p, g, i % 2 ? 'leafA' : 'leafC', x, soil + 0.3 + th / 2 + i * (h / tiers) * 0.72, z, 0, rnd() * 3, 0, LEAF);
  }
}

export type PlanterKind = 'tree' | 'grass' | 'ball' | 'cypress' | 'bowl';

/** Footprint (full width/depth, metres) of a prop's base, for colliders: userData.foot. */
export interface Foot {
  w: number;
  d: number;
}
const setFoot = (g: THREE.Object3D, w: number, d = w) => (g.userData.foot = { w, d } satisfies Foot);

/**
 * A complete planter. Heights: tree ≈ 2.9 m, cypress ≈ 2.4 m, ball ≈ 1.4 m, grass ≈ 1.2 m,
 * bowl ≈ 0.9 m. userData.foot is the pot footprint (the crown overhangs it).
 */
export function planter(kind: PlanterKind, seed: number, scale = 1): THREE.Group {
  const g = new THREE.Group();
  g.name = 'planter-' + kind;
  const s = scale;
  switch (kind) {
    case 'tree': {
      const soil = roundPot(g, 0.34 * s, 0.72 * s);
      treeCrown(g, seed, soil, 1.45 * s, 0.62 * s);
      setFoot(g, 0.68 * s + 0.024);
      break;
    }
    case 'cypress': {
      const soil = boxPot(g, 0.5 * s, 0.5 * s, 0.62 * s, 'concreteDark');
      cypress(g, seed, soil, 1.8 * s, 0.3 * s);
      setFoot(g, 0.5 * s + 0.02);
      break;
    }
    case 'ball': {
      const soil = boxPot(g, 0.46 * s, 0.46 * s, 0.82 * s, 'light');
      topiary(g, seed, soil, 0.3 * s, 0.12 * s);
      setFoot(g, 0.46 * s + 0.02);
      break;
    }
    case 'grass': {
      const soil = roundPot(g, 0.3 * s, 0.58 * s, 'concreteDark');
      grassClump(g, seed, soil, 0.26 * s, 22, 0.45 * s, 0.75 * s);
      setFoot(g, 0.6 * s + 0.024);
      break;
    }
    case 'bowl': {
      setFoot(g, 1.1 * s + 0.024);
      const soil = roundPot(g, 0.55 * s, 0.4 * s);
      grassClump(g, seed, soil, 0.45 * s, 26, 0.25 * s, 0.5 * s);
      topiary(g, seed + 1, soil, 0.18 * s, 0, 0.14 * s, -0.1 * s);
      topiary(g, seed + 2, soil, 0.14 * s, 0, -0.2 * s, 0.12 * s);
      break;
    }
  }
  return g;
}

// ------------------------------------------------------------------ lobby furniture

/** Modern low sofa: dark frame, lighter seat and back cushions, steel feet. W ≈ seats·0.68 + 0.32. */
export function sofa(seats = 3): THREE.Group {
  const g = new THREE.Group();
  g.name = 'sofa';
  const seatW = 0.68;
  const armW = 0.16;
  const inner = seats * seatW;
  const W = inner + 2 * armW;
  const D = 0.86;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) blk(g, 'steelDark', 0.05, 0.1, 0.05, sx * (W / 2 - 0.1), 0, sz * (D / 2 - 0.1));
  rblk(g, 'fabric', inner + 0.02, 0.24, D, 0.025, 0, 0.1, 0, 1);
  for (const sx of [-1, 1]) rblk(g, 'fabric', armW, 0.52, D, 0.04, sx * (inner / 2 + armW / 2), 0.1, 0, 2);
  rblk(g, 'fabric', inner + 0.02, 0.46, 0.2, 0.04, 0, 0.34, -D / 2 + 0.1, 2);
  for (let i = 0; i < seats; i++) {
    const x = -inner / 2 + seatW * (i + 0.5);
    rblk(g, 'fabricLight', seatW - 0.012, 0.13, D - 0.21, 0.045, x, 0.34, 0.095, 2);
    const back = rblk(g, 'fabricLight', seatW - 0.03, 0.4, 0.13, 0.05, x, 0.47, -D / 2 + 0.27, 2);
    back.rotation.x = -0.14;
  }
  return g;
}

/** Lounge armchair on a steel sled base. ≈ 0.8 × 0.8 m. */
export function armchair(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'armchair';
  for (const sx of [-1, 1]) {
    blk(g, 'steel', 0.025, 0.02, 0.72, sx * 0.33, 0, 0);
    blk(g, 'steel', 0.025, 0.02, 0.72, sx * 0.33, 0.33, 0);
    for (const sz of [-1, 1]) blk(g, 'steel', 0.025, 0.31, 0.025, sx * 0.33, 0.02, sz * 0.3475);
  }
  rblk(g, 'fabric', 0.78, 0.12, 0.76, 0.035, 0, 0.35, 0, 2);
  rblk(g, 'fabricLight', 0.64, 0.1, 0.6, 0.04, 0, 0.47, 0.06, 2);
  const pivot = new THREE.Group();
  pivot.position.set(0, 0.45, -0.32);
  pivot.rotation.x = -0.17;
  g.add(pivot);
  rblk(pivot, 'fabric', 0.78, 0.52, 0.12, 0.04, 0, 0, 0, 2);
  rblk(pivot, 'fabricLight', 0.62, 0.36, 0.08, 0.035, 0, 0.1, 0.08, 2);
  for (const sx of [-1, 1]) rblk(g, 'fabric', 0.08, 0.2, 0.64, 0.03, sx * 0.35, 0.47, 0.02, 2);
  return g;
}

/** Round low table on a steel pedestal, with a few objects on it. */
export function coffeeTable(r = 0.5, h = 0.4, seed = 1, dress = true): THREE.Group {
  const g = new THREE.Group();
  g.name = 'coffee-table';
  cyl(g, 'steelDark', r * 0.55, r * 0.6, 0.02, 24, 0, 0, 0);
  cyl(g, 'steel', 0.045, 0.05, h - 0.055, 12, 0, 0.02, 0);
  cyl(g, 'stone', r, r, 0.035, 32, 0, h - 0.035, 0);
  if (!dress) return g;
  const rnd = rand(seed);
  // Stack of books (no text: plain slabs in greys).
  const bx = r * 0.3;
  const bz = -r * 0.2;
  const books: SwatchKey[] = ['light', 'dark', 'mid'];
  let y = h;
  for (let i = 0; i < 3; i++) {
    const t = 0.018 + rnd() * 0.012;
    blk(g, books[i], 0.26 - i * 0.02, t, 0.19 - i * 0.015, bx, y, bz, (rnd() - 0.5) * 0.3);
    y += t;
  }
  // Shallow bowl and a steel sphere.
  const bowl = new THREE.LatheGeometry(
    [new THREE.Vector2(0, 0), new THREE.Vector2(0.08, 0.004), new THREE.Vector2(0.14, 0.035), new THREE.Vector2(0.15, 0.06), new THREE.Vector2(0.14, 0.062), new THREE.Vector2(0.12, 0.03), new THREE.Vector2(0.0, 0.01)],
    20,
  );
  part(g, bowl, 'white', -r * 0.35, h, r * 0.15);
  part(g, new THREE.SphereGeometry(0.045, 12, 8), 'steel', -r * 0.35 + 0.02, h + 0.055, r * 0.15 - 0.03);
  return g;
}

/** Small turned vase (white ceramic), bottom at y. */
export function vase(p: THREE.Object3D, x: number, y: number, z: number, s = 1): THREE.Mesh {
  const g = new THREE.LatheGeometry(
    [new THREE.Vector2(0, 0), new THREE.Vector2(0.05, 0), new THREE.Vector2(0.065, 0.08), new THREE.Vector2(0.045, 0.2), new THREE.Vector2(0.03, 0.26), new THREE.Vector2(0.034, 0.27)].map((v) => v.multiplyScalar(s)),
    14,
  );
  return part(p, g, 'white', x, y, z);
}

/** Backless upholstered bench on two steel end frames. */
export function lobbyBench(len = 2.0): THREE.Group {
  const g = new THREE.Group();
  g.name = 'bench';
  const d = 0.46;
  for (const sx of [-1, 1]) {
    const x = sx * (len / 2 - 0.14);
    blk(g, 'steelDark', 0.04, 0.3, 0.04, x, 0, -d / 2 + 0.05);
    blk(g, 'steelDark', 0.04, 0.3, 0.04, x, 0, d / 2 - 0.05);
    blk(g, 'steelDark', 0.04, 0.03, d - 0.06, x, 0.27, 0);
    for (const sz of [-1, 1]) blk(g, 'rubber', 0.05, 0.012, 0.05, x, -0.002, sz * (d / 2 - 0.05));
  }
  blk(g, 'steelDark', len - 0.3, 0.03, 0.03, 0, 0.12, 0);
  blk(g, 'dark', len, 0.035, d, 0, 0.3, 0);
  rblk(g, 'fabricLight', len - 0.02, 0.1, d - 0.02, 0.04, 0, 0.335, 0, 2);
  // Button seams: shallow dark lines across the pad.
  for (let i = 1; i < 4; i++) blk(g, 'fabric', 0.008, 0.004, d - 0.1, -len / 2 + (len / 4) * i, 0.434, 0);
  return g;
}

/** Office task chair (five-star base on casters). Faces +Z. */
export function taskChair(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'task-chair';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leg = part(g, new THREE.BoxGeometry(0.04, 0.03, 0.3).translate(0, 0, 0.15), 'dark', 0, 0.07, 0, 0, a);
    leg.castShadow = true;
    part(g, new THREE.SphereGeometry(0.028, 8, 6), 'rubber', Math.sin(a) * 0.3, 0.028, Math.cos(a) * 0.3);
  }
  cyl(g, 'dark', 0.05, 0.06, 0.04, 12, 0, 0.06, 0);
  cyl(g, 'steel', 0.022, 0.022, 0.34, 10, 0, 0.1, 0);
  rblk(g, 'fabric', 0.5, 0.075, 0.47, 0.03, 0, 0.44, 0.02, 2);
  blk(g, 'dark', 0.06, 0.26, 0.03, 0, 0.45, -0.24);
  rblk(g, 'fabric', 0.46, 0.5, 0.06, 0.025, 0, 0.62, -0.26, 2);
  for (const sx of [-1, 1]) {
    blk(g, 'dark', 0.03, 0.2, 0.03, sx * 0.235, 0.47, 0);
    rblk(g, 'rubber', 0.06, 0.025, 0.24, 0.01, sx * 0.235, 0.67, 0.0, 1);
  }
  return g;
}

/** Flat monitor on a foot; screen faces +Z. */
export function monitor(): THREE.Group {
  const g = new THREE.Group();
  blk(g, 'dark', 0.22, 0.012, 0.16, 0, 0, -0.03);
  blk(g, 'dark', 0.045, 0.2, 0.02, 0, 0.012, -0.07);
  rblk(g, 'dark', 0.56, 0.33, 0.028, 0.008, 0, 0.14, -0.045, 1);
  blk(g, 'screen', 0.535, 0.305, 0.002, 0, 0.1525, -0.03);
  return g;
}

/** Keyboard slab with an inset key field (no legends). */
export function keyboard(): THREE.Group {
  const g = new THREE.Group();
  rblk(g, 'light', 0.42, 0.016, 0.13, 0.005, 0, 0, 0, 1);
  blk(g, 'mid', 0.39, 0.004, 0.1, 0, 0.014, 0.004);
  return g;
}

/**
 * Reception desk: a long stadium-shaped front body with a raised dark stone transaction ledge,
 * a lower work surface behind for the staff, panel joints, a red base line and a glowing strip
 * under the ledge. Origin at floor centre, the visitor side faces +Z; front face at z = +0.3.
 * The clickable logo is added by the caller at (0, 0.6, 0.302).
 */
export function receptionDesk(len = 4.6): { group: THREE.Group; front: number } {
  const g = new THREE.Group();
  g.name = 'reception-desk';
  const D = 0.42;
  const cz = 0.3 - D / 2; // front body centre z
  part(g, stadium(len - 0.12, D - 0.08, 0.08, 0), 'dark', 0, 0, cz);
  part(g, stadium(len, D, 0.97, 0.08), 'white', 0, 0, cz);
  const ledge = part(g, stadium(len + 0.1, D + 0.1, 0.04, 1.05, 10), 'stone', 0, 0, cz);
  ledge.castShadow = true;
  const straight = len - D;
  // Panel joints on the straight front and a thin dark line above the plinth.
  for (const x of [-1.4, -0.7, 0.7, 1.4]) if (Math.abs(x) < straight / 2 - 0.05) blk(g, 'mid', 0.008, 0.9, 0.003, x, 0.12, 0.3);
  blk(g, 'dark', straight - 0.02, 0.014, 0.004, 0, 0.1, 0.301);
  // Glowing strip under the ledge overhang, plus a soft wash on the front panel below it.
  blk(g, 'lamp', straight - 0.1, 0.01, 0.012, 0, 1.038, 0.312);
  const wash = new THREE.Mesh(new THREE.PlaneGeometry(straight - 0.1, 0.55), WASH);
  wash.position.set(0, 1.035 - 0.275, 0.3015);
  wash.castShadow = false;
  g.add(wash);
  // Staff side: work surface on end panels, a drawer pedestal, a modesty rail.
  const ws = len - 0.5;
  const wsD = 0.72;
  const wsZ = 0.3 - D - wsD / 2 + 0.01;
  blk(g, 'light', ws, 0.035, wsD, 0, 0.72, wsZ);
  for (const sx of [-1, 1]) blk(g, 'white', 0.03, 0.72, wsD, sx * (ws / 2 - 0.015), 0, wsZ);
  blk(g, 'white', 0.44, 0.62, 0.6, ws / 2 - 0.27, 0.06, wsZ + 0.04);
  for (const y of [0.24, 0.46]) blk(g, 'mid', 0.44, 0.006, 0.003, ws / 2 - 0.27, y, wsZ - 0.261);
  for (const y of [0.18, 0.4, 0.62]) blk(g, 'steel', 0.12, 0.012, 0.018, ws / 2 - 0.27, y, wsZ - 0.269);
  // Monitors (facing the staff) and keyboards.
  for (const x of [-0.95, 0.85]) {
    const m = monitor();
    m.position.set(x, 0.755, wsZ + 0.12);
    m.rotation.y = Math.PI;
    g.add(m);
    const k = keyboard();
    k.position.set(x, 0.755, wsZ - 0.14);
    g.add(k);
  }
  // A small ball topiary in a cube pot at the east end of the ledge.
  const pot = new THREE.Group();
  blk(pot, 'white', 0.14, 0.14, 0.14, 0, 0, 0);
  blk(pot, 'soil', 0.12, 0.005, 0.12, 0, 0.13, 0);
  topiary(pot, 7, 0.135, 0.11, 0.03);
  pot.position.set(len / 2 - 0.3, 1.09, cz + 0.02);
  g.add(pot);
  return { group: g, front: 0.3 };
}

/** Low sideboard against a wall, doors with reveals and steel pulls. Back at z = -0.225. */
export function credenza(len: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'credenza';
  const d = 0.45;
  blk(g, 'dark', len - 0.06, 0.06, d - 0.06, 0, 0, -0.02);
  blk(g, 'white', len, 0.64, d, 0, 0.06, 0);
  blk(g, 'stone', len + 0.02, 0.03, d + 0.02, 0, 0.7, 0);
  const n = Math.max(2, Math.round(len / 0.8));
  for (let i = 1; i < n; i++) blk(g, 'mid', 0.006, 0.6, 0.003, -len / 2 + (len / n) * i, 0.08, d / 2);
  for (let i = 0; i < n; i++) blk(g, 'steel', 0.012, 0.16, 0.02, -len / 2 + (len / n) * (i + 0.5) + (i % 2 ? -0.1 : 0.1) * (len / n) * 3, 0.44, d / 2 + 0.01);
  return g;
}

/**
 * Wall plaque that carries a division logo: a light rounded plate on four steel standoffs.
 * Back touches the wall at z = 0; the logo goes at z = plaqueFront (returned).
 */
export function plaque(w: number, h: number): { group: THREE.Group; front: number } {
  const g = new THREE.Group();
  g.name = 'plaque';
  const off = 0.03;
  const t = 0.02;
  rblk(g, 'white', w, h, t, 0.012, 0, -h / 2, off + t / 2, 1);
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const px = sx * (w / 2 - 0.06);
      const py = sy * (h / 2 - 0.06);
      part(g, new THREE.CylinderGeometry(0.011, 0.011, off, 10), 'steel', px, py, off / 2, Math.PI / 2);
      part(g, new THREE.CylinderGeometry(0.017, 0.017, 0.006, 12), 'steel', px, py, off + t + 0.003, Math.PI / 2);
    }
  }
  return { group: g, front: off + t };
}

/** Picture light: slim dark bar with a glowing underside on two arms. Origin on the wall at the arm roots. */
export function pictureLight(len: number): THREE.Group {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) {
    blk(g, 'dark', 0.03, 0.05, 0.03, sx * len * 0.3, -0.025, 0.015);
    blk(g, 'dark', 0.014, 0.014, 0.16, sx * len * 0.3, -0.007, 0.1);
  }
  const bar = rblk(g, 'dark', len, 0.035, 0.05, 0.012, 0, -0.02, 0.18, 1);
  bar.castShadow = true;
  blk(g, 'lamp', len - 0.04, 0.004, 0.03, 0, -0.024, 0.18);
  return g;
}

/** Ring pendant light hung on three cables from the ceiling. Origin = ring centre. */
export function ringPendant(r: number, drop: number): THREE.Group {
  const g = new THREE.Group();
  const ring = part(g, new THREE.TorusGeometry(r, 0.03, 8, 40), 'lamp', 0, 0, 0, Math.PI / 2);
  ring.castShadow = false;
  const housing = part(g, new THREE.TorusGeometry(r, 0.034, 6, 40, Math.PI * 2), 'dark', 0, 0.012, 0, Math.PI / 2);
  housing.scale.set(1, 1, 0.55);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    const cable = part(g, new THREE.CylinderGeometry(0.003, 0.003, drop, 4), 'steelDark', Math.cos(a) * r, drop / 2, Math.sin(a) * r);
    cable.castShadow = false;
    cyl(g, 'dark', 0.04, 0.04, 0.02, 10, Math.cos(a) * r, drop - 0.02, Math.sin(a) * r);
  }
  return g;
}

/** Linear pendant (long slim luminaire) on two cables. Origin = luminaire centre. */
export function linearPendant(len: number, drop: number): THREE.Group {
  const g = new THREE.Group();
  const body = rblk(g, 'dark', len, 0.05, 0.09, 0.015, 0, 0, 0, 1);
  body.castShadow = false;
  blk(g, 'lamp', len - 0.04, 0.004, 0.06, 0, -0.003, 0);
  for (const sx of [-1, 1]) {
    const cable = part(g, new THREE.CylinderGeometry(0.003, 0.003, drop, 4), 'steelDark', sx * len * 0.35, drop / 2 + 0.05, 0);
    cable.castShadow = false;
    cyl(g, 'dark', 0.035, 0.035, 0.02, 10, sx * len * 0.35, drop + 0.03, 0);
  }
  return g;
}

// ------------------------------------------------------------------ plaza furniture

/** Plaza bench: two concrete blocks, a slatted seat and back on steel supports. Faces +Z. */
export function plazaBench(len = 2.0): THREE.Group {
  const g = new THREE.Group();
  g.name = 'plaza-bench';
  for (const sx of [-1, 1]) {
    blk(g, 'concrete', 0.36, 0.38, 0.46, sx * (len / 2 - 0.3), 0, 0);
    const sup = blk(g, 'steelDark', 0.05, 0.4, 0.04, sx * (len / 2 - 0.3), 0.38, -0.215);
    sup.rotation.x = -0.14;
  }
  for (let i = 0; i < 5; i++) {
    const s = rblk(g, 'slat', len, 0.035, 0.078, 0.01, 0, 0.38, -0.2 + i * 0.1, 1);
    s.castShadow = true;
  }
  for (let i = 0; i < 3; i++) {
    const s = rblk(g, 'slat', len, 0.078, 0.032, 0.01, 0, 0.5 + i * 0.105, -0.245 - i * 0.015, 1);
    s.rotation.x = -0.14;
  }
  return g;
}

/** Stainless bollard with a glowing ring near the top. */
export function bollard(): THREE.Group {
  const g = new THREE.Group();
  cyl(g, 'steelDark', 0.11, 0.11, 0.02, 14, 0, 0, 0);
  cyl(g, 'steel', 0.085, 0.085, 0.86, 14, 0, 0.02, 0);
  cyl(g, 'lamp', 0.087, 0.087, 0.035, 14, 0, 0.74, 0);
  cyl(g, 'dark', 0.087, 0.09, 0.06, 14, 0, 0.88, 0);
  setFoot(g, 0.22);
  return g;
}

/** Slim plaza lamp post with a flat disc head glowing underneath. */
export function lampPost(h = 5): THREE.Group {
  const g = new THREE.Group();
  cyl(g, 'dark', 0.15, 0.17, 0.35, 12, 0, 0, 0);
  cyl(g, 'steelDark', 0.05, 0.07, h - 0.35, 10, 0, 0.35, 0);
  cyl(g, 'dark', 0.36, 0.3, 0.1, 20, 0, h, 0);
  cyl(g, 'lamp', 0.28, 0.28, 0.01, 20, 0, h - 0.008, 0);
  setFoot(g, 0.34);
  return g;
}

/** Round raised tree bed: concrete wall with a seat cap, soil, grasses and a tree. */
export function treeBed(seed: number, r = 1.3, treeScale = 1): THREE.Group {
  const g = new THREE.Group();
  g.name = 'tree-bed';
  cyl(g, 'concrete', r, r, 0.42, 28, 0, 0, 0);
  const cap = part(g, new THREE.CylinderGeometry(r + 0.04, r + 0.04, 0.05, 28), 'concreteDark', 0, 0.445, 0);
  cap.castShadow = true;
  cyl(g, 'soil', r - 0.16, r - 0.16, 0.012, 24, 0, 0.47, 0);
  grassClump(g, seed + 5, 0.48, r - 0.25, 30, 0.2, 0.42);
  treeCrown(g, seed, 0.47, 3.1 * treeScale, 1.35 * treeScale);
  setFoot(g, 2 * r + 0.08);
  return g;
}

/** Long low planter box of grasses and faceted shrubs. */
export function planterBox(len: number, d: number, seed: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'planter-box';
  const soil = boxPot(g, len, d, 0.48, 'concrete');
  setFoot(g, len + 0.02, d + 0.02);
  const rnd = rand(seed);
  const n = Math.max(2, Math.round(len / 0.7));
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + (len / n) * (i + 0.5) + (rnd() - 0.5) * 0.15;
    if (i % 2 === 0) topiary(g, seed + i, soil, Math.min(d * 0.4, 0.3), 0, x, (rnd() - 0.5) * d * 0.2);
    else grassClump(g, seed + i * 3, soil, d * 0.35, 16, 0.35, 0.65, x, 0);
  }
  return g;
}

/**
 * Vertical garden: layered diamond leaves in drifts of three greys over a dark filler, inside a
 * dark steel frame with a grow-light line under the top rail. Back at z = 0, faces +Z, bottom at y = 0.
 */
export function livingWall(w: number, h: number, seed: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'living-wall';
  const f = 0.06;
  const fd = 0.16;
  blk(g, 'felt', w, h, 0.02, 0, 0, 0.01);
  blk(g, 'dark', w + 2 * f, f, fd, 0, -f, fd / 2);
  blk(g, 'dark', w + 2 * f, f, fd, 0, h, fd / 2);
  for (const sx of [-1, 1]) blk(g, 'dark', f, h, fd, sx * (w / 2 + f / 2), 0, fd / 2);
  blk(g, 'lamp', w - 0.04, 0.008, 0.02, 0, h - 0.008, fd - 0.02);
  const rnd = rand(seed);
  // Two value bands only (mid and light leaves over dark cushions), driven by a slow wave: large
  // drifts of foliage rather than an even salt-and-pepper mix of greys.
  const keys: SwatchKey[] = ['leafA', 'leafB'];
  // One unit leaf per swatch (tint() writes UVs into the geometry, so share per swatch only).
  const leafGeo = new Map<SwatchKey, THREE.BufferGeometry>();
  const leaf = (k: SwatchKey) => {
    let geo = leafGeo.get(k);
    if (!geo) leafGeo.set(k, (geo = tint(new THREE.OctahedronGeometry(1, 0), k)));
    return geo;
  };
  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  const step = 0.35;
  let i = 0;
  for (let y = step * 0.5; y < h - step * 0.3; y += step * 0.8) {
    for (let x = -w / 2 + step * 0.5; x < w / 2 - step * 0.3; x += step * 0.85, i++) {
      const cx = x + (rnd() - 0.5) * step * 0.4;
      const cy = y + (rnd() - 0.5) * step * 0.3;
      // Drifts: a slow diagonal wave picks the grey.
      const wave = Math.sin(cx * 1.4 + cy * 0.9 + seed) + Math.sin(cx * 0.5 - cy * 1.7 + seed * 2) * 0.6;
      const band = wave < 0 ? 0 : 1;
      // Dark filler cushion for depth between the leaves.
      part(g, blobGeo(0.13 + rnd() * 0.05, seed * 1000 + i, 0.35, 0.8, 0), 'leafC', cx, cy, 0.06, rnd() * 3, rnd() * 3, 0, LEAF);
      // Each cluster is a drooping rosette: leaves fan out sideways and down from the centre,
      // all at a similar lift off the wall, so neighbouring leaves share their shading.
      const n = 7;
      for (let k = 0; k < n; k++) {
        const len = (0.11 + rnd() * 0.08) * 1.4;
        const wid = len * (0.36 + rnd() * 0.12);
        const phi = -Math.PI / 2 + (k / (n - 1) - 0.5) * 3.4 + (rnd() - 0.5) * 0.35;
        const lift = 0.5 + rnd() * 0.2;
        dir.set(Math.cos(phi) * Math.cos(lift), Math.sin(phi) * Math.cos(lift) - 0.1, Math.sin(lift)).normalize();
        // Keep every leaf inside the frame.
        const tipX = cx + dir.x * len * 2;
        const tipY = cy + dir.y * len * 2;
        if (Math.abs(tipX) > w / 2 - 0.01 || tipY < 0.01 || tipY > h - 0.01) continue;
        const key = keys[band];
        const m = new THREE.Mesh(leaf(key), LEAF);
        m.scale.set(wid, len, 0.012);
        m.quaternion.setFromUnitVectors(up, dir);
        m.position.set(cx + dir.x * len, cy + dir.y * len, 0.06 + dir.z * len);
        m.castShadow = true;
        m.receiveShadow = true;
        g.add(m);
      }
    }
  }
  return g;
}

/**
 * Clipped hedge along X (length `len`, depth `d`, height `h`): a solid body with a lumpy crown of
 * faceted blobs. Origin at the floor centre.
 */
export function hedge(len: number, d: number, h: number, seed: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'hedge';
  const rnd = rand(seed);
  const body = h * 0.82;
  // Mid-grey leaves: the side facing the plaza is in the sun's shade, a darker swatch reads black.
  part(g, new THREE.BoxGeometry(len, body, d), 'leafB', 0, body / 2, 0, 0, 0, 0, LEAF);
  const n = Math.max(2, Math.round(len / 0.7));
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + (len / n) * (i + 0.5) + (rnd() - 0.5) * 0.2;
    const r = d * (0.5 + rnd() * 0.1);
    part(g, blobGeo(r, seed * 131 + i, 0.3, 0.62, 1), i % 3 ? 'leafB' : 'leafA', x, body - r * 0.12, (rnd() - 0.5) * 0.08, 0, rnd() * 3, 0, LEAF);
  }
  return g;
}

/** Division accent swatch. */
export function accentOf(d: Division): SwatchKey {
  return d === 'corporate' ? 'red' : d;
}
