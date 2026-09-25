import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { logoBadge, MAT, tray, type Place } from '../kit';

/**
 * Helpers shared by the medicale table-top models (BABY02-1, SUPERBABY, BABY02-2, HT).
 * No default export: the catalogue ignores this file. All sizes in cm, front = +Z.
 */

const D2R = Math.PI / 180;

/** A positioned/rotated sub-group (rotation in degrees, Euler XYZ), added to parent. */
export function group(parent: THREE.Object3D, p: Place = {}): THREE.Group {
  const g = new THREE.Group();
  g.position.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
  g.rotation.set((p.rx ?? 0) * D2R, (p.ry ?? 0) * D2R, (p.rz ?? 0) * D2R);
  parent.add(g);
  return g;
}

/** Satin anodised aluminium (steelyard beams). */
export const SATIN = new THREE.MeshStandardMaterial({ color: '#d0d3d6', roughness: 0.32, metalness: 0.55 });

/** Dark print for graduations and index marks (unlit so it reads like ink). */
export const INK = new THREE.MeshBasicMaterial({ color: '#26282b' });

/** Moulded white ABS of the baby trays (bowl and rim; see babyTray, which keeps them from casting). */
export const TRAY_ABS = new THREE.MeshStandardMaterial({ color: '#eeeeea', roughness: 0.55 });

/** Soft light-grey ABS for the white trays' underside shadows / parting lines. */
export const SEAM = new THREE.MeshStandardMaterial({ color: '#9ea2a6', roughness: 0.6 });

function place<T extends THREE.Object3D>(o: T, p: Place, parent: THREE.Object3D | null): T {
  o.position.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
  o.rotation.set((p.rx ?? 0) * D2R, (p.ry ?? 0) * D2R, (p.rz ?? 0) * D2R);
  if ((o as unknown as THREE.Mesh).isMesh) {
    o.castShadow = p.castShadow ?? true;
    o.receiveShadow = true;
  }
  parent?.add(o);
  return o;
}

const geoCache = new Map<string, THREE.BufferGeometry>();
function cached<G extends THREE.BufferGeometry>(key: string, make: () => G): G {
  let g = geoCache.get(key) as G | undefined;
  if (!g) geoCache.set(key, (g = make()));
  return g;
}

function roundedRect(w: number, d: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x0 = -w / 2;
  const y0 = -d / 2;
  const rr = Math.max(0.01, Math.min(r, w / 2 - 0.01, d / 2 - 0.01));
  s.moveTo(x0 + rr, y0);
  s.lineTo(x0 + w - rr, y0);
  s.absarc(x0 + w - rr, y0 + rr, rr, -Math.PI / 2, 0, false);
  s.lineTo(x0 + w, y0 + d - rr);
  s.absarc(x0 + w - rr, y0 + d - rr, rr, 0, Math.PI / 2, false);
  s.lineTo(x0 + rr, y0 + d);
  s.absarc(x0 + rr, y0 + d - rr, rr, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + rr);
  s.absarc(x0 + rr, y0 + rr, rr, Math.PI, Math.PI * 1.5, false);
  return s;
}

/**
 * Plate with rounded corners in plan (radius rPlan) and a small edge bevel: w (X) × h (Y) × d (Z).
 * Origin at the BOTTOM centre (p.y = underside).
 */
export function slab(parent: THREE.Object3D | null, w: number, h: number, d: number, rPlan: number, bevel: number, mat: THREE.Material, p: Place = {}): THREE.Mesh {
  const b = Math.max(0.01, Math.min(bevel, h / 2 - 0.01, w / 4, d / 4));
  const g = cached(`slab${w}|${h}|${d}|${rPlan}|${b}`, () => {
    const shape = roundedRect(w - 2 * b, d - 2 * b, rPlan - b);
    const e = new THREE.ExtrudeGeometry(shape, { depth: h - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 6 });
    e.translate(0, 0, b);
    e.rotateX(-Math.PI / 2);
    return e;
  });
  return place(new THREE.Mesh(g, mat), p, parent);
}

/**
 * Prism: a side profile given as [z, y] points (cm, counter-clockwise seen from +X) extruded
 * across X, width w centred on x = 0. A small bevel softens every edge (the outline grows by it).
 */
