import { createScaleRoot, logoBadge, MAT, rbox } from './kit';
import { SPECS, type ScaleId } from './specs';
import type { ScaleDef } from './types';

/**
 * Placeholder model: a rounded grey block of the right overall size with a logo badge.
 * Every scale file starts as a stub so the world always has 30 pieces in place.
 */
export function stubScale(id: ScaleId): ScaleDef {
  const spec = SPECS[id];
  return {
    spec,
    build() {
      const { root, cm } = createScaleRoot(id);
      const { w, d, h } = spec.approx;
      rbox(cm, w, h, d, Math.min(4, h / 4), MAT.absGrey, { bottom: true });
      logoBadge(cm, Math.min(12, w * 0.4, h * 0.6), spec.line, { y: h * 0.6, z: d / 2 + 0.05 });
      return { root, size: { w: w / 100, d: d / 100, h: h / 100 } };
    },
  };
}
