import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/**
 * Props for the MEDICALE wing (clinic / small hospital).
 *
 * Every static part shares ONE palette material: a 1-pixel-high colour / emissive / roughness-
 * metalness strip, each part's UVs point at its swatch. The static batcher keeps UVs, so the walls,
 * furniture, curtains and fittings of the whole wing merge into a single draw call. Transparent
 * glass uses the shared building glass material (passed in), the light decals their own additive
 * material. Greys only, the wayfinding band included: the division blue appears on logos only.
 *
 * Builders return groups in local coordinates, metres: origin = centre of the footprint on the
 * floor (wall fittings: on the wall surface), front = +Z. Place them, then hand them to
 * ctx.addStatic.
 */

interface Swatch {
  c: string;
  r: number;
  m?: number;
  /** Emissive colour (sRGB). */
  e?: string;
}

const SWATCHES = {
  wall: { c: '#c9cbce', r: 0.92 },
  dado: { c: '#b4b7bb', r: 0.5 },
  white: { c: '#eceef0', r: 0.42 },
  light: { c: '#d9dbde', r: 0.55 },
  laminate: { c: '#bdbfc2', r: 0.42 },
  mid: { c: '#a1a4a8', r: 0.65 },
  grey: { c: '#7b7e83', r: 0.65 },
  dark: { c: '#4a4d52', r: 0.6 },
  darker: { c: '#2e3135', r: 0.5 },
  black: { c: '#161719', r: 0.22 },
  rubber: { c: '#222427', r: 0.92 },
  steel: { c: '#c8ccd0', r: 0.26, m: 0.9 },
  steelDark: { c: '#6c7076', r: 0.38, m: 0.85 },
  chrome: { c: '#e6e8ea', r: 0.08, m: 1 },
  floorCorr: { c: '#8f9296', r: 0.42 },
  floorRoom: { c: '#a9acb0', r: 0.5 },
  floorLine: { c: '#6d7074', r: 0.55 },
  skirting: { c: '#55585d', r: 0.5 },
  uph: { c: '#5b5f64', r: 0.82 },
  uphLight: { c: '#9b9fa4', r: 0.86 },
  curtain: { c: '#cdd0d4', r: 0.96 },
  curtainFold: { c: '#a3a7ac', r: 0.97 },
  curtainMesh: { c: '#e9eaeb', r: 0.97 },
  curtainMeshFold: { c: '#c3c6ca', r: 0.97 },
  paper: { c: '#f6f6f4', r: 0.9 },
  linen: { c: '#e5e7ea', r: 0.95 },
  labTop: { c: '#3a3d42', r: 0.3 },
  water: { c: '#c9d0d6', r: 0.08, m: 0.1 },
  glassDark: { c: '#5d6369', r: 0.06, m: 0.4 },
  leafA: { c: '#7b8185', r: 0.85 },
  leafB: { c: '#5e6367', r: 0.85 },
  soil: { c: '#393b3e', r: 1 },
  window: { c: '#e4e7ea', r: 0.3, e: '#aeb2b7' },
  lamp: { c: '#ffffff', r: 1, e: '#ffffff' },
  lampSoft: { c: '#f0f1f2', r: 1, e: '#a4a7ab' },
  screen: { c: '#1b1e22', r: 0.1, e: '#121417' },
  screenOn: { c: '#2c3137', r: 0.2, e: '#4a5058' },
  film: { c: '#34383d', r: 0.3, e: '#3a3e44' },
  filmBone: { c: '#a8acb1', r: 0.3, e: '#9a9ea3' },
  // Wayfinding band, floor tape, counter line: a darker grey (the building stays grey).
  band: { c: '#8a8e94', r: 0.5 },
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

/** The one material for every static medicale part. */
export const PROP = (() => {
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
  m.name = 'medicale-props';
  return m;
})();

/**
 * Clones of the palette material (shared textures). The batcher merges per material, so parts
 * given different clones end up in separate merged meshes that are frustum-culled on their own.
 */
export function propCluster(i: number): THREE.MeshStandardMaterial {
  CLUSTERS[i] ??= Object.assign(PROP.clone(), { name: `medicale-props-${i}` });
  return CLUSTERS[i];
}
const CLUSTERS: THREE.MeshStandardMaterial[] = [];

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

function gradientTexture(kind: 'radial' | 'wash'): THREE.DataTexture {
  const N = 64;
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = (x + 0.5) / N;
      const v = (y + 0.5) / N;
      let a: number;
      if (kind === 'radial') {
        const d = Math.hypot(u - 0.5, v - 0.5) * 2;
        a = Math.max(0, 1 - d);
        a = a * a * (3 - 2 * a);
      } else {
        // Scallop from a downlight near the ceiling: an arched top edge, brightest just under
        // it, fading down the wall and to the sides.
        const t = 1 - v; // 0 at the top
        const s = Math.abs(u - 0.5) * 2;
        const arch = 0.06 + 0.55 * s * s;
        const rise = THREE.MathUtils.smoothstep(t, arch, arch + 0.16);
        const fall = Math.pow(Math.max(0, 1 - t), 1.6);
        const side = Math.pow(Math.max(0, 1 - s * s), 2);
        a = rise * fall * side;
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

function glowMaterial(tex: THREE.Texture, opacity: number, name: string): THREE.MeshBasicMaterial {
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

/** Soft additive light pool (floors) and wall wash (above fittings). */
export const GLOW = glowMaterial(gradientTexture('radial'), 0.16, 'medicale-glow');
export const WASH = glowMaterial(gradientTexture('wash'), 0.13, 'medicale-wash');

/** A horizontal light pool, w (x) × d (z) metres at height y. */
export function lightPool(p: THREE.Object3D, w: number, d: number, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), GLOW);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = false;
  p.add(m);
  return m;
}

/** A vertical wall wash facing +Z in local space (bright edge at the top). */
export function wallWash(p: THREE.Object3D, w: number, h: number, x: number, y0: number, z: number, ry = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), WASH);
  m.position.set(x, y0 + h / 2, z);
  m.rotation.y = ry;
  m.castShadow = m.receiveShadow = false;
  p.add(m);
  return m;
}

// ------------------------------------------------------------------ primitive helpers

export function part(p: THREE.Object3D, geo: THREE.BufferGeometry, key: SwatchKey, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): THREE.Mesh {
  const m = new THREE.Mesh(tint(geo, key), PROP);
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

/** Rounded box with its BOTTOM at y0. */
export function rbox(p: THREE.Object3D, key: SwatchKey, w: number, h: number, d: number, r: number, x: number, y0: number, z: number, seg = 1): THREE.Mesh {
  return part(p, new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.999), key, x, y0 + h / 2, z);
}

/** Vertical cylinder with its BOTTOM at y0. */
export function cylY(p: THREE.Object3D, key: SwatchKey, r: number, h: number, x: number, y0: number, z: number, seg = 12, rBottom = r): THREE.Mesh {
  return part(p, new THREE.CylinderGeometry(r, rBottom, h, seg), key, x, y0 + h / 2, z);
}

type V3 = [number, number, number];
const UP = new THREE.Vector3(0, 1, 0);

/** Cylinder between two points (rods, tubes, legs). */
export function rod(p: THREE.Object3D, key: SwatchKey, a: V3, b: V3, r: number, seg = 8): THREE.Mesh {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const dir = vb.clone().sub(va);
  const len = dir.length();
  const m = part(p, new THREE.CylinderGeometry(r, r, len, seg, 1, false), key);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  return m;
}

export function sphere(p: THREE.Object3D, key: SwatchKey, r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, ws = 12, hs = 8): THREE.Mesh {
  const m = part(p, new THREE.SphereGeometry(r, ws, hs), key, x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}

export function torus(p: THREE.Object3D, key: SwatchKey, R: number, t: number, x: number, y: number, z: number, rx = 0, ry = 0, arc = Math.PI * 2, rs = 8, ts = 28): THREE.Mesh {
  return part(p, new THREE.TorusGeometry(R, t, rs, ts, arc), key, x, y, z, rx, ry);
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

/** Bent tube along a polyline (rounded bends), capped with small spheres. */
export function tube(p: THREE.Object3D, key: SwatchKey, pts: V3[], r: number, bend = r * 3, radial = 6, caps = true): THREE.Mesh {
  const v = pts.map((q) => new THREE.Vector3(...q));
  const path = roundedPath(v, bend);
  const segs = Math.max(3, Math.min(48, Math.round(path.getLength() / 0.14) + (pts.length - 2) * 4));
  const m = part(p, new THREE.TubeGeometry(path, segs, r, radial, false), key);
  if (caps) {
    for (const e of [v[0], v[v.length - 1]]) sphere(p, key, r, e.x, e.y, e.z, 1, 1, 1, radial, 4);
  }
  return m;
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
  return out;
}

// ------------------------------------------------------------------ curtains

/**
 * Pleated hospital curtain hanging along local +X from x = 0 to `len`, between y0 and y1:
 * a thin wavy slab (both faces lit), with the usual open mesh band at the top.
 */
export function curtain(p: THREE.Object3D, len: number, y0: number, y1: number, opts: { amp?: number; wave?: number; mesh?: number } = {}): THREE.Group {
  const g = new THREE.Group();
  const amp = opts.amp ?? 0.045;
  const wave = opts.wave ?? 0.17;
  const meshH = Math.min(opts.mesh ?? 0.42, (y1 - y0) * 0.4);
  const n = Math.max(6, Math.round((len / wave) * 6));
  const sheet = (h: number, light: SwatchKey, dark: SwatchKey, y: number) => {
    const m = new THREE.Mesh(pleatSheet(len, h, amp, wave, n, light, dark), PROP);
    m.position.y = y;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  };
  sheet(y1 - y0 - meshH, 'curtain', 'curtainFold', y0);
  sheet(meshH, 'curtainMesh', 'curtainMeshFold', y1 - meshH);
  // Gliders on the track.
  for (let x = 0.04; x < len; x += 0.16) box(g, 'steelDark', 0.012, 0.035, 0.012, x, y1, 0);
  p.add(g);
  return g;
}

/**
 * Zero-thickness pleated sheet along +X (0..len), height h: front and back faces, smooth normals.
 * The recessed half of each pleat takes the darker swatch (baked fold shading).
 */
function pleatSheet(len: number, h: number, amp: number, wave: number, n: number, light: SwatchKey, dark: SwatchKey): THREE.BufferGeometry {
  const k = (Math.PI * 2) / wave;
  const pos: number[] = [];
  const nor: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  const uL = (KEYS.indexOf(light) + 0.5) / TEX_W;
  const uD = (KEYS.indexOf(dark) + 0.5) / TEX_W;
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * len;
      const z = amp * Math.sin(x * k);
      const dz = amp * k * Math.cos(x * k);
      const l = Math.hypot(dz, 1);
      const recess = z * side < -amp * 0.35;
      for (const y of [0, h]) {
        pos.push(x, y, z);
        nor.push((-dz / l) * side, 0, (1 / l) * side);
        uvs.push(recess ? uD : uL, 0.5);
      }
    }
    for (let i = 0; i < n; i++) {
      const a = base + i * 2;
      if (side > 0) idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      else idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  return geo;
}

/** Ceiling-hung curtain track along a polyline (x,z pairs) at height y, rods up to the ceiling. */
export function curtainTrack(p: THREE.Object3D, pts: Array<[number, number]>, y: number, ceiling: number): void {
  tube(
    p,
    'steel',
    pts.map(([x, z]) => [x, y, z] as V3),
    0.012,
    0.3,
    6,
    true,
  );
  // Hanger rods: at the corners and about every 1.3 m.
  const hangers: Array<[number, number]> = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / 1.3));
    for (let k = i === 0 ? 0 : 1; k <= n; k++) {
      const t = k / n;
      // Keep hangers off the rounded corners.
      const tt = THREE.MathUtils.clamp(t, 0.35 / len, 1 - 0.35 / len);
      hangers.push([ax + (bx - ax) * (k === 0 && i === 0 ? 0.02 : tt), az + (bz - az) * (k === 0 && i === 0 ? 0.02 : tt)]);
    }
  }
  for (const [x, z] of hangers) {
    rod(p, 'steel', [x, y + 0.01, z], [x, ceiling, z], 0.006, 5);
    cylY(p, 'white', 0.035, 0.012, x, ceiling - 0.012, z, 10);
  }
}

