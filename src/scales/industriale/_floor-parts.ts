import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { box, checkerPlateTexture, cyl, keep, logoBadge, MAT, rbox, tubePath, wxHead, type Place } from '../kit';
import type { Division } from '../../brand/urls';
import type { SegmentDisplay } from '../segments';

/**
 * Helpers shared by the industriale FLOOR models (WP4 1212, WP4-U, TPX-C, WX+WPA, CX).
 * No default export: the catalogue ignores this file. All sizes in cm, Y up, front = +Z.
 */

const D2R = Math.PI / 180;

/** A positioned/rotated sub-group (rotation in degrees), added to parent. */
export function group(parent: THREE.Object3D, p: Place = {}): THREE.Group {
  const g = new THREE.Group();
  g.position.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
  g.rotation.set((p.rx ?? 0) * D2R, (p.ry ?? 0) * D2R, (p.rz ?? 0) * D2R);
  parent.add(g);
  return g;
}

// ---------------------------------------------------------------- materials (module-level, shared)

/** Dark grey epoxy powder coat of the platforms (WP4, WP4-U). */
export const EPOXY = new THREE.MeshStandardMaterial({ color: '#4a4a4b', roughness: 0.55, metalness: 0.15 });
/** Oven-painted mid-grey steel (pallet truck, gantry). */
export const PAINT_MID = new THREE.MeshStandardMaterial({ color: '#77797c', roughness: 0.5, metalness: 0.25 });
/** Darker grey steel for the gantry. */
export const PAINT_GANTRY = new THREE.MeshStandardMaterial({ color: '#5a5d61', roughness: 0.55, metalness: 0.2 });
/** Polyurethane wheels / rollers (dark grey). */
export const PU_WHEEL = new THREE.MeshStandardMaterial({ color: '#2b2b2b', roughness: 0.75 });
/** Zinc-plated bolts, pins and hubs. */
export const ZINC = new THREE.MeshStandardMaterial({ color: '#a4a7aa', roughness: 0.38, metalness: 0.85 });
/** Grey-toned pallet wood. */
export const PALLET_WOOD = new THREE.MeshStandardMaterial({ color: '#8f8d88', roughness: 0.92 });
export const PALLET_BLOCK = new THREE.MeshStandardMaterial({ color: '#7b7975', roughness: 0.95 });
/** Corrugated cartons in two grey tones and their packing tape. */
export const CARTON_A = new THREE.MeshStandardMaterial({ color: '#a19f9a', roughness: 0.9 });
export const CARTON_B = new THREE.MeshStandardMaterial({ color: '#93918c', roughness: 0.9 });
export const TAPE = new THREE.MeshStandardMaterial({ color: '#5f5e5b', roughness: 0.45 });
/** Hot-rolled steel coil. */
export const COIL_STEEL = new THREE.MeshStandardMaterial({ color: '#7c8085', roughness: 0.4, metalness: 0.6 });
/** Die-cast aluminium housing (CX), matt light grey. */
export const CAST_ALU = new THREE.MeshStandardMaterial({ color: '#b9bcbf', roughness: 0.55, metalness: 0.55 });
/** Black cable jacket. */
export const CABLE = new THREE.MeshStandardMaterial({ color: '#202123', roughness: 0.6 });

/**
 * A clone of `base` with the diamond checker-plate texture as bump map. Extruded slabs have
 * UVs in cm, so `repeat` = 1 / tile size in cm (one texture tile holds 2×2 diamonds).
 * Call ONCE per model file (module level) and share the result.
 */
export function checkerMaterial(base: THREE.MeshStandardMaterial, repeat: number, bumpScale = 1.6): THREE.MeshStandardMaterial {
  const m = base.clone();
  const t = checkerPlateTexture().clone();
  t.repeat.set(repeat, repeat);
  t.needsUpdate = true;
  m.bumpMap = t;
  m.bumpScale = bumpScale;
  return m;
}

// ---------------------------------------------------------------- shapes

