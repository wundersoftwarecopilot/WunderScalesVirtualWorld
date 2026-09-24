/** Movement intents shared by the keyboard, the on-screen WebGL arrows and tests. */
export type Intent = 'forward' | 'back' | 'left' | 'right' | 'strafeLeft' | 'strafeRight' | 'run';

const KEY_MAP: Record<string, Intent> = {
  ArrowUp: 'forward',
  ArrowDown: 'back',
  ArrowLeft: 'left',
  ArrowRight: 'right',
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

export interface LookDelta {
  dx: number;
  dy: number;
}

/**
 * Keyboard + pointer input. Pointer drags anywhere (canvas or a logo link) turn the view;
 * a drag longer than DRAG_PX cancels the click that would otherwise follow a link.
 */
export class Input {
  readonly held = new Set<Intent>();
  private readonly keys = new Set<string>();
  private readonly hudPresses = new Map<number, Intent>();
  private readonly forced = new Set<Intent>();
  private look: LookDelta = { dx: 0, dy: 0 };
  private drag: { id: number; x: number; y: number; moved: number } | null = null;
  private suppressClickUntil = 0;
  hud: HudHitTester | null = null;
  /** Timestamp of the last movement input; the HUD uses it to fade the hint arrows. */
  lastMoveAt = 0;
  usedTouch = false;
  static readonly DRAG_PX = 6;

  constructor(private readonly target: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clear);
    window.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    window.addEventListener('pointermove', this.onPointerMove, { passive: false });
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    // Capture phase so a drag that ends on a logo link does not open it.
    window.addEventListener('click', this.onClickCapture, true);
    window.addEventListener('dragstart', (e) => e.preventDefault());
    window.addEventListener('contextmenu', (e) => {
      if (e.target === target) e.preventDefault();
    });
  }

  /** Press or release an intent programmatically (tests, HUD). */
  setIntent(intent: Intent, down: boolean): void {
    if (down) this.forced.add(intent);
    else this.forced.delete(intent);
    if (down) this.lastMoveAt = performance.now();
    this.recompute();
  }

  /** Accumulated look movement in pixels since the last call. */
  takeLook(): LookDelta {
    const l = this.look;
    this.look = { dx: 0, dy: 0 };
    return l;
  }

  isHeld(i: Intent): boolean {
    return this.held.has(i);
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
    this.drag = null;
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const intent = KEY_MAP[e.code];
    if (!intent) return;
    // Arrows would otherwise scroll the host page around the artifact frame.
    e.preventDefault();
    this.keys.add(e.code);
    this.recompute();
    if (intent !== 'run') this.lastMoveAt = performance.now();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
    this.recompute();
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') this.usedTouch = true;
    const onSurface = e.target === this.target || (e.target instanceof HTMLElement && e.target.closest('#links'));
    if (!onSurface) return;
    if (e.target === this.target) this.target.focus({ preventScroll: true });
    const hudIntent = this.hud?.hit(e.clientX, e.clientY) ?? null;
    if (hudIntent) {
      e.preventDefault();
      this.hudPresses.set(e.pointerId, hudIntent);
      this.recompute();
      this.lastMoveAt = performance.now();
      return;
    }
    if (this.drag === null && (e.button === 0 || e.pointerType !== 'mouse')) {
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    const dx = e.clientX - this.drag.x;
    const dy = e.clientY - this.drag.y;
    this.drag.x = e.clientX;
    this.drag.y = e.clientY;
    this.drag.moved += Math.abs(dx) + Math.abs(dy);
    if (this.drag.moved > Input.DRAG_PX) {
      this.look.dx += dx;
      this.look.dy += dy;
      if (e.cancelable) e.preventDefault();
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (this.hudPresses.delete(e.pointerId)) this.recompute();
    if (this.drag && e.pointerId === this.drag.id) {
      if (this.drag.moved > Input.DRAG_PX) this.suppressClickUntil = performance.now() + 350;
      this.drag = null;
    }
  };

  private onClickCapture = (e: MouseEvent): void => {
    if (performance.now() < this.suppressClickUntil) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
}
