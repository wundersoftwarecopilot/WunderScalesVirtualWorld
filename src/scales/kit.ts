import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createLogo } from '../brand/logo';
import type { Division } from '../brand/urls';
import { SegmentDisplay, type SegmentDisplayOptions } from './segments';
import type { LocalRect } from './types';

/**
 * Shared building blocks for the procedural scale models.
 *
 * Work in CENTIMETRES inside `createScaleRoot().cm` (a group scaled by 0.01), with Y up and the
 * front facing +Z. Every helper returns a mesh/group already added to `parent` when one is given.
 * Positions are the centre of the part unless a helper says otherwise.
 */

export { SegmentDisplay };

// ---------------------------------------------------------------- materials (shared instances)

function std(color: THREE.ColorRepresentation, roughness: number, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

export const MAT = {
  /** ABS housings, display heads. */
  abs: std('#eeeeea', 0.45),
  absGrey: std('#c9cbcd', 0.5),
  absDark: std('#2f3236', 0.5),
  /** Epoxy-painted steel/aluminium. */
  paintWhite: std('#f1f1ef', 0.4, 0.05),
  paintGrey: std('#8e9296', 0.45, 0.1),
  paintDark: std('#4a4d52', 0.5, 0.15),
  paintIndustrial: std('#7a7a7a', 0.5, 0.2),
  stainless: std('#b8bcc0', 0.3, 1),
  brushed: std('#a9adb1', 0.42, 1),
  chrome: std('#e8e8e8', 0.12, 1),
  gold: std('#c9a55a', 0.25, 1),
  aluminium: std('#c3c6c9', 0.35, 0.9),
  rubber: std('#1e1e1e', 0.92),
  rubberGrey: std('#3b3d40', 0.9),
  blackPlastic: std('#1b1c1e', 0.55),
  upholsteryGrey: std('#6e7176', 0.8),
  mattress: std('#6e6e6e', 0.85),
  /** Dark window glass in front of LCDs. */
  lcdGlass: std('#15181b', 0.15, 0.2),
  /** Classic grey-green LCD background (lit a little so it reads in dim rooms). */
  lcdPanel: new THREE.MeshStandardMaterial({ color: '#9fb39a', roughness: 0.6, emissive: '#6f8a6a', emissiveIntensity: 0.25 }),
  keycap: std('#d7d9db', 0.5),
  keycapDark: std('#3c3f44', 0.5),
  /** Clear glass (draft shields, glass platforms). Transparent, double sided, no depth write. */
  glass: new THREE.MeshPhysicalMaterial({
    color: '#e9f3f2',
    roughness: 0.04,
    metalness: 0,
    transmission: 0,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
  }),
  glassTinted: new THREE.MeshPhysicalMaterial({
    color: '#cfe6e3',
    roughness: 0.05,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    depthWrite: false,
    clearcoat: 1,
  }),
};

export function emissive(color: THREE.ColorRepresentation, intensity = 1.6): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: '#000000', emissive: color, emissiveIntensity: intensity, roughness: 0.6 });
}

// ---------------------------------------------------------------- root

export interface ScaleRoot {
  /** Metre-space root: return this as ScaleInstance.root. */
  root: THREE.Group;
  /** Centimetre-space group (scale 0.01) to build into. */
  cm: THREE.Group;
}

export function createScaleRoot(name: string): ScaleRoot {
  const root = new THREE.Group();
  root.name = name;
  const cmGroup = new THREE.Group();
  cmGroup.scale.setScalar(0.01);
  root.add(cmGroup);
  return { root, cm: cmGroup };
}

/** Convert a local rectangle given in cm to metres (for standOn/colliders). */
export function rectCm(x: number, z: number, w: number, d: number): LocalRect {
  return { x: x / 100, z: z / 100, w: w / 100, d: d / 100 };
}

// ---------------------------------------------------------------- placement helper

