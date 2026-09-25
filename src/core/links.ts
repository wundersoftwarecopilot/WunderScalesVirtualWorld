import * as THREE from 'three';

/**
 * Clickable logos. Artifact viewers block window.open for most visitors, so every logo that is
 * on screen gets a real, transparent <a href> placed exactly over its projected bounds. The
 * visitor clicks or taps a normal link; the WebGL logo lights up on hover.
 *
 * With the pointer locked (first-person mouse look) there is no cursor: the logo under the
 * crosshair in the middle of the screen is "aimed" (it lights up) and open() follows its link.
 */
export interface LinkTarget {
  object: THREE.Object3D;
  url: string;
  label: string;
  /** Called with true/false when the pointer enters/leaves the link. */
  onHover?: (hover: boolean) => void;
  anchor?: HTMLAnchorElement;
  sphere: THREE.Sphere; // local-space bounds, computed once
  visible: boolean;
  occluded: boolean;
  hovered: boolean;
  /** Last anchor placement written to the DOM (styles are only rewritten when it moves). */
  placed: { x: number; y: number; size: number; z: number };
}

/** Metres at 1×; the lens zoom brings further logos close enough to click (see update()). */
const MAX_DIST = 26;
const MIN_PX = 14;

export class LinkLayer {
  readonly links: LinkTarget[] = [];
  private readonly ray = new THREE.Ray();
  private readonly hit = new THREE.Vector3();
  private occlusionCursor = 0;
  // Scratch objects: update() runs every frame over every link, so it allocates nothing.
  private readonly tmpV = new THREE.Vector3();
  private readonly tmpC = new THREE.Vector3();
  private readonly ndc = new THREE.Vector3();
  private readonly occC = new THREE.Vector3();
  private readonly occD = new THREE.Vector3();
  private readonly sph = new THREE.Sphere();
  private readonly frustum = new THREE.Frustum();
  private readonly projScreen = new THREE.Matrix4();
  /** World-space boxes that can hide a logo (walls, tall shelving). Filled by the world builder. */
  occluders: THREE.Box3[] = [];
  /** The logo under the crosshair while the pointer is locked. */
  aimed: LinkTarget | null = null;
  private readonly aimRay = new THREE.Ray();
  private readonly aimHit = new THREE.Vector3();
  private readonly aimDir = new THREE.Vector3();

  constructor(private readonly layer: HTMLElement) {}

