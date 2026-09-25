import * as THREE from 'three';
import { box, createScaleRoot, cyl, foot, keep, logoBadge, MAT, rbox, rectCm, visitorWeight } from '../kit';
import { SPECS } from '../specs';
import type { ScaleDef } from '../types';
import { compact, group, INK, SATIN, screw, slab } from './_parts-floor';

/**
 * C202 — mechanical steelyard (beam) column scale with a telescopic stadiometer.
 * Recipe (cm, catalogue): overall 45 × 60 × 150; base 27.5 × 11.5 × 53 with a black rubber top
 * 25 × 45, 4 feet Ø3, 2 rear wheels Ø5; column 8 × 6 × 120; head box 12 × 12 × 10 at 132–144;
 * beam 45 long at y≈140 carrying a large (kg) poise and a small (fine) poise, balance pointer in a
 * loop at the right end; telescopic rod of 3 nested bars behind the column with a 20+ cm headpiece.
 * White epoxy steel, aluminium beam and rod.
 *
 * Behaviour: stepping on throws the beam tip up against its stop; the kg poise is pushed one notch
 * too far (tip drops), brought back, then the fine poise slides until the beam floats level with a
 * damped swing. The rod extends so the headpiece rests on the visitor's head.
 */
const spec = SPECS.c202;

const BW = 27.5;
const BD = 53;
const BODY_TOP = 10.6;
const MAT_TOP = 12.4;
const COL_Z = -22;
const PIVOT_Y = 139;
const BEAM_Z = -13;
/** Graduated span of both bars (poise travel), cm either side of the centre. */
const SPAN = 17;
const COARSE_MAX = 200;
const FINE_MAX = 10;
const TILT_MAX = 3 * (Math.PI / 180);

