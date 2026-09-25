import * as THREE from 'three';
import type { Collider } from '../core/collision';
import type { WorldContext } from './context';

/**
 * Automatic sliding glass doors: two panels that part when the visitor comes near.
 * The doorway collider is disabled while the doors are open.
 */
export function slidingDoors(ctx: WorldContext, o: { x: number; z: number; width: number; height: number }, getVisitor: () => { x: number; z: number }): void {
  const g = new THREE.Group();
  g.position.set(o.x, 0, o.z);
  const panelW = o.width / 2 + 0.05;
  const glass = ctx.mats.glass;
  const frame = ctx.mats.metalDark;
  const panels: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const p = new THREE.Group();
    const pane = new THREE.Mesh(new THREE.BoxGeometry(panelW, o.height, 0.02), glass);
    pane.position.y = o.height / 2;
    p.add(pane);
    for (const [w, h, x, y] of [
      [panelW, 0.06, 0, 0.03],
      [panelW, 0.06, 0, o.height - 0.03],
      [0.05, o.height, side * (panelW / 2 - 0.025), o.height / 2],
      [0.05, o.height, -side * (panelW / 2 - 0.025), o.height / 2],
    ] as const) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), frame);
      m.position.set(x, y, 0);
      p.add(m);
    }
    // A thin dark manifestation line at eye height so the glass reads as a door.
    const band = new THREE.Mesh(new THREE.BoxGeometry(panelW - 0.1, 0.03, 0.025), ctx.mats.dark);
    band.position.y = 1.45;
    p.add(band);
    p.userData.closedX = side * (panelW / 2 - 0.02);
    p.userData.side = side;
    p.position.x = p.userData.closedX as number;
    panels.push(p);
    g.add(p);
  }
  // Header box above the doors (track housing).
  const header = new THREE.Mesh(new THREE.BoxGeometry(o.width + 1.2, 0.22, 0.24), frame);
  header.position.y = o.height + 0.11;
  g.add(header);
  ctx.addDynamic(g);

  const collider: Collider = ctx.addCollider({ minX: o.x - o.width / 2, maxX: o.x + o.width / 2, minZ: o.z - 0.12, maxZ: o.z + 0.12 }, 'door');
  let open = 0;
  ctx.onUpdate((dt) => {
    const v = getVisitor();
    const near = Math.hypot(v.x - o.x, v.z - o.z) < 3.4;
    open = THREE.MathUtils.clamp(open + (near ? dt * 1.6 : -dt * 1.1), 0, 1);
    const e = open * open * (3 - 2 * open);
    for (const p of panels) p.position.x = (p.userData.closedX as number) + (p.userData.side as number) * e * (panelW - 0.1);
    collider.enabled = e < 0.75;
  });
}