export interface Place {
  x?: number;
  y?: number;
  z?: number;
  /** Euler rotation in DEGREES. */
  rx?: number;
  ry?: number;
  rz?: number;
  /** When true, y is the bottom of the part instead of its centre (boxes/cylinders). */
  bottom?: boolean;
  castShadow?: boolean;
}

const D2R = Math.PI / 180;

function place<T extends THREE.Object3D>(o: T, p: Place = {}, h = 0, parent?: THREE.Object3D): T {
  o.position.set(p.x ?? 0, (p.y ?? 0) + (p.bottom ? h / 2 : 0), p.z ?? 0);
  o.rotation.set((p.rx ?? 0) * D2R, (p.ry ?? 0) * D2R, (p.rz ?? 0) * D2R);
  if ((o as unknown as THREE.Mesh).isMesh) {
    o.castShadow = p.castShadow ?? true;
    o.receiveShadow = true;
  }
  parent?.add(o);
  return o;
}

// ---------------------------------------------------------------- primitives (cm)

const geoCache = new Map<string, THREE.BufferGeometry>();
function cached<G extends THREE.BufferGeometry>(key: string, make: () => G): G {
  let g = geoCache.get(key) as G | undefined;
  if (!g) geoCache.set(key, (g = make()));
  return g;
}

