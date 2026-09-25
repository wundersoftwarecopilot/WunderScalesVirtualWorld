import * as THREE from 'three';
import { localRectToWorld, type Rect } from '../../core/rect';
import type { ScaleId } from '../../scales/specs';
import { rng, type WorldContext } from '../context';
import type { Slot, ZoneModule } from '../zone';
import {
  basketStack,
  box,
  boxMM,
  cabinet,
  cartonLoadGeometry,
  cartonMat,
  checkout,
  chiller,
  cluster,
  cyl,
  decal,
  deliBackCounter,
  deliCounter,
  dockDoor,
  forklift,
  GLOW,
  gondola,
  highBay,
  knobWeight,
  linearLight,
  MARKET_FLOOR_TILE,
  marketFloorMat,
  PAL,
  palletGeometry,
  part,
  produceTable,
  ProductStock,
  rack,
  RACK,
  rod,
  testBlock,
  tint,
  trolleyGeometry,
  uprightFridge,
  wallShelving,
  WAREHOUSE_FLOOR_TILE,
  warehouseFloorMat,
  weightCase,
  workbench,
  type GondolaOut,
  type ProductProfile,
} from './industriale-props';

/**
 * INDUSTRIALE wing: supermarket (south half) + warehouse (north half).
 * Inner x 10.15..33.85, z −15.85..15.85, ceiling 7.5 m. Entry from the lobby at x 10, z 6..10.
 *
 *   z −15.85 ┌───────────────────────────────────────────────────────────┐
 *            │ A │   │ B B │   │ C C │  painting   LOGO(high)   painting │QC
 *            │ A │   │ B B │   │ C C │               CX gantry   JSD ◁ ║ bench
 *            │ A │   │ B B │   │ C C │      TPX-C                WJ  ◁ ║
 *            │ A │   │ B B │   │ C C │                            NHB ◁ painting
 *            │ A │   │ B B │   │ C C │  WX+WPA  WP4 1212  WP4-U         │
 *            │  (racking, 6 m)       │  ─ ─ tape ─ ─        staging ▭▭▭ ▐dock
 *   z −0.2   ├──────── partition 4.2 m ───┤ opening ├──── partition ─────┤
 *            │ wall shelving ▬▬▬▬▬▬▬▬▬▬▬▬▬▬│  6 m    │  chillers ▬▬▬▬▬▬▬ │
 *            │ trolleys  G1   G2   G3     │         │            ┌────┐ │
 *     entry  ═══════════ promenade ════════════════════ SMART ◁  │deli│ │
 *            │   checkouts   G4   G5   G6                JPP  ◁  └────┘ │
 *            │   ▭▭▭▭              ▬▬▬ wall shelving ▬▬▬  produce  fridges│
 *   z 15.85  └───────────────────────────────────────────────────────────┘
 *          x 10.15                 22        28                        33.85
 *
 * Statics use the industriale palette material (three clusters: market, warehouse, racks) so the
 * whole wing is a handful of draw calls; products, trolleys, pallets and carton loads are
 * instanced. No lights: emissive luminaires and additive light pools suggest the lighting.
 */

const PART_Z = -0.1; // partition centre line (market | warehouse)
const PART_T = 0.2;
const PART_H = 4.2;
const OPEN_X0 = 22;
const OPEN_X1 = 28;

const SLOTS: Record<string, Slot> = {
  smart: { x: 29.0, z: 6.9, rotY: -Math.PI / 2 },
  jpp: { x: 29.0, z: 9.1, rotY: -Math.PI / 2 },
  'wx-wpa': { x: 23.2, z: -6.6, rotY: 0 },
  'wp4-1212': { x: 26.3, z: -6.6, rotY: 0 },
  'wp4-u': { x: 29.9, z: -6.6, rotY: 0 },
  'tpx-c': { x: 24.0, z: -10.5, rotY: -0.4 },
  // CX stands clear of the WP4 1212 indicator on the sightline from the partition opening.
  cx: { x: 28.8, z: -12.8, rotY: 0 },
  'jsd-dual': { x: 31.6, z: -14.0, rotY: -Math.PI / 2 },
  wj600: { x: 31.6, z: -12.2, rotY: -Math.PI / 2 },
  nhb: { x: 31.6, z: -10.6, rotY: -Math.PI / 2 },
};

/** Softer light pools for the bright market floor. */
const GLOW_SOFT = Object.assign(GLOW.clone(), { opacity: 0.07, name: 'industriale-glow-soft' });

const CARTON_TONES = ['#ffffff', '#e6e7e9', '#cfd1d4', '#b7babd', '#a3a6aa'].map((c) => new THREE.Color(c));
const FRUIT_TONES = ['#b9bbbe', '#8e9195', '#6d7074', '#a4a7ab', '#7f8286'].map((c) => new THREE.Color(c));

