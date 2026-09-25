import * as THREE from 'three';
import type { SubRoom } from './context';
import { BUILDING, FACADE_GLASS, OPENINGS, WALL, ZONES, type ZoneId } from './layout';

/**
 * Portal culling between the rooms of the building.
 *
 * three.js only culls against the view frustum, so without this the lobby, the plaza and every
 * wing behind a wall would be drawn from anywhere. The plan is a star: the outside (plaza) sees
 * the lobby through the glass front, and each wing opens onto the lobby through one doorway.
 * Nothing else connects rooms (wing facades are opaque, walls reach the ceilings). Zones add
 * rooms behind lower partitions with `ctx.addSubRoom()` (the industriale warehouse): low content
 * there is seen only through the partition's opening, taller content stays in the zone.
 *
 * Everything in the scene is sorted into rooms once, by its world bounds: a unit whose bounds
 * fit inside one room belongs to it; a unit spanning rooms is split into its children, and a
 * single mesh spanning rooms (walls, shared batches) is always drawn. Each frame a unit in
 * another room is drawn only if its bounding box reaches into the wedge the camera sees through
 * the chain of doorways leading to that room (one or two portals).
 *
 * Hidden meshes move to layer 1, which the camera does not render. This leaves `.visible` to the
 * zones (their own finer room checks keep working) and never touches the static shadow map: the
 * culler stands down on any frame that redraws it, so every mesh casts its shadow.
 */

/** 'outside', a zone id, or a sub-room id. */
type Room = string;

interface Portal {
  rooms: [Room, Room];
  corners: THREE.Vector3[];
  centre: THREE.Vector3;
  /** Standing in the doorway (inside this x/z box) puts the camera in both rooms. */
  near: { minX: number; maxX: number; minZ: number; maxZ: number };
}

interface Unit {
  room: Room;
  box: THREE.Box3;
  meshes: THREE.Object3D[];
  shown: boolean;
}

const HIDDEN_LAYER = 1;
const DOORWAY_DEPTH = 0.7; // metres either side of a portal plane that count as "in the doorway"
const TOL = 0.06; // bounds may poke this far past a room edge (decals on a wall face, trims)
// Added round dynamic units for their moving parts: a little sideways, more upwards (the
// stadiometer rods rise ~0.4 m above their parked height).
const MOVING_MARGIN = new THREE.Vector3(0.15, 0.05, 0.15);
const MOVING_RISE = 0.4;

const ROOM_RECT: Record<ZoneId, { minX: number; maxX: number; minZ: number; maxZ: number }> = {
  entrance: grow(ZONES.entrance.inner, WALL / 2),
  medicale: grow(ZONES.medicale.inner, WALL / 2),
  industriale: grow(ZONES.industriale.inner, WALL / 2),
  design: grow(ZONES.design.inner, WALL / 2),
};

function grow(r: { minX: number; maxX: number; minZ: number; maxZ: number }, d: number) {
  return { minX: r.minX - d, maxX: r.maxX + d, minZ: r.minZ - d, maxZ: r.maxZ + d };
}

function quad(axis: 'x' | 'z', at: number, from: number, to: number, top: number) {
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const corners =
    axis === 'z'
      ? [V(from, 0, at), V(to, 0, at), V(to, top, at), V(from, top, at)]
      : [V(at, 0, from), V(at, 0, to), V(at, top, to), V(at, top, from)];
  const centre = corners.reduce((a, c) => a.add(c), new THREE.Vector3()).multiplyScalar(0.25);
  const near =
    axis === 'z'
      ? { minX: from, maxX: to, minZ: at - DOORWAY_DEPTH, maxZ: at + DOORWAY_DEPTH }
      : { minX: at - DOORWAY_DEPTH, maxX: at + DOORWAY_DEPTH, minZ: from, maxZ: to };
  return { corners, centre, near };
}

function buildPortals(subRooms: SubRoom[]): Portal[] {
  const out: Portal[] = [];
  for (const o of OPENINGS) {
    if (o.id === 'front') {
      // The whole glass front, not just the sliding door.
      out.push({ rooms: ['outside', 'entrance'], ...quad('z', o.z, FACADE_GLASS.x0, FACADE_GLASS.x1, FACADE_GLASS.top) });
      continue;
    }
    const wing = (['medicale', 'industriale', 'design'] as const).find((z) => o.id === 'to-' + z);
    if (!wing) continue;
    const c = o.axis === 'z' ? o.x : o.z;
    // Quad on the wall's centre plane (a thick wall only hides more, so this stays conservative).
    out.push({ rooms: ['entrance', wing], ...quad(o.axis, o.axis === 'z' ? o.z : o.x, c - o.width / 2, c + o.width / 2, o.top) });
  }
  for (const r of subRooms) out.push({ rooms: [r.parent, r.id], ...quad(r.portal.axis, r.portal.at, r.portal.from, r.portal.to, r.portal.top) });
  return out;
}

