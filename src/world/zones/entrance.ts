import * as THREE from 'three';
import type { Division } from '../../brand/urls';
import { localRectToWorld } from '../../core/rect';
import type { WorldContext } from '../context';
import { OPENINGS, PLAZA, WALL } from '../layout';
import type { ZoneModule } from '../zone';
import {
  WASH,
  accentOf,
  armchair,
  blk,
  bollard,
  coffeeTable,
  credenza,
  cyl,
  floorStrip,
  glowMaterial,
  hedge,
  lampPost,
  lightPool,
  linearPendant,
  livingWall,
  lobbyBench,
  part,
  pictureLight,
  planter,
  planterBox,
  plaque,
  plazaBench,
  radialTexture,
  receptionDesk,
  ringPendant,
  sofa,
  taskChair,
  topiary,
  treeBed,
  vase,
  type Foot,
  type PlanterKind,
} from './entrance-props';

/** Collider from a prop's base footprint (userData.foot), not its overhanging crown. */
function footCollider(ctx: WorldContext, obj: THREE.Object3D, pad = 0): void {
  const f = obj.userData.foot as Foot | undefined;
  if (!f) {
    ctx.addSolid(obj, pad);
    return;
  }
  ctx.addCollider(localRectToWorld({ x: 0, z: 0, w: f.w + 2 * pad, d: f.d + 2 * pad }, obj.position.x, obj.position.z, obj.rotation.y));
}

/**
 * ENTRANCE: the lobby / reception (x -9.85..9.85, z 0.15..15.85, 6 m high) and the plaza outside.
 *
 * Reading order for a visitor coming in from the plaza (looking north):
 * - the floor logo inlaid in a light stone disc just past the entrance mat;
 * - straight ahead the design gallery portal: a dark fascia to the ceiling carrying the big
 *   corporate logo with a soft halo (the "company logo at the entrance");
 * - left: the reception desk (clickable logo on its front) against a slatted feature wall;
 * - right: the waiting lounge under a ring pendant, a design painting above the sofa and a
 *   vertical garden on the east wall;
 * - left and right walls: the medicale and industriale portals (dark casing, division stripe in
 *   the reveal, a division logo on a plaque above); the gallery portal has no plaque;
 * - light stone bands in the floor lead to the three portals.
 * - by the glass: big trees, cypresses and two more seating corners under the medicale and
 *   industriale paintings (each canvas is signed with a small logo in a corner).
 * Plaza: a paved walk to the door, lit bollards, planters, tree beds (seats), benches, lamp posts.
 * Everything static shares one palette material (see entrance-props.ts). No scales: slots = {}.
 */

const SIDE_DOOR_TOP = OPENINGS.find((o) => o.id === 'to-medicale')!.top; // side doorways (layout.ts)
const DESIGN_DOOR_TOP = OPENINGS.find((o) => o.id === 'to-design')!.top; // design gallery doorway
const HALO = glowMaterial(radialTexture, 0.5, 'entrance-halo');

const byId = (id: string) => OPENINGS.find((o) => o.id === id)!;

