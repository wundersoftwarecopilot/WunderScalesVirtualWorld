import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * Props for the INDUSTRIALE wing (supermarket + warehouse).
 *
 * Every static part shares one palette material: a 1-pixel-high strip of swatches (colour,
 * emissive, roughness/metalness) and each part's UVs point at its swatch. The static batcher
 * keeps UVs, so shelving, counters, racking and fittings merge into a few draw calls (one per
 * cluster clone, so the supermarket and the warehouse are frustum-culled on their own).
 * Greys only, safety markings included (light tape, light/dark guard stripes): the division
 * colour appears on logos and the scales only.
 *
 * Builders return groups in local coordinates, metres: origin on the floor, front = +Z unless
 * stated. Place them, then hand them to ctx.addStatic.
 */

interface Swatch {
  c: string;
  r: number;
  m?: number;
  /** Emissive colour (sRGB). */
  e?: string;
}

const SWATCHES = {
  white: { c: '#e8eaec', r: 0.45 },
  panel: { c: '#d2d5d8', r: 0.55, m: 0.1 },
  light: { c: '#c2c5c8', r: 0.6 },
  wall: { c: '#bec1c4', r: 0.86 },
  seam: { c: '#9fa2a6', r: 0.8 },
  mid: { c: '#9a9da1', r: 0.6 },
  grey: { c: '#7a7d82', r: 0.6 },
  dark: { c: '#4c4f54', r: 0.55 },
  darker: { c: '#2f3236', r: 0.5 },
  black: { c: '#17181a', r: 0.3 },
  rubber: { c: '#222326', r: 0.92 },
  steel: { c: '#c4c8cd', r: 0.3, m: 0.85 },
  steelDark: { c: '#6a6e74', r: 0.4, m: 0.8 },
  chrome: { c: '#e2e4e6', r: 0.1, m: 1 },
  upright: { c: '#565a60', r: 0.45, m: 0.35 },
  beam: { c: '#a3a7ac', r: 0.4, m: 0.35 },
  wood: { c: '#b1b1ae', r: 0.92 },
  woodDark: { c: '#8f908e', r: 0.92 },
  laminate: { c: '#b7babd', r: 0.4 },
  top: { c: '#d0d2d4', r: 0.32 },
  paper: { c: '#f4f4f2', r: 0.9 },
  belt: { c: '#1c1d20', r: 0.75 },
  tile: { c: '#dcdee0', r: 0.22 },
  prodBody: { c: '#eeeeee', r: 0.42 },
  prodLabel: { c: '#8d9094', r: 0.5 },
  prodCap: { c: '#3a3c40', r: 0.4 },
  prodGlass: { c: '#cdd2d6', r: 0.12, m: 0.15 },
  produceA: { c: '#8d8f93', r: 0.5 },
  produceB: { c: '#6b6e72', r: 0.55 },
  produceC: { c: '#b1b3b6', r: 0.45 },
  crate: { c: '#5c5f64', r: 0.7 },
  concrete: { c: '#8a8d91', r: 0.85 },
  esd: { c: '#a2a6ab', r: 0.7 },
  // Safety markings in greys: the building stays grey, colour comes from scales and logos.
  guard: { c: '#cfd2d6', r: 0.45 },
  tape: { c: '#e2e4e7', r: 0.55 },
  hazard: { c: '#1b1c1e', r: 0.6 },
  lamp: { c: '#ffffff', r: 1, e: '#ffffff' },
  lampSoft: { c: '#f2f3f4', r: 1, e: '#b4b7bb' },
  screen: { c: '#15171a', r: 0.12, e: '#0b0c0e' },
  screenOn: { c: '#2b3036', r: 0.2, e: '#4a5058' },
  glassDark: { c: '#4f555b', r: 0.08, m: 0.4 },
  cheese: { c: '#c9cbcd', r: 0.6 },
  meat: { c: '#8f9195', r: 0.5 },
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

/** The palette material every static industriale part uses. */
export const PAL = (() => {
  const colorTex = strip((s) => hexBytes(s.c), true);
  const emissiveTex = strip((s) => (s.e ? hexBytes(s.e) : [0, 0, 0]), true);
  // roughnessMap reads G, metalnessMap reads B.
  const ormTex = strip((s) => [255, Math.round(s.r * 255), Math.round((s.m ?? 0) * 255)], false);
  const m = new THREE.MeshStandardMaterial({
    map: colorTex,
    emissiveMap: emissiveTex,
    emissive: '#ffffff',
    emissiveIntensity: 1.3,
    roughnessMap: ormTex,
    metalnessMap: ormTex,
    roughness: 1,
    metalness: 1,
  });
  m.name = 'industriale-props';
  return m;
})();

const CLUSTERS = new Map<string, THREE.MeshStandardMaterial>();
/**
 * Clones of the palette material (shared textures). The batcher merges per material, so each
 * clone becomes its own merged mesh, frustum-culled on its own.
 */
export function cluster(name: string): THREE.MeshStandardMaterial {
  let m = CLUSTERS.get(name);
  if (!m) {
    m = PAL.clone();
    m.name = 'industriale-' + name;
    CLUSTERS.set(name, m);
  }
  return m;
}

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

// ------------------------------------------------------------------ primitive helpers

export function part(p: THREE.Object3D, geo: THREE.BufferGeometry, key: SwatchKey, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): THREE.Mesh {
  const m = new THREE.Mesh(tint(geo, key), PAL);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  p.add(m);
  return m;
}

/** Box with its BOTTOM at y0. */
export function box(p: THREE.Object3D, key: SwatchKey, w: number, h: number, d: number, x: number, y0: number, z: number, ry = 0): THREE.Mesh {
  return part(p, new THREE.BoxGeometry(w, h, d), key, x, y0 + h / 2, z, 0, ry);
}

/** Box from min/max corners (axis aligned). */
export function boxMM(p: THREE.Object3D, key: SwatchKey, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): THREE.Mesh {
  return part(p, new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)), key, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
}

/** Rounded box with its BOTTOM at y0. */
export function rbox(p: THREE.Object3D, key: SwatchKey, w: number, h: number, d: number, r: number, x: number, y0: number, z: number, seg = 1): THREE.Mesh {
  return part(p, new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.999), key, x, y0 + h / 2, z);
}

/** Vertical cylinder with its BOTTOM at y0. */
export function cyl(p: THREE.Object3D, key: SwatchKey, r: number, h: number, x: number, y0: number, z: number, seg = 12, rTop = r): THREE.Mesh {
  return part(p, new THREE.CylinderGeometry(rTop, r, h, seg), key, x, y0 + h / 2, z);
}

type V3 = [number, number, number];
const UP = new THREE.Vector3(0, 1, 0);

/** Cylinder between two points. */
export function rod(p: THREE.Object3D, key: SwatchKey, a: V3, b: V3, r: number, seg = 6): THREE.Mesh {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const dir = vb.clone().sub(va);
  const m = part(p, new THREE.CylinderGeometry(r, r, dir.length(), seg, 1, true), key);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  return m;
}

/** Square bar between two points (bracing, rails). */
export function bar(p: THREE.Object3D, key: SwatchKey, a: V3, b: V3, t: number, t2 = t): THREE.Mesh {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const dir = vb.clone().sub(va);
  const m = part(p, new THREE.BoxGeometry(t, dir.length(), t2), key);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  return m;
}

export function sphere(p: THREE.Object3D, key: SwatchKey, r: number, x: number, y: number, z: number, ws = 10, hs = 6): THREE.Mesh {
  return part(p, new THREE.SphereGeometry(r, ws, hs), key, x, y, z);
}

/** Polyline with rounded corners as a 3D path. */
function roundedPath(pts: THREE.Vector3[], r: number): THREE.CurvePath<THREE.Vector3> {
  const path = new THREE.CurvePath<THREE.Vector3>();
  let cursor = pts[0].clone();
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const next = pts[i + 1];
    const d1 = cur.clone().sub(prev);
    const d2 = next.clone().sub(cur);
    const rr = Math.min(r, d1.length() / 2, d2.length() / 2);
    const a = cur.clone().sub(d1.normalize().multiplyScalar(rr));
    const b = cur.clone().add(d2.normalize().multiplyScalar(rr));
    if (cursor.distanceTo(a) > 1e-6) path.add(new THREE.LineCurve3(cursor, a));
    path.add(new THREE.QuadraticBezierCurve3(a, cur.clone(), b));
    cursor = b;
  }
  const last = pts[pts.length - 1];
  if (cursor.distanceTo(last) > 1e-6) path.add(new THREE.LineCurve3(cursor, last.clone()));
  return path;
}

/** Bent tube along a polyline (rounded bends). */
export function tube(p: THREE.Object3D, key: SwatchKey, pts: V3[], r: number, bend = r * 3, radial = 6): THREE.Mesh {
  const path = roundedPath(
    pts.map((q) => new THREE.Vector3(...q)),
    bend,
  );
  const segs = Math.max(2, Math.min(40, Math.round(path.getLength() / 0.2) + (pts.length - 2) * 3));
  return part(p, new THREE.TubeGeometry(path, segs, r, radial, false), key);
}

/** Everything under `g` merged into one geometry (keeps palette UVs): for ctx.instanced. */
export function mergeGroup(g: THREE.Object3D): THREE.BufferGeometry {
  g.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  const geos: THREE.BufferGeometry[] = [];
  const local = new THREE.Matrix4();
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    let geo = m.geometry.clone();
    for (const n of Object.keys(geo.attributes)) if (n !== 'position' && n !== 'normal' && n !== 'uv') geo.deleteAttribute(n);
    if (geo.index) geo = geo.toNonIndexed();
    local.multiplyMatrices(inv, m.matrixWorld);
    geo.applyMatrix4(local);
    if (local.determinant() < 0) {
      // Mirrored: flip winding.
      const pos = geo.getAttribute('position');
      const nor = geo.getAttribute('normal');
      const uv = geo.getAttribute('uv');
      for (let i = 0; i < pos.count; i += 3) {
        for (const a of [pos, nor, uv]) {
          const s = a.itemSize;
          const arr = a.array as Float32Array;
          for (let k = 0; k < s; k++) {
            const t = arr[(i + 1) * s + k];
            arr[(i + 1) * s + k] = arr[(i + 2) * s + k];
            arr[(i + 2) * s + k] = t;
          }
        }
      }
    }
    geos.push(geo);
  });
  let total = 0;
  for (const q of geos) total += q.getAttribute('position').count;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  let o = 0;
  for (const q of geos) {
    const n = q.getAttribute('position').count;
    pos.set(q.getAttribute('position').array as Float32Array, o * 3);
    nor.set(q.getAttribute('normal').array as Float32Array, o * 3);
    uv.set(q.getAttribute('uv').array as Float32Array, o * 2);
    o += n;
    q.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}

// ------------------------------------------------------------------ textures & special materials

function noiseHash(x: number, y: number, s: number): number {
  const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return v - Math.floor(v);
}