/** Rounded rectangle outline, centred, w (X) × d (Y of the outline), corner radius r. */
export function roundedRect(w: number, d: number, r: number, seg = 5): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const hw = w / 2;
  const hd = d / 2;
  r = Math.min(r, hw - 0.01, hd - 0.01);
  const corners: Array<[number, number, number]> = [
    [hw - r, hd - r, 0],
    [-hw + r, hd - r, 90],
    [-hw + r, -hd + r, 180],
    [hw - r, -hd + r, 270],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = (a0 + (i / seg) * 90) * D2R;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  }
  return pts;
}

/**
 * Round every corner of a closed polygon (plan coordinates) with a quadratic fillet of radius r
 * (convex and concave corners alike). `r` may be a number or one radius per vertex.
 */
export function filletPoly(pts: Array<[number, number]>, r: number | number[], seg = 4): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [px, pz] = pts[i];
    const [ax, az] = pts[(i + n - 1) % n];
    const [bx, bz] = pts[(i + 1) % n];
    const la = Math.hypot(ax - px, az - pz);
    const lb = Math.hypot(bx - px, bz - pz);
    const rr = Math.min(Array.isArray(r) ? r[i] : r, la * 0.45, lb * 0.45);
    const s: [number, number] = [px + ((ax - px) / la) * rr, pz + ((az - pz) / la) * rr];
    const e: [number, number] = [px + ((bx - px) / lb) * rr, pz + ((bz - pz) / lb) * rr];
    for (let k = 0; k <= seg; k++) {
      const t = k / seg;
      const u = 1 - t;
      out.push([u * u * s[0] + 2 * u * t * px + t * t * e[0], u * u * s[1] + 2 * u * t * pz + t * t * e[1]]);
    }
  }
  return out;
}

/**
 * A flat horizontal slab from an outline given in plan (x, z) — the outline's second coordinate
 * is world Z. `y0` = bottom, `h` = thickness. Top/bottom UVs are in cm (for checker repeats).
 * bevel rounds the top and bottom edges (added outside the outline, so pass an outline shrunk
 * by the bevel if the exact size matters).
 */
export function slab(parent: THREE.Object3D, outline: Array<[number, number]>, y0: number, h: number, mat: THREE.Material, bevel = 0, holes: Array<Array<[number, number]>> = []): THREE.Mesh {
  // Shape in XY with Y = -z so that after rx=-90 (Y→-Z... see below) it lands on +z correctly.
  const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const hole of holes) shape.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, -z))));
  const depth = Math.max(0.01, h - bevel * 2);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 6 });
  // Extrusion runs along +Z from 0..depth (bevel adds ±bevel). Rotate so +Z → +Y.
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0 + bevel, 0);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Hex nut/bolt head (6-sided cylinder), axis Y unless rotated. */
export function hex(parent: THREE.Object3D, d: number, h: number, mat: THREE.Material, p: Place = {}): THREE.Mesh {
  return cyl(parent, d / 2, d / 2, h, mat, p, 6);
}

/**
 * Adjustable levelling foot of an industrial platform: rubber pad, steel dome base, threaded
 * stud and lock nut. Origin at the floor; `h` = distance floor → underside of the frame.
 */
export function levelFoot(parent: THREE.Object3D, x: number, z: number, h: number, d = 6): void {
  cyl(parent, d / 2 + 0.2, d / 2 + 0.3, 0.8, MAT.rubber, { x, z, y: 0, bottom: true }, 20);
  cyl(parent, d / 2 - 0.9, d / 2, 1.3, MAT.stainless, { x, z, y: 0.8, bottom: true }, 20);
  cyl(parent, d * 0.14, d * 0.14, h - 2.1, MAT.stainless, { x, z, y: 2.1, bottom: true }, 10);
  hex(parent, d * 0.5, 0.9, ZINC, { x, z, y: h - 2.2, bottom: true });
}

/** A floor cable (Ø0.6) along a polyline of [x,y,z] points. */
export function cable(parent: THREE.Object3D, pts: Array<[number, number, number]>, r = 0.3): THREE.Mesh {
  return tubePath(parent, pts, r, CABLE, { cornerRadius: 4, radialSegments: 8 });
}

