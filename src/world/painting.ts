import * as THREE from 'three';
import { BRAND } from '../brand/colors';
import { createLogo } from '../brand/logo';
import type { Division } from '../brand/urls';

/**
 * A framed canvas "painting" of the Wunder logo: abstract grey brushwork generated in code
 * (no image files), a few strokes in the division colour, and the logo as geometry on top.
 * Faces +Z; origin at the canvas centre; the back of the frame sits at z = 0 (hang it flush on
 * a wall surface).
 */
export interface PaintingOptions {
  /** Canvas size in metres (without frame). */
  w: number;
  h: number;
  division?: Division;
  seed?: number;
  /** Where the logo sits in the composition. */
  composition?: 'center' | 'left' | 'right' | 'high' | 'low';
  /** Logo diameter as a fraction of min(w,h). Default 0.42. */
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

function paintTexture(seed: number, accent: string, aspect: number): THREE.DataTexture {
  const W = 256;
  const H = Math.max(64, Math.round(256 / aspect));
  const data = new Uint8Array(W * H * 4);
  const acc = new THREE.Color(accent);
  const base = new THREE.Color().setHSL(0.58, 0.04, 0.6 + hash(seed) * 0.2);
  const dark = new THREE.Color().setHSL(0.58, 0.05, 0.28 + hash(seed + 1) * 0.1);
  const light = new THREE.Color('#f1f1ef');
  // A few broad accent strokes: [y centre 0..1, thickness, x start, x end]
  const strokes = Array.from({ length: 2 + Math.floor(hash(seed + 3) * 2) }, (_, i) => [
    0.15 + hash(seed + 10 + i) * 0.7,
    0.03 + hash(seed + 20 + i) * 0.06,
    hash(seed + 30 + i) * 0.4,
    0.55 + hash(seed + 40 + i) * 0.45,
  ]);
  const c = new THREE.Color();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = y / H;
      // Horizontal brush bands: noise stretched along X.
      const n = fbm(u * 3, v * 14, seed);
      const bands = fbm(u * 1.2 + n * 0.3, v * 5, seed + 5);
      c.copy(base).lerp(dark, THREE.MathUtils.smoothstep(bands, 0.45, 0.75));
      c.lerp(light, THREE.MathUtils.smoothstep(n, 0.62, 0.8) * 0.55);
      for (const [sy, th, x0, x1] of strokes) {
        const edge = th * (0.7 + 0.6 * noise2(u * 20, sy * 10, seed + 99));
        const inside = Math.abs(v - sy) < edge && u > x0 && u < x1;
        if (inside) {
          const dry = noise2(u * 60, v * 8, seed + 7); // dry-brush breakup
          if (dry > 0.35) c.lerp(acc, 0.85);
        }
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

export function createPainting(o: PaintingOptions): THREE.Group {
  const seed = o.seed ?? 1;
  const division = o.division ?? 'corporate';
  const g = new THREE.Group();
  g.name = 'painting';
  const depth = 0.04;
  const canvas = new THREE.Mesh(
    new THREE.BoxGeometry(o.w, o.h, depth),
    [
      frameLight,
      frameLight,
      frameLight,
      frameLight,
      new THREE.MeshStandardMaterial({ map: paintTexture(seed, ACCENT[division], o.w / o.h), roughness: 0.85 }),
      frameLight,
    ],
  );
  canvas.position.z = depth / 2 + 0.005;
  canvas.castShadow = true;
  g.add(canvas);

  const frame = o.frame ?? 'dark';
  if (frame !== 'none') {
    const fm = frame === 'dark' ? frameDark : frameLight;
    const t = 0.05;
    const fd = depth + 0.03;
    const parts: Array<[number, number, number, number]> = [
      [0, o.h / 2 + t / 2, o.w + 2 * t, t],
      [0, -o.h / 2 - t / 2, o.w + 2 * t, t],
      [-o.w / 2 - t / 2, 0, t, o.h],
      [o.w / 2 + t / 2, 0, t, o.h],
    ];
    for (const [x, y, w, h] of parts) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, fd), fm);
      m.position.set(x, y, fd / 2);
      m.castShadow = true;
      g.add(m);
    }
  }

  const size = Math.min(o.w, o.h) * (o.logoScale ?? 0.42);
  const logo = createLogo({ diameter: size, division, style: 'flat' });
  const off = { center: [0, 0], left: [-o.w * 0.22, o.h * 0.05], right: [o.w * 0.22, -o.h * 0.05], high: [o.w * 0.08, o.h * 0.2], low: [-o.w * 0.08, -o.h * 0.18] }[o.composition ?? 'center'];
  logo.position.set(off[0], off[1] + (division !== 'corporate' ? size * 0.12 : 0), depth + 0.008);
  g.add(logo);
  g.userData.setHover = (on: boolean) => (logo.userData.setHover as (b: boolean) => void)(on);
  return g;
}
