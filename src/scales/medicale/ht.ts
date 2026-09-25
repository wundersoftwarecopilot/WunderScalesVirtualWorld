import * as THREE from 'three';
import { box, createScaleRoot, cyl, foot, keep, lcd, logoBadge, MAT, rbox, torus, weighing } from '../kit';
import { SPECS } from '../specs';
import type { ScaleDef } from '../types';
import { BRIGHT_STEEL, group, mergeInto, prism, ringWall, SATIN, slab } from './_parts-table';

/**
 * HT — analytical balance 220 g × 0.1 mg with a glass draft shield (medicale, laboratorio).
 * Recipe (cm, catalogue: 27.5 × 20 × 31.4, pan Ø8; depth here 22.5 so the front keypad slope fits
 * ahead of the chamber): a light ABS base 7 high whose front edge is a steep slope carrying the dark
 * membrane with the 8-digit LCD (12 × 2.5), a spirit level, the logo and 7 keys; the full-width
 * rear tower (5 deep, 31.4 high) housing the cell; the draft shield (25 × 22 × 14) of clear glass
 * in 12 thin grey edge bars, with sliding side doors and a top door offset 3 mm outside the frame;
 * inside, a brushed floor plate, the Ø8 pan on its spindle and the splash ring around it.
 *
 * Behaviour: when the visitor comes close the right-hand door slides back a little and a demo
 * reading (e.g. 123.4567 g, 4 decimals) settles on the display.
 */
const spec = SPECS.ht;

const W = 27.5;
const D = 22.5;
const H = 31.4;
const FOOT = 1.0;
const BASE_TOP = 7.6;
/** Draft shield frame lines (centres of the 0.5 cm bars). */
const SX = 12.5;
const FZ = 7.85;
const RZ = -6.0;
const Y0 = BASE_TOP + 0.25;
const Y1 = 29.35;
const BAR = 0.5;
const DOOR_OFF = 0.3;
/** Pan centre z. */
const PZ = 0.9;

const FRAME = new THREE.MeshStandardMaterial({ color: '#7d8187', roughness: 0.45, metalness: 0.3 });

