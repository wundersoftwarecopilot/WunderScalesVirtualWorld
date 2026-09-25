import * as THREE from 'three';
import { localRectToWorld, worldToLocalXZ } from '../core/rect';
import { loadCatalog } from '../scales/catalog';
import type { Line, ScaleId, ScaleSpec } from '../scales/specs';
import type { ScaleInstance } from '../scales/types';
import { mergeModel } from './batch';
import { buildShell } from './building';
import type { WorldContext } from './context';
import { OPENINGS, ZONES, type ZoneId } from './layout';
import { createPedestal, pedestalSize } from './pedestal';
import type { Slot, ZoneModule } from './zone';
import entrance from './zones/entrance';
import medicale from './zones/medicale';
import industriale from './zones/industriale';
import design from './zones/design';

export const ZONE_MODULES: ZoneModule[] = [entrance, medicale, industriale, design];

const LINE_ZONE: Record<Line, ZoneId> = { medicale: 'medicale', industriale: 'industriale', design: 'design' };

/** A scale as placed in the world, with what the runtime needs to drive it. */
export interface PlacedScale {
  spec: ScaleSpec;
  instance: ScaleInstance;
  slot: Slot;
  /** World y of the scale's origin (pedestal top for table pieces). */
  baseY: number;
  active: boolean;
}

export interface Visitor {
  x: number;
  z: number;
  floorTarget: number;
}

/** Yields to the browser so the loading screen keeps animating between heavy steps. */
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export async function buildWorld(
  ctx: WorldContext,
  visitor: () => Visitor,
  progress: (p: number) => void,
): Promise<PlacedScale[]> {
  buildShell(ctx, visitor);
  progress(0.1);
  await nextFrame();

  const slots: Partial<Record<ScaleId, Slot>> = {};
  let step = 0;
  for (const mod of ZONE_MODULES) {
    const shell = ZONES[mod.id];
    const openings = OPENINGS.filter((o) => {
      const r = shell.inner;
      return o.clear.maxX > r.minX && o.clear.minX < r.maxX && o.clear.maxZ > r.minZ && o.clear.minZ < r.maxZ;
    });
    try {
      const out = mod.build({ ctx, shell, openings });
      Object.assign(slots, out.slots);
    } catch (err) {
      console.error(`[world] zone ${mod.id} failed to build`, err);
    }
    progress(0.1 + (++step / ZONE_MODULES.length) * 0.3);
    await nextFrame();
  }

  const placed: PlacedScale[] = [];
  const defs = loadCatalog();
  let n = 0;
  for (const def of defs) {
    const spec = def.spec;
    let instance: ScaleInstance;
    try {
      instance = def.build();
    } catch (err) {
      console.error(`[world] scale ${spec.id} failed to build`, err);
      n++;
      continue;
    }
    const slot = slots[spec.id] ?? fallbackSlot(spec, n);
    const root = instance.root;
    mergeModel(root);
    let baseY = 0;

    if (spec.placement === 'pedestal') {
      const { w, d, h } = pedestalSize(instance.size, spec.pedestalHeight);
      const ped = createPedestal({ w, d, h, division: spec.line });
      ped.group.position.set(slot.x, 0, slot.z);
      ped.group.rotation.y = slot.rotY;
      ctx.addDynamic(ped.group);
      ped.group.updateMatrixWorld(true);
      ctx.link(ped.logo, spec.url, `${spec.name} — scheda prodotto`);
      ctx.addCollider(localRectToWorld({ x: 0, z: 0, w, d }, slot.x, slot.z, slot.rotY), 'pedestal');
      baseY = h;
    }

    root.position.set(slot.x, baseY, slot.z);
    root.rotation.y = slot.rotY;
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.receiveShadow = true;
    });
    ctx.addDynamic(root);
    root.updateMatrixWorld(true);

    // Every logo badge on the model links to its product page.
    const logos: THREE.Object3D[] = [];
    root.traverse((o) => {
      if (o.userData.scaleLogo) logos.push(o);
    });
    for (const l of logos) ctx.link(l, spec.url, `${spec.name} — scheda prodotto`);

    if (spec.placement === 'floor') {
      const solids = instance.colliders ?? (instance.standOn ? [] : [{ x: 0, z: 0, w: instance.size.w, d: instance.size.d }]);
      for (const c of solids) ctx.addCollider(localRectToWorld(c, slot.x, slot.z, slot.rotY), 'scale');
    }

    placed.push({ spec, instance, slot, baseY, active: false });
    n++;
    if (n % 5 === 0) {
      progress(0.4 + (n / defs.length) * 0.5);
      await nextFrame();
    }
  }

  // Drive weighing: stepping onto a floor platform, or walking up to a table-top piece.
  ctx.onUpdate((dt, t) => {
    const v = visitor();
    let floorTarget = 0;
    for (const p of placed) {
      const dx = v.x - p.slot.x;
      const dz = v.z - p.slot.z;
      const dist = Math.hypot(dx, dz);
      let on = false;
      const so = p.instance.standOn;
      if (so && p.spec.placement === 'floor') {
        const l = worldToLocalXZ(v.x, v.z, p.slot.x, p.slot.z, p.slot.rotY);
        on = Math.abs(l.x - so.x) <= so.w / 2 && Math.abs(l.z - so.z) <= so.d / 2;
        if (on) floorTarget = Math.max(floorTarget, so.y);
      } else if (p.spec.placement === 'pedestal') {
        on = dist < Math.max(1.4, p.instance.size.w / 2 + 1.1);
      } else {
        on = dist < 1.5;
      }
      if (on !== p.active) {
        p.active = on;
        p.instance.weigh?.(on);
      }
      if (dist < 30) p.instance.update?.(dt, t);
    }
    v.floorTarget = floorTarget;
  });

  progress(0.95);
  return placed;
}

/** Keep unplaced pieces visible: a row just inside their zone, facing into the room. */
function fallbackSlot(spec: ScaleSpec, i: number): Slot {
  const r = ZONES[LINE_ZONE[spec.line]].inner;
  const cols = 5;
  return {
    x: r.minX + 2 + (i % cols) * ((r.maxX - r.minX - 4) / (cols - 1)),
    z: r.minZ + 2 + Math.floor((i % 10) / cols) * 3,
    rotY: 0,
  };
}
