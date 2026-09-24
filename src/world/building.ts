import * as THREE from 'three';
import { URLS, LABELS } from '../brand/urls';
import type { WorldContext } from './context';
import { slidingDoors } from './doors';
import { BUILDING, OPENINGS, PLAZA, WALL, ZONES } from './layout';

/**
 * The building shell: ground, plaza, floors, walls with doorways, roofs/ceilings, ceiling light
 * panels, the glass facade with automatic doors, the facade sign and the plaza totem.
 * Zone modules dress the inside of each zone afterwards.
 */
interface Gap {
  a: number;
  b: number;
  top: number;
}

export function buildShell(ctx: WorldContext, getVisitor: () => { x: number; z: number }): void {
  const m = ctx.mats;

  // ---------------------------------------------------------------- ground and plaza
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#8b8e92', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.03;
  ground.receiveShadow = true;
  ctx.addStatic(ground);

  const plaza = new THREE.Mesh(new THREE.BoxGeometry(PLAZA.maxX - PLAZA.minX, 0.1, PLAZA.maxZ - PLAZA.minZ), m.plaza);
  plaza.position.set((PLAZA.minX + PLAZA.maxX) / 2, -0.05, (PLAZA.minZ + PLAZA.maxZ) / 2);
  plaza.receiveShadow = true;
  ctx.addStatic(plaza);
  // Paving joints: thin darker strips every 2 m.
  const joint = new THREE.MeshStandardMaterial({ color: '#8d9094', roughness: 1 });
  for (let x = PLAZA.minX + 2; x < PLAZA.maxX; x += 2) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.004, PLAZA.maxZ - PLAZA.minZ), joint);
    s.position.set(x, 0.001, (PLAZA.minZ + PLAZA.maxZ) / 2);
    ctx.addStatic(s);
  }
  for (let z = PLAZA.minZ + 2; z < PLAZA.maxZ; z += 2) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(PLAZA.maxX - PLAZA.minX, 0.004, 0.02), joint);
    s.position.set((PLAZA.minX + PLAZA.maxX) / 2, 0.001, z);
    ctx.addStatic(s);
  }
  // Plaza edges: the visitor cannot wander off into the void.
  ctx.addCollider({ minX: PLAZA.minX - 1, maxX: PLAZA.minX, minZ: PLAZA.minZ, maxZ: PLAZA.maxZ });
  ctx.addCollider({ minX: PLAZA.maxX, maxX: PLAZA.maxX + 1, minZ: PLAZA.minZ, maxZ: PLAZA.maxZ });
  ctx.addCollider({ minX: PLAZA.minX, maxX: PLAZA.maxX, minZ: PLAZA.maxZ, maxZ: PLAZA.maxZ + 1 });
  // Low kerb along the plaza edges.
  for (const [cx, cz, w, d] of [
    [PLAZA.minX + 0.15, (PLAZA.minZ + PLAZA.maxZ) / 2, 0.3, PLAZA.maxZ - PLAZA.minZ],
    [PLAZA.maxX - 0.15, (PLAZA.minZ + PLAZA.maxZ) / 2, 0.3, PLAZA.maxZ - PLAZA.minZ],
    [(PLAZA.minX + PLAZA.maxX) / 2, PLAZA.maxZ - 0.15, PLAZA.maxX - PLAZA.minX, 0.3],
  ]) {
    const k = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, d), m.trim);
    k.position.set(cx, 0.175, cz);
    k.castShadow = k.receiveShadow = true;
    ctx.addStatic(k);
  }

  // ---------------------------------------------------------------- floors and roofs
  const floorMat = { entrance: m.floor, medicale: m.floorWing, industriale: m.floorWing, design: m.floorGallery };
  for (const z of Object.values(ZONES)) {
    const r = z.inner;
    const w = r.maxX - r.minX + WALL;
    const d = r.maxZ - r.minZ + WALL;
    const cx = (r.minX + r.maxX) / 2;
    const cz = (r.minZ + r.maxZ) / 2;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), floorMat[z.id]);
    floor.position.set(cx, -0.05, cz);
    floor.receiveShadow = true;
    ctx.addStatic(floor);
    // Roof slab: its underside is the ceiling. It does not cast shadows, so the sun reads as
    // soft overhead light indoors.
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), m.ceiling);
    roof.position.set(cx, z.height + 0.15, cz);
    roof.castShadow = false;
    roof.receiveShadow = true;
    ctx.addStatic(roof);
    // Ceiling light panels on a regular grid.
    const step = z.id === 'industriale' ? 5 : 3.2;
    const panelGeo = new THREE.BoxGeometry(z.id === 'industriale' ? 2.4 : 1.2, 0.03, 0.28);
    for (let x = r.minX + step / 2 + 0.4; x < r.maxX - 0.4; x += step) {
      for (let zz = r.minZ + step / 2 + 0.4; zz < r.maxZ - 0.4; zz += step) {
        const p = new THREE.Mesh(panelGeo, m.lamp);
        p.position.set(x, z.height - 0.015, zz);
        p.castShadow = false;
        ctx.addStatic(p);
      }
    }
  }

  // ---------------------------------------------------------------- walls
  const wallAlongX = (z: number, x0: number, x1: number, h: number, gaps: Gap[] = [], mat = m.wall) => {
    let cursor = x0 - WALL / 2;
    const end = x1 + WALL / 2;
    const sorted = [...gaps].sort((a, b) => a.a - b.a);
    for (const g of sorted) {
      segment(cursor, g.a, z, h, 'x', mat);
      lintel(g.a, g.b, z, g.top, h, 'x', mat);
      cursor = g.b;
    }
    segment(cursor, end, z, h, 'x', mat);
  };
  const wallAlongZ = (x: number, z0: number, z1: number, h: number, gaps: Gap[] = [], mat = m.wall) => {
    let cursor = z0 - WALL / 2;
    const end = z1 + WALL / 2;
    const sorted = [...gaps].sort((a, b) => a.a - b.a);
    for (const g of sorted) {
      segment(cursor, g.a, x, h, 'z', mat);
      lintel(g.a, g.b, x, g.top, h, 'z', mat);
      cursor = g.b;
    }
    segment(cursor, end, x, h, 'z', mat);
  };
  function segment(a: number, b: number, at: number, h: number, axis: 'x' | 'z', mat: THREE.Material, y0 = 0) {
    const len = b - a;
    if (len <= 0.001) return;
    const geo = axis === 'x' ? new THREE.BoxGeometry(len, h - y0, WALL) : new THREE.BoxGeometry(WALL, h - y0, len);
    const mesh = new THREE.Mesh(geo, mat);
    const c = (a + b) / 2;
    if (axis === 'x') mesh.position.set(c, y0 + (h - y0) / 2, at);
    else mesh.position.set(at, y0 + (h - y0) / 2, c);
    mesh.castShadow = mesh.receiveShadow = true;
    const box = new THREE.Box3().setFromCenterAndSize(mesh.position, axis === 'x' ? new THREE.Vector3(len, h - y0, WALL) : new THREE.Vector3(WALL, h - y0, len));
    ctx.addOccluder(box);
    if (y0 < 1.8) {
      if (axis === 'x') ctx.addCollider({ minX: a, maxX: b, minZ: at - WALL / 2, maxZ: at + WALL / 2 });
      else ctx.addCollider({ minX: at - WALL / 2, maxX: at + WALL / 2, minZ: a, maxZ: b });
    }
    ctx.addStatic(mesh);
  }
  function lintel(a: number, b: number, at: number, top: number, h: number, axis: 'x' | 'z', mat: THREE.Material) {
    if (top < h) segment(a, b, at, h, axis, mat, top);
  }

  const zM = ZONES.medicale.height;
  const zI = ZONES.industriale.height;
  const zD = ZONES.design.height;
  const zE = ZONES.entrance.height;
  const open = (id: string) => OPENINGS.find((o) => o.id === id)!;
  const toMed = open('to-medicale');
  const toInd = open('to-industriale');
  const toDes = open('to-design');

  // Outer walls.
  wallAlongX(BUILDING.minZ, -34, -10, zM);
  wallAlongX(BUILDING.minZ, -10, 10, zD);
  wallAlongX(BUILDING.minZ, 10, 34, zI);
  wallAlongZ(BUILDING.minX, -16, 16, zM);
  wallAlongZ(BUILDING.maxX, -16, 16, zI);
  wallAlongX(BUILDING.maxZ, -34, -10, zM);
  wallAlongX(BUILDING.maxZ, 10, 34, zI);
  // Inner walls with doorways.
  wallAlongZ(-10, -16, 0, zD);
  wallAlongZ(-10, 0, 16, zE, [{ a: toMed.z - toMed.width / 2, b: toMed.z + toMed.width / 2, top: 3.1 }]);
  wallAlongZ(10, -16, 0, zI);
  wallAlongZ(10, 0, 16, zI, [{ a: toInd.z - toInd.width / 2, b: toInd.z + toInd.width / 2, top: 3.1 }]);
  wallAlongX(0, -10, 10, zE, [{ a: toDes.x - toDes.width / 2, b: toDes.x + toDes.width / 2, top: 3.6 }]);

  // ---------------------------------------------------------------- lobby facade (z = 16)
  const fz = BUILDING.maxZ;
  const front = open('front');
  const glassTop = 4.3;
  const doorTop = 2.8;
  segment(-10 - WALL / 2, -7, fz, zE, 'x', m.wallDark);
  segment(7, 10 + WALL / 2, fz, zE, 'x', m.wallDark);
  segment(-7, 7, fz, zE, 'x', m.wallDark, glassTop); // band above the glass (sign lives here)
  const glassPane = (x0: number, x1: number, y0: number, y1: number) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, 0.03), m.glass);
    p.position.set((x0 + x1) / 2, (y0 + y1) / 2, fz);
    ctx.addStatic(p);
  };
  const dx0 = front.x - front.width / 2;
  const dx1 = front.x + front.width / 2;
  glassPane(-7, dx0, 0, glassTop);
  glassPane(dx1, 7, 0, glassTop);
  glassPane(dx0, dx1, doorTop + 0.22, glassTop);
  ctx.addCollider({ minX: -7, maxX: dx0, minZ: fz - 0.15, maxZ: fz + 0.15 });
  ctx.addCollider({ minX: dx1, maxX: 7, minZ: fz - 0.15, maxZ: fz + 0.15 });
  // Mullions and a transom.
  const mull = m.metalDark;
  for (const x of [-7, -5.6, -4.2, -2.8, dx0, dx1, 2.8, 4.2, 5.6, 7]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, glassTop, 0.12), mull);
    bar.position.set(x, glassTop / 2, fz);
    bar.castShadow = true;
    ctx.addStatic(bar);
  }
  for (const [x0, x1] of [
    [-7, dx0],
    [dx1, 7],
  ]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.07, 0.12), mull);
    t.position.set((x0 + x1) / 2, doorTop + 0.11, fz);
    ctx.addStatic(t);
  }
  slidingDoors(ctx, { x: front.x, z: fz, width: front.width, height: doorTop }, getVisitor);

  // Canopy over the entrance.
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(6, 0.14, 2.2), m.light);
  canopy.position.set(0, 3.25, fz + 1.1);
  canopy.castShadow = true;
  ctx.addStatic(canopy);
  for (const x of [-2.9, 2.9]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.4), m.metal);
    rod.position.set(x, 3.95, fz + 1.4);
    rod.rotation.x = -0.9;
    ctx.addStatic(rod);
  }

  // ---------------------------------------------------------------- brand on the facade
  // Big solid sign above the entrance → corporate site.
  ctx.logo({ diameter: 1.35, style: 'solid', depth: 0.12 }, { x: 0, y: (glassTop + zE) / 2, z: fz + WALL / 2 + 0.12 });
  // Division signs on the wing facades.
  ctx.logo({ diameter: 1.1, style: 'solid', depth: 0.1, division: 'medicale' }, { x: -22, y: 2.2, z: fz + WALL / 2 + 0.1 });
  ctx.logo({ diameter: 1.6, style: 'solid', depth: 0.12, division: 'industriale' }, { x: 22, y: 4.6, z: fz + WALL / 2 + 0.12 });
  // Thin reveal lines along the wing facades.
  for (const [x0, x1, y] of [
    [-34, -10, 3.2],
    [10, 34, 6.8],
    [10, 34, 2.8],
  ]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + WALL, 0.05, 0.04), m.trim);
    r.position.set((x0 + x1) / 2, y, fz + WALL / 2 + 0.02);
    ctx.addStatic(r);
  }

  // Plaza totem: a slim slab with the logo on both faces.
  const totem = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(0.75, 3.4, 0.24), m.wallDark);
  slab.position.y = 1.7;
  slab.castShadow = slab.receiveShadow = true;
  totem.add(slab);
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 0.5), m.trim);
  base.position.y = 0.06;
  totem.add(base);
  totem.position.set(-6.5, 0, 22.5);
  totem.rotation.y = 0.35;
  totem.updateMatrixWorld(true);
  ctx.addSolid(totem, 0.05);
  ctx.addStatic(totem);
  for (const side of [1, -1]) {
    const p = new THREE.Vector3(0, 2.75, side * 0.125).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.35).add(new THREE.Vector3(-6.5, 0, 22.5));
    ctx.logo({ diameter: 0.55, style: 'flat', url: URLS.corporate, label: LABELS.corporate }, { x: p.x, y: p.y, z: p.z, rotY: 0.35 + (side < 0 ? Math.PI : 0) });
  }
}

/** Soft vertical gradient sky dome (greys), drawn behind everything. */
export function createSky(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(180, 32, 16);
  const colors: number[] = [];
  const top = new THREE.Color('#aeb3b8');
  const horizon = new THREE.Color('#e4e6e8');
  const below = new THREE.Color('#9a9da1');
  const pos = geo.getAttribute('position');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 180;
    if (y >= 0) c.copy(horizon).lerp(top, Math.pow(y, 0.6));
    else c.copy(horizon).lerp(below, Math.min(1, -y * 4));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false }));
  sky.name = 'sky';
  sky.renderOrder = -1;
  return sky;
}
