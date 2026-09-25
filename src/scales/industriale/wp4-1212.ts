import { createScaleRoot, cyl, logoBadge, MAT, rectCm, visitorWeight, weighing, wedge } from '../kit';
import { SPECS } from '../specs';
import type { ScaleDef } from '../types';
import { cable, checkerMaterial, dataPlate, EPOXY, hex, junctionBox, levelFoot, roundedRect, slab, wxStand, ZINC } from './_floor-parts';

/**
 * WP4 1212 + WX — 4-cell floor platform 120 × 120 cm, 8 cm frame (13 cm with feet), dark epoxy
 * with a checker-plate top, 4 adjustable feet inset 5 cm, a stainless junction box on the right
 * side, the RAMPA WP4 access ramp on the left, and the WX indicator on a Ø4 × 100 stainless
 * column (Ø35 base plate) 30 cm to the right, joined by a floor cable.
 */
const spec = SPECS['wp4-1212'];

/** Checker plate: one texture tile = 6 cm (diamonds ≈ 3 cm), shared by the plate and the ramp. */
const CHECKER = checkerMaterial(EPOXY, 1 / 6);

const def: ScaleDef = {
  spec,
  build() {
    const { root, cm } = createScaleRoot(spec.id);
    const px = -1; // platform centre X (the indicator column sits to the right)
    const S = 120;
    const TOP = 13;

    // Frame: bottom flange, recessed web (reads as a C-channel), checker plate on top.
    slab(cm, roundedRect(S, S, 1.5).map(([x, z]) => [x + px, z]), 5, 1, EPOXY);
    slab(cm, roundedRect(S - 2, S - 2, 1).map(([x, z]) => [x + px, z]), 5.9, 6.7, EPOXY);
    slab(cm, roundedRect(S - 0.5, S - 0.5, 1.5).map(([x, z]) => [x + px, z]), TOP - 0.55, 0.55, CHECKER, 0.25);

    // Load cells sit in the corners; adjustable feet under them, inset 5 cm.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      levelFoot(cm, px + sx * 55, sz * 55, 5, 6);
      // Cell mounting bolts visible on the underside flange corners.
      hex(cm, 1.6, 0.5, ZINC, { x: px + sx * 55 + sx * 3.2, z: sz * 55, y: 4.5, bottom: true });
    }

    // RAMPA WP4 on the left edge: checker-plate wedge up to the plate, with a hinge rod.
    wedge(cm, S - 4, TOP - 0.3, 45, CHECKER, { x: px - S / 2 - 22.5 - 0.05, y: 0, ry: -90 });
    cyl(cm, 0.9, 0.9, S - 6, MAT.brushed, { x: px - S / 2 - 0.6, y: TOP - 1.4, rx: 90 }, 12);

    // Junction box on the right side web, cable to the indicator column base.
    const jbZ = 8;
    junctionBox(cm, { x: px + S / 2 - 1 + 2.1, y: 9.25, z: jbZ, ry: 90 });

    // Front: logo badge and a plain data plate on the web.
    logoBadge(cm, 4.4, spec.line, { x: px + 38, y: 9.9, z: S / 2 - 1 + 0.06 });
    dataPlate(cm, 8, 4, { x: px - 38, y: 9.25, z: S / 2 - 1 + 0.02 });

    // WX indicator on its stainless column, 30 cm to the right of the platform.
    const colX = px + S / 2 + 30;
    const colZ = 25;
    const wx = wxStand(cm, { x: colX, z: colZ, y0: 0, column: 100, r: 2, basePlate: 35, tilt: 16, baseLogo: { d: 5, division: spec.line } });
    const jbX = px + S / 2 + 1.1;
    cable(cm, [
      [jbX, 4.7, jbZ],
      [jbX, 1.2, jbZ + 1.5],
      [jbX + 2, 0.3, jbZ + 5],
      [colX - 21, 0.3, colZ],
      [colX - 18.2, 0.4, colZ],
      [colX - 17, 2.35, colZ],
      [colX - 5.6, 2.6, colZ],
    ]);

    const scale = weighing([wx.display], { target: visitorWeight, decimals: 1 });

    return {
      root,
      size: { w: 2.14, d: 1.2, h: 1.26 },
      standOn: { ...rectCm(px, 0, S, S), y: TOP / 100 },
      colliders: [rectCm(colX, colZ, 30, 16)],
      weigh: scale.weigh,
      update: scale.update,
    };
  },
};

export default def;