// ------------------------------------------------------------------ wall fittings (origin on the wall, facing +Z)

/** Frosted window (daylight panel): origin at the bottom centre of the pane on the wall face. */
export function frostedWindow(w: number, h: number): THREE.Group {
  const g = new THREE.Group();
  const f = 0.06;
  box(g, 'window', w, h, 0.01, 0, 0, 0.012);
  // Frame, transom, mullion.
  box(g, 'white', w + 2 * f, f, 0.06, 0, h, 0.02);
  box(g, 'white', w + 2 * f, f, 0.06, 0, -f, 0.02);
  box(g, 'white', f, h, 0.06, -w / 2 - f / 2, 0, 0.02);
  box(g, 'white', f, h, 0.06, w / 2 + f / 2, 0, 0.02);
  box(g, 'white', w, 0.045, 0.05, 0, h * 0.7, 0.025);
  box(g, 'white', 0.045, h * 0.7, 0.05, 0, 0, 0.025);
  // Handles.
  box(g, 'steel', 0.02, 0.12, 0.03, -0.08, h * 0.35, 0.065);
  // Sill.
  box(g, 'laminate', w + 0.2, 0.025, 0.16, 0, -f - 0.025, 0.08);
  return g;
}

/** X-ray light box (negatoscope) with two chest films. Origin: bottom centre on the wall. */
export function negatoscope(w = 0.84, h = 0.52): THREE.Group {
  const g = new THREE.Group();
  rbox(g, 'white', w, h, 0.07, 0.01, 0, 0, 0.035);
  box(g, 'lamp', w - 0.06, h - 0.1, 0.004, 0, 0.07, 0.071);
  for (const sx of [-1, 1]) {
    const cx = sx * (w / 4 - 0.01);
    box(g, 'film', w / 2 - 0.08, h - 0.14, 0.003, cx, 0.09, 0.075);
    // Ribs: soft light arcs on the dark film (a few thin bars).
    for (let i = 0; i < 6; i++) {
      const y = 0.16 + i * 0.045;
      box(g, 'filmBone', 0.13 - Math.abs(i - 2) * 0.012, 0.009, 0.002, cx - 0.075, y, 0.0775);
      box(g, 'filmBone', 0.13 - Math.abs(i - 2) * 0.012, 0.009, 0.002, cx + 0.075, y, 0.0775);
    }
    box(g, 'filmBone', 0.016, 0.3, 0.002, cx, 0.12, 0.0775); // spine
  }
  // Clip rail and switch.
  box(g, 'steel', w - 0.04, 0.02, 0.02, 0, h - 0.04, 0.078);
  box(g, 'grey', 0.03, 0.03, 0.012, w / 2 - 0.05, 0.02, 0.073);
  return g;
}

/** Wall hand-rub dispenser. Origin: on the wall at the bottom of the unit. */
export function sanitizer(): THREE.Group {
  const g = new THREE.Group();
  rbox(g, 'white', 0.11, 0.25, 0.1, 0.015, 0, 0, 0.05);
  rbox(g, 'grey', 0.07, 0.07, 0.02, 0.008, 0, 0.14, 0.098);
  box(g, 'glassDark', 0.02, 0.07, 0.004, 0, 0.05, 0.1);
  box(g, 'darker', 0.06, 0.015, 0.05, 0, -0.04, 0.045);
  return g;
}

/** Wall clock with tick marks only. Origin: centre on the wall. */
export function clock(r = 0.16): THREE.Group {
  const g = new THREE.Group();
  const face = part(g, new THREE.CylinderGeometry(r, r, 0.035, 32), 'white', 0, 0, 0.0175, Math.PI / 2);
  face.castShadow = false;
  torus(g, 'steelDark', r, 0.012, 0, 0, 0.03, 0, 0, Math.PI * 2, 6, 40);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const long = i % 3 === 0;
    const m = box(g, 'darker', 0.008, long ? 0.035 : 0.02, 0.003, Math.sin(a) * (r - 0.03), 0, 0.037, 0);
    m.position.y = Math.cos(a) * (r - 0.03);
    m.rotation.z = -a;
  }
  const hand = (len: number, wd: number, a: number, z: number, key: SwatchKey) => {
    const m = part(g, new THREE.BoxGeometry(wd, len, 0.003), key, 0, 0, z);
    m.geometry.translate(0, len / 2 - 0.015, 0);
    m.rotation.z = -a;
  };
  hand(r * 0.55, 0.012, 1.9, 0.04, 'darker');
  hand(r * 0.82, 0.008, 5.3, 0.043, 'darker');
  hand(r * 0.86, 0.003, 3.4, 0.046, 'grey');
  return g;
}

/** Bed-head service unit: trunking with gas outlets, sockets and an up-lighter strip. Origin: bottom centre on the wall. */
export function bedHeadUnit(w = 1.7): THREE.Group {
  const g = new THREE.Group();
  rbox(g, 'white', w, 0.24, 0.075, 0.012, 0, 0, 0.0375);
  box(g, 'lampSoft', w - 0.1, 0.01, 0.03, 0, 0.24, 0.035);
  box(g, 'mid', w, 0.012, 0.078, 0, 0.09, 0.039);
  for (let i = 0; i < 3; i++) {
    const x = -w / 2 + 0.2 + i * 0.14;
    part(g, new THREE.CylinderGeometry(0.022, 0.022, 0.035, 14), 'steel', x, 0.16, 0.09, Math.PI / 2);
    torus(g, 'grey', 0.028, 0.005, x, 0.16, 0.078, 0, 0, Math.PI * 2, 5, 18);
  }
  for (let i = 0; i < 4; i++) {
    const x = w / 2 - 0.16 - i * 0.1;
    box(g, 'light', 0.075, 0.075, 0.008, x, 0.1, 0.079);
    box(g, 'darker', 0.03, 0.012, 0.002, x, 0.135, 0.084);
  }
  // Nurse-call handset on its cord holder.
  rbox(g, 'grey', 0.05, 0.12, 0.035, 0.01, -w / 2 + 0.7, 0.03, 0.095);
  return g;
}

/** Corridor bumper handrail along local X (length len), mounted on the wall at z = 0. */
export function handrail(p: THREE.Object3D, len: number, x: number, z: number, ry: number, y = 0.84): void {
  const g = new THREE.Group();
  rbox(g, 'mid', len, 0.13, 0.035, 0.012, 0, y, 0.055);
  box(g, 'dado', len - 0.04, 0.03, 0.004, 0, y + 0.05, 0.073);
  const n = Math.max(2, Math.round(len / 1.1) + 1);
  for (let i = 0; i < n; i++) {
    const bx = -len / 2 + 0.15 + (i / (n - 1)) * (len - 0.3);
    box(g, 'steel', 0.03, 0.05, 0.04, bx, y + 0.04, 0.02);
  }
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  p.add(g);
}

// ------------------------------------------------------------------ doors

/**
 * Steel door frame for an opening of width w and height h in a wall of thickness t.
 * Origin: opening centre on the floor, wall centre plane at z = 0, opening along X.
 */
export function doorFrame(w: number, h: number, t: number, key: SwatchKey = 'grey'): THREE.Group {
  const g = new THREE.Group();
  const f = 0.05;
  const d = t + 0.03;
  for (const sx of [-1, 1]) {
    box(g, key, 0.025, h, d, sx * (w / 2 - 0.0125), 0, 0);
    for (const sz of [-1, 1]) box(g, key, f, h + f, 0.012, sx * (w / 2 + f / 2 - 0.012), 0, sz * (t / 2 + 0.006));
  }
  box(g, key, w, 0.025, d, 0, h - 0.025, 0);
  for (const sz of [-1, 1]) box(g, key, w + 2 * f - 0.024, f, 0.012, 0, h, sz * (t / 2 + 0.006));
  // Threshold strip.
  box(g, 'steel', w, 0.006, t + 0.06, 0, 0, 0);
  return g;
}

