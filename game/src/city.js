// Viceport: a 5x5-block dusk city on a harbor. Builds the ground, water, road grid,
// buildings with lit-window canvas facades, neon signs, palms and streetlights, and hands
// back the collision boxes and the road network the traffic system drives on.
import * as THREE from 'three';

export const PITCH = 84;          // block (64) + road (20) + kerb
export const ROAD_HALF = 10;
export const LINES = [-168, -84, 0, 84, 168]; // road centre lines on both axes
export const CITY_EDGE = 214;     // outer kerb of the ring road
export const HARBOR_Z = 252;      // water starts south of here

const rand = (a, b) => a + Math.random() * (b - a);

function facadeTexture(base, litRatio, neon) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  for (let y = 10; y < 240; y += 22) for (let x = 10; x < 118; x += 20) {
    const lit = Math.random() < litRatio;
    g.fillStyle = lit ? (Math.random() < 0.25 ? '#ffd9a0' : '#ffeec2') : '#141824';
    g.fillRect(x, y, 12, 14);
  }
  if (neon) {
    g.fillStyle = neon; g.fillRect(0, 226, 128, 30);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 226, 128, 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function signTexture(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#0a0a12'; g.fillRect(0, 0, 256, 64);
  g.font = 'bold 40px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 18; g.fillStyle = color;
  g.fillText(text, 128, 34); g.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const FACADE_BASES = ['#3a3f52', '#4a3a48', '#2f4256', '#54453a', '#3d3150', '#2c3a3a'];
const NEON = ['#ff5da2', '#39c2d7', '#ffd34d', '#7dd87d', '#ff8a4a'];
const SIGNS = ['HOTEL SOL', 'BAR LUNA', 'CLUB NOVA', 'DINER 24H', 'VICE GYM', 'PAWN ★', 'HOTEL SOL', 'BAR LUNA', 'NOODLE+', 'CINEMA', 'LIQUOR'];

export function buildCity(scene) {
  const colliders = []; // {minX, maxX, minZ, maxZ}
  const group = new THREE.Group();
  scene.add(group);

  // Ground slab + sidewalks tint, then water.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_EDGE * 2 + 90, CITY_EDGE * 2 + 90),
    new THREE.MeshStandardMaterial({ color: 0x43464a, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.receiveShadow = true;
  group.add(ground);

  // Pavement pads under every block and a boardwalk band along the harbor, so the city
  // reads as built ground instead of one flat slab.
  const padMat = new THREE.MeshStandardMaterial({ color: 0x5d6066, roughness: 1 });
  for (let i = 0; i < LINES.length - 1; i++) for (let j = 0; j < LINES.length - 1; j++) {
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(PITCH - ROAD_HALF * 2 + 6, PITCH - ROAD_HALF * 2 + 6), padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set((LINES[i] + LINES[i + 1]) / 2, 0.005, (LINES[j] + LINES[j + 1]) / 2);
    pad.receiveShadow = true;
    group.add(pad);
  }
  const walk = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_EDGE * 2 + 90, HARBOR_Z - CITY_EDGE - 4),
    new THREE.MeshStandardMaterial({ color: 0x77664e, roughness: 1 }),
  );
  walk.rotation.x = -Math.PI / 2;
  walk.position.set(0, 0.005, (CITY_EDGE + HARBOR_Z) / 2 + 2);
  walk.receiveShadow = true;
  group.add(walk);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(2600, 1500),
    new THREE.MeshStandardMaterial({ color: 0x14384e, roughness: 0.35, metalness: 0.55 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.6, HARBOR_Z + 750);
  group.add(water);
  const quay = new THREE.Mesh(new THREE.BoxGeometry(CITY_EDGE * 2 + 90, 2.4, 10), new THREE.MeshStandardMaterial({ color: 0x6a6f66 }));
  quay.position.set(0, 0.4, HARBOR_Z - 2);
  group.add(quay);

  // Roads: dark strips along every line, with dashed centre paint.
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x23242c, roughness: 0.95 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c98a });
  for (const c of LINES) {
    for (const [w, d, x, z] of [[ROAD_HALF * 2, CITY_EDGE * 2 + 40, c, 0], [CITY_EDGE * 2 + 40, ROAD_HALF * 2, 0, c]]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
      road.rotation.x = -Math.PI / 2; road.position.set(x, 0.01, z); road.receiveShadow = true;
      group.add(road);
    }
    for (let t = -CITY_EDGE + 8; t < CITY_EDGE - 8; t += 12) {
      if (LINES.some((l) => Math.abs(t - l) < 15)) continue;
      for (const [x, z, ry] of [[c, t, 0], [t, c, Math.PI / 2]]) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5), dashMat);
        dash.rotation.x = -Math.PI / 2; dash.rotation.z = ry; dash.position.set(x, 0.03, z);
        group.add(dash);
      }
    }
  }

  // Buildings: one or four towers per block, set back from the kerb.
  const signSpots = [];
  for (let i = 0; i < LINES.length - 1; i++) for (let j = 0; j < LINES.length - 1; j++) {
    const cx = (LINES[i] + LINES[i + 1]) / 2, cz = (LINES[j] + LINES[j + 1]) / 2;
    const quarters = Math.random() < 0.45 ? [[0, 0]] : [[-16, -16], [16, -16], [-16, 16], [16, 16]];
    for (const [ox, oz] of quarters) {
      const w = quarters.length === 1 ? rand(34, 44) : rand(20, 27);
      const d = quarters.length === 1 ? rand(34, 44) : rand(20, 27);
      const h = rand(14, 58) * (Math.abs(cx) < 50 && Math.abs(cz) < 50 ? 1.35 : 1);
      const base = FACADE_BASES[(Math.random() * FACADE_BASES.length) | 0];
      const neon = Math.random() < 0.3 ? NEON[(Math.random() * NEON.length) | 0] : null;
      const tex = facadeTexture(base, rand(0.3, 0.62), neon);
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
      const roof = new THREE.MeshStandardMaterial({ color: 0x1c1e26, roughness: 1 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [mat, mat, roof, roof, mat, mat]);
      b.position.set(cx + ox, h / 2, cz + oz);
      b.castShadow = true; b.receiveShadow = true;
      group.add(b);
      colliders.push({ minX: cx + ox - w / 2, maxX: cx + ox + w / 2, minZ: cz + oz - d / 2, maxZ: cz + oz + d / 2 });
      if (neon && signSpots.length < SIGNS.length * 2) signSpots.push({ x: cx + ox, z: cz + oz, w, h, neon });
    }
  }

  // Neon signs on a few towers, facing the nearest street.
  SIGNS.forEach((text, idx) => {
    const s = signSpots[idx * 2 % signSpots.length];
    if (!s) return;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(17, 4.2),
      new THREE.MeshBasicMaterial({ map: signTexture(text, s.neon), transparent: false }),
    );
    sign.position.set(s.x, Math.min(s.h - 3, 13), s.z + s.w / 2 + 0.15);
    group.add(sign);
    const glow = new THREE.PointLight(s.neon, 12, 26, 1.8);
    glow.position.set(s.x, Math.min(s.h - 3, 13), s.z + s.w / 2 + 3);
    group.add(glow);
  });

  // Palms along the harbor promenade + scattered streetlights.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2e7a4a, roughness: 1 });
  for (let x = -CITY_EDGE + 14; x < CITY_EDGE; x += 28) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 6.4, 5), trunkMat);
    trunk.position.set(x, 3.2, HARBOR_Z - 12); trunk.rotation.z = rand(-0.07, 0.07); trunk.castShadow = true;
    group.add(trunk);
    for (let f = 0; f < 6; f++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.5, 4.6, 4), frondMat);
      const a = (f / 6) * Math.PI * 2;
      frond.position.set(x + Math.cos(a) * 1.7, 6.9, HARBOR_Z - 12 + Math.sin(a) * 1.7);
      frond.rotation.set(Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15);
      group.add(frond);
    }
  }
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x22242c });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  for (const lx of LINES) for (let t = -CITY_EDGE + 20; t < CITY_EDGE; t += 42) {
    for (const [x, z] of [[lx + ROAD_HALF + 1.5, t], [t, lx + ROAD_HALF + 1.5]]) {
      if (Math.abs(x) > CITY_EDGE || Math.abs(z) > CITY_EDGE) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.6, 5), lampMat);
      pole.position.set(x, 2.8, z);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), bulbMat);
      bulb.position.set(x, 5.7, z);
      group.add(pole, bulb);
    }
  }

  return { colliders, group };
}

// Circle vs building AABBs: push the circle out along the smaller penetration axis.
export function collideCircle(pos, radius, colliders) {
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2), push = (radius - d);
        pos.x += (dx / d) * push; pos.z += (dz / d) * push;
      } else {
        // Centre inside the box: exit through the nearest face.
        const left = pos.x - c.minX, right = c.maxX - pos.x, top = pos.z - c.minZ, bot = c.maxZ - pos.z;
        const m = Math.min(left, right, top, bot);
        if (m === left) pos.x = c.minX - radius; else if (m === right) pos.x = c.maxX + radius;
        else if (m === top) pos.z = c.minZ - radius; else pos.z = c.maxZ + radius;
      }
    }
  }
  pos.x = Math.max(-CITY_EDGE - 16, Math.min(CITY_EDGE + 16, pos.x));
  pos.z = Math.max(-CITY_EDGE - 16, Math.min(HARBOR_Z - 8, pos.z));
}
