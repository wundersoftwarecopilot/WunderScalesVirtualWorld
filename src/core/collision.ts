import type { Rect } from './rect';

export interface Collider extends Rect {
  /** Disabled colliders are skipped (used by the sliding doors). */
  enabled?: boolean;
  tag?: string;
}

/**
 * Static 2D collision world: circles (the visitor) against axis-aligned rectangles, with a
 * uniform grid so each query only touches nearby boxes.
 */
export class CollisionWorld {
  private readonly cell: number;
  private readonly grid = new Map<string, Collider[]>();
  private readonly all: Collider[] = [];

  constructor(cell = 2) {
    this.cell = cell;
  }

  get count(): number {
    return this.all.length;
  }

  add(r: Rect, tag?: string): Collider {
    const c: Collider = { ...r, enabled: true, tag };
    this.all.push(c);
    const { cell } = this;
    for (let gx = Math.floor(c.minX / cell); gx <= Math.floor(c.maxX / cell); gx++) {
      for (let gz = Math.floor(c.minZ / cell); gz <= Math.floor(c.maxZ / cell); gz++) {
        const key = gx + ',' + gz;
        let list = this.grid.get(key);
        if (!list) this.grid.set(key, (list = []));
        list.push(c);
      }
    }
    return c;
  }

  /** Colliders whose grid cells touch the circle's bounding square. */
  near(x: number, z: number, radius: number): Collider[] {
    const { cell } = this;
    const out = new Set<Collider>();
    for (let gx = Math.floor((x - radius) / cell); gx <= Math.floor((x + radius) / cell); gx++) {
      for (let gz = Math.floor((z - radius) / cell); gz <= Math.floor((z + radius) / cell); gz++) {
        const list = this.grid.get(gx + ',' + gz);
        if (list) for (const c of list) if (c.enabled !== false) out.add(c);
      }
    }
    return [...out];
  }

  /** True when a circle at (x,z) overlaps any enabled collider. */
  blocked(x: number, z: number, radius: number): boolean {
    for (const c of this.near(x, z, radius)) {
      const px = Math.max(c.minX, Math.min(x, c.maxX));
      const pz = Math.max(c.minZ, Math.min(z, c.maxZ));
      if ((x - px) ** 2 + (z - pz) ** 2 < radius * radius) return true;
    }
    return false;
  }

  /**
   * Move a circle from (x,z) by (dx,dz), sliding along walls. Sub-steps keep fast movement from
   * tunnelling through thin walls.
   */
  move(x: number, z: number, dx: number, dz: number, radius: number): { x: number; z: number } {
    const dist = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(dist / (radius * 0.5)));
    let px = x;
    let pz = z;
    for (let i = 0; i < steps; i++) {
      px += dx / steps;
      pz += dz / steps;
      for (let iter = 0; iter < 4; iter++) {
        let pushed = false;
        for (const c of this.near(px, pz, radius)) {
          const cx = Math.max(c.minX, Math.min(px, c.maxX));
          const cz = Math.max(c.minZ, Math.min(pz, c.maxZ));
          const ox = px - cx;
          const oz = pz - cz;
          const d2 = ox * ox + oz * oz;
          if (d2 >= radius * radius) continue;
          if (d2 > 1e-10) {
            const d = Math.sqrt(d2);
            px += (ox / d) * (radius - d);
            pz += (oz / d) * (radius - d);
          } else {
            // Centre inside the box: push out through the nearest side.
            const l = px - c.minX;
            const r = c.maxX - px;
            const t = pz - c.minZ;
            const b = c.maxZ - pz;
            const m = Math.min(l, r, t, b);
            if (m === l) px = c.minX - radius;
            else if (m === r) px = c.maxX + radius;
            else if (m === t) pz = c.minZ - radius;
            else pz = c.maxZ + radius;
          }
          pushed = true;
        }
        if (!pushed) break;
      }
    }
    return { x: px, z: pz };
  }
}