/** Door leaf (laminate, kick plates, vision panel, levers). Origin: hinge edge at x = 0, leaf along +X, centred on z. */
export function doorLeaf(w: number, h: number, glass: THREE.Material, vision = true): THREE.Group {
  const g = new THREE.Group();
  const t = 0.045;
  const W = w - 0.01;
  if (vision) {
    // Leaf with a vision panel: frame pieces around the glass.
    const gx0 = W * 0.3;
    const gx1 = W * 0.7;
    const gy0 = h * 0.52;
    const gy1 = h * 0.86;
    box(g, 'light', gx0, h, t, gx0 / 2, 0, 0);
    box(g, 'light', W - gx1, h, t, (gx1 + W) / 2, 0, 0);
    box(g, 'light', gx1 - gx0, gy0, t, (gx0 + gx1) / 2, 0, 0);
    box(g, 'light', gx1 - gx0, h - gy1, t, (gx0 + gx1) / 2, gy1, 0);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(gx1 - gx0, gy1 - gy0, 0.012), glass);
    pane.position.set((gx0 + gx1) / 2, (gy0 + gy1) / 2, 0);
    g.add(pane);
    for (const sz of [-1, 1]) {
      box(g, 'grey', gx1 - gx0 + 0.03, 0.015, 0.008, (gx0 + gx1) / 2, gy0 - 0.015, sz * (t / 2 + 0.004));
      box(g, 'grey', gx1 - gx0 + 0.03, 0.015, 0.008, (gx0 + gx1) / 2, gy1, sz * (t / 2 + 0.004));
      box(g, 'grey', 0.015, gy1 - gy0, 0.008, gx0 - 0.0075, gy0, sz * (t / 2 + 0.004));
      box(g, 'grey', 0.015, gy1 - gy0, 0.008, gx1 + 0.0075, gy0, sz * (t / 2 + 0.004));
    }
  } else {
    box(g, 'light', W, h, t, W / 2, 0, 0);
  }
  for (const sz of [-1, 1]) {
    box(g, 'steel', W - 0.04, 0.25, 0.003, W / 2, 0.02, sz * (t / 2 + 0.0015));
    // Lever handle and rose.
    const hx = W - 0.07;
    part(g, new THREE.CylinderGeometry(0.025, 0.025, 0.012, 14), 'steel', hx, 1.02, sz * (t / 2 + 0.006), Math.PI / 2);
    rod(g, 'steel', [hx, 1.02, sz * (t / 2 + 0.01)], [hx, 1.02, sz * (t / 2 + 0.055)], 0.009, 8);
    rod(g, 'steel', [hx, 1.02, sz * (t / 2 + 0.055)], [hx - 0.13, 1.02, sz * (t / 2 + 0.055)], 0.009, 8);
  }
  // Hinges.
  for (const y of [0.25, 1.05, h - 0.3]) cylY(g, 'steel', 0.009, 0.1, -0.005, y, 0, 8);
  return g;
}

// ------------------------------------------------------------------ furniture

/** Examination couch, head (raised backrest) at −X, long side facing +Z. 1.95 × 0.66. */
export function examCouch(): THREE.Group {
  const g = new THREE.Group();
  const L = 1.9;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      box(g, 'white', 0.04, 0.6, 0.04, sx * 0.8, 0.02, sz * 0.26);
      cylY(g, 'rubber', 0.026, 0.02, sx * 0.8, 0, sz * 0.26, 12);
    }
    box(g, 'white', 0.03, 0.03, 0.52, sx * 0.8, 0.16, 0);
  }
  for (const sz of [-1, 1]) {
    box(g, 'white', 1.6, 0.03, 0.03, 0, 0.16, sz * 0.26);
    box(g, 'white', L - 0.06, 0.05, 0.03, 0, 0.6, sz * 0.285);
  }
  box(g, 'light', 1.56, 0.012, 0.5, 0, 0.19, 0); // storage shelf
  box(g, 'white', L - 0.1, 0.02, 0.56, 0, 0.61, 0);
  // Seat section.
  rbox(g, 'uph', 1.3, 0.08, 0.66, 0.03, 0.3, 0.63, 0, 2);
  box(g, 'paper', 1.24, 0.003, 0.5, 0.3, 0.71, 0);
  // Raised backrest on a hinge at x = −0.35.
  const pivot = new THREE.Group();
  pivot.position.set(-0.355, 0.63, 0);
  rbox(pivot, 'uph', 0.6, 0.08, 0.66, 0.03, -0.3, 0, 0, 2);
  box(pivot, 'paper', 0.56, 0.003, 0.5, -0.29, 0.08, 0);
  pivot.rotation.z = -0.52;
  g.add(pivot);
  // Backrest strut.
  rod(g, 'steelDark', [-0.55, 0.6, 0], [-0.62, 0.78, 0], 0.012, 8);
  // Paper roll at the foot end.
  for (const sz of [-1, 1]) box(g, 'steel', 0.02, 0.1, 0.02, L / 2 + 0.01, 0.52, sz * 0.3);
  const roll = part(g, new THREE.CylinderGeometry(0.055, 0.055, 0.56, 18), 'paper', L / 2 + 0.03, 0.54, 0, Math.PI / 2);
  roll.castShadow = true;
  rod(g, 'steel', [L / 2 + 0.03, 0.54, -0.3], [L / 2 + 0.03, 0.54, 0.3], 0.008, 6);
  return g;
}

/** Examination step stool (two treads). Front +Z. */
export function stepStool(): THREE.Group {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) {
    rod(g, 'steel', [sx * 0.2, 0, 0.18], [sx * 0.2, 0.2, 0.12], 0.011);
    rod(g, 'steel', [sx * 0.2, 0, -0.16], [sx * 0.2, 0.4, -0.1], 0.011);
    rod(g, 'steel', [sx * 0.2, 0.2, 0.12], [sx * 0.2, 0.2, -0.13], 0.011);
    cylY(g, 'rubber', 0.016, 0.012, sx * 0.2, 0, 0.18, 8);
    cylY(g, 'rubber', 0.016, 0.012, sx * 0.2, 0, -0.16, 8);
  }
  rbox(g, 'rubber', 0.44, 0.025, 0.2, 0.008, 0, 0.2, 0.06);
  rbox(g, 'rubber', 0.44, 0.025, 0.2, 0.008, 0, 0.4, -0.1);
  return g;
}

/** Office desk with drawer pedestal, monitor, keyboard and papers. User side = +Z. */
export function desk(w = 1.4, d = 0.7, withPc = true): THREE.Group {
  const g = new THREE.Group();
  rbox(g, 'laminate', w, 0.03, d, 0.006, 0, 0.72, 0);
  box(g, 'white', w - 0.02, 0.015, d - 0.02, 0, 0.705, 0);
  for (const sx of [-1, 1]) {
    box(g, 'white', 0.05, 0.7, 0.05, sx * (w / 2 - 0.05), 0, d / 2 - 0.06);
    box(g, 'white', 0.05, 0.7, 0.05, sx * (w / 2 - 0.05), 0, -d / 2 + 0.06);
    box(g, 'white', 0.05, 0.04, d - 0.12, sx * (w / 2 - 0.05), 0.02, 0);
    cylY(g, 'rubber', 0.02, 0.01, sx * (w / 2 - 0.05), 0, d / 2 - 0.06, 8);
    cylY(g, 'rubber', 0.02, 0.01, sx * (w / 2 - 0.05), 0, -d / 2 + 0.06, 8);
  }
  box(g, 'light', w - 0.16, 0.36, 0.015, 0, 0.33, -d / 2 + 0.07);
  // Drawer pedestal on the right.
  const px = w / 2 - 0.3;
  box(g, 'white', 0.42, 0.58, d - 0.16, px, 0.1, 0.02);
  for (let i = 0; i < 3; i++) {
    const y = 0.12 + i * 0.19;
    box(g, 'light', 0.4, 0.175, 0.012, px, y, d / 2 - 0.054);
    box(g, 'steel', 0.14, 0.012, 0.02, px, y + 0.14, d / 2 - 0.04);
  }
  if (withPc) {
    // Monitor.
    const mx = -0.1;
    const mz = -d / 2 + 0.2;
    rbox(g, 'darker', 0.22, 0.015, 0.16, 0.005, mx, 0.75, mz);
    box(g, 'darker', 0.05, 0.28, 0.03, mx, 0.76, mz - 0.03);
    rbox(g, 'black', 0.56, 0.35, 0.03, 0.008, mx, 0.95, mz);
    box(g, 'screenOn', 0.53, 0.3, 0.002, mx, 0.975, mz + 0.016);
    // Keyboard, mouse, papers, pen cup, phone.
    rbox(g, 'light', 0.44, 0.02, 0.14, 0.006, mx, 0.75, mz + 0.3);
    box(g, 'grey', 0.42, 0.004, 0.12, mx, 0.77, mz + 0.3);
    rbox(g, 'light', 0.06, 0.03, 0.1, 0.02, mx + 0.32, 0.75, mz + 0.32);
    box(g, 'paper', 0.21, 0.012, 0.297, -w / 2 + 0.26, 0.75, 0.08, 0.2);
    box(g, 'paper', 0.21, 0.004, 0.297, -w / 2 + 0.28, 0.762, 0.06, -0.1);
    cylY(g, 'dark', 0.035, 0.1, w / 2 - 0.12, 0.75, -d / 2 + 0.12, 12);
    for (let i = 0; i < 3; i++) rod(g, 'grey', [w / 2 - 0.12 + i * 0.01, 0.8, -d / 2 + 0.12], [w / 2 - 0.13 + i * 0.02, 0.9, -d / 2 + 0.12 + i * 0.01], 0.004, 5);
    rbox(g, 'dark', 0.18, 0.05, 0.2, 0.02, w / 2 - 0.3, 0.75, -d / 2 + 0.16);
    rbox(g, 'grey', 0.05, 0.02, 0.18, 0.01, w / 2 - 0.36, 0.8, -d / 2 + 0.16);
  }
  return g;
}

/** Swivel office chair. Seat front = +Z. */
export function officeChair(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const ex = Math.sin(a) * 0.3;
    const ez = Math.cos(a) * 0.3;
    rod(g, 'darker', [0, 0.1, 0], [ex, 0.06, ez], 0.018, 6);
    sphere(g, 'black', 0.028, ex, 0.03, ez, 1, 1, 0.8, 6, 4);
  }
  cylY(g, 'steelDark', 0.028, 0.3, 0, 0.1, 0, 12);
  box(g, 'darker', 0.3, 0.04, 0.3, 0, 0.4, 0);
  rbox(g, 'uph', 0.5, 0.08, 0.48, 0.03, 0, 0.43, 0.02);
  box(g, 'darker', 0.06, 0.34, 0.03, 0, 0.44, -0.24);
  const back = rbox(g, 'uph', 0.46, 0.5, 0.07, 0.03, 0, 0, 0);
  back.position.set(0, 0.86, -0.27);
  back.rotation.x = -0.12;
  for (const sx of [-1, 1]) {
    box(g, 'darker', 0.03, 0.2, 0.04, sx * 0.25, 0.46, -0.02);
    rbox(g, 'darker', 0.07, 0.03, 0.26, 0.012, sx * 0.25, 0.66, 0.0);
  }
  return g;
}

/** Four-legged visitor chair (steel frame, upholstered seat and back). Seat front = +Z. */
export function visitorChair(key: SwatchKey = 'uph'): THREE.Group {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) {
    rod(g, 'steel', [sx * 0.21, 0, 0.2], [sx * 0.2, 0.44, 0.18], 0.011, 8);
    rod(g, 'steel', [sx * 0.21, 0, -0.2], [sx * 0.2, 0.44, -0.18], 0.011, 8);
    rod(g, 'steel', [sx * 0.2, 0.44, -0.18], [sx * 0.2, 0.86, -0.25], 0.011, 8);
    rod(g, 'steel', [sx * 0.2, 0.43, 0.18], [sx * 0.2, 0.43, -0.18], 0.009, 6);
    cylY(g, 'rubber', 0.014, 0.01, sx * 0.21, 0, 0.2, 8);
    cylY(g, 'rubber', 0.014, 0.01, sx * 0.21, 0, -0.2, 8);
  }
  rbox(g, key, 0.46, 0.06, 0.44, 0.02, 0, 0.44, 0);
  const back = rbox(g, key, 0.44, 0.28, 0.04, 0.015, 0, 0, 0);
  back.position.set(0, 0.73, -0.225);
  back.rotation.x = -0.16;
  return g;
}

