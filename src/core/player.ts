import * as THREE from 'three';
import type { CollisionWorld } from './collision';
import type { Input } from './input';

export const EYE_HEIGHT = 1.65;
export const BODY_RADIUS = 0.28;
const WALK = 2.1;
const RUN = 4.2;
const PITCH_LIMIT = THREE.MathUtils.degToRad(85);
/** Zoom range: 1× is the normal view, 4× a close look at a display or a logo. */
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

/** Vertical field of view at a zoom factor: the view's tangent shrinks by the zoom (like a lens). */
export function zoomedFov(baseFovDeg: number, zoom: number): number {
  const r = THREE.MathUtils.DEG2RAD;
  return (2 * Math.atan(Math.tan((baseFovDeg * r) / 2) / zoom)) / r;
}

/**
 * First-person visitor: position on the floor plane, yaw/pitch from the mouse (or a drag), a
 * smooth lens zoom, walking with smooth acceleration (the arrows only walk and step sideways),
 * and an extra floor height when standing on a scale platform.
 */
export class Player {
  x: number;
  z: number;
  yaw: number;
  pitch = 0;
  /** Extra height under the feet (a scale platform). Eased towards `floorTarget`. */
  floor = 0;
  floorTarget = 0;
  private vx = 0;
  private vz = 0;
  private bobPhase = 0;
  private bobAmp = 0;
  reducedMotion = false;
  /** Current and target zoom (1 = normal view). */
  zoom = 1;
  zoomTarget = 1;
  /** Field of view at 1× for the current screen shape (set by the page on resize). */
  private baseFov = 64;
  private appliedFov = 0;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly input: Input,
    private readonly world: CollisionWorld,
    start: { x: number; z: number; yaw: number },
  ) {
    this.x = start.x;
    this.z = start.z;
    this.yaw = start.yaw;
  }

  setBaseFov(fov: number): void {
    this.baseFov = fov;
    this.applyFov();
  }

  teleport(x: number, z: number, yaw: number, pitch = 0): void {
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    this.pitch = pitch;
    this.vx = this.vz = 0;
    this.apply();
  }

  /** Unit vector the visitor is facing on the floor plane. */
  forward(): { x: number; z: number } {
    return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
  }

  get speed(): number {
    return Math.hypot(this.vx, this.vz);
  }

  update(dt: number): void {
    const inp = this.input;
    // Zoom: wheel / pinch multiply the target; the lens eases towards it.
    const z = inp.takeZoom();
    if (z.reset) this.zoomTarget = 1;
    this.zoomTarget = THREE.MathUtils.clamp(this.zoomTarget * z.factor, MIN_ZOOM, MAX_ZOOM);
    this.zoom += (this.zoomTarget - this.zoom) * (1 - Math.exp(-dt * 12));
    if (Math.abs(this.zoomTarget - this.zoom) < 1e-3) this.zoom = this.zoomTarget;

    // Look: slower when zoomed in, so the same mouse move covers the same part of the image.
    const look = inp.takeLook();
    this.yaw += look.yaw / this.zoom;
    this.pitch = THREE.MathUtils.clamp(this.pitch + look.pitch / this.zoom, -PITCH_LIMIT, PITCH_LIMIT);

    let mf = 0;
    let ms = 0;
    if (inp.isHeld('forward')) mf += 1;
    if (inp.isHeld('back')) mf -= 1;
    if (inp.isHeld('strafeRight')) ms += 1;
    if (inp.isHeld('strafeLeft')) ms -= 1;
    const len = Math.hypot(mf, ms) || 1;
    const speed = inp.isHeld('run') ? RUN : WALK;
    const f = this.forward();
    // right vector = forward rotated -90° about Y
    const rx = -f.z;
    const rz = f.x;
    const tx = ((f.x * mf + rx * ms) / len) * speed;
    const tz = ((f.z * mf + rz * ms) / len) * speed;

    // Critically damped approach to the target velocity.
    const k = 1 - Math.exp(-dt * (mf || ms ? 9 : 12));
    this.vx += (tx - this.vx) * k;
    this.vz += (tz - this.vz) * k;
    if (Math.abs(this.vx) < 1e-4) this.vx = 0;
    if (Math.abs(this.vz) < 1e-4) this.vz = 0;

    if (this.vx || this.vz) {
      const next = this.world.move(this.x, this.z, this.vx * dt, this.vz * dt, BODY_RADIUS);
      // Bleed velocity into walls so we do not keep pushing.
      if (dt > 0) {
        this.vx = (next.x - this.x) / dt;
        this.vz = (next.z - this.z) / dt;
      }
      this.x = next.x;
      this.z = next.z;
    }

    this.floor += (this.floorTarget - this.floor) * (1 - Math.exp(-dt * 10));

    const moving = Math.min(1, this.speed / WALK);
    this.bobAmp += ((this.reducedMotion ? 0 : moving) - this.bobAmp) * (1 - Math.exp(-dt * 6));
    this.bobPhase += dt * (6 + 3 * moving);
    this.apply();
  }

  private apply(): void {
    const bob = Math.sin(this.bobPhase * 2) * 0.018 * this.bobAmp;
    this.camera.position.set(this.x, EYE_HEIGHT + this.floor + bob, this.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.applyFov();
  }

  private applyFov(): void {
    const fov = zoomedFov(this.baseFov, this.zoom);
    if (Math.abs(fov - this.appliedFov) < 1e-4) return;
    this.appliedFov = fov;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }
}
