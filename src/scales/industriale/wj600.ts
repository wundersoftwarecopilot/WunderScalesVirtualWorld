import { box, createScaleRoot, cyl, keypad, lathe, lcd, logoBadge, MAT, rbox, weighing } from '../kit';
import { SPECS } from '../specs';
import type { ScaleDef } from '../types';
import { bubbleLevel, faceFrame, profileSolid, rubberFoot, SATIN_STEEL } from './_table-parts';

/**
 * WJ 600 — precision balance (600 g). Body 20 W × 22.5 D × 8 H (confirmed): grey ABS lower
 * tray, off-white cover whose front 7.25 cm slopes 15°, carrying a dark membrane with the
 * backlit LCD 10 × 3 (20 mm digits), a row of 6 keys 1.8 × 1 and the logo. Round satin pan
 * Ø11.5 × 0.4 (confirmed) on a Ø1 spindle with a rubber boot, over a raised trim ring on the
 * rear two-thirds of the top. Four levelling feet, spirit level at the rear-left corner,
 * power and serial ports at the back. Demo: 412.36 g.
 */
const spec = SPECS.wj600;

const TOP = 7.2;
const SLOPE = 15;
const CON_Z = 4.0;
const FRONT_Y = TOP - (11.25 - CON_Z) * Math.tan((SLOPE * Math.PI) / 180);
const PAN_Z = -3.5;

const def: ScaleDef = {
  spec,
  build() {
    const { root, cm } = createScaleRoot(spec.id);

    // ---------------------------------------------------------------- body
    for (const x of [-7.5, 7.5]) for (const z of [-9, 9]) rubberFoot(cm, 1.7, 1.0, { x, z });
    rbox(cm, 20, 1.6, 22.5, 0.6, MAT.absGrey, { y: 1.0, bottom: true });
    box(cm, 19.3, 0.5, 21.8, MAT.absDark, { y: 2.4, bottom: true });
    profileSolid(
      cm,
      [
        [-11.25, 2.75],
        [11.25, 2.75],
        [11.25, FRONT_Y],
        [CON_Z, TOP],
        [-11.25, TOP],
      ],
      20,
      MAT.abs,
      { bevel: 0.45, radius: [0.3, 0.3, 0.7, 0.6, 1.0] },
    );
    // Rear ports.
    box(cm, 5.2, 1.6, 0.15, MAT.absDark, { x: 4.5, y: 5.0, z: -11.3 });
    box(cm, 1.9, 0.8, 0.25, MAT.stainless, { x: 3.6, y: 5.0, z: -11.4 });
    cyl(cm, 0.45, 0.45, 0.3, MAT.blackPlastic, { x: 5.9, y: 5.0, z: -11.4, rx: 90 }, 16);

    // ---------------------------------------------------------------- pan: trim ring, boot, spindle, disc
    cyl(cm, 6.3, 6.4, 0.25, MAT.absGrey, { y: TOP, z: PAN_Z, bottom: true }, 40);
    cyl(cm, 5.4, 5.4, 0.04, MAT.absDark, { y: TOP + 0.25, z: PAN_Z, bottom: true }, 40);
    cyl(cm, 1.1, 1.35, 0.5, MAT.rubberGrey, { y: TOP + 0.25, z: PAN_Z, bottom: true }, 20);
    cyl(cm, 0.5, 0.5, 1.0, MAT.stainless, { y: TOP + 0.7, z: PAN_Z, bottom: true }, 16);
    cyl(cm, 1.0, 1.6, 0.3, SATIN_STEEL, { y: TOP + 1.4, z: PAN_Z, bottom: true }, 24);
    lathe(
      cm,
      [
        [0, 0],
        [5.5, 0],
        [5.72, 0.1],
        [5.75, 0.28],
        [5.62, 0.4],
        [0, 0.4],
      ],
      SATIN_STEEL,
      { y: TOP + 1.5, z: PAN_Z },
      48,
    );

    bubbleLevel(cm, 1.5, { x: -7.4, y: TOP, z: -9.2 });

    // ---------------------------------------------------------------- front panel (15°)
    const f = faceFrame(cm, 0, (TOP + FRONT_Y) / 2, (CON_Z + 11.25) / 2, SLOPE);
    box(f, 18.6, 6.0, 0.05, MAT.absDark, { y: 0.05, z: 0.025 });
    box(f, 10.5, 3.5, 0.04, MAT.keycapDark, { x: 2.3, y: 1.25, z: 0.07 });
    const win = lcd(f, { w: 10, h: 3, digits: 6, kind: 'lcd' }, { x: 2.3, y: 1.25, z: 0.095 });
    keypad(f, 6, 1, { w: 1.8, d: 1.0, h: 0.3, gap: 0.45 }, MAT.keycap, { y: -1.95, z: 0.05, rx: 90 });
    logoBadge(f, 3.0, spec.line, { x: -6.5, y: 1.4, z: 0.06 });

    // ---------------------------------------------------------------- weighing
    const w = weighing([win.display], { target: () => 412.36, decimals: 2 });

    return {
      root,
      size: { w: 0.2, d: 0.225, h: 0.091 },
      weigh: w.weigh,
      update: w.update,
    };
  },
};

export default def;
