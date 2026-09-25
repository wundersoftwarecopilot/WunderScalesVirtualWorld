import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BRAND } from '../../brand/colors';

/**
 * Props for the DESIGN gallery (an art museum room).
 *
 * All solid props share one palette material: a small colour / emissive / roughness-metalness
 * texture strip, and every part's UVs point at its swatch. The static batcher keeps UVs, so the
 * benches, wall linings, inlays, tracks and spots merge into two draw calls: PAL (casts shadows:
 * benches) and FIX (same palette, never casts: ceiling fixtures, wall linings, floor inlays, so
 * the overhead "sun" does not draw stripes of track shadow across the floor).
 *
 * Light is suggested, not computed: emissive lenses and slots, plus soft additive decals (floor
 * pools, wall washes, picture-light glows) and dark contact shadows, merged into one mesh each.
 * Greys only; the design colour appears in two small accents.
 */

interface Swatch {
  c: string;
  r: number;
  m?: number;
  /** Emissive colour (sRGB). */
  e?: string;
}

const dim = (hex: string, k: number) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();

const SWATCHES = {
  lining: { c: '#c6c8cb', r: 0.93 },
  liningLow: { c: '#cfd1d4', r: 0.93 },
  charcoal: { c: '#303337', r: 0.9 },
  gap: { c: '#17181b', r: 1 },
  stone: { c: '#777a7e', r: 0.22 },
  stoneLight: { c: '#86898d', r: 0.2 },
  steel: { c: '#c8ccd0', r: 0.26, m: 0.92 },
  steelSatin: { c: '#a9adb2', r: 0.42, m: 0.88 },
  steelDark: { c: '#5c6066', r: 0.4, m: 0.85 },
  black: { c: '#18191c', r: 0.42 },
  blackMatte: { c: '#222428', r: 0.78 },
  leather: { c: '#3f4247', r: 0.52 },
  leatherSeam: { c: '#26282b', r: 0.7 },
  rubber: { c: '#1c1d20', r: 0.95 },
  canopy: { c: '#dfe0e2', r: 0.85 },
  lamp: { c: '#ffffff', r: 1, e: '#ffffff' },
  lampSoft: { c: '#f3f3f3', r: 1, e: '#c9c9c9' },
  teal: { c: BRAND.design, r: 0.4, e: dim(BRAND.design, 0.45) },
} satisfies Record<string, Swatch>;

export type Sw = keyof typeof SWATCHES;
const KEYS = Object.keys(SWATCHES) as Sw[];
const TEX_W = 32;

function strip(fill: (s: Swatch) => [number, number, number], srgb: boolean): THREE.DataTexture {
  const data = new Uint8Array(TEX_W * 4);
  KEYS.forEach((k, i) => data.set([...fill(SWATCHES[k] as Swatch), 255], i * 4));
  const t = new THREE.DataTexture(data, TEX_W, 1);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}
const bytes = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const colorTex = strip((s) => bytes(s.c), true);
const emissiveTex = strip((s) => (s.e ? bytes(s.e) : [0, 0, 0]), true);
const ormTex = strip((s) => [255, Math.round(s.r * 255), Math.round((s.m ?? 0) * 255)], false);

function palette(name: string): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    map: colorTex,
    emissiveMap: emissiveTex,
    emissive: '#ffffff',
    emissiveIntensity: 1.35,
    roughnessMap: ormTex,
    metalnessMap: ormTex,
    roughness: 1,
    metalness: 1,
  });
  m.name = name;
  return m;
}

/** Palette for props that cast shadows (benches). */
export const PAL = palette('design-props');
/** Same palette for parts that never cast shadows (fixtures, linings, inlays). */
export const FIX = palette('design-fixtures');