/** Cable gland (PG nut) facing along the given axis rotation. */
export function gland(parent: THREE.Object3D, p: Place): void {
  const g = group(parent, p);
  hex(g, 1.8, 0.6, MAT.blackPlastic, { y: 0.3 });
  cyl(g, 0.7, 0.55, 1.1, MAT.blackPlastic, { y: 1.1 }, 12);
}

/**
 * Stainless junction box (summing box) 10 × 6 × 4 cm with a screwed lid and a gland at the
 * bottom. Origin = centre of the box; the lid faces +Z (rotate with ry).
 */
export function junctionBox(parent: THREE.Object3D, p: Place): THREE.Group {
  const g = group(parent, p);
  rbox(g, 10, 6, 3.4, 0.5, MAT.brushed, { z: -0.3 });
  rbox(g, 9.6, 5.6, 0.6, 0.25, MAT.stainless, { z: 1.4 });
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ])
    cyl(g, 0.3, 0.3, 0.2, ZINC, { x: sx * 4.2, y: sy * 2.2, z: 1.75, rx: 90 }, 8);
  gland(g, { y: -3, rx: 180 });
  return g;
}

/** Plain stainless data plate (no text) with 4 rivets, facing +Z, centred. */
export function dataPlate(parent: THREE.Object3D, w: number, h: number, p: Place): void {
  const g = group(parent, p);
  box(g, w, h, 0.12, MAT.brushed, { z: 0.06 });
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ])
    cyl(g, 0.22, 0.22, 0.12, ZINC, { x: sx * (w / 2 - 0.5), y: sy * (h / 2 - 0.5), z: 0.15, rx: 90 }, 8);
}

// ---------------------------------------------------------------- WX indicator on a column

export interface WxStandOptions {
  x: number;
  z: number;
  /** y of the column foot (floor = 0, or the top of a bracket). */
  y0: number;
  /** Column length (tube), cm. */
  column: number;
  /** Tube radius, cm. */
  r?: number;
  /** Head tilt in degrees. */
  tilt?: number;
  /** Floor-standing: add a round base plate of this diameter. */
  basePlate?: number;
  /** Put a flat logo badge (this diameter, cm) on the base plate in front of the column. */
  baseLogo?: { d: number; division: Division };
}

/**
 * The WX indicator head held in a stainless stirrup on top of a stainless column, facing +Z.
 * Returns the display and the head centre height.
 */
export function wxStand(parent: THREE.Object3D, o: WxStandOptions): { display: SegmentDisplay; headY: number; face: THREE.Object3D } {
  const r = o.r ?? 2;
  const g = group(parent, { x: o.x, z: o.z });
  let y = o.y0;
  if (o.basePlate) {
    const R = o.basePlate / 2;
    // Heavy round base: chamfered steel disc on 3 rubber pads, a flange collar for the tube.
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
      cyl(g, 1.6, 1.8, 0.5, MAT.rubber, { x: Math.cos(a) * (R - 3), z: Math.sin(a) * (R - 3), y, bottom: true }, 12);
    }
    y += 0.5;
    cyl(g, R - 0.8, R, 1.5, MAT.brushed, { y, bottom: true }, 40);
    y += 1.5;
    cyl(g, r + 2.6, r + 3, 1.2, MAT.stainless, { y, bottom: true }, 24);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      hex(g, 1.1, 0.5, ZINC, { x: Math.cos(a) * (r + 1.9), z: Math.sin(a) * (r + 1.9), y: y + 1.2, bottom: true });
    }
    y += 1.2;
    if (o.baseLogo) logoBadge(g, o.baseLogo.d, o.baseLogo.division, { y: o.y0 + 2.03, z: r + 4 + o.baseLogo.d / 2, rx: -90 });
  }
  // Tube.
  cyl(g, r, r, o.column, MAT.stainless, { y, bottom: true }, 20);
  y += o.column;
  // Column head: a short clamp block the stirrup is bolted to.
  cyl(g, r + 0.5, r + 0.5, 3, MAT.brushed, { y: y - 3, bottom: true }, 20);
  box(g, 6, 1, 5, MAT.brushed, { y, bottom: true });
  y += 1;
  // Stirrup: bottom bar + two cheeks up to the head's pivot, knobs outside.
  const headY = y + 11;
  const cheekH = headY - y + 2;
  box(g, 30.2, 0.6, 3, MAT.stainless, { y, bottom: true });
  for (const s of [-1, 1]) {
    box(g, 0.6, cheekH, 3, MAT.stainless, { x: s * 14.45, y, bottom: true });
    cyl(g, 1.7, 1.7, 1.4, MAT.blackPlastic, { x: s * 15.45, y: headY, rz: 90 }, 10);
    cyl(g, 0.9, 0.9, 0.4, MAT.blackPlastic, { x: s * 16.3, y: headY, rz: 90 }, 10);
  }
  const head = wxHead(g, { y: headY, tilt: o.tilt ?? 16 });
  // A short cable loop from the column head into the back of the indicator.
  cable(g, [
    [3, y - 2, -1],
    [5, y - 1, -5],
    [5, headY - 6, -6],
    [4, headY - 4, -3.5],
  ]);
  return { display: head.display, headY, face: head.object.children[0] };
}

