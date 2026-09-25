/** Movement intents shared by the keyboard, the on-screen WebGL arrows and tests. Arrows only walk. */
export type Intent = 'forward' | 'back' | 'strafeLeft' | 'strafeRight' | 'run';

const KEY_MAP: Record<string, Intent> = {
  ArrowUp: 'forward',
  ArrowDown: 'back',
  ArrowLeft: 'strafeLeft',
  ArrowRight: 'strafeRight',
  KeyW: 'forward',
  KeyS: 'back',
  KeyA: 'strafeLeft',
  KeyD: 'strafeRight',
  ShiftLeft: 'run',
  ShiftRight: 'run',
};

/** A screen-space button drawn by the WebGL HUD; the HUD supplies the hit test. */
export interface HudHitTester {
  hit(clientX: number, clientY: number): Intent | null;
}

/** Look rotation in radians (already scaled by the source's sensitivity). */
export interface LookDelta {
  yaw: number;
  pitch: number;
}

/** Mouse look with the pointer locked (first-person style), radians per pixel of mouse travel. */
const LOCKED_SENS = 0.0022;
/** Dragging the view (touch, or mouse before the pointer is locked), radians per pixel. */
const DRAG_SENS = 0.0042;
/** One wheel notch (deltaY 100) zooms by this factor. */
const WHEEL_STEP = 1.18;

/**
 * Keyboard, mouse and touch input.
 *
 * - Desktop: a click on the world locks the pointer (first-person mouse look, crosshair in the
 *   middle, Esc releases it). While locked, a click opens the logo under the crosshair.
 *   Before the first click, or where pointer lock is refused, dragging turns the view.
 * - Wheel (and trackpad pinch) zooms; touch uses a two-finger pinch.
 * - Arrows / WASD only walk (←/→ step sideways), Shift runs.
 * - The on-screen arrows are drawn in WebGL, under the layer of logo links: a press on an arrow
 *   always walks, and the click it would send to a link underneath is swallowed.
 */
export class Input {
  readonly held = new Set<Intent>();
  private readonly keys = new Set<string>();
  private readonly hudPresses = new Map<number, Intent>();
  private readonly forced = new Set<Intent>();
  private look: LookDelta = { yaw: 0, pitch: 0 };
  private zoomFactor = 1;
  private zoomReset = false;
  private drag: { id: number; x: number; y: number; moved: number } | null = null;
  private readonly touches = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  private suppressClickUntil = 0;
  hud: HudHitTester | null = null;
  /** Timestamp of the last keyboard movement; the HUD dims its arrows for keyboard walkers. */
  lastKeyMoveAt = 0;
  /** Timestamp of the last press on an on-screen arrow (mouse, pen or touch). */
  lastPadAt = 0;
  /** Timestamps of the last look movement and zoom (the in-world sign lights its mouse). */
  lastLookAt = 0;
  lastZoomAt = 0;
  usedTouch = false;
  /** True while the pointer is locked to the world (first-person mouse look). */
  locked = false;
  /** Pointer lock was refused (sandboxed frame, old browser): stay with drag-to-look. */
  lockUnavailable = false;
  private lastUnlockAt = 0;
  private lockFailures = 0;
  /** Called on a click while the pointer is locked (the world opens the logo under the crosshair). */
  onLockedClick: (() => void) | null = null;
  static readonly DRAG_PX = 6;

