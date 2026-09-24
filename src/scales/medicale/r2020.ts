import * as THREE from 'three';
import { box, createScaleRoot, cyl, logoBadge, MAT, rbox, rectCm, tubePath, visitorWeight, visore, weighing } from '../kit';
import { SPECS } from '../specs';
import type { ScaleDef } from '../types';

/**
 * R2020 — digital column scale with the stadiometer built into the column (weight, height, BMI).
 * Recipe (cm, estimated where the catalogue gives no size): platform 36×6×40 with a removable
 * dark mat, two rear transport wheels, a slim 6×4 column ~205 tall at the back, the standard
 * VISORE head at ~108 with a grab bar above it, and the stadiometer slider + head paddle.
 *
 * Reference implementation for the other models: build in cm inside `cm`, front = +Z,
 * standOn for the platform, colliders only for the solid column, weigh()/update() via kit.
 */
const spec = SPECS.r2020;

const def: ScaleDef = {
  spec,
  build() {
    const { root, cm } = createScaleRoot(spec.id);
    const W = 36;
    const D = 40;
    const H = 6;

    // Platform with a removable rubber mat.
    rbox(cm, W, H, D, 1.2, MAT.paintWhite, { y: 0.4, bottom: true });
    rbox(cm, W - 4, 0.8, D - 8, 0.4, MAT.rubberGrey, { y: H + 0.4, z: 2, bottom: true });
    // Four low feet and two rear transport wheels.
    for (const [x, z] of [
      [-15, 16],
      [15, 16],
      [-15, -14],
      [15, -14],
    ])
      cyl(cm, 1.4, 1.6, 0.4, MAT.rubber, { x, z, y: 0, bottom: true }, 16);
    for (const x of [-15.5, 15.5]) cyl(cm, 2.5, 2.5, 2, MAT.rubber, { x, y: 2.5, z: -D / 2 + 1, rz: 90 }, 20);

    // Column at the back edge.
    const colZ = -D / 2 + 2.5;
    const colTop = 211;
    rbox(cm, 6, colTop - H, 4, 0.8, MAT.paintWhite, { y: H, z: colZ, bottom: true });
    // Measuring strip on the column front (thin darker inlay where the slider runs).
    box(cm, 1.2, 120, 0.2, MAT.absGrey, { y: 90 + 60, z: colZ + 2.05 });
    // Cap.
    rbox(cm, 7, 2, 5, 0.8, MAT.absGrey, { y: colTop, z: colZ, bottom: true });

    // VISORE display head on the column, facing the person on the platform.
    const head = visore(cm, { y: 104, z: colZ + 6, tilt: 32 });
    // Bracket joining the head to the column.
    box(cm, 8, 6, 6, MAT.absGrey, { y: 101, z: colZ + 3 });

    // Grab bar above the display.
    tubePath(
      cm,
      [
        [-15, 120, colZ + 2],
        [-15, 120, colZ + 10],
        [15, 120, colZ + 10],
        [15, 120, colZ + 2],
      ],
      1.25,
      MAT.stainless,
      { cornerRadius: 4 },
    );

    // Stadiometer: slider on the column + head paddle projecting over the platform.
    const slider = new THREE.Group();
    cm.add(slider);
    rbox(slider, 8, 6, 5, 1, MAT.absGrey, { z: colZ + 2 });
    rbox(slider, 5, 1, 25, 0.4, MAT.abs, { y: -2.5, z: colZ + 2 + 14 });
    const parkedY = 200;
    slider.position.y = parkedY;

    // Logos: on the column cap front and on the platform nose.
    logoBadge(cm, 4.2, 'medicale', { y: 190, z: colZ + 2.1 });
    logoBadge(cm, 3.6, 'medicale', { y: H / 2 + 0.4, z: D / 2 + 0.05 });

    // Weighing: weight on the main window, BMI on the small one, paddle comes down to the head.
    const heightCm = 172;
    let sliderTarget = parkedY;
    let weight = 0;
    const main = weighing([head.main], {
      target: () => (weight = visitorWeight()),
      decimals: 1,
    });
    const bmi = weighing(head.sub ? [head.sub] : [], {
      target: () => Math.round((weight / (heightCm / 100) ** 2) * 10) / 10,
      decimals: 1,
    });

    return {
      root,
      size: { w: 0.36, d: 0.45, h: 2.13 },
      standOn: { ...rectCm(0, 2, W - 2, D - 8), y: (H + 1.2) / 100 },
      colliders: [rectCm(0, colZ, 8, 6)],
      weigh(active) {
        main.weigh(active);
        bmi.weigh(active);
        sliderTarget = active ? heightCm + H + 1.2 + 3 : parkedY;
      },
      update(dt) {
        main.update(dt);
        bmi.update(dt);
        slider.position.y += (sliderTarget - slider.position.y) * Math.min(1, dt * 2.2);
      },
    };
  },
};

export default def;
