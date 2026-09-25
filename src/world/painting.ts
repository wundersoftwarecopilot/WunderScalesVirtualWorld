import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BRAND } from '../brand/colors';
import { createLogo } from '../brand/logo';
import type { Division } from '../brand/urls';

/**
 * A framed canvas "painting": abstract grey brushwork generated in code (no image files), a few
 * strokes in the division colour, signed with the Wunder logo (geometry) in a corner, the way an
 * artist signs a canvas: an artwork carrying the mark, not one more sign.
 * Faces +Z; origin at the canvas centre; the back of the frame sits at z = 0 (hang it flush on
 * a wall surface).
 */
export interface PaintingOptions {
  /** Canvas size in metres (without frame). */
  w: number;
  h: number;
  division?: Division;
  seed?: number;
  /**
   * Which corner carries the logo: `left`/`low` lower left, `right`/`center` lower right,
   * `high` upper right.
   */
  composition?: 'center' | 'left' | 'right' | 'high' | 'low';
  /** Logo diameter as a fraction of min(w,h). Default 0.2. */
  logoScale?: number;
  frame?: 'dark' | 'light' | 'none';
  url?: string;
  label?: string;
}

const ACCENT: Record<Division, string> = {
  corporate: BRAND.red,
  medicale: BRAND.medicale,
  industriale: BRAND.industriale,
  design: BRAND.design,
};

function hash(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

function noise2(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const h = (a: number, b: number) => hash(a * 57 + b * 113 + seed * 7.13);
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
}

function fbm(x: number, y: number, seed: number): number {
  let a = 0.5;
  let s = 0;
  let f = 1;
  for (let o = 0; o < 4; o++) {
    s += a * noise2(x * f, y * f, seed + o * 17);
    f *= 2.03;
    a *= 0.5;
  }
  return s;
}

/** Ellipse in texture space (u, v in 0..1, v = 0 at the bottom) the accent strokes keep out of. */
interface ClearZone {
  u: number;
  v: number;
  ru: number;
  rv: number;
}

function paintTexture(seed: number, accent: string, aspect: number, clear?: ClearZone): THREE.DataTexture {
  const W = 256;
  const H = Math.max(64, Math.round(256 / aspect));
  const data = new Uint8Array(W * H * 4);
  const acc = new THREE.Color(accent);
  // HSL here is in linear working space: keep the ground mid-grey so the canvas does not wash out.
  const base = new THREE.Color().setHSL(0.58, 0.04, 0.42 + hash(seed) * 0.16);
  const dark = new THREE.Color().setHSL(0.58, 0.05, 0.12 + hash(seed + 1) * 0.06);
  const light = new THREE.Color('#f1f1ef');
  // A few broad accent strokes, laid left to right: [y centre 0..1, half thickness, x start, x end,
  // bow (gentle vertical curve), phase]. Soft edges, tapered ends and bristle streaks that run
  // ALONG the stroke: nothing may break up into short vertical marks (they read as handwriting).
  const strokes = Array.from({ length: 2 + Math.floor(hash(seed + 3) * 2) }, (_, i) => [
    0.18 + hash(seed + 10 + i) * 0.64,
    0.035 + hash(seed + 20 + i) * 0.05,
    0.04 + hash(seed + 30 + i) * 0.36,
    0.58 + hash(seed + 40 + i) * 0.38,
    (hash(seed + 50 + i) - 0.5) * 0.08,
    hash(seed + 60 + i) * 6.28,
  ]);
  // Bristle streak frequency: about one streak every 3 texels across the stroke.
  const streakF = H / 3;
  const ss = THREE.MathUtils.smoothstep;
  const c = new THREE.Color();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = y / H;
      // Horizontal brush bands: noise stretched along X.
      const n = fbm(u * 3, v * 14, seed);
      const bands = fbm(u * 1.2 + n * 0.3, v * 5, seed + 5);
      c.copy(base).lerp(dark, ss(bands, 0.45, 0.75));
      c.lerp(light, ss(n, 0.62, 0.8) * 0.55);
      // No accent paint round the logo: its division tag must not read as one more stroke.
      const keep = clear ? ss(Math.hypot((u - clear.u) / clear.ru, (v - clear.v) / clear.rv), 1, 1.4) : 1;
      for (const [sy, th, x0, x1, bow, ph] of strokes) {
        if (keep <= 0 || u < x0 || u > x1) continue;
        const t = (u - x0) / (x1 - x0);
        const centre = sy + bow * Math.sin(t * Math.PI + ph * 0.2);
        // Loaded start, thinning dry tail.
        const taper = ss(t, 0, 0.06) * (1 - ss(t, 0.72, 1));
        const half = th * (0.55 + 0.45 * taper) * (0.9 + 0.2 * noise2(t * 3, sy * 7, seed + 99));
        const d = Math.abs(v - centre) / half;
        if (d > 1.15) continue;
        const streak = noise2(u * 2.2, v * streakF, seed + 7); // long streaks along the stroke
        const dry = ss(t, 0.55, 1) * (1 - ss(streak, 0.25, 0.55)); // paint runs out towards the end
        const cover = (1 - ss(d, 0.7, 1.15)) * ss(t, 0, 0.03) * (1 - dry) * (0.78 + 0.22 * streak) * keep;
        c.lerp(acc, 0.88 * cover);
      }
      // Canvas grain.
      const g = (hash(x * 31 + y * 17 + seed) - 0.5) * 0.04;
      c.r += g;
      c.g += g;
      c.b += g;
      const o = c.clone().convertLinearToSRGB();
      const i = (y * W + x) * 4;
      data[i] = Math.round(THREE.MathUtils.clamp(o.r, 0, 1) * 255);
      data[i + 1] = Math.round(THREE.MathUtils.clamp(o.g, 0, 1) * 255);
      data[i + 2] = Math.round(THREE.MathUtils.clamp(o.b, 0, 1) * 255);
      data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, W, H);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.flipY = false;
  t.needsUpdate = true;
  return t;
}

