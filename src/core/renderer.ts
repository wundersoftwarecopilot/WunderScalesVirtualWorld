import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export interface Quality {
  mobile: boolean;
  pixelRatio: number;
  shadowMap: number;
}

export function detectQuality(): Quality {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const mobile = coarse || small;
  return {
    mobile,
    pixelRatio: Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 2),
    shadowMap: mobile ? 1024 : 2048,
  };
}

/** Returns null when WebGL is not available (the page then shows a plain logo link). */
export function createRenderer(canvas: HTMLCanvasElement, q: Quality): THREE.WebGLRenderer | null {
  try {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    renderer.setPixelRatio(q.pixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    // The world is static: the shadow map is rendered once after building (see main.ts).
    renderer.shadowMap.autoUpdate = false;
    renderer.autoClear = false;
    return renderer;
  } catch (err) {
    console.error('[renderer] WebGL unavailable', err);
    return null;
  }
}

/** Neutral studio reflections for metals and glass, generated in code (no HDR download). */
export function applyEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();
}

/** Overhead "skylight" sun with one static shadow map over the whole site, plus sky fill. */
export function addLights(scene: THREE.Scene, q: Quality): THREE.DirectionalLight {
  const hemi = new THREE.HemisphereLight('#f4f6f8', '#7d8084', 1.05);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffffff', 2.3);
  sun.position.set(14, 60, 22);
  sun.target.position.set(0, 0, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
  const s = sun.shadow.camera;
  s.left = -44;
  s.right = 44;
  s.top = 36;
  s.bottom = -36;
  s.near = 10;
  s.far = 120;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  return sun;
}
