import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { box, cyl, dial, logoBadge, MAT, rectCm, tarsieTexture, visitorWeight, withEnvGain } from '../kit';
import type { LocalRect, ScaleInstance } from '../types';

/**
 * Shared parts of the DESIGN line (two bodies, five finishes): finish materials, bevelled
 * slabs, the lathe-turned dial head with its sprung needle, platform inserts and the final
 * measure-and-centre step. No default export: the catalogue ignores this file.
 *
 * Units are cm, front = +Z, y = 0 on the floor (see kit.ts).
 */

export type BodyFinish = 'bianca' | 'chrome' | 'gold';
export type PlatformKind = 'mat' | 'glass' | 'tarsie';

const D2R = Math.PI / 180;

// ---------------------------------------------------------------- materials (created once)

function std(color: THREE.ColorRepresentation, roughness: number, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

/**
 * Polished chrome: a touch sharper than MAT.chrome, these are the gallery's mirror pieces. A
 * mirror shows only its reflections: its own environment gain (the scene's is 0.55, see
 * kit.withEnvGain) keeps it bright polished chrome instead of dark gunmetal.
 */
const CHROME = withEnvGain(std('#f0f0f0', 0.07, 1), 1.9);
/** Gold plating: the only warm object in the building. */
const GOLD = std('#dcb466', 0.18, 1);
/** White epoxy powder coat on die-cast aluminium: satin base with a thin glossy clear layer. */
const BIANCA = new THREE.MeshPhysicalMaterial({ color: '#f2f2f0', roughness: 0.5, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.22 });

export interface Finish {
  /** Body castings: base shell, frame, neck/column, dial housing. */
  body: THREE.Material;
  /** Polished trim: bezel, sockets, screws. */
  trim: THREE.Material;
}

export function finishOf(f: BodyFinish): Finish {
  if (f === 'bianca') return { body: BIANCA, trim: CHROME };
  if (f === 'gold') return { body: GOLD, trim: GOLD };
  return { body: CHROME, trim: CHROME };
}

/** Fine ribs of the non-slip rubber mat, as a bump map (varies along U only; mipmapped). */
function ribTexture(): THREE.DataTexture {
  const N = 16;
  const H = 4;
  const data = new Uint8Array(N * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < N; x++) {
      const t = Math.abs((x + 0.5) / N - 0.5) * 2; // 0 at the rib crest, 1 in the groove
      const h = 1 - THREE.MathUtils.smoothstep(t, 0.42, 0.78);
      const v = Math.round(30 + h * 210);
      const i = (y * N + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, N, H);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/** Black ribbed rubber mat. */
const RUBBER_MAT = std('#1b1c1d', 0.8, 0, { bumpMap: ribTexture(), bumpScale: 1.2 });

/**
 * Clear tempered glass without a transmission pass: the faces only ADD their reflections
 * (black dielectric + clearcoat, additive blending), so the plate stays clear and still shows
 * Fresnel highlights; the polished edges carry the green tint of real float glass.
 */
const GLASS_FACE = new THREE.MeshPhysicalMaterial({
  color: '#000000',
  roughness: 0.03,
  metalness: 0,
  clearcoat: 1,
  clearcoatRoughness: 0.02,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const GLASS_TINT = new THREE.MeshStandardMaterial({ color: '#d7ece8', roughness: 0.1, transparent: true, opacity: 0.1, depthWrite: false });
const GLASS_EDGE = new THREE.MeshPhysicalMaterial({
  color: '#7fc3b2',
  roughness: 0.06,
  metalness: 0,
  clearcoat: 1,
  clearcoatRoughness: 0.03,
  transparent: true,
  opacity: 0.62,
  depthWrite: false,
});

/** Tarsie: hand-laid terracotta tesserae, waxed satin top; raw terracotta on the cut edges. */
const TARSIE_TOP = std('#fbece0', 0.5, 0, { map: tarsieTexture() });
const TARSIE_SIDE = std('#a9573f', 0.75);

/** Satin-brushed bed under the glass plate (darker than the mirror body so the glass reads). */
const SATIN_BED = std('#878b90', 0.36, 1);

/** Printed rings on the dial face. */
const INK = new THREE.MeshBasicMaterial({ color: '#1b1b1b' });

// ---------------------------------------------------------------- geometry helpers

const geoCache = new Map<string, THREE.BufferGeometry>();
function cached<G extends THREE.BufferGeometry>(key: string, make: () => G): G {
  let g = geoCache.get(key) as G | undefined;
  if (!g) geoCache.set(key, (g = make()));
  return g;
}

/** Rounded rectangle, counter-clockwise, centred on (cx, cy). */
function rrect(path: THREE.Path, cx: number, cy: number, w: number, h: number, r: number): void {
  const hw = w / 2;
  const hh = h / 2;
  const rr = Math.max(0.02, Math.min(r, hw - 0.01, hh - 0.01));
  path.moveTo(cx - hw + rr, cy - hh);
  path.lineTo(cx + hw - rr, cy - hh);
  path.absarc(cx + hw - rr, cy - hh + rr, rr, -Math.PI / 2, 0, false);
  path.lineTo(cx + hw, cy + hh - rr);
  path.absarc(cx + hw - rr, cy + hh - rr, rr, 0, Math.PI / 2, false);
  path.lineTo(cx - hw + rr, cy + hh);
  path.absarc(cx - hw + rr, cy + hh - rr, rr, Math.PI / 2, Math.PI, false);
  path.lineTo(cx - hw, cy - hh + rr);
  path.absarc(cx - hw + rr, cy - hh + rr, rr, Math.PI, Math.PI * 1.5, false);
}

/**
 * Smooth the normals of an extrusion (its bevels are tangent-continuous, so one smoothing
 * group is right), keep its material groups (caps = 0, sides = 1) and give it planar XZ UVs
 * (u = x / span, v = -z / span).
 */
function smooth(src: THREE.BufferGeometry, uvSpan = 1, v0 = 0.5, zc = 0): THREE.BufferGeometry {
  const groups = src.groups.map((g) => ({ ...g }));
  src.deleteAttribute('normal');
  src.deleteAttribute('uv');
  const g = mergeVertices(src, 1e-3);
  src.dispose();
  g.computeVertexNormals();
  for (const gr of groups) g.addGroup(gr.start, gr.count, gr.materialIndex ?? 0);
  const p = g.getAttribute('position');
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = p.getX(i) / uvSpan + 0.5;
    uv[i * 2 + 1] = (zc - p.getZ(i)) / uvSpan + v0;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

export interface SlabOptions {
  /** Outer size (cm): width X, depth Z, height Y. The slab sits on y = 0. */
  w: number;
  d: number;
  h: number;
  /** Plan corner radius and edge bevel (rounded, both top and bottom edges). */
  r: number;
  bevel: number;
  /** Centre of the slab in Z. */
  z?: number;
  /** Plan scale at the bottom (die-cast draft): 1 = straight walls. */
  taper?: number;
  /** Rounded-rectangle opening (frames). */
  hole?: { w: number; d: number; r: number; z: number };
  /** UV span in cm (planar XZ: u = x / uv + 0.5, v = (z0 - z) / uv + v0). */
  uv?: number;
  /** V at the slab's centre line (default 0.5). */
  v0?: number;
}

/** Bevelled rounded-rectangle slab, optionally with an opening, as a smooth indexed geometry. */
export function slabGeo(o: SlabOptions): THREE.BufferGeometry {
  return cached('slab' + JSON.stringify(o), () => {
    const b = o.bevel;
    const zc = o.z ?? 0;
    const shape = new THREE.Shape();
    rrect(shape, 0, -zc, o.w - 2 * b, o.d - 2 * b, o.r - b);
    if (o.hole) {
      const p = new THREE.Path();
      rrect(p, 0, -o.hole.z, o.hole.w + 2 * b, o.hole.d + 2 * b, o.hole.r + b);
      shape.holes.push(p);
    }
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(0.01, o.h - 2 * b),
      bevelEnabled: b > 0,
      bevelThickness: b,
      bevelSize: b,
      bevelSegments: 4,
      curveSegments: 10,
    });
    g.translate(0, 0, b);
    g.rotateX(-Math.PI / 2); // extrusion → +Y, shape y → -Z
    if (o.taper && o.taper !== 1) {
      const p = g.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const s = o.taper + (1 - o.taper) * THREE.MathUtils.clamp(p.getY(i) / o.h, 0, 1);
        p.setX(i, p.getX(i) * s);
        p.setZ(i, zc + (p.getZ(i) - zc) * s);
      }
    }
    return smooth(g, o.uv ?? 1, o.v0 ?? 0.5, zc);
  });
}

/**
 * Side-profile extrusion across X (necks, cradles): `profile` is a closed polygon of [z, y]
 * points (cm); the part is `wBottom` wide at `yBottom`, narrowing linearly to `wTop` at `yTop`.
 * The bevel rounds every edge and grows the outline by `bevel`.
 */
export function profileGeo(key: string, profile: Array<[number, number]>, wBottom: number, wTop: number, yBottom: number, yTop: number, bevel: number, fillet = 1.2): THREE.BufferGeometry {
  return cached('prof' + key, () => {
    // Filleted outline: every profile corner is rounded, so one smoothing group is right.
    const pts = profile.map(([z, y]) => new THREE.Vector2(-z, y));
    const shape = new THREE.Shape();
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const cur = pts[i];
      const prev = pts[(i + n - 1) % n];
      const next = pts[(i + 1) % n];
      const rr = Math.min(fillet, cur.distanceTo(prev) / 2, cur.distanceTo(next) / 2);
      const a = cur.clone().add(prev.clone().sub(cur).normalize().multiplyScalar(rr));
      const b = cur.clone().add(next.clone().sub(cur).normalize().multiplyScalar(rr));
      if (i === 0) shape.moveTo(a.x, a.y);
      else shape.lineTo(a.x, a.y);
      shape.quadraticCurveTo(cur.x, cur.y, b.x, b.y);
    }
    shape.closePath();
    const depth = wBottom - 2 * bevel;
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 8 });
    g.translate(0, 0, -depth / 2);
    g.rotateY(Math.PI / 2); // extrusion → X, shape x (= -z) → -Z
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const t = THREE.MathUtils.clamp((p.getY(i) - yBottom) / (yTop - yBottom), 0, 1);
      p.setX(i, p.getX(i) * (1 + (wTop / wBottom - 1) * t));
    }
    return smooth(g);
  });
}