function valueNoise(x: number, y: number, s: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = noiseHash(xi, yi, s);
  const b = noiseHash(xi + 1, yi, s);
  const c = noiseHash(xi, yi + 1, s);
  const d = noiseHash(xi + 1, yi + 1, s);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function makeTex(N: number, fn: (x: number, y: number) => number, srgb = true, tintRGB: [number, number, number] = [1, 1, 1]): THREE.DataTexture {
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const v = Math.max(0, Math.min(1, fn(x, y)));
      const i = (y * N + x) * 4;
      data[i] = Math.round(v * tintRGB[0] * 255);
      data[i + 1] = Math.round(v * tintRGB[1] * 255);
      data[i + 2] = Math.round(v * tintRGB[2] * 255);
      data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, N, N);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

/** Polished supermarket floor: 60 cm porcelain tiles (texture = 2×2 tiles), thin grout. */
export const MARKET_FLOOR_TILE = 1.2;
export const marketFloorMat = (() => {
  const N = 256;
  const tex = makeTex(N, (x, y) => {
    const tx = Math.floor(x / (N / 2));
    const ty = Math.floor(y / (N / 2));
    const lx = x % (N / 2);
    const ly = y % (N / 2);
    const grout = lx < 1 || ly < 1 ? 1 : 0;
    const base = 0.8 + ((tx + ty) % 2) * 0.018 + (noiseHash(tx, ty, 3) - 0.5) * 0.02;
    const speck = (noiseHash(x, y, 9) - 0.5) * 0.05 + (valueNoise(x / 9, y / 9, 4) - 0.5) * 0.04;
    return grout ? 0.6 : base + speck;
  });
  const m = new THREE.MeshStandardMaterial({ map: tex, color: '#c9ccd0', roughness: 0.3, metalness: 0.0 });
  m.name = 'industriale-market-floor';
  return m;
})();

/** Warehouse floor: power-floated concrete with saw-cut joints (texture = one 4 m bay). */
export const WAREHOUSE_FLOOR_TILE = 4;
export const warehouseFloorMat = (() => {
  const N = 256;
  const tex = makeTex(N, (x, y) => {
    const joint = x < 1 || y < 1 ? 1 : 0;
    const mott = (valueNoise(x / 22, y / 22, 1) - 0.5) * 0.09 + (valueNoise(x / 6, y / 6, 2) - 0.5) * 0.035;
    const grain = (noiseHash(x, y, 5) - 0.5) * 0.035;
    // Faint trowel swirls.
    const sw = Math.sin((x + valueNoise(x / 30, y / 30, 7) * 60) / 7) * 0.008;
    return joint ? 0.52 : 0.76 + mott + grain + sw;
  });
  const m = new THREE.MeshStandardMaterial({ map: tex, color: '#b3b6ba', roughness: 0.62, metalness: 0.0 });
  m.name = 'industriale-warehouse-floor';
  return m;
})();

/** Pallet loads: a stack of cartons (texture tile = one carton face with seams). */
export const cartonMat = (() => {
  const N = 64;
  const tex = makeTex(N, (x, y) => {
    const e = Math.min(x, y, N - 1 - x, N - 1 - y);
    const seam = e < 1 ? 0.55 : e < 2 ? 0.78 : 1;
    const flap = Math.abs(y - N * 0.5) < 0.6 ? 0.9 : 1; // centre flap line
    const n = (valueNoise(x / 8, y / 8, 11) - 0.5) * 0.05;
    return (0.86 + n) * seam * flap;
  });
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.88, metalness: 0 });
  m.name = 'industriale-cartons';
  return m;
})();

/** A 1.2 × 1.0 × 0.8 m carton load (3 × 3 × 2 cartons of 40 × 33 × 40), base at y = 0. */
export function cartonLoadGeometry(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(1.2, 1, 0.8);
  g.translate(0, 0.5, 0);
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const uv = g.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + 0.6;
    const y = pos.getY(i);
    const z = pos.getZ(i) + 0.4;
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    if (nx > 0.5) uv.setXY(i, z / 0.4, y / 0.3333);
    else if (ny > 0.5) uv.setXY(i, x / 0.4, z / 0.4);
    else uv.setXY(i, x / 0.4, y / 0.3333);
  }
  uv.needsUpdate = true;
  return g;
}

// ------------------------------------------------------------------ light decals

function gradientTexture(): THREE.DataTexture {
  const N = 64;
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const d = Math.hypot((x + 0.5) / N - 0.5, (y + 0.5) / N - 0.5) * 2;
      let a = Math.max(0, 1 - d);
      a = a * a * (3 - 2 * a);
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

const GRADIENT = gradientTexture();

function glowMaterial(opacity: number, name: string): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({
    map: GRADIENT,
    color: '#ffffff',
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    fog: false,
  });
  m.name = name;
  return m;
}

/** Soft additive light pools on floors (and glows on walls). */
export const GLOW = glowMaterial(0.14, 'industriale-glow');
/** A horizontal decal (light pool), w (x) × d (z) at height y. */
export function decal(p: THREE.Object3D, mat: THREE.Material, w: number, d: number, x: number, y: number, z: number, ry = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.set(-Math.PI / 2, ry, 0, 'YXZ');
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = false;
  p.add(m);
  return m;
}

// ------------------------------------------------------------------ products (instanced)

/** Unit product geometries: 1 × 1 × 1 bounding box, base on y = 0, centred in x/z, front = +Z. */
function bandedBox(): THREE.BufferGeometry {
  const g = new THREE.Group();
  // Back and sides in the body swatch; the front split into three bands (no overlapping faces).
  const body = new THREE.BoxGeometry(1, 1, 1);
  body.translate(0, 0.5, 0);
  // Remove the front face (+Z, group index 4) by keeping the other groups.
  const idx = body.index!;
  const keep: number[] = [];
  for (const gr of body.groups) {
    if (gr.materialIndex === 4) continue;
    for (let i = gr.start; i < gr.start + gr.count; i++) keep.push(idx.getX(i));
  }
  body.setIndex(keep);
  body.clearGroups();
  g.add(new THREE.Mesh(tint(body, 'prodBody')));
  const band = (y0: number, y1: number, key: SwatchKey) => {
    const q = new THREE.PlaneGeometry(1, y1 - y0);
    q.translate(0, (y0 + y1) / 2, 0.5);
    g.add(new THREE.Mesh(tint(q, key)));
  };
  band(0, 0.22, 'prodBody');
  band(0.22, 0.72, 'prodLabel');
  band(0.72, 1, 'prodBody');
  return mergeGroup(g);
}

function lathe(points: Array<[number, number]>, seg: number, key: SwatchKey): THREE.Mesh {
  return new THREE.Mesh(
    tint(
      new THREE.LatheGeometry(
        points.map(([r, y]) => new THREE.Vector2(r, y)),
        seg,
      ),
      key,
    ),
  );
}

function bottleGeo(): THREE.BufferGeometry {
  const g = new THREE.Group();
  const s = 6;
  g.add(lathe([[0.5, 0], [0.5, 0.58]], s, 'prodLabel'));
  g.add(lathe([[0.5, 0.58], [0.17, 0.82]], s, 'prodBody'));
  g.add(lathe([[0.19, 0.82], [0.19, 1], [0, 1]], s, 'prodCap'));
  return mergeGroup(g);
}

function jarGeo(): THREE.BufferGeometry {
  const g = new THREE.Group();
  const s = 6;
  g.add(lathe([[0.5, 0], [0.5, 0.78]], s, 'prodLabel'));
  g.add(lathe([[0.47, 0.78], [0.47, 1], [0, 1]], s, 'prodCap'));
  return mergeGroup(g);
}

function canGeo(): THREE.BufferGeometry {
  const g = new THREE.Group();
  const s = 6;
  g.add(lathe([[0.5, 0], [0.5, 0.96]], s, 'prodLabel'));
  g.add(lathe([[0.5, 0.96], [0, 1]], s, 'prodCap'));
  return mergeGroup(g);
}

export type ProductKind = 'box' | 'bottle' | 'jar' | 'can';

/** Grey tones products are tinted with (multiplied with the palette). */
const TONES = ['#ffffff', '#d3d5d8', '#a9acb0', '#81848a', '#5f6267'].map((c) => new THREE.Color(c));

export interface ProductProfile {
  box?: number;
  bottle?: number;
  jar?: number;
  can?: number;
}

export interface Shelf {
  /** Shelf frame in world space: X along the shelf (0..len), Y up (0 = shelf top), +Z out of the shelf (front edge at 0). */
  frame: THREE.Matrix4;
  len: number;
  depth: number;
  clear: number;
  profile: ProductProfile;
}

/** Collects product instances for every shelf, then builds one InstancedMesh per product kind. */
export class ProductStock {
  private readonly items: Record<ProductKind, { m: THREE.Matrix4[]; c: THREE.Color[] }> = {
    box: { m: [], c: [] },
    bottle: { m: [], c: [] },
    jar: { m: [], c: [] },
    can: { m: [], c: [] },
  };
  /** Blank shelf-edge labels (world matrices of a unit box). */
  readonly labels: THREE.Matrix4[] = [];
  private readonly tmp = new THREE.Matrix4();
  /** Instance counts per kind (dev stats). */
  summary = '';
  private readonly q = new THREE.Quaternion();

  constructor(private readonly rnd: () => number) {}

