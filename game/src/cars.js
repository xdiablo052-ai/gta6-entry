// Cars: one factory for every vehicle in Viceport (traffic, parked, police, the one the
// player is driving), an arcade driving model, and traffic that follows the road grid on
// right-hand lanes, turning at intersections and queuing behind each other.
import * as THREE from 'three';
import { LINES, ROAD_HALF, CITY_EDGE, collideCircle } from './city.js';

const PAINTS = [0xc23b2e, 0x2e6ac2, 0xe8b64c, 0x3fae6a, 0xe8e4da, 0x8a4ac2, 0x22242c, 0xc26a2e, 0x4ac2b0, 0xd84a7a, 0x9fb4c2];
let nextId = 1;

export function makeCar(scene, opts = {}) {
  const police = !!opts.police;
  const color = police ? 0xf0f0f4 : (opts.color ?? PAINTS[(Math.random() * PAINTS.length) | 0]);
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x10141f, roughness: 0.15, metalness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.3), paint);
  body.position.y = 0.62; body.castShadow = true;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 2.2), glass);
  cabin.position.set(0, 1.18, -0.2); cabin.castShadow = true;
  g.add(body, cabin);
  if (police) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.3, 4.32), new THREE.MeshStandardMaterial({ color: 0x1c2f6e, roughness: 0.4 }));
    stripe.position.y = 0.62; g.add(stripe);
    const bar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    red.position.set(-0.32, 0.1, 0);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: 0x2a5aff }));
    blue.position.set(0.32, 0.1, 0);
    bar.add(red, blue); bar.position.set(0, 1.5, -0.2);
    g.add(bar);
    g.userData.lightbar = bar;
  }
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.9 });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.36, z);
    g.add(w); wheels.push(w);
  }
  const hl = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 0.06), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  hl.position.set(0, 0.68, 2.16); g.add(hl);
  const tl = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.14, 0.06), new THREE.MeshBasicMaterial({ color: 0xff3a30 }));
  tl.position.set(0, 0.7, -2.16); g.add(tl);
  scene.add(g);
  return {
    id: nextId++, mesh: g, wheels, police,
    pos: g.position, heading: opts.heading ?? 0,
    speed: 0, steer: 0, driver: null, broken: 0,
    traffic: null, // {axis, dir, lane} when AI-driven
  };
}

export function placeCar(car, x, z, heading) {
  car.pos.set(x, 0, z);
  car.heading = heading;
  car.mesh.rotation.y = heading;
}

// --- Traffic -------------------------------------------------------------
const LANE = 5; // right-hand lane offset from the road centre line
export function makeTrafficCar(scene, cars) {
  const car = makeCar(scene);
  const axis = Math.random() < 0.5 ? 'x' : 'z';
  const dir = Math.random() < 0.5 ? 1 : -1;
  const line = LINES[(Math.random() * LINES.length) | 0];
  const along = (Math.random() * 2 - 1) * (CITY_EDGE - 20);
  car.traffic = { axis, dir, line, cruise: 10 + Math.random() * 5 };
  if (axis === 'x') car.pos.x = along; else car.pos.z = along;
  fixLane(car);
  cars.push(car);
  return car;
}

function fixLane(car) {
  // Right-hand traffic. Movement uses (sin h, cos h), so +x travel is h=+PI/2, +z is h=0.
  const t = car.traffic;
  if (t.axis === 'x') {
    car.pos.z = t.line + (t.dir > 0 ? LANE : -LANE);
    car.heading = t.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    car.pos.x = t.line + (t.dir > 0 ? -LANE : LANE);
    car.heading = t.dir > 0 ? 0 : Math.PI;
  }
  car.mesh.rotation.y = car.heading;
}

function maybeTurn(car) {
  const t = car.traffic;
  const cross = t.axis === 'x' ? car.pos.x : car.pos.z;
  for (const l of LINES) {
    if (Math.abs(cross - l) < 1.2 && Math.random() < 0.012) {
      t.axis = t.axis === 'x' ? 'z' : 'x';
      t.line = l;
      t.dir = Math.random() < 0.5 ? 1 : -1;
      fixLane(car);
      return;
    }
  }
}

