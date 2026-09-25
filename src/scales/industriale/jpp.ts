import * as THREE from 'three';
import { box, createScaleRoot, cyl, keep, keypad, logoBadge, MAT, rbox, weighing } from '../kit';
import { SPECS } from '../specs';
import type { ScaleDef } from '../types';
import { bubbleLevel, faceFrame, labelMaterial, plate, profileSolid, retailHead, rubberFoot, SATIN_STEEL } from './_table-parts';

/**
 * JPP — retail weight/price scale with a built-in thermal label printer and pole display.
 * Body 38 × 38 (est): grey ABS lower tray, off-white cover; satin stainless pan 37 × 1 × 24
 * (confirmed) on a 1 cm spider. Front-left: PLU console sloping 15° with an 8 × 4 PLU key grid,
 * a 3 × 4 numeric pad and a row of grey function keys. Front-right: the printer housing
 * 12.8 × 12.8 × 13.3 rising 3.5 cm above the pan, with a lid seam, lid button, spirit level, a
 * tear bar over the 6.4 × 0.35 paper slot and a 5 × 4 label that feeds out once the reading is
 * stable. Pole Ø3.5 (column 48 confirmed) on a rear bracket, double-faced head 32 × 8 × 7 with
 * VFD windows (weight / unit price / total) on both faces. About 62 tall.
 * Demo: 1.236 kg at 8.90 → 11.00.
 */
const spec = SPECS.jpp;

const ZB = 2.85;
const TOP = 10.5;
const SLOPE = 15;
const CON_Z = 6;
const FRONT_Y = TOP - (19 - CON_Z) * Math.tan((SLOPE * Math.PI) / 180);
const COL_Z = ZB - 21.5;
const HEAD_Y = 54;
/** Printer housing (x centre, z centre, top). */
const PX = 12.9;
const PZ = ZB + 12.65;
const PTOP = 16;
const PFRONT = ZB + 19.3;

