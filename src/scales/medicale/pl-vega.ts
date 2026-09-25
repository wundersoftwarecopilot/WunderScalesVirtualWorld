import { box, caster, createScaleRoot, cyl, lcd, logoBadge, MAT, rbox, rectCm, tubePath, weighing } from '../kit';
import { SPECS } from '../specs';
import type { ScaleDef } from '../types';
import { group, SATIN, slab, slottedPanel } from './_parts-floor';

/**
 * PL-VEGA — height-adjustable bariatric bed scale (therapy, dialysis, blood draws).
 * Recipe (cm, catalogue: 222 × 100.5–102 × 40–83.5 H, 4 sections, 4 load cells): chassis of 5 × 5
 * box tube 190 × 80 at y≈15 on 4 casters Ø10; two scissor lifts (X struts) near the ends; deck of
 * 4 mattress sections 90 wide × 7.5 thick at y≈58 (head 60 raised 30°, back 45, seat 30,
 * legs 65); head/footboards 100 × 40 × 3; tubular side rails on Ø2 posts; controller box
 * 20 × 12 × 6 with the weight display at the foot end. White frame, mid-grey mattress.
 *
 * The bed runs along Z: head at −Z, foot (display) at +Z facing the visitor. No standOn; the
 * whole footprint is solid; walking up to it shows a patient weight on the foot-end display.
 */
const spec = SPECS['pl-vega'];

const DECK_Y = 49; // top of the weighed deck frame
const MAT_T = 7.5;
const PLATE_T = 1.5;