/** Portal index chains between every pair of rooms (the rooms form a tree: paths are unique). */
function buildPaths(portals: Portal[], rooms: Room[]): Map<string, number[]> {
  const paths = new Map<string, number[]>();
  for (const from of rooms) {
    const seen = new Map<Room, number[]>([[from, []]]);
    const queue: Room[] = [from];
    while (queue.length) {
      const r = queue.shift()!;
      portals.forEach((p, i) => {
        const other = p.rooms[0] === r ? p.rooms[1] : p.rooms[1] === r ? p.rooms[0] : null;
        if (other === null || seen.has(other)) return;
        seen.set(other, [...seen.get(r)!, i]);
        queue.push(other);
      });
    }
    for (const [to, chain] of seen) paths.set(from + '>' + to, chain);
  }
  return paths;
}

/** The room a box lies in, or null when it spans rooms. */
function roomOfBox(b: THREE.Box3, subRooms: SubRoom[]): Room | null {
  if (b.min.z >= BUILDING.maxZ - TOL) return 'outside';
  for (const r of subRooms) {
    const q = r.rect;
    if (b.max.y <= r.maxY && b.min.x >= q.minX - TOL && b.max.x <= q.maxX + TOL && b.min.z >= q.minZ - TOL && b.max.z <= q.maxZ + TOL) return r.id;
  }
  for (const id of Object.keys(ROOM_RECT) as ZoneId[]) {
    const r = ROOM_RECT[id];
    if (b.min.x >= r.minX - TOL && b.max.x <= r.maxX + TOL && b.min.z >= r.minZ - TOL && b.max.z <= r.maxZ + TOL) return id;
  }
  return null;
}

/** Rooms the camera is in: its zone, plus a sub-room it stands in (the zone's tall content
 * shows over the partition, so the camera counts as being in both). */
function roomsAt(x: number, z: number, subRooms: SubRoom[]): Room[] {
  if (x < BUILDING.minX || x > BUILDING.maxX || z < BUILDING.minZ || z > BUILDING.maxZ) return ['outside'];
  let zone: Room = 'entrance';
  for (const id of Object.keys(ROOM_RECT) as ZoneId[]) {
    const r = ROOM_RECT[id];
    if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) {
      zone = id;
      break;
    }
  }
  const out = [zone];
  for (const r of subRooms) if (x >= r.rect.minX && x <= r.rect.maxX && z >= r.rect.minZ && z <= r.rect.maxZ) out.push(r.id);
  return out;
}

/** False only when the whole box lies behind the plane (test its corner furthest along the normal). */
function boxInFront(pl: THREE.Plane, b: THREE.Box3): boolean {
  const n = pl.normal;
  const x = n.x >= 0 ? b.max.x : b.min.x;
  const y = n.y >= 0 ? b.max.y : b.min.y;
  const z = n.z >= 0 ? b.max.z : b.min.z;
  return n.x * x + n.y * y + n.z * z + pl.constant >= 0;
}

export class PortalCuller {
  private readonly units: Unit[] = [];
  private readonly portals: Portal[];
  private readonly rooms: Room[];
  private readonly paths: Map<string, number[]>;
  private readonly cam = new THREE.Vector3();
  private readonly lastCam = new THREE.Vector3(Infinity, 0, 0);
  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  /** Scratch planes: [portal index] → 4 inward planes (normal, constant) for the current camera. */
  private readonly planes: THREE.Plane[][];
  private suspended = true;
  /** Counters for debugging and stats. */
  hidden = 0;