export function prism(parent: THREE.Object3D | null, profile: Array<[number, number]>, w: number, mat: THREE.Material, p: Place = {}, bevel = 0.3): THREE.Mesh {
  const g = cached(`prism${JSON.stringify(profile)}|${w}|${bevel}`, () => {
    const s = new THREE.Shape(profile.map(([z, y]) => new THREE.Vector2(z, y)));
    const depth = Math.max(0.01, w - 2 * bevel);
    const e = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 8 });
    e.translate(0, 0, -depth / 2);
    e.rotateY(-Math.PI / 2); // shape X → world Z, extrusion → world X
    return e;
  });
  return place(new THREE.Mesh(g, mat), p, parent);
}

/** Closed tube following a horizontal ellipse (half axes rx, rz): rolled tray rims, rings. */
export function ellipseTube(parent: THREE.Object3D | null, rx: number, rz: number, tube: number, mat: THREE.Material, p: Place = {}): THREE.Mesh {
  const g = cached(`etube${rx}|${rz}|${tube}`, () => {
    const pts: THREE.Vector3[] = [];
    const n = 64;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * rx, 0, Math.sin(a) * rz));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 128, tube, 8, true);
  });
  return place(new THREE.Mesh(g, mat), p, parent);
}

/** Round screw head (flat, facing +Z by default), stainless. */
export function screw(parent: THREE.Object3D, r: number, p: Place): THREE.Mesh {
  const g = cached(`screw${r}`, () => {
    const c = new THREE.CylinderGeometry(r * 0.8, r, r * 0.5, 12);
    c.rotateX(Math.PI / 2);
    return c;
  });
  const m = place(new THREE.Mesh(g, MAT.stainless), p, parent);
  m.castShadow = false;
  return m;
}

/**
 * Flat marks (graduations, index lines) as one InstancedMesh facing +Z: each mark is
 * [x, y, w, h] in the parent's frame at depth z.
 */
export function marks(parent: THREE.Object3D, list: Array<[number, number, number, number]>, z: number, mat: THREE.Material = INK): THREE.InstancedMesh {
  const im = new THREE.InstancedMesh(cached('markplane', () => new THREE.PlaneGeometry(1, 1)), mat, list.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  list.forEach(([x, y, w, h], i) => im.setMatrixAt(i, m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(w, h, 1))));
  im.instanceMatrix.needsUpdate = true;
  im.castShadow = false;
  parent.add(im);
  return im;
}

/** Thin-walled ring / cup wall (lathe of a closed rectangle), axis Y, bottom at p.y. */
export function ringWall(parent: THREE.Object3D | null, rOuter: number, wall: number, h: number, mat: THREE.Material, p: Place = {}, segments = 40): THREE.Mesh {
  const g = cached(`ring${rOuter}|${wall}|${h}|${segments}`, () => {
    const ri = rOuter - wall;
    const prof = [
      new THREE.Vector2(ri, 0),
      new THREE.Vector2(rOuter, 0),
      new THREE.Vector2(rOuter, h),
      new THREE.Vector2(ri, h),
      new THREE.Vector2(ri, 0),
    ];
    return new THREE.LatheGeometry(prof, segments);
  });
  return place(new THREE.Mesh(g, mat), p, parent);
}

/**
 * Merge static meshes inside a moving (keep) assembly per material, in the assembly's own frame,
 * so a beam or a poise costs one draw per material. Logos, segment displays, instanced and
 * transparent meshes are left untouched.
 */
