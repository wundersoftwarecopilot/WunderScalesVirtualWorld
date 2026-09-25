import * as THREE from 'three';
import { URLS, LABELS } from '../brand/urls';
import type { WorldContext } from './context';
import { slidingDoors } from './doors';
import { BUILDING, FACADE_GLASS, OPENINGS, PLAZA, WALL, ZONES } from './layout';

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
  // Plaza edges: a low kerb (0.3 m wide, inside the plaza) the visitor cannot step onto or past.
  const KERB = 0.3;
  ctx.addCollider({ minX: PLAZA.minX - 1, maxX: PLAZA.minX + KERB, minZ: PLAZA.minZ, maxZ: PLAZA.maxZ });
  ctx.addCollider({ minX: PLAZA.maxX - KERB, maxX: PLAZA.maxX + 1, minZ: PLAZA.minZ, maxZ: PLAZA.maxZ });
  ctx.addCollider({ minX: PLAZA.minX, maxX: PLAZA.maxX, minZ: PLAZA.maxZ - KERB, maxZ: PLAZA.maxZ + 1 });
  for (const [cx, cz, w, d] of [
    [PLAZA.minX + KERB / 2, (PLAZA.minZ + PLAZA.maxZ) / 2, KERB, PLAZA.maxZ - PLAZA.minZ],
    [PLAZA.maxX - KERB / 2, (PLAZA.minZ + PLAZA.maxZ) / 2, KERB, PLAZA.maxZ - PLAZA.minZ],
    [(PLAZA.minX + PLAZA.maxX) / 2, PLAZA.maxZ - KERB / 2, PLAZA.maxX - PLAZA.minX, KERB],
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
    // Ceiling light panels on a regular grid. Not in the design gallery: its own wall washers
    // and track spots light the room, and an office grid would flatten the museum mood.
    if (z.id === 'design') continue;
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
  function segment(a: number, b: number, at: number, h: number, axis: 'x' | 'z', mat: THREE.Material, y0 = 0, depth = WALL) {
    const len = b - a;
    if (len <= 0.001) return;
    const geo = axis === 'x' ? new THREE.BoxGeometry(len, h - y0, depth) : new THREE.BoxGeometry(depth, h - y0, len);
    const mesh = new THREE.Mesh(geo, mat);
    const c = (a + b) / 2;
    if (axis === 'x') mesh.position.set(c, y0 + (h - y0) / 2, at);
    else mesh.position.set(at, y0 + (h - y0) / 2, c);
    mesh.castShadow = mesh.receiveShadow = true;
    const box = new THREE.Box3().setFromCenterAndSize(mesh.position, axis === 'x' ? new THREE.Vector3(len, h - y0, depth) : new THREE.Vector3(depth, h - y0, len));
    ctx.addOccluder(box);
    if (y0 < 1.8) {
      if (axis === 'x') ctx.addCollider({ minX: a, maxX: b, minZ: at - depth / 2, maxZ: at + depth / 2 });
      else ctx.addCollider({ minX: at - depth / 2, maxX: at + depth / 2, minZ: a, maxZ: b });
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
  wallAlongZ(-10, 0, 16, zE, [{ a: toMed.z - toMed.width / 2, b: toMed.z + toMed.width / 2, top: toMed.top }]);
  wallAlongZ(10, -16, 0, zI);
  wallAlongZ(10, 0, 16, zI, [{ a: toInd.z - toInd.width / 2, b: toInd.z + toInd.width / 2, top: toInd.top }]);
  wallAlongX(0, -10, 10, zE, [{ a: toDes.x - toDes.width / 2, b: toDes.x + toDes.width / 2, top: toDes.top }]);

  // ---------------------------------------------------------------- lobby facade (z = 16)
  const fz = BUILDING.maxZ;
  const front = open('front');
  const glassTop = FACADE_GLASS.top;
  const doorTop = front.top;
  const gx0 = FACADE_GLASS.x0;
  const gx1 = FACADE_GLASS.x1;
  // The charcoal frame of the glass box stands 1 cm proud of the wing facades and of the
  // lobby's side walls (front and ends): no two different walls share a plane at the corners
  // (they z-fought there), and the step reads as a deliberate reveal.
  const PROUD = 0.01;
  const frameD = WALL + PROUD;
  const frameZ = fz + PROUD / 2;
  segment(-10 - WALL / 2 - PROUD, gx0, frameZ, zE, 'x', m.wallDark, 0, frameD);
  segment(gx1, 10 + WALL / 2 + PROUD, frameZ, zE, 'x', m.wallDark, 0, frameD);
  segment(gx0, gx1, frameZ, zE, 'x', m.wallDark, glassTop, frameD); // band above the glass (sign lives here)
  // Charcoal is the outside colour: inside, the frame is lined like the lobby's other walls
  // (above the skirting).
  const liningZ = fz - WALL / 2 - 0.004;
  for (const [x0, x1, y0] of [
    [-10 + WALL / 2, gx0, 0.08],
    [gx1, 10 - WALL / 2, 0.08],
    [gx0, gx1, glassTop],
  ]) {
    const lin = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, zE - 0.001 - y0, 0.008), m.wall);
    lin.position.set((x0 + x1) / 2, (y0 + zE - 0.001) / 2, liningZ);
    lin.receiveShadow = true;
    ctx.addStatic(lin);
  }
  const glassPane = (x0: number, x1: number, y0: number, y1: number) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, 0.03), m.glass);
    p.position.set((x0 + x1) / 2, (y0 + y1) / 2, fz);
    ctx.addStatic(p);
  };
  const dx0 = front.x - front.width / 2;
  const dx1 = front.x + front.width / 2;
  glassPane(gx0, dx0, 0, glassTop);
  glassPane(dx1, gx1, 0, glassTop);
  glassPane(dx0, dx1, doorTop + 0.22, glassTop);
  ctx.addCollider({ minX: gx0, maxX: dx0, minZ: fz - 0.15, maxZ: fz + 0.15 });
  ctx.addCollider({ minX: dx1, maxX: gx1, minZ: fz - 0.15, maxZ: fz + 0.15 });
  // Mullions and a transom.
  const mull = m.metalDark;
  for (const x of [gx0, -5.6, -4.2, -2.8, dx0, dx1, 2.8, 4.2, 5.6, gx1]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, glassTop, 0.12), mull);
    bar.position.set(x, glassTop / 2, fz);
    bar.castShadow = true;
    ctx.addStatic(bar);
  }
  for (const [x0, x1] of [
    [gx0, dx0],
    [dx1, gx1],
  ]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.07, 0.12), mull);
    t.position.set((x0 + x1) / 2, doorTop + 0.11, fz);
    ctx.addStatic(t);
  }
  slidingDoors(ctx, { x: front.x, z: fz, width: front.width, height: doorTop }, getVisitor);

  // Canopy over the entrance, hung from the band above the glass by two tie rods: each runs
  // from a wall bracket (y 4.45 on the frame face) down to a clevis on the canopy's outer edge.
  const canopyTop = 3.25 + 0.07;
  const canopyEdge = fz + 2.2;
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(6, 0.14, 2.2), m.light);
  canopy.position.set(0, 3.25, fz + 1.1);
  canopy.castShadow = true;
  ctx.addStatic(canopy);
  const wallFace = fz + WALL / 2 + PROUD;
  const rodTop = new THREE.Vector3(0, 4.45, wallFace);
  const rodEnd = new THREE.Vector3(0, canopyTop, canopyEdge - 0.1);
  const rodLen = rodTop.distanceTo(rodEnd);
  const rodTilt = Math.atan2(rodTop.z - rodEnd.z, rodTop.y - rodEnd.y); // about X, from +Y
  for (const x of [-2.9, 2.9]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, rodLen, 8), m.metal);
    rod.position.set(x, (rodTop.y + rodEnd.y) / 2, (rodTop.z + rodEnd.z) / 2);
    rod.rotation.x = rodTilt;
    rod.castShadow = true;
    ctx.addStatic(rod);
    // Wall plate and a clevis block on the canopy.
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.02), m.metal);
    plate.position.set(x, rodTop.y, wallFace + 0.01);
    ctx.addStatic(plate);
    const clevis = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.08), m.metal);
    clevis.position.set(x, canopyTop + 0.025, rodEnd.z);
    ctx.addStatic(clevis);
  }

  // ---------------------------------------------------------------- brand on the facade
  // Big solid sign above the entrance → corporate site.
  ctx.logo({ diameter: 1.35, style: 'solid', depth: 0.12 }, { x: 0, y: (glassTop + zE) / 2, z: wallFace + 0.12 });
  // Division signs on the wing facades.
  ctx.logo({ diameter: 1.1, style: 'solid', depth: 0.1, division: 'medicale' }, { x: -22, y: 2.2, z: fz + WALL / 2 + 0.1 });
  ctx.logo({ diameter: 1.6, style: 'solid', depth: 0.12, division: 'industriale' }, { x: 22, y: 4.6, z: fz + WALL / 2 + 0.12 });
  // Thin reveal lines along the wing facades, from the building corner to the lobby's frame.
  for (const [x0, x1, y] of [
    [-34 - WALL / 2, -10 - WALL / 2 - PROUD, 3.2],
    [10 + WALL / 2 + PROUD, 34 + WALL / 2, 6.8],
    [10 + WALL / 2 + PROUD, 34 + WALL / 2, 2.8],
  ]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.05, 0.04), m.trim);
    r.position.set((x0 + x1) / 2, y, fz + WALL / 2 + 0.02);
    ctx.addStatic(r);
  }
  // Wing facades: a charcoal plinth band and vertical panel joints every 1.2 m, so the long
  // light walls read as clad panels rather than blank planes.
  const face = fz + WALL / 2;
  const plinthH = 0.6;
  for (const [x0, x1, h] of [
    [-34 - WALL / 2, -10 - WALL / 2 - PROUD, zM],
    [10 + WALL / 2 + PROUD, 34 + WALL / 2, zI],
  ]) {
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, plinthH, 0.03), m.wallDark);
    plinth.position.set((x0 + x1) / 2, plinthH / 2, face + 0.015);
    plinth.receiveShadow = true;
    ctx.addStatic(plinth);
    const jointGeo = new THREE.BoxGeometry(0.018, h - plinthH, 0.008);
    for (let x = Math.ceil((x0 + 0.3) / 1.2) * 1.2; x < x1 - 0.3; x += 1.2) {
      const j = new THREE.Mesh(jointGeo, m.trim);
      j.position.set(x, plinthH + (h - plinthH) / 2, face + 0.004);
      ctx.addStatic(j);
    }
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