/** Lathe around the part's own Z axis: profile of [radius, axial] points, axial toward +Z. */
export function latheZ(key: string, profile: Array<[number, number]>, segments = 96): THREE.BufferGeometry {
  return cached('lathe' + key, () => {
    const g = new THREE.LatheGeometry(
      profile.map(([r, a]) => new THREE.Vector2(r, a)),
      segments,
    );
    g.rotateX(Math.PI / 2); // lathe Y → +Z
    return g;
  });
}

/** Lathe around Y (collars, sockets): profile of [radius, y] points. */
export function latheY(key: string, profile: Array<[number, number]>, segments = 64): THREE.BufferGeometry {
  return cached('latheY' + key, () => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments));
}

export interface PartPlace {
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  cast?: boolean;
}

export function part(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], p: PartPlace = {}): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
  m.rotation.set((p.rx ?? 0) * D2R, (p.ry ?? 0) * D2R, (p.rz ?? 0) * D2R);
  m.castShadow = p.cast ?? true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Points on a concave (cove) curve from (r0, y0) to (r1, y1), for flared collars. */
export function cove(r0: number, y0: number, r1: number, y1: number, n = 10): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // quarter ellipse, concave outward: fast rise near the bottom, straightening into the tube
    const a = t * (Math.PI / 2);
    out.push([r1 + (r0 - r1) * (1 - Math.sin(a)), y0 + (y1 - y0) * (1 - Math.cos(a))]);
  }
  return out;
}

