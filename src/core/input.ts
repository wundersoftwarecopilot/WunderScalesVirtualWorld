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

/** Multiplicative zoom change (>1 = closer), and whether to go back to 1×. */
export interface ZoomDelta {
  factor: number;
  reset: boolean;
}

/** Mouse look with the pointer locked (first-person style), radians per pixel of mouse travel. */
const LOCKED_SENS = 0.0022;
/** Dragging the view (touch, or mouse before the pointer is locked), radians per pixel. */
const DRAG_SENS = 0.0042;
/** One wheel notch (deltaY 100) zooms by this factor. */
const WHEEL_STEP = 1.18;
/** A lock request is judged this long after it was made (ms); no second request meanwhile. */
const LOCK_JUDGE_MS = 1000;
/** Browsers refuse a new lock for about a second after Esc released the last one (ms). */
const RELOCK_COOLDOWN_MS = 1500;
/** Mouse moves this soon after the lock lands can carry the cursor's jump to the centre (ms). */
const LOCK_SETTLE_MS = 60;
/** A locked click this soon after the lock landed is the rest of the click that asked for it (ms). */
const LOCK_CLICK_GRACE_MS = 400;

/**
 * Keyboard, mouse and touch input.
 *
 * - Desktop: a click on the world locks the pointer (first-person mouse look, crosshair in the
 *   middle, Esc releases it). While locked, a click opens the logo under the crosshair.
 *   Before the first click, or where pointer lock is refused, dragging turns the view.
 * - Wheel (and trackpad pinch: ctrl+wheel, or Safari's gesture events) zooms; touch uses a
 *   two-finger pinch and a one-finger drag turns the view.
 * - Arrows / WASD only walk (←/→ step sideways), Shift runs.
 * - The on-screen arrows are drawn in WebGL, under the layer of logo links: a press on an arrow
 *   always walks, and the click it would send to a link underneath is swallowed.
 * - Nothing looks, zooms or locks until the page sets `enabled` (the world is ready).
 */
export class Input {
  readonly held = new Set<Intent>();
  private readonly keys = new Set<string>();
  private readonly hudPresses = new Map<number, Intent>();
  private readonly forced = new Set<Intent>();
  // Accumulated since the last take*(), handed out in objects reused every frame (no garbage).
  private lookYaw = 0;
  private lookPitch = 0;
  private zoomFactor = 1;
  private zoomReset = false;
  private readonly lookOut: LookDelta = { yaw: 0, pitch: 0 };
  private readonly zoomOut: ZoomDelta = { factor: 1, reset: false };
  private drag: { id: number; x: number; y: number; moved: number } | null = null;
  private readonly touches = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  private gestureScale = 1;
  private suppressClickUntil = 0;
  hud: HudHitTester | null = null;
  /** False while the world is still loading: look, zoom and pointer lock wait for it. */
  enabled = false;
  /** Timestamp of the last keyboard movement; the HUD dims its arrows for keyboard walkers. */
  lastKeyMoveAt = 0;
  /** Timestamp of the last press on an on-screen arrow (mouse, pen or touch). */
  lastPadAt = 0;
  /** Timestamps of the last look movement and zoom (the in-world sign lights its mouse). */
  lastLookAt = 0;
  lastZoomAt = 0;
  usedTouch = false;
  /**
   * The pointer the visitor is using now ('mouse', 'touch' or 'pen'), from the last pointer
   * event; before any, a guess from the primary pointer. The hints follow it (a touch laptop
   * has both).
   */
  pointerType: string;
  /** Type of the last pointerdown (a click that is not a PointerEvent is judged by it). */
  private lastDownType = '';
  /** True while the pointer is locked to the world (first-person mouse look). */
  locked = false;
  /** Pointer lock was refused (sandboxed frame, old browser): stay with drag-to-look. */
  lockUnavailable = false;
  private lastUnlockAt = 0;
  private lockedAt = -Infinity;
  private lockFailures = 0;
  /** When the pending lock request was made (0: none pending). */
  private lockRequestAt = 0;
  /** Mouse moves still to drop after the lock landed. */
  private skipMoves = 0;
  /** unlock() was called: the release has not landed yet. */
  private releasing = false;
  /** A finger (or pen) that pressed while the pointer was locked: see onPointerDown. */
  private lockedTouchId: number | null = null;
  /** Called on a click while the pointer is locked (the world opens the logo under the crosshair). */
  onLockedClick: (() => void) | null = null;
  static readonly DRAG_PX = 6;