/** Beam seating (n moulded seats on a steel beam). Seats face +Z. */
export function beamSeating(n: number, pitch = 0.6): THREE.Group {
  const g = new THREE.Group();
  const L = n * pitch;
  box(g, 'steelDark', L - 0.1, 0.06, 0.07, 0, 0.33, -0.04);
  for (const sx of [-1, 1]) {
    const x = sx * (L / 2 - 0.12);
    box(g, 'steelDark', 0.06, 0.33, 0.06, x, 0, -0.04);
    box(g, 'steelDark', 0.06, 0.03, 0.52, x, 0, -0.04);
    cylY(g, 'rubber', 0.02, 0.01, x, 0, 0.2, 8);
    cylY(g, 'rubber', 0.02, 0.01, x, 0, -0.28, 8);
  }
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + pitch / 2 + i * pitch;
    box(g, 'steelDark', 0.04, 0.06, 0.3, x, 0.39, -0.04);
    rbox(g, 'uph', pitch - 0.06, 0.06, 0.46, 0.025, x, 0.43, 0.0);
    const back = rbox(g, 'uph', pitch - 0.06, 0.42, 0.05, 0.02, 0, 0, 0);
    back.position.set(x, 0.72, -0.25);
    back.rotation.x = -0.14;
    rod(g, 'steelDark', [x, 0.42, -0.22], [x, 0.6, -0.255], 0.012, 6);
  }
  // Armrests between seats and at the ends.
  for (let i = 0; i <= n; i++) {
    const x = -L / 2 + 0.03 + (i / n) * (L - 0.06);
    box(g, 'steelDark', 0.025, 0.2, 0.025, x, 0.42, -0.05);
    rbox(g, 'darker', 0.045, 0.025, 0.3, 0.01, x, 0.62, 0.0);
  }
  return g;
}

/** Sink base cabinet with an inset stainless bowl, mixer, towel and soap dispensers above. Back at −Z (wall). */
export function sinkCabinet(w = 1.2, d = 0.6, towels = true): THREE.Group {
  const g = new THREE.Group();
  box(g, 'skirting', w - 0.04, 0.1, d - 0.08, 0, 0, -0.02);
  box(g, 'white', w, 0.76, d - 0.03, 0, 0.1, -0.015);
  const nd = 2;
  for (let i = 0; i < nd; i++) {
    const dw = w / nd - 0.006;
    const x = -w / 2 + (i + 0.5) * (w / nd);
    box(g, 'light', dw, 0.72, 0.018, x, 0.12, d / 2 - 0.021);
    box(g, 'steel', 0.012, 0.14, 0.02, x + (i === 0 ? dw / 2 - 0.05 : -dw / 2 + 0.05), 0.62, d / 2 - 0.004);
  }
  // Worktop with a hole for the bowl.
  const sx = -w / 2 + 0.36;
  const bw = 0.46;
  const bd = 0.36;
  const top = 0.86;
  const tt = 0.03;
  const bz = 0.02;
  box(g, 'laminate', sx - bw / 2 + w / 2, tt, d, (-w / 2 + sx - bw / 2) / 2, top, 0);
  box(g, 'laminate', w / 2 - (sx + bw / 2), tt, d, (sx + bw / 2 + w / 2) / 2, top, 0);
  box(g, 'laminate', bw, tt, d / 2 - bd / 2 + bz, sx, top, (-d / 2 + (bz - bd / 2)) / 2);
  box(g, 'laminate', bw, tt, d / 2 - bd / 2 - bz, sx, top, (d / 2 + (bz + bd / 2)) / 2);
  // Bowl: open steel box.
  const by = top - 0.17;
  box(g, 'steel', bw, 0.01, bd, sx, by, bz);
  box(g, 'steel', bw, 0.19, 0.01, sx, by, bz - bd / 2 + 0.005);
  box(g, 'steel', bw, 0.19, 0.01, sx, by, bz + bd / 2 - 0.005);
  box(g, 'steel', 0.01, 0.19, bd, sx - bw / 2 + 0.005, by, bz);
  box(g, 'steel', 0.01, 0.19, bd, sx + bw / 2 - 0.005, by, bz);
  cylY(g, 'steelDark', 0.03, 0.004, sx, by + 0.01, bz, 12);
  // Upstand and mixer with an elbow lever.
  box(g, 'laminate', w, 0.12, 0.015, 0, top + tt, -d / 2 + 0.0075);
  cylY(g, 'chrome', 0.024, 0.06, sx, top + tt, -d / 2 + 0.07, 14);
  tube(g, 'chrome', [
    [sx, top + tt + 0.05, -d / 2 + 0.07],
    [sx, top + 0.3, -d / 2 + 0.07],
    [sx, top + 0.3, -d / 2 + 0.24],
    [sx, top + 0.22, -d / 2 + 0.26],
  ], 0.012, 0.06, 10);
  rod(g, 'chrome', [sx, top + 0.1, -d / 2 + 0.07], [sx + 0.17, top + 0.1, -d / 2 + 0.1], 0.007, 6);
  if (towels) {
    // Paper towel and soap dispensers on the wall.
    rbox(g, 'white', 0.29, 0.36, 0.12, 0.02, sx + 0.45, 1.25, -d / 2 + 0.06);
    box(g, 'glassDark', 0.12, 0.05, 0.004, sx + 0.45, 1.5, -d / 2 + 0.121);
    box(g, 'paper', 0.2, 0.05, 0.004, sx + 0.45, 1.23, -d / 2 + 0.1);
    rbox(g, 'white', 0.1, 0.2, 0.1, 0.015, sx, 1.18, -d / 2 + 0.05);
    rbox(g, 'grey', 0.06, 0.05, 0.02, 0.008, sx, 1.28, -d / 2 + 0.1);
  }
  return g;
}

/** Stainless instrument trolley, two shelves. Front +Z. */
export function instrumentTrolley(): THREE.Group {
  const g = new THREE.Group();
  const w = 0.6;
  const d = 0.4;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      rod(g, 'steel', [sx * (w / 2 - 0.02), 0.08, sz * (d / 2 - 0.02)], [sx * (w / 2 - 0.02), 0.86, sz * (d / 2 - 0.02)], 0.011, 8);
      sphere(g, 'black', 0.03, sx * (w / 2 - 0.02), 0.035, sz * (d / 2 - 0.02), 0.6, 1, 1, 6, 4);
      box(g, 'steelDark', 0.02, 0.04, 0.02, sx * (w / 2 - 0.02), 0.05, sz * (d / 2 - 0.02));
    }
  }
  for (const y of [0.2, 0.84]) {
    box(g, 'steel', w, 0.012, d, 0, y, 0);
    box(g, 'steel', w, 0.03, 0.008, 0, y, d / 2);
    box(g, 'steel', w, 0.03, 0.008, 0, y, -d / 2);
  }
  tube(g, 'steel', [
    [-w / 2, 0.84, -d / 2 + 0.03],
    [-w / 2 - 0.05, 0.9, -d / 2 + 0.03],
    [-w / 2 - 0.05, 0.9, d / 2 - 0.03],
    [-w / 2, 0.84, d / 2 - 0.03],
  ], 0.009, 0.03, 6, false);
  // A kidney dish, gauze box and a covered tray.
  sphere(g, 'steel', 0.1, 0.1, 0.86, 0.02, 1, 0.18, 0.6, 14, 6);
  box(g, 'white', 0.14, 0.07, 0.1, -0.15, 0.852, 0.08);
  rbox(g, 'light', 0.26, 0.04, 0.18, 0.01, -0.1, 0.852, -0.08);
  box(g, 'white', 0.3, 0.1, 0.2, 0.05, 0.212, 0);
  return g;
}

/** Round stool on castors. */
export function stool(h = 0.55): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const ex = Math.sin(a) * 0.25;
    const ez = Math.cos(a) * 0.25;
    rod(g, 'darker', [0, 0.09, 0], [ex, 0.05, ez], 0.015, 6);
    sphere(g, 'black', 0.024, ex, 0.026, ez, 1, 1, 0.8, 6, 4);
  }
  cylY(g, 'steel', 0.022, h - 0.12, 0, 0.09, 0, 10);
  if (h > 0.62) torus(g, 'steel', 0.19, 0.01, 0, h * 0.45, 0, Math.PI / 2, 0, Math.PI * 2, 6, 24);
  cylY(g, 'uph', 0.19, 0.07, 0, h - 0.06, 0, 20, 0.17);
  return g;
}

/** Pedal bin. */
export function pedalBin(): THREE.Group {
  const g = new THREE.Group();
  cylY(g, 'steel', 0.14, 0.4, 0, 0.02, 0, 18, 0.13);
  cylY(g, 'darker', 0.13, 0.02, 0, 0, 0, 16);
  cylY(g, 'steelDark', 0.145, 0.03, 0, 0.42, 0, 18);
  box(g, 'darker', 0.1, 0.02, 0.08, 0, 0.01, 0.16);
  return g;
}

/** Floor-standing examination lamp on a gooseneck. */
export function examLamp(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    rod(g, 'white', [0, 0.08, 0], [Math.sin(a) * 0.26, 0.04, Math.cos(a) * 0.26], 0.014, 6);
    sphere(g, 'black', 0.022, Math.sin(a) * 0.26, 0.024, Math.cos(a) * 0.26, 1, 1, 0.8, 6, 4);
  }
  rod(g, 'white', [0, 0.08, 0], [0, 1.2, 0], 0.014, 8);
  tube(g, 'dark', [
    [0, 1.2, 0],
    [0, 1.45, 0.05],
    [0, 1.55, 0.3],
    [0, 1.45, 0.48],
  ], 0.012, 0.12, 8, false);
  const head = part(g, new THREE.CylinderGeometry(0.07, 0.09, 0.08, 20), 'white', 0, 1.42, 0.52, -0.6);
  head.castShadow = true;
  const lens = part(g, new THREE.CircleGeometry(0.07, 20), 'lamp', 0, 1.385, 0.545, Math.PI / 2 - 0.6 + Math.PI);
  lens.castShadow = false;
  return g;
}

