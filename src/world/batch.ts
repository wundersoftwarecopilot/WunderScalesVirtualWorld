import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Collects static meshes and merges them per material into a handful of draw calls.
 * Only position/normal/uv are kept; meshes with other needs (skinning, morphs, instancing)
 * should not be added here.
 */
export class StaticBatcher {
  private readonly groups = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; cast: boolean; receive: boolean }>();
  added = 0;

  /** Add every Mesh under `obj` (world transforms baked in). `obj` must already be positioned. */
  add(obj: THREE.Object3D): void {
    obj.updateWorldMatrix(true, true);
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || (m as unknown as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material)) return;
      const src = m.geometry;
      if (!src.getAttribute('position')) return;
      let g = src.clone();
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      if (!g.getAttribute('uv')) {
        const n = g.getAttribute('position').count;
        g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
      }
      if (!g.index) {
        const n = g.getAttribute('position').count;
        const idx = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
        for (let i = 0; i < n; i++) idx[i] = i;
        g.setIndex(new THREE.BufferAttribute(idx, 1));
      }
      g.morphAttributes = {};
      g = g.applyMatrix4(m.matrixWorld);
      // A negative-determinant transform (mirroring) flips winding; fix it so faces stay outward.
      if (m.matrixWorld.determinant() < 0) {
        const idx = g.index!;
        for (let i = 0; i < idx.count; i += 3) {
          const a = idx.getX(i + 1);
          idx.setX(i + 1, idx.getX(i + 2));
          idx.setX(i + 2, a);
        }
      }
      const mat = m.material as THREE.Material;
      let entry = this.groups.get(mat);
      if (!entry) this.groups.set(mat, (entry = { geos: [], cast: false, receive: false }));
      entry.geos.push(g);
      entry.cast ||= m.castShadow;
      entry.receive ||= m.receiveShadow;
      this.added++;
    });
    obj.removeFromParent();
  }

  /** Merge everything into `target` and return the merged meshes. */
  bake(target: THREE.Object3D): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    for (const [mat, entry] of this.groups) {
      // Keep index widths consistent inside one merge.
      const geos = entry.geos.map((g) => {
        if (g.index && !(g.index.array instanceof Uint32Array)) g.setIndex(new THREE.BufferAttribute(new Uint32Array(g.index.array), 1));
        return g;
      });
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = entry.cast;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.name = 'static:' + (mat.name || mat.type);
      target.add(mesh);
      out.push(mesh);
      for (const g of geos) g.dispose();
    }
    this.groups.clear();
    return out;
  }
}

/**
 * Merge the static meshes of one model (a scale) per material, in the model's own frame.
 * Skips anything that must stay a separate object:
 * - subtrees marked userData.keep (moving parts: needles, sliders, poises, doors),
 * - logos (userData.logo / userData.scaleLogo: they are links with hover state),
 * - segment displays and other InstancedMeshes, transparent materials (sorting).
 * Materials are shared, so colour changes on a material (lamps) keep working after merging.
 * Call it before the model is positioned in the world.
 */
export function mergeModel(root: THREE.Object3D): { before: number; after: number } {
  root.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const skip = (o: THREE.Object3D): boolean => {
    for (let p: THREE.Object3D | null = o; p && p !== root; p = p.parent) {
      if (p.userData.keep || p.userData.logo || p.userData.scaleLogo || p.name === 'segment-display') return true;
    }
    return false;
  };
  const groups = new Map<THREE.Material, THREE.Mesh[]>();
  let before = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    before++;
    if ((m as unknown as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material) || skip(m)) return;
    const mat = m.material as THREE.Material;
    if (mat.transparent) return;
    let list = groups.get(mat);
    if (!list) groups.set(mat, (list = []));
    list.push(m);
  });
  let removed = 0;
  let added = 0;
  const local = new THREE.Matrix4();
  for (const [mat, meshes] of groups) {
    if (meshes.length < 2) continue;
    const geos: THREE.BufferGeometry[] = [];
    let cast = false;
    for (const m of meshes) {
      let g = m.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
      if (!g.index) {
        const n = g.getAttribute('position').count;
        const idx = new Uint32Array(n);
        for (let i = 0; i < n; i++) idx[i] = i;
        g.setIndex(new THREE.BufferAttribute(idx, 1));
      } else if (!(g.index.array instanceof Uint32Array)) g.setIndex(new THREE.BufferAttribute(new Uint32Array(g.index.array), 1));
      g.morphAttributes = {};
      local.multiplyMatrices(inv, m.matrixWorld);
      g = g.applyMatrix4(local);
      if (local.determinant() < 0) {
        const idx = g.index!;
        for (let i = 0; i < idx.count; i += 3) {
          const a = idx.getX(i + 1);
          idx.setX(i + 1, idx.getX(i + 2));
          idx.setX(i + 2, a);
        }
      }
      geos.push(g);
      cast ||= m.castShadow;
    }
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    for (const m of meshes) {
      m.removeFromParent();
      removed++;
    }
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    mesh.name = 'merged';
    root.add(mesh);
    added++;
  }
  // Empty groups left behind are harmless; drop them to keep the graph small.
  const empties: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (o !== root && !(o as THREE.Mesh).isMesh && o.children.length === 0 && !o.userData.keep) empties.push(o);
  });
  for (const e of empties) e.removeFromParent();
  return { before, after: before - removed + added };
}
