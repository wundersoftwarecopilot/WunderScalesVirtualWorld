/** Axis-aligned rectangle on the floor plane (world XZ, metres). */
export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function rect(minX: number, minZ: number, maxX: number, maxZ: number): Rect {
  return { minX: Math.min(minX, maxX), maxX: Math.max(minX, maxX), minZ: Math.min(minZ, maxZ), maxZ: Math.max(minZ, maxZ) };
}

/** Rectangle from a centre point and full width (x) / depth (z). */
export function rectAt(cx: number, cz: number, w: number, d: number): Rect {
  return { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 };
}

export function rectCenter(r: Rect): { x: number; z: number } {
  return { x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 };
}

export function rectSize(r: Rect): { w: number; d: number } {
  return { w: r.maxX - r.minX, d: r.maxZ - r.minZ };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

export function rectContains(r: Rect, x: number, z: number): boolean {
  return x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
}

export function inflate(r: Rect, by: number): Rect {
  return { minX: r.minX - by, maxX: r.maxX + by, minZ: r.minZ - by, maxZ: r.maxZ + by };
}

/**
 * Rotate a local rectangle (centre x,z and size w,d in an object's local frame) by rotY around
 * the object's origin and translate it to (ox, oz). Returns the world-space AABB.
 */
export function localRectToWorld(
  local: { x: number; z: number; w: number; d: number },
  ox: number,
  oz: number,
  rotY: number,
): Rect {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const sx of [-0.5, 0.5]) {
    for (const sz of [-0.5, 0.5]) {
      const lx = local.x + sx * local.w;
      const lz = local.z + sz * local.d;
      // three.js rotation about +Y: x' = x cos + z sin, z' = -x sin + z cos
      const wx = ox + lx * c + lz * s;
      const wz = oz - lx * s + lz * c;
      minX = Math.min(minX, wx);
      maxX = Math.max(maxX, wx);
      minZ = Math.min(minZ, wz);
      maxZ = Math.max(maxZ, wz);
    }
  }
  return { minX, maxX, minZ, maxZ };
}

/** World point → an object's local XZ frame (inverse of the transform above). */
export function worldToLocalXZ(x: number, z: number, ox: number, oz: number, rotY: number): { x: number; z: number } {
  const dx = x - ox;
  const dz = z - oz;
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}
