import * as THREE from 'three';
import { box, createScaleRoot, cyl, keypad, lcd, logoBadge, MAT, rbox, rectCm, SegmentDisplay, visitorWeight, weighing } from '../kit';
import { SPECS } from '../specs';
import type { ScaleDef } from '../types';
import { BRIGHT_STEEL, group, slab } from './_parts-floor';

/**
 * WBA300 — column body-composition analyser (foot-to-foot BIA) with a built-in printer.
 * Recipe (cm, catalogue: 45 × 55 × 88; column 10 × 5 × 75; base 45 × 34 × 8.5): painted aluminium
 * base with 4 bright stainless foot electrodes (8 × 12, heel and toe, left and right); a column
 * foot behind the base carrying the column; an ABS head 30 × 6 × 20 tilted 25° towards the user
 * with a weight LCD (14 × 4), a two-row result LCD (12 × 6), a 20-key pad and a thermal printer
 * block with its paper slot on top.
 *
 * Behaviour: stepping on shows the weight; after a short measuring run (dashes chasing along the
 * result rows) the second display shows body fat % (e.g. 21.4) above the BMI.
 */
const spec = SPECS.wba300;

const BASE_Z = 10.5;
const BASE_TOP = 8.5;
const ELECTRODE_TOP = 8.8;
const HEAD_TILT = 25;

const def: ScaleDef = {
  spec,
  build() {
    const { root, cm } = createScaleRoot(spec.id);

    // ---------------------------------------------------------------- base with electrodes
    slab(cm, 14, 3, 23, 3, 0.6, MAT.paintWhite, { z: -16 }); // column foot, tucked under the base
    slab(cm, 45, BASE_TOP - 0.8, 34, 3, 1.0, MAT.paintWhite, { y: 0.8, z: BASE_Z });
    for (const x of [-18, 18]) for (const dz of [-13, 13]) cyl(cm, 1.8, 2.0, 0.9, MAT.rubber, { x, y: 0, z: BASE_Z + dz, bottom: true }, 16);
    for (const x of [-10, 10])
      for (const z of [BASE_Z - 8, BASE_Z + 8]) {
        slab(cm, 9.4, 0.3, 13.4, 1.6, 0.08, MAT.absDark, { x, y: BASE_TOP - 0.1, z }); // insulating gasket
        slab(cm, 8, 0.45, 12, 1.3, 0.12, BRIGHT_STEEL, { x, y: ELECTRODE_TOP - 0.45, z });
      }

    // ---------------------------------------------------------------- column
    rbox(cm, 10, 81.7 - 2.5, 5, 1.2, MAT.paintWhite, { y: 2.5, z: -21, bottom: true });
    rbox(cm, 12, 2, 7, 0.6, MAT.paintWhite, { y: 2.6, z: -21, bottom: true });

    // ---------------------------------------------------------------- head (tilted towards the user)
    const head = group(cm, { y: 81, z: -15, rx: HEAD_TILT });
    rbox(head, 30, 6, 20, 2, MAT.abs, {});
    slab(head, 30.2, 0.35, 20.2, 2.1, 0.1, MAT.absGrey, { y: -0.75 }); // parting line of the two shells
    const TOP = 3;
    // Weight window (rear left).
    box(head, 15.2, 0.1, 5.2, MAT.lcdGlass, { x: -6.2, y: TOP + 0.02, z: -4.8 });
    const weightWin = lcd(head, { w: 14, h: 4, digits: 5 }, { x: -6.2, y: TOP + 0.09, z: -4.8, rx: -90 });
    // Result window (front left): two rows, body fat % above BMI.
    box(head, 13.2, 0.1, 7.2, MAT.lcdGlass, { x: -6.2, y: TOP + 0.02, z: 3.3 });
    const res = group(head, { x: -6.2, y: TOP + 0.09, z: 3.3, rx: -90 });
    res.add(new THREE.Mesh(new THREE.PlaneGeometry(12, 6), MAT.lcdPanel));
    const rowOpts = { digits: 4, height: 2.05, color: '#1a221a', offColor: '#bfd5b9' };
    const fatRow = new SegmentDisplay(rowOpts);
    const bmiRow = new SegmentDisplay(rowOpts);
    fatRow.object.position.set(1.6, 1.4, 0.05);
    bmiRow.object.position.set(1.6, -1.4, 0.05);
    res.add(fatRow.object, bmiRow.object);
    // 20-key pad (front right), one dark enter key beside it.
    keypad(head, 5, 4, { w: 2.0, d: 1.2, h: 0.4, gap: 0.55 }, MAT.keycap, { x: 7.4, y: TOP - 0.1, z: 3.6 });
    // Printer block with paper slot, tear bar and a strip of printout (rear right).
    rbox(head, 10, 5, 8, 0.8, MAT.abs, { x: 7.6, y: TOP, z: -4.4 });
    box(head, 6.4, 0.1, 0.4, MAT.blackPlastic, { x: 7.6, y: TOP + 2.5, z: -4.9 });
    box(head, 6.8, 0.25, 0.3, MAT.stainless, { x: 7.6, y: TOP + 2.55, z: -4.45 });
    box(head, 5.6, 2.6, 0.06, MAT.paintWhite, { x: 7.6, y: TOP + 3.6, z: -5.1, rx: -14 });

    // ---------------------------------------------------------------- logos
    logoBadge(cm, 5, 'medicale', { y: 54, z: -18.44 });
    logoBadge(cm, 3, 'medicale', { y: 5.2, z: BASE_Z + 17.06 });

    // ---------------------------------------------------------------- behaviour
    const heightCm = 172;
    let w = 0;
    let measuring = -1; // seconds left in the BIA run; -1 = idle
    let chase = 0;
    const main = weighing([weightWin.display], { target: () => (w = visitorWeight()), decimals: 1 });
    const fat = weighing([fatRow], { target: () => Math.round((16 + Math.random() * 12) * 10) / 10, decimals: 1 });
    const bmi = weighing([bmiRow], { target: () => Math.round((w / (heightCm / 100) ** 2) * 10) / 10, decimals: 1 });

    return {
      root,
      size: { w: 0.45, d: 0.55, h: 0.9 },
      standOn: { ...rectCm(0, BASE_Z, 43, 32), y: ELECTRODE_TOP / 100 },
      colliders: [rectCm(0, -16.5, 30, 22)],
      weigh(on) {
        main.weigh(on);
        if (on) {
          measuring = 2.6;
        } else {
          measuring = -1;
          fat.weigh(false);
          bmi.weigh(false);
        }
      },
      update(dt) {
        main.update(dt);
        if (measuring > 0) {
          measuring -= dt;
          chase += dt;
          const p = Math.floor(chase * 6) % 4;
          const s = ['-   ', ' -  ', '  - ', '   -'][p];
          fatRow.show(s);
          bmiRow.show(s);
          if (measuring <= 0) {
            fatRow.set(0, 1);
            bmiRow.set(0, 1);
            fat.weigh(true);
            bmi.weigh(true);
          }
        } else {
          fat.update(dt);
          bmi.update(dt);
        }
      },
    };
  },
};

export default def;
