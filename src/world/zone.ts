import type { ScaleId } from '../scales/specs';
import type { WorldContext } from './context';
import type { Opening, ZoneId, ZoneShell } from './layout';

/**
 * Where a scale stands: world position of the scale's origin (centre of its footprint on the
 * floor) and its rotation about Y. The scale's front (+Z local) faces the direction rotY turns
 * +Z to, so rotY = 0 faces south (+Z), Math.PI faces north, +PI/2 faces east, -PI/2 faces west.
 *
 * For pedestal pieces the slot is the pedestal's floor position; the world builds the pedestal
 * (sized to the scale) and sets the scale on top.
 */
export interface Slot {
  x: number;
  z: number;
  rotY: number;
}

export interface ZoneInput {
  ctx: WorldContext;
  shell: ZoneShell;
  /** Doorways that touch this zone: keep their `clear` rectangles free of props. */
  openings: Opening[];
}

export interface ZoneOutput {
  /** Positions for this zone's scales (see SPECS for sizes and placement). */
  slots: Partial<Record<ScaleId, Slot>>;
}

export interface ZoneModule {
  id: ZoneId;
  build(input: ZoneInput): ZoneOutput;
}
