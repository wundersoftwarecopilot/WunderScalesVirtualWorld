import * as THREE from 'three';
import { box, createScaleRoot, cyl, foot, keypad, lamp, logoBadge, MAT, rbox, weighing } from '../kit';
import { SPECS } from '../specs';
import type { ScaleDef } from '../types';
import { backlitLcd, bubbleLevel, cable, faceFrame, KEY_AMBER, plate, profileSolid, rubberFoot, SATIN_STEEL } from './_table-parts';

/**
 * JSD DUAL — bench counting scale with a remote WPE platform on the same cable.
 * JSD body 31 W × 33 D × 12 H (confirmed): grey ABS lower tray, off-white cover whose front
 * 10 cm is a console sloping 20° with THREE LCD windows 8.5 × 2.5 (weight / unit weight /
 * pieces), each with its own backlight colour, a 4 × 5 membrane keypad (the function column in
 * the division's amber), the HI/OK/LO check lamps and an on/off key. Stainless pan 29 × 22 × 1
 * (confirmed) on a 1.5 cm spider. WPE (right): painted steel base 25 × 27, stainless pan
 * 23 × 23 (confirmed), levelling feet, spirit level; a Ø0.5 cable runs behind both to the JSD.
 * Demo: 2.450 kg on the platform, unit weight 0.0125 kg, 196 pcs.
 */
const spec = SPECS['jsd-dual'];

/** JSD body centre (x, z) and WPE centre; the pair is centred on the origin. */
const XJ = -16.25;
const XW = 19.25;
const ZC = 1.5;
/** Cover top (flat part under the pan) and the console. */
const TOP = 9.6;
const SLOPE = 20;
const CON_Z = 6.5; // local z where the console starts
const FRONT_Y = TOP - 10 * Math.tan((SLOPE * Math.PI) / 180);

