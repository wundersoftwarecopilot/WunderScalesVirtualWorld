import * as THREE from 'three';
import { box, createScaleRoot, cyl, keep, logoBadge, MAT, rbox } from '../kit';
import { SPECS } from '../specs';
import type { ScaleDef } from '../types';
import { babyTray, babyWeight, BRIGHT_STEEL, compact, framePlate, group, INK, marks, SATIN, screw, slab, TRAY_ABS } from './_parts-table';

/**
 * SUPERBABY — mechanical steelyard (beam) baby scale, 16 kg × 10 g.
 * Recipe (cm, catalogue: body 47 × 25.5 × 5.5, tray 56 × 31): a flat white painted-steel body on
 * rubber feet; the convex white ABS tray (half ellipsoid 56 × 31, 6.5 deep, rim at 15) on a stem
 * with a saddle pad; along the front edge the aluminium steelyard: an upper kg bar and a lower
 * gram bar joined into one beam, pivoting in the left end housing (logo, zero-adjust knob), a dark
 * kg poise (3 × 2.5 × 2) and gram poise (1.6 cube) sliding along them, and the pointer housing at
 * the right end where the beam's pointer meets a fixed counter-pointer.
 *
 * Behaviour: when the visitor comes close a baby (2.8–4.9 kg, rounded to 10 g) is "laid in": the
 * pointer kicks up against its stop, the kg poise is pushed one notch too far (pointer drops),
 * brought back, then the gram poise slides out until the beam floats level with a damped swing.
 */
const spec = SPECS.superbaby;

const BW = 47;
const BD = 25.5;
const FOOT = 0.8;
const BODY_TOP = FOOT + 5.5;
/** Tray centre z, rim height, radii. */
const TZ = -1;
const RIM = 15;
const TRY = 6.5;
/** Beam pivot (world cm) and the beam's centre plane. */
const PX = -20.5;
const PY = 3.9;
const BZ = 14.3;
/** Beam length from the pivot to the end block, graduated span along the bars (local x). */
const BEAM_END = 40.9;
const XS0 = 3.2;
const XS1 = 37.2;
const KG_MAX = 16;
const TILT_MAX = 1.6 * (Math.PI / 180);
const KG_Y = 1.25;
const G_Y = -1.3;

