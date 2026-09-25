import * as THREE from 'three';
import type { WorldContext } from '../context';
import type { ZoneModule, Slot } from '../zone';
import { SCALE_IDS, type ScaleId } from '../../scales/specs';
import {
  armchair,
  babyCot,
  beamSeating,
  bedHeadUnit,
  bedsideCabinet,
  box,
  bpWallUnit,
  changingTable,
  clock,
  coffeeTable,
  curtain,
  curtainTrack,
  desk,
  doorFrame,
  doorLeaf,
  examCouch,
  examLamp,
  frostedWindow,
  glassCabinet,
  handrail,
  instrumentTrolley,
  ivPole,
  kidsCorner,
  linearPendant,
  magazineRack,
  vendingMachine,
  workstationCart,
  labBench,
  labFridge,
  lightPool,
  linenTrolley,
  medCart,
  negatoscope,
  part,
  nurseCounter,
  officeChair,
  pedalBin,
  plant,
  rbox,
  sanitizer,
  sinkCabinet,
  stepStool,
  stool,
  visitorChair,
  wallTv,
  wallWash,
  waterCooler,
  wheelchair,
  PROP,
  propCluster,
  type SwatchKey,
} from './medicale-props';

/**
 * MEDICALE wing: a small clinic (x −33.85..−10.15, z −15.85..15.85, ceiling 3.6 m).
 *
 * Plan (X east, Z south). The visitor comes in from the lobby through the east wall (z 6..10):
 *
 *   z −15.85 ┌──────────────────┬─────┬─────────────┬───────────────┐
 *            │ WARD (corsia)    │  N  │  store      │               │
 *            │  closed bay      │  -  ├─────────────┤  (closed)     │
 *            │  PL-VEGA bay     │  S  │  NURSERY    │───────────────┤
 *            │  DE20  RW2.0     │     │  3 baby     │  staff        │
 *            │  wheelchair      │  c  │  pedestals  │               │
 *   z −1.95  ├──────────────────┤  o  ├─────────────┴───────────────┤ z −0.7
 *            │ WAITING ROOM     │  r  │ MEASUREMENT hub: C202  R2020  │
 *            │                  │ WBA │                   nurse desk  │
 *   z 5.65   ├────[opening]─────┘     └───────────────────────┬─────┤
 *            │ logo  ═══ MAIN CORRIDOR (grey band)  ═══             ← lobby
 *   z 10.3   ├──────┬──────┬────────────┬───────────┬──────────┤
 *            │ util │ util │ LAB (glazed)│ AMB 2    │ AMB 1     │
 *   z 15.85  └──────┴──────┴────────────┴───────────┴──────────┘
 *          x −33.85      −26.2       −20.05      −15.1       −10.15
 *
 * - Main corridor (4.5 m) from the doorway to the west wall, where the division logo hangs on a
 *   light plaque; dado protection panels, a grey wayfinding band and bumper rails.
 * - Measurement hub open to the corridor: R2020 and C202 against a grey panel on the north wall
 *   facing south, a nurse counter by the east wall. The WBA300 stands at the mouth of the N-S
 *   corridor facing east, in the sightline from the lobby doorway.
 * - Two consulting rooms (ambulatori), mirror images: couch with curtain track, desk, chairs,
 *   sink cabinet, light box, BP unit, exam lamp, frosted window.
 * - Ward off the N-S corridor: PL-VEGA in a curtained bay (3.4 × 3.9 m) with a bed-head unit,
 *   DE20 beside it, RW2.0-SEDIA with a free run-up in front of its ramp and a wheelchair.
 * - Nursery with a viewing window on the N-S corridor: bassinets behind the glass, the three
 *   baby scales on pedestals along the east wall, changing unit and sink.
 * - Small lab with a glazed front on the main corridor: bench, reagent shelves, HT on its pedestal.
 * Partition walls sit between the ceiling light panels (building.ts grid) so no panel crosses a wall.
 * All statics share one palette material (medicale-props.ts): one draw call for the whole wing.
 */

const T = 0.12; // partition thickness
const H = 3.6; // ceiling

// Wall centre lines.
const CN = 5.65; // main corridor, north wall
const CS = 10.3; // main corridor, south wall
const XW = -24.75; // N-S corridor, west wall (ward / waiting room)
const XE = -21.5; // N-S corridor, east wall (nursery / store)
const HN = -0.7; // measurement hub, north wall
const NN = -7.8; // nursery, north wall
const XS = -15.1; // nursery | staff, AMB 1 | AMB 2
const XA2 = -20.05; // AMB 2 | lab
const XL = -26.2; // lab | utility rooms
const ZW = -1.95; // ward | waiting room
const STUB = -12.5; // end of the corridor's north wall stub by the lobby doorway

// Stripe / dado heights.
const DADO = 1.1;
const STRIPE = 0.08;

interface Gap {
  a: number;
  b: number;
  top: number;
  /** Window: wall below `sill`, glass between sill and top. */
  sill?: number;
}

type V2 = [number, number];

