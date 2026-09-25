import * as THREE from 'three';
import { box, createScaleRoot, cyl, keypad, logoBadge, MAT, rbox, SegmentDisplay, weighing } from '../kit';
import { SPECS } from '../specs';
import type { ScaleDef } from '../types';
import { faceFrame, plate, profileSolid, retailHead, rubberFoot, SATIN_STEEL } from './_table-parts';

/**
 * SMART — retail price-computing scale for 4 operators, pole version.
 * Body 34 W × 36 D (est) with sides leaning in slightly (34 → 32 at the top): grey ABS lower
 * tray, off-white cover. Operator console at the front sloping 28°: a dark strip with the wide
 * backlit LCD 26 × 4.2 (weight / unit price / total), then the membrane keypad: 8 × 6
 * alphanumeric keys and the 4 larger dark operator keys at the left edge. Satin stainless pan
 * 34 × 1 × 24 on a 1 cm spider. Chrome pole Ø3.5 × 40 on a rear bracket carrying a double-faced
 * head 30 × 8 × 6 with weight / price / total windows on both faces.
 * Demo: 0.842 kg at 12.90 → 10.86.
 */
const spec = SPECS.smart;

/** Body centre z (the pole bracket sits behind the body; the whole piece is centred). */
const ZB = 2.75;
const TOP = 11.4;
const SLOPE = 28;
const CON_Z = 6.5;
const FRONT_Y = TOP - (18 - CON_Z) * Math.tan((SLOPE * Math.PI) / 180);
const COL_Z = ZB - 20.5;
const HEAD_Y = 50;

const def: ScaleDef = {
  spec,
  build() {
    const { root, cm } = createScaleRoot(spec.id);

    // ---------------------------------------------------------------- body
    for (const x of [-14, 14]) for (const z of [-15, 15]) rubberFoot(cm, 2.8, 1.0, { x, z: ZB + z });
    rbox(cm, 34, 2.0, 36, 0.7, MAT.absGrey, { y: 1.0, z: ZB, bottom: true });
    box(cm, 33.2, 0.6, 35.2, MAT.absDark, { y: 2.8, z: ZB, bottom: true });
    profileSolid(
      cm,
      [
        [-18, 3.2],
        [18, 3.2],
        [18, FRONT_Y],
        [CON_Z, TOP],
        [-18, TOP],
      ],
      34,
      MAT.abs,
      { bevel: 0.5, radius: [0.3, 0.3, 0.9, 0.8, 1.2], taper: 0.94 },
      { z: ZB },
    );
    // Rear port panel.
    box(cm, 6, 2.0, 0.2, MAT.absDark, { x: 9, y: 6.4, z: ZB - 18.08 });
    box(cm, 1.6, 1.1, 0.3, MAT.rubber, { x: 7.8, y: 6.4, z: ZB - 18.2 });
    box(cm, 1.8, 0.9, 0.3, SATIN_STEEL, { x: 10.2, y: 6.4, z: ZB - 18.2 });

    // Pan on its spider.
    const panZ = ZB - 5.5;
    box(cm, 8, 1.05, 8, MAT.absDark, { y: TOP - 0.05, z: panZ, bottom: true });
    box(cm, 26, 0.45, 1.4, MAT.absDark, { y: TOP + 0.55, z: panZ, bottom: true });
    box(cm, 1.4, 0.45, 18, MAT.absDark, { y: TOP + 0.55, z: panZ, bottom: true });
    plate(cm, 34, 1.0, 24, 1.0, 0.25, SATIN_STEEL, { y: TOP + 1.0, z: panZ });

    // ---------------------------------------------------------------- operator console (28°)
    const f = faceFrame(cm, 0, (TOP + FRONT_Y) / 2, ZB + (CON_Z + 18) / 2, SLOPE);
    box(f, 30, 4.9, 0.06, MAT.absDark, { y: 3.25, z: 0.03 });
    box(f, 30, 6.2, 0.06, MAT.paintGrey, { y: -2.3, z: 0.03 });
    // Wide LCD: three fields separated by printed dividers.
    const lcdY = 3.25;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(26, 4.2), MAT.lcdPanel);
    panel.position.set(0, lcdY, 0.07);
    f.add(panel);
    const opFields: Array<[number, number]> = [
      [-8.6, 5],
      [-0.2, 5],
      [8.6, 6],
    ];
    const op = opFields.map(([x, digits]) => {
      const d = new SegmentDisplay({ digits, height: 1.8, color: '#1a221a', offColor: '#b3c8ad' });
      d.object.position.set(x, lcdY + 0.1, 0.1);
      f.add(d.object);
      return d;
    });
    for (const x of [-4.4, 4.0]) box(f, 0.07, 3.4, 0.01, MAT.absDark, { x, y: lcdY, z: 0.08 });
    // Keys: 8 × 6 alphanumeric grid, four larger operator keys at the left edge.
    keypad(f, 8, 6, { w: 1.85, d: 0.72, h: 0.28, gap: 0.26 }, MAT.keycap, { x: -1.0, y: -2.3, z: 0.06, rx: 90 });
    keypad(f, 1, 4, { w: 2.4, d: 1.15, h: 0.34, gap: 0.33 }, MAT.keycapDark, { x: -12.4, y: -2.3, z: 0.06, rx: 90 });
    logoBadge(f, 3.0, spec.line, { x: 11.4, y: -1.9, z: 0.075 });

    // ---------------------------------------------------------------- pole and double-faced head
    rbox(cm, 8, 8, 6, 1.0, MAT.absGrey, { y: 1.0, z: COL_Z, bottom: true });
    cyl(cm, 2.3, 2.5, 1.2, MAT.absGrey, { y: 9.0, z: COL_Z, bottom: true }, 24);
    cyl(cm, 1.75, 1.75, HEAD_Y - 9.5, SATIN_STEEL, { y: 9.5, z: COL_Z, bottom: true }, 24);
    rbox(cm, 6, 1.8, 4.6, 0.5, MAT.absGrey, { y: HEAD_Y - 1.6, z: COL_Z, bottom: true });
    const head = retailHead(cm, { w: 30, h: 8, dBottom: 6, dTop: 4.2, fields: [5, 5, 6], kind: 'lcd', logo: true }, { y: HEAD_Y, z: COL_Z });

    // ---------------------------------------------------------------- weighing
    const kg = 0.842;
    const price = 12.9;
    const weights = [op[0], head.front[0], head.back[0]];
    const prices = [op[1], head.front[1], head.back[1]];
    const totals = [op[2], head.front[2], head.back[2]];
    const w = weighing(weights, { target: () => kg, decimals: 3 });
    const t = weighing(totals, { target: () => Math.round(kg * price * 100) / 100, decimals: 2 });
    for (const d of prices) d.set(0, 2);

    return {
      root,
      size: { w: 0.34, d: 0.415, h: 0.58 },
      weigh(active) {
        w.weigh(active);
        t.weigh(active);
        for (const d of prices) d.set(active ? price : 0, 2);
      },
      update(dt) {
        w.update(dt);
        t.update(dt);
      },
    };
  },
};

export default def;