function buildIndustriale(ctx: WorldContext, inner: Rect, ceiling: number): Partial<Record<ScaleId, Slot>> {
  const X0 = inner.minX;
  const X1 = inner.maxX;
  const Z0 = inner.minZ;
  const Z1 = inner.maxZ;
  const glass = ctx.mats.glass;
  const rnd = rng(0x1d57a1e);

  const market = new THREE.Group(); // statics: supermarket
  const ware = new THREE.Group(); // statics: warehouse (walls, props)
  const racks = new THREE.Group(); // statics: racking (own cluster, big bounds)
  // Statics that cast no shadow: roof steel, high bays, luminaire cables. The "sun" is a static
  // overhead light that shines through the opaque roof; shadows of things hanging under the
  // roof would streak the floor and walls.
  const fixtures = new THREE.Group();
  const decals = new THREE.Group(); // light pools
  const stock = new ProductStock(rnd);
  const cartons: THREE.Matrix4[] = []; // carton loads (pallet stacks), 1.2 × 1 × 0.8 base geometry
  const cartonTone: THREE.Color[] = [];
  const singleCartons: THREE.Matrix4[] = []; // single cartons (overstock), unit cube geometry
  const singleTone: THREE.Color[] = [];
  const palletsSimple: THREE.Matrix4[] = [];
  const palletsDetail: THREE.Matrix4[] = [];

  const solid = (r: Rect, tag = 'prop') => ctx.addCollider(r, tag);
  const occlude = (r: Rect, h: number) => ctx.addOccluder(new THREE.Box3(new THREE.Vector3(r.minX, 0, r.minZ), new THREE.Vector3(r.maxX, h, r.maxZ)));
  const rectOf = (x: number, z: number, w: number, d: number): Rect => ({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });

  /** Place a shelving unit, collide/occlude it and stock its shelves. */
  const placeUnit = (unit: GondolaOut, parent: THREE.Object3D, x: number, z: number, rotY: number, h: number, profile: (side: 'a' | 'b' | 'end', i: number) => ProductProfile | null) => {
    unit.group.position.set(x, 0, z);
    unit.group.rotation.y = rotY;
    parent.add(unit.group);
    unit.group.updateMatrixWorld(true);
    const f = unit.foot;
    const r = localRectToWorld({ x: (f.minX + f.maxX) / 2, z: (f.minZ + f.maxZ) / 2, w: f.maxX - f.minX, d: f.maxZ - f.minZ }, x, z, rotY);
    solid(r, 'shelving');
    occlude(r, h);
    unit.shelves.forEach((s, i) => {
      const p = profile(s.side, i);
      if (!p) return;
      stock.fill({ frame: new THREE.Matrix4().multiplyMatrices(unit.group.matrixWorld, s.local), len: s.len, depth: s.depth, clear: s.clear, profile: p });
    });
    return r;
  };

  /** A carton load on a pallet at world (x, y, z); `rotY` turns the 1.2 m side off the X axis. */
  const palletLoad = (x: number, y: number, z: number, rotY: number, loadH: number, detail: boolean) => {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    (detail ? palletsDetail : palletsSimple).push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1)));
    if (loadH > 0) {
      cartons.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y + 0.144, z), q, new THREE.Vector3(0.98, loadH, 0.975)));
      cartonTone.push(CARTON_TONES[Math.floor(rnd() * CARTON_TONES.length)]);
    }
  };

  // ================================================================== floors, structure

  const floorPlane = (mat: THREE.Material, x0: number, z0: number, x1: number, z1: number, tile: number) => {
    const w = x1 - x0;
    const d = z1 - z0;
    const geo = new THREE.PlaneGeometry(w, d);
    const uv = geo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w + x0) / tile, (uv.getY(i) * d - z1) / tile);
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, 0.004, (z0 + z1) / 2);
    m.receiveShadow = true;
    m.castShadow = false;
    ctx.addStatic(m);
  };
  floorPlane(marketFloorMat, X0, PART_Z, X1, Z1, MARKET_FLOOR_TILE);
  floorPlane(warehouseFloorMat, X0, Z0, X1, PART_Z, WAREHOUSE_FLOOR_TILE);
  // Steel threshold where the tiles meet the concrete in the opening.
  boxMM(ware, 'steel', OPEN_X0, 0, PART_Z - 0.05, OPEN_X1, 0.01, PART_Z + 0.05);

  // Roof: exposed steel I-beams spanning the wing between the ceiling light rows.
  for (const x of [15.55, 20.55, 25.55, 30.55]) {
    boxMM(fixtures, 'beam', x - 0.012, ceiling - 0.46, Z0, x + 0.012, ceiling - 0.04, Z1);
    boxMM(fixtures, 'beam', x - 0.1, ceiling - 0.04, Z0, x + 0.1, ceiling, Z1);
    boxMM(fixtures, 'beam', x - 0.1, ceiling - 0.5, Z0, x + 0.1, ceiling - 0.46, Z1);
  }

  // Partition wall (market | warehouse): sandwich panels, 4.2 m high, with a 6 m opening.
  const partition = (x0: number, x1: number) => {
    const zf = PART_Z + PART_T / 2; // market face
    const zb = PART_Z - PART_T / 2; // warehouse face
    boxMM(ware, 'wall', x0, 0, zb, x1, PART_H, zf);
    boxMM(ware, 'dark', x0 - 0.01, PART_H, zb - 0.02, x1 + 0.01, PART_H + 0.05, zf + 0.02);
    // Kick plates.
    boxMM(ware, 'steelDark', x0, 0, zb - 0.004, x1, 0.18, zb);
    boxMM(ware, 'steelDark', x0, 0, zf, x1, 0.18, zf + 0.004);
    // Panel seams (warehouse face), 1.15 m panels.
    for (let x = x0 + 1.15; x < x1 - 0.2; x += 1.15) boxMM(ware, 'seam', x - 0.006, 0.18, zb - 0.003, x + 0.006, PART_H, zb);
    // Market face: a thin light line above the shelving.
    boxMM(ware, 'tape', x0, 2.9, zf, x1, 2.94, zf + 0.004);
    solid({ minX: x0, maxX: x1, minZ: zb, maxZ: zf }, 'wall');
    occlude({ minX: x0, maxX: x1, minZ: zb, maxZ: zf }, PART_H);
  };
  partition(X0 - 0.15, OPEN_X0);
  partition(OPEN_X1, X1 + 0.15);
  // For the world's portal culler: low warehouse content is only visible through the opening
  // (the visitor's eye is well below the partition top).
  ctx.addSubRoom({
    id: 'industriale-warehouse',
    parent: 'industriale',
    rect: { minX: X0 - 0.15, maxX: X1 + 0.15, minZ: Z0 - 0.15, maxZ: PART_Z - PART_T / 2 },
    maxY: PART_H,
    portal: { axis: 'z', at: PART_Z, from: OPEN_X0, to: OPEN_X1, top: PART_H },
  });
  // Opening jambs with striped corner guards.
  for (const [x, s] of [
    [OPEN_X0, 1],
    [OPEN_X1, -1],
  ] as const) {
    const xa = x - (s > 0 ? 0.08 : 0);
    const xb = x + (s > 0 ? 0 : 0.08);
    boxMM(ware, 'steelDark', xa, 0, PART_Z - PART_T / 2 - 0.03, xb, PART_H + 0.02, PART_Z + PART_T / 2 + 0.03);
    const gx0 = s > 0 ? x : x - 0.03;
    const gx1 = s > 0 ? x + 0.03 : x;
    for (let i = 0; i < 6; i++) boxMM(ware, i % 2 ? 'hazard' : 'guard', gx0, i * 0.2, PART_Z - PART_T / 2 - 0.05, gx1, (i + 1) * 0.2, PART_Z + PART_T / 2 + 0.05);
  }

  // ================================================================== SUPERMARKET

  // Wall shelving along the partition (west of the opening), facing south.
  placeUnit(wallShelving(9), market, X0 + 0.15 + (9 * 1.25) / 2, PART_Z + PART_T / 2, 0, 2.6, (_s, i) => {
    const lvl = i % 6;
    if (lvl === 5) return null; // top shelf: overstock cartons (below)
    return lvl === 0 ? { box: 1 } : i < 24 ? { box: 0.6, bottle: 0.4 } : { box: 0.5, jar: 0.3, can: 0.2 };
  });
  // Overstock on the top shelves of both wall runs: single cartons.
  const overstock = (x0: number, x1: number, y: number, zBack: number, dir: 1 | -1) => {
    let x = x0 + 0.05;
    while (x < x1 - 0.45) {
      const w = 0.34 + rnd() * 0.12;
      const h = 0.18 + rnd() * 0.08;
      const d = 0.3 + rnd() * 0.06;
      if (rnd() > 0.12) {
        singleCartons.push(new THREE.Matrix4().compose(new THREE.Vector3(x + w / 2, y, zBack + dir * (d / 2 + 0.03)), new THREE.Quaternion(), new THREE.Vector3(w, h, d)));
        singleTone.push(CARTON_TONES[Math.floor(rnd() * CARTON_TONES.length)]);
      }
      x += w + 0.03 + rnd() * 0.05;
    }
  };
  overstock(X0 + 0.2, X0 + 0.15 + 9 * 1.25, 1.94, PART_Z + PART_T / 2 + 0.035, 1);

  // Nested trolleys by the west wall (north of the entry) + a basket stack.
  let trolleys: THREE.Object3D | null = null;
  {
    const mats: THREE.Matrix4[] = [];
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    for (let i = 0; i < 8; i++) mats.push(new THREE.Matrix4().compose(new THREE.Vector3(10.9, 0, 2.75 + i * 0.25), q, new THREE.Vector3(1, 1, 1)));
    const im = ctx.instanced(trolleyGeometry(), cluster('market'), mats);
    im.name = 'trolleys';
    trolleys = im;
    solid({ minX: 10.55, maxX: 11.3, minZ: 2.2, maxZ: 5.0 });
    // Corral rail.
    for (const z of [2.3, 4.95]) rod(market, 'steel', [11.42, 0, z], [11.42, 0.9, z], 0.02, 8);
    rod(market, 'steel', [11.42, 0.9, 2.3], [11.42, 0.9, 4.95], 0.02, 8);
    rod(market, 'steel', [11.42, 0.45, 2.3], [11.42, 0.45, 4.95], 0.015, 8);
    solid({ minX: 11.38, maxX: 11.46, minZ: 2.28, maxZ: 4.97 });
    const bs = basketStack(7);
    bs.position.set(10.75, 0, 5.3);
    market.add(bs);
    solid(rectOf(10.75, 5.3, 0.5, 0.36));
  }

  // Gondola rows. North block: end caps face the promenade (south); south block mirrored.
  const L2 = 2 * 1.25;
  const northZ = 5.3 - (L2 / 2 + 0.45);
  const southZ = 10.7 + (L2 / 2 + 0.45);
  const PROFILES: Array<[ProductProfile, ProductProfile, ProductProfile]> = [
    [{ box: 1 }, { box: 0.55, jar: 0.45 }, { box: 1 }],
    [{ bottle: 0.65, box: 0.35 }, { can: 0.45, box: 0.55 }, { bottle: 0.5, box: 0.5 }],
    [{ jar: 0.45, box: 0.55 }, { box: 0.8, can: 0.2 }, { jar: 0.4, box: 0.6 }],
    [{ box: 0.7, can: 0.3 }, { bottle: 0.6, box: 0.4 }, { box: 1 }],
    [{ box: 1 }, { jar: 0.5, box: 0.5 }, { can: 0.5, box: 0.5 }],
    [{ can: 0.4, box: 0.6 }, { box: 0.75, bottle: 0.25 }, { bottle: 0.6, box: 0.4 }],
  ];
  const gondolas: Array<[number, number, number]> = [
    [13.7, northZ, 0],
    [16.7, northZ, 0],
    [19.7, northZ, 0],
    [18.0, southZ, Math.PI],
    [21.0, southZ, Math.PI],
    [24.0, southZ, Math.PI],
  ];
  gondolas.forEach(([x, z, ry], gi) => {
    const [pa, pb, pe] = PROFILES[gi];
    placeUnit(gondola(2), market, x, z, ry, 2.2, (side, i) => {
      const base = i % 5 === 0 && side !== 'end';
      if (base) return { box: 1 };
      return side === 'a' ? pa : side === 'b' ? pb : pe;
    });
  });

  // South wall shelving (facing north) with overstock.
  const swX = 21.8;
  placeUnit(wallShelving(8), market, swX, Z1, Math.PI, 2.6, (_s, i) => {
    const lvl = i % 6;
    if (lvl === 5) return null;
    return lvl === 0 ? { box: 1 } : i < 24 ? { box: 0.55, jar: 0.25, can: 0.2 } : { box: 0.6, bottle: 0.4 };
  });
  {
    // Overstock (built in a local frame: x along the run, then mirrored by the unit's rotation).
    const start = singleCartons.length;
    overstock(-5, 5, 1.94, 0.035, 1);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(swX, 0, Z1), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI), new THREE.Vector3(1, 1, 1));
    for (let i = start; i < singleCartons.length; i++) singleCartons[i].premultiply(m);
  }

  // Multideck chillers along the partition east of the opening.
  placeUnit(chiller(4), market, 31.15, PART_Z + PART_T / 2, 0, 2.1, () => ({ box: 0.5, jar: 0.3, bottle: 0.2 }));

  // Upright glass-door fridges on the east wall, south of the deli.
  placeUnit(uprightFridge(5, glass), market, X1, 13.45, -Math.PI / 2, 2.4, () => ({ bottle: 0.55, can: 0.45 }));
  // ... and a shorter run north of the deli.
  placeUnit(uprightFridge(3, glass), market, X1, 3.3, -Math.PI / 2, 2.4, () => ({ box: 0.4, jar: 0.35, bottle: 0.25 }));

  // Checkouts: two tandem counters sharing the cashier aisle; exits towards the entry (west).
  for (const [z, mirror] of [
    [11.5, true],
    [14.0, false],
  ] as const) {
    const c = checkout();
    c.position.set(13.7, 0, z);
    if (mirror) {
      c.rotation.y = Math.PI;
      c.scale.set(-1, 1, 1);
    }
    market.add(c);
    solid(rectOf(13.7, z, 4.0, 0.82), 'checkout');
    // Chairs are small: collide their seats only.
    solid(rectOf(13.7 - 0.8, z + (mirror ? 0.95 : -0.95), 0.5, 0.5), 'chair');
  }
  linearLight(market, 3.2, 13.7, 3.4, 12.75, ceiling, 0, fixtures);

  // Deli counter with SMART + JPP on their pedestals in front of it (facing the shopper).
  const deliZ = 8.0;
  const deliLen = 5.0;
  const deli = deliCounter(deliLen, glass);
  deli.position.set(31.25, 0, deliZ);
  deli.rotation.y = -Math.PI / 2;
  market.add(deli);
  solid({ minX: 30.7, maxX: 31.82, minZ: deliZ - deliLen / 2, maxZ: deliZ + deliLen / 2 }, 'counter');
  const back = deliBackCounter(deliLen);
  back.position.set(X1, 0, deliZ);
  back.rotation.y = -Math.PI / 2;
  market.add(back);
  solid({ minX: X1 - 0.62, maxX: X1, minZ: deliZ - deliLen / 2, maxZ: deliZ + deliLen / 2 }, 'counter');
  // Deli canopy: floating header with light strips and a fine line; logo on its fascia.
  {
    const cx0 = 30.55;
    const z0 = deliZ - deliLen / 2 - 0.2;
    const z1 = deliZ + deliLen / 2 + 0.2;
    boxMM(market, 'white', cx0, 3.0, z0, X1, 3.08, z1);
    boxMM(market, 'white', cx0, 3.0, z0, cx0 + 0.06, 3.75, z1);
    boxMM(market, 'tape', cx0 - 0.004, 3.03, z0, cx0, 3.07, z1);
    for (const x of [31.1, 32.2, 33.2]) boxMM(market, 'lamp', x - 0.05, 2.995, z0 + 0.2, x + 0.05, 3.0, z1 - 0.2).castShadow = false;
    for (const z of [z0 + 0.4, z1 - 0.4]) rod(fixtures, 'darker', [32.3, 3.08, z], [32.3, ceiling, z], 0.006, 4);
    for (const z of [z0 + 0.4, z1 - 0.4]) rod(fixtures, 'darker', [cx0 + 0.3, 3.75, z], [cx0 + 0.3, ceiling, z], 0.006, 4);
    boxMM(market, 'white', cx0 + 0.06, 3.7, z0, X1, 3.75, z1);
    ctx.logo({ diameter: 0.46, division: 'industriale', style: 'flat' }, { x: cx0 - 0.003, y: 3.42, z: deliZ, rotY: -Math.PI / 2 });
    decal(decals, GLOW_SOFT, 3.4, 6.2, 31.6, 0.009, deliZ);
  }
  for (const id of ['smart', 'jpp']) {
    const s = SLOTS[id];
    decal(decals, GLOW_SOFT, 2.0, 2.0, s.x, 0.009, s.z);
  }

  // Produce: two tiered tables of crates near the deli.
  const fruit: Array<{ m: THREE.Matrix4; key: number }> = [];
  for (const [x, z, len, ry] of [
    [27.6, 12.8, 2.4, 0],
    [30.9, 13.3, 1.8, Math.PI / 2],
  ] as const) {
    const t = produceTable(len, rnd);
    t.group.position.set(x, 0, z);
    t.group.rotation.y = ry;
    market.add(t.group);
    t.group.updateMatrixWorld(true);
    for (const f of t.fruit) fruit.push({ m: f.m.premultiply(t.group.matrixWorld), key: f.key });
    const r = localRectToWorld({ x: 0, z: 0, w: len + 0.04, d: 1.24 }, x, z, ry);
    solid(r, 'table');
  }
  linearLight(market, 2.4, 27.6, 3.4, 12.8, ceiling, 0, fixtures);
  linearLight(market, 2.4, 30.9, 3.4, 13.3, ceiling, Math.PI / 2, fixtures);

  // Promo pallet on the promenade, off the sightline to the deli (cartons, one with a logo).
  {
    const px = 19.0;
    const pz = 9.3;
    const h = 0.84;
    palletLoad(px, 0.004, pz, 0, h, true);
    solid(rectOf(px, pz, 1.24, 0.84));
    // Logo on the top carton of the west face (the 0.8 m side), facing the entry.
    ctx.logo({ diameter: 0.16, division: 'industriale', style: 'flat' }, { x: px - 0.588 - 0.002, y: 0.148 + (h / 3) * 2.5, z: pz - 0.195, rotY: -Math.PI / 2 });
  }

  // Suspended luminaires over the promenade and the aisles.
  for (const z of [6.9, 9.1]) for (const x of [14.2, 17.7, 21.2, 24.7]) linearLight(market, 3.0, x, 3.6, z, ceiling, 0, fixtures);
  for (const x of [15.2, 18.2]) linearLight(market, 2.2, x, 3.6, northZ, ceiling, Math.PI / 2, fixtures);
  for (const x of [19.5, 22.5]) linearLight(market, 2.2, x, 3.6, southZ, ceiling, Math.PI / 2, fixtures);
  for (const z of [6.9, 9.1]) for (const x of [14.2, 17.7, 21.2, 24.7]) decal(decals, GLOW_SOFT, 4.2, 2.4, x, 0.009, z);

  // ================================================================== WAREHOUSE

  // Racking: A against the west wall (single), B and C back to back.
  const rackDefs: Array<[number, 1 | 2]> = [
    [X0 + 0.08 + RACK.depth / 2, 1],
    [15.05, 2],
    [19.95, 2],
  ];
  for (const [x, frames] of rackDefs) {
    const rk = rack(4, frames);
    const zc = Z0 + 0.3 + rk.len / 2;
    rk.group.position.set(x, 0, zc);
    racks.add(rk.group);
    const r = rectOf(x, zc, rk.width + 0.12, rk.len);
    solid(r, 'rack');
    occlude(r, RACK.height);
    for (const s of rk.slots) {
      const fill = rnd();
      if (fill < 0.14) continue;
      const floor = s.y === 0;
      const maxH = floor ? 1.25 : 1.12;
      const h = fill < 0.22 ? 0 : 0.55 + rnd() * (maxH - 0.55);
      palletLoad(x + s.x + (rnd() - 0.5) * 0.03, s.y + (floor ? 0.004 : 0), zc + s.z + (rnd() - 0.5) * 0.03, 0, h, false);
    }
  }
  // Pallets waiting to be put away in the cross aisle, and a forklift parked along the partition.
  palletLoad(12.7, 0.004, -2.2, 0, 1.15, true);
  palletLoad(14.1, 0.004, -2.2, 0, 0.8, true);
  solid({ minX: 12.1, maxX: 14.7, minZ: -2.6, maxZ: -1.8 });
  {
    const fl = forklift();
    fl.position.set(16.4, 0, -1.12);
    fl.rotation.y = -Math.PI / 2;
    ware.add(fl);
    solid({ minX: 16.4 - 0.78, maxX: 16.4 + 1.15, minZ: -1.12 - 0.53, maxZ: -1.12 + 0.53 }, 'forklift');
    solid({ minX: 16.4 - 1.86, maxX: 16.4 - 0.78, minZ: -1.12 - 0.32, maxZ: -1.12 + 0.32 }, 'forks');
  }

  // Weighing area: bay corner marks (floor tape), a walkway from the opening.
  const tape = (x0: number, z0: number, x1: number, z1: number) => boxMM(ware, 'tape', x0, 0.004, z0, x1, 0.008, z1);
  const corners = (cx: number, cz: number, w: number, d: number, ry = 0, arm = 0.32, t = 0.05) => {
    const g = new THREE.Group();
    g.position.set(cx, 0, cz);
    g.rotation.y = ry;
    ware.add(g);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = (sx * w) / 2;
        const z = (sz * d) / 2;
        boxMM(g, 'tape', Math.min(x, x - sx * arm), 0.004, z - t / 2, Math.max(x, x - sx * arm), 0.008, z + t / 2);
        boxMM(g, 'tape', x - t / 2, 0.004, Math.min(z - sz * t / 2, z - sz * arm), x + t / 2, 0.008, Math.max(z - sz * t / 2, z - sz * arm));
      }
    }
  };
  corners(SLOTS['wx-wpa'].x, SLOTS['wx-wpa'].z, 1.3, 1.5);
  corners(SLOTS['wp4-1212'].x, SLOTS['wp4-1212'].z, 2.9, 2.1);
  corners(SLOTS['wp4-u'].x, SLOTS['wp4-u'].z, 2.2, 2.2);
  corners(SLOTS['tpx-c'].x, SLOTS['tpx-c'].z, 1.4, 2.5, SLOTS['tpx-c'].rotY);
  corners(SLOTS.cx.x, SLOTS.cx.z, 2.9, 1.4);
  // Walkway edges from the opening into the hall.
  tape(OPEN_X0 + 0.25, -4.9, OPEN_X0 + 0.3, PART_Z - PART_T / 2 - 0.3);
  tape(OPEN_X1 - 0.3, -4.9, OPEN_X1 - 0.25, PART_Z - PART_T / 2 - 0.3);

  // Test weights by the platform scales.
  testBlock(ware, 24.25, -4.75, 0.1);
  testBlock(ware, 24.3, -4.4, -0.05);
  solid(rectOf(24.28, -4.58, 0.62, 0.72));
  for (const [x, z] of [
    [28.05, -4.6],
    [28.3, -4.55],
  ]) {
    knobWeight(ware, x, 0.004, z, 0.3, 'steel');
  }
  solid(rectOf(28.18, -4.58, 0.45, 0.22));

  // Staging lane at the dock door, against the east wall: loaded pallets (two cartons carry a
  // logo), empty stack. It keeps 2.5 m clear in front of the WP4-U's open end.
  const dock = { z: -3.4, w: 3.2, h: 3.6 };
  {
    const g = new THREE.Group();
    g.position.set(X1, 0, dock.z);
    g.rotation.y = -Math.PI / 2;
    ware.add(g);
    dockDoor(g, dock.w, dock.h);
    occlude({ minX: X1 - 0.4, maxX: X1, minZ: dock.z - dock.w / 2 - 0.1, maxZ: dock.z + dock.w / 2 + 0.1 }, dock.h + 0.5);
  }
  const staging: Array<[number, number]> = [
    [-4.2, 1.2],
    [-3.1, 0.95],
    [-2.0, 1.3],
  ];
  const stageX = 32.3;
  staging.forEach(([z, h], i) => {
    palletLoad(stageX, 0.004, z, 0, h, true);
    if (i !== 1) {
      // Logo on a carton of the west face (faces the weighing area).
      const layer = h / 3;
      ctx.logo({ diameter: 0.14, division: 'industriale', style: 'flat' }, { x: stageX - 0.588 - 0.002, y: 0.148 + layer * (i ? 2.5 : 1.5), z: z + (i ? 0.195 : -0.195), rotY: -Math.PI / 2 });
    }
  });
  solid({ minX: stageX - 0.62, maxX: stageX + 0.62, minZ: -4.62, maxZ: -1.58 });
  // Staging lane outline (the west edge; the dock wall closes it on the east).
  tape(stageX - 0.85, -4.85, stageX + 0.85, -4.8);
  tape(stageX - 0.85, -1.4, stageX + 0.85, -1.35);
  tape(stageX - 0.85, -4.85, stageX - 0.8, -1.35);
  // Empty pallets stacked in the corner.
  for (let i = 0; i < 8; i++) palletLoad(32.95, 0.004 + i * 0.145, -0.95, (rnd() - 0.5) * 0.04, 0, true);
  solid({ minX: 32.3, maxX: 33.6, minZ: -1.4, maxZ: -0.5 });

  // Warehouse walls: dado band, cable tray, electrical board.
  boxMM(ware, 'mid', X0, 0, Z0, 30.3, 1.2, Z0 + 0.012);
  boxMM(ware, 'dark', X0, 1.2, Z0, 30.3, 1.22, Z0 + 0.016);
  for (const [z0, z1] of [
    [-9.6, dock.z - dock.w / 2 - 0.45],
    [dock.z + dock.w / 2 + 0.1, PART_Z - PART_T / 2],
  ]) {
    boxMM(ware, 'mid', X1 - 0.012, 0, z0, X1, 1.2, z1);
    boxMM(ware, 'dark', X1 - 0.016, 1.2, z0, X1, 1.22, z1);
  }
  // Cable tray along the north wall with a few cable bundles.
  boxMM(ware, 'steel', X0, 3.4, Z0 + 0.02, X1, 3.42, Z0 + 0.26);
  boxMM(ware, 'steel', X0, 3.42, Z0 + 0.25, X1, 3.5, Z0 + 0.26);
  for (const [dz, r] of [
    [0.1, 0.018],
    [0.15, 0.014],
    [0.2, 0.02],
  ]) rod(ware, 'darker', [X0, 3.44, Z0 + dz], [X1, 3.44, Z0 + dz], r, 5);
  // Conduit drops to the roof (kept clear of the logo).
  for (const x of [11.65, 14.65, 17.65, 20.65, 23.65, 31.15]) rod(ware, 'darker', [x, 3.42, Z0 + 0.15], [x, ceiling - 0.5, Z0 + 0.15], 0.008, 4);
  // Distribution board on the east wall near the dock.
  boxMM(ware, 'light', X1 - 0.25, 1.1, -6.5, X1, 2.1, -5.7);
  boxMM(ware, 'seam', X1 - 0.254, 1.12, -6.105, X1 - 0.25, 2.08, -6.095);
  rod(ware, 'darker', [X1 - 0.12, 2.1, -6.1], [X1 - 0.12, ceiling - 0.5, -6.1], 0.03, 6);
  solid({ minX: X1 - 0.26, maxX: X1, minZ: -6.5, maxZ: -5.7 });

  // Quality-control corner: clean floor, wall cladding, workbench, cabinet, stool, instruments.
  {
    const qx0 = 30.35;
    const qz1 = -9.55;
    boxMM(ware, 'esd', qx0, 0, Z0, X1, 0.008, qz1);
    boxMM(ware, 'darker', qx0 - 0.04, 0, Z0, qx0, 0.0095, qz1 + 0.04);
    boxMM(ware, 'darker', qx0, 0, qz1, X1, 0.0095, qz1 + 0.04);
    // Cladding (light panels) with a fine line on top.
    boxMM(ware, 'tile', qx0, 0, Z0, X1, 2.8, Z0 + 0.015);
    boxMM(ware, 'tape', qx0, 2.8, Z0, X1, 2.84, Z0 + 0.019);
    boxMM(ware, 'tile', X1 - 0.015, 0, Z0, X1, 2.8, qz1);
    boxMM(ware, 'tape', X1 - 0.019, 2.8, Z0, X1, 2.84, qz1);
    for (let x = qx0 + 1.2; x < X1 - 0.1; x += 1.2) boxMM(ware, 'seam', x - 0.003, 0, Z0 + 0.015, x + 0.003, 2.8, Z0 + 0.018);
    for (let z = Z0 + 1.2; z < qz1; z += 1.2) boxMM(ware, 'seam', X1 - 0.018, 0, z - 0.003, X1 - 0.015, 2.8, z + 0.003);

    const benchZ = -13.1;
    const benchLen = 2.4;
    const wb = workbench(benchLen);
    wb.position.set(X1 - 0.015, 0, benchZ);
    wb.rotation.y = -Math.PI / 2;
    ware.add(wb);
    solid({ minX: X1 - 0.8, maxX: X1, minZ: benchZ - benchLen / 2, maxZ: benchZ + benchLen / 2 }, 'bench');
    // On the bench (bench-local: x along the bench, +z towards the room).
    const onBench = new THREE.Group();
    onBench.position.copy(wb.position);
    onBench.rotation.copy(wb.rotation);
    ware.add(onBench);
    const cs = weightCase();
    cs.position.set(-0.55, 0.904, 0.42);
    cs.rotation.y = 0.15;
    onBench.add(cs);
    for (const [x, h] of [
      [0.25, 0.26],
      [0.42, 0.26],
      [0.56, 0.2],
    ]) knobWeight(onBench, x, 0.904, 0.3, h, 'steel');
    // Monitor on a stand.
    box(onBench, 'darker', 0.22, 0.012, 0.14, -0.05, 0.9, 0.13);
    box(onBench, 'darker', 0.04, 0.26, 0.03, -0.05, 0.912, 0.11);
    const mon = new THREE.Group();
    mon.position.set(-0.05, 1.28, 0.15);
    mon.rotation.x = -0.08;
    onBench.add(mon);
    boxMM(mon, 'darker', -0.3, -0.18, -0.02, 0.3, 0.18, 0.02);
    boxMM(mon, 'screenOn', -0.285, -0.165, 0.02, 0.285, 0.165, 0.022).castShadow = false;
    box(onBench, 'darker', 0.44, 0.015, 0.14, -0.05, 0.904, 0.5);
    // Task lamp.
    const lx = 0.95;
    cyl(onBench, 'darker', 0.08, 0.02, lx, 0.9, 0.18, 12);
    rod(onBench, 'steelDark', [lx, 0.92, 0.18], [lx - 0.05, 1.35, 0.25], 0.012, 6);
    rod(onBench, 'steelDark', [lx - 0.05, 1.35, 0.25], [lx - 0.25, 1.42, 0.45], 0.012, 6);
    part(onBench, new THREE.CylinderGeometry(0.05, 0.09, 0.08, 12, 1, true), 'darker', lx - 0.27, 1.39, 0.47);
    part(onBench, new THREE.CircleGeometry(0.085, 12), 'lamp', lx - 0.27, 1.352, 0.47, Math.PI / 2, 0, 0).castShadow = false;
    // Cabinet in the corner and a stool.
    const cab = new THREE.Group();
    cab.position.set(X1 - 0.015, 0, Z0 + 0.6);
    cab.rotation.y = -Math.PI / 2;
    ware.add(cab);
    cabinet(cab, 1.0, 2.0, 0.5);
    solid({ minX: X1 - 0.52, maxX: X1, minZ: Z0, maxZ: Z0 + 1.1 }, 'cabinet');
    occlude({ minX: X1 - 0.52, maxX: X1, minZ: Z0, maxZ: Z0 + 1.1 }, 2.0);
    decal(decals, GLOW, 3.8, 6.2, 32.1, 0.01, -12.7);
  }

  // High-bay luminaires with light pools.
  const bays: Array<[number, number, number]> = [
    [12.6, -7.0, 0],
    [12.6, -12.6, 0],
    [17.5, -7.0, 0],
    [17.5, -12.6, 0],
    [24.6, -3.4, 1],
    [30.4, -3.4, 1],
    [24.6, -9.0, 1],
    [30.4, -9.0, 1],
    [SLOTS.cx.x, -13.4, 1],
  ];
  for (const [x, z, pool] of bays) {
    highBay(fixtures, x, 6.3, z, ceiling);
    if (pool) decal(decals, GLOW, 5.0, 5.0, x, 0.01, z);
    else decal(decals, GLOW, 2.2, 5.0, x, 0.01, z);
  }

  // Paintings and the division logo high on the north wall.
  ctx.logo({ diameter: 1.6, division: 'industriale', style: 'solid', depth: 0.1 }, { x: SLOTS.cx.x, y: 5.25, z: Z0 + 0.1 });
  ctx.painting({ w: 1.8, h: 1.2, division: 'industriale', seed: 41, composition: 'left' }, { x: 23.7, y: 2.3, z: Z0 + 0.002 });
  ctx.painting({ w: 1.3, h: 0.95, division: 'industriale', seed: 57, composition: 'right' }, { x: 31.7, y: 2.1, z: Z0 + 0.017 });

  // ================================================================== instanced stock

  const matMarket = cluster('products');
  const marketOnly: THREE.Object3D[] = [];
  stock.build((g, m, mats) => {
    const im = ctx.instanced(g, m, mats, false);
    marketOnly.push(im);
    return im;
  }, matMarket);
  const withTones = (im: THREE.InstancedMesh, tones: THREE.Color[]) => {
    tones.forEach((c, i) => im.setColorAt(i, c));
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  };
  if (cartons.length) withTones(ctx.instanced(cartonLoadGeometry(), cartonMat, cartons), cartonTone);
  if (singleCartons.length) {
    const g = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const im = ctx.instanced(g, cartonMat, singleCartons, false);
    withTones(im, singleTone);
    marketOnly.push(im);
  }
  if (palletsSimple.length) ctx.instanced(palletGeometry(false), cluster('racks'), palletsSimple);
  if (palletsDetail.length) ctx.instanced(palletGeometry(true), cluster('ware'), palletsDetail);
  if (fruit.length) {
    const g = tint(new THREE.SphereGeometry(1, 6, 4), 'prodBody');
    const im = ctx.instanced(g, matMarket, fruit.map((f) => f.m), false);
    marketOnly.push(im);
    withTones(
      im,
      fruit.map((f, i) => FRUIT_TONES[(f.key * 2 + (i % 2)) % FRUIT_TONES.length]),
    );
  }

  // ================================================================== bake statics

  const assign = (root: THREE.Object3D, mat: THREE.Material) =>
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.material === PAL) m.material = mat;
    });
  assign(market, cluster('market'));
  assign(ware, cluster('ware'));
  assign(racks, cluster('racks'));
  assign(fixtures, cluster('fixtures'));
  fixtures.traverse((o) => (o.castShadow = false));
  ctx.addStatic(market);
  ctx.addStatic(ware);
  ctx.addStatic(racks);
  ctx.addStatic(fixtures);
  ctx.addStatic(decals);

  if (trolleys) marketOnly.push(trolleys);
  portalCulling(ctx, inner, marketOnly);


  const out: Partial<Record<ScaleId, Slot>> = {};
  for (const [id, s] of Object.entries(SLOTS)) out[id as ScaleId] = s;
  return out;
}

