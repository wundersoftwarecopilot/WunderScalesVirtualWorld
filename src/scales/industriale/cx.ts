import * as THREE from 'three';
import { box, createScaleRoot, cyl, extrude, keypad, lcd, logoBadge, MAT, rbox, rectCm, roundedPolyline, torus, tubePath, weighing } from '../kit';
import { SPECS } from '../specs';
import type { ScaleDef } from '../types';
import { CAST_ALU, COIL_STEEL, compactKeep, group, hex, PAINT_GANTRY, ZINC } from './_floor-parts';

/**
 * DINAMOMETRO CX — crane scale (est 22 W × 28 H × 12 D die-cast body, red 5-digit LED, keypad
 * strip), shown hanging from its own display gantry: two 8 × 8 posts 176 apart on 24 × 40 foot
 * plates with gussets, an I-beam on top with a beam clamp. Beam clamp → ring → chain → shackle →
 * CX → swivel → hook → wire-rope basket sling through the eye of a ≈1250 kg steel coil
 * (Ø78 / Ø30 × 40). Display centre ≈ 161 cm. The whole hanging train sways slowly (one keep
 * group, merged per material).
 */
const spec = SPECS.cx;

/** Chain link: a stadium of Ø0.9 wire, inner 1.3 × 3.6 cm (pitch 3.6). Built once. */
let linkGeo: THREE.TubeGeometry | null = null;
const LINK_R = 0.45;
const LINK_HW = 1.1; // centreline half width
const LINK_HH = 2.25; // centreline half length
function chainLink(): THREE.TubeGeometry {
  if (linkGeo) return linkGeo;
  const pts = [
    new THREE.Vector3(-LINK_HW, -LINK_HH, 0),
    new THREE.Vector3(LINK_HW, -LINK_HH, 0),
    new THREE.Vector3(LINK_HW, LINK_HH, 0),
    new THREE.Vector3(-LINK_HW, LINK_HH, 0),
  ];
  linkGeo = new THREE.TubeGeometry(roundedPolyline(pts, LINK_HW, true), 28, LINK_R, 8, true);
  return linkGeo;
}

/** Lathe profile with hard edges: every interior corner point is doubled. */
function hardLathe(profile: Array<[number, number]>, mat: THREE.Material, segments = 48): THREE.Mesh {
  const pts: THREE.Vector2[] = [];
  profile.forEach(([r, y], i) => {
    pts.push(new THREE.Vector2(r, y));
    if (i > 0 && i < profile.length - 1) pts.push(new THREE.Vector2(r, y));
  });
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, segments), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

