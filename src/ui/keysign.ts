import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Input, Intent } from '../core/input';

/**
 * The small "how to move" sign, entirely geometry: a slim stand with a tilted plate carrying
 * four arrow keys (inverted T: walk and step sideways) and a mouse (look around, wheel = zoom).
 * A key glows red while it is pressed; the mouse glows while the view turns, its wheel while
 * zooming. For a visitor using a finger (`input.pointerType`), a phone takes the mouse's place:
 * a fingertip swipes across its screen (drag to look) and glows while the view turns.
 * No letters. Origin at the floor; faces +Z.
 */
const RED = new THREE.Color('#d90000');
const KEY_WHITE = new THREE.Color('#f7f7f7');

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
  const board = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.36, 0.03, 2, 0.012), plateMat);
  board.castShadow = true;
  plate.add(board);

  const keyGeo = new RoundedBoxGeometry(0.1, 0.1, 0.035, 2, 0.015);
  const keys: Array<{ intent: Intent; mat: THREE.MeshStandardMaterial; arrow: THREE.MeshBasicMaterial; mesh: THREE.Mesh }> = [];
  const layout: Array<[Intent, number, number, number]> = [
    ['forward', 0, 0.06, 0],
    ['strafeLeft', -0.115, -0.055, Math.PI / 2],
    ['back', 0, -0.055, Math.PI],
    ['strafeRight', 0.115, -0.055, -Math.PI / 2],
  ];
  const keysX = -0.09; // the arrow cluster sits left of centre, the mouse on the right
  for (const [intent, x, y, rot] of layout) {
    const mat = new THREE.MeshStandardMaterial({ color: '#f7f7f7', roughness: 0.45, emissive: '#d90000', emissiveIntensity: 0 });
    const key = new THREE.Mesh(keyGeo, mat);
    key.position.set(keysX + x, y, 0.03);
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

  // Mouse: a rounded body lying on the plate, a groove between the buttons and a wheel.
  const mouseMat = new THREE.MeshStandardMaterial({ color: '#f7f7f7', roughness: 0.4, emissive: '#d90000', emissiveIntensity: 0 });
  const mouse = new THREE.Group();
  mouse.position.set(0.19, 0.0, 0.03);
  plate.add(mouse);
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.13, 0.035, 4, 0.03), mouseMat);
  body.castShadow = true;
  mouse.add(body);
  const grooveMat = new THREE.MeshBasicMaterial({ color: '#2a2c30' });
  const groove = new THREE.Mesh(new THREE.PlaneGeometry(0.003, 0.05), grooveMat);
  groove.position.set(0, 0.035, 0.0176);
  mouse.add(groove);
  const split = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.003), grooveMat);
  split.position.set(0, 0.009, 0.0176);
  mouse.add(split);
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#2a2c30', roughness: 0.6, emissive: '#d90000', emissiveIntensity: 0 });
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.01, 16), wheelMat);
  wheel.rotation.z = Math.PI / 2;
  wheel.position.set(0, 0.038, 0.018);
  mouse.add(wheel);

  // Phone (touch visitors): a dark slab in the mouse's place, a white fingertip gliding across
  // its screen between two small chevrons.
  const phone = new THREE.Group();
  phone.position.copy(mouse.position);
  plate.add(phone);
  const phoneBody = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.14, 0.012, 2, 0.006), new THREE.MeshStandardMaterial({ color: '#2a2c30', roughness: 0.35 }));
  phoneBody.castShadow = true;
  phone.add(phoneBody);
  // A light screen inside a dark bezel, so the slab reads as a phone.
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.112), new THREE.MeshBasicMaterial({ color: '#b9bec5' }));
  screen.position.set(0, 0.002, 0.0068);
  phone.add(screen);
  const chevron = new THREE.Shape();
  chevron.moveTo(0, 0.011);
  chevron.lineTo(0.011, 0);
  chevron.lineTo(0, -0.011);
  chevron.closePath();
  const chevronGeo = new THREE.ShapeGeometry(chevron);
  for (const side of [-1, 1]) {
    const c = new THREE.Mesh(chevronGeo, grooveMat);
    c.position.set(side * 0.02, 0.002, 0.0074);
    c.rotation.z = side < 0 ? Math.PI : 0;
    phone.add(c);
  }
  // The fingertip: a white disc with a dark rim, gliding across the screen.
  const tipMat = new THREE.MeshStandardMaterial({ color: '#f7f7f7', roughness: 0.4, emissive: '#d90000', emissiveIntensity: 0 });
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.008, 24), tipMat);
  tip.rotation.x = Math.PI / 2;
  tip.position.set(0, 0.002, 0.0115);
  // Rim: a dark circle just above the screen, under the disc (the disc's local +Y is the phone's +Z).
  const tipRim = new THREE.Mesh(new THREE.CircleGeometry(0.015, 24), grooveMat);
  tipRim.position.y = -0.0035;
  tipRim.rotation.x = -Math.PI / 2;
  tip.add(tipRim);
  phone.add(tip);
  phone.visible = false;

  const dark = new THREE.Color('#2a2c30');
  const white = new THREE.Color('#ffffff');
  let time = 0;
  return {
    object: g,
    update(dt: number) {
      const now = performance.now();
      time += dt;
      const looking = now - input.lastLookAt < 250 ? 0.8 : 0;
      const zooming = now - input.lastZoomAt < 400 ? 1.2 : 0;
      const k = Math.min(1, dt * 12);
      const touch = input.pointerType !== 'mouse';
      mouse.visible = !touch;
      phone.visible = touch;
      if (touch) {
        tipMat.emissiveIntensity += (looking - tipMat.emissiveIntensity) * k;
        tipMat.color.lerpColors(KEY_WHITE, RED, Math.min(1, tipMat.emissiveIntensity));
        tip.position.x = 0.012 * Math.max(-1, Math.min(1, 1.4 * Math.sin(time * 2.6)));
      }
      mouseMat.emissiveIntensity += (looking - mouseMat.emissiveIntensity) * k;
      mouseMat.color.lerpColors(KEY_WHITE, RED, Math.min(1, mouseMat.emissiveIntensity));
      wheelMat.emissiveIntensity += (zooming - wheelMat.emissiveIntensity) * k;
      wheel.rotation.x += zooming ? dt * 8 : 0;
      for (const k of keys) {
        const on = input.isHeld(k.intent);
        const target = on ? 1 : 0;
        k.mat.emissiveIntensity += (target * 0.9 - k.mat.emissiveIntensity) * Math.min(1, dt * 14);
        k.mat.color.lerpColors(KEY_WHITE, RED, k.mat.emissiveIntensity);
        k.arrow.color.copy(on ? white : dark);
        k.mesh.position.z = on ? 0.022 : 0.03;
      }
    },
  };
}
