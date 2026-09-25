import * as THREE from 'three';
import { createScaleRoot, cyl, logoBadge, MAT, rbox, rectCm, visitorWeight, weighing } from '../kit';
import { SPECS } from '../specs';
import type { ScaleDef } from '../types';
import { cable, gland, hex, roundedRect, slab, wxStand, ZINC } from './_floor-parts';

/**
 * WX + WPA — single-cell platform (est 40 × 50): light grey die-cast aluminium base with
 * rounded vertical edges on 4 rubber feet, a removable stainless plate floating on the cell with
 * a 2 mm shadow gap, a cast bracket at the rear centre holding a Ø4.5 stainless column and the
 * WX indicator tilted 18° towards the user. Total height ≈ 118 cm.
 */
const spec = SPECS['wx-wpa'];

/** Painted die-cast aluminium, light grey. */
const WPA_GREY = new THREE.MeshStandardMaterial({ color: '#b4b7ba', roughness: 0.5, metalness: 0.25 });

const def: ScaleDef = {
  spec,
  build() {
    const { root, cm } = createScaleRoot(spec.id);
    const pz = 5.5; // platform centre Z (the column stands behind it)
    const PW = 40;
    const PD = 50;
    const PR = pz - PD / 2; // plate rear edge
    const BASE_Y0 = 2.6;
    const BASE_Y1 = 9.4;
    const PLATE_Y0 = 9.6;
    const TOP = 11.4;

    // Rubber feet with a short adjusting stud.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = sx * 14.5;
      const z = pz + sz * 18.5;
      cyl(cm, 2.5, 2.6, 1.3, MAT.rubber, { x, z, y: 0, bottom: true }, 18);
      cyl(cm, 0.6, 0.6, 1.5, MAT.stainless, { x, z, y: 1.3, bottom: true }, 10);
      hex(cm, 1.6, 0.5, ZINC, { x, z, y: 1.7, bottom: true });
    }
    // Die-cast base: rounded vertical edges r3, softened top/bottom edges.
    slab(cm, roundedRect(PW - 3.2, PD - 3.2, 2.4).map(([x, z]) => [x, z + pz]), BASE_Y0, BASE_Y1 - BASE_Y0, WPA_GREY, 0.6);
    // Stainless plate with a folded rim, overhanging the base by ~1.5 cm.
    slab(cm, roundedRect(PW - 0.6, PD - 0.6, 1.2).map(([x, z]) => [x, z + pz]), PLATE_Y0, TOP - PLATE_Y0, MAT.brushed, 0.3);

    // Cast bracket at the rear centre with a clamp boss for the column (fixed to the base, it
    // never touches the plate).
    const CZ = PR - 3.9;
    const brFront = pz - (PD - 3.2) / 2 - 0.6;
    const brBack = CZ - 3.6;
    rbox(cm, 9, 6, brFront - brBack + 0.4, 0.8, WPA_GREY, { y: 3.2, z: (brFront + brBack) / 2 + 0.2, bottom: true });
    cyl(cm, 3.4, 3.4, 9, WPA_GREY, { y: 3.2, z: CZ, bottom: true }, 24);
    for (const s of [-1, 1]) hex(cm, 1.3, 0.6, ZINC, { x: s * 3.35, y: 9.2, z: CZ - 1.2, rz: 90 });
    gland(cm, { x: 0, y: 5, z: brBack - 0.1, rx: -90 });

    // Column + WX head.
    const colTop = 12.2 + 86;
    const wx = wxStand(cm, { x: 0, z: CZ, y0: 12.2, column: 86, r: 2.25, tilt: 18 });
    // Cable from the bracket gland up the back of the column, held by three ties.
    cable(cm, [
      [0, 5, brBack - 1.6],
      [0, 7, brBack - 2.6],
      [0, 14, CZ - 2.85],
      [0, colTop - 6, CZ - 2.85],
      [0.6, colTop - 2.5, CZ - 3.3],
    ]);
    for (const y of [35, 60, 85]) cyl(cm, 3.3, 3.3, 0.6, MAT.blackPlastic, { y, z: CZ - 0.55 }, 16);

    // Logo on the front face of the base, under the plate's overhang.
    logoBadge(cm, 4, spec.line, { y: 6.5, z: pz + (PD - 3.2) / 2 + 0.62 });

    const scale = weighing([wx.display], { target: visitorWeight, decimals: 1 });

    return {
      root,
      size: { w: 0.41, d: 0.61, h: 1.2 },
      standOn: { ...rectCm(0, pz, PW, PD), y: TOP / 100 },
      colliders: [rectCm(0, CZ - 1, 10, 9)],
      weigh: scale.weigh,
      update: scale.update,
    };
  },
};

export default def;