function build(ctx: WorldContext, inner: { minX: number; maxX: number; minZ: number; maxZ: number }): Partial<Record<ScaleId, Slot>> {
  const S = new THREE.Group(); // static parts, world coordinates
  const X0 = inner.minX;
  const X1 = inner.maxX;
  const Z0 = inner.minZ;
  const Z1 = inner.maxZ;
  const glass = ctx.mats.glass;

  // ================================================================== helpers

  /** Put a prop in the world (static), optionally solid. */
  const place = (obj: THREE.Object3D, x: number, z: number, rotY = 0, solid = true, pad = -0.02, y = 0): THREE.Object3D => {
    obj.position.set(x, y, z);
    obj.rotation.y = rotY;
    S.add(obj);
    if (solid) ctx.addSolid(obj, pad);
    return obj;
  };

  /** Wall fitting on a face: `n` = outward normal of the face (which way the fitting looks). */
  const onFace = (obj: THREE.Object3D, n: 'N' | 'S' | 'E' | 'W', plane: number, along: number, y: number): THREE.Object3D => {
    const rot = { S: 0, N: Math.PI, E: Math.PI / 2, W: -Math.PI / 2 }[n];
    if (n === 'N' || n === 'S') obj.position.set(along, y, plane);
    else obj.position.set(plane, y, along);
    obj.rotation.y = rot;
    S.add(obj);
    return obj;
  };

  const occlude = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
    ctx.addOccluder(new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)));

  /** Collider + occluder for a solid stretch of wall along `axis` between a and b. */
  const solidPart = (axis: 'x' | 'z', at: number, a: number, b: number, y0: number, y1: number, solid: boolean) => {
    if (b - a <= 0.001 || y1 - y0 <= 0.001) return;
    if (axis === 'x') {
      occlude(a, y0, at - T / 2, b, y1, at + T / 2);
      if (solid) ctx.addCollider({ minX: a, maxX: b, minZ: at - T / 2, maxZ: at + T / 2 });
    } else {
      occlude(at - T / 2, y0, a, at + T / 2, y1, b);
      if (solid) ctx.addCollider({ minX: at - T / 2, maxX: at + T / 2, minZ: a, maxZ: b });
    }
  };

  /**
   * Partition wall with doorways / openings / windows, from `from` to `to` along `axis`. Built as
   * one extruded outline (doorways are notches, windows are holes) so each face is a single
   * watertight surface: no seams where lintels meet the wall, nothing lit leaking through.
   */
  const wall = (axis: 'x' | 'z', at: number, from: number, to: number, gaps: Gap[] = []) => {
    const sorted = [...gaps].sort((p, q) => p.a - q.a);
    const shape = new THREE.Shape();
    shape.moveTo(from, 0);
    for (const g of sorted) {
      if (g.sill !== undefined) continue;
      shape.lineTo(g.a, 0);
      shape.lineTo(g.a, g.top);
      shape.lineTo(g.b, g.top);
      shape.lineTo(g.b, 0);
    }
    shape.lineTo(to, 0);
    shape.lineTo(to, H);
    shape.lineTo(from, H);
    shape.closePath();
    for (const g of sorted) {
      if (g.sill === undefined) continue;
      const hole = new THREE.Path();
      hole.moveTo(g.a, g.sill);
      hole.lineTo(g.b, g.sill);
      hole.lineTo(g.b, g.top);
      hole.lineTo(g.a, g.top);
      hole.closePath();
      shape.holes.push(hole);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, curveSegments: 1 });
    geo.translate(0, 0, -T / 2);
    if (axis === 'x') part(S, geo, 'wall', 0, 0, at);
    else part(S, geo, 'wall', at, 0, 0, 0, -Math.PI / 2);
    // Collisions and logo occlusion per solid stretch.
    let cur = from;
    for (const g of sorted) {
      solidPart(axis, at, cur, g.a, 0, H, true);
      solidPart(axis, at, g.a, g.b, g.top, H, false);
      if (g.sill !== undefined) {
        solidPart(axis, at, g.a, g.b, 0, g.sill, false);
        windowIn(axis, at, g);
      }
      cur = g.b;
    }
    solidPart(axis, at, cur, to, 0, H, true);
  };

  /** Glazing in a wall gap: glass pane, white frames on both faces, sills. */
  const windowIn = (axis: 'x' | 'z', at: number, g: Gap) => {
    const sill = g.sill ?? 0;
    const len = g.b - g.a;
    const c = (g.a + g.b) / 2;
    const h = g.top - sill;
    const pane = new THREE.Mesh(axis === 'x' ? new THREE.BoxGeometry(len, h, 0.012) : new THREE.BoxGeometry(0.012, h, len), glass);
    if (axis === 'x') pane.position.set(c, sill + h / 2, at);
    else pane.position.set(at, sill + h / 2, c);
    S.add(pane);
    const fr = new THREE.Group();
    const f = 0.05;
    const d = T + 0.02;
    box(fr, 'white', len, f, d, 0, sill, 0);
    box(fr, 'white', len, f, d, 0, g.top - f, 0);
    box(fr, 'white', f, h, d, -len / 2 + f / 2, sill, 0);
    box(fr, 'white', f, h, d, len / 2 - f / 2, sill, 0);
    // Mullions every ~1.3 m.
    const n = Math.round(len / 1.3);
    for (let i = 1; i < n; i++) box(fr, 'white', 0.04, h, 0.05, -len / 2 + (i / n) * len, sill, 0);
    for (const s of [-1, 1]) box(fr, 'laminate', len + 0.06, 0.02, 0.07, 0, sill - 0.02, s * (T / 2 + 0.03));
    fr.position.set(axis === 'x' ? c : at, 0, axis === 'x' ? at : c);
    fr.rotation.y = axis === 'x' ? 0 : Math.PI / 2;
    S.add(fr);
    // Windows are not walkable.
    if (axis === 'x') ctx.addCollider({ minX: g.a, maxX: g.b, minZ: at - T / 2, maxZ: at + T / 2 });
    else ctx.addCollider({ minX: at - T / 2, maxX: at + T / 2, minZ: g.a, maxZ: g.b });
  };

  /** Door frame in a gap, with an open leaf (or two) swung into the side `swing` (±1 along the wall normal). */
  const door = (axis: 'x' | 'z', at: number, g: Gap, swing: 1 | -1, hinge: 'a' | 'b' | 'both', vision = true) => {
    const w = g.b - g.a;
    const c = (g.a + g.b) / 2;
    const fr = doorFrame(w, g.top, T);
    fr.position.set(axis === 'x' ? c : at, 0, axis === 'x' ? at : c);
    fr.rotation.y = axis === 'x' ? 0 : Math.PI / 2;
    S.add(fr);
    const leafW = hinge === 'both' ? w / 2 - 0.03 : w - 0.06;
    const hinges = hinge === 'both' ? (['a', 'b'] as const) : [hinge];
    for (const hg of hinges) {
      const leaf = doorLeaf(leafW, g.top - 0.03, glass, vision);
      const along = hg === 'a' ? g.a + 0.035 : g.b - 0.035;
      const off = at + swing * (T / 2 + 0.03);
      if (axis === 'x') {
        leaf.position.set(along, 0.01, off);
        leaf.rotation.y = swing > 0 ? -Math.PI / 2 : Math.PI / 2;
      } else {
        leaf.position.set(off, 0.01, along);
        leaf.rotation.y = swing > 0 ? 0 : Math.PI;
      }
      S.add(leaf);
      ctx.addSolid(leaf, 0.02);
    }
  };

  /** Closed door drawn on a wall face (the room behind is not modelled). */
  const closedDoor = (n: 'N' | 'S' | 'E' | 'W', plane: number, c: number, w = 1.0, h = 2.15) => {
    const g = new THREE.Group();
    const f = 0.05;
    box(g, 'grey', w + 2 * f, f, 0.014, 0, h, 0.007);
    for (const s of [-1, 1]) box(g, 'grey', f, h, 0.014, s * (w / 2 + f / 2), 0, 0.007);
    const leaf = doorLeaf(w, h - 0.01, glass, false);
    leaf.position.set(-w / 2, 0.005, 0.024);
    g.add(leaf);
    // Push plate and a small (letterless) sign panel.
    box(g, 'steel', 0.1, 0.3, 0.003, w / 2 - 0.12, 1.15, 0.048);
    rbox(g, 'light', 0.22, 0.22, 0.01, 0.01, 0, 1.55, 0.05);
    onFace(g, n, plane, c, 0);
  };

  /**
   * Finishes on one wall face: skirting always; optionally dado panels, the blue stripe and a
   * bumper rail. Face at `plane` (world coordinate), running along `axis` from `from` to `to`,
   * facing `n`. `doors` are skipped entirely; `windows` keep the skirting only.
   */
  const finish = (
    axis: 'x' | 'z',
    plane: number,
    n: 1 | -1,
    from: number,
    to: number,
    o: { doors?: V2[]; windows?: V2[]; dado?: boolean; stripe?: boolean; rail?: boolean; railFrom?: number; railTo?: number } = {},
  ) => {
    const cut = (ranges: V2[]): V2[] => {
      const out: V2[] = [];
      let cur = from;
      for (const [a, b] of [...ranges].sort((p, q) => p[0] - q[0])) {
        if (a > cur) out.push([cur, Math.min(a, to)]);
        cur = Math.max(cur, b);
      }
      if (cur < to) out.push([cur, to]);
      return out.filter(([a, b]) => b - a > 0.02);
    };
    const strip = (a: number, b: number, y0: number, h: number, depth: number, key: SwatchKey) => {
      const len = b - a;
      const c = (a + b) / 2;
      const off = plane + (n * depth) / 2;
      if (axis === 'x') box(S, key, len, h, depth, c, y0, off);
      else box(S, key, depth, h, len, off, y0, c);
    };
    const doors = o.doors ?? [];
    const windows = o.windows ?? [];
    for (const [a, b] of cut(doors)) strip(a, b, 0, 0.1, 0.014, 'skirting');
    const full = cut([...doors, ...windows]);
    for (const [a, b] of full) {
      if (o.dado) strip(a, b, 0.1, DADO - 0.1, 0.007, 'dado');
      if (o.stripe) strip(a, b, DADO, STRIPE, 0.011, 'band');
    }
    if (o.rail) {
      for (const [a0, b0] of full) {
        const a = Math.max(a0 + 0.12, o.railFrom ?? -Infinity);
        const b = Math.min(b0 - 0.12, o.railTo ?? Infinity);
        if (b - a < 0.6) continue;
        const c = (a + b) / 2;
        // handrail() mounts on a wall at local z = 0 facing +Z.
        if (axis === 'x') handrail(S, b - a, c, plane, n > 0 ? 0 : Math.PI);
        else handrail(S, b - a, plane, c, n > 0 ? Math.PI / 2 : -Math.PI / 2);
      }
    }
  };

  /** Stainless corner guard on an external corner (two thin angles). */
  const cornerGuard = (x: number, z: number, sx: 1 | -1, sz: 1 | -1) => {
    box(S, 'steel', 0.05, 1.6, 0.004, x + (sx * 0.05) / 2, 0.1, z + (sz * 0.004) / 2);
    box(S, 'steel', 0.004, 1.6, 0.05, x + (sx * 0.004) / 2, 0.1, z + (sz * 0.05) / 2);
  };

  /** Floor finish (sheet vinyl) for a room rectangle, just above the slab. */
  const floor = (x0: number, z0: number, x1: number, z1: number, key: SwatchKey) => {
    const m = box(S, key, x1 - x0, 0.006, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2);
    m.castShadow = false;
  };
  const floorLine = (x0: number, z0: number, x1: number, z1: number) => {
    const m = box(S, 'floorLine', x1 - x0, 0.002, z1 - z0, (x0 + x1) / 2, 0.006, (z0 + z1) / 2);
    m.castShadow = false;
  };

  // ================================================================== floors
  // Circulation in a darker vinyl, rooms lighter; a border line runs along the corridors.
  floor(X0, CN, X1, CS, 'floorCorr');
  floor(XE, HN, X1, CN, 'floorCorr');
  floor(XW, Z0, XE, CN, 'floorCorr');
  floor(X0, ZW, XW, CN, 'floorRoom'); // waiting
  floor(X0, Z0, XW, ZW, 'floorRoom'); // ward
  floor(XE, NN, XS, HN, 'floorRoom'); // nursery
  floor(XS, CS, X1, Z1, 'floorRoom'); // AMB 1
  floor(XA2, CS, XS, Z1, 'floorRoom'); // AMB 2
  floor(XL, CS, XA2, Z1, 'floorRoom'); // lab
  const bl = 0.03;
  const inset = 0.42;
  floorLine(X0, CS - T / 2 - inset - bl, X1 - 0.3, CS - T / 2 - inset);
  floorLine(X0, CN + T / 2 + inset, XW + T / 2 + inset + bl, CN + T / 2 + inset + bl);
  floorLine(STUB, CN + T / 2 + inset, X1 - 0.3, CN + T / 2 + inset + bl);
  floorLine(XW + T / 2 + inset, Z0 + 0.4, XW + T / 2 + inset + bl, CN + T / 2 + inset + bl);
  floorLine(XE - T / 2 - inset - bl, Z0 + 0.4, XE - T / 2 - inset, HN + T / 2 + inset);
  floorLine(XW + T / 2 + inset, Z0 + 0.4, XE - T / 2 - inset, Z0 + 0.4 + bl);

  // ================================================================== walls
  // Openings (along-wall coordinates).
  const gAmb1: Gap = { a: -14.85, b: -13.35, top: 2.2 };
  const gAmb2: Gap = { a: -16.85, b: -15.35, top: 2.2 };
  const gLabDoor: Gap = { a: -21.75, b: -20.25, top: 2.2 };
  const gLabWin: Gap = { a: -25.6, b: -22.0, top: 2.2, sill: 0.95 };
  const gWaiting: Gap = { a: -30.9, b: -27.5, top: 2.6 };
  const gWard: Gap = { a: -10.1, b: -7.7, top: 2.3 };
  const gNurseryDoor: Gap = { a: -2.75, b: -1.25, top: 2.2 };
  const gNurseryWin: Gap = { a: -6.9, b: -3.35, top: 2.15, sill: 0.9 };

  // Main corridor.
  wall('x', CS, X0 - 0.1, X1 + 0.1, [gAmb1, gAmb2, gLabDoor, gLabWin]);
  wall('x', CN, X0 - 0.1, XW + T / 2, [gWaiting]);
  wall('x', CN, STUB, X1 + 0.1);
  // N-S corridor.
  wall('z', XW, Z0 - 0.1, CN, [gWard]);
  wall('z', XE, Z0 - 0.1, HN + T / 2, [gNurseryWin, gNurseryDoor]);
  // Hub, nursery, staff and store.
  wall('x', HN, XE - T / 2, X1 + 0.1);
  wall('x', NN, XE + T / 2, X1 + 0.1);
  wall('z', XS, NN + T / 2, HN - T / 2);
  // Ward | waiting.
  wall('x', ZW, X0 - 0.1, XW - T / 2);
  // South row.
  wall('z', XS, CS + T / 2, Z1 + 0.1);
  wall('z', XA2, CS + T / 2, Z1 + 0.1);
  wall('z', XL, CS + T / 2, Z1 + 0.1);

  // Door frames and leaves (all open, swung into the rooms).
  door('x', CS, gAmb1, 1, 'a');
  door('x', CS, gAmb2, 1, 'b');
  door('x', CS, gLabDoor, 1, 'b');
  door('z', XW, gWard, -1, 'both');
  door('z', XE, gNurseryDoor, 1, 'b');
  // The waiting-room opening gets a cased frame without leaves.
  {
    const fr = doorFrame(gWaiting.b - gWaiting.a, gWaiting.top, T);
    fr.position.set((gWaiting.a + gWaiting.b) / 2, 0, CN);
    S.add(fr);
  }
  closedDoor('N', CS - T / 2, -27.75, 1.0);
  closedDoor('N', CS - T / 2, -31.85, 1.0);
  closedDoor('S', HN + T / 2, -11.05, 1.0);
  closedDoor('W', XE - T / 2, -11.8, 1.2);

  // ---------------------------------------------------------------- wall finishes
  const d = (g: Gap): V2 => [g.a, g.b];
  // Main corridor: dado, stripe, rails. Keep rails out of the lobby doorway's clear area.
  finish('x', CS - T / 2, -1, X0, X1, { doors: [d(gAmb1), d(gAmb2), d(gLabDoor)], windows: [d(gLabWin)], dado: true, stripe: true, rail: true, railTo: -12.7 });
  finish('x', CN + T / 2, 1, X0, XW + T / 2, { doors: [d(gWaiting)], dado: true, stripe: true, rail: true });
  finish('x', CN + T / 2, 1, STUB, X1, { dado: true, stripe: true });
  finish('z', X0, 1, CN + T / 2, CS - T / 2, { dado: true, stripe: true });
  // Hub.
  finish('x', CN - T / 2, -1, STUB, X1, { stripe: true, dado: true });
  finish('z', X1, -1, HN + T / 2, CN - T / 2, { stripe: true, dado: true });
  finish('x', HN + T / 2, 1, XE - T / 2, X1, { stripe: true, dado: true });
  // N-S corridor.
  finish('z', XE - T / 2, -1, Z0, HN + T / 2, { doors: [d(gNurseryDoor)], windows: [d(gNurseryWin)], dado: true, stripe: true, rail: true });
  finish('z', XW + T / 2, 1, Z0, CN + T / 2, { doors: [d(gWard)], dado: true, stripe: true, rail: true });
  finish('x', Z0, 1, XW + T / 2, XE - T / 2, { dado: true, stripe: true });
  // Waiting room.
  finish('x', CN - T / 2, -1, X0, XW - T / 2, { doors: [d(gWaiting)] });
  finish('z', XW - T / 2, -1, ZW + T / 2, CN - T / 2);
  finish('x', ZW + T / 2, 1, X0, XW - T / 2);
  finish('z', X0, 1, ZW + T / 2, CN - T / 2);
  // Ward.
  finish('x', ZW - T / 2, -1, X0, XW - T / 2);
  finish('z', XW - T / 2, -1, Z0, ZW - T / 2, { doors: [d(gWard)] });
  finish('x', Z0, 1, X0, XW - T / 2);
  finish('z', X0, 1, Z0, ZW - T / 2);
  // Nursery.
  finish('z', XE + T / 2, 1, NN + T / 2, HN - T / 2, { doors: [d(gNurseryDoor)], windows: [d(gNurseryWin)] });
  finish('x', HN - T / 2, -1, XE + T / 2, XS - T / 2);
  finish('z', XS - T / 2, -1, NN + T / 2, HN - T / 2);
  finish('x', NN + T / 2, 1, XE + T / 2, XS - T / 2);
  // AMB 1, AMB 2, lab.
  for (const [x0, x1, doors, windows] of [
    [XS + T / 2, X1, [d(gAmb1)], []],
    [XA2 + T / 2, XS - T / 2, [d(gAmb2)], []],
    [XL + T / 2, XA2 - T / 2, [d(gLabDoor)], [d(gLabWin)]],
  ] as Array<[number, number, V2[], V2[]]>) {
    finish('x', CS + T / 2, 1, x0, x1, { doors, windows });
    finish('x', Z1, -1, x0, x1);
    finish('z', x0, 1, CS + T / 2, Z1);
    finish('z', x1, -1, CS + T / 2, Z1);
  }
  // Corner guards on the external corners of the circulation.
  cornerGuard(STUB, CN + T / 2, -1, 1);
  cornerGuard(STUB, CN - T / 2, -1, -1);
  cornerGuard(XW + T / 2, CN + T / 2, 1, 1);
  cornerGuard(XE - T / 2, HN + T / 2, -1, 1);

  // ================================================================== main corridor
  const corrZ = (CN + CS) / 2;
  // Division logo on the end wall: a light plaque with the flat logo, washed by a downlight.
  rbox(S, 'white', 0.05, 1.3, 1.15, 0.012, X0 + 0.025, 1.32, corrZ);
  ctx.logo({ diameter: 0.8, division: 'medicale', style: 'flat' }, { x: X0 + 0.052, y: 2.05, z: corrZ, rotY: Math.PI / 2 });
  wallWash(S, 2.6, 2.3, X0 + 0.02, 1.25, corrZ, Math.PI / 2);
  // Waiting seats outside the consulting rooms.
  place(beamSeating(3), -18.75, CS - T / 2 - 0.31, Math.PI);
  place(beamSeating(2), -24.0, CS - T / 2 - 0.31, Math.PI);
  onFace(sanitizer(), 'N', CS - T / 2, -13.05, 1.15);
  onFace(sanitizer(), 'N', CS - T / 2, -17.15, 1.15);
  onFace(clock(), 'N', CS - T / 2, -15.1, 2.55);
  place(plant(3, 0.9), -33.35, CN + T / 2 + 0.35, 0);
  place(plant(7, 0.9), -33.35, CS - T / 2 - 0.35, 0);
  // Light pools under the ceiling panels (building.ts grid: x = −31.85 + 3.2 k, z = 8.55).
  for (let x = -31.85; x < -10.5; x += 3.2) lightPool(S, 2.3, 1.7, x, 0.012, 8.55);

  // ================================================================== measurement hub
  const hubWall = HN + T / 2;
  const slots: Partial<Record<ScaleId, Slot>> = {
    r2020: { x: -14.0, z: hubWall + 0.06 + 0.225, rotY: 0 },
    c202: { x: -16.05, z: hubWall + 0.06 + 0.3, rotY: 0 },
    // The WBA300 stands in the entry sightline instead: at the mouth of the N-S corridor,
    // facing east down the main corridor towards the lobby doorway (see the paintings section).
    wba300: { x: XW + T / 2 + 0.06 + 0.275, z: 1.9, rotY: Math.PI / 2 },
  };
  const HUB_X0 = -17.3; // west edge of the measurement area (two column scales)
  // A mid-grey feature panel behind the white column scales, from the stripe to 2.5 m: white
  // products against a white wall dissolve (the C202 beam, the R2020's top), against grey they
  // read from the lobby doorway. A dark shadow gap caps it.
  {
    const px0 = HUB_X0;
    const px1 = -12.75;
    const py0 = DADO + STRIPE;
    const py1 = 2.5;
    box(S, 'grey', px1 - px0, py1 - py0, 0.008, (px0 + px1) / 2, py0, hubWall + 0.004).castShadow = false;
    box(S, 'dark', px1 - px0, 0.012, 0.01, (px0 + px1) / 2, py1, hubWall + 0.005).castShadow = false;
  }
  // Downlight washes on the panel behind each column scale (pools below the heads, not behind
  // them) and a pool in front.
  for (const id of ['r2020', 'c202'] as const) {
    const s = slots[id]!;
    wallWash(S, 1.4, 1.5, s.x, 0.95, hubWall + 0.012);
    lightPool(S, 1.6, 1.6, s.x, 0.012, s.z + 0.55);
  }
  // The measurement area: a lighter vinyl inlay edged with grey floor tape, a linear pendant.
  {
    const ax0 = HUB_X0;
    const ax1 = -12.75;
    const az1 = hubWall + 2.0;
    const inl = box(S, 'floorRoom', ax1 - ax0, 0.002, az1 - hubWall, (ax0 + ax1) / 2, 0.006, (hubWall + az1) / 2);
    inl.castShadow = false;
    const tape = 0.03;
    for (const [x0, z0, x1, z1] of [
      [ax0, az1 - tape, ax1, az1],
      [ax0, hubWall, ax0 + tape, az1],
      [ax1 - tape, hubWall, ax1, az1],
    ]) {
      const m = box(S, 'band', x1 - x0, 0.002, z1 - z0, (x0 + x1) / 2, 0.0075, (z0 + z1) / 2);
      m.castShadow = false;
    }
    linearPendant(S, ax1 - ax0 - 0.4, (ax0 + ax1) / 2, 2.95, hubWall + 0.75, H);
  }
  // Nurse counter by the east wall, facing the hub.
  place(nurseCounter(3.0, 0.85), -12.3, 2.35, -Math.PI / 2);
  place(officeChair(), -11.3, 1.75, -Math.PI / 2 + 0.3);
  place(officeChair(), -11.25, 3.1, -Math.PI / 2 - 0.2);
  place(medCart(), -10.55, 4.95, -Math.PI / 2);
  onFace(clock(), 'N', CN - T / 2, -11.3, 2.5);
  // A chair to sit down and put the shoes back on.
  place(visitorChair(), -20.05, hubWall + 0.35, 0);
  place(plant(11, 1), -20.95, hubWall + 0.4, 0);
  for (let x = -19.05; x > -13; x -= 3.2) {
    lightPool(S, 2.2, 1.6, x, 0.012, 2.15);
  }

  // ================================================================== consulting rooms (mirror images)
  const amb = (mirror: boolean) => {
    // Local frame: x = distance east of the shared wall XS (AMB 1); mirrored for AMB 2.
    const R = new THREE.Group();
    const E = X1 - XS; // room width wall-centre to shell face (4.95)
    const zS = Z1; // south (outer) wall face
    const zN = CS + T / 2; // corridor wall face
    // Couch along the far wall, head towards the window; curtain track around it.
    const couch = examCouch();
    couch.scale.x = -1;
    couch.position.set(E - 0.12 - 0.33, 0, 13.5);
    couch.rotation.y = -Math.PI / 2;
    R.add(couch);
    const trackX = E - 2.15;
    curtainTrack(R, [
      [E, 12.0],
      [trackX, 12.0],
      [trackX, zS],
    ], 2.3, H);
    // Curtains pulled back: bunched against the wall and at the window end.
    const c1 = curtain(R, 0.55, 0.35, 2.27, { amp: 0.06, wave: 0.09 });
    c1.position.set(E - 0.6, 0, 12.0);
    const c2 = curtain(R, 0.6, 0.35, 2.27, { amp: 0.06, wave: 0.09 });
    c2.position.set(trackX, 0, zS - 0.05);
    c2.rotation.y = Math.PI / 2;
    const trolley = instrumentTrolley();
    trolley.position.set(E - 1.35, 0, 12.75);
    trolley.rotation.y = -Math.PI / 2;
    R.add(trolley);
    const step = stepStool();
    step.position.set(E - 1.12, 0, 14.0);
    step.rotation.y = -Math.PI / 2;
    R.add(step);
    const lamp = examLamp();
    lamp.position.set(E - 1.45, 0, 15.25);
    lamp.rotation.y = Math.PI / 2 + 0.5;
    R.add(lamp);
    // Desk with the doctor's chair (back to the window) and two patient chairs.
    const dk = desk(1.4, 0.7);
    dk.position.set(1.5, 0, 14.3);
    R.add(dk);
    const dc = officeChair();
    dc.position.set(1.4, 0, 15.2);
    dc.rotation.y = Math.PI + 0.15;
    R.add(dc);
    const solids: THREE.Object3D[] = [couch, trolley, step, lamp, dk, dc];
    for (const [x, r] of [
      [1.05, 0.12],
      [1.95, -0.1],
    ]) {
      const ch = visitorChair();
      ch.position.set(x, 0, 13.35);
      ch.rotation.y = r;
      R.add(ch);
      solids.push(ch);
    }
    // Sink cabinet on the corridor wall, bin beside it.
    const sk = sinkCabinet(1.0, 0.6);
    sk.position.set(2.6, 0, zN + 0.3);
    R.add(sk);
    const bin = pedalBin();
    bin.position.set(3.35, 0, zN + 0.25);
    R.add(bin);
    solids.push(sk, bin);
    // Wall fittings: X-ray light box and BP unit on the party wall, frosted window.
    const neg = negatoscope();
    neg.position.set(T / 2, 1.25, 12.55);
    neg.rotation.y = Math.PI / 2;
    R.add(neg);
    const bp = bpWallUnit();
    bp.position.set(T / 2, 1.3, 13.85);
    bp.rotation.y = Math.PI / 2;
    R.add(bp);
    const win = frostedWindow(1.5, 1.3);
    win.position.set(1.6, 1.0, zS);
    win.rotation.y = Math.PI;
    R.add(win);
    const cw = frostedWindow(1.1, 1.3);
    cw.position.set(E - 1.05, 1.0, zS);
    cw.rotation.y = Math.PI;
    R.add(cw);
    const hook = new THREE.Group();
    box(hook, 'steel', 0.6, 0.03, 0.02, 0, 0, 0.01);
    for (let i = 0; i < 3; i++) box(hook, 'steel', 0.015, 0.06, 0.05, -0.2 + i * 0.2, -0.02, 0.035);
    hook.position.set(E, 1.65, 15.0);
    hook.rotation.y = -Math.PI / 2;
    R.add(hook);
    R.position.x = XS;
    if (mirror) R.scale.x = -1;
    S.add(R);
    R.updateMatrixWorld(true);
    // Colliders for the furniture (world AABBs after the mirror).
    for (const o of solids) ctx.addSolid(o, -0.03);
  };
  amb(false);
  amb(true);

  // ================================================================== lab
  const labCx = (XL + XA2) / 2;
  place(labBench(5.6), labCx, Z1 - 0.375, Math.PI);
  ctx.addOccluder(place(glassCabinet(glass), XL + T / 2 + 0.23, 12.0, Math.PI / 2));
  place(labFridge(), XL + T / 2 + 0.31, 13.0, Math.PI / 2);
  place(stool(0.72), labCx + 0.95, 14.55, 0);
  place(stool(0.72), labCx - 1.3, 14.45, 0);
  place(sinkCabinet(0.9, 0.55, true), XA2 - T / 2 - 0.28, 12.6, -Math.PI / 2);
  onFace(clock(0.13), 'S', CS + T / 2, labCx - 1.8, 2.45);
  slots.ht = { x: labCx + 0.05, z: 12.75, rotY: Math.PI };
  lightPool(S, 1.6, 1.6, labCx + 0.05, 0.012, 12.2);

  // ================================================================== N-S corridor
  const nsX = (XW + XE) / 2;
  onFace(sanitizer(), 'W', XE - T / 2, -1.05, 1.15);
  onFace(sanitizer(), 'E', XW + T / 2, -10.45, 1.15);
  // A bench for relatives in front of the nursery window.
  place(beamSeating(3), XW + T / 2 + 0.31, -5.1, Math.PI / 2);
  place(linenTrolley(), XW + T / 2 + 0.35, -13.6, Math.PI / 2);
  for (let z = -13.85; z < 5; z += 3.2) lightPool(S, 1.6, 2.2, -22.25, 0.012, z);

  // ================================================================== nursery
  const nE = XS - T / 2; // east wall face
  const pedFront = nE - 0.95; // pedestal fronts (x)
  // Pedestal depths follow SPECS: approx d + 20 cm.
  slots['baby02-1'] = { x: pedFront + (0.45 + 0.2) / 2, z: -2.2, rotY: -Math.PI / 2 };
  slots.superbaby = { x: pedFront + (0.32 + 0.2) / 2, z: -4.25, rotY: -Math.PI / 2 };
  slots['baby02-2'] = { x: pedFront + (0.45 + 0.2) / 2, z: -6.3, rotY: -Math.PI / 2 };
  for (const z of [-2.2, -4.25, -6.3]) {
    lightPool(S, 1.4, 1.4, pedFront - 0.4, 0.012, z);
    wallWash(S, 1.2, 2.2, nE - 0.01, 1.2, z, -Math.PI / 2);
  }
  place(changingTable(1.2, 0.75), -19.45, NN + T / 2 + 0.375, 0);
  place(sinkCabinet(0.9, 0.6, true), -17.95, NN + T / 2 + 0.3, 0);
  for (const [i, z] of [-6.25, -5.13, -4.0].entries()) place(babyCot(glass), XE + T / 2 + 0.33, z, Math.PI / 2 + (i - 1) * 0.04);
  place(armchair(), -19.3, HN - T / 2 - 0.45, Math.PI);
  onFace(clock(0.14), 'S', NN + T / 2, -16.6, 2.3);
  onFace(sanitizer(), 'E', XE + T / 2, -3.05, 1.15);
  lightPool(S, 1.6, 1.3, -19.45, 0.93, NN + T / 2 + 0.4);

  // ================================================================== ward
  // Bays with curtain tracks: two occupied bays (curtains drawn) along the north wall, the
  // PL-VEGA bay open on the west wall; DE20 beside it and RW2.0 with its ramp towards the door
  // stand out in the room, the wheelchair waiting in front of the ramp.
  const wW = X0; // west wall face
  const bayZ = -10.9;
  const tX = wW + 3.95; // east edge of the west-wall bays
  const bX = -26.2; // east edge of the north-middle bay
  const bed = { x: wW + 0.12 + 1.11, z: bayZ };
  slots['pl-vega'] = { x: bed.x, z: bed.z, rotY: Math.PI / 2 };
  slots.de20 = { x: -30.9, z: -7.45, rotY: Math.PI / 2 + 0.4 };
  slots['rw20-sedia'] = { x: -31.35, z: -4.25, rotY: Math.PI / 2 };
  place(wheelchair(), -28.2, -2.95, -Math.PI / 2 - 0.5);
  // Bed-head units: PL-VEGA bay, and the two curtained bays.
  onFace(bedHeadUnit(1.7), 'E', wW, bayZ, 1.35);
  onFace(bedHeadUnit(1.7), 'E', wW, -14.25, 1.35);
  onFace(bedHeadUnit(1.7), 'S', Z0, (tX + bX) / 2, 1.35);
  wallWash(S, 2.2, 1.6, wW + 0.02, 1.6, bayZ, Math.PI / 2);
  place(bedsideCabinet(), wW + 0.3, -12.28, Math.PI / 2);
  curtainTrack(S, [
    [wW, -12.6],
    [tX, -12.6],
    [tX, Z0],
  ], 2.3, H);
  curtainTrack(S, [
    [tX + 0.05, -12.6],
    [bX, -12.6],
    [bX, Z0],
  ], 2.3, H);
  curtainTrack(S, [
    [tX, -12.6],
    [tX, -9.2],
    [wW, -9.2],
  ], 2.3, H);
  {
    /** A drawn curtain along a straight run, solid and hiding logos behind it. */
    const drawn = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const c = curtain(S, len, 0.35, 2.27);
      c.position.set(x0, 0, z0);
      c.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
      const r = { minX: Math.min(x0, x1) - 0.06, maxX: Math.max(x0, x1) + 0.06, minZ: Math.min(z0, z1) - 0.06, maxZ: Math.max(z0, z1) + 0.06 };
      ctx.addCollider(r);
      occlude(r.minX, 0.5, r.minZ, r.maxX, 2.2, r.maxZ);
    };
    drawn(wW + 0.03, -12.6, tX - 0.32, -12.6);
    drawn(tX, Z0 + 0.03, tX, -12.92);
    drawn(tX + 0.32, -12.6, bX - 0.32, -12.6);
    drawn(bX, Z0 + 0.03, bX, -12.92);
    // PL-VEGA bay: curtains pulled back against the wall and at the corner.
    const cc = curtain(S, 0.55, 0.35, 2.27, { amp: 0.06, wave: 0.09 });
    cc.position.set(tX, 0, -12.3);
    cc.rotation.y = -Math.PI / 2;
    const cd = curtain(S, 0.6, 0.35, 2.27, { amp: 0.06, wave: 0.09 });
    cd.position.set(wW + 0.05, 0, -9.2);
  }
  // Behind the drawn curtains: occupied bays (cabinets, chairs) glimpsed under the hem.
  place(bedsideCabinet(), wW + 0.3, -12.95, Math.PI / 2);
  place(visitorChair(), wW + 2.9, -14.6, -0.6);
  place(bedsideCabinet(), bX - 0.4, -15.5, 0);
  place(visitorChair(), tX + 0.6, -13.4, 2.4);
  // Daylight: frosted windows on the west wall.
  onFace(frostedWindow(1.4, 1.3), 'E', wW, -7.45, 1.0);
  onFace(frostedWindow(1.4, 1.3), 'E', wW, -4.25, 1.0);
  // East side: sink by the door, medication cart, IV stand, charting cart, clock over the doors.
  place(sinkCabinet(1.2, 0.6), XW - T / 2 - 0.3, -12.9, -Math.PI / 2);
  place(medCart(), XW - T / 2 - 0.3, -5.6, -Math.PI / 2);
  place(ivPole(), XW - T / 2 - 0.45, -4.3, 0);
  place(instrumentTrolley(), XW - T / 2 - 0.3, -14.6, -Math.PI / 2);
  place(workstationCart(), -26.4, -11.6, -Math.PI / 2 - 0.5);
  place(linenTrolley(), -25.3, -2.6, 0);
  onFace(clock(), 'W', XW - T / 2, (gWard.a + gWard.b) / 2, 2.85);
  lightPool(S, 2.4, 2.2, bed.x + 0.3, 0.012, bayZ);
  lightPool(S, 1.8, 1.8, -30.9, 0.012, -7.45);
  lightPool(S, 2.0, 1.8, -31.2, 0.012, -4.25);

  // ================================================================== waiting room
  place(beamSeating(4), X0 + 0.31, 1.3, Math.PI / 2);
  place(beamSeating(5), -29.0, ZW + T / 2 + 0.31, 0);
  place(beamSeating(4), XW - T / 2 - 0.31, 1.6, -Math.PI / 2);
  place(coffeeTable(1.0, 0.55), -29.3, 1.4, 0.1);
  place(waterCooler(), X0 + 0.3, -1.45, Math.PI / 2);
  place(plant(5, 1.1), -25.35, 5.05, 0);
  place(plant(9, 1.0), -33.35, 4.95, 0);
  onFace(wallTv(), 'E', X0, 1.3, 2.25);
  place(vendingMachine(glass), XW - T / 2 - 0.42, -1.3, -Math.PI / 2);
  ctx.addOccluder(new THREE.Box3(new THREE.Vector3(XW - T / 2 - 0.82, 0, -1.75), new THREE.Vector3(XW - T / 2 - 0.02, 1.87, -0.85)));
  onFace(magazineRack(), 'E', X0, 3.55, 0.75);
  place(kidsCorner(), -31.7, 3.9, 0.3);
  lightPool(S, 2.6, 2.6, -29.2, 0.012, 1.6);

  // ================================================================== paintings (clickable, medicale)
  const hang = (o: Parameters<WorldContext['painting']>[0], at: Parameters<WorldContext['painting']>[1]) => ctx.painting(o, at);
  hang({ w: 0.9, h: 1.15, division: 'medicale', seed: 21, composition: 'high' }, { x: nsX, y: 1.98, z: Z0, rotY: 0 });
  hang({ w: 1.5, h: 0.9, division: 'medicale', seed: 34, composition: 'left' }, { x: X1, y: 1.95, z: 2.35, rotY: -Math.PI / 2 });
  hang({ w: 1.6, h: 0.95, division: 'medicale', seed: 47, composition: 'right' }, { x: -29.0, y: 1.8, z: ZW + T / 2, rotY: 0 });
  hang({ w: 1.4, h: 0.9, division: 'medicale', seed: 58, composition: 'center' }, { x: -28.3, y: 1.75, z: ZW - T / 2, rotY: Math.PI });
  wallWash(S, 2.0, 1.8, nsX, 1.0, Z0 + 0.01);
  // At the mouth of the N-S corridor, in the sightline from the lobby doorway: the WBA300 on a
  // lit inlay, washed from above (a product is the first thing seen on entering the wing).
  {
    const s = slots.wba300!;
    const ix0 = XW + T / 2;
    const ix1 = ix0 + 1.3;
    const inl = box(S, 'floorRoom', ix1 - ix0, 0.002, 1.5, (ix0 + ix1) / 2, 0.006, s.z);
    inl.castShadow = false;
    for (const [x0, z0, x1, z1] of [
      [ix1 - 0.03, s.z - 0.75, ix1, s.z + 0.75],
      [ix0, s.z - 0.75, ix1, s.z - 0.72],
      [ix0, s.z + 0.72, ix1, s.z + 0.75],
    ]) box(S, 'band', x1 - x0, 0.002, z1 - z0, (x0 + x1) / 2, 0.0075, (z0 + z1) / 2).castShadow = false;
    wallWash(S, 1.6, 1.7, XW + T / 2 + 0.01, 0.6, s.z, Math.PI / 2);
    lightPool(S, 1.6, 1.6, s.x + 0.5, 0.012, s.z);
  }

  visibilityCulling(ctx, inner);

  // Split the palette parts into four spatial clusters (four merged meshes that can be
  // frustum-culled separately instead of one mesh spanning the wing).
  S.updateMatrixWorld(true);
  const bb = new THREE.Box3();
  const cc = new THREE.Vector3();
  S.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.material !== PROP) return;
    bb.setFromObject(m).getCenter(cc);
    const k = cc.z > CS ? 0 : cc.x < XW && cc.z < CN ? 1 : cc.x < X1 && cc.z < HN && cc.x > XW - 0.2 ? 2 : 3;
    m.material = propCluster(k);
  });
  ctx.addStatic(S);
  return slots;
}