  private push(kind: ProductKind, frame: THREE.Matrix4, x: number, y: number, z: number, sx: number, sy: number, sz: number, tone: THREE.Color, ry = 0) {
    const local = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), this.q.setFromAxisAngle(UP, ry), new THREE.Vector3(sx, sy, sz));
    this.items[kind].m.push(new THREE.Matrix4().multiplyMatrices(frame, local));
    this.items[kind].c.push(tone);
  }

  private pick(profile: ProductProfile): ProductKind {
    const entries = Object.entries(profile) as Array<[ProductKind, number]>;
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = this.rnd() * total;
    for (const [k, w] of entries) {
      r -= w;
      if (r <= 0) return k;
    }
    return entries[0][0];
  }

  fill(s: Shelf): void {
    const r = this.rnd;
    let u = 0.012;
    while (u < s.len - 0.05) {
      const kind = this.pick(s.profile);
      const tone = TONES[Math.floor(r() * TONES.length)];
      const pull = 0.008 + r() * 0.02; // how far the front row sits behind the shelf edge
      let w: number;
      let h: number;
      let d: number;
      let n: number;
      let rows: number;
      let stack = 1;
      if (kind === 'box') {
        w = 0.07 + r() * 0.15;
        h = Math.min(s.clear - 0.03, 0.14 + r() * 0.2);
        d = Math.min(s.depth / 2 - 0.02, 0.06 + r() * 0.16);
        n = 1 + Math.floor(r() * (w > 0.15 ? 2 : 4));
        rows = 1;
        if (h < 0.16 && s.clear > 2 * h + 0.05) stack = 2;
      } else if (kind === 'bottle') {
        w = 0.065 + r() * 0.035;
        h = Math.min(s.clear - 0.03, 0.22 + r() * 0.12);
        d = w;
        n = 3 + Math.floor(r() * 4);
        rows = 1;
      } else if (kind === 'jar') {
        w = 0.07 + r() * 0.035;
        h = 0.085 + r() * 0.07;
        d = w;
        n = 3 + Math.floor(r() * 4);
        rows = 1;
        if (s.clear > 2 * h + 0.04 && r() < 0.3) stack = 2;
      } else {
        w = 0.066 + r() * 0.01;
        h = 0.1 + r() * 0.025;
        d = w;
        n = 4 + Math.floor(r() * 5);
        rows = 1;
        stack = r() < 0.4 ? Math.max(1, Math.min(2, Math.floor((s.clear - 0.03) / h))) : 1;
      }
      if (h < 0.05) break;
      const gap = kind === 'box' ? 0.004 : 0.006;
      const groupW = n * (w + gap);
      if (u + groupW > s.len - 0.01) {
        n = Math.floor((s.len - 0.01 - u) / (w + gap));
        if (n < 1) break;
      }
      // Occasionally a gap (sold out): skip the group but still print its label.
      const soldOut = r() < 0.05;
      for (let i = 0; i < n && !soldOut; i++) {
        const cx = u + (w + gap) * i + w / 2;
        for (let row = 0; row < rows; row++) {
          const cz = -pull - d / 2 - row * (d + 0.006);
          if (-cz + d / 2 > s.depth) break;
          for (let k = 0; k < stack; k++) {
            const jitter = kind === 'box' ? 0 : (r() - 0.5) * 0.6;
            this.push(kind, s.frame, cx + (r() - 0.5) * 0.004, k * (h + 0.002), cz, w, h, d, tone, jitter);
          }
        }
      }
      // Blank label on the shelf edge under the group.
      const lw = Math.min(0.06, groupW * 0.8);
      this.labels.push(
        new THREE.Matrix4().multiplyMatrices(s.frame, this.tmp.compose(new THREE.Vector3(u + Math.min(groupW, 0.2) / 2, -0.014, 0.0158), this.q.identity(), new THREE.Vector3(lw, 0.026, 1))),
      );
      u += n * (w + gap) + 0.008 + r() * 0.012;
    }
  }

  /** Build the instanced meshes (one per product kind) and the label mesh. */
  build(instanced: (g: THREE.BufferGeometry, m: THREE.Material, mats: THREE.Matrix4[]) => THREE.InstancedMesh, material: THREE.Material): number {
    const geos: Record<ProductKind, () => THREE.BufferGeometry> = { box: bandedBox, bottle: bottleGeo, jar: jarGeo, can: canGeo };
    let tris = 0;
    for (const kind of Object.keys(this.items) as ProductKind[]) {
      const it = this.items[kind];
      if (!it.m.length) continue;
      const g = geos[kind]();
      const im = instanced(g, material, it.m);
      it.c.forEach((c, i) => im.setColorAt(i, c));
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.castShadow = false;
      tris += (g.getAttribute('position').count / 3) * it.m.length;
      this.summary += `${kind} ${it.m.length}×${g.getAttribute('position').count / 3} `;
    }
    if (this.labels.length) {
      const lg = tint(new THREE.PlaneGeometry(1, 1), 'paper');
      const im = instanced(lg, material, this.labels);
      im.castShadow = false;
      tris += 2 * this.labels.length;
    }
    return tris;
  }
}

// ------------------------------------------------------------------ supermarket furniture

export const MOD = 1.25; // gondola module length
const SHELF_D = 0.4;
const BASE_D = 0.47;
const SPINE_X = 0.04; // shelves start this far from the spine centre
export const GONDOLA_W = 2 * (SPINE_X + BASE_D);
export const ENDCAP = 0.45;
const GONDOLA_H = 1.9;
const LEVELS = [0.52, 0.89, 1.26, 1.63];

/** Shelf plate + ticket rail + brackets, in a frame where the shelf runs along X and faces +Z. */
function shelfUnit(p: THREE.Object3D, len: number, depth: number, yTop: number, backZ: number): void {
  const z0 = backZ;
  const z1 = backZ + depth;
  boxMM(p, 'panel', -len / 2, yTop - 0.025, z0, len / 2, yTop, z1);
  // Ticket rail, a little proud of the shelf front.
  boxMM(p, 'light', -len / 2, yTop - 0.036, z1, len / 2, yTop + 0.012, z1 + 0.014);
  // Brackets under the shelf at both ends.
  for (const s of [-1, 1]) {
    const b = new THREE.Shape();
    b.moveTo(0, 0);
    b.lineTo(depth - 0.04, 0);
    b.lineTo(0, -0.1);
    b.closePath();
    const geo = new THREE.ExtrudeGeometry(b, { depth: 0.006, bevelEnabled: false });
    const m = part(p, geo, 'grey', s * (len / 2 - 0.02) - 0.003, yTop - 0.025, z0, 0, -Math.PI / 2, 0);
    m.castShadow = false;
  }
}

export interface GondolaOut {
  group: THREE.Group;
  /** Shelves in the group's local frame (convert with the group's world matrix). */
  shelves: Array<{ local: THREE.Matrix4; len: number; depth: number; clear: number; side: 'a' | 'b' | 'end' }>;
  /** Footprint in local coordinates. */
  foot: { minX: number; maxX: number; minZ: number; maxZ: number };
}

function localFrame(x: number, y: number, z: number, yaw: number): THREE.Matrix4 {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(UP, yaw), new THREE.Vector3(1, 1, 1));
}

/**
 * Double-sided gondola: runs along local Z (−L/2..L/2), shelves face ±X, an end cap at +Z facing +Z.
 */
export function gondola(modules: number, endCap = true): GondolaOut {
  const g = new THREE.Group();
  const L = modules * MOD;
  const W = GONDOLA_W;
  const shelves: GondolaOut['shelves'] = [];
  // Spine and uprights.
  boxMM(g, 'panel', -0.025, 0.11, -L / 2, 0.025, GONDOLA_H, L / 2);
  for (let i = 0; i <= modules; i++) {
    const z = -L / 2 + i * MOD;
    boxMM(g, 'dark', -0.036, 0, z - 0.02, 0.036, GONDOLA_H + 0.02, z + 0.02);
  }
  boxMM(g, 'dark', -0.045, GONDOLA_H, -L / 2, 0.045, GONDOLA_H + 0.035, L / 2);
  for (const s of [1, -1]) {
    // Kick plinth (recessed) and base deck.
    boxMM(g, 'darker', s * SPINE_X, 0, -L / 2, s * (SPINE_X + BASE_D - 0.025), 0.11, L / 2);
    for (let i = 0; i < modules; i++) {
      const zc = -L / 2 + (i + 0.5) * MOD;
      const len = MOD - 0.045;
      const sub = new THREE.Group();
      sub.position.set(0, 0, zc);
      sub.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(sub);
      // Base deck (a deeper shelf on the plinth).
      shelfUnitBase(sub, len, BASE_D, 0.14, SPINE_X);
      shelves.push({ local: localFrame(s * (SPINE_X + BASE_D), 0.14, zc + s * (len / 2), s * (Math.PI / 2)), len, depth: BASE_D - 0.01, clear: LEVELS[0] - 0.025 - 0.14, side: s > 0 ? 'a' : 'b' });
      LEVELS.forEach((y, li) => {
        shelfUnit(sub, len, SHELF_D, y, SPINE_X);
        const clear = li < LEVELS.length - 1 ? LEVELS[li + 1] - 0.025 - y : 0.3;
        shelves.push({ local: localFrame(s * (SPINE_X + SHELF_D), y, zc + s * (len / 2), s * (Math.PI / 2)), len, depth: SHELF_D - 0.01, clear, side: s > 0 ? 'a' : 'b' });
      });
    }
  }
  // Closed end at −Z.
  boxMM(g, 'light', -W / 2, 0, -L / 2 - 0.03, W / 2, GONDOLA_H + 0.035, -L / 2);
  let maxZ = L / 2;
  if (endCap) {
    const z0 = L / 2;
    const z1 = L / 2 + ENDCAP;
    maxZ = z1;
    boxMM(g, 'panel', -W / 2 + 0.03, 0.11, z0, W / 2 - 0.03, GONDOLA_H, z0 + 0.03);
    for (const s of [-1, 1]) boxMM(g, 'light', s * (W / 2) - (s > 0 ? 0.03 : 0), 0, z0, s * (W / 2) + (s < 0 ? 0.03 : 0), GONDOLA_H + 0.035, z1);
    boxMM(g, 'darker', -W / 2 + 0.03, 0, z0 + 0.03, W / 2 - 0.03, 0.11, z1 - 0.025);
    const len = W - 0.07;
    const sub = new THREE.Group();
    sub.position.set(0, 0, 0);
    g.add(sub);
    const deckD = ENDCAP - 0.04;
    boxMM(sub, 'panel', -len / 2, 0.11, z0 + 0.03, len / 2, 0.14, z0 + 0.03 + deckD);
    boxMM(sub, 'light', -len / 2, 0.095, z0 + 0.03 + deckD, len / 2, 0.15, z0 + 0.03 + deckD + 0.014);
    shelves.push({ local: localFrame(-len / 2, 0.14, z0 + 0.03 + deckD, 0), len, depth: deckD - 0.01, clear: LEVELS[0] - 0.025 - 0.14, side: 'end' });
    const cap = new THREE.Group();
    cap.position.set(0, 0, 0);
    g.add(cap);
    LEVELS.forEach((y, li) => {
      const d = ENDCAP - 0.08;
      const inner = new THREE.Group();
      inner.position.z = z0 + 0.03;
      cap.add(inner);
      shelfUnit(inner, len, d, y, 0);
      const clear = li < LEVELS.length - 1 ? LEVELS[li + 1] - 0.025 - y : 0.3;
      shelves.push({ local: localFrame(-len / 2, y, z0 + 0.03 + d, 0), len, depth: d - 0.01, clear, side: 'end' });
    });
    // Top header panel over the end cap (blank).
    boxMM(g, 'white', -W / 2, GONDOLA_H + 0.035, z1 - 0.05, W / 2, GONDOLA_H + 0.22, z1 - 0.02);
    boxMM(g, 'dark', -W / 2, GONDOLA_H + 0.22, z1 - 0.055, W / 2, GONDOLA_H + 0.235, z1 - 0.015);
  }
  return { group: g, shelves, foot: { minX: -W / 2, maxX: W / 2, minZ: -L / 2 - 0.03, maxZ } };
}

/** Base deck: deeper shelf sitting on the plinth, with a ticket rail over the kick. */
function shelfUnitBase(p: THREE.Object3D, len: number, depth: number, yTop: number, backZ: number): void {
  boxMM(p, 'panel', -len / 2, yTop - 0.03, backZ, len / 2, yTop, backZ + depth);
  boxMM(p, 'light', -len / 2, yTop - 0.05, backZ + depth, len / 2, yTop + 0.012, backZ + depth + 0.014);
}

/**
 * Single-sided wall shelving: runs along local X (centred), back against the wall at z = 0,
 * shelves face +Z. Taller than the gondolas.
 */
