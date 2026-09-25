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
