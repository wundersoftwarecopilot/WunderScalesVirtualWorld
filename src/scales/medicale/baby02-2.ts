import { createScaleRoot, cyl, lcd, logoBadge, MAT, rbox, weighing } from '../kit';
import { SPECS } from '../specs';
import type { ScaleDef } from '../types';
import { babyTray, babyWeight, group, prism, SEAM, slab, TRAY_ABS } from './_parts-table';

/**
 * BABY02-2 — compact electronic baby scale with the display built into the front (Peso-Milk).
 * Recipe (cm, catalogue: 56 × 45 × 14.5, tray 56 × 29): a low rounded ABS base 56 × 45 × 6 on
 * rubber feet; the bathtub tray (half ellipsoid 56 × 29, 7.8 deep) over the rear two-thirds; at the
 * front centre a raised display pod 21.5 wide whose top slopes ~17° towards the operator, carrying
 * the 5-digit weight LCD (14 × 3.5) in a dark window, the small Peso-Milk LCD (6 × 2), the logo and
 * a row of 4 round keys (Ø1.5). White latex-free ABS, dark display windows.
 *
 * Behaviour: when the visitor comes close a demo baby weight (2.8–4.9 kg, 3 decimals) counts up on
 * the main window and the milk intake (kg) on the small one.
 */
const spec = SPECS['baby02-2'];

const W = 56;
const D = 45;
const FOOT = 0.7;
const BASE_TOP = 6.2;
const TZ = -7.5;
const TRY = 7.8;
const RIM = BASE_TOP + 0.5 + TRY;

const def: ScaleDef = {
  spec,
  build() {
    const { root, cm } = createScaleRoot(spec.id);

    // ---------------------------------------------------------------- base (two shells + seam)
    for (const x of [-23, 23]) for (const z of [-18, 18]) cyl(cm, 1.3, 1.5, FOOT, MAT.rubber, { x, z, y: 0, bottom: true }, 16);
    slab(cm, W, 2.3, D, 7, 0.8, MAT.abs, { y: FOOT });
    slab(cm, W - 0.6, 0.4, D - 0.6, 6.7, 0.1, SEAM, { y: FOOT + 2.3 });
    slab(cm, W, BASE_TOP - FOOT - 2.7, D, 7, 0.8, MAT.abs, { y: FOOT + 2.7 });
    cyl(cm, 0.55, 0.55, 0.3, MAT.blackPlastic, { x: 19, y: 3.8, z: -D / 2 - 0.05, rx: 90 }, 12);

    // ---------------------------------------------------------------- tray over the rear two-thirds
    cyl(cm, 5, 5.5, 0.25, MAT.rubberGrey, { y: BASE_TOP, z: TZ, bottom: true }, 24);
    babyTray(cm, 28, TRY, 14.5, TRAY_ABS, { y: RIM, z: TZ });

    // ---------------------------------------------------------------- display pod (front centre)
    // Side profile [z, y]: low front lip, top sloping up towards the tray.
    prism(
      cm,
      [
        [7.9, BASE_TOP - 0.1],
        [21.8, BASE_TOP - 0.1],
        [21.8, 7.3],
        [9.0, 11.3],
        [7.9, 11.3],
      ],
      21.5,
      MAT.abs,
      {},
      0.4,
    );
    const slope = Math.atan2(4.0, 12.8);
    const nz = Math.sin(slope);
    const ny = Math.cos(slope);
    const face = group(cm, { y: 9.3 + 0.4 * ny, z: 15.4 + 0.4 * nz, rx: -(90 - (slope * 180) / Math.PI) });
    // Weight window: dark bezel with the 5-digit LCD.
    rbox(face, 16.6, 4.6, 0.3, 0.5, MAT.lcdGlass, { y: 3.0 });
    const main = lcd(face, { w: 14, h: 3.5, digits: 5 }, { y: 3.0, z: 0.16 });
    // Peso-Milk window and the logo beside it.
    rbox(face, 7.4, 2.8, 0.3, 0.4, MAT.lcdGlass, { x: -4.6, y: -1.2 });
    const milkWin = lcd(face, { w: 6, h: 2, digits: 4 }, { x: -4.6, y: -1.2, z: 0.16 });
    logoBadge(face, 3, 'medicale', { x: 5.4, y: -1.1, z: 0.02 });
    // Four round keys (on/off dark), on a slightly recessed grey membrane strip.
    rbox(face, 14.6, 2.6, 0.12, 0.6, MAT.absGrey, { y: -4.75 });
    for (let i = 0; i < 4; i++) cyl(face, 0.75, 0.75, 0.4, i === 0 ? MAT.keycapDark : MAT.keycap, { x: -5.25 + i * 3.5, y: -4.75, z: 0.2, rx: 90 }, 16);

    // ---------------------------------------------------------------- behaviour
    let baby = 0;
    const weight = weighing([main.display], { target: () => (baby = babyWeight()), decimals: 3 });
    const milk = weighing([milkWin.display], {
      target: () => Math.round(Math.min(0.16, 0.04 + baby * 0.02 + Math.random() * 0.03) * 1000) / 1000,
      decimals: 3,
    });

    return {
      root,
      size: { w: 0.58, d: 0.45, h: 0.151 },
      weigh(active) {
        weight.weigh(active);
        milk.weigh(active);
      },
      update(dt) {
        weight.update(dt);
        milk.update(dt);
      },
    };
  },
};

export default def;