const frameDark = new THREE.MeshStandardMaterial({ color: '#2e3034', roughness: 0.5 });
const frameLight = new THREE.MeshStandardMaterial({ color: '#e7e8e9', roughness: 0.6 });

/**
 * Draw calls: the painted face (its own texture) and the logo stay in the group; the frame (or
 * the canvas edges when unframed) is ONE merged mesh marked `userData.paintingStatic`, which
 * `WorldContext.painting()` hands to the static batcher (all frames in the world share a batch).
 */
export function createPainting(o: PaintingOptions): THREE.Group {
  const seed = o.seed ?? 1;
  const division = o.division ?? 'corporate';
  const g = new THREE.Group();
  g.name = 'painting';
  const depth = 0.04;
  // The signature: logo diameter, corner and the lockup's extent (disc + division tag below).
  const size = Math.min(o.w, o.h) * (o.logoScale ?? 0.2);
  const R = size / 2;
  const tagged = division !== 'corporate';
  const below = tagged ? 1.42 * R : R; // lockup bottom under the disc centre
  const margin = Math.max(0.05, 0.9 * R);
  const left = -o.w / 2 + margin + R;
  const right = o.w / 2 - margin - R;
  const bottom = -o.h / 2 + margin + below;
  const topY = o.h / 2 - margin - R;
  const [lx, ly] = { center: [right, bottom], left: [left, bottom], right: [right, bottom], high: [right, topY], low: [left, bottom] }[o.composition ?? 'center'];
  const lockR = (R + below) / 2 + 0.25 * R; // circle round disc and tag
  const lockY = ly + (R - below) / 2;
  const clear: ClearZone = { u: lx / o.w + 0.5, v: lockY / o.h + 0.5, ru: (lockR * 1.25) / o.w, rv: (lockR * 1.25) / o.h };
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(o.w, o.h),
    new THREE.MeshStandardMaterial({ map: paintTexture(seed, ACCENT[division], o.w / o.h, clear), roughness: 0.85 }),
  );
  face.name = 'painting-canvas';
  face.position.z = depth + 0.005;
  g.add(face);

  const frame = o.frame ?? 'dark';
  const parts: THREE.BufferGeometry[] = [];
  // Stretcher block behind the face (its front stops 1 mm short of the painted plane).
  const block = new THREE.BoxGeometry(o.w, o.h, depth - 0.001);
  block.translate(0, 0, (depth - 0.001) / 2 + 0.005);
  parts.push(block);
  if (frame !== 'none') {
    const t = 0.05;
    const fd = depth + 0.03;
    for (const [x, y, w, h] of [
      [0, o.h / 2 + t / 2, o.w + 2 * t, t],
      [0, -o.h / 2 - t / 2, o.w + 2 * t, t],
      [-o.w / 2 - t / 2, 0, t, o.h],
      [o.w / 2 + t / 2, 0, t, o.h],
    ] as const) {
      const b = new THREE.BoxGeometry(w, h, fd);
      b.translate(x, y, fd / 2);
      parts.push(b);
    }
  }
  const shell = new THREE.Mesh(mergeGeometries(parts, false)!, frame === 'dark' ? frameDark : frameLight);
  for (const p of parts) p.dispose();
  shell.name = 'painting-frame';
  shell.castShadow = true;
  shell.userData.paintingStatic = true;
  g.add(shell);

  const logo = createLogo({ diameter: size, division, style: 'flat' });
  logo.position.set(lx, ly, depth + 0.008);
  g.add(logo);
  g.userData.logo = logo;
  g.userData.setHover = (on: boolean) => (logo.userData.setHover as (b: boolean) => void)(on);
  return g;
}
