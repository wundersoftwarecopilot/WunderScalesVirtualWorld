import * as THREE from 'three';
import { box, cyl, lcd, logoBadge, MAT, SegmentDisplay, sphere, torus, type Place } from '../kit';

/**
 * Helpers shared by the industriale table-top models (JSD DUAL, SMART, JPP, WJ 600, NHB).
 * No default export: the catalogue ignores this file. All sizes in cm, Y up, front = +Z.
 */

const D2R = Math.PI / 180;

// ---------------------------------------------------------------- shared materials

/** Bubble-level liquid and bubble (a faint green tint like a real vial). */
export const LEVEL_LIQUID = new THREE.MeshStandardMaterial({ color: '#c7d3bf', roughness: 0.15, metalness: 0.1 });
export const LEVEL_BUBBLE = new THREE.MeshStandardMaterial({ color: '#f6f8f2', roughness: 0.1 });
/** Satin (scotch-brite) stainless for pans: lighter and less mirror-like than MAT.stainless. */
export const SATIN_STEEL = new THREE.MeshStandardMaterial({ color: '#d2d5d8', roughness: 0.34, metalness: 0.72 });
/** Industriale accent key caps (function column), the division's amber. */
export const KEY_AMBER = new THREE.MeshStandardMaterial({ color: '#f0ae1a', roughness: 0.5 });

let labelMat: THREE.MeshStandardMaterial | null = null;
/**
 * Printed thermal label: white paper with a code-generated barcode band (bars run along the
 * label's length, +Z). Graphic only — no characters.
 */
export function labelMaterial(): THREE.MeshStandardMaterial {
  if (labelMat) return labelMat;
  const W = 64;
  const H = 32;
  const data = new Uint8Array(W * H * 4);
  // Deterministic bar widths (1–3 px) with 1–2 px gaps.
  const bars: boolean[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  while (bars.length < W - 16) {
    const b = 1 + Math.floor(rnd() * 3);
    const g = 1 + Math.floor(rnd() * 2);
    for (let i = 0; i < b; i++) bars.push(true);
    for (let i = 0; i < g; i++) bars.push(false);
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const inBand = x >= 8 && x < W - 8 && y >= 6 && y < H - 12;
      const dark = inBand && bars[x - 8];
      const i = (y * W + x) * 4;
      const v = dark ? 40 : 246;
      data[i] = data[i + 1] = v;
      data[i + 2] = dark ? 40 : 240;
      data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, W, H);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  labelMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: t, roughness: 0.85 });
  return labelMat;
}

// ---------------------------------------------------------------- groups and frames

/** A positioned/rotated sub-group (rotation in degrees, Euler XYZ), added to parent. */
export function group(parent: THREE.Object3D, p: Place = {}): THREE.Group {
  const g = new THREE.Group();
  g.position.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
  g.rotation.set((p.rx ?? 0) * D2R, (p.ry ?? 0) * D2R, (p.rz ?? 0) * D2R);
  parent.add(g);
  return g;
}

/**
 * Frame on a face that rises `slope` degrees from horizontal (90 = vertical) and faces the
 * front (+Z) and up. Inside it: +Z = outward normal, +Y = up the slope, X = across.
 * kit.lcd()/logoBadge() go in directly; kit.keypad() needs rx: 90.
 */
export function faceFrame(parent: THREE.Object3D, x: number, y: number, z: number, slope: number): THREE.Group {
  return group(parent, { x, y, z, rx: -(90 - slope) });
}

// ---------------------------------------------------------------- solids

type P2 = [number, number];

