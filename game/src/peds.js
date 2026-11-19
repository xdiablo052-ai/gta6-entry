// Pedestrians: Viceport's walkers. They stroll the sidewalks (the kerb lines offset from
// the road grid), turn at intersections, flee from danger, and fall when a car finds them.
// A fallen pedestrian is a crime the police module hears about.
import * as THREE from 'three';
import { LINES, ROAD_HALF, CITY_EDGE, collideCircle } from './city.js';

const SHIRTS = [0xe8e4da, 0x39c2d7, 0x7dd87d, 0xffd34d, 0xc26a2e, 0x8a4ac2, 0xd84a7a, 0x4a6a8a, 0xf2f2f2];
const PANTS = [0x2c3444, 0x4a3a2c, 0x22242c, 0x5a4a5e];
const WALK = ROAD_HALF + 2.6; // sidewalk offset from a road centre line

export function makePed(scene, x, z) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: SHIRTS[(Math.random() * SHIRTS.length) | 0], roughness: 0.9 });
  const pants = new THREE.MeshStandardMaterial({ color: PANTS[(Math.random() * PANTS.length) | 0], roughness: 0.95 });
  const skin = new THREE.MeshStandardMaterial({ color: [0xc89878, 0x8a5f43, 0xe8b898, 0x6e4530][(Math.random() * 4) | 0], roughness: 0.8 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.66, 0.3), shirt);
  torso.position.y = 1.06; torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.3), skin);
  head.position.y = 1.56;
  g.add(torso, head);
  const limbs = {};
  for (const [name, lx, ly, mat] of [['legL', -0.15, 0.68, pants], ['legR', 0.15, 0.68, pants], ['armL', -0.38, 1.34, shirt], ['armR', 0.38, 1.34, shirt]]) {
    const pivot = new THREE.Group();
    pivot.position.set(lx, ly, 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.7, 0.19), mat);
    m.position.y = -0.32;
    pivot.add(m); g.add(pivot);
    limbs[name] = pivot;
  }
  g.position.set(x, 0, z);
  scene.add(g);
  // Sidewalk route: walk along one road line at the kerb offset, on a random side.
  const axis = Math.random() < 0.5 ? 'x' : 'z';
  const line = LINES[(Math.random() * LINES.length) | 0];
  const side = Math.random() < 0.5 ? -1 : 1;
  return {
    mesh: g, limbs, pos: g.position, heading: Math.random() * Math.PI * 2,
    axis, line, side, dir: Math.random() < 0.5 ? 1 : -1,
    speed: 1.5 + Math.random() * 0.9, phase: Math.random() * 9,
    state: 'walk', // walk | flee | down
    downTimer: 0, fleeFrom: null,
  };
}

export function spawnPeds(scene, n = 26) {
  const peds = [];
  for (let i = 0; i < n; i++) {
    const x = (Math.random() * 2 - 1) * (CITY_EDGE - 24);
    const z = (Math.random() * 2 - 1) * (CITY_EDGE - 24);
    peds.push(makePed(scene, x, z));
  }
  return peds;
}

export function scarePeds(peds, fromPos, radius = 26) {
  for (const p of peds) {
    if (p.state !== 'walk') continue;
    if (Math.hypot(p.pos.x - fromPos.x, p.pos.z - fromPos.z) < radius) {
      p.state = 'flee'; p.fleeFrom = fromPos;
    }
  }
}

export function updatePed(p, dt, colliders) {
  if (p.state === 'down') {
    p.downTimer -= dt;
    p.mesh.rotation.x = Math.max(-Math.PI / 2, p.mesh.rotation.x - dt * 6);
    if (p.downTimer <= 0) { // the city quietly clears the sidewalk; he walks again elsewhere
      p.state = 'walk';
      p.mesh.rotation.x = 0;
      p.pos.set((Math.random() * 2 - 1) * (CITY_EDGE - 30), 0, (Math.random() * 2 - 1) * (CITY_EDGE - 30));
    }
    return;
  }
  let vx = 0, vz = 0;
  if (p.state === 'flee') {
    const dx = p.pos.x - p.fleeFrom.x, dz = p.pos.z - p.fleeFrom.z;
    const d = Math.hypot(dx, dz) || 1;
    vx = (dx / d) * 4.6; vz = (dz / d) * 4.6;
    if (d > 34) p.state = 'walk';
  } else {
    // Follow the kerb: along the current axis, pinned to line + side * WALK on the cross axis.
    if (p.axis === 'x') {
      p.pos.z += ((p.line + p.side * WALK) - p.pos.z) * Math.min(1, dt * 3);
      vx = p.dir * p.speed;
      // Turn or flip at an intersection or the city edge.
      const near = LINES.find((l) => Math.abs(p.pos.x - l) < 1.4);
      if ((near !== undefined && Math.random() < 0.006) || Math.abs(p.pos.x) > CITY_EDGE - 6) {
        if (near !== undefined && Math.random() < 0.5) { p.axis = 'z'; p.line = near; p.pos.x = near + p.side * WALK; }
        else p.dir *= -1;
      }
    } else {
      p.pos.x += ((p.line + p.side * WALK) - p.pos.x) * Math.min(1, dt * 3);
      vz = p.dir * p.speed;
      const near = LINES.find((l) => Math.abs(p.pos.z - l) < 1.4);
      if ((near !== undefined && Math.random() < 0.006) || Math.abs(p.pos.z) > CITY_EDGE - 6) {
        if (near !== undefined && Math.random() < 0.5) { p.axis = 'x'; p.line = near; p.pos.z = near + p.side * WALK; }
        else p.dir *= -1;
      }
    }
  }
  p.pos.x += vx * dt; p.pos.z += vz * dt;
  if (vx || vz) p.heading = Math.atan2(vx, vz);
  collideCircle(p.pos, 0.45, colliders);
  p.mesh.position.copy(p.pos);
  p.mesh.rotation.y = p.heading;
  p.phase += dt * (p.state === 'flee' ? 13 : 7.5);
  const sw = Math.sin(p.phase) * 0.5;
  p.limbs.legL.rotation.x = sw; p.limbs.legR.rotation.x = -sw;
  p.limbs.armL.rotation.x = -sw * 0.7; p.limbs.armR.rotation.x = sw * 0.7;
}

export function knockDown(p, seconds = 14) {
  if (p.state === 'down') return false;
  p.state = 'down';
  p.downTimer = seconds;
  return true;
}
