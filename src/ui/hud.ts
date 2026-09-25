import * as THREE from 'three';
import { createLogo } from '../brand/logo';
import type { HudHitTester, Input, Intent } from '../core/input';
import { arrowGeometry } from './keysign';

/**
 * Screen-space overlay drawn with WebGL (orthographic camera in CSS pixels, origin bottom-left):
 * - four thin arrow buttons: touch controls on phones; on desktop both a movement hint and the
 *   mouse-only way to walk. They dim (never vanish, never stop working) a few seconds after the
 *   visitor walks with the keyboard, and stay bright while the pointer uses them;
 * - the loading screen (spinning logo + progress ring) while the world is built.
 */
function roundedRect(w: number, h: number, r: number, hole?: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  if (hole !== undefined) {
    const t = hole;
    s.holes.push(roundedRect(w - 2 * t, h - 2 * t, Math.max(0.5, r - t)) as unknown as THREE.Path);
  }
  return s;
}

interface Btn {
  intent: Intent;
  group: THREE.Group;
  fill: THREE.MeshBasicMaterial;
  ring: THREE.MeshBasicMaterial;
  arrow: THREE.MeshBasicMaterial;
  /** Grid cell in the inverted T (0,1 = top middle). */
  gx: number;
  gy: number;
  /** Centre in overlay pixels (origin bottom-left) and side length, set by resize(). */
  cx: number;
  cy: number;
  size: number;
}

/** Keyboard walkers see the arrows dimmed to this opacity (still visible, still pressable). */
const DIM = 0.35;
/** Segments of the loader's progress ring (drawn with a draw range, built once). */
const RING_SEGMENTS = 96;

export class Hud implements HudHitTester {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(0, 1, 1, 0, -10, 10);
  private readonly buttons: Btn[] = [];
  private readonly pad = new THREE.Group();
  private readonly loader = new THREE.Group();
  private readonly loaderLogo: THREE.Group;
  private readonly progressRing: THREE.Mesh;
  private readonly progressTrack: THREE.Mesh;

  private height = 1;
  private opacity = 1;
  private readonly touch: boolean;
  loading = true;
  progress = 0;

