import * as THREE from 'three';
import { box, createScaleRoot, cyl, logoBadge, MAT, rbox, rectCm, tubePath, visitorWeight, visore, weighing, wedge } from '../kit';
import { SPECS } from '../specs';
import type { ScaleDef } from '../types';
import { group, SATIN, screw, slab, visoreBadge } from './_parts-floor';

/**
 * RW2.0-SEDIA — wheelchair platform scale with a handrail and a fold-down seat.
 * Recipe (cm, RW2.0 family; seat and rail heights est): overall 84 × 116 × 95; platform
 * 74 × 6.5 × 90 with a dark non-slip top; two wedge ramps 74 × 13 × 6 front and back; a tubular
 * handrail on one long side (+X): 2 posts Ø3 80 apart, top rail at y≈92 with round bends; a
 * 40 × 35 seat folded down over the platform at y≈48; VISORE on the front post; 4 small swivel
 * wheels Ø5 under the corners. Grey platform, white rails.
 *
 * standOn = the platform deck; the rail, the seat and the display arm are solid.
 */
const spec = SPECS['rw20-sedia'];

const PX = -4; // platform centre (the rail side makes the footprint asymmetric)
const PW = 74;
const PD = 90;
const DECK = 6.7;
const RAMP_H = 6.4;
const RAMP_D = 13;
const RX = 37.5; // handrail posts
const POST_Z = 40;

