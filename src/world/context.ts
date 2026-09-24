import * as THREE from 'three';
import { createLogo, setLogoHover, type LogoOptions } from '../brand/logo';
import { LABELS, URLS, type Division } from '../brand/urls';
import { CollisionWorld } from '../core/collision';
import type { LinkLayer } from '../core/links';
import type { Rect } from '../core/rect';
import { StaticBatcher } from './batch';
import { createMaterials, type Materials } from './materials';
import { createPainting, type PaintingOptions } from './painting';

export type Updater = (dt: number, t: number) => void;

/**
 * Everything the world builders share: scene graph, materials, static batching, collisions,
 * clickable links, occluders for link visibility, and per-frame updaters.
 */
export class WorldContext {
  readonly mats: Materials = createMaterials();
  readonly batcher = new StaticBatcher();
  readonly collisions = new CollisionWorld(2);
  readonly updaters: Updater[] = [];
  readonly occluders: THREE.Box3[] = [];
  /** Dynamic (non-batched) content lives here: logos, scales, doors, anything animated. */
  readonly dynamic = new THREE.Group();
  /** Merged static geometry ends up here after bake(). */
  readonly statics = new THREE.Group();

  constructor(
    readonly scene: THREE.Scene,
    readonly links: LinkLayer,
  ) {
    this.dynamic.name = 'dynamic';
    this.statics.name = 'statics';
    scene.add(this.dynamic, this.statics);
  }

  /** Static, non-interactive meshes: merged by material at the end (big draw-call savings). */
  addStatic(obj: THREE.Object3D): void {
    this.batcher.add(obj);
  }

  /** Something that moves or has its own material state: kept as-is in the scene. */
  addDynamic(obj: THREE.Object3D): void {
    this.dynamic.add(obj);
  }

  addCollider(r: Rect, tag?: string) {
    return this.collisions.add(r, tag);
  }

  /** Collider from an object's world-space bounding box (object must be positioned). */
  addSolid(obj: THREE.Object3D, pad = 0, tag?: string) {
    obj.updateWorldMatrix(true, true);
    const b = new THREE.Box3().setFromObject(obj);
    if (b.isEmpty()) return null;
    return this.collisions.add({ minX: b.min.x - pad, maxX: b.max.x + pad, minZ: b.min.z - pad, maxZ: b.max.z + pad }, tag);
  }

  /** Box that can hide a clickable logo behind it (walls, tall shelving). */
  addOccluder(b: THREE.Box3 | THREE.Object3D): void {
    if ((b as THREE.Box3).isBox3) this.occluders.push((b as THREE.Box3).clone());
    else {
      (b as THREE.Object3D).updateWorldMatrix(true, true);
      this.occluders.push(new THREE.Box3().setFromObject(b as THREE.Object3D));
    }
  }

  onUpdate(fn: Updater): void {
    this.updaters.push(fn);
  }

  /** Make an object clickable (it must already be positioned in the world). Hover lights up logos inside it. */
  link(obj: THREE.Object3D, url: string, label: string): void {
    this.links.register(obj, url, label, (on) => setLogoHover(obj, on));
  }

  /**
   * A clickable Wunder logo, added to the scene. Defaults: link to the division site (or the
   * corporate site), flat decal. Position/rotate the returned group via `at`.
   */
  logo(
    opts: LogoOptions & { url?: string; label?: string },
    at: { x: number; y: number; z: number; rotY?: number; rotX?: number },
  ): THREE.Group {
    const division: Division = opts.division ?? 'corporate';
    const g = createLogo(opts);
    g.position.set(at.x, at.y, at.z);
    g.rotation.set(at.rotX ?? 0, at.rotY ?? 0, 0, 'YXZ');
    this.addDynamic(g);
    this.link(g, opts.url ?? URLS[division], opts.label ?? LABELS[division]);
    return g;
  }

  /** A framed "painting" of the logo, hung and linked (see painting.ts for options). */
  painting(opts: PaintingOptions, at: { x: number; y: number; z: number; rotY?: number }): THREE.Group {
    const division: Division = opts.division ?? 'corporate';
    const g = createPainting(opts);
    g.position.set(at.x, at.y, at.z);
    g.rotation.y = at.rotY ?? 0;
    this.addDynamic(g);
    this.link(g, opts.url ?? URLS[division], opts.label ?? LABELS[division]);
    return g;
  }

  /** Instanced repeated props (shelves, boxes, chairs). Not batched; one draw call. */
  instanced(geometry: THREE.BufferGeometry, material: THREE.Material, matrices: THREE.Matrix4[], shadows = true): THREE.InstancedMesh {
    const im = new THREE.InstancedMesh(geometry, material, matrices.length);
    matrices.forEach((m, i) => im.setMatrixAt(i, m));
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = shadows;
    im.receiveShadow = true;
    im.computeBoundingSphere();
    this.addDynamic(im);
    return im;
  }

  bake(): void {
    this.batcher.bake(this.statics);
    this.links.occluders = this.occluders;
  }
}

/** Deterministic PRNG (mulberry32) so procedural dressing is the same on every visit. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
