import { createScaleRoot, cyl, logoBadge } from '../kit';
import type { ScaleInstance } from '../types';
import { cove, dialHead, finalize, finishOf, latheY, part, platform, rubberFoot, slabGeo, type BodyFinish, type PlatformKind } from './_shared';

/**
 * R150 — the column mechanical bathroom scale of the design line ("Langhals", long neck).
 * Recipe (cm, docs/catalog-research.md §4): die-cast base 27 × 40 × 8 on rubber feet, platform
 * insert 26 × 30 over the user end, a flared cast collar (Ø10 → Ø5) at the head end, a slim
 * Ø5 column ~72 tall and the Ø20 dial housing (Ø18 face, 7 deep) on top, centre ≈ 80, tilted
 * back ~18° so it looks at a standing person. Front = +Z.
 */
export function buildR150(finish: BodyFinish, kind: PlatformKind): ScaleInstance {
  const { root, cm } = createScaleRoot(`r150-${kind === 'mat' ? finish : kind}`);
  const F = finishOf(finish);

  // ---- base: lower shell with a die-cast draft + upper frame
  const W = 27;
  const BD = 40;
  const zF = 20;
  const zB = -20;
  const zc = 0;
  const footH = 0.7;
  const yS = 7.2;
  const shellH = yS - footH;
  const taper = 0.97;
  part(cm, slabGeo({ w: W, d: BD, h: shellH, r: 3.4, bevel: 0.9, z: zc, taper }), F.body, { y: footH });

  const zCol = -14; // column axis, centred across the width
  const collarR = 4.6;
  const pw = 25.4;
  const pFront = zF - 0.75;
  const pRear = zCol + collarR + 0.8;
  const pd = pFront - pRear;
  const pz = (pFront + pRear) / 2;
  const pr = 2.6;
  let yDeck = yS;
  if (kind !== 'glass') {
    part(cm, slabGeo({ w: W, d: BD, h: 0.7, r: 3.4, bevel: 0.3, z: zc, hole: { w: pw + 0.2, d: pd + 0.2, r: pr + 0.1, z: pz } }), F.body, { y: yS });
    yDeck = yS + 0.7;
  }
  const top = platform(cm, kind === 'glass' ? { kind, finish: F, y: yS, z: pz + 0.1, w: 26, d: pd + 0.5, r: 2.9 } : { kind, finish: F, y: yS, z: pz, w: pw, d: pd, r: pr });

  // ---- flared collar, column and the socket that takes the dial head
  const colR = 2.5;
  const collar: Array<[number, number]> = [
    [0, -0.2],
    [collarR - 0.15, -0.2],
    [collarR, 0.1],
    ...cove(collarR - 0.05, 0.3, colR + 0.28, 5.6, 12),
    [colR + 0.42, 5.85],
    [colR + 0.42, 6.35],
    [colR + 0.26, 6.6],
    [colR, 6.62],
  ];
  part(cm, latheY('r150collar', collar, 64), F.body, { y: yDeck, z: zCol });
  const colTop = 70.5;
  cyl(cm, colR, colR, colTop - yDeck, F.body, { y: yDeck, z: zCol, bottom: true }, 48);
  const sock: Array<[number, number]> = [
    [colR, 0],
    [colR + 0.35, 0.03],
    [colR + 0.6, 0.25],
    [colR + 0.66, 0.6],
    [colR + 0.66, 4.4], // open top: it ends inside the housing (a closed rim would smooth into a hot highlight)
  ];
  part(cm, latheY('r150sock', sock, 48), F.trim, { y: 67.1, z: zCol });

  // ---- dial head
  const head = dialHead(cm, { y: 80, z: zCol + 0.7, tilt: 18, depth: 7, finish: F });

  // ---- feet and badge
  for (const x of [-10.8, 10.8]) for (const z of [zF - 3.4, zB + 3.4]) rubberFoot(cm, x, z, 2.2, 0.7);
  const by = 4.2;
  const s = taper + (1 - taper) * ((by - footH) / shellH);
  const lean = (Math.atan(((BD / 2) * (1 - taper)) / shellH) * 180) / Math.PI;
  logoBadge(cm, 3.2, 'design', { y: by, z: zc + (BD / 2) * s + 0.06, rx: lean });

  return finalize(root, cm, {
    // The platform, stretched to just past the nose: the visitor's body (r = 28 cm) cannot reach
    // the platform centre past the head, so the trigger zone runs forward to the toe edge.
    standOn: { x: 0, z: (pRear + zF + 2) / 2, w: pw, d: zF + 2 - pRear, y: top },
    colliders: [{ x: 0, z: zCol, w: 6, d: 6 }],
    head,
  });
}