/** Wall-mounted blood-pressure unit (dial with ticks, coiled hose, cuff basket). Origin on the wall. */
export function bpWallUnit(): THREE.Group {
  const g = new THREE.Group();
  rbox(g, 'white', 0.16, 0.26, 0.06, 0.012, 0, 0, 0.03);
  part(g, new THREE.CylinderGeometry(0.06, 0.06, 0.02, 24), 'light', 0, 0.17, 0.07, Math.PI / 2);
  torus(g, 'grey', 0.06, 0.006, 0, 0.17, 0.08, 0, 0, Math.PI * 2, 5, 24);
  for (let i = 0; i < 10; i++) {
    const a = -2.2 + (i / 9) * 4.4;
    const m = box(g, 'darker', 0.003, 0.012, 0.002, Math.sin(a) * 0.048, 0, 0.081);
    m.position.y = 0.17 + Math.cos(a) * 0.048;
    m.rotation.z = -a;
  }
  box(g, 'darker', 0.004, 0.045, 0.002, 0.012, 0.17, 0.083).rotation.z = -0.6;
  box(g, 'grey', 0.14, 0.07, 0.07, 0, 0.02, 0.07);
  // Coiled hose.
  const pts: V3[] = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    pts.push([0.07 + Math.cos(t * Math.PI * 14) * 0.018, 0.02 - t * 0.28, 0.07 + Math.sin(t * Math.PI * 14) * 0.018]);
  }
  tube(g, 'dark', pts, 0.004, 0.005, 5, false);
  return g;
}

/** Wheelchair, seat facing +Z. About 0.64 × 1.0 × 0.93. */
export function wheelchair(): THREE.Group {
  const g = new THREE.Group();
  const sw = 0.23; // half frame width
  const seatY = 0.5;
  // Side frames.
  for (const sx of [-1, 1]) {
    const x = sx * sw;
    tube(g, 'steel', [
      [x, 0.93, -0.27],
      [x, 0.85, -0.22],
      [x, seatY, -0.2],
      [x, seatY, 0.24],
      [x, 0.2, 0.44],
      [x, 0.12, 0.46],
    ], 0.012, 0.05, 8, true);
    rod(g, 'steel', [x, 0.2, -0.16], [x, 0.2, 0.3], 0.012, 8);
    rod(g, 'steel', [x, 0.2, 0.3], [x, seatY, 0.3], 0.011, 8);
    rod(g, 'steel', [x, 0.2, -0.16], [x, seatY, -0.2], 0.011, 8);
    // Push handle grip.
    rod(g, 'rubber', [x, 0.93, -0.27], [x, 0.92, -0.37], 0.016, 8);
    // Armrest.
    rod(g, 'steel', [x, seatY, -0.1], [x, 0.72, -0.1], 0.01, 6);
    rod(g, 'steel', [x, seatY, 0.18], [x, 0.72, 0.18], 0.01, 6);
    rbox(g, 'darker', 0.05, 0.03, 0.34, 0.012, x, 0.72, 0.04);
    // Rear wheel: tyre, hand rim, hub and spokes.
    const wx = sx * (sw + 0.055);
    const wz = -0.1;
    const wy = 0.3;
    torus(g, 'rubber', 0.285, 0.016, wx, wy, wz, 0, Math.PI / 2, Math.PI * 2, 6, 32);
    torus(g, 'steel', 0.3 - 0.045, 0.006, wx + sx * 0.03, wy, wz, 0, Math.PI / 2, Math.PI * 2, 4, 28);
    part(g, new THREE.CylinderGeometry(0.035, 0.035, 0.05, 14), 'steelDark', wx, wy, wz, 0, 0, Math.PI / 2);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      rod(g, 'steel', [wx, wy, wz], [wx, wy + Math.sin(a) * 0.27, wz + Math.cos(a) * 0.27], 0.0022, 3);
    }
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.4;
      rod(g, 'steel', [wx, wy + Math.sin(a) * 0.255, wz + Math.cos(a) * 0.255], [wx + sx * 0.03, wy + Math.sin(a) * 0.255, wz + Math.cos(a) * 0.255], 0.004, 4);
    }
    // Front caster with fork.
    const cx = sx * 0.2;
    const cz = 0.33;
    rod(g, 'steel', [cx, 0.2, 0.3], [cx, 0.14, cz], 0.01, 6);
    box(g, 'steelDark', 0.04, 0.02, 0.04, cx, 0.13, cz);
    for (const fx of [-1, 1]) box(g, 'steelDark', 0.006, 0.08, 0.03, cx + fx * 0.022, 0.06, cz + 0.02);
    part(g, new THREE.CylinderGeometry(0.075, 0.075, 0.03, 16), 'rubber', cx, 0.075, cz + 0.03, 0, 0, Math.PI / 2);
    // Footrest plate.
    rbox(g, 'darker', 0.17, 0.012, 0.13, 0.01, sx * 0.13, 0.13, 0.46);
  }
  // Cross brace, seat and back slings.
  rod(g, 'steel', [-sw, 0.2, 0.05], [sw, seatY - 0.02, 0.05], 0.01, 6);
  rod(g, 'steel', [sw, 0.2, 0.05], [-sw, seatY - 0.02, 0.05], 0.01, 6);
  box(g, 'darker', sw * 2, 0.02, 0.42, 0, seatY, 0.03);
  rbox(g, 'dark', sw * 2 - 0.04, 0.04, 0.38, 0.015, 0, seatY + 0.02, 0.04);
  const back = box(g, 'darker', sw * 2, 0.4, 0.015, 0, 0, 0);
  back.position.set(0, 0.73, -0.215);
  back.rotation.x = -0.1;
  return g;
}

/** Baby changing unit with padded mat, drawers, towel shelf and a warmer lamp. Back at −Z (wall). */
export function changingTable(w = 1.2, d = 0.75): THREE.Group {
  const g = new THREE.Group();
  box(g, 'skirting', w - 0.04, 0.08, d - 0.08, 0, 0, -0.02);
  box(g, 'white', w, 0.8, d - 0.03, 0, 0.08, -0.015);
  // Drawers on the right, open shelves with towels on the left.
  for (let i = 0; i < 3; i++) {
    const y = 0.1 + i * 0.26;
    box(g, 'light', w / 2 - 0.02, 0.245, 0.018, w / 4, y, d / 2 - 0.021);
    box(g, 'steel', 0.14, 0.012, 0.02, w / 4, y + 0.2, d / 2 - 0.004);
  }
  box(g, 'mid', w / 2 - 0.04, 0.012, d - 0.1, -w / 4, 0.44, 0);
  for (let i = 0; i < 3; i++) {
    rbox(g, 'linen', 0.2, 0.05, 0.28, 0.015, -w / 2 + 0.16 + i * 0.18, 0.1 + (i % 2) * 0.005, 0.02);
    rbox(g, 'linen', 0.2, 0.05, 0.28, 0.015, -w / 2 + 0.16 + i * 0.18, 0.155, 0.02);
    rbox(g, 'uphLight', 0.2, 0.05, 0.28, 0.015, -w / 2 + 0.16 + i * 0.18, 0.46, 0.02);
  }
  box(g, 'laminate', w + 0.02, 0.03, d, 0, 0.88, 0);
  // Upstands around the mat.
  box(g, 'white', w, 0.18, 0.025, 0, 0.91, -d / 2 + 0.0125);
  for (const sx of [-1, 1]) box(g, 'white', 0.025, 0.18, d - 0.025, sx * (w / 2 - 0.0125), 0.91, 0.0125);
  // Padded mat with raised long edges.
  rbox(g, 'uphLight', w - 0.08, 0.05, d - 0.1, 0.02, 0, 0.91, 0.02, 2);
  rbox(g, 'uphLight', w - 0.08, 0.1, 0.09, 0.04, 0, 0.91, -d / 2 + 0.08, 2);
  rbox(g, 'uphLight', w - 0.08, 0.1, 0.09, 0.04, 0, 0.91, d / 2 - 0.07, 2);
  // A folded towel and a bottle of lotion.
  rbox(g, 'linen', 0.3, 0.03, 0.22, 0.01, -0.3, 0.96, 0.0);
  cylY(g, 'white', 0.03, 0.13, 0.45, 0.91, -0.25, 12);
  cylY(g, 'grey', 0.012, 0.03, 0.45, 1.04, -0.25, 8);
  // Wall shelf with towel stacks.
  box(g, 'white', w, 0.025, 0.26, 0, 1.5, -d / 2 + 0.13);
  for (const sx of [-1, 1]) box(g, 'steel', 0.02, 0.12, 0.2, sx * (w / 2 - 0.1), 1.39, -d / 2 + 0.1);
  for (let i = 0; i < 3; i++) {
    for (let k = 0; k < 3; k++) rbox(g, k === 1 ? 'uphLight' : 'linen', 0.26, 0.055, 0.2, 0.015, -0.36 + i * 0.3, 1.525 + k * 0.057, -d / 2 + 0.12);
  }
  // Warmer lamp on a wall arm, aimed at the mat.
  box(g, 'white', 0.08, 0.12, 0.04, 0, 1.95, -d / 2 + 0.02);
  rod(g, 'white', [0, 2.0, -d / 2 + 0.03], [0, 2.02, -0.05], 0.015, 8);
  const lampHead = part(g, new THREE.CylinderGeometry(0.16, 0.19, 0.08, 24), 'white', 0, 2.0, -0.02, 0.12);
  lampHead.castShadow = true;
  const glow = part(g, new THREE.CircleGeometry(0.16, 24), 'lampSoft', 0, 1.955, -0.015, Math.PI / 2 + 0.12);
  glow.castShadow = false;
  return g;
}

