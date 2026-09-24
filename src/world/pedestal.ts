import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createLogo } from '../brand/logo';
import type { Division } from '../brand/urls';

/**
 * Museum plinth for table-top scales: a tall rectangular block, top = scale footprint + margin,
 * a recessed plinth kick at the base and a small logo disc near the top of the front face.
 * Origin at the floor centre; front faces +Z. Returns the group and the logo (to link it).
 */
const bodyMat = new THREE.MeshStandardMaterial({ color: '#d9dadc', roughness: 0.78 });
const kickMat = new THREE.MeshStandardMaterial({ color: '#8e9195', roughness: 0.7 });
const topMat = new THREE.MeshStandardMaterial({ color: '#e6e7e8', roughness: 0.55 });

export function createPedestal(o: { w: number; d: number; h: number; division?: Division }): { group: THREE.Group; logo: THREE.Group } {
  const g = new THREE.Group();
  g.name = 'pedestal';
  const kick = 0.06;
  const body = new THREE.Mesh(new RoundedBoxGeometry(o.w, o.h - kick, o.d, 2, 0.008), bodyMat);
  body.position.y = kick + (o.h - kick) / 2;
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  const base = new THREE.Mesh(new THREE.BoxGeometry(o.w - 0.04, kick, o.d - 0.04), kickMat);
  base.position.y = kick / 2;
  base.receiveShadow = true;
  g.add(base);
  const top = new THREE.Mesh(new THREE.BoxGeometry(o.w - 0.01, 0.006, o.d - 0.01), topMat);
  top.position.y = o.h + 0.003;
  top.receiveShadow = true;
  g.add(top);
  const logo = createLogo({ diameter: Math.min(0.12, o.w * 0.3), division: o.division, style: 'flat' });
  logo.position.set(0, o.h - 0.13, o.d / 2 + 0.002);
  g.add(logo);
  return { group: g, logo };
}
