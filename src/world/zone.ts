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

/**
 * Fallback placement: lay ids out on a grid inside `area`, all facing `rotY`. Zone modules use
 * their own hand-placed slots; this keeps every scale visible while a zone is unfinished.
 */
export function gridSlots(
  ids: readonly ScaleId[],
  area: { minX: number; maxX: number; minZ: number; maxZ: number },
  rotY = 0,
): Partial<Record<ScaleId, Slot>> {
  const out: Partial<Record<ScaleId, Slot>> = {};
  const cols = Math.ceil(Math.sqrt(ids.length * ((area.maxX - area.minX) / Math.max(0.1, area.maxZ - area.minZ))));
  const rows = Math.ceil(ids.length / cols);
  ids.forEach((id, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    out[id] = {
      x: area.minX + ((c + 0.5) / cols) * (area.maxX - area.minX),
      z: area.minZ + ((r + 0.5) / rows) * (area.maxZ - area.minZ),
      rotY,
    };
  });
  return out;
}
