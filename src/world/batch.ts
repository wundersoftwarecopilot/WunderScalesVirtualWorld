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