/** Hospital bassinet: steel trolley with shelf, clear acrylic tub (glass material), mattress. Long side facing +Z. */
export function babyCot(glass: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const L = 0.78;
  const W = 0.44;
  for (const sx of [-1, 1]) {
    rod(g, 'steel', [sx * (L / 2 - 0.05), 0.07, 0], [sx * (L / 2 - 0.08), 0.74, 0], 0.014, 8);
    rod(g, 'steel', [sx * (L / 2 - 0.05), 0.07, -W / 2 + 0.03], [sx * (L / 2 - 0.05), 0.07, W / 2 - 0.03], 0.013, 8);
    for (const sz of [-1, 1]) {
      sphere(g, 'black', 0.03, sx * (L / 2 - 0.05), 0.032, sz * (W / 2 - 0.03), 0.6, 1, 1, 6, 4);
      box(g, 'steelDark', 0.02, 0.03, 0.02, sx * (L / 2 - 0.05), 0.05, sz * (W / 2 - 0.03));
    }
  }
  rod(g, 'steel', [-(L / 2 - 0.08), 0.74, 0], [L / 2 - 0.08, 0.74, 0], 0.012, 6);
  rod(g, 'steel', [-(L / 2 - 0.06), 0.3, 0], [L / 2 - 0.06, 0.3, 0], 0.012, 6);
  box(g, 'white', L - 0.14, 0.015, W - 0.08, 0, 0.3, 0);
  box(g, 'white', L - 0.1, 0.02, W - 0.04, 0, 0.75, 0);
  // Folded linen on the shelf.
  rbox(g, 'linen', 0.3, 0.07, 0.25, 0.02, -0.1, 0.315, 0);
  // Clear tub: bottom + four walls in glass, rolled rim in white.
  const ty = 0.77;
  const th = 0.24;
  const add = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glass);
    m.position.set(x, y, z);
    g.add(m);
  };
  add(L, 0.01, W, 0, ty + 0.005, 0);
  add(L, th, 0.008, 0, ty + th / 2, W / 2);
  add(L, th, 0.008, 0, ty + th / 2, -W / 2);
  add(0.008, th, W, L / 2, ty + th / 2, 0);
  add(0.008, th, W, -L / 2, ty + th / 2, 0);
  for (const sz of [-1, 1]) rod(g, 'white', [-L / 2, ty + th, sz * W / 2], [L / 2, ty + th, sz * W / 2], 0.007, 6);
  for (const sx of [-1, 1]) rod(g, 'white', [sx * L / 2, ty + th, -W / 2], [sx * L / 2, ty + th, W / 2], 0.007, 6);
  rbox(g, 'linen', L - 0.03, 0.05, W - 0.03, 0.015, 0, ty + 0.01, 0);
  rbox(g, 'uphLight', 0.3, 0.035, W - 0.06, 0.015, 0.18, ty + 0.06, 0);
  return g;
}

/** Nursing armchair with high back and wooden-look (grey) arms. Front +Z. */
export function armchair(): THREE.Group {
  const g = new THREE.Group();
  rbox(g, 'uph', 0.62, 0.18, 0.62, 0.04, 0, 0.2, 0, 2);
  rbox(g, 'uphLight', 0.52, 0.1, 0.52, 0.04, 0, 0.37, 0.04, 2);
  const back = rbox(g, 'uph', 0.62, 0.72, 0.14, 0.05, 0, 0, 0, 2);
  back.position.set(0, 0.74, -0.25);
  back.rotation.x = -0.12;
  for (const sx of [-1, 1]) {
    rbox(g, 'uph', 0.1, 0.32, 0.6, 0.04, sx * 0.31, 0.3, 0.0, 2);
    rbox(g, 'mid', 0.11, 0.03, 0.56, 0.012, sx * 0.31, 0.62, 0.02);
    for (const sz of [-1, 1]) cylY(g, 'darker', 0.018, 0.2, sx * 0.27, 0, sz * 0.26, 8, 0.014);
  }
  return g;
}

/** Bedside cabinet on castors with a jug and glass. Front +Z. */
export function bedsideCabinet(): THREE.Group {
  const g = new THREE.Group();
  box(g, 'white', 0.44, 0.7, 0.44, 0, 0.07, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) sphere(g, 'black', 0.03, sx * 0.18, 0.035, sz * 0.18, 0.6, 1, 1, 6, 4);
  box(g, 'light', 0.42, 0.14, 0.012, 0, 0.6, 0.226);
  box(g, 'light', 0.42, 0.42, 0.012, 0, 0.14, 0.226);
  box(g, 'steel', 0.12, 0.012, 0.02, 0, 0.7, 0.24);
  box(g, 'steel', 0.012, 0.12, 0.02, 0.17, 0.42, 0.24);
  rbox(g, 'laminate', 0.48, 0.025, 0.46, 0.008, 0, 0.77, 0);
  cylY(g, 'water', 0.05, 0.2, -0.1, 0.795, -0.05, 16, 0.06);
  cylY(g, 'water', 0.03, 0.09, 0.05, 0.795, 0.06, 12, 0.026);
  rbox(g, 'grey', 0.14, 0.02, 0.08, 0.008, 0.1, 0.795, -0.1);
  return g;
}

/** IV drip stand with a bag. */
export function ivPole(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    rod(g, 'steel', [0, 0.1, 0], [Math.sin(a) * 0.28, 0.05, Math.cos(a) * 0.28], 0.013, 6);
    sphere(g, 'black', 0.024, Math.sin(a) * 0.28, 0.026, Math.cos(a) * 0.28, 1, 1, 0.8, 6, 4);
  }
  rod(g, 'chrome', [0, 0.08, 0], [0, 2.0, 0], 0.012, 8);
  for (const sx of [-1, 1]) {
    rod(g, 'chrome', [0, 1.98, 0], [sx * 0.12, 1.98, 0], 0.006, 5);
    torus(g, 'chrome', 0.02, 0.004, sx * 0.13, 1.96, 0, 0, 0, Math.PI * 1.4, 4, 10);
  }
  rbox(g, 'linen', 0.12, 0.2, 0.035, 0.012, 0.13, 1.72, 0);
  rod(g, 'mid', [0.13, 1.72, 0], [0.13, 1.6, 0], 0.008, 6);
  tube(g, 'linen', [
    [0.13, 1.6, 0],
    [0.14, 1.2, 0.02],
    [0.05, 0.9, 0.06],
  ], 0.003, 0.2, 4, false);
  return g;
}

/** Medication / dressing cart: drawer unit on castors with a top rail. Front +Z. */
export function medCart(): THREE.Group {
  const g = new THREE.Group();
  const w = 0.64;
  const d = 0.48;
  box(g, 'white', w, 0.86, d, 0, 0.1, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    sphere(g, 'black', 0.04, sx * (w / 2 - 0.06), 0.045, sz * (d / 2 - 0.06), 0.6, 1, 1, 6, 4);
    box(g, 'steelDark', 0.03, 0.04, 0.03, sx * (w / 2 - 0.06), 0.07, sz * (d / 2 - 0.06));
  }
  const hs = [0.12, 0.12, 0.16, 0.2, 0.2];
  let y = 0.12;
  for (const h of hs) {
    box(g, 'light', w - 0.04, h - 0.012, 0.015, 0, y, d / 2 + 0.002);
    box(g, 'steel', 0.18, 0.014, 0.02, 0, y + h - 0.045, d / 2 + 0.012);
    y += h;
  }
  rbox(g, 'laminate', w + 0.04, 0.03, d + 0.04, 0.01, 0, 0.96, 0);
  tube(g, 'steel', [
    [-w / 2 - 0.02, 0.99, -d / 2],
    [-w / 2 - 0.02, 1.08, -d / 2],
    [w / 2 + 0.02, 1.08, -d / 2],
    [w / 2 + 0.02, 0.99, -d / 2],
  ], 0.01, 0.03, 6, false);
  tube(g, 'steel', [
    [w / 2 + 0.02, 0.8, -0.14],
    [w / 2 + 0.08, 0.8, -0.1],
    [w / 2 + 0.08, 0.8, 0.1],
    [w / 2 + 0.02, 0.8, 0.14],
  ], 0.012, 0.04, 6, false);
  // Gloves boxes, a sharps bin and a tray.
  box(g, 'white', 0.24, 0.12, 0.12, -0.18, 0.99, -0.12);
  box(g, 'light', 0.24, 0.12, 0.12, -0.18, 0.99, 0.02);
  rbox(g, 'grey', 0.16, 0.2, 0.14, 0.02, 0.18, 0.99, -0.1);
  box(g, 'darker', 0.1, 0.02, 0.1, 0.18, 1.19, -0.1);
  return g;
}

/** Linen trolley: steel frame with a fabric bag. */
export function linenTrolley(): THREE.Group {
  const g = new THREE.Group();
  const w = 0.55;
  const d = 0.5;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    rod(g, 'steel', [sx * w / 2, 0.08, sz * d / 2], [sx * w / 2, 0.95, sz * d / 2], 0.012, 6);
    sphere(g, 'black', 0.03, sx * w / 2, 0.035, sz * d / 2, 0.6, 1, 1, 6, 4);
  }
  for (const sz of [-1, 1]) rod(g, 'steel', [-w / 2, 0.95, sz * d / 2], [w / 2, 0.95, sz * d / 2], 0.011, 6);
  for (const sx of [-1, 1]) rod(g, 'steel', [sx * w / 2, 0.95, -d / 2], [sx * w / 2, 0.95, d / 2], 0.011, 6);
  rbox(g, 'uphLight', w - 0.04, 0.72, d - 0.04, 0.05, 0, 0.23, 0, 2);
  rbox(g, 'linen', w - 0.12, 0.08, d - 0.12, 0.04, 0, 0.9, 0, 2);
  return g;
}

/** Water cooler with a bottle. */
export function waterCooler(): THREE.Group {
  const g = new THREE.Group();
  rbox(g, 'white', 0.32, 1.02, 0.34, 0.02, 0, 0, 0);
  box(g, 'darker', 0.2, 0.2, 0.06, 0, 0.72, 0.15);
  box(g, 'grey', 0.18, 0.012, 0.08, 0, 0.72, 0.15);
  for (const sx of [-1, 1]) box(g, 'light', 0.035, 0.05, 0.03, sx * 0.05, 0.87, 0.17);
  cylY(g, 'water', 0.14, 0.4, 0, 1.08, 0, 20);
  cylY(g, 'water', 0.14, 0.06, 0, 1.48, 0, 20, 0.14);
  part(g, new THREE.SphereGeometry(0.14, 20, 6, 0, Math.PI * 2, 0, Math.PI / 2), 'water', 0, 1.48, 0);
  cylY(g, 'water', 0.045, 0.06, 0, 1.02, 0, 12);
  // Cup dispenser on the side.
  cylY(g, 'light', 0.04, 0.3, 0.2, 0.55, 0.0, 12);
  return g;
}

/** Potted plant (grey foliage, low-poly). */
export function plant(seed = 1, s = 1): THREE.Group {
  const g = new THREE.Group();
  const rnd = (i: number) => {
    const x = Math.sin(seed * 91.7 + i * 17.3) * 43758.5453;
    return x - Math.floor(x);
  };
  cylY(g, 'dark', 0.2 * s, 0.42 * s, 0, 0, 0, 18, 0.16 * s);
  cylY(g, 'soil', 0.19 * s, 0.02, 0, 0.405 * s, 0, 16);
  rod(g, 'soil', [0, 0.4 * s, 0], [0.02, 0.9 * s, 0.01], 0.015 * s, 5);
  for (let i = 0; i < 9; i++) {
    const a = rnd(i) * Math.PI * 2;
    const r = (0.1 + rnd(i + 20) * 0.18) * s;
    const y = (0.75 + rnd(i + 40) * 0.55) * s;
    const m = part(g, new THREE.IcosahedronGeometry((0.16 + rnd(i + 60) * 0.08) * s, 0), i % 2 ? 'leafA' : 'leafB', Math.cos(a) * r, y, Math.sin(a) * r, rnd(i + 3), rnd(i + 5), 0);
    m.scale.set(1, 0.8, 1);
  }
  return g;
}