export function wallShelving(modules: number): GondolaOut {
  const g = new THREE.Group();
  const L = modules * MOD;
  const H = 2.25;
  const levels = [0.5, 0.86, 1.22, 1.58, 1.94];
  const shelves: GondolaOut['shelves'] = [];
  boxMM(g, 'panel', -L / 2, 0.11, 0.005, L / 2, H, 0.035);
  for (let i = 0; i <= modules; i++) {
    const x = -L / 2 + i * MOD;
    boxMM(g, 'dark', x - 0.02, 0, 0.005, x + 0.02, H + 0.02, 0.05);
  }
  boxMM(g, 'darker', -L / 2, 0, 0.035, L / 2, 0.11, 0.035 + BASE_D - 0.025);
  // Header fascia with a fine light line.
  boxMM(g, 'white', -L / 2, H + 0.02, 0.005, L / 2, H + 0.32, 0.06);
  boxMM(g, 'tape', -L / 2, H + 0.05, 0.06, L / 2, H + 0.065, 0.064);
  for (let i = 0; i < modules; i++) {
    const xc = -L / 2 + (i + 0.5) * MOD;
    const len = MOD - 0.045;
    const sub = new THREE.Group();
    sub.position.set(xc, 0, 0);
    g.add(sub);
    shelfUnitBase(sub, len, BASE_D, 0.14, 0.035);
    shelves.push({ local: localFrame(xc - len / 2, 0.14, 0.035 + BASE_D, 0), len, depth: BASE_D - 0.01, clear: levels[0] - 0.025 - 0.14, side: 'a' });
    levels.forEach((y, li) => {
      shelfUnit(sub, len, SHELF_D, y, 0.035);
      const clear = li < levels.length - 1 ? levels[li + 1] - 0.025 - y : 0.28;
      shelves.push({ local: localFrame(xc - len / 2, y, 0.035 + SHELF_D, 0), len, depth: SHELF_D - 0.01, clear, side: 'a' });
    });
  }
  for (const s of [-1, 1]) boxMM(g, 'light', s * L / 2 - (s > 0 ? 0 : 0.025), 0, 0.005, s * L / 2 + (s > 0 ? 0.025 : 0), H + 0.32, 0.035 + BASE_D);
  return { group: g, shelves, foot: { minX: -L / 2 - 0.025, maxX: L / 2 + 0.025, minZ: 0, maxZ: 0.035 + BASE_D + 0.015 } };
}

/**
 * Open-front multideck chiller: runs along local X, back at z = 0, faces +Z. Lit shelves, a
 * canopy with a light strip and an air-curtain grille.
 */
export function chiller(modules: number): GondolaOut {
  const g = new THREE.Group();
  const L = modules * MOD;
  const D = 0.9;
  const H = 2.05;
  const shelves: GondolaOut['shelves'] = [];
  // Body: back, base, canopy.
  boxMM(g, 'white', -L / 2, 0, 0.005, L / 2, H, 0.08);
  boxMM(g, 'darker', -L / 2, 0, 0.08, L / 2, 0.12, D - 0.06);
  boxMM(g, 'white', -L / 2, 0.12, 0.08, L / 2, 0.42, D - 0.02);
  // Air-curtain grille (dark slot) on the deck front and the bumper rail.
  boxMM(g, 'darker', -L / 2, 0.42, D - 0.12, L / 2, 0.425, D - 0.04);
  boxMM(g, 'steel', -L / 2, 0.3, D - 0.02, L / 2, 0.36, D + 0.01);
  boxMM(g, 'panel', -L / 2, 0.42, 0.08, L / 2, 0.44, D - 0.12);
  shelves.push({ local: localFrame(-L / 2 + 0.03, 0.44, D - 0.13, 0), len: L - 0.06, depth: D - 0.25, clear: 0.33, side: 'a' });
  // Canopy.
  boxMM(g, 'white', -L / 2, H - 0.18, 0.08, L / 2, H, 0.62);
  boxMM(g, 'lamp', -L / 2 + 0.02, H - 0.185, 0.47, L / 2 - 0.02, H - 0.18, 0.55);
  boxMM(g, 'darker', -L / 2, H - 0.26, 0.56, L / 2, H - 0.18, 0.64); // night-blind cassette
  const levels = [0.82, 1.17, 1.5];
  const depths = [0.52, 0.46, 0.4];
  levels.forEach((y, i) => {
    const d = depths[i];
    for (let m = 0; m < modules; m++) {
      const xc = -L / 2 + (m + 0.5) * MOD;
      const len = MOD - 0.03;
      boxMM(g, 'panel', xc - len / 2, y - 0.02, 0.08, xc + len / 2, y, 0.08 + d);
      boxMM(g, 'light', xc - len / 2, y - 0.03, 0.08 + d, xc + len / 2, y + 0.02, 0.08 + d + 0.012);
      // Shelf light strip under the front edge.
      boxMM(g, 'lampSoft', xc - len / 2 + 0.02, y - 0.034, 0.08 + d - 0.05, xc + len / 2 - 0.02, y - 0.02, 0.08 + d - 0.02);
      const clear = i < levels.length - 1 ? levels[i + 1] - 0.035 - y : H - 0.26 - y - 0.02;
      shelves.push({ local: localFrame(xc - len / 2, y, 0.08 + d, 0), len, depth: d - 0.02, clear, side: 'a' });
    }
  });
  // Division uprights between modules.
  for (let m = 1; m < modules; m++) boxMM(g, 'light', -L / 2 + m * MOD - 0.015, 0.44, 0.08, -L / 2 + m * MOD + 0.015, H - 0.18, 0.55);
  // Side panels (profile: deep at the base, shallower at the top).
  for (const s of [-1, 1]) {
    const sh = new THREE.Shape();
    sh.moveTo(0.005, 0);
    sh.lineTo(D + 0.01, 0);
    sh.lineTo(D + 0.01, 0.42);
    sh.lineTo(0.66, H);
    sh.lineTo(0.005, H);
    sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false });
    part(g, geo, 'light', s * (L / 2) + (s > 0 ? 0.04 : 0), 0, 0, 0, -Math.PI / 2, 0);
  }
  return { group: g, shelves, foot: { minX: -L / 2 - 0.04, maxX: L / 2 + 0.04, minZ: 0, maxZ: D + 0.02 } };
}

/**
 * Checkout counter: runs along local X (the exit end at −X), customer side +Z, cashier side −Z.
 * 4.0 m long, 0.8 m deep.
 */
export function checkout(): THREE.Group {
  const g = new THREE.Group();
  const d = 0.8;
  const x0 = -2;
  const x1 = 2;
  const xw = -1.1; // bagging well | cashier section
  // Body with a dark plinth: low bagging well at the exit end, full height elsewhere.
  boxMM(g, 'darker', x0 + 0.03, 0, -d / 2 + 0.03, x1 - 0.03, 0.1, d / 2 - 0.03);
  boxMM(g, 'white', xw, 0.1, -d / 2, x1, 0.84, d / 2);
  boxMM(g, 'white', x0, 0.1, -d / 2, xw, 0.72, d / 2);
  boxMM(g, 'tape', x0, 0.62, d / 2, x1, 0.635, d / 2 + 0.003);
  // Worktop (steel) and the conveyor on the entry half.
  boxMM(g, 'steel', xw, 0.84, -d / 2, x1, 0.86, d / 2);
  boxMM(g, 'belt', -0.2, 0.86, -0.25, x1 - 0.06, 0.875, 0.3);
  for (const z of [-0.27, 0.32]) boxMM(g, 'steelDark', -0.2, 0.86, z - 0.02, x1 - 0.03, 0.9, z + 0.02);
  boxMM(g, 'steelDark', x1 - 0.06, 0.86, -0.25, x1 - 0.03, 0.9, 0.3);
  // Belt dividers.
  for (const x of [0.6, 1.4]) {
    const tri = new THREE.Shape();
    tri.moveTo(-0.025, 0);
    tri.lineTo(0.025, 0);
    tri.lineTo(0, 0.04);
    tri.closePath();
    part(g, new THREE.ExtrudeGeometry(tri, { depth: 0.4, bevelEnabled: false }), 'grey', x, 0.875, -0.2);
  }
  // Scanner: flat glass in the top plus a small tower.
  boxMM(g, 'glassDark', -0.62, 0.86, -0.18, -0.3, 0.864, 0.18);
  boxMM(g, 'darker', -0.62, 0.86, -0.32, -0.3, 1.02, -0.2);
  boxMM(g, 'glassDark', -0.6, 0.9, -0.2, -0.32, 1.0, -0.196);
  // Bagging well: steel tray, a raised rim at the exit end and bag hooks.
  boxMM(g, 'steelDark', x0 + 0.04, 0.72, -d / 2 + 0.04, xw, 0.735, d / 2 - 0.04);
  boxMM(g, 'white', x0, 0.72, -d / 2, x0 + 0.04, 0.95, d / 2);
  boxMM(g, 'white', x0 + 0.04, 0.72, -d / 2, xw, 0.8, -d / 2 + 0.04);
  boxMM(g, 'white', x0 + 0.04, 0.72, d / 2 - 0.04, xw, 0.8, d / 2);
  rod(g, 'steel', [x0 + 0.1, 1.05, d / 2 - 0.08], [x0 + 0.1, 1.05, -d / 2 + 0.08], 0.01);
  for (const z of [-d / 2 + 0.08, d / 2 - 0.08]) rod(g, 'steel', [x0 + 0.1, 0.95, z], [x0 + 0.1, 1.05, z], 0.01);
  // POS: screen on a pole facing the cashier, customer display facing +Z.
  cyl(g, 'steelDark', 0.018, 0.34, -0.95, 0.86, -0.25, 8);
  boxMM(g, 'darker', -1.13, 1.18, -0.3, -0.77, 1.42, -0.26);
  boxMM(g, 'screenOn', -1.11, 1.2, -0.304, -0.79, 1.4, -0.3).castShadow = false;
  boxMM(g, 'darker', -1.05, 1.2, -0.26, -0.85, 1.32, -0.22);
  boxMM(g, 'screen', -1.03, 1.215, -0.22, -0.87, 1.305, -0.217);
  // Keyboard and cash drawer.
  boxMM(g, 'darker', -1.06, 0.86, -0.38, -0.7, 0.885, -0.26);
  boxMM(g, 'dark', -1.06, 0.5, -d / 2 - 0.012, -0.64, 0.64, -d / 2);
  boxMM(g, 'darker', -0.9, 0.56, -d / 2 - 0.02, -0.8, 0.58, -d / 2 - 0.012);
  // Card terminal on a short arm at the customer side.
  cyl(g, 'steelDark', 0.012, 0.18, -0.9, 0.86, 0.3, 6);
  boxMM(g, 'darker', -0.96, 1.04, 0.26, -0.84, 1.06, 0.4);
  boxMM(g, 'screen', -0.94, 1.06, 0.33, -0.86, 1.064, 0.38);
  // Cashier chair.
  const ch = new THREE.Group();
  ch.position.set(-0.8, 0, -0.95);
  g.add(ch);
  chair(ch);
  return g;
}

