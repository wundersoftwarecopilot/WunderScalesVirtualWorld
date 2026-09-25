import * as THREE from 'three';
import type { Division } from '../../brand/urls';
import type { ScaleId } from '../../scales/specs';
import type { WorldContext } from '../context';
import type { PaintingOptions } from '../painting';
import type { Slot, ZoneModule } from '../zone';
import { DecalSet, FIX, PAL, bench, cyl, floorPlane, inlay, part, pictureLight, span, track, trackSpot, washerSlot } from './design-props';

/**
 * DESIGN gallery: an art museum room (x -9.85..9.85, z -15.85..-0.15, 5 m high), entered from
 * the lobby through the south wall (x -2.5..2.5).
 *
 * Reading order from the doorway (looking north):
 * - a polished dark mineral floor; the ten pieces stand on it as museum exhibits in two rows of
 *   five, 2.4 m apart, the rows 4 m apart (a compact collection, not specks on an empty floor):
 *   the low 960 row first, the R150 row behind it, so every dial is seen over the row in front.
 *   Same finish, same column: bianca, chrome, GOLD, glass, tarsie.
 * - the R150 Gold is the centre piece on the main axis: a larger inlay with a design-colour
 *   hairline, two spots instead of one, a brighter pool of light;
 * - behind it, the charcoal feature wall with the design logo high up, halo-lit (the R150 Gold,
 *   not the sign, owns the axis), and a design-colour line along its base; two tall paintings
 *   flank it.
 * - each piece stands on a flush 2.5 mm stone inlay with a stainless edge, under a soft pool of
 *   light from a spot on the suspended track in front of its row;
 * - two leather benches between the rows face the R150 row and the logo;
 * - side walls: gallery linings with shadow gaps, wall-washer slots under the ceiling, two
 *   paintings each with picture lights.
 * All scales face south (+Z): towards the doorway and the aisle in front of their row.
 */

const DOOR_HALF = 2.5; // layout.ts: to-design doorway, 5 m wide
const DOOR_TOP = 3.6; // building.ts lintel
const LT = 0.04; // wall lining thickness
const FEATURE_T = 0.08; // feature wall panel thickness
const GAP_LOW = 0.035; // floor shadow gap under the linings
const INLAY_TOP = 0.0028; // ≤ 3 mm: the pieces stand at y = 0, sunk in the inlay

const COLS = [-4.8, -2.4, 0, 2.4, 4.8];
const ROW_960 = -6.0;
const ROW_R150 = -10.0;
const TRACK_OFFSET = 1.6; // tracks hang this far south of their row
const TRACK_Y = 4.25;
const ORDER_960: ScaleId[] = ['960-bianca', '960-chrome', '960-gold', '960-glass', '960-tarsie'];
const ORDER_R150: ScaleId[] = ['r150-bianca', 'r150-chrome', 'r150-gold', 'r150-glass', 'r150-tarsie'];

interface Hang {
  wall: 'west' | 'east' | 'north';
  /** Position along the wall (z for side walls, x for the north wall). */
  at: number;
  w: number;
  h: number;
  division: Division;
  seed: number;
  composition: PaintingOptions['composition'];
  frame: 'dark' | 'light';
  /** Centre height when it departs from the common hang line (tall pieces). */
  y?: number;
}

const HANG_Y = 1.8; // common centre line for the hang

const PAINTINGS: Hang[] = [
  { wall: 'west', at: ROW_R150, w: 2.4, h: 1.6, division: 'design', seed: 11, composition: 'left', frame: 'dark' },
  { wall: 'west', at: ROW_960, w: 1.3, h: 1.75, division: 'corporate', seed: 23, composition: 'high', frame: 'light' },
  { wall: 'east', at: ROW_R150, w: 1.8, h: 1.8, division: 'design', seed: 37, composition: 'center', frame: 'light' },
  { wall: 'east', at: ROW_960, w: 2.2, h: 1.4, division: 'design', seed: 41, composition: 'right', frame: 'dark' },
  { wall: 'north', at: -6.6, w: 1.7, h: 2.3, division: 'corporate', seed: 53, composition: 'low', frame: 'dark', y: 1.95 },
  { wall: 'north', at: 6.6, w: 1.7, h: 2.3, division: 'design', seed: 67, composition: 'high', frame: 'dark', y: 1.95 },
];

