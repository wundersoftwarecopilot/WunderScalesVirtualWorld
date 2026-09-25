import * as THREE from 'three';

/**
 * The only text in the world, asked for by the owner: see-through watermarks in the top-right
 * corner, English above and Italian below. Before the mouse is locked one says how to take the
 * camera with the mouse; while it is locked the other says how to let it go, with "ESC" in a small
 * keycap outline like the in-world key sign. Drawn once into a 2D canvas with the system UI font
 * (no font files) and shown by the WebGL HUD, so the page itself stays free of text.
 */

/** A piece of a line: plain text, or a key drawn as a keycap. */
type Segment = string | { key: string };

export const CLICK_LINES: Segment[][] = [
  ['Click to control the camera with the mouse'],
  ['Cliccare per controllare la telecamera con il mouse'],
];
export const ESC_LINES: Segment[][] = [
  ['Press ', { key: 'ESC' }, ' to release the mouse'],
  ['Premere ', { key: 'ESC' }, ' per rilasciare il mouse'],
];

/** CSS pixels. */
const FONT_PX = 14;
const KEY_FONT_PX = 11;
const LINE_H = 24;
const PAD = 4;
const FONT = `600 ${FONT_PX}px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
const KEY_FONT = `700 ${KEY_FONT_PX}px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

export class Watermark {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  /** Size in CSS pixels (the mesh is scaled to it). */
  width = 1;
  height = 1;
  /** Current opacity, eased by the HUD. */
  opacity = 0;
  private readonly canvas = document.createElement('canvas');
  private readonly texture = new THREE.CanvasTexture(this.canvas);
  private ratio = 0;

  constructor(private readonly lines: Segment[][]) {
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: this.texture, transparent: true, opacity: 0, depthTest: false, toneMapped: false }),
    );
    this.mesh.renderOrder = 40;
    this.mesh.visible = false;
  }

  /** Ease towards `target` opacity; hidden once fully faded out. */
  fade(target: number, dt: number): void {
    this.opacity += (target - this.opacity) * Math.min(1, dt * 6);
    if (target === 0 && this.opacity < 0.01) this.opacity = 0;
    this.mesh.material.opacity = this.opacity;
    this.mesh.visible = this.opacity > 0;
  }

  /** Redraw for the renderer's pixel ratio (sharp on every screen); cheap no-op when unchanged. */
  draw(pixelRatio: number): void {
    const r = Math.max(1, Math.min(3, pixelRatio));
    if (r === this.ratio) return;
    this.ratio = r;
    const g = this.canvas.getContext('2d');
    if (!g) return;

    // Measure every line: text runs and keycaps.
    const keyWidth = (k: string) => {
      g.font = KEY_FONT;
      return Math.ceil(g.measureText(k).width) + 12;
    };
    const segWidth = (seg: Segment) => {
      if (typeof seg !== 'string') return keyWidth(seg.key);
      g.font = FONT;
      return g.measureText(seg).width;
    };
    const widths = this.lines.map((line) => line.reduce((sum, seg) => sum + segWidth(seg), 0));
    this.width = Math.ceil(Math.max(...widths)) + PAD * 2;
    this.height = LINE_H * this.lines.length + PAD * 2;

    this.canvas.width = Math.round(this.width * r);
    this.canvas.height = Math.round(this.height * r);
    g.setTransform(r, 0, 0, r, 0, 0);
    g.clearRect(0, 0, this.width, this.height);
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    // White with a soft dark edge: readable on the light walls and on the dark floor alike.
    const ink = 'rgba(255,255,255,0.96)';
    const edge = 'rgba(31,34,38,0.55)';

    this.lines.forEach((line, i) => {
      const y = PAD + LINE_H * (i + 0.5);
      let x = this.width - PAD - widths[i]; // right-aligned
      for (const seg of line) {
        if (typeof seg === 'string') {
          g.font = FONT;
          x = this.text(g, seg, x, y, ink, edge);
          continue;
        }
        // Keycap: rounded outline with the key's name inside.
        const kw = keyWidth(seg.key);
        const kh = KEY_FONT_PX + 8;
        roundedPath(g, x + 2, y - kh / 2, kw - 4, kh, 4);
        g.fillStyle = 'rgba(31,34,38,0.35)';
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = edge;
        g.stroke();
        g.lineWidth = 1.25;
        g.strokeStyle = ink;
        g.stroke();
        g.font = KEY_FONT;
        g.textAlign = 'center';
        g.fillStyle = ink;
        g.fillText(seg.key, x + kw / 2, y + 0.5);
        g.textAlign = 'left';
        x += kw;
      }
    });

    this.texture.needsUpdate = true;
    this.mesh.scale.set(this.width, this.height, 1);
  }

  /** Draws `s` at (x, y) with a dark edge under it; returns the x after it. */
  private text(g: CanvasRenderingContext2D, s: string, x: number, y: number, ink: string, edge: string): number {
    g.lineWidth = 3;
    g.strokeStyle = edge;
    g.strokeText(s, x, y);
    g.fillStyle = ink;
    g.fillText(s, x, y);
    return x + g.measureText(s).width;
  }
}

/** A rounded rectangle path (ctx.roundRect is missing on older Safari). */
function roundedPath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
