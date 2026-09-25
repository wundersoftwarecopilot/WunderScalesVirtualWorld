import * as THREE from 'three';
import { box, createScaleRoot, cyl, extrude, keypad, lcd, logoBadge, MAT, rbox, rectCm, tubePath, weighing } from '../kit';
import { SPECS } from '../specs';
import type { ScaleDef } from '../types';
import {
  cable,
  CARTON_A,
  CARTON_B,
  group,
  hex,
  PAINT_MID,
  PALLET_BLOCK,
  PALLET_WOOD,
  PU_WHEEL,
  TAPE,
  ZINC,
} from './_floor-parts';

/**
 * TPX-C — weighing pallet truck with piece counting. Forks 115 × 16 × 8.7, 55 outer width
 * (TPS data), chamfered tips with tandem load rollers, a 55-wide chassis, the pump on a steering
 * turret over twin Ø18 steering wheels, a Ø3 tiller leaning back 15° ending in a 30 × 20 loop.
 * The indicator (32 × 18 × 10) sits on two posts above the chassis facing the operator (+Z):
 * 3-field LCD (weight / unit weight / pieces) and a green-yellow-red check bar.
 * A EUR pallet with a carton stack is lifted on the forks so the reading makes sense.
 */
const spec = SPECS['tpx-c'];

const FT = 12; // fork top, lifted (8.7 lowered + 3.3)
const FB = FT - 8.7;

