import * as THREE from 'three';
import { BRAND } from './colors';
import type { Division } from './urls';

/**
 * Wunder logo, drawn as geometry.
 *
 * PLACEHOLDER: the brand documents confirm a white "W" monogram on a red circle (#D90000) plus a
 * coloured division tag, but the official SVG masters are not public. This file is the single
 * place to swap in the official artwork (SVGLoader.createShapes → ShapeGeometry/ExtrudeGeometry)
 * without touching any caller. Callers only rely on: the logo faces +Z, is centred on the disc,
 * `diameter` is the disc diameter in metres, and userData.setHover(on) exists.
 */
export interface LogoOptions {
  /** Disc diameter in metres. */
  diameter: number;
  /** Adds the coloured division tag under the disc. `corporate` has no tag. */
  division?: Division;
  /** `solid` = a thick disc with a raised W (signs, totems); `flat` = thin decal (scales, paintings). */
  style?: 'solid' | 'flat';
  /** Disc thickness for `solid`, metres. Default diameter × 0.08. */
  depth?: number;
}

const DIVISION_COLOR: Partial<Record<Division, string>> = {
  medicale: BRAND.medicale,
  industriale: BRAND.industriale,
  design: BRAND.design,
};

/** The W as four slanted bars, in disc-radius units (disc radius = 1). */
function wShapes(): THREE.Shape[] {
  const w = 0.17; // horizontal bar width
  const top = 0.4;
  const bottom = -0.4;
  const mid = 0.16;
  const bars: Array<[number, number, number, number]> = [
    [-0.2, bottom, -0.53, top],
    [-0.2, bottom, 0, mid],
    [0.2, bottom, 0, mid],
    [0.2, bottom, 0.53, top],
  ];
  return bars.map(([bx, by, tx, ty]) => {
    const s = new THREE.Shape();
    s.moveTo(bx - w / 2, by);
    s.lineTo(bx + w / 2, by);
    s.lineTo(tx + w / 2, ty);
    s.lineTo(tx - w / 2, ty);
    s.closePath();
    return s;
  });
}

function tagShape(): THREE.Shape {
  // Rounded bar under the disc: 1.2R × 0.2R, centred 1.32R below the disc centre.
  const hw = 0.6;
  const hh = 0.1;
  const cy = -1.32;
  const s = new THREE.Shape();
  s.moveTo(-hw + hh, cy - hh);
  s.lineTo(hw - hh, cy - hh);
  s.absarc(hw - hh, cy, hh, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-hw + hh, cy + hh);
  s.absarc(-hw + hh, cy, hh, Math.PI / 2, (3 * Math.PI) / 2, false);
  return s;
}

let cachedW: THREE.ShapeGeometry | null = null;
let cachedWSolid: THREE.ExtrudeGeometry | null = null;
let cachedTag: THREE.ShapeGeometry | null = null;
let cachedDisc: THREE.CircleGeometry | null = null;

export function createLogo(opts: LogoOptions): THREE.Group {
  const R = opts.diameter / 2;
  const style = opts.style ?? 'flat';
  const g = new THREE.Group();
  g.name = 'wunder-logo';

  const red = new THREE.MeshStandardMaterial({ color: BRAND.red, roughness: 0.35, metalness: 0.0, emissive: BRAND.red, emissiveIntensity: 0.06 });
  const white = new THREE.MeshStandardMaterial({ color: BRAND.white, roughness: 0.4, emissive: '#ffffff', emissiveIntensity: 0.05 });

  if (style === 'solid') {
    const depth = opts.depth ?? opts.diameter * 0.08;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(R, R, depth, 64), red);
    disc.rotation.x = Math.PI / 2;
    disc.position.z = -depth / 2;
    disc.castShadow = true;
    g.add(disc);
    cachedWSolid ??= new THREE.ExtrudeGeometry(wShapes(), { depth: 0.12, bevelEnabled: false });
    const wMesh = new THREE.Mesh(cachedWSolid, white);
    wMesh.scale.set(R, R, R * 0.5);
    g.add(wMesh);
  } else {
    cachedDisc ??= new THREE.CircleGeometry(1, 48);
    const disc = new THREE.Mesh(cachedDisc, red);
    disc.scale.setScalar(R);
    g.add(disc);
    cachedW ??= new THREE.ShapeGeometry(wShapes());
    const wMesh = new THREE.Mesh(cachedW, white);
    wMesh.scale.setScalar(R);
    wMesh.position.z = Math.max(0.0008, R * 0.01);
    g.add(wMesh);
  }

  const tagColor = opts.division ? DIVISION_COLOR[opts.division] : undefined;
  if (tagColor) {
    cachedTag ??= new THREE.ShapeGeometry(tagShape());
    const tag = new THREE.Mesh(cachedTag, new THREE.MeshStandardMaterial({ color: tagColor, roughness: 0.45 }));
    tag.scale.setScalar(R);
    tag.position.z = style === 'solid' ? 0.001 : 0.0005;
    g.add(tag);
  }

  g.userData.logo = { division: opts.division ?? 'corporate' };
  g.userData.setHover = (on: boolean) => {
    red.emissiveIntensity = on ? 0.85 : 0.06;
    white.emissiveIntensity = on ? 0.6 : 0.05;
  };
  return g;
}

export function setLogoHover(obj: THREE.Object3D, on: boolean): void {
  const fn = obj.userData.setHover as ((on: boolean) => void) | undefined;
  if (fn) fn(on);
  else obj.traverse((o) => (o.userData.setHover as ((on: boolean) => void) | undefined)?.(on));
}