/** Swivel chair (cashier / QC stool), front +Z. */
export function chair(g: THREE.Object3D, back = true): void {
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    bar(g, 'darker', [0, 0.06, 0], [Math.sin(a) * 0.28, 0.04, Math.cos(a) * 0.28], 0.03);
    cyl(g, 'black', 0.025, 0.04, Math.sin(a) * 0.28, 0, Math.cos(a) * 0.28, 8);
  }
  cyl(g, 'steelDark', 0.025, 0.4, 0, 0.06, 0, 8);
  rbox(g, 'dark', 0.44, 0.07, 0.42, 0.03, 0, 0.46, 0, 2);
  if (back) {
    rbox(g, 'dark', 0.4, 0.34, 0.06, 0.03, 0, 0.62, -0.2, 2);
    bar(g, 'darker', [0, 0.49, -0.19], [0, 0.66, -0.2], 0.03);
  }
}

/** Plastic shopping trolley (for ctx.instanced), 0.55 × 0.9 m, front (basket nose) +Z. */
export function trolleyGeometry(): THREE.BufferGeometry {
  const g = new THREE.Group();
  // Basket: tapered in plan (wide at the back) and a sloping floor, so nested copies never share planes.
  const back = -0.36;
  const front = 0.46;
  const wb = 0.28;
  const wf = 0.23;
  const yb = 0.58;
  const yf = 0.53;
  const top = 0.95;
  const wall = (a: V3, b: V3, c: V3, d: V3, key: SwatchKey) => {
    const geo = new THREE.BufferGeometry();
    const v = [...a, ...b, ...c, ...a, ...c, ...d];
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    geo.computeVertexNormals();
    part(g, geo, key);
    // Double-sided by adding the reverse triangles.
    const geo2 = new THREE.BufferGeometry();
    geo2.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...c, ...b, ...a, ...d, ...c], 3));
    geo2.computeVertexNormals();
    part(g, geo2, key);
  };
  // Side walls.
  for (const s of [-1, 1]) wall([s * wb, yb, back], [s * wf, yf, front], [s * (wf + 0.02), top - 0.04, front + 0.03], [s * (wb + 0.02), top, back], 'grey');
  wall([-wf, yf, front], [wf, yf, front], [wf + 0.02, top - 0.04, front + 0.03], [-wf - 0.02, top - 0.04, front + 0.03], 'grey');
  wall([-wb, yb, back], [-wf, yf, front], [wf, yf, front], [wb, yb, back], 'mid');
  // Back flap (child seat), slightly lower.
  wall([-wb, yb + 0.05, back + 0.01], [wb, yb + 0.05, back + 0.01], [wb + 0.02, top - 0.02, back], [-wb - 0.02, top - 0.02, back], 'mid');
  // Rim.
  tube(g, 'dark', [[-wb - 0.02, top, back], [-wf - 0.02, top - 0.04, front + 0.03], [wf + 0.02, top - 0.04, front + 0.03], [wb + 0.02, top, back]], 0.012, 0.04, 5);
  // Chassis: handle, back uprights, base frame, lower tray, casters.
  tube(g, 'steel', [[-0.26, 0.12, -0.3], [-0.27, 1.02, -0.5], [0.27, 1.02, -0.5], [0.26, 0.12, -0.3]], 0.014, 0.05, 6);
  rod(g, 'darker', [-0.25, 1.02, -0.5], [0.25, 1.02, -0.5], 0.02, 8);
  tube(g, 'steel', [[-0.24, 0.12, -0.3], [-0.2, 0.12, 0.42], [0.2, 0.12, 0.42], [0.24, 0.12, -0.3]], 0.012, 0.05, 5);
  for (const s of [-1, 1]) rod(g, 'steel', [s * 0.25, 0.12, -0.28], [s * 0.26, yb, back + 0.04], 0.01);
  for (const s of [-1, 1]) rod(g, 'steel', [s * 0.21, 0.12, 0.38], [s * 0.22, yf, front - 0.05], 0.01);
  boxMM(g, 'mid', -0.2, 0.14, -0.2, 0.2, 0.155, 0.3);
  for (const [x, z] of [
    [-0.23, -0.3],
    [0.23, -0.3],
    [-0.19, 0.4],
    [0.19, 0.4],
  ]) {
    boxMM(g, 'steelDark', x - 0.012, 0.06, z - 0.02, x + 0.012, 0.12, z + 0.02);
    part(g, new THREE.CylinderGeometry(0.05, 0.05, 0.03, 10), 'rubber', x, 0.05, z, 0, 0, Math.PI / 2);
  }
  return mergeGroup(g);
}

/** Stack of hand baskets on a small stand (static). */
export function basketStack(n = 6): THREE.Group {
  const g = new THREE.Group();
  boxMM(g, 'darker', -0.25, 0, -0.17, 0.25, 0.08, 0.17);
  for (let i = 0; i < n; i++) {
    const y = 0.08 + i * 0.055;
    const sx = 0.42 + i * 0.0015;
    const sz = 0.3 + i * 0.0015;
    // Tapered open basket: floor + 4 walls leaning out.
    boxMM(g, 'grey', -sx / 2 + 0.03, y, -sz / 2 + 0.03, sx / 2 - 0.03, y + 0.01, sz / 2 - 0.03);
    for (const s of [-1, 1]) {
      part(g, new THREE.BoxGeometry(0.008, 0.22, sz), 'grey', s * (sx / 2 - 0.012), y + 0.11, 0, 0, 0, s * -0.12);
      part(g, new THREE.BoxGeometry(sx, 0.22, 0.008), 'grey', 0, y + 0.11, s * (sz / 2 - 0.012), s * 0.12, 0, 0);
    }
  }
  // Handles of the top basket.
  const yt = 0.08 + (n - 1) * 0.055 + 0.22;
  for (const s of [-1, 1]) tube(g, 'darker', [[s * 0.2, yt - 0.02, -0.03], [s * 0.2, yt + 0.12, -0.03], [s * 0.2, yt + 0.12, 0.03], [s * 0.2, yt - 0.02, 0.03]], 0.008, 0.03, 5);
  return g;
}

/**
 * Serve-over deli counter: runs along local X, customer side +Z, 1.1 m deep. Sloped glass front,
 * a lit display deck with trays of grey produce, a staff ledge at the back. Returns glass parts
 * separately (they use the shared glass material).
 */
export function deliCounter(len: number, glass: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const d = 1.1;
  const zf = d / 2;
  const zb = -d / 2;
  boxMM(g, 'darker', -len / 2 + 0.02, 0, zb + 0.05, len / 2 - 0.02, 0.1, zf - 0.04);
  // Front panel with a thin light line and a steel kick rail.
  boxMM(g, 'white', -len / 2, 0.1, zb, len / 2, 0.86, zf);
  boxMM(g, 'tape', -len / 2, 0.8, zf, len / 2, 0.815, zf + 0.003);
  boxMM(g, 'steel', -len / 2, 0.12, zf, len / 2, 0.2, zf + 0.012);
  // Display deck (dark well) and trays.
  boxMM(g, 'darker', -len / 2 + 0.04, 0.86, zb + 0.18, len / 2 - 0.04, 0.88, zf - 0.08);
  const trayZ = [zf - 0.3, zf - 0.62];
  let seed = 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let x = -len / 2 + 0.12; x < len / 2 - 0.3; x += 0.46) {
    for (const tz of trayZ) {
      boxMM(g, 'steel', x, 0.88, tz - 0.14, x + 0.42, 0.9, tz + 0.14);
      const kind = Math.floor(r() * 4);
      if (kind === 0) {
        // Cheese wheel cut open.
        cyl(g, 'cheese', 0.15, 0.09, x + 0.21, 0.9, tz, 16);
        boxMM(g, 'produceC', x + 0.3, 0.9, tz - 0.04, x + 0.4, 0.97, tz + 0.08);
      } else if (kind === 1) {
        // Cured meats: rounded logs.
        for (let i = 0; i < 3; i++) part(g, new THREE.CapsuleGeometry(0.04, 0.26, 3, 8), i % 2 ? 'meat' : 'produceB', x + 0.21, 0.94, tz - 0.08 + i * 0.08, 0, 0, Math.PI / 2);
      } else if (kind === 2) {
        // Blocks.
        for (let i = 0; i < 4; i++) rbox(g, i % 2 ? 'cheese' : 'produceC', 0.08, 0.06 + r() * 0.04, 0.2, 0.01, x + 0.06 + i * 0.1, 0.9, tz);
      } else {
        // Small pieces heaped.
        for (let i = 0; i < 7; i++) sphere(g, 'meat', 0.035 + r() * 0.015, x + 0.06 + r() * 0.3, 0.925, tz - 0.08 + r() * 0.16, 7, 5);
      }
    }
  }
  // Sloped front glass and the top glass shelf (shared transparent material).
  const front = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.04, 0.52), glass);
  front.position.set(0, 1.1, zf - 0.14);
  front.rotation.x = -0.52;
  g.add(front);
  const topG = new THREE.Mesh(new THREE.BoxGeometry(len - 0.04, 0.012, 0.64), glass);
  topG.position.set(0, 1.34, zb + 0.51);
  g.add(topG);
  // Glass end panes.
  for (const s of [-1, 1]) {
    const sh = new THREE.Shape();
    sh.moveTo(zb + 0.18, 0);
    sh.lineTo(zf - 0.02, 0);
    sh.lineTo(zf - 0.28, 0.46);
    sh.lineTo(zb + 0.18, 0.48);
    sh.closePath();
    const pane = new THREE.Mesh(new THREE.ShapeGeometry(sh), glass);
    pane.rotation.y = -Math.PI / 2;
    pane.position.set(s * (len / 2 - 0.02), 0.86, 0);
    g.add(pane);
    boxMM(g, 'steelDark', s * (len / 2 - 0.01) - 0.01, 0.86, zb + 0.16, s * (len / 2 - 0.01) + 0.01, 1.34, zb + 0.2);
  }
  // Rear: light canopy bar over the deck and the staff ledge.
  boxMM(g, 'white', -len / 2, 1.34, zb + 0.14, len / 2, 1.42, zb + 0.2);
  boxMM(g, 'lamp', -len / 2 + 0.03, 1.335, zb + 0.15, len / 2 - 0.03, 1.34, zb + 0.19);
  boxMM(g, 'top', -len / 2, 0.86, zb - 0.06, len / 2, 0.9, zb + 0.18);
  // Price-tag spikes (blank) in the trays.
  for (let x = -len / 2 + 0.2; x < len / 2 - 0.2; x += 0.46) {
    rod(g, 'steel', [x + 0.1, 0.9, zf - 0.18], [x + 0.1, 0.99, zf - 0.18], 0.003, 4);
    boxMM(g, 'paper', x + 0.07, 0.99, zf - 0.185, x + 0.13, 1.03, zf - 0.18);
  }
  return g;
}