export function updateTraffic(car, dt, cars, colliders) {
  const t = car.traffic;
  let target = t.cruise;
  // Slow for a car ahead in the same lane.
  for (const o of cars) {
    if (o === car) continue;
    const ahead = t.axis === 'x' ? (o.pos.x - car.pos.x) * t.dir : (o.pos.z - car.pos.z) * t.dir;
    const side = t.axis === 'x' ? Math.abs(o.pos.z - car.pos.z) : Math.abs(o.pos.x - car.pos.x);
    if (ahead > 0 && ahead < 9 && side < 2.4) { target = Math.min(target, o.speed * 0.92); if (ahead < 5) target = 0; }
  }
  car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), 9 * dt);
  const step = car.speed * dt * t.dir;
  if (t.axis === 'x') car.pos.x += step; else car.pos.z += step;
  // Wrap at the city edge: turn around onto the same road.
  const along = t.axis === 'x' ? car.pos.x : car.pos.z;
  if (Math.abs(along) > CITY_EDGE + 6) {
    t.dir *= -1;
    if (t.axis === 'x') car.pos.x = Math.sign(along) * (CITY_EDGE + 4); else car.pos.z = Math.sign(along) * (CITY_EDGE + 4);
    fixLane(car);
  }
  maybeTurn(car);
  car.mesh.rotation.y = car.heading;
  spinWheels(car, dt);
}

export function spinWheels(car, dt) {
  const w = (car.speed * dt) / 0.36;
  for (const wheel of car.wheels) wheel.rotation.x += w;
}

// --- The player's driving model ------------------------------------------
export function updateDriven(car, dt, input, colliders, cars) {
  const ACCEL = 15, MAXF = 33, MAXR = 11;
  if (input.forward) car.speed += ACCEL * dt;
  else if (input.back) car.speed -= (car.speed > 0.5 ? 22 : 8) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 4.5 * dt);
  car.speed -= car.speed * 0.35 * dt; // drag
  car.speed = Math.max(-MAXR, Math.min(MAXF, car.speed));
  const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  car.steer += (steerTarget * 0.55 - car.steer) * Math.min(1, dt * 7);
  const grip = Math.min(1, Math.abs(car.speed) / 6);
  car.heading += car.steer * grip * (car.speed >= 0 ? 1 : -1) * dt * 1.55;
  car.pos.x += Math.sin(car.heading) * car.speed * dt;
  car.pos.z += Math.cos(car.heading) * car.speed * dt;
  collideCircle(car.pos, 2.1, colliders);
  // Bump other cars: push them, trade a little speed, remember the hit for crime logic.
  let hit = null;
  for (const o of cars) {
    if (o === car) continue;
    const dx = car.pos.x - o.pos.x, dz = car.pos.z - o.pos.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < 16 && d2 > 0.001) {
      const d = Math.sqrt(d2), push = (4 - d) / 2;
      car.pos.x += (dx / d) * push; car.pos.z += (dz / d) * push;
      o.pos.x -= (dx / d) * push; o.pos.z -= (dz / d) * push;
      if (Math.abs(car.speed) > 4) { hit = o; o.broken = Math.min(1, (o.broken || 0) + 0.35); }
      car.speed *= 0.72;
    }
  }
  car.mesh.rotation.y = car.heading;
  spinWheels(car, dt);
  return hit;
}

export function spawnParked(scene, cars, colliders) {
  // Parked cars tucked against kerbs on random blocks — the stealable stock of Viceport.
  for (let n = 0; n < 16; n++) {
    const line = LINES[(Math.random() * LINES.length) | 0];
    const along = (Math.random() * 2 - 1) * (CITY_EDGE - 30);
    const vertical = Math.random() < 0.5;
    const car = makeCar(scene);
    if (vertical) placeCar(car, line + ROAD_HALF - 2.2, along, 0);
    else placeCar(car, along, line + ROAD_HALF - 2.2, Math.PI / 2);
    cars.push(car);
  }
}