  constructor(private readonly target: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clear);
    window.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    window.addEventListener('pointermove', this.onPointerMove, { passive: false });
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('wheel', this.onWheel, { passive: false });
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onLockChange);
    document.addEventListener('pointerlockerror', this.onLockError);
    // Capture phase so a drag that ends on a logo link does not open it, and so a click while
    // locked reaches the world before anything else.
    window.addEventListener('click', this.onClickCapture, true);
    window.addEventListener('dragstart', (e) => e.preventDefault());
    window.addEventListener('contextmenu', (e) => {
      // Also while an arrow is held: a long press on an arrow over a logo must not open the
      // link's menu.
      if (e.target === target || this.hudPresses.size > 0 || this.locked) e.preventDefault();
    });
  }

  /** Press or release an intent programmatically (tests, HUD). */
  setIntent(intent: Intent, down: boolean): void {
    if (down) this.forced.add(intent);
    else this.forced.delete(intent);
    this.recompute();
  }

  /** Accumulated look rotation (radians) since the last call. */
  takeLook(): LookDelta {
    const l = this.look;
    this.look = { yaw: 0, pitch: 0 };
    return l;
  }

  /** Multiplicative zoom change since the last call (>1 = closer), and whether to reset to 1×. */
  takeZoom(): { factor: number; reset: boolean } {
    const z = { factor: this.zoomFactor, reset: this.zoomReset };
    this.zoomFactor = 1;
    this.zoomReset = false;
    return z;
  }

  isHeld(i: Intent): boolean {
    return this.held.has(i);
  }

  /** True while any on-screen arrow is pressed. */
  get padHeld(): boolean {
    return this.hudPresses.size > 0;
  }

  /** Release the pointer lock (e.g. before following a link). */
  unlock(): void {
    if (this.locked) document.exitPointerLock?.();
  }

  private addLook(dx: number, dy: number, sens: number): void {
    this.look.yaw -= dx * sens;
    this.look.pitch -= dy * sens;
    if (dx || dy) this.lastLookAt = performance.now();
  }

  private addZoom(factor: number): void {
    this.zoomFactor *= factor;
    this.lastZoomAt = performance.now();
  }

  private recompute = (): void => {
    this.held.clear();
    for (const k of this.keys) {
      const i = KEY_MAP[k];
      if (i) this.held.add(i);
    }
    for (const i of this.hudPresses.values()) this.held.add(i);
    for (const i of this.forced) this.held.add(i);
  };

  private clear = (): void => {
    this.keys.clear();
    this.hudPresses.clear();
    this.forced.clear();
    this.held.clear();
    this.touches.clear();
    this.drag = null;
  };

  /** Events on the world itself: the canvas or one of the invisible logo links over it. */
  private onSurface(target: EventTarget | null): boolean {
    return target === this.target || (target instanceof HTMLElement && target.closest('#links') !== null);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const intent = KEY_MAP[e.code];
    if (!intent) return;
    // Arrows would otherwise scroll the host page around the artifact frame.
    e.preventDefault();
    this.keys.add(e.code);
    this.recompute();
    if (intent !== 'run') this.lastKeyMoveAt = performance.now();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
    this.recompute();
  };

  // ------------------------------------------------------------------ pointer lock

  private requestLock(): void {
    const el = this.target as HTMLElement & { requestPointerLock?: (o?: { unadjustedMovement?: boolean }) => Promise<void> | void };
    if (this.lockUnavailable || !el.requestPointerLock) return;
    const fallback = () => {
      try {
        const p = el.requestPointerLock!();
        if (p && typeof (p as Promise<void>).catch === 'function') (p as Promise<void>).catch(() => undefined);
      } catch {
        /* refused: onLockError keeps drag-to-look */
      }
    };
    try {
      // Raw mouse movement where supported (no OS acceleration), like a game.
      const p = el.requestPointerLock({ unadjustedMovement: true });
      if (p && typeof (p as Promise<void>).catch === 'function') (p as Promise<void>).catch((err: DOMException) => {
        if (err?.name === 'NotSupportedError') fallback();
      });
    } catch {
      fallback();
    }
  }

  private onLockChange = (): void => {
    const was = this.locked;
    this.locked = document.pointerLockElement === this.target;
    this.drag = null;
    if (this.locked) this.lockFailures = 0;
    else if (was) this.lastUnlockAt = performance.now();
  };

  private onLockError = (): void => {
    // Browsers refuse a new lock for about a second after Esc released the last one: that is
    // not a failure. Refusals well after that (a frame without pointer-lock permission) are;
    // after two of them the view stays with drag-to-look.
    if (performance.now() - this.lastUnlockAt > 1500 && ++this.lockFailures >= 2) this.lockUnavailable = true;
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.locked) return;
    this.addLook(e.movementX || 0, e.movementY || 0, LOCKED_SENS);
  };

  // ------------------------------------------------------------------ pointers (mouse, pen, touch)

  private onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') this.usedTouch = true;
    if (this.locked) {
      // Middle button: back to the normal view.
      if (e.button === 1) {
        this.zoomReset = true;
        e.preventDefault();
      }
      return;
    }
    if (!this.onSurface(e.target)) return;
    if (e.target === this.target) this.target.focus({ preventScroll: true });
    if (e.button === 1) {
      this.zoomReset = true;
      e.preventDefault();
      return;
    }
    const hudIntent = this.hud?.hit(e.clientX, e.clientY) ?? null;
    if (hudIntent) {
      // preventDefault on pointerdown does not cancel the click a logo link under the arrow
      // would receive: onClickCapture drops it (while held and just after release).
      e.preventDefault();
      this.hudPresses.set(e.pointerId, hudIntent);
      this.recompute();
      this.lastPadAt = performance.now();
      return;
    }
    if (e.pointerType === 'touch') {
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.touches.size === 2) {
        // Second finger: stop turning, start pinching.
        this.drag = null;
        this.pinchDist = this.touchDistance();
        this.suppressClickUntil = performance.now() + 400;
        return;
      }
    }
    if (this.drag === null && this.touches.size < 2 && (e.button === 0 || e.pointerType !== 'mouse')) {
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
    }
  };

  private touchDistance(): number {
    const [a, b] = [...this.touches.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (this.locked) return; // mousemove handles locked look (movementX/Y)
    const t = this.touches.get(e.pointerId);
    if (t) {
      t.x = e.clientX;
      t.y = e.clientY;
      if (this.touches.size >= 2) {
        const d = this.touchDistance();
        if (this.pinchDist > 0 && d > 0) this.addZoom(d / this.pinchDist);
        this.pinchDist = d;
        if (e.cancelable) e.preventDefault();
        return;
      }
    }
    if (!this.drag || e.pointerId !== this.drag.id) return;
    const dx = e.clientX - this.drag.x;
    const dy = e.clientY - this.drag.y;
    this.drag.x = e.clientX;
    this.drag.y = e.clientY;
    this.drag.moved += Math.abs(dx) + Math.abs(dy);
    if (this.drag.moved > Input.DRAG_PX) {
      this.addLook(dx, dy, DRAG_SENS);
      if (e.cancelable) e.preventDefault();
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    const now = performance.now();
    this.touches.delete(e.pointerId);
    if (this.touches.size < 2) this.pinchDist = 0;
    if (this.hudPresses.delete(e.pointerId)) {
      this.recompute();
      this.lastPadAt = now;
      this.suppressClickUntil = Math.max(this.suppressClickUntil, now + 350);
    }
    if (this.drag && e.pointerId === this.drag.id) {
      if (this.drag.moved > Input.DRAG_PX) this.suppressClickUntil = Math.max(this.suppressClickUntil, now + 350);
      this.drag = null;
    }
  };

  private onWheel = (e: WheelEvent): void => {
    if (!this.locked && !this.onSurface(e.target)) return;
    // Never scroll or zoom the host page (trackpad pinch arrives as a wheel with ctrlKey).
    e.preventDefault();
    const px = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    const notches = Math.max(-3, Math.min(3, px / 100));
    this.addZoom(Math.pow(WHEEL_STEP, -notches * (e.ctrlKey ? 2.5 : 1)));
  };

  private onClickCapture = (e: MouseEvent): void => {
    if (this.hudPresses.size > 0 || performance.now() < this.suppressClickUntil) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (!e.isTrusted) return; // synthetic clicks (the link opener's own a.click()) pass through
    if (this.locked) {
      e.preventDefault();
      e.stopPropagation();
      if (e.button === 0) this.onLockedClick?.();
      return;
    }
    // A plain mouse click on the world (not on a logo, not a touch tap) grabs the mouse for
    // looking. Judge by this click's own pointer: a touch laptop also has a real mouse.
    const pt = (e as PointerEvent).pointerType;
    if (e.target === this.target && e.button === 0 && pt !== 'touch' && pt !== 'pen') this.requestLock();
  };
}