/** Mitre-offset a simple polygon inwards by d. */
function insetPolygon(pts: P2[], d: number): P2[] {
  const n = pts.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % n];
    area += x0 * y1 - x1 * y0;
  }
  const s = area > 0 ? 1 : -1;
  const out: P2[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const l0 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const l1 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const e0: P2 = [(p1[0] - p0[0]) / l0, (p1[1] - p0[1]) / l0];
    const e1: P2 = [(p2[0] - p1[0]) / l1, (p2[1] - p1[1]) / l1];
    const a: P2 = [p1[0] - e0[1] * s * d, p1[1] + e0[0] * s * d];
    const b: P2 = [p1[0] - e1[1] * s * d, p1[1] + e1[0] * s * d];
    const cross = e0[0] * e1[1] - e0[1] * e1[0];
    if (Math.abs(cross) < 1e-9) out.push(a);
    else {
      const t = ((b[0] - a[0]) * e1[1] - (b[1] - a[1]) * e1[0]) / cross;
      out.push([a[0] + t * e0[0], a[1] + t * e0[1]]);
    }
  }
  return out;
}

/** Polygon with every corner rounded (radius per vertex, as the cut length along the edges). */
function roundedShape(pts: P2[], radii: number[]): THREE.Shape {
  const n = pts.length;
  const entry: P2[] = [];
  const exit: P2[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const l0 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const l1 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const c = Math.max(0, Math.min(radii[i] ?? 0, l0 / 2 - 1e-3, l1 / 2 - 1e-3));
    entry.push([p1[0] - ((p1[0] - p0[0]) / l0) * c, p1[1] - ((p1[1] - p0[1]) / l0) * c]);
    exit.push([p1[0] + ((p2[0] - p1[0]) / l1) * c, p1[1] + ((p2[1] - p1[1]) / l1) * c]);
  }
  const s = new THREE.Shape();
  s.moveTo(exit[0][0], exit[0][1]);
  for (let k = 1; k <= n; k++) {
    const i = k % n;
    s.lineTo(entry[i][0], entry[i][1]);
    if (Math.hypot(exit[i][0] - entry[i][0], exit[i][1] - entry[i][1]) > 1e-4) s.quadraticCurveTo(pts[i][0], pts[i][1], exit[i][0], exit[i][1]);
  }
  return s;
}

export interface ProfileOptions {
  /** Edge bevel all round the two side faces (cm). */
  bevel?: number;
  /** Corner rounding of the side profile, one value or one per point (cm). */
  radius?: number | number[];
  /** Width factor at the top of the profile (1 = straight sides, 0.94 = sides lean in). */
  taper?: number;
  curveSegments?: number;
}

/**
 * A housing made from a side profile: `pts` are [z, y] pairs (cm) of the outline seen from the
 * right (front = +z), extruded `width` along X and centred on x = 0. Bevel and rounding stay
 * inside the outline, so the outline is the true size.
 */
export function profileSolid(parent: THREE.Object3D | null, pts: P2[], width: number, mat: THREE.Material, o: ProfileOptions = {}, p: Place = {}): THREE.Mesh {
  const b = o.bevel ?? 0.5;
  const radii = typeof o.radius === 'number' || o.radius === undefined ? pts.map(() => (o.radius as number | undefined) ?? 0) : o.radius;
  const inner = b > 0 ? insetPolygon(pts, b) : pts;
  const shape = roundedShape(
    inner,
    radii.map((r) => Math.max(0, r - b)),
  );
  const depth = width - 2 * b;
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 2,
    curveSegments: o.curveSegments ?? 5,
  });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2); // profile x → +Z, extrusion → X
  if (o.taper !== undefined && o.taper !== 1) {
    const pos = g.getAttribute('position');
    let y0 = Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      y0 = Math.min(y0, pos.getY(i));
      y1 = Math.max(y1, pos.getY(i));
    }
    for (let i = 0; i < pos.count; i++) {
      const k = (pos.getY(i) - y0) / (y1 - y0);
      pos.setX(i, pos.getX(i) * (1 - (1 - o.taper) * k));
    }
    pos.needsUpdate = true;
  }
  const m = new THREE.Mesh(g, mat);
  m.position.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
  m.rotation.set((p.rx ?? 0) * D2R, (p.ry ?? 0) * D2R, (p.rz ?? 0) * D2R);
  m.castShadow = p.castShadow ?? true;
  m.receiveShadow = true;
  parent?.add(m);
  return m;
}