/** Low table with magazines. */
export function coffeeTable(w = 1.0, d = 0.55): THREE.Group {
  const g = new THREE.Group();
  rbox(g, 'laminate', w, 0.03, d, 0.01, 0, 0.4, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) rod(g, 'steel', [sx * (w / 2 - 0.06), 0, sz * (d / 2 - 0.06)], [sx * (w / 2 - 0.06), 0.4, sz * (d / 2 - 0.06)], 0.014, 8);
  box(g, 'mid', w - 0.1, 0.012, d - 0.1, 0, 0.14, 0);
  const mags: Array<[number, number, number, SwatchKey]> = [
    [-0.25, 0.05, 0.3, 'paper'],
    [-0.22, 0.02, 0.1, 'mid'],
    [0.2, -0.05, -0.4, 'light'],
    [0.26, 0.08, 0.2, 'grey'],
  ];
  mags.forEach(([x, z, r, k], i) => box(g, k, 0.21, 0.008, 0.28, x, 0.43 + (i % 2) * 0.008, z, r));
  return g;
}

/** Wall TV (switched off) on a bracket. Origin: centre on the wall. */
export function wallTv(w = 1.1, h = 0.63): THREE.Group {
  const g = new THREE.Group();
  box(g, 'darker', 0.3, 0.2, 0.05, 0, -0.1, 0.025);
  rbox(g, 'black', w, h, 0.045, 0.008, 0, -h / 2, 0.07);
  box(g, 'screen', w - 0.03, h - 0.03, 0.002, 0, -h / 2 + 0.015, 0.093);
  return g;
}

/** Laboratory bench: base cabinets, resin top, reagent shelves with bottles, sink and instruments. Back at −Z (wall). */
export function labBench(w: number, d = 0.75): THREE.Group {
  const g = new THREE.Group();
  const kneeX = -w / 2 + 1.35; // knee space from x = kneeX to kneeX + 1.1
  // Base cabinets (skip the knee space).
  const segs: Array<[number, number]> = [
    [-w / 2, kneeX],
    [kneeX + 1.1, w / 2],
  ];
  for (const [a, b] of segs) {
    const cw = b - a;
    const cx = (a + b) / 2;
    box(g, 'skirting', cw - 0.02, 0.1, d - 0.1, cx, 0, -0.03);
    box(g, 'white', cw, 0.76, d - 0.04, cx, 0.1, -0.02);
    const n = Math.max(1, Math.round(cw / 0.55));
    for (let i = 0; i < n; i++) {
      const dw = cw / n - 0.006;
      const x = a + (i + 0.5) * (cw / n);
      if (i % 2 === 0) {
        for (let k = 0; k < 3; k++) {
          box(g, 'light', dw, 0.235, 0.018, x, 0.12 + k * 0.245, d / 2 - 0.029);
          box(g, 'steel', 0.12, 0.012, 0.02, x, 0.12 + k * 0.245 + 0.19, d / 2 - 0.012);
        }
      } else {
        box(g, 'light', dw, 0.72, 0.018, x, 0.12, d / 2 - 0.029);
        box(g, 'steel', 0.012, 0.14, 0.02, x - dw / 2 + 0.05, 0.6, d / 2 - 0.012);
      }
    }
  }
  // Modesty panel in the knee space.
  box(g, 'white', 1.1, 0.5, 0.02, kneeX + 0.55, 0.36, -d / 2 + 0.03);
  // Resin worktop with a drip edge.
  box(g, 'labTop', w, 0.03, d, 0, 0.87, 0);
  // Reagent rack: uprights and two shelves.
  const rackY = [1.32, 1.72];
  for (let i = 0; i <= 3; i++) {
    const x = -w / 2 + 0.05 + (i / 3) * (w - 0.1);
    box(g, 'steel', 0.03, 1.2, 0.03, x, 0.9, -d / 2 + 0.05);
  }
  for (const y of rackY) {
    box(g, 'light', w - 0.04, 0.02, 0.3, 0, y, -d / 2 + 0.16);
    box(g, 'steel', w - 0.04, 0.03, 0.006, 0, y + 0.02, -d / 2 + 0.31);
  }
  // Bottles and jars on the shelves (deterministic mix).
  let seed = 3;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (const y of rackY) {
    let x = -w / 2 + 0.18;
    while (x < w / 2 - 0.18) {
      const r = 0.03 + rnd() * 0.035;
      const h = 0.1 + rnd() * 0.14;
      const k: SwatchKey = rnd() < 0.35 ? 'glassDark' : rnd() < 0.6 ? 'white' : 'water';
      cylY(g, k, r, h, x + r, y + 0.02, -d / 2 + 0.14 + rnd() * 0.06, 8);
      cylY(g, rnd() < 0.5 ? 'darker' : 'grey', r * 0.55, 0.03, x + r, y + 0.02 + h, -d / 2 + 0.14, 6);
      x += 2 * r + 0.03 + rnd() * 0.08;
      if (rnd() < 0.12) x += 0.25;
    }
  }
  // Sink at the right end with a lab gooseneck.
  const sx = w / 2 - 0.42;
  box(g, 'darker', 0.42, 0.004, 0.36, sx, 0.9, 0.02);
  box(g, 'black', 0.36, 0.002, 0.3, sx, 0.904, 0.02);
  tube(g, 'chrome', [
    [sx, 0.9, -d / 2 + 0.08],
    [sx, 1.25, -d / 2 + 0.08],
    [sx, 1.25, -d / 2 + 0.3],
    [sx, 1.12, -d / 2 + 0.32],
  ], 0.011, 0.08, 10);
  for (const s of [-1, 1]) rod(g, 'chrome', [sx, 0.97, -d / 2 + 0.08], [sx + s * 0.1, 0.97, -d / 2 + 0.12], 0.007, 6);
  // Microscope.
  const mx = kneeX + 0.35;
  const mz = -0.05;
  rbox(g, 'white', 0.2, 0.05, 0.26, 0.015, mx, 0.9, mz);
  box(g, 'white', 0.06, 0.28, 0.08, mx, 0.95, mz - 0.09);
  box(g, 'darker', 0.16, 0.012, 0.14, mx, 1.02, mz + 0.02);
  cylY(g, 'darker', 0.035, 0.05, mx, 1.11, mz + 0.02, 14);
  rod(g, 'white', [mx, 1.2, mz - 0.07], [mx, 1.26, mz + 0.03], 0.03, 12);
  for (const s of [-1, 1]) rod(g, 'darker', [mx, 1.25, mz - 0.04], [mx + s * 0.03, 1.33, mz - 0.1], 0.012, 8);
  for (const s of [-1, 1]) part(g, new THREE.CylinderGeometry(0.03, 0.03, 0.02, 14), 'darker', mx + s * 0.045, 1.0, mz - 0.09, 0, 0, Math.PI / 2);
  // Centrifuge.
  const cx = kneeX + 0.85;
  rbox(g, 'white', 0.36, 0.22, 0.42, 0.04, cx, 0.9, -0.04, 2);
  rbox(g, 'light', 0.3, 0.03, 0.3, 0.02, cx, 1.12, -0.07, 2);
  box(g, 'screen', 0.12, 0.05, 0.004, cx, 1.0, 0.172);
  box(g, 'glassDark', 0.1, 0.004, 0.1, cx, 1.15, -0.07);
  // Test-tube rack.
  const tx = -w / 2 + 0.6;
  box(g, 'white', 0.3, 0.012, 0.1, tx, 0.95, 0.1);
  box(g, 'white', 0.3, 0.012, 0.1, tx, 0.99, 0.1);
  for (const s of [-1, 1]) box(g, 'white', 0.012, 0.09, 0.1, tx + s * 0.15, 0.9, 0.1);
  for (let i = 0; i < 7; i++) cylY(g, i % 3 === 0 ? 'grey' : 'water', 0.008, 0.11, tx - 0.12 + i * 0.04, 0.905, 0.1, 8);
  // Pipettes on a stand.
  const px = -w / 2 + 0.25;
  cylY(g, 'darker', 0.07, 0.02, px, 0.9, -0.05, 14);
  rod(g, 'darker', [px, 0.9, -0.05], [px, 1.2, -0.05], 0.008, 6);
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1;
    rod(g, 'white', [px + Math.cos(a) * 0.04, 1.18, -0.05 + Math.sin(a) * 0.04], [px + Math.cos(a) * 0.05, 0.98, -0.05 + Math.sin(a) * 0.05], 0.011, 8);
  }
  return g;
}

/** Tall lab cabinet with glass doors (glass material) and boxes inside. Back at −Z. */
export function glassCabinet(glass: THREE.Material, w = 0.9, d = 0.45, h = 2.0): THREE.Group {
  const g = new THREE.Group();
  box(g, 'white', w, 0.1, d - 0.03, 0, 0, -0.015);
  box(g, 'white', w, 0.02, d, 0, h - 0.02, 0);
  box(g, 'white', 0.02, h, d, -w / 2 + 0.01, 0, 0);
  box(g, 'white', 0.02, h, d, w / 2 - 0.01, 0, 0);
  box(g, 'white', w, h, 0.02, 0, 0, -d / 2 + 0.01);
  for (let i = 0; i < 4; i++) {
    const y = 0.1 + i * 0.45;
    box(g, 'light', w - 0.04, 0.02, d - 0.04, 0, y, 0);
    let x = -w / 2 + 0.08;
    let k = i;
    while (x < w / 2 - 0.14) {
      const bw = 0.1 + ((k * 37) % 7) * 0.02;
      box(g, k % 3 === 0 ? 'white' : k % 3 === 1 ? 'mid' : 'light', bw, 0.14 + ((k * 13) % 5) * 0.03, 0.26, x + bw / 2, y + 0.02, -0.03);
      x += bw + 0.02;
      k++;
    }
  }
  const doors = new THREE.Mesh(new THREE.BoxGeometry(w - 0.04, h - 0.14, 0.008), glass);
  doors.position.set(0, 0.1 + (h - 0.14) / 2, d / 2 - 0.01);
  g.add(doors);
  box(g, 'white', 0.02, h - 0.14, 0.02, 0, 0.1, d / 2 - 0.01);
  for (const s of [-1, 1]) box(g, 'steel', 0.012, 0.16, 0.02, s * 0.03, 0.95, d / 2 + 0.005);
  return g;
}