/** Point every vertex of `geo` at a swatch (returns the same geometry). */
export function tint<G extends THREE.BufferGeometry>(geo: G, key: Sw): G {
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

export function part(parent: THREE.Object3D, geo: THREE.BufferGeometry, key: Sw, x = 0, y = 0, z = 0, mat: THREE.Material = PAL): THREE.Mesh {
  const m = new THREE.Mesh(tint(geo, key), mat);
  m.position.set(x, y, z);
  m.castShadow = mat !== FIX;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Axis-aligned box by size and centre. */
export function blk(parent: THREE.Object3D, key: Sw, w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material = PAL): THREE.Mesh {
  return part(parent, new THREE.BoxGeometry(w, h, d), key, x, y, z, mat);
}

/** Box from min/max corners (world or parent space). */
export function span(parent: THREE.Object3D, key: Sw, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, mat: THREE.Material = FIX): THREE.Mesh {
  return blk(parent, key, Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, mat);
}

/** Vertical cylinder (Y axis) centred at x,y,z. */
export function cyl(parent: THREE.Object3D, key: Sw, rt: number, rb: number, h: number, seg: number, x: number, y: number, z: number, mat: THREE.Material = PAL): THREE.Mesh {
  return part(parent, new THREE.CylinderGeometry(rt, rb, h, seg), key, x, y, z, mat);
}

/** Round rod between two points. */
export function rod(parent: THREE.Object3D, key: Sw, a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material = PAL, seg = 8): THREE.Mesh {
  const d = b.clone().sub(a);
  const m = part(parent, new THREE.CylinderGeometry(r, r, d.length(), seg), key, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, mat);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

// ------------------------------------------------------------------ decals (light and shadow)

/**
 * One atlas for every decal: left half a radial falloff (pools, glows, contact shadows), right
 * half a vertical wash (bright along the top edge, no side falloff) for wall washers.
 */
function atlas(): THREE.DataTexture {
  const T = 64;
  const W = T * 2;
  const data = new Uint8Array(W * T * 4);
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < W; x++) {
      let a: number;
      if (x < T) {
        const d = Math.hypot((x + 0.5) / T - 0.5, (y + 0.5) / T - 0.5) * 2;
        const t = THREE.MathUtils.clamp(1 - d, 0, 1);
        a = t * t * (3 - 2 * t);
      } else {
        const v = (y + 0.5) / T;
        a = Math.pow(v, 2.4);
      }
      const i = (y * W + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  }
  const t = new THREE.DataTexture(data, W, T);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}
const ATLAS = atlas();
const HALF_TEXEL = 0.5 / 128;
const TILE = {
  radial: [HALF_TEXEL, 0, 0.5 - HALF_TEXEL, 1],
  wash: [0.5 + HALF_TEXEL, 0, 1 - HALF_TEXEL, 1],
} as const;
export type DecalTile = keyof typeof TILE;

/** Additive light: rgb of the vertex colour scales the glow. */
const GLOW = new THREE.MeshBasicMaterial({
  map: ATLAS,
  vertexColors: true,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  polygonOffset: true,
  polygonOffsetFactor: 0,
  polygonOffsetUnits: -2,
  fog: false,
  toneMapped: false,
});
GLOW.name = 'design-glow';

/** Soft dark contact shadows: vertex alpha scales the darkness. */
const SHADE = new THREE.MeshBasicMaterial({
  map: ATLAS,
  color: '#0c0d0f',
  vertexColors: true,
  transparent: true,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: 0,
  polygonOffsetUnits: -2,
  fog: false,
});
SHADE.name = 'design-shade';

interface Quad {
  c: THREE.Vector3;
  right: THREE.Vector3;
  up: THREE.Vector3;
  w: number;
  h: number;
  uv: readonly [number, number, number, number];
  rgba: [number, number, number, number];
}

/** Collects flat quads and bakes them into one mesh (keeps vertex colours, unlike the batcher). */
export class DecalSet {
  private readonly quads: Quad[] = [];
  constructor(private readonly kind: 'glow' | 'shade') {}

  /**
   * A quad centred at `c`, spanning `w` along `right` and `h` along `up`. `v0..v1` crops the
   * tile vertically (0 = bottom), e.g. the lower half of a radial glow under a ceiling.
   */
  add(c: THREE.Vector3, right: THREE.Vector3, up: THREE.Vector3, w: number, h: number, tile: DecalTile, strength: number, v0 = 0, v1 = 1): void {
    const t = TILE[tile];
    const rgba: [number, number, number, number] = this.kind === 'glow' ? [strength, strength, strength, 1] : [1, 1, 1, strength];
    this.quads.push({ c: c.clone(), right: right.clone().normalize(), up: up.clone().normalize(), w, h, uv: [t[0], v0, t[2], v1], rgba });
  }

  /** Horizontal quad on the floor (or any level surface) at height y. */
  floor(x: number, y: number, z: number, w: number, d: number, strength: number, tile: DecalTile = 'radial'): void {
    this.add(new THREE.Vector3(x, y, z), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1), w, d, tile, strength);
  }

  /** Vertical quad on a wall whose outward normal is (nx, 0, nz). */
  wall(x: number, y: number, z: number, nx: number, nz: number, w: number, h: number, strength: number, tile: DecalTile = 'radial', v0 = 0, v1 = 1): void {
    // right = up × normal, so right × up = normal and the quad faces out of the wall.
    this.add(new THREE.Vector3(x, y, z), new THREE.Vector3(nz, 0, -nx), new THREE.Vector3(0, 1, 0), w, h, tile, strength, v0, v1);
  }

  build(renderOrder: number): THREE.Mesh | null {
    if (!this.quads.length) return null;
    const n = this.quads.length;
    const pos = new Float32Array(n * 12);
    const uv = new Float32Array(n * 8);
    const col = new Float32Array(n * 16);
    const idx = new Uint32Array(n * 6);
    const p = new THREE.Vector3();
    this.quads.forEach((q, i) => {
      const corners: Array<[number, number]> = [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
      ];
      corners.forEach(([sx, sy], k) => {
        p.copy(q.c)
          .addScaledVector(q.right, sx * q.w)
          .addScaledVector(q.up, sy * q.h);
        pos.set([p.x, p.y, p.z], (i * 4 + k) * 3);
        uv.set([sx < 0 ? q.uv[0] : q.uv[2], sy < 0 ? q.uv[1] : q.uv[3]], (i * 4 + k) * 2);
        col.set(q.rgba, (i * 4 + k) * 4);
      });
      const b = i * 4;
      idx.set([b, b + 1, b + 2, b, b + 2, b + 3], i * 6);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.BufferAttribute(col, 4));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, this.kind === 'glow' ? GLOW : SHADE);
    m.name = this.kind === 'glow' ? 'design-glow' : 'design-shade';
    m.renderOrder = renderOrder;
    m.castShadow = false;
    m.receiveShadow = false;
    m.matrixAutoUpdate = false;
    return m;
  }
}

// ------------------------------------------------------------------ gallery floor

function hash(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

/** Value noise that wraps every `P` lattice cells, so the texture tiles seamlessly. */
function pnoise(u: number, v: number, P: number, seed: number): number {
  const x = u * P;
  const y = v * P;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const lat = (i: number, j: number) => hash((((i % P) + P) % P) * 57.3 + (((j % P) + P) % P) * 311.7 + seed * 19.19);
  const sx = xf * xf * (3 - 2 * xf);
  const sy = yf * yf * (3 - 2 * yf);
  const a = lat(xi, yi) * (1 - sx) + lat(xi + 1, yi) * sx;
  const b = lat(xi, yi + 1) * (1 - sx) + lat(xi + 1, yi + 1) * sx;
  return a * (1 - sy) + b * sy;
}

/** Honed mineral screed: soft clouds and a faint fine grain, greys only. */
function floorTexture(hex: string): THREE.DataTexture {
  const N = 256;
  const data = new Uint8Array(N * N * 4);
  const base = new THREE.Color(hex);
  const c = new THREE.Color();
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = x / N;
      const v = y / N;
      const clouds = 0.5 * pnoise(u, v, 4, 1) + 0.3 * pnoise(u, v, 9, 2) + 0.2 * pnoise(u, v, 23, 3);
      const grain = (hash(x * 13.1 + y * 71.7) - 0.5) * 0.035;
      const k = 0.85 + 0.3 * clouds + grain;
      c.copy(base).multiplyScalar(k);
      const o = c.clone().convertLinearToSRGB();
      const i = (y * N + x) * 4;
      data[i] = Math.round(THREE.MathUtils.clamp(o.r, 0, 1) * 255);
      data[i + 1] = Math.round(THREE.MathUtils.clamp(o.g, 0, 1) * 255);
      data[i + 2] = Math.round(THREE.MathUtils.clamp(o.b, 0, 1) * 255);
      data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, N, N);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

/**
 * The gallery's own floor finish: a 1.5 mm skin over the shell floor (never coplanar with it, so
 * no depth fighting at grazing angles). Pieces standing at y = 0 simply sit in it.
 */
export const FLOOR_Y = 0.0015;
export const FLOOR = new THREE.MeshStandardMaterial({
  map: floorTexture('#5d6064'),
  roughness: 0.62,
  metalness: 0,
});
FLOOR.name = 'design-floor';

/** Floor plane over a world rectangle, UVs in world metres / tile. */
export function floorPlane(x0: number, z0: number, x1: number, z1: number, tile = 4.5): THREE.Mesh {
  const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, FLOOR_Y, (z0 + z1) / 2);
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / tile, -pos.getZ(i) / tile);
  const m = new THREE.Mesh(g, FLOOR);
  m.castShadow = false;
  m.receiveShadow = true;
  return m;
}

// ------------------------------------------------------------------ props

/**
 * Museum bench: a leather cushion with a piped seam on a polished steel tray, two flat-bar sled
 * frames with rubber glides and a tube stretcher. Origin = centre of the footprint on the floor,
 * length along X.
 */
export function bench(len = 1.8, depth = 0.46, seat = 0.45): THREE.Group {
  const g = new THREE.Group();
  const cushionH = 0.1;
  const cy = seat - cushionH / 2;
  part(g, new RoundedBoxGeometry(len, cushionH, depth, 3, 0.028), 'leather', 0, cy, 0);
  // Piping around the cushion's waist and a stitched centre seam on the top.
  part(g, new RoundedBoxGeometry(len + 0.004, 0.008, depth + 0.004, 2, 0.003), 'leatherSeam', 0, cy - 0.012, 0);
  blk(g, 'leatherSeam', len - 0.12, 0.002, 0.006, 0, seat + 0.0005, 0);
  // Steel tray under the cushion.
  const trayY = seat - cushionH - 0.008;
  blk(g, 'steel', len - 0.06, 0.016, depth - 0.05, 0, trayY, 0);
  // Two sled frames of 40×10 flat bar.
  const fx = len / 2 - 0.2;
  const fz = depth / 2 - 0.05;
  const barW = 0.04;
  const barT = 0.01;
  const top = trayY - 0.008;
  const bottom = 0.012;
  for (const sx of [-1, 1]) {
    const x = sx * fx;
    blk(g, 'steel', barW, barT, 2 * fz + barT, x, top - barT / 2, 0);
    blk(g, 'steel', barW, barT, 2 * fz + barT, x, bottom + barT / 2, 0);
    for (const sz of [-1, 1]) {
      blk(g, 'steel', barW, top - bottom - 2 * barT, barT, x, (top + bottom) / 2, sz * fz);
      blk(g, 'rubber', barW + 0.004, bottom, 0.05, x, bottom / 2, sz * (fz - 0.02));
    }
  }
  // Tube stretcher between the frames.
  const st = part(g, new THREE.CylinderGeometry(0.012, 0.012, 2 * fx - barW, 12), 'steel', 0, 0.16, 0);
  st.rotation.z = Math.PI / 2;
  for (const sx of [-1, 1]) {
    const ring = part(g, new THREE.CylinderGeometry(0.018, 0.018, 0.012, 12), 'steelSatin', sx * (fx - barW / 2 - 0.006), 0.16, 0);
    ring.rotation.z = Math.PI / 2;
  }
  g.userData.foot = { w: len, d: depth };
  return g;
}

/**
 * Track spotlight. Origin = where the adapter meets the underside of the track. The head pans
 * and tilts so its lens looks at `target` (a world point); `at` is the world attach point.
 */
export function trackSpot(at: THREE.Vector3, target: THREE.Vector3): THREE.Group {
  const g = new THREE.Group();
  g.position.copy(at);
  blk(g, 'black', 0.075, 0.03, 0.042, 0, -0.015, 0, FIX);
  blk(g, 'blackMatte', 0.02, 0.012, 0.046, 0.022, -0.012, 0, FIX); // polarity latch
  const pivot = new THREE.Vector3(0, -0.14, 0).add(at);
  const dir = target.clone().sub(pivot);
  const hx = dir.x;
  const hz = dir.z;
  const yawG = new THREE.Group();
  yawG.position.set(0, -0.03, 0);
  yawG.rotation.y = Math.atan2(-hx, -hz);
  g.add(yawG);
  cyl(yawG, 'black', 0.008, 0.008, 0.035, 10, 0, -0.0175, 0, FIX);
  cyl(yawG, 'blackMatte', 0.016, 0.016, 0.01, 12, 0, -0.005, 0, FIX); // swivel
  blk(yawG, 'black', 0.128, 0.01, 0.024, 0, -0.04, 0, FIX); // yoke bridge
  for (const sx of [-1, 1]) {
    blk(yawG, 'black', 0.006, 0.085, 0.024, sx * 0.061, -0.0825, 0, FIX);
    const knob = cyl(yawG, 'blackMatte', 0.011, 0.011, 0.008, 12, sx * 0.068, -0.11, 0, FIX);
    knob.rotation.z = Math.PI / 2;
  }
  const head = new THREE.Group();
  head.position.set(0, -0.11, 0);
  head.rotation.x = Math.atan2(Math.hypot(hx, hz), -dir.y);
  yawG.add(head);
  // Body along -Y (towards the target): cooling fins at the back, bezel and lens at the front.
  cyl(head, 'black', 0.046, 0.046, 0.17, 20, 0, -0.02, 0, FIX);
  for (let i = 0; i < 4; i++) cyl(head, 'blackMatte', 0.05, 0.05, 0.005, 20, 0, 0.055 - i * 0.014, 0, FIX);
  cyl(head, 'blackMatte', 0.036, 0.042, 0.012, 16, 0, 0.071, 0, FIX); // back cap
  const bezel = part(head, new THREE.TorusGeometry(0.041, 0.0055, 6, 20), 'steelDark', 0, -0.106, 0, FIX);
  bezel.rotation.x = Math.PI / 2;
  const lens = part(head, new THREE.CircleGeometry(0.036, 20), 'lamp', 0, -0.1056, 0, FIX);
  lens.rotation.x = Math.PI / 2; // faces -Y
  return g;
}

/**
 * Suspended lighting track from x0 to x1 at height y (underside), hung on steel cables from
 * ceiling canopies at `hangers`, with end caps and a feed cable at the west end.
 */
export function track(parent: THREE.Object3D, x0: number, x1: number, y: number, z: number, ceiling: number, hangers: number[]): void {
  const h = 0.036;
  span(parent, 'black', x0, y, z - 0.019, x1, y + h, z + 0.019);
  // Twin conductor grooves along the underside.
  for (const dz of [-0.008, 0.008]) span(parent, 'gap', x0 + 0.03, y - 0.002, z + dz - 0.002, x1 - 0.03, y + 0.001, z + dz + 0.002);
  for (const x of [x0, x1]) blk(parent, 'blackMatte', 0.022, h + 0.006, 0.044, x + (x === x0 ? -0.011 : 0.011), y + h / 2, z, FIX);
  for (const x of hangers) {
    const len = ceiling - (y + h) - 0.012;
    cyl(parent, 'steel', 0.0025, 0.0025, len, 6, x, y + h + len / 2, z, FIX);
    cyl(parent, 'steelSatin', 0.009, 0.009, 0.03, 10, x, y + h + 0.015, z, FIX); // gripper
    cyl(parent, 'canopy', 0.04, 0.04, 0.012, 16, x, ceiling - 0.006, z, FIX);
  }
  // Feed: a black cable from a ceiling box down to the west end cap.
  const fx = x0 - 0.011;
  const flen = ceiling - (y + h) - 0.03;
  cyl(parent, 'blackMatte', 0.004, 0.004, flen, 6, fx, y + h + flen / 2, z, FIX);
  blk(parent, 'canopy', 0.1, 0.03, 0.07, fx, ceiling - 0.015, z, FIX);
}

/**
 * Wall-washer slot flush under the ceiling: a black channel with an emissive strip, running
 * from a to b along `axis`, centred on the line `at` (the other horizontal coordinate).
 */
export function washerSlot(parent: THREE.Object3D, axis: 'x' | 'z', a: number, b: number, at: number, ceiling: number): void {
  const w = 0.09;
  if (axis === 'x') {
    span(parent, 'black', a, ceiling - 0.028, at - w / 2, b, ceiling, at + w / 2);
    span(parent, 'lampSoft', a + 0.02, ceiling - 0.032, at - 0.018, b - 0.02, ceiling - 0.024, at + 0.018);
  } else {
    span(parent, 'black', at - w / 2, ceiling - 0.028, a, at + w / 2, ceiling, b);
    span(parent, 'lampSoft', at - 0.018, ceiling - 0.032, a + 0.02, at + 0.018, ceiling - 0.024, b - 0.02);
  }
}

/**
 * Picture light: slim bar on two arms, emissive slot on its underside. Local frame: faces +Z,
 * origin on the wall surface at the height of the wall plate.
 */
export function pictureLight(len: number): THREE.Group {
  const g = new THREE.Group();
  blk(g, 'black', 0.1, 0.05, 0.012, 0, 0, 0.006, FIX); // wall plate
  cyl(g, 'blackMatte', 0.014, 0.014, 0.01, 12, 0, 0, 0.014, FIX).rotation.x = Math.PI / 2;
  // Two arms reaching out and down to the bar.
  for (const sx of [-1, 1]) rod(g, 'black', new THREE.Vector3(sx * 0.03, -0.005, 0.012), new THREE.Vector3(sx * len * 0.3, -0.07, 0.205), 0.0075, FIX);
  const bar = cyl(g, 'black', 0.021, 0.021, len, 16, 0, -0.07, 0.22, FIX);
  bar.rotation.z = Math.PI / 2;
  for (const sx of [-1, 1]) {
    const cap = cyl(g, 'steelDark', 0.022, 0.022, 0.012, 16, sx * (len / 2 + 0.006), -0.07, 0.22, FIX);
    cap.rotation.z = Math.PI / 2;
  }
  blk(g, 'lamp', len - 0.05, 0.006, 0.016, 0, -0.089, 0.212, FIX);
  return g;
}

/**
 * Exhibit inlay: a polished stone square set flush in the floor with a stainless edge. `inset`
 * adds an accent line (the design colour) a few centimetres inside the edge. Top at `top`.
 */
export function inlay(parent: THREE.Object3D, x: number, z: number, size: number, top: number, key: Sw = 'stone', inset?: Sw): void {
  const edge = 0.012;
  const y0 = -0.02;
  const h = size / 2;
  // Stainless edge (four strips, mitred by overlap-free layout).
  const et = top + 0.0002;
  span(parent, 'steelSatin', x - h, y0, z - h, x + h, et, z - h + edge);
  span(parent, 'steelSatin', x - h, y0, z + h - edge, x + h, et, z + h);
  span(parent, 'steelSatin', x - h, y0, z - h + edge, x - h + edge, et, z + h - edge);
  span(parent, 'steelSatin', x + h - edge, y0, z - h + edge, x + h, et, z + h - edge);
  const s = h - edge;
  if (!inset) {
    span(parent, key, x - s, y0, z - s, x + s, top, z + s);
    return;
  }
  // Stone border, accent line, stone field: non-overlapping rings so no faces are coplanar-stacked.
  const b = 0.07;
  const l = 0.014;
  const ring = (r0: number, r1: number, k: Sw) => {
    span(parent, k, x - r0, y0, z - r0, x + r0, top, z - r1);
    span(parent, k, x - r0, y0, z + r1, x + r0, top, z + r0);
    span(parent, k, x - r0, y0, z - r1, x - r1, top, z + r1);
    span(parent, k, x + r1, y0, z - r1, x + r0, top, z + r1);
  };
  ring(s, s - b, key);
  ring(s - b, s - b - l, inset);
  span(parent, key, x - (s - b - l), y0, z - (s - b - l), x + (s - b - l), top, z + (s - b - l));
}