// ---------------------------------------------------------------- rubber foot

export function rubberFoot(parent: THREE.Object3D, x: number, z: number, d = 2, h = 0.5): void {
  part(parent, latheY(`foot${d}|${h}`, [[0, 0], [d / 2 - 0.15, 0], [d / 2, 0.12], [d / 2, h - 0.1], [d / 2 - 0.1, h], [0, h]], 20), MAT.rubber, { x, z, cast: false });
}

// ---------------------------------------------------------------- dial head

export interface DialHead {
  /** The tilted face frame: origin at the dial centre, +Z = face normal. */
  frame: THREE.Group;
  /** A point given in the face frame (v = up the face, a = along the normal, x = across) in the parent's cm space. */
  point(v: number, a: number, x?: number): THREE.Vector3;
  weigh(active: boolean): void;
  update(dt: number): void;
}

export interface DialHeadOptions {
  /** Dial centre in the parent (cm). */
  y: number;
  z: number;
  /** Face leaning back from vertical, degrees (45 on the 960, ~18 on the R150). */
  tilt: number;
  /** Housing depth behind the face plane (5.5 on the 960, 7 on the R150). */
  depth: number;
  finish: Finish;
  /** Zero-adjust knob at 12 o'clock. */
  knob?: boolean;
}

/**
 * The round mechanical dial of both bodies: lathe-turned housing with a rounded back and a
 * raised back cover, a polished stepped bezel, kit.dial()'s face, ticks, red needle and glass
 * dome, a printed border ring, a small logo under the hub and a zero-adjust knob. The needle
 * swings on a damped spring (small overshoot, then settles) to weight / 150 kg of full scale.
 */