const plateCache = new Map<string, THREE.BufferGeometry>();
/**
 * Flat plate with rounded corners in plan (rPlan) and a small edge bevel, w (X) × h (Y) × d (Z).
 * Origin at the BOTTOM centre. Good for pans, membranes, lids.
 */
export function plate(parent: THREE.Object3D | null, w: number, h: number, d: number, rPlan: number, bevel: number, mat: THREE.Material, p: Place = {}): THREE.Mesh {
  const b = Math.max(0.005, Math.min(bevel, h / 2 - 0.005));
  const key = `${w}|${h}|${d}|${rPlan}|${b}`;
  let g = plateCache.get(key);
  if (!g) {
    const iw = w - 2 * b;
    const id = d - 2 * b;
    const r = Math.max(0.01, Math.min(rPlan - b, iw / 2 - 0.01, id / 2 - 0.01));
    const s = new THREE.Shape();
    s.moveTo(-iw / 2 + r, -id / 2);
    s.lineTo(iw / 2 - r, -id / 2);
    s.absarc(iw / 2 - r, -id / 2 + r, r, -Math.PI / 2, 0, false);
    s.lineTo(iw / 2, id / 2 - r);
    s.absarc(iw / 2 - r, id / 2 - r, r, 0, Math.PI / 2, false);
    s.lineTo(-iw / 2 + r, id / 2);
    s.absarc(-iw / 2 + r, id / 2 - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(-iw / 2, -id / 2 + r);
    s.absarc(-iw / 2 + r, -id / 2 + r, r, Math.PI, Math.PI * 1.5, false);
    const e = new THREE.ExtrudeGeometry(s, { depth: h - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 5 });
    e.translate(0, 0, b);
    e.rotateX(-Math.PI / 2); // extrusion → +Y, shape y → -Z (symmetric)
    plateCache.set(key, (g = e));
  }
  const m = new THREE.Mesh(g, mat);
  m.position.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
  m.rotation.set((p.rx ?? 0) * D2R, (p.ry ?? 0) * D2R, (p.rz ?? 0) * D2R);
  m.castShadow = p.castShadow ?? true;
  m.receiveShadow = true;
  parent?.add(m);
  return m;
}

// ---------------------------------------------------------------- small parts

/** Round rubber foot with a moulded collar: total height h, origin on the support surface. */
export function rubberFoot(parent: THREE.Object3D, d: number, h: number, p: Place = {}): void {
  cyl(parent, d / 2 - 0.1, d / 2, h * 0.55, MAT.rubber, { ...p, y: (p.y ?? 0), bottom: true }, 16);
  cyl(parent, d * 0.38, d * 0.42, h * 0.5, MAT.rubberGrey, { ...p, y: (p.y ?? 0) + h * 0.5, bottom: true }, 16);
}

/** Round spirit level set into a top surface: chrome bezel, tinted vial, target ring, bubble. Origin on the surface. */
export function bubbleLevel(parent: THREE.Object3D, d: number, p: Place = {}): THREE.Group {
  const g = group(parent, p);
  cyl(g, d / 2, d / 2 + 0.05, 0.22, MAT.chrome, { y: 0, bottom: true }, 24);
  cyl(g, d / 2 - 0.16, d / 2 - 0.16, 0.06, LEVEL_LIQUID, { y: 0.2, bottom: true }, 24);
  torus(g, d * 0.17, 0.025, MAT.blackPlastic, { y: 0.27, rx: 90 });
  sphere(g, d * 0.11, LEVEL_BUBBLE, { y: 0.27, x: d * 0.03 }, [1, 0.25, 1]);
  return g;
}

/** A curve that never goes below y = minY (a cable lying on a surface cannot sink into it). */
class FloorClampedCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    private readonly src: THREE.Curve<THREE.Vector3>,
    private readonly minY: number,
  ) {
    super();
  }
  override getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    this.src.getPoint(t, target);
    target.y = Math.max(target.y, this.minY);
    return target;
  }
}

