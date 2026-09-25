import { createScaleRoot, logoBadge } from '../kit';
import type { ScaleInstance } from '../types';
import { dialHead, finalize, finishOf, part, platform, profileGeo, rubberFoot, slabGeo, type BodyFinish, type PlatformKind } from './_shared';

/**
 * 960 — the low mechanical bathroom scale of the design line (docs/catalog-research.md §4).
 * Recipe (cm): die-cast base 27 × 31 × 5 (corner radius 3) on rubber feet, platform insert
 * (ribbed rubber, clear glass plate or terracotta Tarsie) with its top at ~6.2, and at the back a
 * trapezoid neck (14 wide at the floor, 10 at the top) carrying the Ø20 dial housing (Ø18 face)
 * tilted 45° so the face looks up at the person standing on the platform. Front = +Z (the
 * visitor steps on from +Z and faces the dial).
 */
export function build960(finish: BodyFinish, kind: PlatformKind): ScaleInstance {
  const { root, cm } = createScaleRoot(`960-${kind === 'mat' ? finish : kind}`);
  const F = finishOf(finish);

  // ---- base: lower shell + upper frame (the parting line reads as a fine groove)
  const W = 27;
  const BD = 31;
  const zF = 20.5;
  const zB = zF - BD;
  const zc = (zF + zB) / 2;
  const footH = 0.5;
  const yS = 5.0; // shell top = platform seat
  const shellH = yS - footH;
  const taper = 0.985;
  part(cm, slabGeo({ w: W, d: BD, h: shellH, r: 3.2, bevel: 0.8, z: zc, taper }), F.body, { y: footH });

  // Platform rectangle: the dial's lower rim lands just behind its rear edge.
  const pw = 25.6;
  const pFront = zF - 0.7;
  const pRear = -6.4;
  const pd = pFront - pRear;
  const pz = (pFront + pRear) / 2;
  const pr = 2.5;
  if (kind !== 'glass') {
    part(cm, slabGeo({ w: W, d: BD, h: 0.7, r: 3.2, bevel: 0.3, z: zc, hole: { w: pw + 0.2, d: pd + 0.2, r: pr + 0.1, z: pz } }), F.body, { y: yS });
  }
  const top = platform(cm, kind === 'glass' ? { kind, finish: F, y: yS, z: pz - 0.1, w: 26, d: pd + 0.3, r: 2.8 } : { kind, finish: F, y: yS, z: pz, w: pw, d: pd, r: pr });

  // ---- dial head, tilted 45° over the back of the base
  const D = 5.5;
  const head = dialHead(cm, { y: 13.4, z: -14.5, tilt: 45, depth: D, finish: F });

  // ---- neck: trapezoid in front view (14 → 10); in side view it leans back like an arm from
  // the base's tail to the housing, its sloped top buried in the housing's back.
  const A = head.point(1.6, -(D - 0.6));
  const E = head.point(-7.2, -(D - 0.6));
  const yBot = footH + 0.8;
  const neck = profileGeo(
    `960|${A.z.toFixed(2)}|${A.y.toFixed(2)}`,
    [
      [A.z, A.y],
      [A.z + 3.2, yBot],
      [zB + 1.6, yBot],
      [zB + 1.6, yS - 0.8],
      [E.z, E.y],
    ],
    14,
    10,
    yBot,
    A.y,
    0.8,
  );
  part(cm, neck, F.body);

  // ---- feet: two under the nose, two under the neck
  for (const x of [-10.5, 10.5]) rubberFoot(cm, x, zF - 3.2);
  for (const x of [-4.4, 4.4]) rubberFoot(cm, x, A.z + 4.6);

  // ---- maker's badge on the nose (the shell leans back 3° with its draft)
  const by = 3.1;
  const s = taper + (1 - taper) * ((by - footH) / shellH);
  const lean = (Math.atan(((BD / 2) * (1 - taper)) / shellH) * 180) / Math.PI;
  logoBadge(cm, 2.6, 'design', { y: by, z: zc + (BD / 2) * s + 0.06, rx: lean });

  return finalize(root, cm, {
    // The platform, stretched to just past the nose: the visitor's body (r = 28 cm) cannot reach
    // the platform centre past the head, so the trigger zone runs forward to the toe edge.
    standOn: { x: 0, z: (pRear + zF + 2) / 2, w: pw, d: zF + 2 - pRear, y: top },
    colliders: [{ x: 0, z: -18.5, w: 22, d: 11 }],
    head,
  });
}