const def: ScaleDef = {
  spec,
  build() {
    const { root, cm } = createScaleRoot(spec.id);

    // ---------------------------------------------------------------- body
    for (const x of [-20, 20]) for (const z of [-9.8, 9.8]) cyl(cm, 1.2, 1.45, FOOT, MAT.rubber, { x, z, y: 0, bottom: true }, 16);
    slab(cm, BW, BODY_TOP - FOOT, BD, 1.6, 0.55, MAT.paintWhite, { y: FOOT });
    // Pressed top cover: a slightly raised panel with a screw in each corner.
    slab(cm, BW - 3, 0.35, BD - 3, 1.2, 0.15, MAT.paintWhite, { y: BODY_TOP - 0.05 });
    for (const x of [-21.3, 21.3]) for (const z of [-10.4, 10.4]) screw(cm, 0.35, { x, y: BODY_TOP + 0.3, z, rx: -90 });
    // Rubber boot where the stem leaves the body, stem and saddle pad under the tray.
    cyl(cm, 3.2, 3.6, 0.5, MAT.rubberGrey, { y: BODY_TOP + 0.25, z: TZ, bottom: true }, 24);
    const padTop = RIM - TRY - 0.05;
    cyl(cm, 2, 2, padTop - 0.3 - (BODY_TOP + 0.6), MAT.stainless, { y: BODY_TOP + 0.6, z: TZ, bottom: true }, 20);
    cyl(cm, 4.2, 3.2, 0.6, MAT.paintWhite, { y: padTop - 0.6, z: TZ, bottom: true }, 24);

    // ---------------------------------------------------------------- tray
    babyTray(cm, 28, TRY, 15.5, TRAY_ABS, { y: RIM, z: TZ });

    // ---------------------------------------------------------------- end housings (fixed)
    const HZ = BD / 2 + 1.5; // housings: 3 deep, from the body front to HZ + 1.5
    const HY0 = 1.3;
    const HH = 5.6;
    // Left: pivot housing with the logo and the zero-adjust knob.
    rbox(cm, 4.4, HH, 3, 0.5, MAT.paintWhite, { x: -22.2, y: HY0, z: HZ, bottom: true });
    logoBadge(cm, 3, 'medicale', { x: -22.2, y: HY0 + HH - 1.9, z: HZ + 1.52 });
    cyl(cm, 0.85, 0.85, 1.0, MAT.blackPlastic, { x: -24.9, y: PY, z: HZ, rz: 90 }, 12);
    cyl(cm, 0.45, 0.45, 0.4, MAT.stainless, { x: -25.5, y: PY, z: HZ, rz: 90 }, 12);
    // Right: pointer housing — back plate, walls, and a front bezel with the window.
    const RX = 23.1;
    const RW = 4.2;
    box(cm, RW, HH, 0.4, MAT.paintWhite, { x: RX, y: HY0 + HH / 2, z: BD / 2 + 0.2 });
    box(cm, RW, 0.4, 3, MAT.paintWhite, { x: RX, y: HY0 + 0.2, z: HZ });
    box(cm, RW, 0.4, 3, MAT.paintWhite, { x: RX, y: HY0 + HH - 0.2, z: HZ });
    box(cm, 0.4, HH, 3, MAT.paintWhite, { x: RX + RW / 2 - 0.2, y: HY0 + HH / 2, z: HZ });
    // Left wall with a slot for the pointer blade.
    const slot = 2.9;
    const lowH = PY - slot / 2 - HY0;
    const upH = HY0 + HH - (PY + slot / 2);
    box(cm, 0.4, lowH, 3, MAT.paintWhite, { x: RX - RW / 2 + 0.2, y: HY0 + lowH / 2, z: HZ });
    box(cm, 0.4, upH, 3, MAT.paintWhite, { x: RX - RW / 2 + 0.2, y: PY + slot / 2 + upH / 2, z: HZ });
    framePlate(cm, RW, HH, 0.4, 0.5, { w: 2.6, h: 3.4, y: PY - (HY0 + HH / 2), r: 0.3 }, MAT.paintWhite, { x: RX, y: HY0 + HH / 2, z: HZ + 1.3 });
    // Fixed counter-pointer from the right wall and an index line on the back plate.
    box(cm, 1.0, 0.28, 0.12, MAT.absDark, { x: RX + 1.4, y: PY, z: BZ });
    marks(cm, [[RX, PY, 1.8, 0.08], [RX + 0.5, PY + 0.9, 0.5, 0.06], [RX + 0.5, PY - 0.9, 0.5, 0.06]], BD / 2 + 0.41);

    // ---------------------------------------------------------------- steelyard beam (moving)
    const beam = keep(group(cm, { x: PX, y: PY, z: BZ }));
    const barL = BEAM_END + 1.5;
    box(beam, barL, 1.5, 0.8, SATIN, { x: barL / 2 - 1.5, y: KG_Y });
    box(beam, barL, 1.0, 0.7, SATIN, { x: barL / 2 - 1.5, y: G_Y });
    box(beam, 1.2, 4.1, 1.0, SATIN, { x: -1.1, y: (KG_Y + G_Y) / 2 + 0.05 });
    box(beam, 1.0, 4.1, 1.0, SATIN, { x: BEAM_END, y: (KG_Y + G_Y) / 2 + 0.05 });
    // Pointer blade from the end block into the housing window.
    box(beam, 3.0, 0.28, 0.12, MAT.absDark, { x: BEAM_END + 2.0, y: 0 });
    // Pivot pin (hidden in the housing) and its bearing cap.
    cyl(beam, 0.35, 0.35, 1.6, MAT.stainless, { rx: 90 }, 12);
    // Graduations (ticks only): kg bar every 0.5 kg (long each kg), gram bar every 50 g (long each 100 g).
    const tickList: Array<[number, number, number, number]> = [];
    for (let i = 0; i <= KG_MAX * 2; i++) {
      const x = XS0 + (i / (KG_MAX * 2)) * (XS1 - XS0);
      const long = i % 2 === 0;
      const h = long ? 0.9 : 0.5;
      tickList.push([x, KG_Y + 0.75 - 0.12 - h / 2, 0.1, h]);
    }
    for (let i = 0; i <= 20; i++) {
      const x = XS0 + (i / 20) * (XS1 - XS0);
      const h = i % 2 === 0 ? 0.6 : 0.35;
      tickList.push([x, G_Y + 0.5 - 0.1 - h / 2, 0.08, h]);
    }
    marks(beam, tickList, 0.42);
    // Poises: dark sleeves with a bright index plate and a thumb grip.
    const kgPoise = keep(group(beam, { x: XS0, y: KG_Y }));
    rbox(kgPoise, 3, 2.5, 2, 0.4, MAT.absDark, { y: 0.1 });
    box(kgPoise, 1.8, 0.9, 0.06, BRIGHT_STEEL, { y: -0.55, z: 1.02 });
    box(kgPoise, 0.1, 0.9, 0.02, INK, { y: -0.55, z: 1.06 });
    cyl(kgPoise, 0.55, 0.6, 0.6, MAT.blackPlastic, { y: 1.35 + 0.3 }, 12);
    compact(kgPoise);
    const gPoise = keep(group(beam, { x: XS0, y: G_Y }));
    rbox(gPoise, 1.6, 1.6, 1.6, 0.3, MAT.absDark, {});
    box(gPoise, 1.0, 0.6, 0.06, BRIGHT_STEEL, { y: -0.35, z: 0.82 });
    box(gPoise, 0.08, 0.6, 0.02, INK, { y: -0.35, z: 0.86 });
    compact(gPoise);
    compact(beam);

    // ---------------------------------------------------------------- behaviour
    let active = false;
    let t = 0;
    let load = 0;
    let kg = 0;
    let g = 0;
    let theta = 0;
    let omega = 0;
    /** Target poise settings [kg, fraction of the gram bar] for the current moment. */
    const plan = (): [number, number] => {
      if (!active) return [0, 0];
      const whole = Math.floor(load);
      if (t < 0.8) return [0, 0];
      if (t < 2.0) return [whole + 1, 0];
      if (t < 2.9) return [whole, 0];
      return [whole, load - whole];
    };

    return {
      root,
      size: { w: 0.58, d: 0.33, h: 0.156 },
      weigh(on) {
        active = on;
        t = 0;
        if (on) load = Math.round(babyWeight() * 100) / 100;
      },
      update(dt) {
        t += dt;
        const [kt, gt] = plan();
        kg += (kt - kg) * Math.min(1, dt * 3.0);
        g += (gt - g) * Math.min(1, dt * 1.6);
        const imbalance = (active ? load : 0) - kg - g;
        const target = THREE.MathUtils.clamp(imbalance * 0.12, -TILT_MAX, TILT_MAX);
        omega += ((target - theta) * 40 - omega * 2.4) * dt;
        theta += omega * dt;
        if (Math.abs(theta) > TILT_MAX) {
          theta = Math.sign(theta) * TILT_MAX;
          omega *= -0.3;
        }
        beam.rotation.z = theta;
        kgPoise.position.x = XS0 + (kg / KG_MAX) * (XS1 - XS0);
        gPoise.position.x = XS0 + g * (XS1 - XS0);
      },
    };
  },
};

export default def;
