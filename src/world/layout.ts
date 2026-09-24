import { rect, type Rect } from '../core/rect';

/**
 * Floor plan, metres. X = east, Z = south (+Z points out of the front door, towards the plaza).
 * The visitor starts outside on the plaza looking north at the facade.
 *
 *                 z=-16 ┌──────────────┬──────────┬──────────────┐
 *                       │              │  DESIGN  │              │
 *                       │   MEDICALE   │ gallery  │  INDUSTRIALE │
 *                       │  (clinic)    ├──┐ ┌─────┤  warehouse   │
 *                  z=0  │              │  LOBBY   │  ─ ─ ─ ─ ─ ─ │
 *                       │            ══╡ reception╞══ supermarket│
 *                 z=16  └──────────────┴──[door]──┴──────────────┘
 *                                        PLAZA (spawn)
 *                      x=-34         x=-10      x=10           x=34
 */

export const WALL = 0.3;

export type ZoneId = 'entrance' | 'medicale' | 'industriale' | 'design';

export interface ZoneShell {
  id: ZoneId;
  /** Interior floor rectangle (inside the walls). */
  inner: Rect;
  /** Ceiling height, metres. */
  height: number;
}

/** Openings between zones and to the outside: keep these walkable (no props inside). */
export interface Opening {
  id: string;
  /** Floor rectangle of the doorway, extended ~1.5 m into each side so paths stay clear. */
  clear: Rect;
  /** Doorway centre and which way it faces (the axis you walk through). */
  x: number;
  z: number;
  width: number;
  axis: 'x' | 'z';
}

export const BUILDING = rect(-34, -16, 34, 16);
export const PLAZA = rect(-24, 16, 24, 34);

export const ZONES: Record<ZoneId, ZoneShell> = {
  entrance: { id: 'entrance', inner: rect(-10 + WALL / 2, 0 + WALL / 2, 10 - WALL / 2, 16 - WALL / 2), height: 6 },
  medicale: { id: 'medicale', inner: rect(-34 + WALL / 2, -16 + WALL / 2, -10 - WALL / 2, 16 - WALL / 2), height: 3.6 },
  industriale: { id: 'industriale', inner: rect(10 + WALL / 2, -16 + WALL / 2, 34 - WALL / 2, 16 - WALL / 2), height: 7.5 },
  design: { id: 'design', inner: rect(-10 + WALL / 2, -16 + WALL / 2, 10 - WALL / 2, 0 - WALL / 2), height: 5 },
};

export const OPENINGS: Opening[] = [
  // Front door on the facade (sliding glass doors).
  { id: 'front', x: 0, z: 16, width: 3.2, axis: 'z', clear: rect(-2, 13.5, 2, 18.5) },
  // Lobby → Medicale (west wall of the lobby).
  { id: 'to-medicale', x: -10, z: 8, width: 4, axis: 'x', clear: rect(-12.5, 5.8, -7.5, 10.2) },
  // Lobby → Industriale (east wall of the lobby).
  { id: 'to-industriale', x: 10, z: 8, width: 4, axis: 'x', clear: rect(7.5, 5.8, 12.5, 10.2) },
  // Lobby → Design gallery (north wall of the lobby).
  { id: 'to-design', x: 0, z: 0, width: 5, axis: 'z', clear: rect(-2.8, -2.5, 2.8, 2.5) },
];

/** Where the visitor starts: on the plaza, facing the facade (yaw 0 = looking towards -Z). */
export const SPAWN = { x: 0, z: 27, yaw: 0 };

/** Named viewpoints for tests, screenshots and debugging. */
export const VIEWPOINTS: Record<string, { x: number; z: number; yaw: number; pitch?: number }> = {
  plaza: SPAWN,
  facade: { x: 0, z: 22, yaw: 0, pitch: 0.18 },
  lobby: { x: 0, z: 13.5, yaw: 0 },
  reception: { x: 0, z: 9.5, yaw: 0, pitch: 0.1 },
  medicale: { x: -12, z: 8, yaw: Math.PI / 2 },
  'medicale-deep': { x: -22, z: 0, yaw: Math.PI / 2 + 0.6 },
  industriale: { x: 12, z: 8, yaw: -Math.PI / 2 },
  'industriale-deep': { x: 22, z: -4, yaw: -Math.PI / 2 - 0.5 },
  design: { x: 0, z: -1.5, yaw: 0 },
  'design-deep': { x: 0, z: -12, yaw: Math.PI },
};