const def: ScaleDef = {
  spec,
  build() {
    const { root, cm } = createScaleRoot(spec.id);

    // ---------------------------------------------------------------- platform
    slab(cm, PW, RAMP_H - 0.8, PD, 1.5, 0.5, MAT.paintGrey, { x: PX, y: 0.8 });
    slab(cm, PW - 2, 0.5, PD - 2, 1.0, 0.12, MAT.rubberGrey, { x: PX, y: DECK - 0.5 });
    // Studded non-slip pattern on the deck (one instanced draw).
    const cols = 17;
    const rows = 21;
    const studs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.55, 0.6, 0.16, 8), MAT.rubberGrey, cols * rows);
    const m4 = new THREE.Matrix4();
    let i = 0;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const x = PX - (PW - 8) / 2 + (c + (r % 2) * 0.5) * ((PW - 8) / cols);
        const z = -(PD - 8) / 2 + r * ((PD - 8) / (rows - 1));
        studs.setMatrixAt(i++, m4.makeTranslation(x, DECK + 0.06, z));
      }
    studs.castShadow = false;
    studs.receiveShadow = true;
    cm.add(studs);
    // Swivel wheels tucked under the corners.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(cm, 2.5, 2.5, 1.8, MAT.rubber, { x: PX + sx * 32, y: 2.5, z: sz * 40, rz: 90 }, 16);

    // ---------------------------------------------------------------- ramps (front and back)
    const slope = Math.atan2(RAMP_H, RAMP_D);
    const nrm = new THREE.Vector3(0, Math.cos(slope), Math.sin(slope));
    for (const side of [1, -1]) {
      const r = group(cm, { x: PX, z: side * (PD / 2 + RAMP_D / 2), ry: side > 0 ? 0 : 180 });
      wedge(r, PW, RAMP_H, RAMP_D, MAT.paintGrey);
      for (let k = 0; k < 4; k++) {
        const zl = -RAMP_D / 2 + 2.4 + k * 2.8;
        const yl = RAMP_H * (0.5 - zl / RAMP_D);
        box(r, PW - 8, 0.25, 1.5, MAT.rubberGrey, { y: yl + nrm.y * 0.08, z: zl + nrm.z * 0.08, rx: (slope * 180) / Math.PI });
      }
      for (const k of [-1, 0, 1]) cyl(cm, 0.7, 0.7, 6, SATIN, { x: PX + k * 26, y: RAMP_H - 0.35, z: side * (PD / 2), rz: 90 }, 12);
    }

    // ---------------------------------------------------------------- handrail
    tubePath(
      cm,
      [
        [RX, 2.5, POST_Z],
        [RX, 92, POST_Z],
        [RX, 92, -POST_Z],
        [RX, 2.5, -POST_Z],
      ],
      1.5,
      MAT.paintWhite,
      { cornerRadius: 8 },
    );
    for (const sz of [-1, 1]) {
      rbox(cm, 7.6, 5, 6, 0.6, MAT.paintGrey, { x: 36, y: 1.1, z: sz * POST_Z, bottom: true });
      for (const dz of [-1.9, 1.9]) screw(cm, 0.45, { x: 39.82, y: 3.6, z: sz * POST_Z + dz, ry: 90 });
    }
    // Lower rail carrying the seat hinge.
    cyl(cm, 1.25, 1.25, POST_Z * 2, MAT.paintWhite, { x: RX, y: 47, rx: 90 }, 16);

    // ---------------------------------------------------------------- fold-down seat
    const SX0 = 1;
    const SX1 = 36;
    const seatX = (SX0 + SX1) / 2;
    const seatW = SX1 - SX0;
    rbox(cm, seatW, 2.2, 40, 0.8, MAT.absGrey, { x: seatX, y: 46.3, bottom: true });
    rbox(cm, seatW - 2.5, 1.8, 37.5, 0.8, MAT.upholsteryGrey, { x: seatX - 0.4, y: 48.2, bottom: true });
    for (const z of [-13, 13]) {
      cyl(cm, 1.6, 1.6, 6, SATIN, { x: RX, y: 47, z, rx: 90 }, 16);
      box(cm, 3, 0.4, 6, SATIN, { x: 35.1, y: 46.1, z });
    }
    // Folding legs down to the deck, with rubber tips and a cross brace.
    for (const z of [-16, 16]) {
      cyl(cm, 1.0, 1.0, 46.3 - 7.6, MAT.paintWhite, { x: 4.5, y: 7.6, z, bottom: true }, 14);
      cyl(cm, 1.35, 1.5, 1.2, MAT.rubber, { x: 4.5, y: DECK - 0.05, z, bottom: true }, 14);
      box(cm, 3, 2, 3, MAT.absGrey, { x: 4.5, y: 45.3, z });
    }
    cyl(cm, 0.8, 0.8, 32, MAT.paintWhite, { x: 4.5, y: 16, rx: 90 }, 12);

    // ---------------------------------------------------------------- display on the front post
    const HX = 31.5;
    const HY = 83;
    const HZ = 48.8;
    const TILT = 30;
    const head = visore(cm, { x: HX, y: HY, z: HZ, tilt: TILT });
    visoreBadge(head, 3);
    const mount = group(group(cm, { x: HX, y: HY, z: HZ }), { rx: -TILT });
    rbox(mount, 9, 7, 2, 0.6, MAT.absGrey, { z: -2.8 });
    rbox(cm, 4.6, 6, 4.6, 0.8, MAT.absGrey, { x: RX, y: 80, z: POST_Z });
    tubePath(
      cm,
      [
        [RX - 0.5, 80.2, POST_Z + 1.5],
        [HX + 1.5, 81.4, 46.0],
      ],
      1.1,
      MAT.stainless,
    );
    // Load-cell cable: through the arm into the clamp, then down the back of the front post.
    tubePath(
      cm,
      [
        [RX, 78, POST_Z - 1.2],
        [RX, 76, POST_Z - 1.85],
        [RX, 8, POST_Z - 1.85],
        [RX - 1.2, 5.6, POST_Z - 1.85],
      ],
      0.35,
      MAT.blackPlastic,
      { cornerRadius: 2, radialSegments: 8 },
    );

    // ---------------------------------------------------------------- logos
    logoBadge(cm, 3.6, 'medicale', { x: PX - PW / 2 - 0.06, y: 3.9, ry: -90 });

    // ---------------------------------------------------------------- behaviour
    const heightCm = 170;
    let w = 0;
    const main = weighing([head.main], { target: () => (w = visitorWeight()), decimals: 1 });
    const bmi = weighing(head.sub ? [head.sub] : [], { target: () => Math.round((w / (heightCm / 100) ** 2) * 10) / 10, decimals: 1 });

    return {
      root,
      size: { w: 0.84, d: 1.16, h: 0.94 },
      standOn: { ...rectCm(PX, 0, PW - 2, PD - 2), y: DECK / 100 },
      colliders: [rectCm(RX, 0, 6, 2 * POST_Z + 4), rectCm(seatX, 0, seatW + 2, 42), rectCm(HX, HZ, 22, 13)],
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
