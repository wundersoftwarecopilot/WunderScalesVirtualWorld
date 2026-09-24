import type * as THREE from 'three';
import type { ScaleId, ScaleSpec } from './specs';

/** A rectangle in the scale's local floor frame, metres (centre x,z; full width w, depth d). */
export interface LocalRect {
  x: number;
  z: number;
  w: number;
  d: number;
}

/**
 * A built scale.
 *
 * Conventions every model follows:
 * - `root` origin = centre of the footprint on the ground (y = 0 is the underside of the feet).
 * - The front (where the visitor stands, where displays face) points to local +Z.
 * - Units are metres on `root`; builders usually work in cm inside kit.createScaleRoot().cm.
 * - No text anywhere: displays are 7-segment geometry, logos come from kit.logoBadge().
 */
export interface ScaleInstance {
  root: THREE.Object3D;
  /** Overall bounding size in metres (x, z, y). Used for pedestal sizing and fallback collision. */
  size: { w: number; d: number; h: number };
  /**
   * Floor scales the visitor can step onto: platform rectangle (local, metres) and its top
   * height. Stepping on raises the eye by `y` and calls weigh(true).
   */
  standOn?: LocalRect & { y: number };
  /**
   * Solid parts the visitor collides with (local, metres). If omitted: the whole footprint is
   * solid, unless standOn is set, in which case nothing is solid.
   */
  colliders?: LocalRect[];
  /** Start (true) or end (false) a weighing: someone stepped on, or came close to a table scale. */
  weigh?(active: boolean): void;
  /** Per-frame animation (displays counting, needles swinging). */
  update?(dt: number, t: number): void;
}

export interface ScaleDef {
  spec: ScaleSpec;
  build(): ScaleInstance;
}

export type ScaleModule = { default: ScaleDef | ScaleDef[] };
export type { ScaleId };