function build(ctx: WorldContext, inner: { minX: number; maxX: number; minZ: number; maxZ: number }, H: number): Partial<Record<ScaleId, Slot>> {
  const S = new THREE.Group(); // static parts in world coordinates (PAL casts, FIX does not)
  const glow = new DecalSet('glow');
  const shade = new DecalSet('shade');
  const X0 = inner.minX;
  const X1 = inner.maxX;
  const Z0 = inner.minZ;
  const Z1 = inner.maxZ;
  const top = H - 0.015; // linings stop short of the ceiling: a dark shadow gap above them

  // ================================================================== floor
  ctx.addStatic(floorPlane(X0, Z0, X1, Z1));
  // Brushed steel threshold in the doorway, flush with the gallery floor.
  span(S, 'steelSatin', -DOOR_HALF, -0.02, Z1, DOOR_HALF, 0.002, 0);

  // ================================================================== walls: gallery linings
  const wx = X0 + LT; // west lining face
  const ex = X1 - LT; // east lining face
  const nz = Z0 + LT; // north lining face
  const sz = Z1 - LT; // south lining face
  const fz = Z0 + FEATURE_T; // feature panel face
  const FW = 3.3; // feature panel half width
  const J = 0.012; // joint width

  /** Dark recess behind a lining: floor gap, top gap and any joints read as real shadow lines. */
  const recessX = (z0: number, z1: number, x: number, sgn: number) => {
    // along a side wall at wall line x (sgn = +1 lining grows towards +x)
    span(S, 'gap', x, 0, z0, x + sgn * (LT - 0.015), GAP_LOW, z1);
    span(S, 'gap', x, top, z0, x + sgn * (LT - 0.015), H, z1);
  };
  const recessZ = (x0: number, x1: number, z: number, sgn: number, depth = LT) => {
    span(S, 'gap', x0, 0, z, x1, GAP_LOW, z + sgn * (depth - 0.015));
    span(S, 'gap', x0, top, z, x1, H, z + sgn * (depth - 0.015));
  };

  // West and east: one seamless lining each, stopping short of the corners (dark corner joints).
  span(S, 'lining', X0, GAP_LOW, nz + J, wx, top, sz - J);
  span(S, 'lining', ex, GAP_LOW, nz + J, X1, top, sz - J);
  recessX(Z0, Z1, X0, 1);
  recessX(Z0, Z1, X1, -1);
  for (const [x, s] of [
    [X0, 1],
    [X1, -1],
  ] as const) {
    for (const z of [nz, sz - J]) span(S, 'gap', x, 0, z, x + s * (LT - 0.015), H, z + J);
  }

  // North: linings either side of the charcoal feature panel.
  span(S, 'lining', X0, GAP_LOW, Z0, -FW - J, top, nz);
  span(S, 'lining', FW + J, GAP_LOW, Z0, X1, top, nz);
  recessZ(X0, X1, Z0, 1);
  for (const x of [-FW - J, FW]) span(S, 'gap', x, 0, Z0, x + J, H, nz - 0.015);
  // Feature panel: a design-colour line along its base, charcoal above, the big logo on it.
  span(S, 'teal', -FW, GAP_LOW, Z0, FW, GAP_LOW + 0.022, fz);
  span(S, 'charcoal', -FW, GAP_LOW + 0.022, Z0, FW, top, fz);

  // South: linings either side of the doorway and above it, a dark steel casing round the opening.
  const CW = 0.11; // casing width
  const CT = 0.06; // casing projection from the wall
  span(S, 'lining', X0, GAP_LOW, sz, -DOOR_HALF - CW, top, Z1);
  span(S, 'lining', DOOR_HALF + CW, GAP_LOW, sz, X1, top, Z1);
  span(S, 'lining', -DOOR_HALF - CW, DOOR_TOP + CW, sz, DOOR_HALF + CW, top, Z1);
  recessZ(X0, -DOOR_HALF - CW, Z1, -1);
  recessZ(DOOR_HALF + CW, X1, Z1, -1);
  span(S, 'gap', -DOOR_HALF - CW, top, Z1, DOOR_HALF + CW, H, sz + 0.015);
  for (const s of [-1, 1]) {
    span(S, 'steelDark', s * DOOR_HALF, 0, Z1 - CT, s * (DOOR_HALF + CW), DOOR_TOP, Z1, PAL);
  }
  span(S, 'steelDark', -DOOR_HALF - CW, DOOR_TOP, Z1 - CT, DOOR_HALF + CW, DOOR_TOP + CW, Z1, PAL);

  // ================================================================== light: wall washers
  const slotOff = 0.35;
  washerSlot(S, 'z', nz + 0.5, sz - 0.5, wx + slotOff, H);
  washerSlot(S, 'z', nz + 0.5, sz - 0.5, ex - slotOff, H);
  washerSlot(S, 'x', X0 + 0.5, X1 - 0.5, nz + slotOff, H);
  washerSlot(S, 'x', X0 + 0.5, X1 - 0.5, sz - slotOff, H);
  // Their wash on the walls: bright under the ceiling, fading by about 2.5 m.
  const washH = 2.7;
  const washY = top - washH / 2;
  const WASH = 0.07;
  const eps = 0.0015;
  glow.wall(wx + eps, washY, (nz + sz) / 2, 1, 0, sz - nz - 0.1, washH, WASH, 'wash');
  glow.wall(ex - eps, washY, (nz + sz) / 2, -1, 0, sz - nz - 0.1, washH, WASH, 'wash');
  glow.wall((X0 - FW - J) / 2, washY, nz + eps, 0, 1, -FW - J - X0 - 0.05, washH, WASH, 'wash');
  glow.wall((X1 + FW + J) / 2, washY, nz + eps, 0, 1, X1 - FW - J - 0.05, washH, WASH, 'wash');
  glow.wall(0, washY, fz + eps, 0, 1, 2 * FW, washH, WASH * 0.7, 'wash');
  const sw = X1 - (DOOR_HALF + CW);
  glow.wall(-(DOOR_HALF + CW) - sw / 2, washY, sz - eps, 0, -1, sw - 0.05, washH, WASH, 'wash');
  glow.wall(DOOR_HALF + CW + sw / 2, washY, sz - eps, 0, -1, sw - 0.05, washH, WASH, 'wash');
  // Over the door only the part of the wash above the casing.
  const v0 = (DOOR_TOP + CW - (washY - washH / 2)) / washH;
  const hTop = top - (DOOR_TOP + CW);
  glow.wall(0, DOOR_TOP + CW + hTop / 2, sz - eps, 0, -1, 2 * (DOOR_HALF + CW), hTop, WASH, 'wash', v0, 1);

  // ================================================================== feature wall: the logo
  // High on the wall, clear above the R150 Gold on the axis: the piece, not the sign, is the hero.
  // The solid logo's division tag is a bar as deep as the disc, mounted on the wall like it.
  const LOGO_D = 1.4;
  const LOGO_Y = 3.4;
  const LOGO_DEPTH = 0.1;
  ctx.logo({ diameter: LOGO_D, division: 'design', style: 'solid', depth: LOGO_DEPTH }, { x: 0, y: LOGO_Y, z: fz + LOGO_DEPTH });
  glow.wall(0, LOGO_Y, fz + eps, 0, 1, LOGO_D * 1.9, LOGO_D * 1.9, 0.22);
  glow.wall(0, LOGO_Y, fz + eps * 2, 0, 1, LOGO_D * 1.2, LOGO_D * 1.2, 0.12);
  // Above the way out, on the lining over the casing: the corporate mark (back to the company).
  const exitY = (DOOR_TOP + CW + top) / 2 + 0.02;
  ctx.logo({ diameter: 0.74, style: 'solid', depth: 0.05 }, { x: 0, y: exitY, z: sz - 0.05, rotY: Math.PI });
  glow.wall(0, exitY, sz - eps, 0, -1, 1.5, 1.5, 0.14);

  // ================================================================== paintings and picture lights
  for (const p of PAINTINGS) {
    const cy = p.y ?? HANG_Y;
    let x: number;
    let z: number;
    let rotY: number;
    let n: [number, number];
    if (p.wall === 'west') {
      x = wx;
      z = p.at;
      rotY = Math.PI / 2;
      n = [1, 0];
    } else if (p.wall === 'east') {
      x = ex;
      z = p.at;
      rotY = -Math.PI / 2;
      n = [-1, 0];
    } else {
      x = p.at;
      z = nz;
      rotY = 0;
      n = [0, 1];
    }
    ctx.painting({ w: p.w, h: p.h, division: p.division, seed: p.seed, composition: p.composition, frame: p.frame }, { x, y: cy, z, rotY });
    // Picture light above the frame.
    const frameTop = cy + p.h / 2 + 0.05;
    const lampY = frameTop + 0.2;
    const lamp = pictureLight(Math.max(0.6, p.w * 0.62));
    lamp.position.set(x, lampY, z);
    lamp.rotation.y = rotY;
    S.add(lamp);
    // Its light: a soft glow on the wall round the top of the frame and a wash down the canvas.
    glow.wall(x + n[0] * eps, frameTop - 0.05, z + n[1] * eps, n[0], n[1], p.w + 1.1, 1.7, 0.2);
    glow.wall(x + n[0] * 0.0465, cy, z + n[1] * 0.0465, n[0], n[1], p.w, p.h, 0.1, 'wash');
  }

  // ================================================================== exhibits
  const slots: Partial<Record<ScaleId, Slot>> = {};
  const rows: Array<{ ids: ScaleId[]; z: number; aimY: number }> = [
    { ids: ORDER_960, z: ROW_960, aimY: 0.1 },
    { ids: ORDER_R150, z: ROW_R150, aimY: 0.55 },
  ];
  for (const row of rows) {
    const tz = row.z + TRACK_OFFSET;
    track(S, COLS[0] - 0.8, COLS[4] + 0.8, TRACK_Y, tz, H, [COLS[0] - 0.4, (COLS[1] + COLS[2]) / 2, (COLS[2] + COLS[3]) / 2, COLS[4] + 0.4]);
    row.ids.forEach((id, i) => {
      const x = COLS[i];
      const hero = id === 'r150-gold';
      slots[id] = { x, z: row.z, rotY: 0 };
      if (hero) inlay(S, x, row.z, 1.12, INLAY_TOP, 'stoneLight', 'teal');
      else inlay(S, x, row.z, 0.72, INLAY_TOP);
      // Contact shadow under the base, pool of light round it.
      shade.floor(x, 0.0038, row.z, 0.52, 0.66, 0.5);
      if (hero) {
        glow.floor(x, 0.0046, row.z + 0.15, 2.4, 2.7, 0.13);
        glow.floor(x, 0.0054, row.z + 0.1, 1.1, 1.3, 0.07);
      } else {
        glow.floor(x, 0.0046, row.z + 0.12, 1.6, 1.9, 0.11);
      }
      const aim = new THREE.Vector3(x, row.aimY, row.z);
      const spots = hero ? [x - 0.42, x + 0.42] : [x];
      for (const sx of spots) S.add(trackSpot(new THREE.Vector3(sx, TRACK_Y, tz), aim));
    });
  }

  // ================================================================== benches
  for (const x of [-COLS[3], COLS[3]]) {
    const b = bench();
    b.position.set(x, 0, (ROW_960 + ROW_R150) / 2);
    S.add(b);
    ctx.addSolid(b, 0.02);
    shade.floor(x, 0.0032, b.position.z, 2.15, 0.8, 0.32);
  }

  // ================================================================== small details
  // Security camera domes in the two far corners, looking back at the room.
  for (const s of [-1, 1]) {
    const x = s * (X1 - 0.45);
    const z = Z0 + 0.45;
    cyl(S, 'canopy', 0.075, 0.075, 0.02, 20, x, H - 0.01, z, FIX);
    const dome = part(S, new THREE.SphereGeometry(0.06, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 'black', x, H - 0.02, z, FIX);
    dome.castShadow = false;
  }
  // Bake: static parts (batched per material), decals (own meshes, ordered: shade, then glow).
  ctx.addStatic(S);
  const shadeMesh = shade.build(1);
  const glowMesh = glow.build(2);
  if (shadeMesh) ctx.addDynamic(shadeMesh);
  if (glowMesh) ctx.addDynamic(glowMesh);
  return slots;
}

const zone: ZoneModule = {
  id: 'design',
  build({ ctx, shell }) {
    return { slots: build(ctx, shell.inner, shell.height) };
  },
};
export default zone;