/** Under-counter lab fridge. Back at −Z. */
export function labFridge(): THREE.Group {
  const g = new THREE.Group();
  box(g, 'white', 0.6, 0.85, 0.6, 0, 0.02, 0);
  box(g, 'light', 0.58, 0.8, 0.02, 0, 0.05, 0.305);
  box(g, 'steel', 0.4, 0.02, 0.03, 0, 0.78, 0.33);
  box(g, 'screen', 0.08, 0.03, 0.004, 0.2, 0.7, 0.317);
  return g;
}

/** Nurse / reception counter: raised transaction ledge towards +Z (visitors), desk behind. */
export function nurseCounter(w = 3.0, d = 0.85): THREE.Group {
  const g = new THREE.Group();
  const fz = d / 2;
  box(g, 'skirting', w - 0.04, 0.1, 0.04, 0, 0, fz - 0.04);
  box(g, 'white', w, 1.0, 0.05, 0, 0.1, fz - 0.025);
  // Horizontal reveal lines on the front, one in division blue.
  box(g, 'grey', w + 0.004, 0.012, 0.052, 0, 0.42, fz - 0.025);
  box(g, 'band', w + 0.004, 0.03, 0.052, 0, 0.9, fz - 0.025);
  rbox(g, 'laminate', w + 0.06, 0.035, 0.34, 0.01, 0, 1.1, fz - 0.12);
  // Desk surface behind, on panels.
  box(g, 'laminate', w, 0.03, d - 0.05, 0, 0.72, -0.025);
  for (const sx of [-1, 1]) box(g, 'white', 0.04, 1.1, d, sx * (w / 2 - 0.02), 0, 0);
  // Two monitors, keyboards, a phone and a label printer.
  for (const sx of [-1, 1]) {
    const x = sx * w * 0.22;
    rbox(g, 'darker', 0.2, 0.015, 0.14, 0.005, x, 0.75, -0.12);
    box(g, 'darker', 0.04, 0.24, 0.03, x, 0.76, -0.14);
    const mon = rbox(g, 'black', 0.52, 0.32, 0.03, 0.008, 0, 0, 0);
    mon.position.set(x, 1.05, -0.12);
    mon.rotation.y = Math.PI;
    box(g, 'screenOn', 0.49, 0.28, 0.002, x, 0.91, -0.137);
    rbox(g, 'light', 0.42, 0.02, 0.14, 0.006, x, 0.75, -0.34);
  }
  rbox(g, 'dark', 0.18, 0.05, 0.2, 0.02, 0.0, 0.75, -0.3);
  rbox(g, 'white', 0.16, 0.1, 0.2, 0.02, 0.0, 0.75, 0.0);
  // Leaflet trays on the ledge.
  for (let i = 0; i < 3; i++) box(g, 'paper', 0.22, 0.01, 0.16, -w / 2 + 0.3 + i * 0.26, 1.135 + i * 0.002, fz - 0.12, 0.05 * i);
  return g;
}

/** Snack / drinks vending machine: dark cabinet, glass front with product rows, keypad. Front +Z. */
export function vendingMachine(glass: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const w = 0.9;
  const d = 0.8;
  const h = 1.85;
  box(g, 'darker', w, h, d - 0.04, 0, 0.02, -0.02);
  box(g, 'black', w - 0.04, 0.02, d - 0.1, 0, 0, -0.02);
  // Product bay behind the glass: 5 shelves with packs in greys, a light strip on top.
  const bx = -0.1;
  const bw = 0.6;
  box(g, 'light', bw, 1.25, 0.02, bx, 0.45, -d / 2 + 0.1);
  box(g, 'lamp', bw - 0.04, 0.012, 0.3, bx, 1.68, 0.05);
  for (let i = 0; i < 5; i++) {
    const y = 0.5 + i * 0.235;
    box(g, 'steel', bw, 0.008, 0.5, bx, y, 0.05);
    for (let k = 0; k < 6; k++) {
      const key: SwatchKey = (['white', 'mid', 'grey', 'light', 'dark', 'uphLight'] as const)[(i * 2 + k) % 6];
      const tall = (i + k) % 3 === 0;
      box(g, key, 0.075, tall ? 0.16 : 0.11, 0.08, bx - bw / 2 + 0.06 + k * 0.096, y + 0.008, 0.2);
      box(g, key, 0.075, tall ? 0.16 : 0.11, 0.08, bx - bw / 2 + 0.06 + k * 0.096, y + 0.008, 0.08);
    }
    // Spiral dispensers in front of each row.
    for (let k = 0; k < 6; k++) rod(g, 'steel', [bx - bw / 2 + 0.06 + k * 0.096, y + 0.02, 0.26], [bx - bw / 2 + 0.06 + k * 0.096, y + 0.02, -0.02], 0.004, 4);
  }
  const pane = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.04, 1.3, 0.01), glass);
  pane.position.set(bx, 0.45 + 0.65, d / 2 - 0.04);
  g.add(pane);
  box(g, 'darker', w, 0.12, 0.05, 0, 1.75, d / 2 - 0.06);
  box(g, 'lampSoft', w - 0.1, 0.05, 0.004, 0, 1.785, d / 2 - 0.034);
  // Control column: screen, keypad, coin slot; the delivery flap below.
  const cx = w / 2 - 0.1;
  box(g, 'screenOn', 0.1, 0.07, 0.004, cx, 1.28, d / 2 - 0.035);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) box(g, 'mid', 0.022, 0.018, 0.008, cx - 0.03 + c * 0.03, 1.02 + r * 0.035, d / 2 - 0.03);
  box(g, 'steel', 0.05, 0.012, 0.006, cx, 0.92, d / 2 - 0.032);
  box(g, 'black', 0.62, 0.16, 0.04, bx, 0.16, d / 2 - 0.05);
  box(g, 'grey', 0.6, 0.02, 0.05, bx, 0.3, d / 2 - 0.045);
  return g;
}

/** Wall magazine rack with three sloping pockets. Origin: on the wall at the bottom. */
export function magazineRack(w = 0.9): THREE.Group {
  const g = new THREE.Group();
  box(g, 'white', w, 0.75, 0.02, 0, 0, 0.01);
  for (let i = 0; i < 3; i++) {
    const y = 0.04 + i * 0.25;
    const lip = box(g, 'steel', w - 0.04, 0.12, 0.006, 0, y, 0.07);
    lip.rotation.x = -0.25;
    box(g, 'steel', w - 0.04, 0.006, 0.07, 0, y, 0.04);
    for (let k = 0; k < 4; k++) {
      const m = box(g, (['paper', 'mid', 'light', 'grey'] as const)[(i + k) % 4], 0.19, 0.26, 0.006, -w / 2 + 0.14 + k * 0.205, y + 0.01, 0.045 + (k % 2) * 0.008);
      m.rotation.x = -0.18;
    }
  }
  return g;
}

/** Children's corner: low round table, three small chairs, a toy crate with blocks. */
export function kidsCorner(): THREE.Group {
  const g = new THREE.Group();
  cylY(g, 'white', 0.33, 0.03, 0, 0.47, 0, 24);
  cylY(g, 'mid', 0.035, 0.47, 0, 0, 0, 10);
  cylY(g, 'mid', 0.2, 0.02, 0, 0, 0, 16);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const ch = new THREE.Group();
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) rod(ch, 'mid', [sx * 0.12, 0, sz * 0.12], [sx * 0.12, 0.28, sz * 0.12], 0.012, 6);
    rbox(ch, i === 1 ? 'uphLight' : 'white', 0.3, 0.03, 0.3, 0.01, 0, 0.28, 0);
    rbox(ch, i === 1 ? 'uphLight' : 'white', 0.3, 0.2, 0.03, 0.01, 0, 0.33, -0.14);
    ch.position.set(Math.sin(a) * 0.52, 0, Math.cos(a) * 0.52);
    ch.rotation.y = a + Math.PI;
    g.add(ch);
  }
  box(g, 'white', 0.5, 0.26, 0.36, 0.75, 0, 0.35);
  for (let i = 0; i < 7; i++) {
    const m = box(g, (['light', 'mid', 'grey', 'uphLight'] as const)[i % 4], 0.07, 0.07, 0.07, 0.6 + (i % 4) * 0.09, 0.2 + (i > 3 ? 0.06 : 0), 0.3 + (i % 3) * 0.05);
    m.rotation.y = i * 0.7;
  }
  // A couple of blocks left on the table.
  box(g, 'grey', 0.07, 0.07, 0.07, 0.1, 0.5, -0.05, 0.4);
  box(g, 'light', 0.07, 0.07, 0.07, 0.12, 0.57, -0.04, 0.9);
  return g;
}

/** Computer workstation on wheels (nurse's charting cart). Front +Z. */
export function workstationCart(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    rod(g, 'darker', [0, 0.08, 0], [Math.sin(a) * 0.3, 0.05, Math.cos(a) * 0.3], 0.018, 6);
    sphere(g, 'black', 0.03, Math.sin(a) * 0.3, 0.032, Math.cos(a) * 0.3, 1, 1, 0.8, 6, 4);
  }
  box(g, 'steel', 0.07, 0.95, 0.05, 0, 0.06, -0.05);
  rbox(g, 'white', 0.62, 0.035, 0.44, 0.012, 0, 0.98, 0.06);
  box(g, 'darker', 0.38, 0.012, 0.14, 0, 1.015, 0.16);
  box(g, 'grey', 0.36, 0.004, 0.12, 0, 1.027, 0.16);
  box(g, 'darker', 0.05, 0.3, 0.03, 0, 1.0, -0.08);
  const mon = rbox(g, 'black', 0.5, 0.31, 0.03, 0.008, 0, 0, 0);
  mon.position.set(0, 1.42, -0.08);
  box(g, 'screenOn', 0.47, 0.27, 0.002, 0, 1.285, -0.064);
  box(g, 'white', 0.3, 0.22, 0.16, 0, 0.3, -0.05);
  rod(g, 'steel', [-0.31, 1.0, 0.22], [-0.31, 1.0, -0.12], 0.012, 6);
  return g;
}

/** Suspended linear LED pendant along local X (length len), bottom at y. */
export function linearPendant(p: THREE.Object3D, len: number, x: number, y: number, z: number, ceiling: number, ry = 0): void {
  const g = new THREE.Group();
  box(g, 'darker', len, 0.06, 0.08, 0, 0, 0);
  box(g, 'lamp', len - 0.03, 0.004, 0.06, 0, -0.003, 0);
  for (const s of [-1, 0, 1]) {
    const cx = s * (len / 2 - 0.3);
    rod(g, 'steel', [cx, 0.06, 0], [cx, ceiling - y, 0], 0.003, 4);
    cylY(g, 'white', 0.03, 0.01, cx, ceiling - y - 0.01, 0, 10);
  }
  g.position.set(x, y, z);
  g.rotation.y = ry;
  p.add(g);
}
