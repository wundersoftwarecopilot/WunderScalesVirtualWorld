import * as THREE from 'three';

/**
 * Clickable logos. Artifact viewers block window.open for most visitors, so every logo that is
 * on screen gets a real, transparent <a href> placed exactly over its projected bounds. The
 * visitor clicks or taps a normal link; the WebGL logo lights up on hover.
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
}

const MAX_DIST = 26; // metres; further logos are too small to click anyway
const MIN_PX = 14;

export class LinkLayer {
  readonly links: LinkTarget[] = [];
  private readonly ray = new THREE.Ray();
  private readonly hit = new THREE.Vector3();
  private occlusionCursor = 0;
  private readonly tmpV = new THREE.Vector3();
  private readonly tmpC = new THREE.Vector3();
  private readonly frustum = new THREE.Frustum();
  private readonly projScreen = new THREE.Matrix4();
  /** World-space boxes that can hide a logo (walls, tall shelving). Filled by the world builder. */
  occluders: THREE.Box3[] = [];

  constructor(private readonly layer: HTMLElement) {}

  register(object: THREE.Object3D, url: string, label: string, onHover?: (hover: boolean) => void): LinkTarget {
    const box = new THREE.Box3();
    object.updateWorldMatrix(true, true);
    // Bounds in the object's local frame so the link follows it if it moves.
    const inv = new THREE.Matrix4().copy(object.matrixWorld).invert();
    object.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.geometry) return;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      const b = m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld).applyMatrix4(inv);
      box.union(b);
    });
    const sphere = box.isEmpty() ? new THREE.Sphere(new THREE.Vector3(), 0.1) : box.getBoundingSphere(new THREE.Sphere());
    const t: LinkTarget = { object, url, label, onHover, sphere, visible: false, occluded: false, hovered: false };
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
    const hover = (on: boolean) => {
      if (t.hovered === on) return;
      t.hovered = on;
      t.onHover?.(on);
    };
    a.addEventListener('pointerenter', () => hover(true));
    a.addEventListener('pointerleave', () => hover(false));
    a.addEventListener('focus', () => hover(true));
    a.addEventListener('blur', () => hover(false));
    this.layer.appendChild(a);
    t.anchor = a;
    return a;
  }

  update(camera: THREE.PerspectiveCamera, width: number, height: number): void {
    camera.updateMatrixWorld();
    this.projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projScreen);
    const camPos = camera.getWorldPosition(this.tmpC);
    const focal = height / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);

    // Re-test occlusion for a few links per frame (round robin) to keep raycasts cheap.
    const budget = Math.min(this.links.length, 6);
    for (let i = 0; i < budget; i++) {
      const t = this.links[(this.occlusionCursor + i) % this.links.length];
      if (t.visible) t.occluded = this.isOccluded(t, camPos);
    }
    this.occlusionCursor = (this.occlusionCursor + budget) % Math.max(1, this.links.length);

    for (const t of this.links) {
      const center = this.tmpV.copy(t.sphere.center).applyMatrix4(t.object.matrixWorld);
      const scale = t.object.matrixWorld.getMaxScaleOnAxis();
      const radius = t.sphere.radius * scale;
      const dist = center.distanceTo(camPos);
      const inView =
        t.object.visible && dist < MAX_DIST && this.frustum.intersectsSphere(new THREE.Sphere(center, radius));
      let show = false;
      if (inView) {
        if (!t.visible) t.occluded = this.isOccluded(t, camPos); // freshly visible: test now
        const ndc = center.clone().project(camera);
        const px = ((ndc.x + 1) / 2) * width;
        const py = ((1 - ndc.y) / 2) * height;
        const r = (radius / Math.max(0.01, dist)) * focal;
        if (ndc.z < 1 && r >= MIN_PX / 2 && !t.occluded) {
          const a = this.anchorFor(t);
          const size = Math.min(r * 2, Math.max(width, height));
          a.style.width = a.style.height = size.toFixed(1) + 'px';
          a.style.transform = `translate(${(px - size / 2).toFixed(1)}px, ${(py - size / 2).toFixed(1)}px)`;
          show = true;
        }
      }
      t.visible = inView;
      if (t.anchor && t.anchor.hidden === show) t.anchor.hidden = !show;
      if (!show && t.hovered) {
        t.hovered = false;
        t.onHover?.(false);
      }
    }
  }

  private isOccluded(t: LinkTarget, camPos: THREE.Vector3): boolean {
    if (!this.occluders.length) return false;
    const center = t.sphere.center.clone().applyMatrix4(t.object.matrixWorld);
    const dir = center.clone().sub(camPos);
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
