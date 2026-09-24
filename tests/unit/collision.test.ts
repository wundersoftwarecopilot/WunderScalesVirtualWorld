import { describe, expect, it } from 'vitest';
import { CollisionWorld } from '../../src/core/collision';
import { localRectToWorld, worldToLocalXZ } from '../../src/core/rect';

describe('CollisionWorld', () => {
  it('stops a circle at a wall and lets it slide along', () => {
    const w = new CollisionWorld(2);
    w.add({ minX: 0, maxX: 0.3, minZ: -5, maxZ: 5 });
    const p = w.move(-1, 0, 2, 0.5, 0.28);
    expect(p.x).toBeLessThanOrEqual(-0.28 + 1e-6);
    expect(p.z).toBeCloseTo(0.5, 5);
  });

  it('does not tunnel through a thin wall at high speed', () => {
    const w = new CollisionWorld(2);
    w.add({ minX: 0, maxX: 0.05, minZ: -5, maxZ: 5 });
    const p = w.move(-0.5, 0, 10, 0, 0.28);
    expect(p.x).toBeLessThan(0);
  });

  it('ignores disabled colliders (open doors)', () => {
    const w = new CollisionWorld(2);
    const door = w.add({ minX: -1, maxX: 1, minZ: -0.1, maxZ: 0.1 });
    door.enabled = false;
    const p = w.move(0, 1, 0, -2, 0.28);
    expect(p.z).toBeCloseTo(-1, 5);
  });
});

describe('rect transforms', () => {
  it('round-trips local ↔ world', () => {
    const rot = 0.7;
    const r = localRectToWorld({ x: 0.3, z: -0.2, w: 0, d: 0 }, 5, 7, rot);
    const l = worldToLocalXZ(r.minX, r.minZ, 5, 7, rot);
    expect(l.x).toBeCloseTo(0.3, 6);
    expect(l.z).toBeCloseTo(-0.2, 6);
  });
});