/**
 * Walls do not stop frustum culling: looking north from the corridor would draw every scale in
 * the wing (each is 20+ draw calls) although the partitions hide them. Each scale, pedestal,
 * painting and logo placed in the wing is drawn only while the camera has a line of sight to it:
 * rays from the camera to a grid of points on its slightly enlarged bounds are tested against the
 * world's occluder boxes (walls, lintels, drawn curtains; glazing and doorways are gaps), and the
 * object stays visible if any ray gets through. Re-evaluated only when the camera moves; the
 * first frames are skipped so the one-off static shadow map still contains everything. A hidden
 * object's link is hidden with it (paintings) or already occluded by the same walls (badges).
 */
function visibilityCulling(ctx: WorldContext, inner: { minX: number; maxX: number; minZ: number; maxZ: number }): void {
  const names = new Set<string>([...SCALE_IDS.medicale, 'pedestal', 'painting', 'wunder-logo']);
  type Tracked = { obj: THREE.Object3D; box: THREE.Box3; pts: THREE.Vector3[] };
  let tracked: Tracked[] | null = null;
  let camera: THREE.Object3D | null | undefined;
  let frame = 0;
  const last = new THREE.Vector3(Infinity, 0, 0);
  const cam = new THREE.Vector3();
  const ray = new THREE.Ray();
  const hit = new THREE.Vector3();
  const span = new THREE.Box3();
  const c = new THREE.Vector3();

  const collect = (): Tracked[] => {
    const out: Tracked[] = [];
    for (const o of ctx.dynamic.children) {
      if (!names.has(o.name)) continue;
      const box = new THREE.Box3().setFromObject(o);
      if (box.isEmpty()) continue;
      box.getCenter(c);
      if (c.x < inner.minX || c.x > inner.maxX || c.z < inner.minZ || c.z > inner.maxZ) continue;
      // A small margin only: wall-hung pieces must not poke through the 12 cm partitions.
      box.expandByScalar(0.05);
      // Never sample below the floor: rays would slip under the wall occluders.
      box.min.y = Math.max(box.min.y, 0.03);
      // Sample grid: at most ~45 cm apart so a narrow view through a doorway still finds a point.
      const size = box.getSize(new THREE.Vector3());
      const steps = (e: number) => Math.min(6, Math.max(3, Math.ceil(e / 0.45) + 1));
      const [nx, ny, nz] = [steps(size.x), steps(size.y), steps(size.z)];
      const pts: THREE.Vector3[] = [box.getCenter(new THREE.Vector3())]; // centre first: the usual quick positive
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
        pts.push(new THREE.Vector3(box.min.x + (size.x * i) / (nx - 1), box.min.y + (size.y * j) / (ny - 1), box.min.z + (size.z * k) / (nz - 1)));
      }
      out.push({ obj: o, box, pts });
    }
    return out;
  };

  const visible = (t: Tracked): boolean => {
    if (t.box.containsPoint(cam)) return true;
    span.makeEmpty().expandByPoint(cam).union(t.box);
    const occ = ctx.occluders.filter((b) => b.intersectsBox(span) && !b.containsPoint(cam));
    if (!occ.length) return true;
    for (const p of t.pts) {
      const d = p.distanceTo(cam);
      ray.origin.copy(cam);
      ray.direction.copy(p).sub(cam).divideScalar(Math.max(d, 1e-6));
      let blocked = false;
      for (const b of occ) {
        if (ray.intersectBox(b, hit) && hit.distanceTo(cam) < d - 0.02) {
          blocked = true;
          break;
        }
      }
      if (!blocked) return true;
    }
    return false;
  };

  ctx.onUpdate(() => {
    if (++frame < 4) return;
    if (camera === undefined) camera = ctx.scene.children.find((o) => (o as THREE.PerspectiveCamera).isPerspectiveCamera) ?? null;
    if (!camera) return;
    tracked ??= collect();
    camera.getWorldPosition(cam);
    if (cam.distanceToSquared(last) < 0.01) return;
    last.copy(cam);
    for (const t of tracked) t.obj.visible = visible(t);
  });
}

const zone: ZoneModule = {
  id: 'medicale',
  build({ ctx, shell }) {
    return { slots: build(ctx, shell.inner) };
  },
};
export default zone;