function build(ctx: WorldContext, inner: { minX: number; maxX: number; minZ: number; maxZ: number }, height: number): void {
  const S = new THREE.Group(); // static palette parts, world coordinates
  const X0 = inner.minX;
  const X1 = inner.maxX;
  const Z0 = inner.minZ;
  const Z1 = inner.maxZ;
  const CEIL = height;

  /** Put a prop in the world (static), optionally solid. */
  const place = (obj: THREE.Object3D, x: number, z: number, rotY = 0, solid = true, pad = -0.03, y = 0): THREE.Object3D => {
    obj.position.set(x, y, z);
    obj.rotation.y = rotY;
    S.add(obj);
    if (solid) ctx.addSolid(obj, pad);
    return obj;
  };
  const planterAt = (kind: PlanterKind, seed: number, x: number, z: number, scale = 1, tall = false) => {
    const p = place(planter(kind, seed, scale), x, z, seed * 0.7, false);
    footCollider(ctx, p);
    if (tall) {
      // Only the dense core of the crown hides logos behind it.
      p.updateWorldMatrix(true, true);
      const b = new THREE.Box3().setFromObject(p);
      const c = b.getCenter(new THREE.Vector3());
      const sz = b.getSize(new THREE.Vector3());
      c.y = b.max.y - sz.y * 0.22;
      ctx.addOccluder(new THREE.Box3().setFromCenterAndSize(c, new THREE.Vector3(sz.x * 0.55, sz.y * 0.25, sz.z * 0.55)));
    }
  };

  const med = byId('to-medicale');
  const ind = byId('to-industriale');
  const des = byId('to-design');
  const front = byId('front');

  // ================================================================== floor
  // Large-format tiles: thin joints on a 1.2 m grid, aligned to the centre line and the facade.
  for (let x = -9.6; x <= 9.61; x += 1.2) floorStrip(S, 'joint', x - 0.006, Z0, x + 0.006, Z1, 0.0015, 0.0015);
  for (let k = 1; k <= 12; k++) {
    const z = Z1 - 1.2 * k;
    floorStrip(S, 'joint', X0, z - 0.006, X1, z + 0.006, 0.0015, 0.0015);
  }
  // Light stone bands leading to the three portals, with dark border lines.
  const band = 1.2;
  const matZ = 14.35;
  const ewZ0 = med.z - band;
  const ewZ1 = med.z + band;
  floorStrip(S, 'stoneLight', -band, Z0, band, matZ - 0.05, 0.003);
  floorStrip(S, 'stoneLight', X0, ewZ0, -band, ewZ1, 0.003);
  floorStrip(S, 'stoneLight', band, ewZ0, X1, ewZ1, 0.003);
  const line = 0.025;
  for (const sx of [-1, 1]) {
    floorStrip(S, 'dark', sx * band - line / 2, Z0, sx * band + line / 2, ewZ0, 0.0045, 0.0015);
    floorStrip(S, 'dark', sx * band - line / 2, ewZ1, sx * band + line / 2, matZ - 0.05, 0.0045, 0.0015);
    const xa = sx < 0 ? X0 : band;
    const xb = sx < 0 ? -band : X1;
    floorStrip(S, 'dark', xa, ewZ0 - line / 2, xb, ewZ0 + line / 2, 0.0045, 0.0015);
    floorStrip(S, 'dark', xa, ewZ1 - line / 2, xb, ewZ1 + line / 2, 0.0045, 0.0015);
  }
  floorStrip(S, 'dark', -band, matZ - 0.05 - line, band, matZ - 0.05, 0.0045, 0.0015);

  // Floor logo inlaid just inside the entrance: polished disc in a steel ring.
  const inlayZ = 12.85;
  const ringDisc = cyl(S, 'steel', 0.86, 0.86, 0.0015, 48, 0, 0.003, inlayZ);
  ringDisc.castShadow = false;
  const disc = cyl(S, 'inlay', 0.82, 0.82, 0.0015, 48, 0, 0.0045, inlayZ);
  disc.castShadow = false;
  ctx.logo({ diameter: 1.2, style: 'flat' }, { x: 0, y: 0.0075, z: inlayZ, rotX: -Math.PI / 2 });

  // Entrance mat: dark ribbed barrier mat in a steel frame, flush with the floor.
  const matX = 2.1;
  floorStrip(S, 'felt', -matX, matZ, matX, Z1 - 0.03, 0.006, 0.006);
  for (let z = matZ + 0.06; z < Z1 - 0.06; z += 0.07) floorStrip(S, 'rubber', -matX + 0.05, z - 0.012, matX - 0.05, z + 0.012, 0.0075, 0.0015);
  floorStrip(S, 'steel', -matX - 0.03, matZ - 0.03, matX + 0.03, matZ, 0.0065, 0.0065);
  for (const sx of [-1, 1]) floorStrip(S, 'steel', sx * matX, matZ, sx * (matX + 0.03), Z1 - 0.03, 0.0065, 0.0065);

  // ================================================================== portals
  const casing = 0.12;
  const proud = 0.03;
  const reveal = 0.04;

  /** Side doorway on the west (sx=-1) or east (sx=+1) wall. */
  const sidePortal = (sx: -1 | 1, division: Division, z0: number, z1: number) => {
    const face = sx < 0 ? X0 : X1; // lobby-side wall surface
    const wallMid = sx * 10; // centre of the wall thickness
    const out = -sx; // direction into the lobby
    const cx = face + (out * proud) / 2;
    // Casing, dark, 3 cm proud of the wall: the jambs rise to the ceiling as slim pilasters
    // (like the design portal's fascia), framing the plaque above the doorway.
    blk(S, 'dark', proud, CEIL - 0.005, casing, cx, 0, z0 - casing / 2);
    blk(S, 'dark', proud, CEIL - 0.005, casing, cx, 0, z1 + casing / 2);
    blk(S, 'dark', proud, casing, z1 - z0 + 2 * casing, cx, SIDE_DOOR_TOP, (z0 + z1) / 2);
    // Division stripe in the middle of the reveal (both jambs and the soffit).
    const acc = accentOf(division);
    blk(S, acc, reveal, SIDE_DOOR_TOP - 0.006, 0.004, wallMid, 0.006, z0 + 0.002);
    blk(S, acc, reveal, SIDE_DOOR_TOP - 0.006, 0.004, wallMid, 0.006, z1 - 0.002);
    blk(S, acc, reveal, 0.004, z1 - z0, wallMid, SIDE_DOOR_TOP - 0.004, (z0 + z1) / 2);
    // Threshold plate with a thin division line.
    const plate = floorStrip(S, 'steelDark', wallMid - WALL / 2, z0, wallMid + WALL / 2, z1, 0.005, 0.005);
    plate.castShadow = false;
    floorStrip(S, acc, wallMid - 0.015, z0 + 0.02, wallMid + 0.015, z1 - 0.02, 0.0065, 0.0015);
    // Plaque with the division logo above the doorway, facing into the lobby.
    const rotY = (out * Math.PI) / 2;
    const pq = plaque(0.86, 1.06);
    const py = 4.15;
    pq.group.position.set(face, py, (z0 + z1) / 2);
    pq.group.rotation.y = rotY;
    S.add(pq.group);
    const d = 0.62;
    ctx.logo({ diameter: d, division, style: 'flat' }, { x: face + out * (pq.front + 0.003), y: py + 0.21 * (d / 2), z: (z0 + z1) / 2, rotY });
  };
  sidePortal(-1, 'medicale', med.z - med.width / 2, med.z + med.width / 2);
  sidePortal(1, 'industriale', ind.z - ind.width / 2, ind.z + ind.width / 2);

  // Design gallery portal (north wall): dark casing that rises into a fascia up to the ceiling.
  {
    const x0 = des.x - des.width / 2;
    const x1 = des.x + des.width / 2;
    const cz = Z0 + proud / 2;
    blk(S, 'dark', casing, DESIGN_DOOR_TOP, proud, x0 - casing / 2, 0, cz);
    blk(S, 'dark', casing, DESIGN_DOOR_TOP, proud, x1 + casing / 2, 0, cz);
    blk(S, 'dark', x1 - x0 + 2 * casing, CEIL - DESIGN_DOOR_TOP - 0.005, proud, des.x, DESIGN_DOOR_TOP, cz);
    // Shadow gap line where the fascia meets the doorway head.
    blk(S, 'black', x1 - x0, 0.012, 0.004, des.x, DESIGN_DOOR_TOP + 0.02, Z0 + proud + 0.002);
    const acc = accentOf('design');
    blk(S, acc, 0.004, DESIGN_DOOR_TOP - 0.006, reveal, x0 + 0.002, 0.006, 0);
    blk(S, acc, 0.004, DESIGN_DOOR_TOP - 0.006, reveal, x1 - 0.002, 0.006, 0);
    blk(S, acc, x1 - x0, 0.004, reveal, des.x, DESIGN_DOOR_TOP - 0.004, 0);
    const plate = floorStrip(S, 'steelDark', x0, -WALL / 2, x1, WALL / 2, 0.005, 0.005);
    plate.castShadow = false;
    floorStrip(S, acc, x0 + 0.02, -0.015, x1 - 0.02, 0.015, 0.0065, 0.0015);

    // The company logo at the entrance: big, solid, standing 5 mm off the fascia with a halo.
    const ly = 4.8;
    const fz = Z0 + proud;
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 2.9), HALO);
    halo.position.set(des.x, ly, fz + 0.001);
    S.add(halo);
    ctx.logo({ diameter: 1.6, style: 'solid', depth: 0.1 }, { x: des.x, y: ly, z: fz + 0.105 });
    // No division plaque here: the fascia's company logo and the teal reveal already mark the
    // gallery (one mark per wall keeps the lobby from reading as wallpaper branding).
  }

  // Skirting where the walls meet the floor (not behind the slat wall, not across doorways).
  const skirt = (x0: number, z0: number, x1: number, z1: number) => blk(S, 'dark', Math.max(0.012, x1 - x0), 0.08, Math.max(0.012, z1 - z0), (x0 + x1) / 2, 0, (z0 + z1) / 2);
  const medZ0 = med.z - med.width / 2 - casing;
  const medZ1 = med.z + med.width / 2 + casing;
  skirt(X0, Z0, X0 + 0.012, medZ0);
  skirt(X0, medZ1, X0 + 0.012, Z1);
  skirt(X1 - 0.012, Z0, X1, medZ0);
  skirt(X1 - 0.012, medZ1, X1, Z1);
  skirt(des.x + des.width / 2 + casing, Z0, X1, Z0 + 0.012);
  skirt(X0, Z1 - 0.012, -7.04, Z1);
  skirt(7.04, Z1 - 0.012, X1, Z1);

  // ================================================================== reception (north-west)
  // Slatted feature wall floor-to-ceiling on dark felt, grazed by a cove light.
  const slatX0 = X0;
  const slatX1 = des.x - des.width / 2 - casing;
  blk(S, 'felt', slatX1 - slatX0, CEIL - 0.005, 0.012, (slatX0 + slatX1) / 2, 0, Z0 + 0.006);
  for (let x = slatX0 + 0.07; x < slatX1 - 0.05; x += 0.1) blk(S, 'slat', 0.045, CEIL - 0.01, 0.035, x, 0, Z0 + 0.012 + 0.0175);
  // Cove: a dark valance hides a light line at the ceiling that grazes the slats.
  const slatCx = (slatX0 + slatX1) / 2;
  blk(S, 'lamp', slatX1 - slatX0, 0.015, 0.03, slatCx, CEIL - 0.03, Z0 + 0.07);
  blk(S, 'dark', slatX1 - slatX0, 0.2, 0.03, slatCx, CEIL - 0.2, Z0 + 0.12);
  const slatWash = new THREE.Mesh(new THREE.PlaneGeometry(slatX1 - slatX0, 3.4), WASH);
  slatWash.position.set(slatCx, CEIL - 0.2 - 1.7, Z0 + 0.049);
  S.add(slatWash);

  // The desk faces the entrance; its front carries the clickable corporate logo.
  const deskX = -5.6;
  const deskZ = 4.1;
  const desk = receptionDesk(4.6);
  place(desk.group, deskX, deskZ, 0, false);
  ctx.addCollider({ minX: deskX - 2.35, maxX: deskX + 2.35, minZ: deskZ - 0.84, maxZ: deskZ + 0.36 }, 'desk');
  ctx.logo({ diameter: 0.46, style: 'flat' }, { x: deskX, y: 0.6, z: deskZ + desk.front + 0.004 });
  for (const x of [deskX - 0.95, deskX + 0.85]) place(taskChair(), x, deskZ - 1.28, 0.12 * Math.sign(x - deskX), true, -0.04);
  // Pendant over the desk and its pool of light on the floor in front.
  const lp = linearPendant(3.8, CEIL - 3.05 - 0.05);
  lp.position.set(deskX, 3.05, deskZ - 0.1);
  S.add(lp);
  S.add(lightPool(6.0, 2.6, deskX, 0.0045, deskZ + 1.1));
  // Sideboard against the slat wall with plants and a small sculpture.
  const credZ = Z0 + 0.047 + 0.225 + 0.01;
  place(credenza(4.6), deskX - 0.6, credZ, 0);
  const onCred = 0.73;
  {
    const g = planter('grass', 41, 0.55);
    g.position.set(deskX - 2.4, onCred, credZ);
    S.add(g);
    const pot = new THREE.Group();
    blk(pot, 'white', 0.26, 0.26, 0.26, 0, 0, 0);
    blk(pot, 'soil', 0.22, 0.006, 0.22, 0, 0.25, 0);
    topiary(pot, 9, 0.255, 0.17, 0.06);
    pot.position.set(deskX + 1.2, onCred, credZ);
    S.add(pot);
    // Sculpture: steel sphere on a stone cube.
    blk(S, 'stone', 0.16, 0.16, 0.16, deskX - 0.6, onCred, credZ);
    part(S, new THREE.SphereGeometry(0.09, 16, 12), 'steel', deskX - 0.6, onCred + 0.16 + 0.085, credZ);
  }
  planterAt('tree', 3, -3.4, 1.3, 1.05, true);

  // ================================================================== waiting lounge (north-east)
  const lx = 6.6;
  const rugZ0 = 0.85;
  const rugZ1 = 4.5;
  floorStrip(S, 'rug', 4.2, rugZ0, 9.0, rugZ1, 0.012, 0.012);
  // Inset border line woven into the rug.
  for (const [a, b, c, d] of [
    [4.32, rugZ0 + 0.12, 8.88, rugZ0 + 0.145],
    [4.32, rugZ1 - 0.145, 8.88, rugZ1 - 0.12],
    [4.32, rugZ0 + 0.12, 4.345, rugZ1 - 0.12],
    [8.855, rugZ0 + 0.12, 8.88, rugZ1 - 0.12],
  ]) floorStrip(S, 'mid', a, b, c, d, 0.0135, 0.0015);
  place(armchair(), 4.75, 2.95, Math.PI / 2, true, -0.03, 0.012);
  place(armchair(), 8.45, 2.95, -Math.PI / 2, true, -0.03, 0.012);
  // The sofa's back feet stand on the floor, its front feet sink into the rug pile.
  place(sofa(3), lx, 1.12, 0);
  place(coffeeTable(0.5, 0.4, 3), lx, 2.85, 0.4, true, -0.05, 0.012);
  // Side table at the sofa's east end.
  {
    const t = coffeeTable(0.22, 0.52, 4, false);
    place(t, 8.35, 1.1, 0, true, 0, 0.012);
    vase(S, 8.35, 0.532, 1.1);
  }
  const ring = ringPendant(0.78, CEIL - 3.45);
  ring.position.set(lx, 3.45, 2.85);
  S.add(ring);
  S.add(lightPool(4.6, 4.6, lx, 0.015, 2.85));
  planterAt('cypress', 17, 9.35, 0.68, 1.2);
  // Vertical garden on the east wall beside the lounge.
  {
    const w = 3.7;
    const zc = 3.35;
    const lw = livingWall(w, 3.1, 7);
    lw.position.set(X1, 0.75, zc);
    lw.rotation.y = -Math.PI / 2;
    S.add(lw);
    ctx.addCollider({ minX: X1 - 0.3, maxX: X1, minZ: zc - w / 2 - 0.06, maxZ: zc + w / 2 + 0.06 });
  }
  planterAt('bowl', 5, 3.55, 1.05);

  // ================================================================== south corners (by the glass)
  // West: a long bench under the medicale painting.
  place(lobbyBench(2.2), X0 + 0.42, 12.9, Math.PI / 2);
  planterAt('ball', 13, X0 + 0.42, 11.2);
  planterAt('cypress', 19, X0 + 0.45, Z1 - 0.45, 1.15, true);
  // East: two armchairs angled towards each other with a side table, under the industriale painting.
  place(armchair(), X1 - 0.7, 11.95, -Math.PI / 2 + 0.35);
  place(armchair(), X1 - 0.7, 13.85, -Math.PI / 2 - 0.35);
  place(coffeeTable(0.24, 0.5, 8, false), X1 - 0.5, 12.9, 0.2);
  vase(S, X1 - 0.5, 0.5, 12.9, 0.85);
  planterAt('grass', 23, X1 - 0.62, 10.85);
  planterAt('cypress', 29, X1 - 0.45, Z1 - 0.45, 1.15, true);
  // Big trees behind the glass either side of the entrance, and ball topiaries flanking the door.
  planterAt('tree', 31, -6.3, 14.55, 1.35, true);
  planterAt('tree', 37, 6.3, 14.55, 1.35, true);
  planterAt('ball', 43, -front.width / 2 - 1.05, 15.3, 0.95);
  planterAt('ball', 47, front.width / 2 + 1.05, 15.3, 0.95);

  // ================================================================== paintings
  const hang = 0.002;
  const lightAbove = (x: number, y: number, z: number, rotY: number, len: number) => {
    const l = pictureLight(len);
    l.position.set(x, y, z);
    l.rotation.y = rotY;
    S.add(l);
  };
  // A — design, above the sofa.
  ctx.painting({ w: 3.0, h: 1.7, division: 'design', seed: 11, composition: 'left', frame: 'dark' }, { x: lx, y: 2.45, z: Z0 + hang, rotY: 0 });
  lightAbove(lx, 2.45 + 0.85 + 0.2, Z0, 0, 1.6);
  // B — medicale, west wall above the bench.
  ctx.painting({ w: 2.4, h: 1.5, division: 'medicale', seed: 23, composition: 'right', frame: 'light' }, { x: X0 + hang, y: 2.3, z: 12.9, rotY: Math.PI / 2 });
  lightAbove(X0, 2.3 + 0.75 + 0.2, 12.9, Math.PI / 2, 1.3);
  // C — industriale, portrait, east wall above the armchairs.
  ctx.painting({ w: 1.5, h: 2.1, division: 'industriale', seed: 37, composition: 'high', frame: 'dark' }, { x: X1 - hang, y: 2.55, z: 12.9, rotY: -Math.PI / 2 });
  lightAbove(X1, 2.55 + 1.05 + 0.2, 12.9, -Math.PI / 2, 0.9);

  ctx.addStatic(S);
}