// ---------------------------------------------------------------- merging moving assemblies

/**
 * Merge the static meshes inside a moving (keep) assembly per material, in the assembly's own
 * frame, so a swinging load costs one draw per material instead of one per part. Logos, segment
 * displays, instanced and transparent meshes are left untouched. Marks the group keep().
 */
export function compactKeep<T extends THREE.Object3D>(g: T): T {
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  const skip = (o: THREE.Object3D): boolean => {
    for (let p: THREE.Object3D | null = o; p && p !== g; p = p.parent) {
      if (p.userData.keep || p.userData.logo || p.userData.scaleLogo || p.name === 'segment-display') return true;
    }
    return false;
  };
  const byMat = new Map<THREE.Material, THREE.Mesh[]>();
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as unknown as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material) || skip(m)) return;
    const mat = m.material as THREE.Material;
    if (mat.transparent) return;
    let list = byMat.get(mat);
    if (!list) byMat.set(mat, (list = []));
    list.push(m);
  });
  const local = new THREE.Matrix4();
  for (const [mat, meshes] of byMat) {
    if (meshes.length < 2) continue;
    const geos = meshes.map((m) => {
      let geo = m.geometry.clone();
      for (const name of Object.keys(geo.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') geo.deleteAttribute(name);
      if (!geo.getAttribute('normal')) geo.computeVertexNormals();
      if (!geo.getAttribute('uv')) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.getAttribute('position').count * 2), 2));
      if (!geo.index) {
        const n = geo.getAttribute('position').count;
        const idx = new Uint32Array(n);
        for (let i = 0; i < n; i++) idx[i] = i;
        geo.setIndex(new THREE.BufferAttribute(idx, 1));
      } else if (!(geo.index.array instanceof Uint32Array)) geo.setIndex(new THREE.BufferAttribute(new Uint32Array(geo.index.array), 1));
      geo.morphAttributes = {};
      local.multiplyMatrices(inv, m.matrixWorld);
      geo = geo.applyMatrix4(local);
      if (local.determinant() < 0) {
        const idx = geo.index!;
        for (let i = 0; i < idx.count; i += 3) {
          const a = idx.getX(i + 1);
          idx.setX(i + 1, idx.getX(i + 2));
          idx.setX(i + 2, a);
        }
      }
      return geo;
    });
    const merged = mergeGeometries(geos, false);
    for (const geo of geos) geo.dispose();
    if (!merged) continue;
    let cast = false;
    for (const m of meshes) {
      cast ||= m.castShadow;
      m.removeFromParent();
    }
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    g.add(mesh);
  }
  const empties: THREE.Object3D[] = [];
  g.traverse((o) => {
    if (o !== g && !(o as THREE.Mesh).isMesh && o.children.length === 0 && !o.userData.keep) empties.push(o);
  });
  for (const e of empties) e.removeFromParent();
  return keep(g);
}

export { logoBadge };
