import * as THREE from 'three';

/**
 * Greys for the building. A slight cool bias keeps them from reading as default mid-grey.
 * Brand colours live in src/brand/colors.ts; scales use their own real finishes (see scales/kit).
 */
export const GREY = {
  plaza: '#9a9da1',
  floor: '#86898d',
  floorWing: '#7c7f83',
  floorGallery: '#b4b6b9',
  wall: '#c7c9cc',
  wallDark: '#a9acb0',
  ceiling: '#e1e2e4',
  trim: '#9b9ea2',
  dark: '#3a3d42',
  darker: '#2a2c30',
  pedestal: '#d9dadc',
  light: '#f2f3f4',
  sky: '#cfd2d5',
} as const;

function std(color: string, roughness = 0.85, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

/** Shared material instances (reuse them: fewer programs and merged draw calls). */
export function createMaterials() {
  return {
    plaza: std(GREY.plaza, 0.95),
    floor: std(GREY.floor, 0.55),
    floorWing: std(GREY.floorWing, 0.6),
    floorGallery: std(GREY.floorGallery, 0.4),
    wall: std(GREY.wall, 0.92),
    wallDark: std(GREY.wallDark, 0.9),
    ceiling: std(GREY.ceiling, 0.95),
    trim: std(GREY.trim, 0.7),
    dark: std(GREY.dark, 0.6),
    darker: std(GREY.darker, 0.5),
    pedestal: std(GREY.pedestal, 0.8),
    light: std(GREY.light, 0.7),
    metal: std('#b9bdc2', 0.35, 0.9),
    metalDark: std('#6c7076', 0.4, 0.85),
    glass: new THREE.MeshStandardMaterial({
      color: '#dfe6ea',
      roughness: 0.05,
      metalness: 0.1,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    /** Ceiling light panels: emissive, not lit. */
    lamp: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1.4, roughness: 1 }),
  };
}

export type Materials = ReturnType<typeof createMaterials>;
