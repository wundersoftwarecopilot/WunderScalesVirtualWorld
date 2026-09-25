import { box, createScaleRoot, cyl, logoBadge, MAT, rbox, rectCm, tubePath, weighing } from '../kit';
import { SPECS } from '../specs';
import type { ScaleDef } from '../types';
import { cable, checkerMaterial, dataPlate, EPOXY, filletPoly, hex, junctionBox, levelFoot, PU_WHEEL, slab, wxStand, ZINC } from './_floor-parts';

/**
 * WP4-U — U-shaped 4-cell pallet platform (est): two arms 22 × 125 joined at the rear by a
 * 105 × 22 crossbar, leaving a 61 cm slot open to the front for the pallet truck. 8 cm frame,
 * 13 cm with feet, dark epoxy with a checker-plate top. A tilt handle and two transport wheels
 * on the rear, a junction box on the right arm and a small WX head on a 58 cm column beside it.
 * No standOn: the visitor can walk into the slot; the indicator shows a pallet reading nearby.
 */
const spec = SPECS['wp4-u'];

const CHECKER = checkerMaterial(EPOXY, 1 / 6);

const W = 105; // outer width
const D = 125; // outer depth
const ARM = 22;
const BAR = 22;

/** U outline in plan, inset by i (i > 0 shrinks the material), centred on the U. */
function uOutline(i: number): Array<[number, number]> {
  const hw = W / 2;
  const hd = D / 2;
  const iw = hw - ARM; // half slot width
  const slotRear = -hd + BAR;
  const pts: Array<[number, number]> = [
    [-hw + i, hd - i],
    [-iw - i, hd - i],
    [-iw - i, slotRear - i],
    [iw + i, slotRear - i],
    [iw + i, hd - i],
    [hw - i, hd - i],
    [hw - i, -hd + i],
    [-hw + i, -hd + i],
  ];
  return filletPoly(pts, [1.5, 1.5, 3, 3, 1.5, 1.5, 1.5, 1.5]);
}

const def: ScaleDef = {
  spec,
  build() {
    const { root, cm } = createScaleRoot(spec.id);
    const ux = -20; // U centre (the indicator stands to the right)
    const uz = 5;
    const TOP = 13;
    const at = (pts: Array<[number, number]>) => pts.map(([x, z]) => [x + ux, z + uz] as [number, number]);

    // Frame: bottom flange, recessed web, checker plate.
    slab(cm, at(uOutline(0)), 5, 1, EPOXY);
    slab(cm, at(uOutline(1)), 5.9, 6.7, EPOXY);
    slab(cm, at(uOutline(0.25)), TOP - 0.55, 0.55, CHECKER, 0.25);

    // Feet at the arm ends and the rear corners.
    const fx = W / 2 - ARM / 2;
    for (const sx of [-1, 1]) for (const fz of [D / 2 - 6, -D / 2 + 6]) {
      levelFoot(cm, ux + sx * fx, uz + fz, 5, 5);
      hex(cm, 1.4, 0.5, ZINC, { x: ux + sx * (fx + 3), z: uz + fz, y: 4.5, bottom: true });
    }

    // Rear: tilt handle rising from two pivot brackets, and two transport wheels that only touch
    // the floor when the platform is tipped back onto them.
    const R = uz - D / 2 + 1; // rear web face
    for (const sx of [-1, 1]) {
      rbox(cm, 3.2, 5, 3, 0.5, EPOXY, { x: sx * 20 + ux, y: 9, z: R - 1.45 });
      cyl(cm, 0.6, 0.6, 4.4, ZINC, { x: sx * 20 + ux, y: 9.6, z: R - 1.8, rz: 90 }, 10);
    }
    tubePath(
      cm,
      [
        [ux - 20, 9.6, R - 1.8],
        [ux - 20, 22, R - 9],
        [ux + 20, 22, R - 9],
        [ux + 20, 9.6, R - 1.8],
      ],
      1.5,
      MAT.brushed,
      { cornerRadius: 3.5 },
    );
    cyl(cm, 1.95, 1.95, 22, MAT.rubber, { x: ux, y: 22, z: R - 9, rz: 90 }, 16);
    for (const sx of [-1, 1]) {
      const wx = ux + sx * 42;
      for (const s of [-1, 1]) box(cm, 0.6, 6.5, 8, EPOXY, { x: wx + s * 2.1, y: 6.2, z: R - 4 });
      cyl(cm, 4, 4, 3, PU_WHEEL, { x: wx, y: 5.3, z: R - 5.3, rz: 90 }, 20);
      cyl(cm, 1.8, 1.8, 3.3, MAT.stainless, { x: wx, y: 5.3, z: R - 5.3, rz: 90 }, 14);
      cyl(cm, 0.5, 0.5, 5, ZINC, { x: wx, y: 5.3, z: R - 5.3, rz: 90 }, 8);
    }

    // Front arm noses: logo on the right, a data plate on the left.
    logoBadge(cm, 4.4, spec.line, { x: ux + fx, y: 9.9, z: uz + D / 2 - 1 + 0.06 });
    dataPlate(cm, 8, 4, { x: ux - fx, y: 9.25, z: uz + D / 2 - 1 + 0.02 });

    // Junction box on the outer face of the right arm, cable to the indicator stand.
    const jbX = ux + W / 2 - 1 + 2.1;
    const jbZ = uz - 38;
    junctionBox(cm, { x: jbX, y: 9.25, z: jbZ, ry: 90 });
    const colX = ux + W / 2 + 25;
    const colZ = -32;
    const wx = wxStand(cm, { x: colX, z: colZ, y0: 0, column: 58, r: 2, basePlate: 30, tilt: 22, baseLogo: { d: 4.4, division: spec.line } });
    cable(cm, [
      [jbX - 1, 4.7, jbZ],
      [jbX - 1, 1.2, jbZ + 1.5],
      [jbX + 1.5, 0.3, jbZ + 4],
      [colX - 18.5, 0.3, colZ],
      [colX - 15.7, 0.4, colZ],
      [colX - 14.5, 2.35, colZ],
      [colX - 5.6, 2.6, colZ],
    ]);

    // Demo reading: a loaded EUR pallet.
    const scale = weighing([wx.display], { target: () => 412.5, decimals: 1 });

    return {
      root,
      size: { w: 1.46, d: 1.35, h: 0.83 },
      colliders: [
        rectCm(ux - fx, uz, ARM, D),
        rectCm(ux + fx, uz, ARM, D),
        rectCm(ux, uz - D / 2 + BAR / 2 - 5, W, BAR + 10),
        rectCm(colX, colZ, 30, 14),
      ],
      weigh: scale.weigh,
      update: scale.update,
    };
  },
};

export default def;
