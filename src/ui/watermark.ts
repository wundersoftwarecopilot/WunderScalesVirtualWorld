import * as THREE from 'three';

/**
 * The one piece of text in the world, asked for by the owner: a see-through watermark in the
 * top-right corner, shown while the mouse is locked, telling how to get the cursor back.
 * English above, Italian below; "ESC" sits in a small keycap outline like the in-world key sign.
 * Drawn once into a 2D canvas with the system UI font (no font files) and shown by the WebGL HUD,
 * so the page itself stays free of text.
 */
const LINES: Array<[string, string]> = [
  ['Press ', ' to release the mouse'],
  ['Premere ', ' per rilasciare il mouse'],
];
const KEY = 'ESC';

/** CSS pixels. */
const FONT_PX = 14;
const KEY_FONT_PX = 11;
const LINE_H = 24;
const PAD = 4;
const FONT = `600 ${FONT_PX}px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
const KEY_FONT = `700 ${KEY_FONT_PX}px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

export class EscWatermark {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  /** Size in CSS pixels (the mesh is scaled to it). */
  width = 1;
  height = 1;
  private readonly canvas = document.createElement('canvas');
  private readonly texture = new THREE.CanvasTexture(this.canvas);
  private ratio = 0;

  constructor() {
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

  /** Redraw for the renderer's pixel ratio (sharp on every screen); cheap no-op when unchanged. */
  draw(pixelRatio: number): void {
    const r = Math.max(1, Math.min(3, pixelRatio));
    if (r === this.ratio) return;
    this.ratio = r;
    const g = this.canvas.getContext('2d');
    if (!g) return;

    // Measure every line: text before the key, the keycap, text after.
    const keyW = (() => {
      g.font = KEY_FONT;
      return Math.ceil(g.measureText(KEY).width) + 12;
    })();
    g.font = FONT;
    const widths = LINES.map(([a, b]) => g.measureText(a).width + keyW + g.measureText(b).width);
    this.width = Math.ceil(Math.max(...widths)) + PAD * 2;
    this.height = LINE_H * LINES.length + PAD * 2;

    this.canvas.width = Math.round(this.width * r);
    this.canvas.height = Math.round(this.height * r);
    g.setTransform(r, 0, 0, r, 0, 0);
    g.clearRect(0, 0, this.width, this.height);
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    // White with a soft dark edge: readable on the light walls and on the dark floor alike.
    const ink = 'rgba(255,255,255,0.96)';
    const edge = 'rgba(31,34,38,0.55)';

    LINES.forEach(([a, b], i) => {
      const y = PAD + LINE_H * (i + 0.5);
      let x = this.width - PAD - widths[i]; // right-aligned
      g.font = FONT;
      x = this.text(g, a, x, y, ink, edge);
      // Keycap: rounded outline with the key's name inside.
      const kh = KEY_FONT_PX + 8;
      const kx = x + 2;
      const kw = keyW - 4;
      roundedPath(g, kx, y - kh / 2, kw, kh, 4);
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
      g.fillText(KEY, kx + kw / 2, y + 0.5);
      g.textAlign = 'left';
      g.font = FONT;
      this.text(g, b, x + keyW, y, ink, edge);
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