/** Deli back counter against a wall: runs along X, back at z = 0, faces +Z. */
export function deliBackCounter(len: number): THREE.Group {
  const g = new THREE.Group();
  const d = 0.6;
  boxMM(g, 'darker', -len / 2 + 0.02, 0, 0.02, len / 2 - 0.02, 0.1, d - 0.05);
  boxMM(g, 'white', -len / 2, 0.1, 0.005, len / 2, 0.88, d);
  for (let x = -len / 2 + 0.5; x < len / 2; x += 0.5) boxMM(g, 'seam', x - 0.003, 0.14, d, x + 0.003, 0.84, d + 0.003);
  boxMM(g, 'steel', -len / 2, 0.88, 0.005, len / 2, 0.92, d + 0.02);
  // Tiled splash-back panel with grout lines.
  boxMM(g, 'tile', -len / 2, 0.92, 0.005, len / 2, 2.3, 0.02);
  for (let y = 1.07; y < 2.3; y += 0.15) boxMM(g, 'seam', -len / 2, y - 0.002, 0.02, len / 2, y + 0.002, 0.022);
  for (let x = -len / 2 + 0.15; x < len / 2; x += 0.15) boxMM(g, 'seam', x - 0.002, 0.92, 0.02, x + 0.002, 2.3, 0.022);
  // Wall shelves with jars and cheese wheels.
  for (const y of [1.55, 1.95]) {
    boxMM(g, 'steel', -len / 2 + 0.2, y - 0.02, 0.022, len / 2 - 0.2, y, 0.32);
    for (let x = -len / 2 + 0.35; x < len / 2 - 0.3; x += 0.34) {
      if (y < 1.7) cyl(g, 'cheese', 0.13, 0.11, x, y, 0.17, 14);
      else for (let i = 0; i < 3; i++) cyl(g, i === 1 ? 'prodLabel' : 'prodGlass', 0.04, 0.12, x - 0.09 + i * 0.09, y, 0.14, 8);
    }
  }
  // Slicer: body, round blade with guard, carriage.
  const sl = new THREE.Group();
  sl.position.set(-len / 2 + 0.7, 0.92, 0.3);
  sl.rotation.y = 0.3;
  g.add(sl);
  rbox(sl, 'white', 0.5, 0.12, 0.4, 0.03, 0, 0, 0, 2);
  rbox(sl, 'white', 0.14, 0.32, 0.22, 0.04, -0.16, 0.1, -0.05, 2);
  part(sl, new THREE.CylinderGeometry(0.15, 0.15, 0.012, 24), 'chrome', 0.0, 0.3, 0.06, Math.PI / 2, 0, 0);
  part(sl, new THREE.CylinderGeometry(0.155, 0.155, 0.02, 24, 1, true, 0, Math.PI), 'white', 0.0, 0.3, 0.05, Math.PI / 2, 0, Math.PI / 2);
  boxMM(sl, 'steel', 0.02, 0.12, 0.02, 0.24, 0.2, 0.18);
  // Wrapping station: roll + stacked trays.
  cyl(g, 'steelDark', 0.05, 0.02, len / 2 - 0.9, 0.92, 0.3, 10);
  part(g, new THREE.CylinderGeometry(0.05, 0.05, 0.45, 12), 'paper', len / 2 - 0.9, 1.0, 0.3, 0, 0, Math.PI / 2);
  for (let i = 0; i < 6; i++) boxMM(g, 'white', len / 2 - 0.5, 0.92 + i * 0.012, 0.15, len / 2 - 0.25, 0.93 + i * 0.012, 0.45);
  return g;
}

/** Produce display table with tilted crates of grey fruit/vegetables. Runs along X, faces ±Z. */
export function produceTable(len: number, rnd: () => number): { group: THREE.Group; fruit: Array<{ m: THREE.Matrix4; key: number }> } {
  const g = new THREE.Group();
  const d = 1.2;
  const fruit: Array<{ m: THREE.Matrix4; key: number }> = [];
  // Base and a stepped top (two tilted tiers back to back).
  boxMM(g, 'darker', -len / 2 + 0.03, 0, -d / 2 + 0.03, len / 2 - 0.03, 0.1, d / 2 - 0.03);
  boxMM(g, 'light', -len / 2, 0.1, -d / 2, len / 2, 0.62, d / 2);
  boxMM(g, 'white', -len / 2 - 0.02, 0.6, -d / 2 - 0.02, len / 2 + 0.02, 0.64, d / 2 + 0.02);
  boxMM(g, 'white', -len / 2, 0.64, -0.2, len / 2, 0.98, 0.2);
  const crates = Math.round(len / 0.42);
  const cw = len / crates;
  for (const s of [-1, 1]) {
    const tier = new THREE.Group();
    tier.position.set(0, 0.76, s * 0.2);
    tier.rotation.x = s * 0.28;
    g.add(tier);
    for (let i = 0; i < crates; i++) {
      const x = -len / 2 + (i + 0.5) * cw;
      const inner = cw - 0.03;
      const cz = s * 0.2;
      // Crate: floor + 4 walls (open top).
      boxMM(tier, 'crate', x - inner / 2, 0.01, cz - 0.19, x + inner / 2, 0.025, cz + 0.19);
      for (const e of [-1, 1]) {
        boxMM(tier, 'crate', x + e * (inner / 2) - 0.01, 0.01, cz - 0.2, x + e * (inner / 2) + 0.01, 0.13, cz + 0.2);
        boxMM(tier, 'crate', x - inner / 2, 0.01, cz + e * 0.2 - 0.01, x + inner / 2, 0.13, cz + e * 0.2 + 0.01);
      }
      // Fruit: a heap of low-poly spheres.
      const key = Math.floor(rnd() * 3);
      const rad = 0.035 + rnd() * 0.02;
      tier.updateMatrix();
      for (let k = 0; k < 11; k++) {
        const fx = x + (rnd() - 0.5) * (inner - 2 * rad);
        const fz = cz + (rnd() - 0.5) * (0.38 - 2 * rad);
        const fy = 0.025 + rad + (k > 10 ? rad * 1.3 : 0) + rnd() * 0.01;
        const m = new THREE.Matrix4().compose(new THREE.Vector3(fx, fy, fz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, 0)), new THREE.Vector3(rad, rad * (0.85 + rnd() * 0.3), rad));
        fruit.push({ m: new THREE.Matrix4().multiplyMatrices(tier.matrix, m), key });
      }
    }
  }
  return { group: g, fruit };
}

// ------------------------------------------------------------------ warehouse

export const RACK = {
  depth: 1.1,
  bay: 2.7,
  post: 0.09,
  height: 6.0,
  levels: [1.55, 3.05, 4.55],
};

/**
 * Pallet racking: runs along local Z from −len/2 to +len/2 (the +Z end has column guards),
 * `frames` = 1 (single, aisle at +X) or 2 (back to back, aisles at ±X). Returns the group and
 * the pallet positions (local: centre x/z, beam-top y, facing sign).
 */
export function rack(bays: number, frames: 1 | 2): { group: THREE.Group; len: number; width: number; slots: Array<{ x: number; y: number; z: number; face: number }> } {
  const g = new THREE.Group();
  const P = RACK.post;
  const len = bays * RACK.bay + (bays + 1) * P;
  const slots: Array<{ x: number; y: number; z: number; face: number }> = [];
  const frameXs = frames === 1 ? [0] : [-(RACK.depth / 2 + 0.05), RACK.depth / 2 + 0.05];
  const width = frames === 1 ? RACK.depth : RACK.depth * 2 + 0.1;
  frameXs.forEach((fx, fi) => {
    const face = frames === 1 ? 1 : fi === 0 ? -1 : 1;
    const px = [fx - RACK.depth / 2 + 0.04, fx + RACK.depth / 2 - 0.04];
    for (let i = 0; i <= bays; i++) {
      const z = -len / 2 + P / 2 + i * (RACK.bay + P);
      for (const x of px) {
        boxMM(g, 'upright', x - 0.035, 0, z - P / 2, x + 0.035, RACK.height, z + P / 2);
        boxMM(g, 'steelDark', x - 0.06, 0, z - 0.07, x + 0.06, 0.012, z + 0.07);
      }
      // Frame bracing: horizontals top/bottom and a zig-zag of diagonals.
      boxMM(g, 'upright', px[0] + 0.035, 0.12, z - 0.015, px[1] - 0.035, 0.15, z + 0.015);
      boxMM(g, 'upright', px[0] + 0.035, RACK.height - 0.15, z - 0.015, px[1] - 0.035, RACK.height - 0.12, z + 0.015);
      const ys = [0.15, 1.1, 2.05, 3.0, 3.95, 4.9, 5.85];
      for (let k = 0; k < ys.length - 1; k++) {
        const a = k % 2 === 0 ? px[0] + 0.035 : px[1] - 0.035;
        const b = k % 2 === 0 ? px[1] - 0.035 : px[0] + 0.035;
        bar(g, 'upright', [a, ys[k], z], [b, ys[k + 1], z], 0.025);
      }
      // Column guards at the +Z (aisle) end on the aisle-facing post.
      if (i === bays) {
        const gx = face > 0 ? px[1] : px[0];
        boxMM(g, 'guard', gx - 0.075, 0, z + P / 2, gx + 0.075, 0.45, z + P / 2 + 0.012);
        boxMM(g, 'guard', gx + (face > 0 ? 0.035 : -0.047), 0, z - P / 2, gx + (face > 0 ? 0.047 : -0.035), 0.45, z + P / 2 + 0.012);
        for (const y of [0.12, 0.3]) boxMM(g, 'hazard', gx - 0.078, y, z + P / 2 + 0.002, gx + 0.078, y + 0.06, z + P / 2 + 0.016);
      }
    }
    // Beams (front and back) per bay and level.
    for (let i = 0; i < bays; i++) {
      const z0 = -len / 2 + P + i * (RACK.bay + P);
      const zc = z0 + RACK.bay / 2;
      for (const y of RACK.levels) {
        for (const x of px) boxMM(g, 'beam', x - 0.025, y - 0.11, z0, x + 0.025, y, z0 + RACK.bay);
        for (const dz of [-0.9, 0, 0.9]) slots.push({ x: fx, y, z: zc + dz, face });
      }
      for (const dz of [-0.9, 0, 0.9]) slots.push({ x: fx, y: 0, z: zc + dz, face });
    }
  });
  return { group: g, len, width, slots };
}

/** EUR pallet 1.2 (x) × 0.8 (z) × 0.144, base at y = 0. `detail` adds blocks and bottom boards. */
export function palletGeometry(detail: boolean): THREE.BufferGeometry {
  const g = new THREE.Group();
  const top = 0.144;
  if (detail) {
    for (let i = 0; i < 5; i++) {
      const z = -0.3275 + i * 0.16375;
      const w = i === 0 || i === 4 || i === 2 ? 0.145 : 0.1;
      boxMM(g, 'wood', -0.6, top - 0.022, z - w / 2, 0.6, top, z + w / 2);
    }
    for (const x of [-0.5275, 0, 0.5275]) boxMM(g, 'woodDark', x - 0.0725, 0.1, -0.4, x + 0.0725, top - 0.022, 0.4);
    for (const x of [-0.5275, 0, 0.5275]) for (const z of [-0.3275, 0, 0.3275]) boxMM(g, 'wood', x - 0.0725, 0.022, z - 0.05, x + 0.0725, 0.1, z + 0.05);
    for (const z of [-0.3275, 0, 0.3275]) boxMM(g, 'woodDark', -0.6, 0, z - 0.05, 0.6, 0.022, z + 0.05);
  } else {
    // Rack pallets: a deck slab; the 0.8 m face shows three block rows with the fork openings.
    boxMM(g, 'wood', -0.6, top - 0.022, -0.4, 0.6, top, 0.4);
    for (const z of [-0.3275, 0, 0.3275]) boxMM(g, 'woodDark', -0.6, 0, z - 0.0725, 0.6, top - 0.022, z + 0.0725);
  }
  return mergeGroup(g);
}