  /**
   * `bounds` (default: the object itself) is the part whose projected size makes the clickable
   * circle, e.g. only the logo of a painting, not the whole canvas.
   */
  register(object: THREE.Object3D, url: string, label: string, onHover?: (hover: boolean) => void, bounds: THREE.Object3D = object): LinkTarget {
    const box = new THREE.Box3();
    object.updateWorldMatrix(true, true);
    // Bounds in the object's local frame so the link follows it if it moves.
    const inv = new THREE.Matrix4().copy(object.matrixWorld).invert();
    bounds.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.geometry) return;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      const b = m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld).applyMatrix4(inv);
      box.union(b);
    });
    const sphere = box.isEmpty() ? new THREE.Sphere(new THREE.Vector3(), 0.1) : box.getBoundingSphere(new THREE.Sphere());
    const t: LinkTarget = { object, url, label, onHover, sphere, visible: false, occluded: false, hovered: false, placed: { x: NaN, y: NaN, size: NaN, z: NaN } };
    object.userData.link = t;
    this.links.push(t);
    return t;
  }

  private anchorFor(t: LinkTarget): HTMLAnchorElement {
    if (t.anchor) return t.anchor;
    const a = document.createElement('a');
    a.href = t.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.draggable = false;
    a.setAttribute('aria-label', t.label);
    a.hidden = true;
    const hover = (on: boolean) => this.setHover(t, on);
    a.addEventListener('pointerenter', () => hover(true));
    a.addEventListener('pointerleave', () => hover(false));
    a.addEventListener('focus', () => hover(true));
    a.addEventListener('blur', () => hover(false));
    this.layer.appendChild(a);
    t.anchor = a;
    return a;
  }

  /** Follow a link from script, inside the click that asked for it (keeps the user activation). */
  open(t: LinkTarget): void {
    this.anchorFor(t).click();
  }

  private setHover(t: LinkTarget, on: boolean): void {
    if (t.hovered === on) return;
    t.hovered = on;
    t.onHover?.(on);
  }

  /** `zoom`: the lens zoom (1 = normal view); a logo zoomed in on is clickable further away. */
  update(camera: THREE.PerspectiveCamera, width: number, height: number, locked = false, zoom = 1): void {
    camera.updateMatrixWorld();
    this.projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projScreen);
    const camPos = camera.getWorldPosition(this.tmpC);
    const focal = height / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const maxDist = MAX_DIST * Math.max(1, zoom);

    // Re-test occlusion for a few links per frame (round robin) to keep raycasts cheap.
    const budget = Math.min(this.links.length, 6);
    for (let i = 0; i < budget; i++) {
      const t = this.links[(this.occlusionCursor + i) % this.links.length];
      if (t.visible) t.occluded = this.isOccluded(t, camPos);
    }
    this.occlusionCursor = (this.occlusionCursor + budget) % Math.max(1, this.links.length);

    // Crosshair ray: from the eye straight ahead.
    this.aimRay.set(camPos, camera.getWorldDirection(this.aimDir));
    let best: LinkTarget | null = null;
    let bestDist = Infinity;

    for (const t of this.links) {
      const center = this.tmpV.copy(t.sphere.center).applyMatrix4(t.object.matrixWorld);
      const scale = t.object.matrixWorld.getMaxScaleOnAxis();
      const radius = t.sphere.radius * scale;
      const dist = center.distanceTo(camPos);
      // Layers: the world's portal culler moves logos in rooms the camera cannot see off the
      // camera's layer; their links go with them.
      this.sph.center.copy(center);
      this.sph.radius = radius;
      const inView = t.object.visible && t.object.layers.test(camera.layers) && dist < maxDist && this.frustum.intersectsSphere(this.sph);
      let show = false;
      if (inView) {
        if (!t.visible) t.occluded = this.isOccluded(t, camPos); // freshly visible: test now
        const ndc = this.ndc.copy(center).project(camera);
        const px = ((ndc.x + 1) / 2) * width;
        const py = ((1 - ndc.y) / 2) * height;
        const r = (radius / Math.max(0.01, dist)) * focal;
        if (ndc.z < 1 && r >= MIN_PX / 2 && !t.occluded) {
          const a = this.anchorFor(t);
          const size = Math.min(r * 2, Math.max(width, height));
          const x = px - size / 2;
          const y = py - size / 2;
          const p = t.placed;
          if (!(Math.abs(p.size - size) < 0.5)) {
            a.style.width = a.style.height = size.toFixed(1) + 'px';
            p.size = size;
          }
          if (!(Math.abs(p.x - x) < 0.5 && Math.abs(p.y - y) < 0.5)) {
            a.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
            p.x = x;
            p.y = y;
          }
          // Where two links overlap, the nearer logo gets the click.
          const z = 100000 - Math.round(dist * 100);
          if (p.z !== z) {
            a.style.zIndex = String(z);
            p.z = z;
          }
          show = true;
          if (locked && this.aimRay.intersectSphere(this.sph, this.aimHit)) {
            const d = this.aimHit.distanceTo(camPos);
            if (d < bestDist) {
              bestDist = d;
              best = t;
            }
          }
        }
      }
      t.visible = inView;
      if (t.anchor && t.anchor.hidden === show) t.anchor.hidden = !show;
      if (!show && t.hovered) this.setHover(t, false);
    }

    // Locked: no cursor, so the invisible links step aside and the aimed logo takes the hover.
    const aimed = locked ? best : null;
    if (aimed !== this.aimed) {
      if (this.aimed) this.setHover(this.aimed, false);
      this.aimed = aimed;
    }
    if (locked) for (const t of this.links) this.setHover(t, t === aimed);
    if (this.layer.hidden !== locked) this.layer.hidden = locked;
  }

  private isOccluded(t: LinkTarget, camPos: THREE.Vector3): boolean {
    if (!this.occluders.length) return false;
    const center = this.occC.copy(t.sphere.center).applyMatrix4(t.object.matrixWorld);
    const dir = this.occD.copy(center).sub(camPos);
    const dist = dir.length();
    if (dist < 0.01) return false;
    // Stop a little before the logo so the wall it hangs on does not count.
    const far = dist - Math.max(0.12, t.sphere.radius * t.object.matrixWorld.getMaxScaleOnAxis() * 0.5);
    if (far <= 0) return false;
    this.ray.set(camPos, dir.divideScalar(dist));
    for (const b of this.occluders) {
      if (b.containsPoint(camPos)) continue;
      const p = this.ray.intersectBox(b, this.hit);
      if (p && p.distanceTo(camPos) < far) return true;
    }
    return false;
  }
}