/** Cable along a smooth path through points [x,y,z] (cm), radius r, resting on y = 0 at the lowest. */
export function cable(parent: THREE.Object3D, points: Array<[number, number, number]>, r: number, mat: THREE.Material = MAT.blackPlastic): THREE.Mesh {
  const curve = new FloorClampedCurve(
    new THREE.CatmullRomCurve3(
      points.map((q) => new THREE.Vector3(...q)),
      false,
      'centripetal',
    ),
    r,
  );
  const segs = Math.max(16, Math.round(curve.getLength() / 1.2));
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, r, 8, false), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// ---------------------------------------------------------------- displays

/**
 * LCD window with a coloured backlight (JSD check colours): a plane with its own material and a
 * 7-segment readout sized like kit.lcd(). Faces +Z, centred.
 */
export function backlitLcd(
  parent: THREE.Object3D,
  o: { w: number; h: number; digits: number; bg: THREE.Material; on: THREE.ColorRepresentation; off: THREE.ColorRepresentation },
  p: Place = {},
): SegmentDisplay {
  const g = group(parent, p);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h), o.bg);
  g.add(panel);
  const digitH = Math.min(o.h * 0.68, (o.w * 0.9) / (o.digits * 0.76));
  const d = new SegmentDisplay({ digits: o.digits, height: digitH, color: o.on, offColor: o.off });
  d.object.position.z = 0.04;
  g.add(d.object);
  return d;
}

/**
 * Double-faced retail display head on a pole (A-frame section: dBottom deep at the base, dTop at
 * the top, so both faces lean back a little towards the reader). Origin at the bottom centre.
 * Each face carries a dark bezel with one window per field (digits per field); `logo` adds the
 * badge at the left end of the front (operator) face, the customer face uses the full width.
 * Returns the displays of the front (+Z) and back (−Z) faces, in field order.
 */
export function retailHead(
  parent: THREE.Object3D,
  o: { w: number; h: number; dBottom: number; dTop: number; fields: number[]; kind: 'lcd' | 'vfd'; logo?: boolean; body?: THREE.Material },
  p: Place = {},
): { front: SegmentDisplay[]; back: SegmentDisplay[] } {
  const g = group(parent, p);
  const { w, h, dBottom: db, dTop: dt } = o;
  profileSolid(
    g,
    [
      [-db / 2, 0],
      [db / 2, 0],
      [dt / 2, h],
      [-dt / 2, h],
    ],
    w,
    o.body ?? MAT.abs,
    { bevel: 0.6, radius: [0.4, 0.4, 1.2, 1.2] },
  );
  const slope = Math.atan2(h, (db - dt) / 2) / D2R;
  const slant = Math.hypot(h, (db - dt) / 2);
  const out = { front: [] as SegmentDisplay[], back: [] as SegmentDisplay[] };
  const bezelW = w - 2.2;
  const bezelH = slant - 2.0;
  for (const side of ['front', 'back'] as const) {
    const s = group(g, { ry: side === 'front' ? 0 : 180 });
    const f = faceFrame(s, 0, h / 2 + 0.1, (db + dt) / 4, slope);
    box(f, bezelW, bezelH, 0.08, o.kind === 'vfd' ? MAT.blackPlastic : MAT.absDark, { z: 0.04 });
    const withLogo = !!o.logo && side === 'front';
    const logoW = withLogo ? Math.min(4.2, bezelH * 0.9) : 0;
    if (withLogo) logoBadge(f, logoW * 0.78, 'industriale', { x: -bezelW / 2 + 0.3 + logoW / 2, y: 0.45, z: 0.1 });
    const gap = 0.6;
    const avail = bezelW - 0.7 - (withLogo ? logoW + 0.3 : 0) - gap * (o.fields.length - 1);
    const unit = avail / o.fields.reduce((a, b) => a + b, 0);
    let x = -bezelW / 2 + 0.35 + (withLogo ? logoW + 0.3 : 0);
    const winH = bezelH - 1.0;
    for (const digits of o.fields) {
      const ww = unit * digits;
      const win = lcd(f, { w: ww, h: winH, digits, kind: o.kind }, { x: x + ww / 2, y: 0, z: 0.1 });
      out[side].push(win.display);
      x += ww + gap;
    }
  }
  return out;
}
