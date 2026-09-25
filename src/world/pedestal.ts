import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createLogo } from '../brand/logo';
import type { Division } from '../brand/urls';

/**
 * Museum plinth for table-top scales: a tall rectangular block (the world sizes it taller than
 * wide, see world/index.ts), top = scale footprint + a slim margin, a recessed plinth kick at the
 * base and a small logo disc near the top of the front face.
 * Origin at the floor centre; front faces +Z. Returns the group and the logo (to link it).
 */
const bodyMat = new THREE.MeshStandardMaterial({ color: '#d9dadc', roughness: 0.78 });
const kickMat = new THREE.MeshStandardMaterial({ color: '#8e9195', roughness: 0.7 });
const topMat = new THREE.MeshStandardMaterial({ color: '#e6e7e8', roughness: 0.55 });

/**
 * Plinth size for a table-top scale (metres): a vertical museum plinth. The top is the scale's
 * footprint plus a slim margin; the height is 1.5 × its wider side (never a squat cube
 * under the wide baby and dual-platform pieces), capped so the scale's top stays at a
 * comfortable viewing height, and never below the spec's pedestal height.
 */
export function pedestalSize(scale: { w: number; d: number; h: number }, pedestalHeightCm = 85): { w: number; d: number; h: number } {
  const margin = 0.03;
  const w = Math.max(0.36, scale.w + margin * 2);
  const d = Math.max(0.32, scale.d + margin * 2);
  const h = Math.max(pedestalHeightCm / 100, Math.min(1.5 * Math.max(w, d), 1.4 - scale.h));
  return { w, d, h };
}

export function createPedestal(o: { w: number; d: number; h: number; division?: Division }): { group: THREE.Group; logo: THREE.Group } {
  const g = new THREE.Group();
  g.name = 'pedestal';
  const kick = 0.06;
  // The top plate is the last 6 mm of the height, so the plate's top face is exactly at o.h:
  // the scale root stands at y = o.h (support surface), feet on the plate, not sunk into it.
  const plate = 0.006;
  const bodyH = o.h - kick - plate;
  const body = new THREE.Mesh(new RoundedBoxGeometry(o.w, bodyH, o.d, 2, 0.008), bodyMat);
  body.position.y = kick + bodyH / 2;
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  const base = new THREE.Mesh(new THREE.BoxGeometry(o.w - 0.04, kick, o.d - 0.04), kickMat);
  base.position.y = kick / 2;
  base.receiveShadow = true;
  g.add(base);
  const top = new THREE.Mesh(new THREE.BoxGeometry(o.w - 0.01, plate, o.d - 0.01), topMat);
  top.position.y = o.h - plate / 2;
  top.receiveShadow = true;
  g.add(top);
  const logo = createLogo({ diameter: Math.min(0.12, o.w * 0.3), division: o.division, style: 'flat' });
  logo.position.set(0, o.h - 0.13, o.d / 2 + 0.002);
  g.add(logo);
  return { group: g, logo };
}
