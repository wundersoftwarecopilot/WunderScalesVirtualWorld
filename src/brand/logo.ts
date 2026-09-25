import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
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

/**
 * Each logo is ONE mesh (one draw call): disc, W and division tag are merged into a single
 * geometry with vertex colours. The emissive term is multiplied by the vertex colour (shader
 * patch below), so one material per logo still gives a red disc, white W and coloured tag.
 *
 * Finish: the brand colours are never recoloured by the light. A lit PBR surface (any
 * roughness) picked up Fresnel and environment reflections and, lit by sun + sky, went past the
 * tone mapper's knee: signs read #F02828 face-on and salmon at grazing angles. So the logo is a
 * Lambert surface (no specular, no reflections) whose colour comes mostly from emission, with a
 * little diffuse light for shape: the frame shows about #D90000 wherever it hangs, in sun or shade.
 */
/** Share of the vertex colour that is lit (linear): gives solid signs their shading. */
const DIFFUSE = 0.3;
/** Share that is emitted: the part that holds the colour whatever the light. */
const EMISSIVE_REST = 0.6;
const EMISSIVE_HOVER = 1.1;

function tintEmissive(shader: THREE.WebGLProgramParametersWithUniforms): void {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <emissivemap_fragment>',
    '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vColor.rgb;',
  );
}

function logoMaterial(): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({
    color: new THREE.Color(DIFFUSE, DIFFUSE, DIFFUSE),
    vertexColors: true,
    emissive: '#ffffff',
    emissiveIntensity: EMISSIVE_REST,
  });
  m.name = 'wunder-logo';
  m.onBeforeCompile = tintEmissive;
  m.customProgramCacheKey = () => 'wunder-logo';
  return m;
}

/** Non-indexed copy with a constant vertex colour and only position/normal/uv/color. */
function painted(geo: THREE.BufferGeometry, color: string, m?: THREE.Matrix4): THREE.BufferGeometry {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
  if (m) g = g.applyMatrix4(m);
  const c = new THREE.Color(color);
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

let cachedWFlat: THREE.ShapeGeometry | null = null;
let cachedWSolid: THREE.ExtrudeGeometry | null = null;
let cachedTag: THREE.ShapeGeometry | null = null;
/** Tag as a unit-depth solid (z 0..1), scaled to the sign's depth. */
let cachedTagSolid: THREE.ExtrudeGeometry | null = null;
/** Flat logos in unit form (disc radius 1, W at z = 1, tag at z = 0.6): scaled per logo. */
const flatCache = new Map<string, THREE.BufferGeometry>();

function flatUnit(tagColor: string | undefined): THREE.BufferGeometry {
  const key = tagColor ?? 'none';
  const hit = flatCache.get(key);
  if (hit) return hit;
  cachedWFlat ??= new THREE.ShapeGeometry(wShapes());
  const parts = [painted(new THREE.CircleGeometry(1, 48), BRAND.red), painted(cachedWFlat, BRAND.white, new THREE.Matrix4().makeTranslation(0, 0, 1))];
  if (tagColor) {
    cachedTag ??= new THREE.ShapeGeometry(tagShape());
    parts.push(painted(cachedTag, tagColor, new THREE.Matrix4().makeTranslation(0, 0, 0.6)));
  }
  const g = mergeGeometries(parts, false)!;
  for (const p of parts) p.dispose();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  flatCache.set(key, g);
  return g;
}

export function createLogo(opts: LogoOptions): THREE.Group {
  const R = opts.diameter / 2;
  const style = opts.style ?? 'flat';
  const g = new THREE.Group();
  g.name = 'wunder-logo';
  const mat = logoMaterial();
  const tagColor = opts.division ? DIVISION_COLOR[opts.division] : undefined;

  let mesh: THREE.Mesh;
  if (style === 'solid') {
    const depth = opts.depth ?? opts.diameter * 0.08;
    cachedWSolid ??= new THREE.ExtrudeGeometry(wShapes(), { depth: 0.12, bevelEnabled: false });
    const discM = new THREE.Matrix4().makeTranslation(0, 0, -depth / 2).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    const parts = [
      painted(new THREE.CylinderGeometry(R, R, depth, 64), BRAND.red, discM),
      painted(cachedWSolid, BRAND.white, new THREE.Matrix4().makeScale(R, R, R * 0.5)),
    ];
    if (tagColor) {
      // A solid bar as deep as the disc, mounted on the wall like it (z −depth..0).
      cachedTagSolid ??= new THREE.ExtrudeGeometry(tagShape(), { depth: 1, bevelEnabled: false });
      parts.push(painted(cachedTagSolid, tagColor, new THREE.Matrix4().makeTranslation(0, 0, -depth).multiply(new THREE.Matrix4().makeScale(R, R, depth))));
    }
    const geo = mergeGeometries(parts, false)!;
    for (const p of parts) p.dispose();
    mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
  } else {
    mesh = new THREE.Mesh(flatUnit(tagColor), mat);
    // x/y scale the artwork; z sets the stacking gaps (W 1 mm-ish above the disc, tag below it).
    mesh.scale.set(R, R, Math.max(0.0008, R * 0.01));
  }
  mesh.name = 'wunder-logo-mesh';
  g.add(mesh);

  g.userData.logo = { division: opts.division ?? 'corporate' };
  g.userData.setHover = (on: boolean) => {
    mat.emissiveIntensity = on ? EMISSIVE_HOVER : EMISSIVE_REST;
  };
  return g;
}

export function setLogoHover(obj: THREE.Object3D, on: boolean): void {
  const fn = obj.userData.setHover as ((on: boolean) => void) | undefined;
  if (fn) fn(on);
  else obj.traverse((o) => (o.userData.setHover as ((on: boolean) => void) | undefined)?.(on));
}