const def: ScaleDef = {
  spec,
  build() {
    const { root, cm } = createScaleRoot(spec.id);

    // ---------------------------------------------------------------- body
    for (const x of [-15.5, 15.5]) for (const z of [-16, 16]) rubberFoot(cm, 2.8, 1.0, { x, z: ZB + z });
    rbox(cm, 38, 2.0, 38, 0.7, MAT.absGrey, { y: 1.0, z: ZB, bottom: true });
    box(cm, 37.2, 0.6, 37.2, MAT.absDark, { y: 2.8, z: ZB, bottom: true });
    profileSolid(
      cm,
      [
        [-19, 3.2],
        [19, 3.2],
        [19, FRONT_Y],
        [CON_Z, TOP],
        [-19, TOP],
      ],
      38,
      MAT.abs,
      { bevel: 0.5, radius: [0.3, 0.3, 0.9, 0.8, 1.2] },
      { z: ZB },
    );
    // Rear ports.
    box(cm, 7, 2.2, 0.2, MAT.absDark, { x: 10, y: 6.4, z: ZB - 19.08 });
    box(cm, 1.6, 1.2, 0.3, MAT.blackPlastic, { x: 8.2, y: 6.4, z: ZB - 19.2 });
    box(cm, 1.9, 1.4, 0.3, SATIN_STEEL, { x: 10.4, y: 6.4, z: ZB - 19.2 });
    box(cm, 1.2, 0.8, 0.3, MAT.blackPlastic, { x: 12.3, y: 6.4, z: ZB - 19.2 });

    // Pan on its spider.
    const panZ = ZB - 6.6;
    box(cm, 8, 1.05, 8, MAT.absDark, { y: TOP - 0.05, z: panZ, bottom: true });
    box(cm, 28, 0.45, 1.4, MAT.absDark, { y: TOP + 0.55, z: panZ, bottom: true });
    box(cm, 1.4, 0.45, 18, MAT.absDark, { y: TOP + 0.55, z: panZ, bottom: true });
    plate(cm, 37, 1.0, 24, 1.0, 0.25, SATIN_STEEL, { y: TOP + 1.0, z: panZ });

    // ---------------------------------------------------------------- PLU console (15°), front-left
    const f = faceFrame(cm, -6.25, (TOP + FRONT_Y) / 2, ZB + (CON_Z + 19) / 2, SLOPE);
    box(f, 24, 11.2, 0.06, MAT.absDark, { x: 0.25, z: 0.03 });
    keypad(f, 8, 4, { w: 1.8, d: 1.9, h: 0.3, gap: 0.35 }, MAT.keycap, { x: -2.755, y: -1.0, z: 0.06, rx: 90 });
    keypad(f, 3, 4, { w: 1.5, d: 1.9, h: 0.3, gap: 0.35 }, MAT.abs, { x: 9.07, y: -1.0, z: 0.06, rx: 90 });
    keypad(f, 7, 1, { w: 2.6, d: 1.05, h: 0.3, gap: 0.4 }, MAT.paintGrey, { x: 0.25, y: 4.35, z: 0.06, rx: 90 });

    // ---------------------------------------------------------------- printer housing, front-right
    rbox(cm, 12.8, PTOP - 3.2, 13.3, 1.0, MAT.abs, { x: PX, y: 3.2, z: PZ, bottom: true });
    box(cm, 10.6, 0.02, 0.12, MAT.absDark, { x: PX, y: PTOP + 0.005, z: PZ - 2.2 }); // lid seam
    cyl(cm, 0.65, 0.7, 0.25, MAT.absGrey, { x: PX - 3.6, y: PTOP, z: PZ + 3.6, bottom: true }, 16); // lid release
    bubbleLevel(cm, 1.4, { x: PX + 3.8, y: PTOP, z: PZ - 4.2 });
    box(cm, 6.4, 0.35, 0.1, MAT.blackPlastic, { x: PX, y: 13.8, z: PFRONT + 0.02 }); // paper slot
    box(cm, 7.0, 0.3, 0.3, SATIN_STEEL, { x: PX, y: 14.25, z: PFRONT + 0.12 }); // tear bar
    logoBadge(cm, 3.4, spec.line, { x: PX, y: 9.3, z: PFRONT + 0.03 });
    // The label: rests inside the housing, feeds out through the slot when printed.
    const label = keep(new THREE.Group());
    label.position.set(PX, 13.8, PFRONT);
    box(label, 5, 0.04, 4, labelMaterial(), { z: 2, castShadow: false });
    cm.add(label);
    const labelIn = -4.6;
    const labelOut = -0.2;
    label.position.z = PFRONT + labelIn;

    // ---------------------------------------------------------------- pole and double-faced head
    rbox(cm, 9, 7.5, 6, 1.0, MAT.absGrey, { y: 1.0, z: COL_Z, bottom: true });
    cyl(cm, 2.3, 2.5, 1.2, MAT.absGrey, { y: 8.5, z: COL_Z, bottom: true }, 24);
    cyl(cm, 1.75, 1.75, HEAD_Y - 9.0, SATIN_STEEL, { y: 9.0, z: COL_Z, bottom: true }, 24);
    rbox(cm, 6.5, 1.8, 5.2, 0.5, MAT.absGrey, { y: HEAD_Y - 1.6, z: COL_Z, bottom: true });
    const head = retailHead(cm, { w: 32, h: 8, dBottom: 7, dTop: 4.6, fields: [5, 5, 6], kind: 'vfd', logo: true }, { y: HEAD_Y, z: COL_Z });

    // ---------------------------------------------------------------- weighing + printing
    const kg = 1.236;
    const price = 8.9;
    const prices = [head.front[1], head.back[1]];
    let printing = false;
    const w = weighing([head.front[0], head.back[0]], {
      target: () => kg,
      decimals: 3,
      onStable: (stable) => {
        if (stable) printing = true;
      },
    });
    const t = weighing([head.front[2], head.back[2]], { target: () => Math.round(kg * price * 100) / 100, decimals: 2 });
    for (const d of prices) d.set(0, 2);

    return {
      root,
      size: { w: 0.386, d: 0.45, h: 0.62 },
      weigh(active) {
        w.weigh(active);
        t.weigh(active);
        for (const d of prices) d.set(active ? price : 0, 2);
        if (!active) {
          // Label torn off: the next one waits inside the printer.
          printing = false;
          label.position.z = PFRONT + labelIn;
        }
      },
      update(dt) {
        w.update(dt);
        t.update(dt);
        if (printing) label.position.z = Math.min(PFRONT + labelOut, label.position.z + dt * 3.2);
      },
    };
  },
};

export default def;
