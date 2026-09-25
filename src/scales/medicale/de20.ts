import { box, caster, createScaleRoot, cyl, logoBadge, MAT, rbox, tubePath, visitorWeight, visore, weighing } from '../kit';
import { SPECS } from '../specs';
import type { ScaleDef } from '../types';
import { group, SATIN, slab, visoreBadge } from './_parts-floor';

/**
 * DE20 — electronic chair scale on 4 swivel casters.
 * Recipe (cm, catalogue): overall 59 × 104 × 96; base frame of Ø3 tube 55 × 70 at y=12; seat
 * 55 × 6 × 40 at y≈50; backrest 50 × 40 × 5 reclined 8°, from 56 to 96; armrest pads 40 × 4 × 6
 * at y≈70 on Ø2.5 posts; footrest 40 × 20 at y≈10 about 25 cm ahead of the seat on two tube
 * brackets; push handle Ø3 at y=96; VISORE on the back, facing the operator who pushes the chair.
 * Grey upholstery on a white frame. The seat faces +Z; the display faces −Z (operator side).
 *
 * No standOn: the chair weighs whoever sits down, so the world triggers it by proximity and the
 * whole footprint stays solid.
 */
const spec = SPECS.de20;

const def: ScaleDef = {
  spec,
  build() {
    const { root, cm } = createScaleRoot(spec.id);
    // Built around the seat; shifted so the footprint (display at the back, footrest ahead) is centred.
    const g = group(cm, { z: -6 });

    // ---------------------------------------------------------------- weighing base on casters
    const FX = 26;
    const FZ0 = -36;
    const FZ1 = 32;
    tubePath(
      g,
      [
        [-FX, 12, FZ0],
        [FX, 12, FZ0],
        [FX, 12, FZ1],
        [-FX, 12, FZ1],
      ],
      1.5,
      MAT.paintWhite,
      { closed: true, cornerRadius: 5 },
    );
    for (const z of [-22, 16]) cyl(g, 1.5, 1.5, FX * 2, MAT.paintWhite, { y: 12, z, rz: 90 }, 16);
    for (const x of [-FX, FX]) for (const z of [FZ0, FZ1]) caster(g, 7.5, { x, z });
    // Load-cell blocks where the chair frame rests on the base.
    for (const x of [-FX, FX]) for (const z of [-22, 16]) rbox(g, 5, 3.2, 8, 0.6, MAT.paintGrey, { x, y: 12.8, z, bottom: true });

    // ---------------------------------------------------------------- chair frame
    for (const x of [-FX, FX]) cyl(g, 1.25, 1.25, 30.5, MAT.paintWhite, { x, y: 15.8, z: 16, bottom: true }, 16);
    // Rear posts rising into the push handle (reclined 8° above the seat).
    const REC = Math.tan((8 * Math.PI) / 180);
    const handleZ = -22 - 40 * REC;
    tubePath(
      g,
      [
        [-FX, 15.5, -22],
        [-FX, 56, -22],
        [-FX, 96, handleZ],
        [FX, 96, handleZ],
        [FX, 56, -22],
        [FX, 15.5, -22],
      ],
      1.5,
      MAT.paintWhite,
      { cornerRadius: 6 },
    );
    // Seat frame.
    tubePath(
      g,
      [
        [-FX, 45.5, -21],
        [FX, 45.5, -21],
        [FX, 45.5, 18],
        [-FX, 45.5, 18],
      ],
      1.25,
      MAT.paintWhite,
      { closed: true, cornerRadius: 4 },
    );
    box(g, 53, 1.2, 39, MAT.paintGrey, { y: 47.0, z: -1.5 });
    // Electronics box under the seat.
    rbox(g, 28, 6, 16, 1, MAT.absGrey, { y: 40.4, z: -6, bottom: true });

    // ---------------------------------------------------------------- upholstery
    rbox(g, 55, 6, 40, 2.2, MAT.upholsteryGrey, { y: 47.3, z: -1, bottom: true });
    slab(g, 55.3, 0.45, 40.3, 2.35, 0.1, MAT.rubberGrey, { y: 50.08, z: -1 }); // piping seam
    const back = group(g, { y: 56, z: -22, rx: -8 });
    rbox(back, 50, 40, 1.2, 0.5, MAT.paintGrey, { y: 20, z: 2.1 });
    rbox(back, 50, 40, 5, 2.2, MAT.upholsteryGrey, { y: 20, z: 5.2 });
    slab(back, 50.3, 0.45, 40.3, 2.35, 0.1, MAT.rubberGrey, { y: 20, z: 4.98, rx: 90 });
    for (const x of [-25, 25]) for (const y of [8, 32]) box(back, 3, 4, 2.4, MAT.paintGrey, { x, y, z: 0.8 });
    logoBadge(back, 5, 'medicale', { y: 33.2, z: 7.76 });
    logoBadge(back, 4, 'medicale', { y: 11, z: 1.44, ry: 180 });

    // ---------------------------------------------------------------- armrests
    for (const s of [-1, 1]) {
      tubePath(
        g,
        [
          [s * 28.2, 46.2, 14],
          [s * 28.2, 67.5, 14],
          [s * 28.2, 67.5, -22.2],
        ],
        1.25,
        MAT.paintWhite,
        { cornerRadius: 4 },
      );
      box(g, 3.2, 2.6, 3.2, MAT.paintGrey, { x: s * 27.4, y: 46.6, z: 14 });
      box(g, 4.4, 3.2, 3.4, MAT.paintGrey, { x: s * 27.1, y: 67.5, z: -23.3 }); // fold-up hinge
      rbox(g, 6, 4, 34, 1.6, MAT.upholsteryGrey, { x: s * 26.8, y: 68.7, z: 1, bottom: true });
    }

    // ---------------------------------------------------------------- footrest
    for (const s of [-1, 1])
      tubePath(
        g,
        [
          [s * 14, 45.6, 17.5],
          [s * 14, 8.2, 38],
          [s * 14, 8.2, 53],
        ],
        1.1,
        MAT.paintWhite,
        { cornerRadius: 6 },
      );
    slab(g, 40, 1.4, 20, 2, 0.3, SATIN, { y: 9.3, z: 45 });
    slab(g, 37, 0.35, 17, 1.5, 0.08, MAT.rubberGrey, { y: 10.6, z: 45 });

    // ---------------------------------------------------------------- push handle + display
    for (const s of [-1, 1]) cyl(g, 2.1, 2.1, 14, MAT.rubberGrey, { x: s * 12, y: 96, z: handleZ, rz: 90 }, 20);
    cyl(g, 2.0, 2.0, 5, MAT.absGrey, { y: 96, z: handleZ, rz: 90 }, 20);
    const HY = 86;
    const HZ = -36.5;
    const TILT = 40;
    const head = visore(g, { y: HY, z: HZ, ry: 180, tilt: TILT });
    visoreBadge(head, 3);
    const mount = group(group(g, { y: HY, z: HZ, ry: 180 }), { rx: -TILT });
    rbox(mount, 9, 7, 2, 0.6, MAT.absGrey, { z: -2.8 });
    tubePath(
      g,
      [
        [0, 96, handleZ],
        [0, 91, -30.5],
        [0, 84.6, -34.2],
      ],
      1.0,
      MAT.stainless,
      { cornerRadius: 3 },
    );
    // Load-cell cable from the electronics box up the right rear post to the display.
    tubePath(
      g,
      [
        [14, 43.4, -8],
        [24, 43.4, -19.5],
        [25.3, 50, -23.9],
        [25.3, 86, -28.3],
        [14, 92.6, -30.6],
        [2.5, 86, -34],
      ],
      0.35,
      MAT.blackPlastic,
      { cornerRadius: 3, radialSegments: 8 },
    );

    // ---------------------------------------------------------------- behaviour
    const heightCm = 170;
    let w = 0;
    const main = weighing([head.main], { target: () => (w = visitorWeight()), decimals: 1 });
    const bmi = weighing(head.sub ? [head.sub] : [], { target: () => Math.round((w / (heightCm / 100) ** 2) * 10) / 10, decimals: 1 });

    return {
      root,
      size: { w: 0.6, d: 0.98, h: 0.98 },
      weigh(on) {
        main.weigh(on);
        bmi.weigh(on);
      },
      update(dt) {
        main.update(dt);
        bmi.update(dt);
      },
    };
  },
};

export default def;