export function compact(g: THREE.Object3D): void {
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  const skip = (o: THREE.Object3D): boolean => {
    for (let q: THREE.Object3D | null = o; q && q !== g; q = q.parent) {
      if (q.userData.keep || q.userData.logo || q.userData.scaleLogo || q.name === 'segment-display') return true;
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
  for (const [mat, meshes] of byMat) {
    if (meshes.length < 2) continue;
    const merged = bakeMeshes(meshes, inv);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    for (const m of meshes) m.removeFromParent();
  }
}

/**
 * Merge a few meshes that share one (transparent) material into a single mesh in `parent`'s
 * frame — used for the fixed glass panes, which the world never merges on its own.
 */
export function mergeInto(parent: THREE.Object3D, meshes: THREE.Mesh[], mat: THREE.Material): THREE.Mesh {
  parent.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
  const merged = bakeMeshes(meshes, inv)!;
  for (const m of meshes) m.removeFromParent();
  const mesh = new THREE.Mesh(merged, mat);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

function bakeMeshes(meshes: THREE.Mesh[], inv: THREE.Matrix4): THREE.BufferGeometry | null {
  const local = new THREE.Matrix4();
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
    } else if (!(geo.index.array instanceof Uint32Array)) {
      geo.setIndex(new THREE.BufferAttribute(new Uint32Array(geo.index.array), 1));
    }
    geo.morphAttributes = {};
    m.updateMatrixWorld(true);
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
  for (const g of geos) g.dispose();
  return merged;
}

/**
 * Small logo on a VISORE head, right of its buttons (the face is the first child of the head
 * group; the badge follows the head's tilt).
 */
export function visoreBadge(head: { object: THREE.Group }, diameter = 3): void {
  const face = head.object.children[0];
  logoBadge(face, diameter, 'medicale', { x: 7.4, y: -5.3, z: 2.04 });
}

/**
 * A baby's demo weight in kg (2.8–4.9) with 3 decimals, like a 1 g / 2 g baby scale shows.
 */
export function babyWeight(): number {
  return Math.round((2.8 + Math.random() * 2.1) * 1000) / 1000;
}

function roundedRectAt(cx: number, cy: number, w: number, h: number, r: number): THREE.Shape {
  const s = roundedRect(w, h, r);
  const pts = s.getPoints(4).map((v) => new THREE.Vector2(v.x + cx, v.y + cy));
  return new THREE.Shape(pts);
}

/**
 * Flat plate w (X) × h (Y) × t (Z) with rounded corners and a rounded rectangular window
 * (hole.w × hole.h, centred at hole.x/hole.y), facing ±Z, centred at the origin: bezels,
 * indicator housings, window frames.
 */
export function framePlate(
  parent: THREE.Object3D | null,
  w: number,
  h: number,
  t: number,
  r: number,
  hole: { w: number; h: number; x?: number; y?: number; r?: number },
  mat: THREE.Material,
  p: Place = {},
): THREE.Mesh {
  const g = cached(`frame${w}|${h}|${t}|${r}|${JSON.stringify(hole)}`, () => {
    const b = Math.min(0.12, t / 3);
    const s = roundedRectAt(0, 0, w - 2 * b, h - 2 * b, r);
    s.holes.push(roundedRectAt(hole.x ?? 0, hole.y ?? 0, hole.w + 2 * b, hole.h + 2 * b, hole.r ?? 0.2));
    const e = new THREE.ExtrudeGeometry(s, { depth: t - 2 * b, bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: 1, curveSegments: 4 });
    e.translate(0, 0, -(t - 2 * b) / 2);
    return e;
  });
  return place(new THREE.Mesh(g, mat), p, parent);
}

/** Bright polished stainless (analytical pans, chamber parts): stays light under the grey environment. */
export const BRIGHT_STEEL = new THREE.MeshStandardMaterial({ color: '#e1e4e7', roughness: 0.2, metalness: 0.6 });

/**
 * Baby tray: kit.tray() (the double-sided bowl, in `mat`, not casting so the thin shell cannot
 * self-shadow) plus an outer skin `t` below it in MAT.abs that gives the moulding its wall
 * thickness from underneath and casts the tray's shadow, plus the rolled rim in `mat`. `mat` must
 * be used by nothing else that casts shadows (TRAY_ABS). Origin at the rim centre (p.y = rim).
 */
export function babyTray(parent: THREE.Object3D, rx: number, ry: number, rz: number, mat: THREE.Material, p: Place = {}, rimTube = 0.55, t = 0.9): THREE.Mesh {
  const inner = tray(parent, rx, ry, rz, mat, p);
  inner.castShadow = false;
  const g = cached('trayskin', () => new THREE.SphereGeometry(1, 48, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2));
  const skin = place(new THREE.Mesh(g, MAT.abs), p, parent);
  skin.scale.set(rx + t, ry + t, rz + t);
  // The thin rim would alias into a dashed shadow on the bowl: it does not cast (the skin does).
  ellipseTube(parent, rx + t / 2, rz + t / 2, rimTube, mat, p).castShadow = false;
  return inner;
}
