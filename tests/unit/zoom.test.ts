import { describe, expect, it } from 'vitest';
import { MAX_ZOOM, zoomedFov } from '../../src/core/player';

describe('zoomedFov', () => {
  it('keeps the base field of view at 1x', () => {
    expect(zoomedFov(64, 1)).toBeCloseTo(64, 10);
  });

  it('halves the view tangent at 2x, like a lens', () => {
    const t = (deg: number) => Math.tan((deg * Math.PI) / 360);
    expect(t(zoomedFov(64, 2))).toBeCloseTo(t(64) / 2, 10);
    expect(zoomedFov(64, MAX_ZOOM)).toBeLessThan(20);
  });
});