export function dialHead(parent: THREE.Object3D, o: DialHeadOptions): DialHead {
  const frame = new THREE.Group();
  frame.position.set(0, o.y, o.z);
  frame.rotation.x = -o.tilt * D2R;
  parent.add(frame);
  const D = o.depth;
  const R = 10.1; // housing wall radius (the bezel overhangs it slightly)
  const rho = Math.min(2.3, D * 0.42); // rounded back edge

  // Housing: raised back cover → flat back → rounded edge → cylindrical wall up to the bezel.
  const shell: Array<[number, number]> = [
    [0, -D - 0.34],
    [4, -D - 0.33],
    [7.0, -D - 0.28],
    [7.25, -D - 0.12],
    [7.4, -D],
  ];
  for (let k = 0; k <= 8; k++) {
    const t = (k / 8) * (Math.PI / 2);
    shell.push([R - rho + rho * Math.sin(t), -D + rho * (1 - Math.cos(t))]);
  }
  shell.push([R, -1.05], [R - 0.06, -0.8]);
  part(frame, latheZ(`shell${D}`, shell), o.finish.body);

  // Bezel: polished ring with a rolled crown and an inner lip holding the glass.
  const bezel: Array<[number, number]> = [
    [R - 0.1, -1.1],
    [10.38, -0.95],
    [10.5, -0.5],
    [10.52, 0.15],
    [10.42, 0.7],
    [10.12, 1.06],
    [9.68, 1.26],
    [9.22, 1.22],
    [8.98, 0.98],
    [8.87, 0.58],
    [8.84, 0.12],
  ];
  part(frame, latheZ('bezel', bezel), o.finish.trim);

  // Face, ticks, needle and dome from the kit (its thin housing disc hides behind our shell).
  const d = dial(frame, { diameter: 20, depth: 0.5, housing: o.finish.trim, pointer: '#a8150d' });
  const torus = d.object.children.find((c) => (c as THREE.Mesh).geometry?.type === 'TorusGeometry');
  torus?.removeFromParent(); // replaced by the turned bezel above

  // Printed border ring just outside the ticks, and a thin inner ring.
  part(frame, cached('dialRingOuter', () => new THREE.RingGeometry(8.47, 8.56, 120)), INK, { z: 0.075, cast: false });
  part(frame, cached('dialRingInner', () => new THREE.RingGeometry(6.62, 6.68, 120)), INK, { z: 0.075, cast: false });

  // Small maker's badge under the hub (the needle sweeps above it).
  logoBadge(frame, 2.4, 'design', { y: -4.1, z: 0.1, castShadow: false });

  // Back cover screw (slotted).
  cyl(frame, 0.5, 0.56, 0.24, o.finish.trim, { z: -D - 0.34 - 0.1, rx: 90 }, 20);
  box(frame, 0.8, 0.13, 0.1, MAT.blackPlastic, { z: -D - 0.34 - 0.2, rz: 30, castShadow: false });

  if (o.knob !== false) {
    // Knurled zero-adjust knob on the top of the housing, pointing radially out.
    const kz = -D * 0.55;
    cyl(frame, 0.95, 0.95, 1.1, MAT.blackPlastic, { y: R + 0.5, z: kz }, 20);
    cyl(frame, 0.55, 0.7, 0.3, o.finish.trim, { y: R + 1.15, z: kz }, 16);
  }

  // Needle on a damped spring: ζ ≈ 0.6 → ~10 % overshoot, settles in ~1.3 s; rests on the zero stop.
  let v = 0;
  let vel = 0;
  let target = 0;
  const K = 26;
  const C = 6.1;

  frame.updateMatrix();
  const m = frame.matrix;
  return {
    frame,
    point: (vv, a, x = 0) => new THREE.Vector3(x, vv, a).applyMatrix4(m),
    weigh(active) {
      target = active ? Math.min(1, visitorWeight() / 150) : 0;
    },
    update(dt) {
      const h = Math.min(dt, 0.1);
      const n = Math.max(1, Math.ceil(h / 0.008));
      const s = h / n;
      for (let i = 0; i < n; i++) {
        vel += (K * (target - v) - C * vel) * s;
        v += vel * s;
        if (v < 0) {
          v = 0;
          vel = Math.abs(vel) * 0.2;
        }
      }
      d.setValue(v);
    },
  };
}

