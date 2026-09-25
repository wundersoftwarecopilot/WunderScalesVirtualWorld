import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { logoBadge, MAT, type Place } from '../kit';

/**
 * Helpers shared by the medicale floor models (C202, DE20, RW2.0-SEDIA, PL-VEGA, WBA300).
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

/** Satin anodised aluminium (beams, telescopic rods): lighter than the fully metallic MAT.aluminium. */
export const SATIN = new THREE.MeshStandardMaterial({ color: '#d3d6d9', roughness: 0.34, metalness: 0.5 });

/** Bright polished stainless (BIA foot electrodes): stays light under the grey environment. */
export const BRIGHT_STEEL = new THREE.MeshStandardMaterial({ color: '#e4e7ea', roughness: 0.18, metalness: 0.62 });

/** Dark print for graduations and index marks (unlit so it reads like ink). */
export const INK = new THREE.MeshBasicMaterial({ color: '#26282b' });

/**
 * Merge the static meshes inside a moving (keep) assembly per material, in the assembly's own
 * frame, so a beam or a slider costs one draw per material instead of one per part. Nested keep
 * groups, logos, segment displays, instanced and transparent meshes are left untouched.
 */
export function compact(g: THREE.Object3D): void {
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
      } else if (!(geo.index.array instanceof Uint32Array)) {
        geo.setIndex(new THREE.BufferAttribute(new Uint32Array(geo.index.array), 1));
      }
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
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    for (const m of meshes) m.removeFromParent();
  }
}

const geoCache = new Map<string, THREE.BufferGeometry>();

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
 * Unlike rbox, the plan radius and the edge softening are independent (platforms, bases).
 * Origin at the bottom centre.
 */
export function slab(parent: THREE.Object3D | null, w: number, h: number, d: number, rPlan: number, bevel: number, mat: THREE.Material, p: Place = {}): THREE.Mesh {
  const b = Math.max(0.01, Math.min(bevel, h / 2 - 0.01, w / 4, d / 4));
  const key = `slab${w}|${h}|${d}|${rPlan}|${b}`;
  let g = geoCache.get(key);
  if (!g) {
    const shape = roundedRect(w - 2 * b, d - 2 * b, rPlan - b);
    const e = new THREE.ExtrudeGeometry(shape, { depth: h - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 6 });
    e.translate(0, 0, b);
    e.rotateX(-Math.PI / 2);
    geoCache.set(key, (g = e));
  }
  const m = new THREE.Mesh(g, mat);
  m.position.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
  m.rotation.set((p.rx ?? 0) * D2R, (p.ry ?? 0) * D2R, (p.rz ?? 0) * D2R);
  m.castShadow = p.castShadow ?? true;
  m.receiveShadow = true;
  parent?.add(m);
  return m;
}

/**
 * Upright panel w (X) × h (Y) × t (Z) with rounded corners and a stadium hand-grip slot
 * (slotW × slotH, centred slotY below the top edge). Origin at the bottom centre, faces ±Z.
 */
export function slottedPanel(parent: THREE.Object3D | null, w: number, h: number, t: number, r: number, slot: { w: number; h: number; fromTop: number }, mat: THREE.Material, p: Place = {}): THREE.Mesh {
  const key = `panel${w}|${h}|${t}|${r}|${slot.w}|${slot.h}|${slot.fromTop}`;
  let g = geoCache.get(key);
  if (!g) {
    const b = Math.min(0.6, t / 3);
    const shape = roundedRect(w - 2 * b, h - 2 * b, r - b);
    // Stadium slot; the bevel grows outward, so the cut is made that much larger.
    const hole = new THREE.Path();
    const hr = slot.h / 2 + b;
    const cy = (h - 2 * b) / 2 - slot.fromTop + b;
    const hw = slot.w / 2 + b;
    hole.moveTo(-hw + hr, cy - hr);
    hole.lineTo(hw - hr, cy - hr);
    hole.absarc(hw - hr, cy, hr, -Math.PI / 2, Math.PI / 2, false);
    hole.lineTo(-hw + hr, cy + hr);
    hole.absarc(-hw + hr, cy, hr, Math.PI / 2, Math.PI * 1.5, false);
    shape.holes.push(hole);
    const e = new THREE.ExtrudeGeometry(shape, { depth: t - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 8 });
    e.translate(0, h / 2, -(t - 2 * b) / 2);
    geoCache.set(key, (g = e));
  }
  const m = new THREE.Mesh(g, mat);
  m.position.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
  m.rotation.set((p.rx ?? 0) * D2R, (p.ry ?? 0) * D2R, (p.rz ?? 0) * D2R);
  m.castShadow = true;
  m.receiveShadow = true;
  parent?.add(m);
  return m;
}

/**
 * Small logo on a VISORE head, right of its buttons (the face is the first child of the head
 * group; the badge follows the head's tilt).
 */
export function visoreBadge(head: { object: THREE.Group }, diameter = 3): void {
  const face = head.object.children[0];
  logoBadge(face, diameter, 'medicale', { x: 7.4, y: -5.3, z: 2.04 });
}

/** Round screw head (flat, facing +Z by default), stainless. */
export function screw(parent: THREE.Object3D, r: number, p: Place): THREE.Mesh {
  const key = `screw${r}`;
  let g = geoCache.get(key);
  if (!g) {
    const c = new THREE.CylinderGeometry(r * 0.8, r, r * 0.5, 12);
    c.rotateX(Math.PI / 2);
    geoCache.set(key, (g = c));
  }
  const m = new THREE.Mesh(g, MAT.stainless);
  m.position.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
  m.rotation.set((p.rx ?? 0) * D2R, (p.ry ?? 0) * D2R, (p.rz ?? 0) * D2R);
  m.castShadow = false;
  parent.add(m);
  return m;
}