  /** `dynamic` holds moving content (scales, doors, logos); `statics` the merged batches. */
  constructor(
    roots: [dynamic: THREE.Object3D, statics: THREE.Object3D],
    private readonly subRooms: SubRoom[] = [],
  ) {
    this.portals = buildPortals(subRooms);
    this.rooms = ['outside', ...(Object.keys(ROOM_RECT) as ZoneId[]), ...subRooms.map((r) => r.id)];
    this.paths = buildPaths(this.portals, this.rooms);
    this.planes = this.portals.map(() => [0, 1, 2, 3].map(() => new THREE.Plane()));
    const box = new THREE.Box3();
    const classify = (o: THREE.Object3D, moving: boolean) => {
      o.updateWorldMatrix(true, true);
      box.makeEmpty().expandByObject(o);
      if (box.isEmpty()) return;
      const room = roomOfBox(box, subRooms);
      if (room) {
        // Every object of the unit, groups too: links test their logo group's layers.
        const objects: THREE.Object3D[] = [];
        o.traverse((c) => objects.push(c));
        // Dynamic content moves a little (stadiometer rods, swinging loads, doors, labels):
        // test a slightly larger box so nothing pops at the edge of a doorway's view.
        const b = box.clone();
        if (moving) {
          b.expandByVector(MOVING_MARGIN);
          b.max.y += MOVING_RISE;
        }
        this.units.push({ room, box: b, meshes: objects, shown: true });
        return;
      }
      for (const c of o.children) classify(c, moving);
    };
    roots.forEach((r, i) => {
      for (const c of r.children) classify(c, i === 0);
    });
  }

  /**
   * Call once per frame before rendering. `redrawingShadows`: the static shadow map is drawn this
   * frame, so everything must be on the camera's layer (the shadow pass tests the camera's layers).
   */
  update(camera: THREE.Camera, redrawingShadows: boolean): void {
    if (redrawingShadows) {
      this.showAll();
      this.suspended = true;
      return;
    }
    camera.getWorldPosition(this.cam);
    if (!this.suspended && this.cam.distanceToSquared(this.lastCam) < 1e-6) return;
    this.suspended = false;
    this.lastCam.copy(this.cam);

    // Which rooms the camera is in (more than one when standing in a doorway).
    const here = new Set<Room>(roomsAt(this.cam.x, this.cam.z, this.subRooms));
    this.portals.forEach((p) => {
      const n = p.near;
      if (this.cam.x >= n.minX && this.cam.x <= n.maxX && this.cam.z >= n.minZ && this.cam.z <= n.maxZ) {
        here.add(p.rooms[0]);
        here.add(p.rooms[1]);
      }
    });
    this.portals.forEach((p, i) => this.wedge(p, this.planes[i]));

    // Portal chains from the camera's rooms to every other room.
    const chains = new Map<Room, number[][]>();
    for (const target of this.rooms) {
      if (here.has(target)) continue;
      const list: number[][] = [];
      for (const from of here) {
        const chain = this.paths.get(from + '>' + target);
        if (chain) list.push(chain);
      }
      chains.set(target, list);
    }

    let hidden = 0;
    for (const u of this.units) {
      let show = true;
      if (!here.has(u.room)) {
        const list = chains.get(u.room) ?? [];
        show = list.some((chain) => chain.every((pi) => this.planes[pi].every((pl) => boxInFront(pl, u.box))));
      }
      if (!show) hidden++;
      if (show !== u.shown) this.setShown(u, show);
    }
    this.hidden = hidden;
  }

  /** The four planes through the camera and the portal's edges, normals pointing into the wedge. */
  private wedge(p: Portal, out: THREE.Plane[]): void {
    for (let i = 0; i < 4; i++) {
      const a = this.tmpA.copy(p.corners[i]).sub(this.cam);
      const b = this.tmpB.copy(p.corners[(i + 1) % 4]).sub(this.cam);
      const n = a.cross(b);
      if (n.lengthSq() < 1e-10) {
        // Camera on an edge's line: no constraint from this edge.
        out[i].set(new THREE.Vector3(0, 1, 0), Infinity);
        continue;
      }
      n.normalize();
      out[i].setFromNormalAndCoplanarPoint(n, this.cam);
      if (out[i].distanceToPoint(p.centre) < 0) out[i].negate();
    }
  }

  private setShown(u: Unit, show: boolean): void {
    u.shown = show;
    for (const m of u.meshes) {
      if (show) {
        m.layers.enable(0);
        m.layers.disable(HIDDEN_LAYER);
      } else {
        m.layers.disable(0);
        m.layers.enable(HIDDEN_LAYER);
      }
    }
  }

  private showAll(): void {
    for (const u of this.units) if (!u.shown) this.setShown(u, true);
    this.lastCam.set(Infinity, 0, 0);
  }
}