const def: ScaleDef = {
  spec,
  build() {
    const { root, cm } = createScaleRoot(spec.id);
    // The foot-end controller sticks out 6 cm: shift so the overall footprint is centred.
    cm.position.z = -0.03;

    // ---------------------------------------------------------------- chassis on casters
    for (const s of [-1, 1]) box(cm, 5, 5, 190, MAT.paintWhite, { x: s * 37.5, y: 15 });
    for (const z of [-92.5, 0, 92.5]) box(cm, 70, 5, 5, MAT.paintWhite, { y: 15, z });
    for (const x of [-37.5, 37.5]) for (const z of [-92.5, 92.5]) caster(cm, 10, { x, z });
    // Central-locking brake pedals at the foot end.
    for (const s of [-1, 1]) box(cm, 2.2, 1.2, 7, MAT.blackPlastic, { x: s * 37.5, y: 11.6, z: 99 });
    // Motor / battery housing.
    rbox(cm, 34, 10, 22, 1.5, MAT.absGrey, { y: 17.5, bottom: true });

    // ---------------------------------------------------------------- lift frame + scissors
    for (const s of [-1, 1]) box(cm, 4, 4, 184, MAT.paintWhite, { x: s * 37.5, y: 40 });
    for (const z of [-90, -50, 50, 90]) box(cm, 71, 4, 4, MAT.paintWhite, { y: 40, z });
    const run = 52;
    const rise = 14;
    const L = Math.hypot(run, rise);
    const ang = (Math.atan2(rise, run) * 180) / Math.PI;
    for (const z0 of [-60, 60]) {
      for (const s of [-1, 1]) {
        box(cm, 4, 6, L, MAT.paintWhite, { x: s * 33, y: 28, z: z0, rx: -ang }); // A: low at −Z end
        box(cm, 4, 6, L, MAT.paintWhite, { x: s * 28.5, y: 28, z: z0, rx: ang }); // B: low at +Z end
        cyl(cm, 1.3, 1.3, 11, SATIN, { x: s * 30.75, y: 28, z: z0, rz: 90 }, 14);
        for (const dz of [-run / 2, run / 2]) {
          box(cm, 9.5, 4.5, 4.5, MAT.paintGrey, { x: s * 30.75, y: 19.75, z: z0 + dz });
          box(cm, 9.5, 4.5, 4.5, MAT.paintGrey, { x: s * 30.75, y: 36.25, z: z0 + dz });
        }
      }
      for (const dz of [-run / 2, run / 2]) cyl(cm, 1.4, 1.4, 58, MAT.paintWhite, { y: 19.75, z: z0 + dz, rz: 90 }, 14);
    }
    // Linear actuators from the motor housing to the lift frame.
    for (const s of [-1, 1]) {
      tubePath(
        cm,
        [
          [0, 23, s * 12],
          [0, 32.4, s * 38],
        ],
        2.3,
        MAT.absDark,
      );
      tubePath(
        cm,
        [
          [0, 31.5, s * 35.5],
          [0, 37.8, s * 49],
        ],
        1.0,
        SATIN,
      );
    }

    // ---------------------------------------------------------------- load cells + weighed deck frame
    for (const x of [-37.5, 37.5]) for (const z of [-90, 90]) box(cm, 5, 3, 9, MAT.stainless, { x, y: 43.5, z });
    for (const s of [-1, 1]) box(cm, 4, 4, 200, MAT.paintWhite, { x: s * 46, y: DECK_Y - 2 });
    for (const z of [-90, -45, 90]) box(cm, 88, 4, 4, MAT.paintWhite, { y: DECK_Y - 2, z });

    // ---------------------------------------------------------------- deck sections + mattresses
    const section = (parent: typeof cm, z0: number, z1: number) => {
      const len = z1 - z0 - 1;
      const zc = (z0 + z1) / 2;
      box(parent, 90, PLATE_T, len, MAT.paintWhite, { y: PLATE_T / 2, z: zc });
      rbox(parent, 90, MAT_T, len, 2.5, MAT.mattress, { y: PLATE_T, z: zc, bottom: true });
      slab(parent, 90.3, 0.4, len + 0.3, 2.65, 0.1, MAT.rubberGrey, { y: PLATE_T + MAT_T / 2 - 0.2, z: zc });
    };
    const flat = group(cm, { y: DECK_Y });
    section(flat, -40, 5); // back
    section(flat, 5, 35); // seat
    section(flat, 35, 100); // legs
    // Head section raised 30° about its joint with the back section, on a gas strut.
    const headSec = group(cm, { y: DECK_Y, z: -40, rx: 30 });
    section(headSec, -60, 0);
    box(headSec, 4, 2, 5, MAT.paintGrey, { y: -1, z: -32 });
    tubePath(
      cm,
      [
        [0, DECK_Y - 1.5, -46],
        [0, 64.2, -67.2],
      ],
      1.4,
      MAT.absDark,
    );

    // ---------------------------------------------------------------- head/footboards
    for (const s of [-1, 1]) {
      slottedPanel(cm, 100, 40, 3, 5, { w: 26, h: 4.5, fromTop: 6 }, MAT.absGrey, { y: 44, z: s * 103.5 });
      for (const x of [-46, 46]) box(cm, 4, 6, 3.6, MAT.paintGrey, { x, y: 47, z: s * 101.7 });
    }

    // ---------------------------------------------------------------- side rails
    for (const s of [-1, 1]) {
      const x = s * 49.5;
      tubePath(
        cm,
        [
          [x, DECK_Y - 2, -58],
          [x, 80, -58],
          [x, 80, 68],
          [x, DECK_Y - 2, 68],
        ],
        1.5,
        MAT.paintWhite,
        { cornerRadius: 6 },
      );
      cyl(cm, 1.1, 1.1, 126, MAT.paintWhite, { x, y: 65, z: 5, rx: 90 }, 14);
      for (const z of [-16, 26]) cyl(cm, 1.0, 1.0, 80 - DECK_Y + 2, MAT.paintWhite, { x, y: DECK_Y - 2, z, bottom: true }, 12);
      for (const z of [-58, 68]) box(cm, 4.6, 5, 4.4, MAT.paintGrey, { x: s * 47.9, y: DECK_Y - 2, z });
    }

    // ---------------------------------------------------------------- controller at the foot end
    const CZ = 108;
    rbox(cm, 20, 12, 6, 1.2, MAT.abs, { y: 61, z: CZ, bottom: true });
    box(cm, 14.6, 5.6, 0.2, MAT.lcdGlass, { y: 69.2, z: CZ + 2.92 });
    const win = lcd(cm, { w: 13, h: 4.2, digits: 5, kind: 'lcd' }, { y: 69.2, z: CZ + 3.06 });
    for (let k = 0; k < 4; k++) cyl(cm, 0.75, 0.75, 0.4, k === 0 ? MAT.keycapDark : MAT.keycap, { x: -7 + k * 2.6, y: 64.2, z: CZ + 3.1, rx: 90 }, 16);
    logoBadge(cm, 2.8, 'medicale', { x: 6.6, y: 64.9, z: CZ + 3.06 });
    for (const s of [-1, 1])
      tubePath(
        cm,
        [
          [s * 7, 71, 105.3],
          [s * 7, 86, 105.3],
          [s * 7, 86, 101.4],
          [s * 7, 81, 101.4],
        ],
        0.45,
        SATIN,
        { cornerRadius: 1.2 },
      );
    tubePath(
      cm,
      [
        [6, 61.2, 107.6],
        [6, 50, 107.6],
        [9, 36, 104],
        [12, 24.5, 96],
        [12, 24.5, 11.2],
      ],
      0.4,
      MAT.blackPlastic,
      { cornerRadius: 5, radialSegments: 8 },
    );

    // ---------------------------------------------------------------- logos on the boards
    logoBadge(cm, 7, 'medicale', { x: -33, y: 66, z: 105.06 });
    logoBadge(cm, 7, 'medicale', { y: 64, z: -105.06, ry: 180 });

    // ---------------------------------------------------------------- behaviour
    const main = weighing([win.display], { target: () => Math.round((66 + Math.random() * 52) * 10) / 10, decimals: 1 });

    return {
      root,
      size: { w: 1.02, d: 2.22, h: 0.87 },
      colliders: [rectCm(0, 0, 102, 222)],
      weigh: main.weigh,
      update: main.update,
    };
  },
};

export default def;
