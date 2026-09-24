import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Input, Intent } from '../core/input';

/**
 * The small "how to move" sign, entirely geometry: a slim stand with a tilted plate carrying
 * four arrow keys (inverted T). A key glows red while it is pressed. No letters.
 * Origin at the floor; faces +Z.
 */
const RED = new THREE.Color('#d90000');

function arrowShape(): THREE.Shape {
  // Thin arrow pointing +Y: shaft 0.12 wide, head 0.5 wide, total length 1 (centred).
  const s = new THREE.Shape();
  const sw = 0.06;
  s.moveTo(-sw, -0.5);
  s.lineTo(sw, -0.5);
  s.lineTo(sw, 0.1);
  s.lineTo(0.25, 0.1);
  s.lineTo(0, 0.5);
  s.lineTo(-0.25, 0.1);
  s.lineTo(-sw, 0.1);
  s.closePath();
  return s;
}

let arrowGeo: THREE.ShapeGeometry | null = null;
export function arrowGeometry(): THREE.ShapeGeometry {
  return (arrowGeo ??= new THREE.ShapeGeometry(arrowShape()));
}

export function createKeySign(input: Input): { object: THREE.Group; update(dt: number): void } {
  const g = new THREE.Group();
  g.name = 'key-sign';
  const standMat = new THREE.MeshStandardMaterial({ color: '#3a3d42', roughness: 0.5 });
  const plateMat = new THREE.MeshStandardMaterial({ color: '#e4e5e7', roughness: 0.6 });

  const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.95, 0.06), standMat);
  post.position.y = 0.475;
  post.castShadow = true;
  g.add(post);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.02, 0.26), standMat);
  foot.position.y = 0.01;
  g.add(foot);

  const plate = new THREE.Group();
  plate.position.set(0, 1.0, 0.02);
  plate.rotation.x = -0.6; // tilted towards the visitor
  g.add(plate);
  const board = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.36, 0.03, 2, 0.012), plateMat);
  board.castShadow = true;
  plate.add(board);

  const keyGeo = new RoundedBoxGeometry(0.1, 0.1, 0.035, 2, 0.015);
  const keys: Array<{ intent: Intent; mat: THREE.MeshStandardMaterial; arrow: THREE.MeshBasicMaterial; mesh: THREE.Mesh }> = [];
  const layout: Array<[Intent, number, number, number]> = [
    ['forward', 0, 0.06, 0],
    ['left', -0.115, -0.055, Math.PI / 2],
    ['back', 0, -0.055, Math.PI],
    ['right', 0.115, -0.055, -Math.PI / 2],
  ];
  for (const [intent, x, y, rot] of layout) {
    const mat = new THREE.MeshStandardMaterial({ color: '#f7f7f7', roughness: 0.45, emissive: '#d90000', emissiveIntensity: 0 });
    const key = new THREE.Mesh(keyGeo, mat);
    key.position.set(x, y, 0.03);
    key.castShadow = true;
    plate.add(key);
    const arrowMat = new THREE.MeshBasicMaterial({ color: '#2a2c30' });
    const arrow = new THREE.Mesh(arrowGeometry(), arrowMat);
    arrow.scale.setScalar(0.06);
    arrow.rotation.z = rot;
    arrow.position.set(0, 0, 0.0185);
    key.add(arrow);
    keys.push({ intent, mat, arrow: arrowMat, mesh: key });
  }

  const dark = new THREE.Color('#2a2c30');
  const white = new THREE.Color('#ffffff');
  return {
    object: g,
    update(dt: number) {
      for (const k of keys) {
        const on = input.isHeld(k.intent);
        const target = on ? 1 : 0;
        k.mat.emissiveIntensity += (target * 0.9 - k.mat.emissiveIntensity) * Math.min(1, dt * 14);
        k.mat.color.lerpColors(new THREE.Color('#f7f7f7'), RED, k.mat.emissiveIntensity);
        k.arrow.color.copy(on ? white : dark);
        k.mesh.position.z = on ? 0.022 : 0.03;
      }
    },
  };
}