/**
 * Portal culling across the 4.2 m partition (no occlusion culling in the engine):
 * - supermarket content (products, trolleys, the merged market furniture) sits below the
 *   partition, so from the warehouse it can only be seen through the 6 m opening;
 * - low warehouse content (scales, pedestals, paintings, carton logos: everything in the
 *   warehouse that stays under the partition top) can only be seen from the supermarket (or the
 *   lobby) through that same opening.
 * Each set is hidden while the camera is on the other side and the opening is outside the view
 * frustum. Saves ~100k triangles on warehouse views and ~130 draw calls on supermarket views.
 */
function portalCulling(ctx: WorldContext, inner: Rect, marketOnly: THREE.Object3D[]): void {
  const opening = new THREE.Box3(new THREE.Vector3(OPEN_X0, 0, PART_Z - PART_T), new THREE.Vector3(OPEN_X1, PART_H, PART_Z + PART_T));
  const frustum = new THREE.Frustum();
  const pv = new THREE.Matrix4();
  let camera: THREE.Camera | null = null;
  let market: THREE.Object3D[] | null = null;
  let low: THREE.Object3D[] | null = null;
  let lastMarket: boolean | null = null;
  let lastLow: boolean | null = null;
  let frames = 0;
  ctx.onUpdate(() => {
    // Leave everything visible for the first frames: the static shadow map is rendered then.
    if (frames++ < 5) return;
    camera ??= (ctx.scene.children.find((o) => (o as THREE.PerspectiveCamera).isPerspectiveCamera) as THREE.Camera | undefined) ?? null;
    if (!camera) return;
    if (!market) {
      // Merged statics exist once the world is baked.
      const names = ['static:industriale-market', 'static:industriale-market-floor', 'static:industriale-glow-soft'];
      market = [...marketOnly, ...ctx.statics.children.filter((o) => names.includes(o.name))];
    }
    if (!low) {
      // Everything dynamic (scales, pedestals, paintings, logos) standing in the warehouse below the partition top.
      low = [];
      const b = new THREE.Box3();
      for (const o of ctx.dynamic.children) {
        if ((o as THREE.InstancedMesh).isInstancedMesh || marketOnly.includes(o)) continue;
        b.setFromObject(o);
        if (b.isEmpty()) continue;
        if (b.min.x > inner.minX - 0.05 && b.max.x < inner.maxX + 0.05 && b.min.z > inner.minZ - 0.05 && b.max.z < PART_Z - PART_T / 2 && b.max.y < PART_H - 0.3) low.push(o);
      }
    }
    camera.updateMatrixWorld();
    const x = camera.position.x;
    const z = camera.position.z;
    let throughOpening: boolean | null = null;
    const seesOpening = () => {
      if (throughOpening === null) {
        pv.multiplyMatrices(camera!.projectionMatrix, camera!.matrixWorldInverse);
        frustum.setFromProjectionMatrix(pv);
        throughOpening = frustum.intersectsBox(opening);
      }
      return throughOpening;
    };
    // Only a camera inside the warehouse (by x too: the design gallery and the lobby's north end
    // have z < 0 as well, and see the market through the lobby) loses the market behind the
    // partition unless it looks through the opening.
    const inWarehouse = x > inner.minX - 0.15 && x < inner.maxX + 0.15 && z < PART_Z - PART_T / 2;
    const showMarket = !inWarehouse || seesOpening();
    const showLow = z < PART_Z + PART_T || seesOpening();
    if (showMarket !== lastMarket) {
      lastMarket = showMarket;
      for (const o of market) o.visible = showMarket;
    }
    if (showLow !== lastLow) {
      lastLow = showLow;
      for (const o of low) o.visible = showLow;
    }
  });
}

const zone: ZoneModule = {
  id: 'industriale',
  build({ ctx, shell }) {
    return { slots: buildIndustriale(ctx, shell.inner, shell.height) };
  },
};
export default zone;