// ---------------------------------------------------------------- platforms

export interface PlatformOptions {
  kind: PlatformKind;
  finish: Finish;
  /** Top of the base shell (the platform sits on it). */
  y: number;
  /** Platform plan (cm): centre z, width, depth, corner radius. */
  z: number;
  w: number;
  d: number;
  r: number;
}

/** Builds the stepping surface on the shell; returns the height of its top (cm). */
export function platform(parent: THREE.Object3D, o: PlatformOptions): number {
  if (o.kind === 'mat') {
    // Ribbed rubber (ribs run front to back, 0.8 cm pitch).
    part(parent, slabGeo({ w: o.w, d: o.d, h: 1.2, r: o.r, bevel: 0.3, z: o.z, uv: 0.8 }), RUBBER_MAT, { y: o.y });
    return o.y + 1.2;
  }
  if (o.kind === 'tarsie') {
    // Terracotta slab, 1.8 thick, set 0.5 into the shell (the frame hides the joint).
    const t = 1.8;
    // The kit texture stacks its palette in bands of three rows (terracotta, ochre, cream,
    // slate, charcoal): map the slab onto the first four bands, terracotta at the toe end.
    const span = o.d / (12 / 16);
    part(parent, slabGeo({ w: o.w, d: o.d, h: t, r: o.r, bevel: 0.18, z: o.z, uv: span, v0: o.d / 2 / span }), [TARSIE_TOP, TARSIE_SIDE], { y: o.y - 0.5 });
    return o.y - 0.5 + t;
  }
  // Glass: a 1 cm tempered plate on four polished stand-offs, 0.35 above the shell, over a
  // satin-brushed bed (a mirror bed would swallow the glass).
  const gap = 0.35;
  part(parent, slabGeo({ w: o.w - 2.2, d: o.d - 2.2, h: 0.14, r: o.r - 1, bevel: 0.05, z: o.z }), SATIN_BED, { y: o.y - 0.04, cast: false });
  const hx = o.w / 2 - 2.6;
  const hz = o.d / 2 - 2.6;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(parent, 0.75, 0.75, gap - 0.03, o.finish.trim, { x: sx * hx, z: o.z + sz * hz, y: o.y, bottom: true }, 20);
  const geo = slabGeo({ w: o.w, d: o.d, h: 1.0, r: o.r, bevel: 0.22, z: o.z });
  part(parent, geo, [GLASS_FACE, GLASS_EDGE], { y: o.y + gap, cast: false });
  part(parent, geo, GLASS_TINT, { y: o.y + gap, cast: false });
  return o.y + gap + 1.0;
}

// ---------------------------------------------------------------- final step

export interface FinalizeOptions {
  /** Platform rectangle in cm (before centring) and its top height. */
  standOn: { x: number; z: number; w: number; d: number; y: number };
  colliders: Array<{ x: number; z: number; w: number; d: number }>;
  head: DialHead;
}

/**
 * Measures the finished model, moves it so the footprint is centred on the origin, and returns
 * the ScaleInstance with exact bounds (metres).
 */
export function finalize(root: THREE.Group, cm: THREE.Group, o: FinalizeOptions): ScaleInstance {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(cm, true);
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  cm.position.x -= cx;
  cm.position.z -= cz;
  const sx = cx * 100;
  const sz = cz * 100;
  const so = o.standOn;
  const shift = (r: { x: number; z: number; w: number; d: number }): LocalRect => rectCm(r.x - sx, r.z - sz, r.w, r.d);
  return {
    root,
    size: { w: box.max.x - box.min.x, d: box.max.z - box.min.z, h: box.max.y },
    standOn: { ...shift(so), y: so.y / 100 },
    colliders: o.colliders.map(shift),
    weigh: (active) => o.head.weigh(active),
    update: (dt) => o.head.update(dt),
  };
}