const def: ScaleDef = {
  spec,
  build() {
    const { root, cm } = createScaleRoot(spec.id);

    // ---------------------------------------------------------------- gantry (static)
    const PX = 88; // post centres
    const PH = 229; // post top (under the cap plate)
    for (const s of [-1, 1]) {
      const x = s * PX;
      box(cm, 24, 2, 40, PAINT_GANTRY, { x, y: 0, bottom: true });
      box(cm, 8, PH - 2, 8, PAINT_GANTRY, { x, y: 2, bottom: true });
      box(cm, 12, 1, 12, PAINT_GANTRY, { x, y: PH, bottom: true });
      // Gussets front/back and to the outside.
      for (const sz of [-1, 1]) extrude(cm, [[0, 0], [14, 0], [0, 22]], 1, PAINT_GANTRY, { x, y: 2, z: sz * 4, ry: sz > 0 ? -90 : 90 });
      extrude(cm, [[0, 0], [7, 0], [0, 16]], 1, PAINT_GANTRY, { x: x + s * 4, y: 2, ry: s > 0 ? 0 : 180 });
      // Anchor bolts.
      for (const bx of [-8, 8]) for (const bz of [-15, 15]) {
        hex(cm, 2, 0.8, ZINC, { x: x + bx, z: bz, y: 2, bottom: true });
        cyl(cm, 0.6, 0.6, 0.6, ZINC, { x: x + bx, z: bz, y: 2.8, bottom: true }, 8);
      }
      // Knee brace between post and beam.
      box(cm, 4, 42.4, 4, PAINT_GANTRY, { x: s * (PX - 19), y: PH - 14, rz: s * 45 });
      // Beam-to-post bolts on the bottom flange.
      for (const bx of [-3, 3]) for (const bz of [-3.5, 3.5]) hex(cm, 1.6, 0.7, ZINC, { x: x + bx, z: bz, y: PH + 2, bottom: true });
    }
    // I-beam 190 long: flanges 10 wide, web 0.8.
    const BY = PH + 1; // beam underside
    box(cm, 190, 1, 10, PAINT_GANTRY, { y: BY, bottom: true });
    box(cm, 190, 1, 10, PAINT_GANTRY, { y: BY + 9, bottom: true });
    box(cm, 190, 8, 0.8, PAINT_GANTRY, { y: BY + 1, bottom: true });
    for (const s of [-1, 1]) box(cm, 1, 10, 10, PAINT_GANTRY, { x: s * 95.5, y: BY, bottom: true });

    // Beam clamp on the bottom flange: two jaws, lips over the flange, spindle with a T handle.
    const PIV = BY - 6; // spindle axis = pivot of the hanging train
    for (const sz of [-1, 1]) {
      box(cm, 7, 10, 1.2, MAT.paintDark, { y: PIV - 3, z: sz * 6.2, bottom: true });
      box(cm, 7, 1.2, 3, MAT.paintDark, { y: BY + 1, z: sz * 5.1, bottom: true });
    }
    cyl(cm, 1, 1, 17, ZINC, { y: PIV, rx: 90 }, 12);
    hex(cm, 2.4, 1.2, ZINC, { y: PIV, z: -7.4, rx: 90 });
    cyl(cm, 0.45, 0.45, 9, ZINC, { y: PIV, z: 8.6, rz: 90 }, 8);

    // ---------------------------------------------------------------- hanging train (swings)
    const sw = group(cm, { y: PIV });
    const Y = (worldY: number) => worldY - PIV; // world cm → swing-local
    // Ring on the spindle.
    const RING_R = 2.6;
    const RING_T = 0.6;
    const ringC = -1;
    torus(sw, RING_R, RING_T, ZINC, { y: ringC });
    // Chain: 11 links, alternating planes.
    const linkGeoRef = chainLink();
    const link0 = ringC - RING_R + RING_T + LINK_R - LINK_HH;
    const N = 11;
    const pitch = 2 * (LINK_HH - LINK_R);
    for (let i = 0; i < N; i++) {
      const m = new THREE.Mesh(linkGeoRef, ZINC);
      m.position.y = link0 - i * pitch;
      m.rotation.y = i % 2 === 0 ? Math.PI / 2 : 0;
      m.castShadow = true;
      sw.add(m);
    }
    const lastC = link0 - (N - 1) * pitch;
    // Shackle: bow (half torus R6, tube 1.25) in the XY plane hanging from the last link, legs,
    // eyes and pin through the CX top lug.
    const bowTop = lastC - LINK_HH + LINK_R + 1.25; // bow wire centre (top)
    const bowC = bowTop - 6;
    torus(sw, 6, 1.25, ZINC, { y: bowC }, Math.PI);
    const pinY = bowC - 4;
    for (const s of [-1, 1]) {
      cyl(sw, 1.25, 1.25, 4, ZINC, { x: s * 6, y: pinY, bottom: true }, 12);
      cyl(sw, 2, 2, 2.5, ZINC, { x: s * 6, y: pinY, rz: 90 }, 14);
      hex(sw, 2.2, 0.8, ZINC, { x: s * 7.8, y: pinY, rz: 90 });
    }
    cyl(sw, 1.25, 1.25, 15, ZINC, { y: pinY, rz: 90 }, 12);

    // CX body.
    const bc = pinY - 3 - 14; // body centre (lug above it)
    rbox(sw, 2.6, 7, 5, 0.6, CAST_ALU, { y: bc + 14 - 0.5, bottom: true });
    rbox(sw, 22, 28, 12, 2.5, CAST_ALU, { y: bc });
    // Front: dark bezel, red LED window, keypad strip, logo.
    rbox(sw, 19.4, 12.6, 0.6, 0.6, MAT.absDark, { y: bc + 4.2, z: 5.9 });
    const led = lcd(sw, { w: 17, h: 6, digits: 5, kind: 'led-red' }, { y: bc + 5.6, z: 6.24 });
    box(sw, 17, 2.4, 0.2, MAT.blackPlastic, { y: bc + 0.2, z: 6.2 });
    const keys = keypad(sw, 5, 1, { w: 2.6, d: 1.4, h: 0.4, gap: 0.8 }, MAT.keycapDark, { y: bc + 0.2, z: 6.3, rx: 90 });
    keys.castShadow = false;
    logoBadge(sw, 4, spec.line, { y: bc - 6.6, z: 6.03 });
    // Back: battery cover with two screws; top: antenna stub for the remote.
    rbox(sw, 14, 9, 0.6, 0.5, CAST_ALU, { y: bc - 3, z: -6 });
    for (const s of [-1, 1]) cyl(sw, 0.4, 0.4, 0.3, ZINC, { x: s * 5.6, y: bc - 3, z: -6.35, rx: 90 }, 8);
    cyl(sw, 0.55, 0.7, 4.5, MAT.blackPlastic, { x: 7.5, y: bc + 14 - 0.5, z: -2.5, bottom: true }, 10);
    // Bottom: boss, 360° swivel, collar, hook with safety latch.
    cyl(sw, 3, 3, 2, CAST_ALU, { y: bc - 15.5, bottom: true }, 20);
    cyl(sw, 2.2, 2.2, 4, ZINC, { y: bc - 19.5, bottom: true }, 18);
    hex(sw, 5, 1.2, ZINC, { y: bc - 20.7, bottom: true });
    const HR = 5;
    const yb = bc - 30.5; // hook bowl centre
    const hookPts: Array<[number, number, number]> = [
      [0, bc - 20.5, 0],
      [0, yb + 1.5 * HR, 0],
    ];
    for (let a = 30; a >= -250; a -= 20) hookPts.push([HR * Math.cos((a * Math.PI) / 180), yb + HR * Math.sin((a * Math.PI) / 180), 0]);
    tubePath(sw, hookPts, 1.2, ZINC, { cornerRadius: 1.5, radialSegments: 12 });
    const tipX = HR * Math.cos((-250 * Math.PI) / 180);
    const tipY = yb + HR * Math.sin((-250 * Math.PI) / 180);
    const nx = 1.2;
    const ny = yb + 1.2 * HR;
    box(sw, Math.hypot(nx - tipX, ny - tipY) + 0.6, 0.4, 1, MAT.stainless, {
      x: (nx + tipX) / 2,
      y: (ny + tipY) / 2,
      rz: (Math.atan2(ny - tipY, nx - tipX) * 180) / Math.PI,
    });

    // Steel coil Ø78 / Ø30 × 40 (axis Z) hanging in a wire-rope basket sling through its eye.
    const slingTop = yb - HR + 1.2 + 0.8;
    const coilY = Y(58);
    const coil = group(sw, { y: coilY, rx: 90 });
    const RO = 39;
    const RI = 15;
    const HW = 20;
    const ch = 0.8;
    const face: Array<[number, number]> = [];
    // front face with shallow wrap rings (tiny steps catch the light like coiled strip)
    const rings = [RO - ch, 34, 29, 24, 19.5, RI + ch];
    rings.forEach((r, i) => {
      const y = HW - (i % 2 === 1 ? 0.08 : 0);
      face.push([r, y]);
      if (i < rings.length - 1) face.push([rings[i + 1] + (r - rings[i + 1]) * 0.02, y]);
    });
    const profile: Array<[number, number]> = [
      [RO, -HW + ch],
      [RO, HW - ch],
      ...face,
      [RI, HW - ch],
      [RI, -HW + ch],
      ...face.map(([r, y]) => [r, -y] as [number, number]).reverse(),
      [RO, -HW + ch],
    ];
    coil.add(hardLathe(profile, COIL_STEEL, 56));
    // Three packing straps through the eye (never at the top, where the sling runs).
    for (const phi of [90, -30, 210]) {
      const st = group(coil, { ry: -phi });
      box(st, 0.2, 2 * HW + 0.6, 2.96, MAT.paintDark, { x: RO + 0.2 });
      box(st, 0.2, 2 * HW + 0.6, 2.96, MAT.paintDark, { x: RI - 0.2 });
      for (const s of [-1, 1]) box(st, RO - RI + 0.6, 0.2, 3, MAT.paintDark, { x: (RO + RI) / 2, y: s * (HW + 0.2) });
    }
    // Basket sling: down the front face, through the eye (resting on its top), up the back face.
    const sz = HW + 1.6;
    const eyeY = coilY + RI - 0.8;
    tubePath(
      sw,
      [
        [0, slingTop, 0],
        [0, coilY + RO + 1.5, sz],
        [0, eyeY, sz],
        [0, eyeY, -sz],
        [0, coilY + RO + 1.5, -sz],
      ],
      0.8,
      ZINC,
      { closed: true, cornerRadius: 2.5, radialSegments: 10 },
    );
    compactKeep(sw);

    // Remote control resting on the left foot plate.
    const rc = group(cm, { x: -PX + 6, y: 2, z: 12, ry: 24 });
    rbox(rc, 4, 1.5, 8, 0.6, MAT.absDark, { bottom: true });
    keypad(rc, 2, 3, { w: 1.1, d: 1.1, h: 0.3, gap: 0.5 }, MAT.keycap, { y: 1.45, z: 0.8 }).castShadow = false;

    // ---------------------------------------------------------------- reading + sway
    const scale = weighing([led.display], { target: () => 1250, decimals: 0, idle: 1250 });
    let time = 0;

    return {
      root,
      size: { w: 2.0, d: 0.45, h: 2.4 },
      colliders: [rectCm(-PX, 0, 24, 40), rectCm(PX, 0, 24, 40), rectCm(0, 0, 82, 44)],
      weigh: scale.weigh,
      update(dt) {
        scale.update(dt);
        time += dt;
        sw.rotation.z = 0.011 * Math.sin((time * 2 * Math.PI) / 4.6);
        sw.rotation.x = 0.006 * Math.sin((time * 2 * Math.PI) / 6.3 + 1.1);
      },
    };
  },
};

export default def;
