import { box, createScaleRoot, cyl, keypad, lcd, logoBadge, MAT, rbox, weighing } from '../kit';
import { SPECS } from '../specs';
import type { ScaleDef } from '../types';
import { bubbleLevel, faceFrame, plate, profileSolid, rubberFoot, SATIN_STEEL } from './_table-parts';

/**
 * NHB — precision balance with a rectangular pan. Body 20 W × 25 D × 8 H: dark grey lower tray,
 * light grey cover whose front 8 cm slopes 18° with a dark membrane: LCD 10 × 3 (left), a row
 * of 5 keys and the logo (right). Satin stainless pan 14 × 0.4 × 15 on a 1 cm four-arm spider
 * (hub, diagonal arms, rubber pads) over a dark seal plate. Four feet, spirit level at the
 * rear-left corner, ports at the back. Demo: 238.07 g.
 */
const spec = SPECS.nhb;

const TOP = 6.6;
const SLOPE = 18;
const CON_Z = 4.5;
const FRONT_Y = TOP - (12.5 - CON_Z) * Math.tan((SLOPE * Math.PI) / 180);
const PAN_Z = -4;

const def: ScaleDef = {
  spec,
  build() {
    const { root, cm } = createScaleRoot(spec.id);

    // ---------------------------------------------------------------- body
    for (const x of [-7.6, 7.6]) for (const z of [-10, 10]) rubberFoot(cm, 1.8, 1.0, { x, z });
    rbox(cm, 20, 1.3, 25, 0.55, MAT.paintDark, { y: 1.0, bottom: true });
    box(cm, 19.3, 0.5, 24.3, MAT.blackPlastic, { y: 2.05, bottom: true });
    profileSolid(
      cm,
      [
        [-12.5, 2.4],
        [12.5, 2.4],
        [12.5, FRONT_Y],
        [CON_Z, TOP],
        [-12.5, TOP],
      ],
      20,
      MAT.absGrey,
      { bevel: 0.45, radius: [0.3, 0.3, 0.7, 0.6, 1.4] },
    );
    // Rear ports.
    box(cm, 5.2, 1.5, 0.15, MAT.absDark, { x: -4.5, y: 4.4, z: -12.55 });
    box(cm, 1.9, 0.8, 0.25, MAT.stainless, { x: -5.4, y: 4.4, z: -12.65 });
    cyl(cm, 0.45, 0.45, 0.3, MAT.blackPlastic, { x: -3.1, y: 4.4, z: -12.65, rx: 90 }, 16);

    // ---------------------------------------------------------------- pan on a four-arm spider
    plate(cm, 15.4, 0.08, 16.4, 1.2, 0.03, MAT.absDark, { y: TOP, z: PAN_Z });
    cyl(cm, 1.3, 1.6, 0.72, MAT.blackPlastic, { y: TOP + 0.02, z: PAN_Z, bottom: true }, 20);
    for (const a of [45, -45]) box(cm, 17.5, 0.26, 0.9, MAT.blackPlastic, { y: TOP + 0.62, z: PAN_Z, ry: a, bottom: true });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(cm, 0.5, 0.5, 0.14, MAT.rubber, { x: sx * 5.9, y: TOP + 0.87, z: PAN_Z + sz * 5.9, bottom: true }, 12);
    plate(cm, 14, 0.4, 15, 0.9, 0.12, SATIN_STEEL, { y: TOP + 1.0, z: PAN_Z });

    bubbleLevel(cm, 1.5, { x: -8.4, y: TOP, z: -10.8 });

    // ---------------------------------------------------------------- front panel (18°)
    const f = faceFrame(cm, 0, (TOP + FRONT_Y) / 2, (CON_Z + 12.5) / 2, SLOPE);
    box(f, 18.6, 6.8, 0.05, MAT.absDark, { y: 0.05, z: 0.025 });
    box(f, 10.5, 3.5, 0.04, MAT.keycapDark, { x: -2.8, y: 1.55, z: 0.07 });
    const win = lcd(f, { w: 10, h: 3, digits: 6, kind: 'lcd' }, { x: -2.8, y: 1.55, z: 0.095 });
    keypad(f, 5, 1, { w: 2.2, d: 1.1, h: 0.3, gap: 0.5 }, MAT.keycap, { x: -2.8, y: -1.75, z: 0.05, rx: 90 });
    logoBadge(f, 3.0, spec.line, { x: 6.3, y: 0.75, z: 0.06 });

    // ---------------------------------------------------------------- weighing
    const w = weighing([win.display], { target: () => 238.07, decimals: 2 });

    return {
      root,
      size: { w: 0.2, d: 0.25, h: 0.08 },
      weigh: w.weigh,
      update: w.update,
    };
  },
};

export default def;