export function box(parent: THREE.Object3D | null, w: number, h: number, d: number, mat: THREE.Material, p: Place = {}): THREE.Mesh {
  const g = cached(`box${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
  return place(new THREE.Mesh(g, mat), p, h, parent ?? undefined);
}

/** Rounded box; radius is clamped to half the smallest side. */
export function rbox(parent: THREE.Object3D | null, w: number, h: number, d: number, radius: number, mat: THREE.Material, p: Place = {}): THREE.Mesh {
  const r = Math.min(radius, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const g = cached(`rbox${w}|${h}|${d}|${r}`, () => new RoundedBoxGeometry(w, h, d, 3, Math.max(0.001, r)));
  return place(new THREE.Mesh(g, mat), p, h, parent ?? undefined);
}

/** Vertical cylinder (axis Y). Use rx:90 to lay it along Z, rz:90 along X. */
export function cyl(parent: THREE.Object3D | null, rTop: number, rBottom: number, h: number, mat: THREE.Material, p: Place = {}, segments = 32): THREE.Mesh {
  const g = cached(`cyl${rTop}|${rBottom}|${h}|${segments}`, () => new THREE.CylinderGeometry(rTop, rBottom, h, segments));
  return place(new THREE.Mesh(g, mat), p, h, parent ?? undefined);
}

export function sphere(parent: THREE.Object3D | null, r: number, mat: THREE.Material, p: Place = {}, scale?: [number, number, number]): THREE.Mesh {
  const g = cached(`sph${r}`, () => new THREE.SphereGeometry(r, 32, 16));
  const m = place(new THREE.Mesh(g, mat), p, 0, parent ?? undefined);
  if (scale) m.scale.set(...scale);
  return m;
}

export function torus(parent: THREE.Object3D | null, R: number, tube: number, mat: THREE.Material, p: Place = {}, arc = Math.PI * 2): THREE.Mesh {
  const g = cached(`tor${R}|${tube}|${arc}`, () => new THREE.TorusGeometry(R, tube, 12, 48, arc));
  return place(new THREE.Mesh(g, mat), p, 0, parent ?? undefined);
}

/**
 * Tube along a polyline with rounded corners (handrails, tubular frames, tillers).
 * points are [x,y,z] in cm; cornerRadius rounds each interior vertex.
 */
export function tubePath(
  parent: THREE.Object3D | null,
  points: Array<[number, number, number]>,
  radius: number,
  mat: THREE.Material,
  opts: { cornerRadius?: number; closed?: boolean; radialSegments?: number } = {},
): THREE.Mesh {
  const pts = points.map((p) => new THREE.Vector3(...p));
  const path = roundedPolyline(pts, opts.cornerRadius ?? radius * 3, opts.closed ?? false);
  const segs = Math.max(8, Math.round(path.getLength() / 2));
  const g = new THREE.TubeGeometry(path, segs, radius, opts.radialSegments ?? 12, false);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  parent?.add(m);
  // End caps so tubes do not look hollow.
  if (!opts.closed && pts.length >= 2) {
    for (const [a, b] of [
      [pts[0], pts[1]],
      [pts[pts.length - 1], pts[pts.length - 2]],
    ]) {
      const cap = new THREE.Mesh(cached(`cap${radius}`, () => new THREE.CircleGeometry(radius, 12)), mat);
      cap.position.copy(a);
      cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), a.clone().sub(b).normalize());
      parent?.add(cap);
    }
  }
  return m;
}

export function roundedPolyline(pts: THREE.Vector3[], r: number, closed: boolean): THREE.CurvePath<THREE.Vector3> {
  const path = new THREE.CurvePath<THREE.Vector3>();
  const P = closed ? [...pts, pts[0], pts[1]] : pts;
  let cursor = P[0].clone();
  for (let i = 1; i < P.length - 1; i++) {
    const prev = P[i - 1];
    const cur = P[i];
    const next = P[i + 1];
    const d1 = cur.clone().sub(prev);
    const d2 = next.clone().sub(cur);
    const rr = Math.min(r, d1.length() / 2, d2.length() / 2);
    const a = cur.clone().sub(d1.normalize().multiplyScalar(rr));
    const b = cur.clone().add(d2.normalize().multiplyScalar(rr));
    if (cursor.distanceTo(a) > 1e-6) path.add(new THREE.LineCurve3(cursor, a));
    path.add(new THREE.QuadraticBezierCurve3(a, cur.clone(), b));
    cursor = b;
  }
  const last = closed ? P[P.length - 2] : P[P.length - 1];
  if (!closed && cursor.distanceTo(last) > 1e-6) path.add(new THREE.LineCurve3(cursor, last.clone()));
  if (closed && path.curves.length) {
    const start = path.curves[0].getPoint(0);
    if (cursor.distanceTo(start) > 1e-6) path.add(new THREE.LineCurve3(cursor, start));
  }
  return path;
}

/** Extrude a 2D outline (points in the XY plane, cm) by `depth` along +Z, centred on Z. */
export function extrude(parent: THREE.Object3D | null, outline: Array<[number, number]>, depth: number, mat: THREE.Material, p: Place = {}, bevel = 0): THREE.Mesh {
  const s = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 2,
    curveSegments: 16,
  });
  g.translate(0, 0, -depth / 2);
  return place(new THREE.Mesh(g, mat), p, 0, parent ?? undefined);
}

/**
 * Ramp/wedge: w wide (X), d deep (Z), h high (Y). The high edge is at -Z (touching the
 * platform), sloping down to 0 at +Z. Origin at the bottom centre.
 */
export function wedge(parent: THREE.Object3D | null, w: number, h: number, d: number, mat: THREE.Material, p: Place = {}): THREE.Mesh {
  const g = cached(`wedge${w}|${h}|${d}`, () => {
    const s = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(-d / 2, h)]);
    const e = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
    e.translate(0, 0, -w / 2);
    e.rotateY(-Math.PI / 2); // profile X → Z
    return e;
  });
  return place(new THREE.Mesh(g, mat), p, 0, parent ?? undefined);
}

/** Lathe a profile ([radius, y] pairs, cm) around Y. */
export function lathe(parent: THREE.Object3D | null, profile: Array<[number, number]>, mat: THREE.Material, p: Place = {}, segments = 48): THREE.Mesh {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments);
  return place(new THREE.Mesh(g, mat), p, 0, parent ?? undefined);
}

/**
 * Baby-scale tray: the lower half of an ellipsoid (open top), rx/rz = half length/width,
 * ry = depth. Origin at the rim centre; the bowl hangs below it.
 */
const doubleSided = new Map<string, THREE.Material>();
export function tray(parent: THREE.Object3D | null, rx: number, ry: number, rz: number, mat: THREE.Material, p: Place = {}): THREE.Mesh {
  const g = cached('tray', () => new THREE.SphereGeometry(1, 48, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2));
  let m2 = doubleSided.get(mat.uuid);
  if (!m2) {
    m2 = mat.clone();
    m2.side = THREE.DoubleSide;
    doubleSided.set(mat.uuid, m2);
  }
  const m = place(new THREE.Mesh(g, m2), p, 0, parent ?? undefined);
  m.scale.set(rx, ry, rz);
  return m;
}

// ---------------------------------------------------------------- parts

/** Swivel caster, diameter d (cm). Origin at the floor contact point. */
export function caster(parent: THREE.Object3D | null, d = 7.5, p: Place = {}): THREE.Group {
  const g = new THREE.Group();
  const wheelW = d * 0.4;
  cyl(g, d / 2, d / 2, wheelW, MAT.rubber, { y: d / 2, rz: 90 }, 20);
  cyl(g, d * 0.18, d * 0.18, wheelW + 0.4, MAT.stainless, { y: d / 2, rz: 90 }, 12);
  box(g, wheelW + 1.2, d * 0.35, d * 0.55, MAT.paintGrey, { y: d + d * 0.1, z: -d * 0.12 });
  cyl(g, d * 0.12, d * 0.12, d * 0.4, MAT.stainless, { y: d * 1.35 });
  return place(g, p, 0, parent ?? undefined);
}

/** Levelling foot (cm). Origin at the floor. */
export function foot(parent: THREE.Object3D | null, d = 3, h = 1.5, p: Place = {}): THREE.Group {
  const g = new THREE.Group();
  cyl(g, d / 2, d / 2 + 0.3, h * 0.45, MAT.rubber, { y: 0, bottom: true }, 16);
  cyl(g, d * 0.18, d * 0.18, h * 0.6, MAT.stainless, { y: h * 0.4, bottom: true }, 10);
  return place(g, p, 0, parent ?? undefined);
}

/** Grid of small key caps as one InstancedMesh, laid flat on the XZ plane, centred. */
export function keypad(
  parent: THREE.Object3D | null,
  cols: number,
  rows: number,
  key: { w: number; d: number; h: number; gap: number },
  mat: THREE.Material = MAT.keycap,
  p: Place = {},
): THREE.InstancedMesh {
  const g = cached(`key${key.w}|${key.h}|${key.d}`, () => new RoundedBoxGeometry(key.w, key.h, key.d, 2, Math.min(key.w, key.d, key.h) * 0.3));
  const im = new THREE.InstancedMesh(g, mat, cols * rows);
  const m = new THREE.Matrix4();
  const totalW = cols * key.w + (cols - 1) * key.gap;
  const totalD = rows * key.d + (rows - 1) * key.gap;
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      m.makeTranslation(-totalW / 2 + key.w / 2 + c * (key.w + key.gap), key.h / 2, -totalD / 2 + key.d / 2 + r * (key.d + key.gap));
      im.setMatrixAt(i++, m);
    }
  }
  im.castShadow = false;
  return place(im, p, 0, parent ?? undefined);
}

/** Small status lamp (a round emissive dot). setOn toggles it. Faces +Z. */
export function lamp(parent: THREE.Object3D | null, d: number, color: THREE.ColorRepresentation, p: Place = {}): THREE.Mesh & { setOn(on: boolean): void } {
  const mat = new THREE.MeshBasicMaterial({ color: '#2a2a2a', toneMapped: false });
  const onC = new THREE.Color(color);
  const offC = new THREE.Color('#2a2a2a');
  const mesh = place(new THREE.Mesh(cached('lampdisc', () => new THREE.CircleGeometry(0.5, 16)), mat), p, 0, parent ?? undefined);
  mesh.scale.setScalar(d);
  mesh.castShadow = false;
  return Object.assign(mesh, { setOn: (on: boolean) => void mat.color.copy(on ? onC : offC) });
}

export interface LcdOptions extends Omit<SegmentDisplayOptions, 'height'> {
  /** Window size in cm. Digits are sized to fit. */
  w: number;
  h: number;
  /** 'lcd' = dark digits on grey-green; 'led-red' / 'led-green' = glowing digits on black. */
  kind?: 'lcd' | 'led-red' | 'led-green' | 'vfd';
}

/**
 * A display window with a 7-segment readout inside, facing +Z, centred at the origin.
 * Returns the group and the SegmentDisplay to drive.
 */
export function lcd(parent: THREE.Object3D | null, o: LcdOptions, p: Place = {}): { object: THREE.Group; display: SegmentDisplay } {
  const g = new THREE.Group();
  const kind = o.kind ?? 'lcd';
  const bg = kind === 'lcd' ? MAT.lcdPanel : MAT.lcdGlass;
  const panel = new THREE.Mesh(cached(`plane${o.w}|${o.h}`, () => new THREE.PlaneGeometry(o.w, o.h)), bg);
  g.add(panel);
  const colors = {
    lcd: { on: '#1a221a', off: '#bfd5b9' },
    'led-red': { on: '#ff2a1a', off: '#2a0806' },
    'led-green': { on: '#39ff6a', off: '#0a2410' },
    vfd: { on: '#6ff7e6', off: '#0d2a28' },
  }[kind];
  const digitH = Math.min(o.h * 0.68, (o.w * 0.9) / (o.digits * 0.76));
  const display = new SegmentDisplay({ digits: o.digits, height: digitH, color: o.color ?? colors.on, offColor: o.offColor ?? colors.off, slant: o.slant });
  display.object.position.z = 0.05;
  g.add(display.object);
  display.set(0, 1);
  return { object: place(g, p, 0, parent ?? undefined), display };
}

/**
 * VISORE — the standard Wunder rounded display head (21.5 W × 4 H × 18 D cm), ABS off-white,
 * a main 5-digit LCD and a small secondary window, and 4 round buttons. Origin at the centre of
 * the head; tilt (deg, default 30) leans the face back from vertical so it looks up at the user.
 * Faces +Z.
 */
export function visore(parent: THREE.Object3D | null, p: Place & { tilt?: number; secondary?: boolean } = {}): { object: THREE.Group; main: SegmentDisplay; sub?: SegmentDisplay } {
  const g = new THREE.Group();
  const face = new THREE.Group();
  g.add(face);
  // Head body: the "face" is the +Y side of a flat rounded slab, rotated so it faces +Z and tilts up.
  rbox(face, 21.5, 18, 4, 1.8, MAT.abs, {});
  const main = lcd(face, { w: 12, h: 4, digits: 5 }, { y: 3.4, z: 2.02 });
  let sub: SegmentDisplay | undefined;
  if (p.secondary !== false) {
    sub = lcd(face, { w: 8, h: 2.2, digits: 4 }, { y: -1.2, z: 2.02 }).display;
    sub.set(0, 1);
  }
  for (let i = 0; i < 4; i++) cyl(face, 0.8, 0.8, 0.4, i === 0 ? MAT.keycapDark : MAT.keycap, { x: -4.5 + i * 3, y: -5.6, z: 2.1, rx: 90 }, 16);
  face.rotation.x = -(p.tilt ?? 30) * D2R;
  place(g, { ...p }, 0, parent ?? undefined);
  return { object: g, main: main.display, sub };
}

/**
 * WX industrial indicator head (≈28 W × 18 H × 9 D cm): dark faceplate with an LCD strip and a
 * key grid, tilted towards the user. Origin at the centre. Faces +Z.
 */
export function wxHead(parent: THREE.Object3D | null, p: Place & { tilt?: number } = {}): { object: THREE.Group; display: SegmentDisplay } {
  const g = new THREE.Group();
  const face = new THREE.Group();
  g.add(face);
  rbox(face, 28, 18, 9, 1.5, MAT.stainless, {});
  box(face, 26, 16, 0.4, MAT.absDark, { z: 4.5 });
  const win = lcd(face, { w: 21, h: 5.5, digits: 6, kind: 'lcd' }, { y: 3.6, z: 4.75 });
  const pad = keypad(face, 6, 2, { w: 2.6, d: 1.6, h: 0.5, gap: 0.7 }, MAT.keycap, { y: -3.5, z: 4.72, rx: 90 });
  pad.castShadow = false;
  face.rotation.x = -(p.tilt ?? 16) * D2R;
  place(g, p, 0, parent ?? undefined);
  return { object: g, display: win.display };
}

/**
 * Mechanical round dial (bathroom/column scales): housing, bezel, white face with 50 ticks
 * (every 5th long), red pointer, glass dome. Faces +Z, origin at the dial centre.
 * setValue(0..1) turns the pointer through 330°.
 */
export function dial(
  parent: THREE.Object3D | null,
  o: { diameter?: number; depth?: number; housing?: THREE.Material; pointer?: THREE.ColorRepresentation } = {},
  p: Place = {},
): { object: THREE.Group; setValue(frac: number): void } {
  const D = o.diameter ?? 20;
  const R = D / 2;
  const depth = o.depth ?? 5.5;
  const g = new THREE.Group();
  const housing = o.housing ?? MAT.chrome;
  cyl(g, R, R, depth, housing, { rx: 90, z: -depth / 2 }, 48);
  torus(g, R - 0.35, 0.7, housing, { z: 0.1 });
  const face = new THREE.Mesh(cached('dialface', () => new THREE.CircleGeometry(1, 48)), std('#f4f4f0', 0.6));
  face.scale.setScalar(R - 1.0);
  face.position.z = 0.05;
  g.add(face);
  const ticks = new THREE.InstancedMesh(cached('tick', () => new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ color: '#1b1b1b' }), 50);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const pos = new THREE.Vector3();
  for (let i = 0; i < 50; i++) {
    const a = Math.PI / 2 - (i / 50) * Math.PI * 2;
    const long = i % 5 === 0;
    const len = long ? R * 0.16 : R * 0.08;
    const rr = R - 1.6 - len / 2;
    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), a);
    s.set(len, long ? 0.35 : 0.2, 1);
    pos.set(Math.cos(a) * rr, Math.sin(a) * rr, 0.08);
    ticks.setMatrixAt(i, m.compose(pos, q, s));
  }
  g.add(ticks);
  const pointer = new THREE.Group();
  pointer.position.z = 0.25;
  box(pointer, 0.28, R * 0.78, 0.1, std(o.pointer ?? '#d2261a', 0.5), { y: R * 0.3, castShadow: false });
  cyl(pointer, 0.7, 0.7, 0.4, MAT.blackPlastic, { rx: 90 }, 16);
  g.add(pointer);
  const dome = sphere(g, R - 0.8, MAT.glass, { z: 0.2 }, [1, 1, 0.12]);
  dome.castShadow = false;
  const setValue = (f: number) => {
    pointer.rotation.z = -THREE.MathUtils.clamp(f, 0, 1) * (330 * D2R);
  };
  setValue(0);
  place(g, p, 0, parent ?? undefined);
  return { object: g, setValue };
}

/**
 * Flat Wunder logo badge (placeholder monogram until the official SVG is supplied — see
 * brand/logo.ts). diameter in cm, faces +Z. Every badge becomes a clickable link to the scale's
 * product page automatically (the world finds them through userData.scaleLogo).
 */
export function logoBadge(parent: THREE.Object3D | null, diameter: number, division?: Division, p: Place = {}): THREE.Group {
  const logo = createLogo({ diameter, division, style: 'flat' });
  logo.userData.scaleLogo = true;
  return place(logo, p, 0, parent ?? undefined);
}

// ---------------------------------------------------------------- procedural textures (no images)

const texCache = new Map<string, THREE.Texture>();

/** Diamond checker-plate pattern (industrial platforms). Use as bumpMap/roughnessMap, repeat to taste. */
export function checkerPlateTexture(): THREE.DataTexture {
  const hit = texCache.get('checker');
  if (hit) return hit as THREE.DataTexture;
  const N = 64;
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // two sets of elongated diamonds, rotated ±45°, offset by half a cell
      const u = x / N;
      const v = y / N;
      const d1 = Math.abs((u + v) % 0.5 - 0.25) * 4 + Math.abs(((u - v + 1) % 0.5) - 0.25) * 12;
      const d2 = Math.abs(((u + v + 0.25) % 0.5) - 0.25) * 12 + Math.abs(((u - v + 1.25) % 0.5) - 0.25) * 4;
      const ridge = Math.max(0, 1 - Math.min(d1, d2)) ** 0.6;
      const val = Math.round(90 + ridge * 165);
      const i = (y * N + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = val;
      data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, N, N);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  texCache.set('checker', t);
  return t;
}

/** Terracotta "Tarsie" inlay tiles (design line). Colour map; stripes of tesserae. */
export function tarsieTexture(): THREE.DataTexture {
  const hit = texCache.get('tarsie');
  if (hit) return hit as THREE.DataTexture;
  const palette = ['#b5553c', '#d2a25a', '#e8dcc4', '#6b6f73', '#2e2e2e'].map((c) => new THREE.Color(c));
  const N = 128;
  const cells = 16;
  const data = new Uint8Array(N * N * 4);
  const hash = (a: number, b: number) => {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const cx = Math.floor((x / N) * cells);
      const cy = Math.floor((y / N) * cells);
      const fx = ((x / N) * cells) % 1;
      const fy = ((y / N) * cells) % 1;
      const grout = fx < 0.08 || fy < 0.08;
      const band = Math.floor(cy / 3) % palette.length;
      const pick = hash(cx, cy) < 0.7 ? band : Math.floor(hash(cy, cx) * palette.length);
      const c = grout ? new THREE.Color('#d8d2c4') : palette[pick].clone().multiplyScalar(0.9 + hash(cx + 7, cy) * 0.2);
      c.convertLinearToSRGB();
      const i = (y * N + x) * 4;
      data[i] = Math.round(THREE.MathUtils.clamp(c.r, 0, 1) * 255);
      data[i + 1] = Math.round(THREE.MathUtils.clamp(c.g, 0, 1) * 255);
      data[i + 2] = Math.round(THREE.MathUtils.clamp(c.b, 0, 1) * 255);
      data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, N, N);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  texCache.set('tarsie', t);
  return t;
}

// ---------------------------------------------------------------- weighing behaviour

/**
 * Standard weigh(active)/update(dt) pair for scales with segment displays.
 * `target()` picks the value to show while active (e.g. a visitor between 58 and 94 kg).
 * `onStable(on)` lets a model light a "stable" lamp or move a needle.
 */
export function weighing(
  displays: SegmentDisplay[],
  o: { target: () => number; decimals?: number; idle?: number; onStable?: (stable: boolean) => void; onValue?: (v: number) => void },
): { weigh(active: boolean): void; update(dt: number): void } {
  const decimals = o.decimals ?? 1;
  const idle = o.idle ?? 0;
  let wasStable = true;
  let active = false;
  for (const d of displays) d.set(idle, decimals);
  return {
    weigh(on: boolean) {
      active = on;
      const v = on ? o.target() : idle;
      for (const d of displays) d.tweenTo(v, decimals, on ? 1.1 : 0.6);
      o.onStable?.(false);
      wasStable = false;
    },
    update(dt: number) {
      for (const d of displays) d.update(dt);
      const stable = displays.every((d) => d.stable);
      if (stable !== wasStable) {
        wasStable = stable;
        o.onStable?.(stable && active);
      }
      if (displays[0]) o.onValue?.(displays[0].value);
    },
  };
}

/** A plausible adult visitor weight in kg, one decimal. */
export function visitorWeight(): number {
  return Math.round((58 + Math.random() * 36) * 10) / 10;
}