  constructor(private readonly target: HTMLElement) {
    this.pointerType = window.matchMedia?.('(pointer: coarse)').matches ? 'touch' : 'mouse';
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clear);
    window.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    window.addEventListener('pointermove', this.onPointerMove, { passive: false });
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('touchstart', this.onTouchStart, { passive: true });
    if ('GestureEvent' in window) {
      for (const type of ['gesturestart', 'gesturechange', 'gestureend']) window.addEventListener(type, this.onGesture, { passive: false });
    }
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onLockChange);
    // Capture phase so a drag that ends on a logo link does not open it, and so a click while
    // locked reaches the world before anything else.
    window.addEventListener('click', this.onClickCapture, true);
    // The middle button returns to 1×: it must not also open the logo under the cursor in a tab.
    window.addEventListener(
      'auxclick',
      (e) => {
        if (e.button === 1 && (this.locked || this.onSurface(e.target))) e.preventDefault();
      },
      true,
    );
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

  /** Accumulated look rotation (radians) since the last call. The object is reused. */
  takeLook(): LookDelta {
    this.lookOut.yaw = this.lookYaw;
    this.lookOut.pitch = this.lookPitch;
    this.lookYaw = this.lookPitch = 0;
    return this.lookOut;
  }

  /** Zoom change since the last call (>1 = closer), and whether to reset to 1×. The object is reused. */
  takeZoom(): ZoomDelta {
    this.zoomOut.factor = this.zoomFactor;
    this.zoomOut.reset = this.zoomReset;
    this.zoomFactor = 1;
    this.zoomReset = false;
    return this.zoomOut;
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
    if (!this.locked) return;
    // Mouse moves that arrive before the release lands no longer turn the view.
    this.releasing = true;
    document.exitPointerLock?.();
  }

  private addLook(dx: number, dy: number, sens: number): void {
    if (!this.enabled) return;
    this.lookYaw -= dx * sens;
    this.lookPitch -= dy * sens;
    if (dx || dy) this.lastLookAt = performance.now();
  }

  private addZoom(factor: number): void {
    if (!this.enabled || !(factor > 0) || !Number.isFinite(factor)) return;
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
    this.pinchDist = 0;
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
    if (!this.enabled || this.lockUnavailable || !el.requestPointerLock) return;
    const at = performance.now();
    // One request at a time: the second click of a double-click must not start another one.
    if (at - this.lockRequestAt < LOCK_JUDGE_MS) return;
    this.lockRequestAt = at;
    const fallback = () => {
      try {
        const p = el.requestPointerLock!();
        if (p && typeof (p as Promise<void>).catch === 'function') (p as Promise<void>).catch(() => undefined);
      } catch {
        /* refused: judged below */
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
    // Judge by the outcome, not by error events (the unadjustedMovement attempt that falls back
    // fires one, so do refusals of a request made while another was pending).
    window.setTimeout(() => this.judgeLock(at), LOCK_JUDGE_MS);
  }

  /**
   * A request that did not lock counts as one refusal, unless it came during the cooldown after
   * Esc (not a failure). After two refusals (a frame without pointer-lock permission) the view
   * stays with drag-to-look. Any lock that lands clears the verdict (onLockChange).
   */
  private judgeLock(at: number): void {
    if (this.lockRequestAt === at) this.lockRequestAt = 0;
    if (this.locked || this.lockedAt >= at) return;
    if (at - this.lastUnlockAt < RELOCK_COOLDOWN_MS) return;
    if (++this.lockFailures >= 2) this.lockUnavailable = true;
  }

  private onLockChange = (): void => {
    const was = this.locked;
    this.locked = document.pointerLockElement === this.target;
    this.releasing = false;
    const now = performance.now();
    if (this.locked) {
      this.drag = null;
      this.lockedAt = now;
      this.lockRequestAt = 0;
      this.lockFailures = 0;
      this.lockUnavailable = false;
      this.skipMoves = 1;
    } else if (was) this.lastUnlockAt = now;
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.locked || this.releasing) return;
    const dx = e.movementX || 0;
    const dy = e.movementY || 0;
    // Browsers can report a bogus jump with the first move after the lock lands (the cursor's
    // way to the centre) and, now and then, a warp spike: drop those rather than snap the view.
    if (this.skipMoves > 0 || performance.now() - this.lockedAt < LOCK_SETTLE_MS) {
      this.skipMoves = Math.max(0, this.skipMoves - 1);
      return;
    }
    if (Math.abs(dx) > Math.max(300, window.innerWidth * 0.4) || Math.abs(dy) > Math.max(300, window.innerHeight * 0.4)) return;
    this.addLook(dx, dy, LOCKED_SENS);
  };

  // ------------------------------------------------------------------ pointers (mouse, pen, touch)

  private notePointer(e: PointerEvent): void {
    // Chromium also sends still mouse moves of its own (after a layout change or a lock
    // release): only a mouse that really moved takes the hints back from a finger.
    if (e.type === 'pointermove' && e.pointerType === 'mouse' && !e.movementX && !e.movementY) return;
    if (e.pointerType) this.pointerType = e.pointerType;
    if (e.pointerType === 'touch') this.usedTouch = true;
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.notePointer(e);
    this.lastDownType = e.pointerType;
    if (this.locked) {
      if (e.pointerType === 'mouse') {
        // Locked, the mouse only looks (mousemove) and clicks (onClickCapture). Middle button:
        // back to the normal view.
        if (e.button === 1) {
          this.zoomReset = true;
          e.preventDefault();
        }
        return;
      }
      // A finger or a pen on a touch laptop: the visitor has switched to the screen, so the
      // cursor comes back. Chromium reports this press at the locked cursor's position, not the
      // finger's: onTouchStart, right after, reads the real one for the arrow pad. Its click is
      // dropped (it must not follow the logo under the crosshair).
      this.lockedTouchId = e.pointerId;
      this.suppressClickUntil = performance.now() + 400;
      this.unlock();
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
      if (this.touches.size >= 2) {
        // Another finger: stop turning, (re)start pinching with the pair now measured.
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

  /** The first touch after a locked press (see onPointerDown): an arrow under it walks. */
  private onTouchStart = (e: TouchEvent): void => {
    const id = this.lockedTouchId;
    if (id === null) return;
    this.lockedTouchId = null;
    const t = e.changedTouches[0];
    const hudIntent = t ? (this.hud?.hit(t.clientX, t.clientY) ?? null) : null;
    if (!hudIntent) return;
    this.hudPresses.set(id, hudIntent);
    this.recompute();
    this.lastPadAt = performance.now();
  };

  /** Distance between the first two fingers down (the pair a pinch measures). */
  private touchDistance(): number {
    let a: { x: number; y: number } | null = null;
    for (const t of this.touches.values()) {
      if (!a) a = t;
      else return Math.hypot(a.x - t.x, a.y - t.y);
    }
    return 0;
  }

  private onPointerMove = (e: PointerEvent): void => {
    this.notePointer(e);
    if (this.locked && e.pointerType === 'mouse') return; // mousemove handles locked look (movementX/Y)
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
    if (this.lockedTouchId === e.pointerId) this.lockedTouchId = null; // a pen: no touch events
    this.touches.delete(e.pointerId);
    // A pinch goes on with whichever two fingers remain (a third may have been resting).
    this.pinchDist = this.touches.size >= 2 ? this.touchDistance() : 0;
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
    // Never scroll or zoom the host page (Chrome, Edge and Firefox send a trackpad pinch as a
    // wheel with ctrlKey).
    e.preventDefault();
    const px = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
    const notches = Math.max(-3, Math.min(3, px / 100));
    this.addZoom(Math.pow(WHEEL_STEP, -notches * (e.ctrlKey ? 2.5 : 1)));
  };

  /**
   * Safari sends a trackpad pinch as its own gesture events (with a running `scale`), not as a
   * ctrl+wheel: without preventDefault it magnifies the whole page. On iPhone and iPad the same
   * events come with a two-finger pinch that the pointer events already zoom: not twice.
   */
  private onGesture = (e: Event): void => {
    e.preventDefault();
    const scale = (e as Event & { scale?: number }).scale ?? 1;
    if (e.type === 'gesturestart') {
      this.gestureScale = 1;
      return;
    }
    if (e.type === 'gesturechange' && this.touches.size === 0 && this.pointerType !== 'touch' && (this.locked || this.onSurface(e.target))) {
      if (scale > 0 && this.gestureScale > 0) this.addZoom(scale / this.gestureScale);
    }
    this.gestureScale = scale;
  };

  private onClickCapture = (e: MouseEvent): void => {
    if (this.hudPresses.size > 0 || performance.now() < this.suppressClickUntil) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (!e.isTrusted) return; // synthetic clicks (the link opener's own a.click()) pass through
    // Which pointer clicked: the click's own pointerType where click is a PointerEvent, else the
    // last pointerdown's. Only a mouse aims with the crosshair or grabs the pointer: a touch
    // laptop also has a finger, and a tablet has no Esc key to get out of a lock.
    const pt = (e as Partial<PointerEvent>).pointerType || this.lastDownType;
    if (this.locked) {
      e.preventDefault();
      e.stopPropagation();
      // The rest of the click, or double-click, that asked for the lock must not follow a logo
      // that happens to be in the middle of the screen.
      const sinceLock = performance.now() - this.lockedAt;
      const early = sinceLock < LOCK_CLICK_GRACE_MS || (e.detail > 1 && sinceLock < 1000);
      if (e.button === 0 && pt === 'mouse' && !early) this.onLockedClick?.();
      return;
    }
    // A plain mouse click on the world (not on a logo, not a touch tap) grabs the mouse for looking.
    if (e.target === this.target && e.button === 0 && pt === 'mouse') this.requestLock();
  };
}
