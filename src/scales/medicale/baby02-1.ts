import { createScaleRoot, cyl, foot, logoBadge, MAT, rbox, tubePath, visore, weighing } from '../kit';
import { SPECS } from '../specs';
import type { ScaleDef } from '../types';
import { babyTray, babyWeight, SEAM, slab, visoreBadge, TRAY_ABS } from './_parts-table';

/**
 * BABY02-1 — electronic baby scale with the display on a column (Milk-Intake function).
 * Recipe (cm, catalogue: 56 × 45 × 46, tray 56 × 29): a flat rounded ABS base 56 × 5 × 45 on four
 * adjustable feet; the bathtub-shaped tray (half ellipsoid 56 × 29, 8.5 deep, rim at 15.5) on the
 * front part of the base, carried by the load-cell boss, with a rolled rim and an anti-tip stay
 * under each end; a slim 4 × 4 column rising at the rear centre to the standard VISORE head,
 * tilted towards the operator. White ABS throughout, dark display windows.
 *
 * Behaviour: when the visitor comes close a demo baby weight (2.8–4.9 kg, 3 decimals) counts up on
 * the main window and the milk intake (kg) on the small one.
 */
const spec = SPECS['baby02-1'];

const W = 56;
const D = 45;
const BASE_Y = 1.0;
const BASE_TOP = 6.0;
/** Tray: centre z, rim height and half-ellipsoid radii. */
const TZ = 3.5;
const RIM = 15.5;
const TRX = 28;
const TRZ = 14.5;
const TRY = 8.5;
/** Column position and head tilt. */
const CZ = -18.5;
const TILT = 35;

const def: ScaleDef = {
  spec,
  build() {
    const { root, cm } = createScaleRoot(spec.id);

    // ---------------------------------------------------------------- base (two shells + seam)
    for (const x of [-23, 23]) for (const z of [-17.5, 17.5]) foot(cm, 2.4, 1.2, { x, z });
    slab(cm, W, 2.4, D, 7, 0.8, MAT.abs, { y: BASE_Y });
    slab(cm, W - 0.6, 0.4, D - 0.6, 6.7, 0.1, SEAM, { y: BASE_Y + 2.4 });
    slab(cm, W, BASE_TOP - BASE_Y - 2.8, D, 7, 0.8, MAT.abs, { y: BASE_Y + 2.8 });
    // Power socket on the back.
    cyl(cm, 0.55, 0.55, 0.3, MAT.blackPlastic, { x: 19, y: 3.6, z: -D / 2 - 0.05, rx: 90 }, 12);

    // ---------------------------------------------------------------- tray on its load-cell boss
    cyl(cm, 4, 5.5, RIM - TRY - BASE_TOP - 0.05, MAT.absGrey, { y: BASE_TOP, z: TZ, bottom: true }, 24);
    babyTray(cm, TRX, TRY, TRZ, TRAY_ABS, { y: RIM, z: TZ });
    // Anti-tip stays: bent stainless wire from the base up under each tray end, rubber tip.
    for (const s of [-1, 1]) {
      tubePath(
        cm,
        [
          [s * 16.5, BASE_TOP - 0.2, TZ],
          [s * 20.5, 8.4, TZ],
          [s * 24.6, 10.5, TZ],
        ],
        0.5,
        MAT.stainless,
        { cornerRadius: 2.5, radialSegments: 10 },
      );
      cyl(cm, 1.3, 1.5, 0.35, MAT.absGrey, { x: s * 16.5, y: BASE_TOP, z: TZ, bottom: true }, 16);
      cyl(cm, 0.75, 0.75, 0.45, MAT.rubber, { x: s * 24.78, y: 10.59, z: TZ, rz: s * -63 }, 12);
    }

    // ---------------------------------------------------------------- column + VISORE head
    const colTop = 35.6;
    slab(cm, 7, 0.8, 7, 1.6, 0.3, MAT.absGrey, { y: BASE_TOP, z: CZ });
    rbox(cm, 4, colTop - BASE_TOP, 4, 0.8, MAT.abs, { y: BASE_TOP, z: CZ, bottom: true });
    // Tilt joint: a knuckle across the column top, biting into the back of the head.
    cyl(cm, 1.8, 1.8, 7, MAT.absGrey, { y: colTop, z: CZ - 0.3, rz: 90 }, 24);
    for (const s of [-1, 1]) cyl(cm, 1.0, 1.0, 0.4, MAT.stainless, { x: s * 3.6, y: colTop, z: CZ - 0.3, rz: 90 }, 16);
    const head = visore(cm, { y: 37.5, z: CZ + 1.64, tilt: TILT });
    visoreBadge(head, 3);
    // Back cover of the head (a shallow boss on the lower back shell).
    const face = head.object.children[0];
    rbox(face, 12, 7, 1.2, 0.5, MAT.absGrey, { y: -2.2, z: -2.4 });

    // ---------------------------------------------------------------- logo on the base nose
    logoBadge(cm, 3, 'medicale', { y: 4.0, z: D / 2 + 0.03 });

    // ---------------------------------------------------------------- behaviour
    let baby = 0;
    const main = weighing([head.main], { target: () => (baby = babyWeight()), decimals: 3 });
    const milk = weighing(head.sub ? [head.sub] : [], {
      target: () => Math.round(Math.min(0.16, 0.04 + baby * 0.02 + Math.random() * 0.03) * 1000) / 1000,
      decimals: 3,
    });

    return {
      root,
      size: { w: 0.58, d: 0.45, h: 0.46 },
      weigh(active) {
        main.weigh(active);
        milk.weigh(active);
      },
      update(dt) {
        main.update(dt);
        milk.update(dt);
      },
    };
  },
};

export default def;