const def: ScaleDef = {
  spec,
  build() {
    const { root, cm } = createScaleRoot(spec.id);

    // ---------------------------------------------------------------- base
    // Painted steel lower housing on 4 levelling feet.
    slab(cm, BW, BODY_TOP - 1.2, BD, 2.2, 0.8, MAT.paintWhite, { y: 1.2 });
    for (const [x, z] of [
      [-10.5, 22],
      [10.5, 22],
      [-10.5, -21],
      [10.5, -21],
    ])
      foot(cm, 3, 1.5, { x, z });
    // Weighing plate (slightly inset so it reads as a separate part) with the rubber mat.
    const plateZ0 = -18.4;
    const plateZ1 = BD / 2 - 0.8;
    const plateZ = (plateZ0 + plateZ1) / 2;
    const plateD = plateZ1 - plateZ0;
    slab(cm, BW - 1.4, 1.3, plateD, 1.6, 0.4, MAT.paintWhite, { y: BODY_TOP - 0.05, z: plateZ });
    slab(cm, 25, 0.9, plateD - 1.8, 1.2, 0.25, MAT.rubber, { y: MAT_TOP - 0.9, z: plateZ });
    // Fine transverse ribs moulded into the mat.
    for (let i = 0; i < 17; i++) box(cm, 22.6, 0.14, 0.7, MAT.rubber, { y: MAT_TOP + 0.05, z: plateZ0 + 3 + i * ((plateD - 6) / 16) });
    // Rear hood over the column foot.
    slab(cm, BW, 3.2, 7.2, 2.2, 0.6, MAT.paintWhite, { y: BODY_TOP - 0.2, z: -BD / 2 + 3.6 });
    for (const x of [-9.5, 9.5]) screw(cm, 0.45, { x, y: BODY_TOP + 3.0, z: -BD / 2 + 3.6, rx: -90 });
    // Two transport wheels on the rear corners, just clear of the floor.
    for (const s of [-1, 1]) {
      cyl(cm, 2.5, 2.5, 1.5, MAT.rubber, { x: s * (BW / 2 + 0.95), y: 2.8, z: -BD / 2 + 3.2, rz: 90 }, 20);
      cyl(cm, 1.0, 1.0, 1.9, MAT.stainless, { x: s * (BW / 2 + 0.9), y: 2.8, z: -BD / 2 + 3.2, rz: 90 }, 12);
    }

    // ---------------------------------------------------------------- column + head
    rbox(cm, 8, 132.6 - 13, 6, 1.0, MAT.paintWhite, { y: 13, z: COL_Z, bottom: true });
    // Collar where the column enters the hood.
    rbox(cm, 10, 2.4, 8, 0.8, MAT.paintWhite, { y: 12.6, z: COL_Z, bottom: true });
    // Beam head: box with the knife-edge pivot, beam in front of it.
    rbox(cm, 12, 12, 10, 1.2, MAT.paintWhite, { y: 132, z: -20, bottom: true });
    cyl(cm, 1.3, 1.3, 1.2, SATIN, { y: PIVOT_Y, z: -14.6, rx: 90 }, 16);
    // Fixed balance loop at the right end, carried by an arm from the head.
    const LX = 23.3;
    box(cm, 3, 0.4, 3, MAT.paintWhite, { x: LX, y: PIVOT_Y + 2.8, z: BEAM_Z });
    box(cm, 3, 0.4, 3, MAT.paintWhite, { x: LX, y: PIVOT_Y - 2.8, z: BEAM_Z });
    box(cm, 3, 6, 0.4, MAT.paintWhite, { x: LX, y: PIVOT_Y, z: BEAM_Z - 1.3 });
    box(cm, 1.4, 0.18, 0.06, INK, { x: LX + 0.6, y: PIVOT_Y, z: BEAM_Z - 1.07 });
    box(cm, 18.3, 0.8, 0.8, MAT.paintWhite, { x: 5 + 18.3 / 2, y: 132.6, z: -14.7 });
    box(cm, 0.8, 3.6, 0.8, MAT.paintWhite, { x: LX, y: 134.4, z: -14.7 });

    // ---------------------------------------------------------------- beam (moving)
    const beam = keep(group(cm, { y: PIVOT_Y, z: BEAM_Z }));
    box(beam, 40, 3, 1.2, SATIN, { y: 2 }); // kg bar
    box(beam, 40, 2.2, 1.0, SATIN, { y: -2.5 }); // fine bar
    box(beam, 1.2, 8.4, 1.8, SATIN, { x: -20.6, y: -0.2 });
    box(beam, 1.2, 8.4, 1.8, SATIN, { x: 20.6, y: -0.2 });
    cyl(beam, 1.0, 1.0, 1.6, MAT.blackPlastic, { x: -22.0, rz: 90 }, 16); // zero-balance knob
    box(beam, 3.2, 0.35, 0.5, MAT.absDark, { x: 22.8 }); // pointer tip in the loop
    // Graduations (ticks only, no figures): kg bar every 10 kg, fine bar every 0.5 kg.
    const ticks = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), INK, 42);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i <= 20; i++) {
      const x = -SPAN + (i / 20) * SPAN * 2;
      const longA = i % 5 === 0;
      const hA = longA ? 1.6 : 0.9;
      ticks.setMatrixAt(i, m4.compose(new THREE.Vector3(x, 2 + 1.5 - 0.25 - hA / 2, 0.64), new THREE.Quaternion(), new THREE.Vector3(0.16, hA, 1)));
      const hB = i % 2 === 0 ? 1.1 : 0.6;
      ticks.setMatrixAt(21 + i, m4.compose(new THREE.Vector3(x, -2.5 + 1.1 - 0.2 - hB / 2, 0.54), new THREE.Quaternion(), new THREE.Vector3(0.12, hB, 1)));
    }
    ticks.castShadow = false;
    beam.add(ticks);
    // Poises: sleeves around the bars with a notch latch / index.
    const coarse = keep(group(beam, { y: 2 }));
    rbox(coarse, 4, 4.4, 2.8, 0.5, MAT.chrome, {});
    box(coarse, 0.3, 1.6, 0.1, MAT.absDark, { y: -0.6, z: 1.42 });
    cyl(coarse, 0.7, 0.7, 1.2, MAT.blackPlastic, { y: 2.6 }, 12);
    compact(coarse);
    const fine = keep(group(beam, { y: -2.5 }));
    rbox(fine, 2.5, 3.2, 2.4, 0.4, MAT.chrome, {});
    box(fine, 0.25, 1.2, 0.1, MAT.absDark, { y: -0.4, z: 1.22 });
    compact(fine);
    compact(beam);

    // ---------------------------------------------------------------- stadiometer (telescopic rod)
    const ROD_Z = -26.1;
    rbox(cm, 2.6, 58, 1.6, 0.3, SATIN, { y: 88, z: ROD_Z, bottom: true });
    for (const y of [95, 127]) box(cm, 4, 2, 2.4, MAT.paintGrey, { y, z: -25.9 });
    const mid = keep(new THREE.Group());
    cm.add(mid);
    rbox(mid, 2.0, 58, 1.2, 0.25, SATIN, { y: 89, z: ROD_Z, bottom: true });
    const inner = keep(new THREE.Group());
    cm.add(inner);
    rbox(inner, 1.4, 58, 0.8, 0.2, SATIN, { y: 89.4, z: ROD_Z, bottom: true });
    rbox(inner, 3.4, 2.4, 3.0, 0.5, MAT.abs, { y: 145.2, z: ROD_Z, bottom: true });
    rbox(inner, 3.6, 1.1, 24, 0.45, MAT.abs, { y: 145.7, z: ROD_Z + 12, bottom: true });
    compact(inner);
    const HEAD_PARK = 145.7; // underside of the headpiece when parked

    // ---------------------------------------------------------------- logos
    logoBadge(cm, 4.5, 'medicale', { y: 104, z: COL_Z + 3.06 });
    logoBadge(cm, 3.6, 'medicale', { y: 6.8, z: BD / 2 + 0.06 });

    // ---------------------------------------------------------------- behaviour
    const heightCm = 172;
    let active = false;
    let t = 0;
    let load = 0;
    let coarseKg = 0;
    let fineKg = 0;
    let theta = 0;
    let omega = 0;
    let rod = 0;
    const plan = (): [number, number] => {
      if (!active) return [0, 0];
      const c = Math.floor(load / 10) * 10;
      if (t < 0.7) return [0, 0];
      if (t < 2.1) return [Math.min(COARSE_MAX, c + 10), 0];
      if (t < 3.0) return [c, 0];
      return [c, load - c];
    };

    return {
      root,
      size: { w: 0.48, d: 0.56, h: 1.48 },
      standOn: { ...rectCm(0, plateZ, 24, plateD - 3), y: MAT_TOP / 100 },
      colliders: [rectCm(0, -22, 12, 10)],
      weigh(on) {
        active = on;
        t = 0;
        if (on) load = Math.min(visitorWeight(), COARSE_MAX);
      },
      update(dt) {
        t += dt;
        const [c, f] = plan();
        coarseKg += (c - coarseKg) * Math.min(1, dt * 3.2);
        fineKg += (f - fineKg) * Math.min(1, dt * 1.8);
        const imbalance = (active ? load : 0) - coarseKg - fineKg;
        const target = THREE.MathUtils.clamp(imbalance * 0.02, -TILT_MAX, TILT_MAX);
        omega += ((target - theta) * 36 - omega * 2.6) * dt;
        theta += omega * dt;
        if (Math.abs(theta) > TILT_MAX) {
          theta = Math.sign(theta) * TILT_MAX;
          omega *= -0.25;
        }
        beam.rotation.z = theta;
        coarse.position.x = -SPAN + (coarseKg / COARSE_MAX) * SPAN * 2;
        fine.position.x = -SPAN + (fineKg / FINE_MAX) * SPAN * 2;
        const rodTarget = active ? MAT_TOP + heightCm - HEAD_PARK : 0;
        rod += (rodTarget - rod) * Math.min(1, dt * 1.4);
        inner.position.y = rod;
        mid.position.y = rod / 2;
      },
    };
  },
};

export default def;