const def: ScaleDef = {
  spec,
  build() {
    const { root, cm } = createScaleRoot(spec.id);
    // Truck frame: z = 0 at the fork back, forks towards -Z, operator at +Z. Shifted so the
    // footprint (pallet end → tiller loop) is centred on the origin.
    const t = group(cm, { z: 38.5 });

    // ---- forks: side profile (X = distance towards the tip, Y up) extruded 16 wide
    const profile: Array<[number, number]> = [
      [0, 0.2],
      [107, 0.2],
      [113, 2],
      [116.8, 3.4],
      [116.8, 4.6],
      [105, 8.5],
      [0, 8.5],
    ];
    for (const s of [-1, 1]) {
      const fx = s * 19.5;
      extrude(t, profile, 15.6, PAINT_MID, { x: fx, y: FB, z: 2, ry: 90 }, 0.2);
      // Tandem load rollers under the tip, axle nuts on both fork walls.
      for (const rz of [-102, -109]) {
        cyl(t, 4, 4, 6, PU_WHEEL, { x: fx, y: 4, z: rz, rz: 90 }, 18);
        for (const w of [-1, 1]) hex(t, 1.3, 0.5, ZINC, { x: fx + w * 8.1, y: 4.6, z: rz, rz: 90 });
      }
      // Fork reinforcement seam near the chassis.
      box(t, 16.2, 0.4, 3, PAINT_MID, { x: fx, y: FT - 0.1, z: -4 });
    }

    // ---- chassis: fork back box, steering turret, twin steering wheels
    rbox(t, 55, 26 - FB, 14, 1.2, PAINT_MID, { y: FB, z: 7, bottom: true });
    rbox(t, 26, 3, 22, 0.8, PAINT_MID, { y: 22.8, z: 21, bottom: true });
    for (const s of [-1, 1]) {
      // Gussets from the fork back to the turret.
      box(t, 1.2, 9, 10, PAINT_MID, { x: s * 11, y: 14, z: 17, bottom: true });
      hex(t, 1.6, 0.6, ZINC, { x: s * 27.6, y: 20, z: 3.5, rz: 90 });
      hex(t, 1.6, 0.6, ZINC, { x: s * 27.6, y: 20, z: 10.5, rz: 90 });
    }
    const wz = 24;
    for (const s of [-1, 1]) {
      cyl(t, 9, 9, 5, PU_WHEEL, { x: s * 5.2, y: 9, z: wz, rz: 90 }, 28);
      cyl(t, 4.2, 4.2, 5.3, MAT.stainless, { x: s * 5.2, y: 9, z: wz, rz: 90 }, 18);
      box(t, 1.2, 14, 9, PAINT_MID, { x: s * 8.9, y: 9, z: wz, bottom: true });
      hex(t, 1.8, 0.6, ZINC, { x: s * 9.8, y: 9, z: wz, rz: 90 });
    }
    cyl(t, 1, 1, 17, ZINC, { y: 9, z: wz, rz: 90 }, 10);
    box(t, 19, 1.4, 11, PAINT_MID, { y: 21.4, z: wz, bottom: true });

    // ---- pump on the turret: cast base, Ø8 cylinder, chrome ram, yoke
    const pz = wz;
    cyl(t, 10.5, 10.5, 1.4, PAINT_MID, { y: 25.8, z: pz, bottom: true }, 32);
    rbox(t, 16, 8, 14, 1.5, PAINT_MID, { y: 27.2, z: pz, bottom: true });
    cyl(t, 4, 4, 17, PAINT_MID, { y: 35, z: pz, bottom: true }, 24);
    cyl(t, 4.6, 4.6, 1.2, PAINT_MID, { y: 51, z: pz, bottom: true }, 24);
    cyl(t, 1.5, 1.5, 3, MAT.chrome, { y: 52, z: pz, bottom: true }, 12);
    // Release valve lever on the pump side.
    box(t, 1, 1, 6, ZINC, { x: 4.8, y: 33, z: pz + 3 });
    // Yoke ears for the tiller pivot.
    const pivotY = 55;
    for (const s of [-1, 1]) box(t, 1, 8, 5, PAINT_MID, { x: s * 5.3, y: pivotY - 5, z: pz, bottom: true });

    // ---- tiller: foot plates, Ø3 tube leaning 15° towards the operator, loop handle
    const tl = group(t, { y: pivotY, z: pz, rx: 15 });
    cyl(tl, 0.9, 0.9, 13.4, ZINC, { rz: 90 }, 10);
    for (const s of [-1, 1]) {
      rbox(tl, 1, 13, 6, 0.4, PAINT_MID, { x: s * 6.3, y: 4 });
      hex(tl, 1.8, 0.5, ZINC, { x: s * 7, rz: 90 });
    }
    rbox(tl, 13.6, 2, 6, 0.4, PAINT_MID, { y: 10 });
    cyl(tl, 1.5, 1.5, 46, PAINT_MID, { y: 10, bottom: true }, 16);
    tubePath(
      tl,
      [
        [0, 56, 0],
        [-15, 56, 0],
        [-15, 76, 0],
        [15, 76, 0],
        [15, 56, 0],
        [0, 56, 0],
      ],
      1.5,
      PAINT_MID,
      { cornerRadius: 5, radialSegments: 12 },
    );
    cyl(tl, 1.95, 1.95, 19, MAT.rubber, { y: 76, rz: 90 }, 16);
    // Thumb lever inside the loop and the release rod down the back of the tube.
    rbox(tl, 7, 1.2, 1.8, 0.4, MAT.blackPlastic, { y: 73, z: 0.2 });
    tubePath(
      tl,
      [
        [0, 72.5, -1.2],
        [0, 56, -2.1],
        [0, 12, -2.1],
      ],
      0.3,
      ZINC,
      { cornerRadius: 2, radialSegments: 6 },
    );

    // ---- indicator on two posts above the fork back, facing the operator
    const iz = 6.5;
    const iy = 88;
    for (const s of [-1, 1]) {
      box(t, 2.4, iy - 26 + 3, 2.4, PAINT_MID, { x: s * 17.4, y: 26, z: iz, bottom: true });
      cyl(t, 1.7, 1.7, 1.4, MAT.blackPlastic, { x: s * 19.3, y: iy, z: iz, rz: 90 }, 12);
    }
    box(t, 32.4, 2.4, 2.4, PAINT_MID, { y: 72, z: iz - 1.5 });
    const ind = group(t, { y: iy, z: iz, rx: -22 });
    rbox(ind, 32, 18, 10, 2, MAT.absGrey, {});
    rbox(ind, 30, 16, 0.6, 0.5, MAT.absDark, { z: 4.9 });
    // LCD glass split in two by a centre divider (where the tiller tube crosses in front when
    // seen head-on): big weight field left, unit weight + pieces stacked on the right.
    box(ind, 28.6, 8.2, 0.3, MAT.lcdGlass, { y: 3.1, z: 5.25 });
    const faceZ = 5.42;
    const wLcd = lcd(ind, { w: 12.3, h: 7.3, digits: 5 }, { x: -7.95, y: 3.1, z: faceZ });
    const pcsLcd = lcd(ind, { w: 12.3, h: 3.45, digits: 5 }, { x: 7.95, y: 5.02, z: faceZ });
    const uwLcd = lcd(ind, { w: 12.3, h: 3.45, digits: 5 }, { x: 7.95, y: 1.18, z: faceZ });
    // Green / yellow / red check bar under the LCD.
    const bar = ['#27d34a', '#ffc21a', '#ff2d1f'].map(
      (c) => new THREE.MeshStandardMaterial({ color: '#111111', emissive: c, emissiveIntensity: 0.12, roughness: 0.4 }),
    );
    bar.forEach((m, i) => box(ind, 8.6, 1.3, 0.3, m, { x: -9.3 + i * 9.3, y: -2.1, z: 5.3, castShadow: false }));
    const keys = keypad(ind, 6, 1, { w: 2.6, d: 1.6, h: 0.5, gap: 0.7 }, MAT.keycap, { x: -3.2, y: -5.3, z: 5.15, rx: 90 });
    keys.castShadow = false;
    logoBadge(ind, 3, spec.line, { x: 11.2, y: -4.4, z: 5.24 });
    // Cable from the indicator down the right post into the chassis.
    cable(t, [
      [8, iy - 8, iz - 2],
      [15, iy - 14, iz - 2.2],
      [16, iy - 20, iz - 1.6],
      [16, 30, iz - 1.6],
      [14, 26.3, iz - 1],
    ]);
    // Brand badge on the right side of the chassis.
    logoBadge(t, 6, spec.line, { x: 27.55, y: 16.5, z: 7, ry: 90 });

    // ---- EUR pallet (120 × 80 × 14.4) resting on the lifted forks, with a carton stack
    const pb = FT - 10 + 0.05; // pallet underside
    const pz0 = -0.5; // pallet end at the fork back
    const pzc = pz0 - 60;
    for (const [x, w] of [
      [-35, 10],
      [0, 14.5],
      [35, 10],
    ] as const) {
      box(t, w, 2.2, 120, PALLET_WOOD, { x, y: pb, z: pzc, bottom: true });
      for (const zc of [pz0 - 7.25, pzc, pz0 - 120 + 7.25]) box(t, w, 7.8, 14.5, PALLET_BLOCK, { x, y: pb + 2.2, z: zc, bottom: true });
    }
    for (const zc of [pz0 - 7.25, pzc, pz0 - 120 + 7.25]) box(t, 80, 2.2, 14.5, PALLET_WOOD, { y: pb + 10, z: zc, bottom: true });
    for (const [x, w] of [
      [-32.75, 14.5],
      [-16.4, 10],
      [0, 14.5],
      [16.4, 10],
      [32.75, 14.5],
    ] as const)
      box(t, w, 2.2, 120, PALLET_WOOD, { x, y: pb + 12.2, z: pzc, bottom: true });
    const deck = pb + 14.4;
    const CH = 30;
    const cartons: Array<[number, number, number]> = [];
    for (let layer = 0; layer < 2; layer++) for (const x of [-20, 20]) for (const zc of [-20, -60, -100]) cartons.push([x, layer, zc]);
    cartons.push([-20, 2, -100], [20, 2, -100], [-20, 2, -60]);
    cartons.forEach(([x, layer, zc], i) => {
      const jx = ((i * 37) % 5) * 0.12 - 0.24;
      const jz = ((i * 53) % 5) * 0.12 - 0.24;
      const y = deck + layer * CH;
      box(t, 39.2, CH, 39.2, i % 3 === 1 ? CARTON_B : CARTON_A, { x: x + jx, y, z: pz0 + zc + jz, bottom: true });
      box(t, 5, CH + 0.16, 39.4, TAPE, { x: x + jx, y: y - 0.08, z: pz0 + zc + jz, bottom: true });
    });

    // ---- weighing: count up to the loaded pallet on approach, check bar yellow → green
    wLcd.display.set(0, 1);
    uwLcd.display.set(54.9, 2);
    pcsLcd.display.set(0, 0);
    const setBar = (i: number) => bar.forEach((m, k) => (m.emissiveIntensity = k === i ? 2.2 : 0.12));
    let active = false;
    const weight = weighing([wLcd.display], {
      target: () => 842.5,
      decimals: 1,
      onStable: (stable) => setBar(active ? (stable ? 0 : 1) : -1),
    });
    const pieces = weighing([pcsLcd.display], { target: () => 15, decimals: 0 });

    return {
      root,
      size: { w: 0.82, d: 1.66, h: 1.3 },
      colliders: [rectCm(0, -22, 80, 121), rectCm(0, 60, 56, 40)],
      weigh(on) {
        active = on;
        weight.weigh(on);
        pieces.weigh(on);
        setBar(on ? 1 : -1);
      },
      update(dt) {
        weight.update(dt);
        pieces.update(dt);
      },
    };
  },
};

export default def;