const def: ScaleDef = {
  spec,
  build() {
    const { root, cm } = createScaleRoot(spec.id);

    // ---------------------------------------------------------------- feet, base, tower
    for (const x of [-11, 11]) {
      foot(cm, 2.4, FOOT + 0.2, { x, z: 8.6 }); // front: levelling feet
      cyl(cm, 1.1, 1.3, FOOT, MAT.rubber, { x, z: -9.2, y: 0, bottom: true }, 16);
    }
    prism(
      cm,
      [
        [-6.4, FOOT + 0.4],
        [10.85, FOOT + 0.4],
        [10.85, 2.2],
        [7.9, BASE_TOP - 0.4],
        [-6.4, BASE_TOP - 0.4],
      ],
      W,
      MAT.abs,
      {},
      0.4,
    );
    rbox(cm, W, H - FOOT, 5, 1.0, MAT.abs, { y: FOOT, z: -D / 2 + 2.5, bottom: true });
    // Tower rear: cooling slots, interface socket and the power inlet.
    for (let i = 0; i < 6; i++) box(cm, 12, 0.35, 0.1, MAT.absDark, { y: 18 + i * 1.1, z: -D / 2 - 0.02 });
    rbox(cm, 3.2, 1.4, 0.4, 0.2, MAT.absDark, { x: -7, y: 6, z: -D / 2 - 0.1 });
    cyl(cm, 0.6, 0.6, 0.4, MAT.blackPlastic, { x: 7, y: 6, z: -D / 2 - 0.1, rx: 90 }, 12);

    // ---------------------------------------------------------------- front slope: membrane, LCD, keys
    const slope = Math.atan2(BASE_TOP - 0.4 - 2.2, 10.85 - 7.9);
    const ny = Math.cos(slope);
    const nz = Math.sin(slope);
    const face = group(cm, { y: (2.2 + BASE_TOP - 0.4) / 2 + 0.4 * ny, z: (10.85 + 7.9) / 2 + 0.4 * nz, rx: -(90 - (slope * 180) / Math.PI) });
    rbox(face, 19.5, 5.0, 0.1, 0.4, MAT.absDark, { x: 3.15 });
    const win = lcd(face, { w: 12, h: 2.5, digits: 8 }, { x: 0.5, y: 1.05, z: 0.07 });
    for (let i = 0; i < 7; i++) rbox(face, 2.1, 0.9, 0.3, 0.15, MAT.keycap, { x: 3.3 + (i - 3) * 2.75, y: -1.55, z: 0.1 });
    // Spirit level: chrome ring, dark vial, bright bubble.
    cyl(face, 0.95, 0.95, 0.12, MAT.chrome, { x: 10.4, y: 1.05, z: 0.08, rx: 90 }, 20);
    cyl(face, 0.72, 0.72, 0.14, MAT.lcdGlass, { x: 10.4, y: 1.05, z: 0.1, rx: 90 }, 20);
    cyl(face, 0.22, 0.22, 0.05, MAT.abs, { x: 10.4, y: 1.05, z: 0.18, rx: 90 }, 12);
    logoBadge(face, 3, 'medicale', { x: -10.2, y: 0.75, z: 0.02 });

    // ---------------------------------------------------------------- weighing chamber interior
    slab(cm, 24.2, 0.2, 13.6, 0.4, 0.05, SATIN, { y: BASE_TOP, z: (RZ + FZ) / 2 });
    const floorTop = BASE_TOP + 0.2;
    ringWall(cm, 5.1, 0.12, 2.9, BRIGHT_STEEL, { y: floorTop, z: PZ });
    torus(cm, 5.04, 0.14, BRIGHT_STEEL, { y: floorTop + 2.9, z: PZ, rx: 90 });
    cyl(cm, 1.2, 1.4, 0.3, MAT.absGrey, { y: floorTop, z: PZ, bottom: true }, 20);
    cyl(cm, 0.3, 0.3, 3.0, BRIGHT_STEEL, { y: floorTop + 0.3, z: PZ, bottom: true }, 12);
    cyl(cm, 0.9, 0.5, 0.25, BRIGHT_STEEL, { y: floorTop + 3.05, z: PZ, bottom: true }, 16);
    cyl(cm, 4, 4, 0.3, BRIGHT_STEEL, { y: floorTop + 3.3, z: PZ, bottom: true }, 40);

    // ---------------------------------------------------------------- draft shield frame (12 bars)
    const spanX = SX * 2 + BAR;
    const spanZ = FZ - RZ + BAR;
    const midZ = (FZ + RZ) / 2;
    const spanY = Y1 - Y0 + BAR;
    const midY = (Y0 + Y1) / 2;
    for (const y of [Y0, Y1]) {
      box(cm, spanX, BAR, BAR, FRAME, { y, z: FZ });
      box(cm, spanX, BAR, BAR, FRAME, { y, z: RZ });
      for (const s of [-1, 1]) box(cm, BAR, BAR, spanZ, FRAME, { x: s * SX, y, z: midZ });
    }
    for (const s of [-1, 1]) for (const z of [FZ, RZ]) box(cm, BAR, spanY, BAR, FRAME, { x: s * SX, y: midY, z });
    // Door tracks outside the side bars, and the top door's grip.
    for (const s of [-1, 1]) {
      box(cm, 0.45, 0.35, spanZ, FRAME, { x: s * (SX + DOOR_OFF), y: Y0 - 0.05, z: midZ });
      box(cm, 0.45, 0.35, spanZ, FRAME, { x: s * (SX + DOOR_OFF), y: Y1 + 0.05, z: midZ });
    }
    box(cm, 7, 0.35, 0.9, MAT.absGrey, { y: Y1 + BAR / 2 + 0.02 + 0.175, z: FZ - 1.2 });

    // ---------------------------------------------------------------- glass: fixed panes merged, right door moving
    const paneH = Y1 - Y0 - BAR;
    const paneD = FZ - RZ - BAR;
    const front = new THREE.Mesh(new THREE.PlaneGeometry(SX * 2 - BAR, paneH), MAT.glass);
    front.position.set(0, midY, FZ);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(SX * 2 + BAR, spanZ), MAT.glass);
    top.rotation.x = -Math.PI / 2;
    top.position.set(0, Y1 + BAR / 2 + 0.02, midZ);
    const left = new THREE.Mesh(new THREE.PlaneGeometry(paneD + BAR, paneH + BAR), MAT.glass);
    left.rotation.y = Math.PI / 2;
    left.position.set(-(SX + DOOR_OFF), midY, midZ);
    cm.add(front, top, left);
    mergeInto(cm, [front, top, left], MAT.glass).renderOrder = 2;
    const door = keep(group(cm, { x: SX + DOOR_OFF, y: midY, z: midZ }));
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(paneD + BAR, paneH + BAR), MAT.glass);
    pane.rotation.y = Math.PI / 2;
    pane.renderOrder = 2;
    door.add(pane);
    // Door grips (vertical bars at the front edges, outside the glass).
    rbox(door, 0.5, 8, 0.8, 0.2, MAT.absGrey, { x: 0.3, z: paneD / 2 - 0.6 });
    rbox(cm, 0.5, 8, 0.8, 0.2, MAT.absGrey, { x: -(SX + DOOR_OFF) - 0.3, y: midY, z: midZ + paneD / 2 - 0.6 });

    // ---------------------------------------------------------------- behaviour
    let doorTarget = 0;
    const reading = weighing([win.display], {
      target: () => Math.round((15 + Math.random() * 190) * 10000) / 10000,
      decimals: 4,
    });

    return {
      root,
      size: { w: 0.28, d: 0.225, h: 0.314 },
      weigh(active) {
        reading.weigh(active);
        doorTarget = active ? -5 : 0;
      },
      update(dt) {
        reading.update(dt);
        door.position.z += (midZ + doorTarget - door.position.z) * Math.min(1, dt * 2.2);
      },
    };
  },
};

export default def;