/** Industrial high-bay pendant: housing + glowing disc + cable to the ceiling. Origin = lamp bottom. */
export function highBay(g: THREE.Object3D, x: number, y: number, z: number, ceiling: number): void {
  cyl(g, 'steelDark', 0.26, 0.2, x, y + 0.012, z, 16, 0.14);
  cyl(g, 'darker', 0.09, 0.12, x, y + 0.21, z, 10);
  const disc = cyl(g, 'lamp', 0.235, 0.012, x, y, z, 16);
  disc.castShadow = false;
  rod(g, 'darker', [x, y + 0.33, z], [x, ceiling, z], 0.006, 4);
}

/** Suspended linear luminaire along X (length len), bottom at y. */
export function linearLight(g: THREE.Object3D, len: number, x: number, y: number, z: number, ceiling: number, ry = 0, cables: THREE.Object3D = g): void {
  const s = new THREE.Group();
  s.position.set(x, 0, z);
  s.rotation.y = ry;
  g.add(s);
  boxMM(s, 'white', -len / 2, y + 0.008, -0.06, len / 2, y + 0.07, 0.06);
  const l = boxMM(s, 'lamp', -len / 2 + 0.02, y, -0.045, len / 2 - 0.02, y + 0.008, 0.045);
  l.castShadow = false;
  const c = new THREE.Group();
  c.position.copy(s.position);
  c.rotation.copy(s.rotation);
  cables.add(c);
  for (const e of [-1, 1]) rod(c, 'darker', [e * (len / 2 - 0.3), y + 0.07, 0], [e * (len / 2 - 0.3), ceiling, 0], 0.004, 4);
}

/** Workbench: steel frame, laminate top, drawer unit, back panel with tools, shelf. Along X, front +Z, back at z=0. */
export function workbench(len: number): THREE.Group {
  const g = new THREE.Group();
  const d = 0.75;
  const h = 0.9;
  for (const x of [-len / 2 + 0.04, len / 2 - 0.04]) {
    for (const z of [0.06, d - 0.06]) boxMM(g, 'steelDark', x - 0.025, 0.02, z - 0.025, x + 0.025, h - 0.04, z + 0.025);
    boxMM(g, 'steelDark', x - 0.02, 0.12, 0.06, x + 0.02, 0.16, d - 0.06);
    boxMM(g, 'rubber', x - 0.035, 0, 0.03, x + 0.035, 0.02, d - 0.03);
  }
  boxMM(g, 'steelDark', -len / 2 + 0.04, h - 0.1, d - 0.08, len / 2 - 0.04, h - 0.04, d - 0.04);
  boxMM(g, 'laminate', -len / 2, h - 0.04, 0.01, len / 2, h, d);
  boxMM(g, 'darker', -len / 2, h - 0.042, d, len / 2, h - 0.002, d + 0.006);
  boxMM(g, 'mid', -len / 2 + 0.06, 0.16, 0.08, len / 2 - 0.06, 0.18, d - 0.06);
  // Drawer unit under the right end.
  const dx0 = len / 2 - 0.55;
  boxMM(g, 'grey', dx0, 0.18, 0.08, len / 2 - 0.07, h - 0.1, d - 0.06);
  for (let i = 0; i < 4; i++) {
    const y0 = 0.2 + i * 0.145;
    boxMM(g, 'light', dx0 + 0.015, y0, d - 0.06, len / 2 - 0.085, y0 + 0.13, d - 0.045);
    boxMM(g, 'darker', dx0 + 0.18, y0 + 0.09, d - 0.045, len / 2 - 0.25, y0 + 0.105, d - 0.03);
  }
  // Perforated back panel (holes suggested by a dark grid of dots) with tools.
  boxMM(g, 'light', -len / 2, h, 0.005, len / 2, h + 0.9, 0.025);
  for (let y = h + 0.08; y < h + 0.86; y += 0.08) for (let x = -len / 2 + 0.06; x < len / 2 - 0.04; x += 0.08) boxMM(g, 'mid', x - 0.005, y - 0.005, 0.025, x + 0.005, y + 0.005, 0.0265);
  // Tools: spanners, screwdrivers, a hammer, a caliper.
  const tx0 = -len / 2 + 0.25;
  for (let i = 0; i < 5; i++) {
    const x = tx0 + i * 0.07;
    bar(g, 'steel', [x, h + 0.45, 0.035], [x, h + 0.62 + i * 0.02, 0.035], 0.012, 0.004);
    part(g, new THREE.TorusGeometry(0.018 + i * 0.002, 0.005, 4, 10, Math.PI * 1.4), 'steel', x, h + 0.64 + i * 0.02, 0.035, 0, 0, Math.PI * 0.8);
  }
  for (let i = 0; i < 4; i++) {
    const x = tx0 + 0.45 + i * 0.06;
    cyl(g, i % 2 ? 'darker' : 'dark', 0.013, 0.1, x, h + 0.55, 0.04, 6);
    rod(g, 'chrome', [x, h + 0.42, 0.04], [x, h + 0.55, 0.04], 0.003, 4);
  }
  bar(g, 'darker', [tx0 + 0.8, h + 0.4, 0.04], [tx0 + 0.8, h + 0.66, 0.04], 0.022, 0.022);
  boxMM(g, 'steelDark', tx0 + 0.74, h + 0.66, 0.02, tx0 + 0.86, h + 0.7, 0.06);
  boxMM(g, 'steel', tx0 + 1.0, h + 0.4, 0.03, tx0 + 1.02, h + 0.7, 0.036);
  boxMM(g, 'steel', tx0 + 1.0, h + 0.66, 0.03, tx0 + 1.08, h + 0.675, 0.036);
  // Shelf above with binders (blank spines) and small boxes.
  boxMM(g, 'steelDark', -len / 2, h + 0.9, 0.005, len / 2, h + 0.92, 0.3);
  for (let i = 0; i < 9; i++) {
    const x = len / 2 - 0.2 - i * 0.065;
    boxMM(g, i % 3 === 0 ? 'dark' : i % 3 === 1 ? 'grey' : 'light', x - 0.03, h + 0.92, 0.04, x + 0.03, h + 1.22, 0.28);
  }
  for (let i = 0; i < 3; i++) boxMM(g, 'mid', -len / 2 + 0.1 + i * 0.26, h + 0.92, 0.05, -len / 2 + 0.34 + i * 0.26, h + 1.06, 0.27);
  // Light strip under the shelf.
  const ls = boxMM(g, 'lamp', -len / 2 + 0.05, h + 0.885, 0.2, len / 2 - 0.05, h + 0.9, 0.26);
  ls.castShadow = false;
  // Anti-static mat on the top.
  boxMM(g, 'esd', -len / 2 + 0.3, h, 0.25, len / 2 - 0.6, h + 0.004, d - 0.08);
  return g;
}

/** Calibration weight (knob type, stainless), base at y=0, total height h. */
export function knobWeight(g: THREE.Object3D, x: number, y: number, z: number, h: number, key: SwatchKey = 'chrome'): void {
  const r = h * 0.3;
  cyl(g, key, r, h * 0.72, x, y, z, 14);
  cyl(g, key, r * 0.45, h * 0.1, x, y + h * 0.72, z, 10);
  sphere(g, key, r * 0.55, x, y + h * 0.88, z, 10, 6);
}

/** Wooden-look case (grey) with a set of calibration weights, lid open. Local origin at base centre. */
export function weightCase(): THREE.Group {
  const g = new THREE.Group();
  const w = 0.42;
  const d = 0.26;
  boxMM(g, 'dark', -w / 2, 0, -d / 2, w / 2, 0.06, d / 2);
  boxMM(g, 'esd', -w / 2 + 0.015, 0.06, -d / 2 + 0.015, w / 2 - 0.015, 0.062, d / 2 - 0.015);
  const lid = new THREE.Group();
  lid.position.set(0, 0.06, -d / 2);
  lid.rotation.x = -1.9;
  g.add(lid);
  boxMM(lid, 'dark', -w / 2, 0, 0, w / 2, 0.02, d);
  boxMM(lid, 'esd', -w / 2 + 0.015, 0.02, 0.015, w / 2 - 0.015, 0.022, d - 0.015);
  const hs = [0.1, 0.085, 0.07, 0.06, 0.05, 0.045, 0.04, 0.035];
  hs.forEach((h, i) => knobWeight(g, -w / 2 + 0.035 + i * 0.05, 0.062, -0.03 + (i % 2) * 0.07, h));
  return g;
}

/** Cast-iron rectangular test weight (e.g. 500 kg) with a handle bar; base at y=0, along X. */
export function testBlock(g: THREE.Object3D, x: number, z: number, ry: number, s = 1): void {
  const b = new THREE.Group();
  b.position.set(x, 0, z);
  b.rotation.y = ry;
  b.scale.setScalar(s);
  g.add(b);
  rbox(b, 'darker', 0.52, 0.22, 0.26, 0.012, 0, 0, 0, 2);
  for (const e of [-1, 1]) rbox(b, 'darker', 0.1, 0.1, 0.26, 0.012, e * 0.21, 0.2, 0, 2);
  // Handle bar across the top recess.
  rod(b, 'steelDark', [-0.17, 0.27, 0], [0.17, 0.27, 0], 0.02, 8);
  // Adjustment cavity plug on one shoulder.
  cyl(b, 'steelDark', 0.022, 0.004, 0.21, 0.3, 0, 10);
}

/** Tall steel cabinet with two doors, back at z=0, front +Z. */
export function cabinet(g: THREE.Object3D, w: number, h: number, d: number): void {
  boxMM(g, 'light', -w / 2, 0.05, 0.005, w / 2, h, d);
  boxMM(g, 'darker', -w / 2 + 0.02, 0, 0.03, w / 2 - 0.02, 0.05, d - 0.03);
  boxMM(g, 'seam', -0.003, 0.08, d, 0.003, h - 0.03, d + 0.002);
  for (const s of [-1, 1]) {
    boxMM(g, 'darker', s * 0.035 - 0.008, h * 0.45, d, s * 0.035 + 0.008, h * 0.55, d + 0.02);
    // Vent slots.
    for (let i = 0; i < 4; i++) boxMM(g, 'seam', s * (w / 4) - 0.08, h - 0.2 - i * 0.03, d, s * (w / 4) + 0.08, h - 0.19 - i * 0.03, d + 0.002);
  }
}

