import * as THREE from 'three';

/**
 * 7-segment readout drawn as geometry: one InstancedMesh per display (one draw call), lit
 * segments in the display colour, unlit ones as a faint ghost like a real LCD/LED.
 */

// Segment order: a b c d e f g
const DIGITS: Record<string, number> = {
  '0': 0b1111110,
  '1': 0b0110000,
  '2': 0b1101101,
  '3': 0b1111001,
  '4': 0b0110011,
  '5': 0b1011011,
  '6': 0b1011111,
  '7': 0b1110000,
  '8': 0b1111111,
  '9': 0b1111011,
  '-': 0b0000001,
  ' ': 0,
};

export interface SegmentDisplayOptions {
  digits: number;
  /** Digit height in the parent's units (usually cm inside a scale's cm group). */
  height: number;
  /** Lit colour. LCD black-on-green or LED red, per model. */
  color?: THREE.ColorRepresentation;
  /** Unlit segment colour (the "ghost"). */
  offColor?: THREE.ColorRepresentation;
  /** Italic slant, 0 = upright. */
  slant?: number;
}

let segGeo: THREE.ShapeGeometry | null = null;
let dotGeo: THREE.CircleGeometry | null = null;

/** Elongated hexagon, length 1 along X, thickness 0.2, centred. */
function segmentGeometry(): THREE.ShapeGeometry {
  if (segGeo) return segGeo;
  const t = 0.2;
  const L = 1;
  const s = new THREE.Shape();
  s.moveTo(-L / 2, 0);
  s.lineTo(-L / 2 + t / 2, t / 2);
  s.lineTo(L / 2 - t / 2, t / 2);
  s.lineTo(L / 2, 0);
  s.lineTo(L / 2 - t / 2, -t / 2);
  s.lineTo(-L / 2 + t / 2, -t / 2);
  s.closePath();
  segGeo = new THREE.ShapeGeometry(s);
  return segGeo;
}

export class SegmentDisplay {
  readonly object: THREE.Group;
  private readonly mesh: THREE.InstancedMesh;
  private readonly dots: THREE.InstancedMesh;
  private readonly on: THREE.Color;
  private readonly off: THREE.Color;
  readonly digits: number;
  /** Width of the whole readout in parent units (for layout). */
  readonly width: number;
  readonly height: number;
  private text = '';
  private tween: { from: number; to: number; t: number; dur: number; decimals: number; settle: number } | null = null;
  value = 0;

  constructor(opts: SegmentDisplayOptions) {
    const n = opts.digits;
    const H = opts.height;
    const W = H * 0.56; // digit cell width
    const gap = H * 0.2;
    const seg = H / 2; // vertical segment length ≈ half the height
    this.digits = n;
    this.height = H;
    this.width = n * W + (n - 1) * gap;
    this.on = new THREE.Color(opts.color ?? '#101410');
    this.off = new THREE.Color(opts.offColor ?? this.on.clone().lerp(new THREE.Color('#888888'), 0.5).multiplyScalar(0.25));
    const slant = opts.slant ?? 0.08;

    const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
    this.mesh = new THREE.InstancedMesh(segmentGeometry(), mat, n * 7);
    dotGeo ??= new THREE.CircleGeometry(0.5, 10);
    this.dots = new THREE.InstancedMesh(dotGeo, mat, n);
    this.object = new THREE.Group();
    this.object.name = 'segment-display';
    this.object.add(this.mesh, this.dots);

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const zAxis = new THREE.Vector3(0, 0, 1);
    const sc = new THREE.Vector3();
    const p = new THREE.Vector3();
    const hw = W * 0.5 - H * 0.05;
    // [x, y, rotated?] per segment, digit-local, origin at digit centre
    const layout: Array<[number, number, boolean]> = [
      [0, seg, false], // a
      [hw, seg / 2, true], // b
      [hw, -seg / 2, true], // c
      [0, -seg, false], // d
      [-hw, -seg / 2, true], // e
      [-hw, seg / 2, true], // f
      [0, 0, false], // g
    ];
    const left = -this.width / 2 + W / 2;
    for (let d = 0; d < n; d++) {
      const cx = left + d * (W + gap);
      layout.forEach(([x, y, vertical], i) => {
        q.setFromAxisAngle(zAxis, vertical ? Math.PI / 2 : 0);
        const len = vertical ? seg * 0.92 : hw * 2 * 0.92;
        sc.set(len, H * 0.5, 1); // thickness 0.2 × H*0.5 = 0.1H
        p.set(cx + x + y * slant, y, 0);
        m.compose(p, q, sc);
        this.mesh.setMatrixAt(d * 7 + i, m);
        this.mesh.setColorAt(d * 7 + i, this.off);
      });
      q.identity();
      sc.setScalar(H * 0.13);
      p.set(cx + W / 2 + gap / 2 - seg * slant, -seg, 0);
      m.compose(p, q, sc);
      this.dots.setMatrixAt(d, m);
      this.dots.setColorAt(d, this.off);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.dots.instanceMatrix.needsUpdate = true;
    this.show(' '.repeat(n));
  }

  /** Show a string of digits, '-', ' ' and '.' (a '.' lights the dot after the previous digit). */
  show(str: string): void {
    if (str === this.text) return;
    this.text = str;
    const cells: Array<{ ch: string; dot: boolean }> = [];
    for (const ch of str) {
      if (ch === '.' && cells.length) cells[cells.length - 1].dot = true;
      else cells.push({ ch, dot: false });
    }
    while (cells.length < this.digits) cells.unshift({ ch: ' ', dot: false });
    const shown = cells.slice(-this.digits);
    shown.forEach((c, d) => {
      const bits = DIGITS[c.ch] ?? 0;
      for (let i = 0; i < 7; i++) this.mesh.setColorAt(d * 7 + i, bits & (1 << (6 - i)) ? this.on : this.off);
      this.dots.setColorAt(d, c.dot ? this.on : this.off);
    });
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    if (this.dots.instanceColor) this.dots.instanceColor.needsUpdate = true;
  }

  /** Right-aligned number with fixed decimals, e.g. set(72.4, 1) → "  72.4". */
  set(value: number, decimals = 1): void {
    this.value = value;
    const s = Math.abs(value) >= 10 ** this.digits ? '-'.repeat(this.digits) : value.toFixed(decimals);
    this.show(s);
  }

  /** Count up/down to a value like a real scale: fast approach, a short settle, then stable. */
  tweenTo(value: number, decimals = 1, duration = 1.1): void {
    this.tween = { from: this.value, to: value, t: 0, dur: duration, decimals, settle: 0.45 };
  }

  /** True once a tween has finished settling. */
  get stable(): boolean {
    return this.tween === null;
  }

  update(dt: number): void {
    const tw = this.tween;
    if (!tw) return;
    tw.t += dt;
    const k = Math.min(1, tw.t / tw.dur);
    const ease = 1 - Math.pow(1 - k, 3);
    let v = tw.from + (tw.to - tw.from) * ease;
    if (k >= 1) {
      const s = tw.t - tw.dur;
      if (s < tw.settle) {
        const step = 10 ** -tw.decimals;
        v = tw.to + Math.round(Math.sin(s * 40) * 1.4) * step;
      } else {
        v = tw.to;
        this.tween = null;
      }
    }
    this.set(v, tw.decimals);
  }
}