function buildPlaza(ctx: WorldContext): void {
  const S = new THREE.Group();
  const place = (obj: THREE.Object3D, x: number, z: number, rotY = 0, pad = -0.02): THREE.Object3D => {
    obj.position.set(x, 0, z);
    obj.rotation.y = rotY;
    S.add(obj);
    footCollider(ctx, obj, pad);
    return obj;
  };

  // A paved walk from the far kerb to the door: darker slabs in a staggered bond, light edging.
  const rw = 1.8;
  const walkZ0 = 16.15;
  const walkZ1 = 33.7;
  floorStrip(S, 'concreteDark', -rw, walkZ0, rw, walkZ1, 0.006, 0.006);
  for (const sx of [-1, 1]) floorStrip(S, 'mid', sx * rw - 0.09, walkZ0, sx * rw + 0.09, walkZ1, 0.0075, 0.0075);
  let row = 0;
  for (let z = walkZ1 - 0.6; z > walkZ0 + 0.3; z -= 0.6, row++) {
    floorStrip(S, 'joint', -rw + 0.09, z - 0.006, rw - 0.09, z + 0.006, 0.0075, 0.0015);
    // Staggered vertical joints: slabs 1.2 m long, offset every other row.
    for (let x = -rw + 0.09 + (row % 2 ? 0.6 : 1.2); x < rw - 0.2; x += 1.2) floorStrip(S, 'joint', x - 0.006, z - 0.6, x + 0.006, z, 0.0075, 0.0015);
  }

  // Bollards in front of the glass, leaving the approach wide open.
  for (const x of [3.4, 5.2, 7.0, 8.8]) {
    for (const sx of [-1, 1]) place(bollard(), sx * x, 19.4, 0, 0);
  }
  // Planters against the glass either side of the canopy.
  for (const sx of [-1, 1]) place(planterBox(2.8, 0.7, 60 + sx), sx * 5.3, 16.95);
  // Lamp posts.
  for (const [x, z] of [
    [10.5, 19.6],
    [21.5, 19.6],
    [10.5, 32.6],
    [21.5, 32.6],
  ]) {
    for (const sx of [-1, 1]) place(lampPost(5), sx * x, z, 0, 0);
  }
  // Tree beds (the bed wall doubles as a seat). The dense crown hides logos behind it.
  const beds: Array<[number, number, number, number]> = [
    [-13, 25, 71, 1],
    [13, 25, 73, 1.05],
    [-19.5, 30, 79, 0.9],
    [19.5, 30, 83, 0.95],
  ];
  for (const [x, z, seed, s] of beds) {
    const b = place(treeBed(seed, 1.3, s), x, z, seed);
    const occ = new THREE.Box3(new THREE.Vector3(x - 1.1 * s, 3.4 * s, z - 1.1 * s), new THREE.Vector3(x + 1.1 * s, 4.6 * s, z + 1.1 * s));
    ctx.addOccluder(occ);
    void b;
  }
  // Benches: two facing the building, two with their backs to the wings looking over the plaza.
  place(plazaBench(2.0), -6.2, 30.4, Math.PI);
  place(plazaBench(2.0), 6.2, 30.4, Math.PI);
  place(plazaBench(2.0), -16, 20.6, 0);
  place(plazaBench(2.0), 16, 20.6, 0);
  // Planters softening the base of the wing facades (clear of the division signs).
  for (const sx of [-1, 1]) place(planterBox(4.0, 0.7, 97 + sx), sx * 15, 16.8);
  // Long planters along the far kerb.
  for (const sx of [-1, 1]) {
    place(planterBox(4.0, 0.9, 90 + sx), sx * 5.4, 32.9);
    place(planterBox(4.0, 0.9, 94 + sx), sx * 14.2, 32.9);
  }
  // Clipped hedges just beyond the kerb close the plaza on its three open sides, so the paved
  // walk leads to a green edge rather than off into the ground plane (the kerb collides).
  {
    const hd = 0.9;
    const hh = 1.35;
    const ground = -0.03; // building.ts ground plane
    const hz = PLAZA.maxZ + hd / 2;
    const back = hedge(2 * PLAZA.maxX + 2 * hd, hd, hh, 211);
    back.position.set(0, ground, hz);
    S.add(back);
    const z0 = PLAZA.minZ + 0.3;
    const z1 = hz + hd / 2;
    for (const sx of [-1, 1]) {
      const side = hedge(z1 - z0, hd, hh, 223 + sx);
      side.position.set(sx * (PLAZA.maxX + hd / 2), ground, (z0 + z1) / 2);
      side.rotation.y = Math.PI / 2;
      S.add(side);
    }
  }
  ctx.addStatic(S);
}

const zone: ZoneModule = {
  id: 'entrance',
  build({ ctx, shell }) {
    build(ctx, shell.inner, shell.height);
    buildPlaza(ctx);
    return { slots: {} };
  },
};
export default zone;