/** Sectional dock door, closed, with frame, leveller plate and hazard edges. Along X, wall at z=0, front +Z. */
export function dockDoor(g: THREE.Object3D, w: number, h: number): void {
  // Frame posts and header.
  for (const s of [-1, 1]) boxMM(g, 'steelDark', s * (w / 2) - 0.08, 0, 0.0, s * (w / 2) + 0.08, h + 0.1, 0.12);
  boxMM(g, 'steelDark', -w / 2 - 0.08, h, 0, w / 2 + 0.08, h + 0.5, 0.35);
  // Door panels with grooves.
  const n = 5;
  const ph = h / n;
  for (let i = 0; i < n; i++) {
    const y0 = i * ph;
    boxMM(g, 'wall', -w / 2 + 0.08, y0 + 0.006, 0.02, w / 2 - 0.08, y0 + ph - 0.006, 0.07);
    boxMM(g, 'seam', -w / 2 + 0.08, y0 + ph - 0.006, 0.03, w / 2 - 0.08, y0 + ph + 0.006, 0.06);
    for (const x of [-w / 4, w / 4]) boxMM(g, 'seam', x - 0.003, y0 + 0.05, 0.07, x + 0.003, y0 + ph - 0.05, 0.072);
  }
  // Vision windows in the second panel from the top.
  for (let i = 0; i < 4; i++) {
    const x = -w / 2 + 0.45 + i * ((w - 0.9) / 3);
    boxMM(g, 'glassDark', x - 0.25, h - 2 * ph + 0.12, 0.07, x + 0.25, h - ph - 0.12, 0.074);
  }
  boxMM(g, 'rubber', -w / 2 + 0.08, 0, 0.02, w / 2 - 0.08, 0.03, 0.08);
  // Shaft torsion bar and guide rails above (inside).
  rod(g, 'steelDark', [-w / 2, h + 0.35, 0.28], [w / 2, h + 0.35, 0.28], 0.03, 8);
  // Dock leveller plate in the floor with hazard edges and a lip.
  boxMM(g, 'steelDark', -w / 2 + 0.1, 0, 0.1, w / 2 - 0.1, 0.012, 2.4);
  for (let x = -w / 2 + 0.3; x < w / 2 - 0.2; x += 0.25) boxMM(g, 'steel', x - 0.002, 0.012, 0.2, x + 0.002, 0.014, 2.3);
  for (const s of [-1, 1]) {
    const n2 = 10;
    for (let i = 0; i < n2; i++) boxMM(g, i % 2 ? 'hazard' : 'guard', s * (w / 2 - 0.1) - 0.05, 0, 0.1 + i * 0.23, s * (w / 2 - 0.1) + 0.05, 0.014, 0.1 + (i + 1) * 0.23);
  }
  // Control box on the wall beside the door.
  boxMM(g, 'light', w / 2 + 0.2, 1.3, 0, w / 2 + 0.45, 1.65, 0.12);
  for (let i = 0; i < 3; i++) part(g, new THREE.CylinderGeometry(0.018, 0.018, 0.016, 10), i === 1 ? 'darker' : 'grey', w / 2 + 0.325, 1.4 + i * 0.08, 0.128, Math.PI / 2, 0, 0);
}

/**
 * Upright fridge with glass doors: runs along local X (doors × 0.75 m), back at z = 0, faces +Z.
 * Glass panes use the shared transparent glass material; products behind show through.
 */
export function uprightFridge(doors: number, glass: THREE.Material): GondolaOut {
  const g = new THREE.Group();
  const dw = 0.75;
  const L = doors * dw;
  const D = 0.72;
  const H = 2.1;
  const shelves: GondolaOut['shelves'] = [];
  boxMM(g, 'white', -L / 2 - 0.04, 0, 0.005, -L / 2, H + 0.3, D);
  boxMM(g, 'white', L / 2, 0, 0.005, L / 2 + 0.04, H + 0.3, D);
  boxMM(g, 'panel', -L / 2, 0.12, 0.005, L / 2, H, 0.05);
  boxMM(g, 'darker', -L / 2, 0, 0.05, L / 2, 0.12, D - 0.03);
  boxMM(g, 'white', -L / 2, H, 0.005, L / 2, H + 0.3, D);
  boxMM(g, 'tape', -L / 2 - 0.04, H + 0.05, D, L / 2 + 0.04, H + 0.065, D + 0.004);
  boxMM(g, 'panel', -L / 2, 0.12, 0.05, L / 2, 0.16, D - 0.06);
  shelves.push({ local: localFrame(-L / 2 + 0.02, 0.16, D - 0.07, 0), len: L - 0.04, depth: D - 0.14, clear: 0.3, side: 'a' });
  const levels = [0.5, 0.86, 1.22, 1.58];
  levels.forEach((y, i) => {
    boxMM(g, 'glassDark', -L / 2, y - 0.015, 0.05, L / 2, y, D - 0.07);
    const clear = i < levels.length - 1 ? levels[i + 1] - 0.02 - y : H - 0.05 - y;
    shelves.push({ local: localFrame(-L / 2 + 0.02, y, D - 0.07, 0), len: L - 0.04, depth: D - 0.14, clear, side: 'a' });
  });
  // Door frames, panes, handles and the light strips on the mullions.
  for (let i = 0; i < doors; i++) {
    const x0 = -L / 2 + i * dw;
    const x1 = x0 + dw;
    const zf = D;
    boxMM(g, 'steelDark', x0, 0.12, zf, x0 + 0.04, H, zf + 0.04);
    boxMM(g, 'steelDark', x1 - 0.04, 0.12, zf, x1, H, zf + 0.04);
    boxMM(g, 'steelDark', x0 + 0.04, 0.12, zf, x1 - 0.04, 0.18, zf + 0.04);
    boxMM(g, 'steelDark', x0 + 0.04, H - 0.06, zf, x1 - 0.04, H, zf + 0.04);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(dw - 0.08, H - 0.24), glass);
    pane.position.set((x0 + x1) / 2, 0.18 + (H - 0.24) / 2, zf + 0.02);
    g.add(pane);
    boxMM(g, 'chrome', x1 - 0.1, 0.8, zf + 0.04, x1 - 0.08, 1.5, zf + 0.07);
    if (i > 0) boxMM(g, 'lamp', x0 - 0.01, 0.2, D - 0.06, x0 + 0.01, H - 0.05, D - 0.04).castShadow = false;
  }
  return { group: g, shelves, foot: { minX: -L / 2 - 0.04, maxX: L / 2 + 0.04, minZ: 0, maxZ: D + 0.08 } };
}

/**
 * Electric counterbalance forklift, parked with the forks down. Origin at the chassis centre on
 * the floor, forks towards +Z (they reach z ≈ 1.85). About 1.05 × 2.8 × 2.15 m.
 */
export function forklift(): THREE.Group {
  const g = new THREE.Group();
  // Chassis, counterweight, battery hood and seat.
  rbox(g, 'grey', 1.0, 0.5, 1.3, 0.06, 0, 0.17, -0.1, 2);
  rbox(g, 'dark', 1.04, 0.78, 0.42, 0.1, 0, 0.12, -0.93, 2);
  rbox(g, 'grey', 0.82, 0.26, 0.66, 0.05, 0, 0.66, -0.2, 2);
  rbox(g, 'darker', 0.5, 0.1, 0.46, 0.04, 0, 0.92, -0.25, 2);
  rbox(g, 'darker', 0.48, 0.42, 0.08, 0.04, 0, 1.0, -0.5, 2);
  // Cowl, steering column and wheel.
  rbox(g, 'dark', 0.9, 0.36, 0.26, 0.05, 0, 0.66, 0.4, 2);
  rod(g, 'darker', [0, 0.98, 0.42], [0, 1.25, 0.24], 0.025, 8);
  part(g, new THREE.TorusGeometry(0.15, 0.016, 6, 20), 'black', 0, 1.27, 0.22, -Math.PI / 2 + 0.55, 0, 0);
  // Wheels: big drive wheels at the front, steer wheels at the rear.
  for (const s of [-1, 1]) {
    part(g, new THREE.CylinderGeometry(0.23, 0.23, 0.2, 18), 'rubber', s * 0.42, 0.23, 0.42, 0, 0, Math.PI / 2);
    part(g, new THREE.CylinderGeometry(0.12, 0.12, 0.205, 12), 'steelDark', s * 0.42, 0.23, 0.42, 0, 0, Math.PI / 2);
    part(g, new THREE.CylinderGeometry(0.19, 0.19, 0.16, 16), 'rubber', s * 0.38, 0.19, -0.62, 0, 0, Math.PI / 2);
    part(g, new THREE.CylinderGeometry(0.09, 0.09, 0.165, 10), 'steelDark', s * 0.38, 0.19, -0.62, 0, 0, Math.PI / 2);
  }
  // Overhead guard: four posts, a frame and slats; a beacon on top.
  const gy = 2.12;
  for (const [x, z] of [
    [-0.45, 0.5],
    [0.45, 0.5],
    [-0.45, -0.72],
    [0.45, -0.72],
  ]) bar(g, 'darker', [x, 0.66, z], [x * 0.98, gy, z + (z > 0 ? -0.05 : 0.02)], 0.055, 0.055);
  boxMM(g, 'darker', -0.48, gy, -0.74, 0.48, gy + 0.05, 0.48);
  for (let i = 0; i < 6; i++) {
    const x = -0.36 + i * 0.144;
    boxMM(g, 'darker', x - 0.02, gy + 0.05, -0.72, x + 0.02, gy + 0.08, 0.46);
  }
  cyl(g, 'darker', 0.05, 0.03, 0.3, gy + 0.08, -0.6, 10);
  cyl(g, 'guard', 0.042, 0.08, 0.3, gy + 0.11, -0.6, 10);
  // Mast: two channels, cross members, lift cylinder and chains.
  for (const s of [-1, 1]) boxMM(g, 'darker', s * 0.3 - 0.05, 0.08, 0.62, s * 0.3 + 0.05, 2.1, 0.76);
  boxMM(g, 'darker', -0.35, 0.3, 0.64, 0.35, 0.38, 0.74);
  boxMM(g, 'darker', -0.35, 1.98, 0.64, 0.35, 2.08, 0.74);
  cyl(g, 'steelDark', 0.045, 1.6, 0, 0.35, 0.66, 10);
  cyl(g, 'chrome', 0.025, 0.2, 0, 1.95, 0.66, 8);
  for (const s of [-1, 1]) boxMM(g, 'steelDark', s * 0.14 - 0.015, 0.45, 0.72, s * 0.14 + 0.015, 2.0, 0.745);
  // Carriage with load backrest, forks resting on the floor.
  boxMM(g, 'darker', -0.46, 0.08, 0.77, 0.46, 0.5, 0.82);
  for (let i = 0; i < 5; i++) {
    const x = -0.4 + i * 0.2;
    boxMM(g, 'darker', x - 0.015, 0.5, 0.78, x + 0.015, 1.2, 0.81);
  }
  boxMM(g, 'darker', -0.46, 1.17, 0.77, 0.46, 1.21, 0.82);
  for (const s of [-1, 1]) {
    boxMM(g, 'steelDark', s * 0.26 - 0.05, 0.01, 0.82, s * 0.26 + 0.05, 0.46, 0.87);
    boxMM(g, 'steelDark', s * 0.26 - 0.05, 0.004, 0.87, s * 0.26 + 0.05, 0.05, 1.85);
  }
  // Rear lamp strip and a mirror arm on the guard.
  boxMM(g, 'lampSoft', -0.3, 0.72, -1.145, 0.3, 0.76, -1.14);
  return g;
}