const def: ScaleDef = {
  spec,
  build() {
    const { root, cm } = createScaleRoot(spec.id);

    // ================================================================ JSD body
    for (const x of [-12.5, 12.5]) for (const z of [-13.5, 13.5]) rubberFoot(cm, 2.6, 1.0, { x: XJ + x, z: ZC + z });
    // Lower tray, dark parting-line core, upper cover with the sloped console.
    rbox(cm, 31, 2.2, 33, 0.7, MAT.absGrey, { x: XJ, y: 1.0, z: ZC, bottom: true });
    box(cm, 30.2, 0.6, 32.2, MAT.absDark, { x: XJ, y: 3.0, z: ZC, bottom: true });
    profileSolid(
      cm,
      [
        [-16.5, 3.35],
        [16.5, 3.35],
        [16.5, FRONT_Y],
        [CON_Z, TOP],
        [-16.5, TOP],
      ],
      31,
      MAT.abs,
      { bevel: 0.5, radius: [0.3, 0.3, 0.9, 0.8, 1.2] },
      { x: XJ, z: ZC },
    );

    // Moulded carrying grips on both sides.
    for (const sx of [-1, 1]) plate(cm, 1.1, 0.1, 9, 0.55, 0.03, MAT.absDark, { x: XJ + sx * 15.47, y: 6.4, z: ZC - 4, rz: -sx * 90 });

    // Pan on its spider (hub + cross arms show in the 1.5 cm gap).
    const panZ = ZC - 4.8;
    box(cm, 7, 1.5, 7, MAT.absDark, { x: XJ, y: TOP - 0.05, z: panZ, bottom: true });
    box(cm, 22, 0.5, 1.4, MAT.absDark, { x: XJ, y: TOP + 1.0, z: panZ, bottom: true });
    box(cm, 1.4, 0.5, 16, MAT.absDark, { x: XJ, y: TOP + 1.0, z: panZ, bottom: true });
    plate(cm, 29, 1.0, 22, 0.8, 0.25, SATIN_STEEL, { x: XJ, y: TOP + 1.5, z: panZ });

    // ---------------------------------------------------------------- console (slope 20°)
    const f = faceFrame(cm, XJ, (TOP + FRONT_Y) / 2, ZC + (CON_Z + 16.5) / 2, SLOPE);
    // Membrane overlay.
    box(f, 29.4, 8.7, 0.06, MAT.absDark, { y: 0.05, z: 0.03 });
    // Three windows, each with its own backlight colour (weight / unit weight / pieces).
    const lights = [
      { on: '#f2c14e', x: -9.6 },
      { on: '#a6de84', x: 0 },
      { on: '#f27a62', x: 9.6 },
    ];
    const displays = lights.map((l) => {
      const c = new THREE.Color(l.on);
      const bg = new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
      box(f, 8.9, 2.9, 0.05, MAT.keycapDark, { x: l.x, y: 2.6, z: 0.08 });
      return backlitLcd(f, { w: 8.5, h: 2.5, digits: 6, bg, on: '#1b1d17', off: c.clone().multiplyScalar(0.84) }, { x: l.x, y: 2.6, z: 0.112 });
    });
    const [dWeight, dUnit, dPcs] = displays;
    // 4 × 5 keypad: four numeric columns plus the amber function column.
    const key = { w: 2.2, d: 0.9, h: 0.32, gap: 0.4 };
    keypad(f, 4, 4, key, MAT.keycap, { x: -1.3, y: -1.55, z: 0.06, rx: 90 });
    keypad(f, 1, 4, key, KEY_AMBER, { x: 5.2, y: -1.55, z: 0.06, rx: 90 });
    // Check lamps HI / OK / LO and the round on/off key.
    const lampHi = lamp(f, 0.55, '#ff3b2a', { x: 9.4, y: 0.35, z: 0.07 });
    const lampOk = lamp(f, 0.55, '#3dff6a', { x: 10.6, y: 0.35, z: 0.07 });
    const lampLo = lamp(f, 0.55, '#ffb300', { x: 11.8, y: 0.35, z: 0.07 });
    for (const l of [lampHi, lampOk, lampLo]) l.setOn(false);
    cyl(f, 0.75, 0.8, 0.3, MAT.keycapDark, { x: 10.6, y: -2.6, z: 0.2, rx: 90 }, 20);
    cyl(f, 0.3, 0.3, 0.32, MAT.keycap, { x: 10.6, y: -2.6, z: 0.22, rx: 90 }, 12);
    logoBadge(f, 3.2, spec.line, { x: -10.8, y: -1.0, z: 0.075 });

    // ---------------------------------------------------------------- rear panel: ports + cable gland
    const rearZ = ZC - 16.5;
    box(cm, 11, 3.2, 0.2, MAT.absDark, { x: XJ + 5, y: 6.2, z: rearZ - 0.08 });
    box(cm, 2.4, 1.0, 0.3, MAT.stainless, { x: XJ + 2.4, y: 6.2, z: rearZ - 0.2 }); // serial port shell
    box(cm, 1.6, 1.2, 0.3, MAT.blackPlastic, { x: XJ + 5.4, y: 6.2, z: rearZ - 0.2 }); // power socket
    cyl(cm, 0.62, 0.7, 1.2, MAT.blackPlastic, { x: XJ + 8.6, y: 6.2, z: rearZ - 0.7, rx: 90 }, 16);
    cyl(cm, 0.42, 0.42, 0.8, MAT.rubber, { x: XJ + 8.6, y: 6.2, z: rearZ - 1.6, rx: 90 }, 12);

    // ================================================================ WPE remote platform
    for (const x of [-10, 10]) for (const z of [-11, 11]) foot(cm, 2.2, 1.2, { x: XW + x, z: ZC + z });
    rbox(cm, 25, 5.0, 27, 0.5, MAT.paintGrey, { x: XW, y: 1.2, z: ZC, bottom: true });
    box(cm, 20, 0.55, 20, MAT.absDark, { x: XW, y: 6.15, z: ZC - 0.5, bottom: true });
    plate(cm, 23, 0.8, 23, 0.8, 0.2, SATIN_STEEL, { x: XW, y: 6.7, z: ZC - 0.5 });
    bubbleLevel(cm, 1.4, { x: XW + 10.2, y: 6.2, z: ZC + 12.4 });
    logoBadge(cm, 3.0, spec.line, { x: XW, y: 4.2, z: ZC + 13.5 + 0.03 });
    for (const x of [-10.8, 10.8]) cyl(cm, 0.35, 0.35, 0.12, MAT.stainless, { x: XW + x, y: 3.7, z: ZC + 13.5 + 0.05, rx: 90 }, 12);
    const wRear = ZC - 13.5;
    cyl(cm, 0.62, 0.7, 1.0, MAT.blackPlastic, { x: XW - 7, y: 3.4, z: wRear - 0.5, rx: 90 }, 16);
    cyl(cm, 0.42, 0.42, 0.8, MAT.rubber, { x: XW - 7, y: 3.4, z: wRear - 1.3, rx: 90 }, 12);

    // Cable: JSD gland → down onto the pedestal behind both → up into the WPE gland.
    const cz = -17.9;
    cable(
      cm,
      [
        [XJ + 8.6, 6.2, rearZ - 1.6],
        [XJ + 8.6, 5.6, rearZ - 2.3],
        [XJ + 8.9, 2.0, cz + 0.05],
        [XJ + 10.5, 0.28, cz],
        [XW - 10, 0.28, cz],
        [XW - 7.3, 1.2, cz + 1.1],
        [XW - 7, 3.0, wRear - 2.0],
        [XW - 7, 3.4, wRear - 1.3],
      ],
      0.25,
    );

    // ================================================================ weighing
    const unitWeight = 0.0125;
    dUnit.set(unitWeight, 4);
    const w = weighing([dWeight], { target: () => 2.45, decimals: 3 });
    const pcs = weighing([dPcs], {
      target: () => 196,
      decimals: 0,
      onStable: (ok) => lampOk.setOn(ok),
    });

    return {
      root,
      size: { w: 0.636, d: 0.362, h: 0.121 },
      weigh(active) {
        w.weigh(active);
        pcs.weigh(active);
        dUnit.set(unitWeight, 4);
      },
      update(dt) {
        w.update(dt);
        pcs.update(dt);
      },
    };
  },
};

export default def;