  constructor(private readonly input: Input) {
    this.touch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.scene.add(this.pad, this.loader);

    const layout: Array<[Intent, number, number, number]> = [
      ['forward', 0, 1, 0],
      ['left', -1, 0, Math.PI / 2],
      ['back', 0, 0, Math.PI],
      ['right', 1, 0, -Math.PI / 2],
    ];
    for (const [intent, gx, gy, rot] of layout) {
      const group = new THREE.Group();
      const fill = new THREE.MeshBasicMaterial({ color: '#1f2226', transparent: true, opacity: 0.28, depthTest: false });
      const ring = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthTest: false });
      const arrow = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, depthTest: false });
      const f = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(1, 1, 0.18)), fill);
      const r = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(1, 1, 0.18, 0.03)), ring);
      const a = new THREE.Mesh(arrowGeometry(), arrow);
      a.scale.setScalar(0.46);
      a.rotation.z = rot;
      // No depth test in the overlay: draw order decides what sits on top.
      f.renderOrder = 1;
      r.renderOrder = 2;
      a.renderOrder = 3;
      group.add(f, r, a);
      this.pad.add(group);
      this.buttons.push({ intent, group, fill, ring, arrow, gx, gy, cx: 0, cy: 0, size: 1 });
    }

    // Loader: logo + progress ring in the middle of the screen.
    this.loaderLogo = createLogo({ diameter: 1, style: 'flat' });
    let order = 1;
    this.loaderLogo.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m) {
        // Unlit and not tone mapped: the vertex colours come out as the exact brand colours.
        (o as THREE.Mesh).material = new THREE.MeshBasicMaterial({ vertexColors: true, depthTest: false, toneMapped: false });
        o.renderOrder = order++;
      }
    });
    this.loader.add(this.loaderLogo);
    this.progressTrack = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.64, 96), new THREE.MeshBasicMaterial({ color: '#c8cbce', depthTest: false }));
    this.progressTrack.renderOrder = 1;
    this.loader.add(this.progressTrack);
    // The full ring runs clockwise from 12 o'clock (negative sweep, so both faces are drawn);
    // progress only changes its draw range: no per-frame geometry.
    this.progressRing = new THREE.Mesh(
      new THREE.RingGeometry(0.615, 0.645, RING_SEGMENTS, 1, Math.PI / 2, -Math.PI * 2),
      new THREE.MeshBasicMaterial({ color: '#d90000', depthTest: false, side: THREE.DoubleSide }),
    );
    this.progressRing.geometry.setDrawRange(0, 0);
    this.progressRing.renderOrder = 2;
    this.loader.add(this.progressRing);
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#e6e7e9', depthTest: false }));
    bg.renderOrder = -1;
    bg.name = 'loader-bg';
    this.loader.add(bg);
    input.hud = this;
  }

  resize(w: number, h: number): void {
    this.height = h;
    this.camera.left = 0;
    this.camera.right = w;
    this.camera.top = h;
    this.camera.bottom = 0;
    this.camera.updateProjectionMatrix();
    const size = this.touch ? Math.round(Math.min(64, Math.max(50, Math.min(w, h) * 0.13))) : 38;
    const gap = this.touch ? 10 : 6;
    const margin = this.touch ? 22 : 24;
    const baseX = margin + size * 1.5 + gap;
    const baseY = margin + size / 2;
    for (const b of this.buttons) {
      b.cx = baseX + b.gx * (size + gap);
      b.cy = baseY + b.gy * (size + gap);
      b.size = size;
      b.group.position.set(b.cx, b.cy, 0);
      b.group.scale.setScalar(size);
    }
    const s = Math.min(w, h) * 0.22;
    this.loader.position.set(w / 2, h / 2, 0);
    this.loaderLogo.scale.setScalar(s);
    this.progressRing.scale.setScalar(s);
    this.progressTrack.scale.setScalar(s);
    const bg = this.loader.getObjectByName('loader-bg')!;
    bg.scale.set(w * 2, h * 2, 1);
  }

  /** Which arrow button (if any) is under a screen point. The pad always answers once loaded. */
  hit(clientX: number, clientY: number): Intent | null {
    if (this.loading) return null;
    const x = clientX;
    const y = this.height - clientY;
    for (const b of this.buttons) {
      if (Math.abs(x - b.cx) <= b.size / 2 && Math.abs(y - b.cy) <= b.size / 2) return b.intent;
    }
    return null;
  }

  /** Centre of an arrow button in client (CSS) pixels, for tests. */
  center(intent: Intent): { x: number; y: number } {
    const b = this.buttons.find((x) => x.intent === intent)!;
    return { x: b.cx, y: this.height - b.cy };
  }

  update(dt: number, t: number): void {
    this.loader.visible = this.loading;
    this.pad.visible = !this.loading;
    if (this.loading) {
      this.loaderLogo.rotation.y = Math.sin(t * 1.4) * 0.5;
      const p = THREE.MathUtils.clamp(this.progress, 0, 1);
      // RingGeometry indices: 6 per segment (one phi segment), in sweep order.
      this.progressRing.geometry.setDrawRange(0, Math.ceil(p * RING_SEGMENTS) * 6);
      return;
    }
    let target = 0.95;
    if (!(this.touch || this.input.usedTouch)) {
      // Desktop: full while the pointer uses the pad (and a while after), dimmed 4 s after
      // keyboard walking. Never hidden: it is the only way to walk for a mouse-only visitor.
      const now = performance.now();
      const inp = this.input;
      const padRecent = inp.padHeld || (inp.lastPadAt > 0 && now - inp.lastPadAt < 6000);
      const keysIdle = inp.lastKeyMoveAt > 0 && now - inp.lastKeyMoveAt > 4000;
      target = padRecent || !keysIdle ? 1 : DIM;
    }
    this.opacity += (target - this.opacity) * Math.min(1, dt * 2.5);
    for (const b of this.buttons) {
      const on = this.input.isHeld(b.intent);
      b.fill.color.set(on ? '#d90000' : '#1f2226');
      b.fill.opacity = (on ? 0.85 : 0.28) * this.opacity;
      b.ring.opacity = 0.9 * this.opacity;
      b.arrow.opacity = 0.95 * this.opacity;
    }
    this.pad.visible = true;
  }
}
