import * as THREE from 'three';
import { createLogo } from '../brand/logo';
import type { HudHitTester, Input, Intent } from '../core/input';
import { arrowGeometry } from './keysign';
import { CLICK_LINES, ESC_LINES, Watermark } from './watermark';

/**
 * Screen-space overlay drawn with WebGL (orthographic camera in CSS pixels, origin bottom-left):
 * - four thin arrow buttons (walk / step sideways): touch controls on phones; on desktop both a
 *   movement hint and the mouse-only way to walk. They dim (never vanish, never stop working) a
 *   few seconds after the visitor walks with the keyboard, and stay bright while the pointer
 *   uses them;
 * - with a mouse: a small mouse icon whose left button pulses ("click to look around") until the
 *   pointer is locked; then a crosshair in the middle, ringed in white over a logo (the logo glows);
 * - with a finger: a small touch hint, a fingertip swiping sideways ("drag to look around") until
 *   the visitor first turns, then two fingertips spreading ("pinch to zoom") until they first zoom.
 *   The hints follow the pointer in use (`input.pointerType`), so a touch laptop gets the right one;
 * - see-through watermarks top right in English and Italian (the only text, asked for by the
 *   owner: `watermark.ts`): "click to control the camera with the mouse" while the mouse icon
 *   shows, "press ESC to release the mouse" while the mouse is locked;
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
  /** Set by the page each frame: a logo is under the crosshair. */
  aimed = false;
  private readonly crosshair = new THREE.Group();
  private readonly aimRing: THREE.Mesh;
  private readonly mouseIcon = new THREE.Group();
  private readonly mouseButton: THREE.MeshBasicMaterial;
  private readonly mouseMats: THREE.MeshBasicMaterial[] = [];
  private readonly touchHint = new THREE.Group();
  private readonly swipeFinger: THREE.Object3D;
  private readonly swipeChevrons: THREE.Object3D;
  private readonly pinchFingers: [THREE.Object3D, THREE.Object3D];
  private readonly touchMats: Array<{ m: THREE.MeshBasicMaterial; o: number }> = [];
  private readonly clickHint = new Watermark(CLICK_LINES);
  private readonly escHint = new Watermark(ESC_LINES);

  constructor(private readonly input: Input) {
    this.touch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.scene.add(this.pad, this.loader);

    const layout: Array<[Intent, number, number, number]> = [
      ['forward', 0, 1, 0],
      ['strafeLeft', -1, 0, Math.PI / 2],
      ['back', 0, 0, Math.PI],
      ['strafeRight', 1, 0, -Math.PI / 2],
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
    // Crosshair (pixels): a white dot with a dark rim, and a white ring with a dark rim over a logo.
    const hudMat = (color: string, opacity = 1) =>
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, toneMapped: false });
    const rim = new THREE.Mesh(new THREE.CircleGeometry(4, 20), hudMat('#1f2226', 0.55));
    const dot = new THREE.Mesh(new THREE.CircleGeometry(2.4, 20), hudMat('#ffffff'));
    // Over a logo: a white ring with a dark rim (the logos are red: a red ring would vanish).
    this.aimRing = new THREE.Mesh(new THREE.RingGeometry(8, 12.5, 40), hudMat('#1f2226', 0.55));
    const aimInner = new THREE.Mesh(new THREE.RingGeometry(9, 11.5, 40), hudMat('#ffffff', 0.95));
    this.aimRing.add(aimInner);
    rim.renderOrder = 10;
    dot.renderOrder = 11;
    this.aimRing.renderOrder = 12;
    aimInner.renderOrder = 13;
    this.crosshair.add(rim, dot, this.aimRing);
    this.crosshair.visible = false;
    this.scene.add(this.crosshair);

    // Mouse icon (pixels, centred): outline, button divider, wheel, and a pulsing left button.
    const W = 22;
    const H = 34;
    const outlineMat = hudMat('#ffffff', 0.9);
    const bodyMat = hudMat('#1f2226', 0.28);
    this.mouseButton = hudMat('#d90000', 0);
    const lineMat = hudMat('#ffffff', 0.9);
    this.mouseMats.push(outlineMat, bodyMat, lineMat);
    const body = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(W, H, 10)), bodyMat);
    const outline = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(W, H, 10, 1.6)), outlineMat);
    // Left button: the top-left quarter of the body.
    const btn = new THREE.Shape();
    btn.moveTo(-W / 2 + 1.6, 0);
    btn.lineTo(-W / 2 + 1.6, H / 2 - 10);
    btn.quadraticCurveTo(-W / 2 + 1.6, H / 2 - 1.6, -W / 2 + 10, H / 2 - 1.6);
    btn.lineTo(-0.8, H / 2 - 1.6);
    btn.lineTo(-0.8, 0);
    btn.closePath();
    const button = new THREE.Mesh(new THREE.ShapeGeometry(btn), this.mouseButton);
    const divider = new THREE.Mesh(new THREE.PlaneGeometry(1.4, H / 2), lineMat);
    divider.position.y = H / 4;
    const split = new THREE.Mesh(new THREE.PlaneGeometry(W - 3, 1.4), lineMat);
    const wheel = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(3.2, 7, 1.6)), lineMat);
    wheel.position.y = H / 4 - 1;
    body.renderOrder = 20;
    button.renderOrder = 21;
    outline.renderOrder = 22;
    divider.renderOrder = split.renderOrder = wheel.renderOrder = 23;
    this.mouseIcon.add(body, button, outline, divider, split, wheel);
    this.mouseIcon.visible = false;
    this.scene.add(this.mouseIcon);

    // Touch hint (pixels, centred): a dark rounded plate like the pad's buttons; on it a white
    // fingertip that swipes between two chevrons, or two fingertips that spread apart.
    const tMat = (color: string, o: number) => {
      const m = hudMat(color, o);
      this.touchMats.push({ m, o });
      return m;
    };
    const plateW = 70;
    const plateH = 40;
    const plate = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(plateW, plateH, 7)), tMat('#1f2226', 0.28));
    const plateRing = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(plateW, plateH, 7, 1.2)), tMat('#ffffff', 0.9));
    plate.renderOrder = 30;
    plateRing.renderOrder = 31;
    const fingerRim = tMat('#1f2226', 0.5);
    const fingerFill = tMat('#ffffff', 0.95);
    const fingertip = (r: number) => {
      const g = new THREE.Group();
      const rim = new THREE.Mesh(new THREE.CircleGeometry(r + 1.8, 24), fingerRim);
      const fill = new THREE.Mesh(new THREE.CircleGeometry(r, 24), fingerFill);
      rim.renderOrder = 33;
      fill.renderOrder = 34;
      g.add(rim, fill);
      return g;
    };
    this.swipeFinger = fingertip(6.5);
    const chevron = new THREE.Shape();
    chevron.moveTo(0, 5);
    chevron.lineTo(5, 0);
    chevron.lineTo(0, -5);
    chevron.closePath();
    const chevronGeo = new THREE.ShapeGeometry(chevron);
    const chevronMat = tMat('#ffffff', 0.9);
    this.swipeChevrons = new THREE.Group();
    for (const side of [-1, 1]) {
      const c = new THREE.Mesh(chevronGeo, chevronMat);
      c.position.x = side * 27;
      c.rotation.z = side < 0 ? Math.PI : 0; // both point outwards (a turn, not a mirror: no back face)
      c.renderOrder = 32;
      this.swipeChevrons.add(c);
    }
    this.pinchFingers = [fingertip(5), fingertip(5)];
    this.touchHint.add(plate, plateRing, this.swipeChevrons, this.swipeFinger, ...this.pinchFingers);
    this.touchHint.visible = false;
    this.scene.add(this.touchHint);
    this.scene.add(this.clickHint.mesh, this.escHint.mesh);
    input.hud = this;
  }

  /** `pixelRatio`: the renderer's, so the watermark's text is drawn at the screen's resolution. */
  resize(w: number, h: number, pixelRatio = 1): void {
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
    this.crosshair.position.set(w / 2, h / 2, 0);
    // Watermarks in the top-right corner, on whole pixels so the text stays sharp.
    const m = w < 480 ? 12 : 16;
    for (const wm of [this.clickHint, this.escHint]) {
      wm.draw(pixelRatio);
      wm.mesh.position.set(Math.round(w - m - wm.width) + wm.width / 2, Math.round(h - m - wm.height) + wm.height / 2, 0);
    }
    // Mouse icon (or touch hint) to the right of the arrow pad, centred on its height.
    const padRight = baseX + (size + gap) + size / 2;
    this.mouseIcon.position.set(padRight + 24, baseY + (size + gap) / 2, 0);
    this.touchHint.position.set(padRight + gap + 35, baseY + (size + gap) / 2, 0);
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

  /** The watermarks on screen (tests): "click to control the camera…", "press ESC…". */
  get clickHintShown(): boolean {
    return this.clickHint.mesh.visible;
  }

  get escHintShown(): boolean {
    return this.escHint.mesh.visible;
  }

  /** Centre of an arrow button in client (CSS) pixels, for tests. */
  center(intent: Intent): { x: number; y: number } {
    const b = this.buttons.find((x) => x.intent === intent)!;
    return { x: b.cx, y: this.height - b.cy };
  }

  update(dt: number, t: number): void {
    this.loader.visible = this.loading;
    this.pad.visible = !this.loading;
    const inp = this.input;
    // Hints follow the pointer in use, not what the device could do (touch laptops have both).
    const mouse = inp.pointerType === 'mouse';
    this.crosshair.visible = !this.loading && inp.locked;
    this.aimRing.visible = this.aimed;
    this.mouseIcon.visible = !this.loading && mouse && !inp.locked && !inp.lockUnavailable;
    const needLook = inp.lastLookAt === 0;
    this.touchHint.visible = !this.loading && !mouse && (needLook || inp.lastZoomAt === 0);
    // The watermarks cross-fade: "click…" with the mouse icon, "press ESC…" with the lock.
    this.clickHint.fade(this.mouseIcon.visible ? 0.72 : 0, dt);
    this.escHint.fade(!this.loading && inp.locked ? 0.72 : 0, dt);
    if (this.loading) {
      this.loaderLogo.rotation.y = Math.sin(t * 1.4) * 0.5;
      const p = THREE.MathUtils.clamp(this.progress, 0, 1);
      // RingGeometry indices: 6 per segment (one phi segment), in sweep order.
      this.progressRing.geometry.setDrawRange(0, Math.ceil(p * RING_SEGMENTS) * 6);
      return;
    }
    let target = 0.95;
    if (mouse) {
      // Mouse: full while the pointer uses the pad (and a while after), dimmed 4 s after
      // keyboard walking. Never hidden: it is the only way to walk for a mouse-only visitor.
      const now = performance.now();
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
    if (this.mouseIcon.visible) {
      // "Click here": the left button pulses softly.
      this.mouseButton.opacity = (0.35 + 0.35 * Math.sin(t * 4)) * this.opacity + 0.1;
      for (const m of this.mouseMats) m.opacity = (m === this.mouseMats[1] ? 0.28 : 0.9) * Math.max(this.opacity, 0.6);
    }
    if (this.touchHint.visible) {
      // Swipe: the fingertip glides from side to side and pauses at the ends. Pinch: two
      // fingertips spread apart along a diagonal, then start again.
      this.swipeFinger.visible = this.swipeChevrons.visible = needLook;
      this.pinchFingers[0].visible = this.pinchFingers[1].visible = !needLook;
      if (needLook) {
        this.swipeFinger.position.x = 15 * Math.max(-1, Math.min(1, 1.4 * Math.sin(t * 2.6)));
      } else {
        const k = (t * 0.8) % 1;
        const d = 4 + 14 * Math.min(1, k / 0.7);
        this.pinchFingers[0].position.set(-d, -d * 0.45, 0);
        this.pinchFingers[1].position.set(d, d * 0.45, 0);
      }
      for (const { m, o } of this.touchMats) m.opacity = o * this.opacity;
    }
  }
}
