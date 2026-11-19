// Marlo, the player character: a simple articulated figure (legs swing as he walks), an
// on-foot controller that moves relative to the camera, and the third-person camera rig
// that follows him on foot and in a car.
import * as THREE from 'three';
import { collideCircle } from './city.js';

export function makePlayer(scene) {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc89878, roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0xff5da2, roughness: 0.85 }); // loud Viceport shirt
  const pants = new THREE.MeshStandardMaterial({ color: 0x2c3444, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
  torso.position.y = 1.12; torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.34), skin);
  head.position.y = 1.68; head.castShadow = true;
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.36), new THREE.MeshStandardMaterial({ color: 0x1c1410 }));
  hair.position.y = 1.88;
  g.add(torso, head, hair);
  const limbs = {};
  const limbGeoL = new THREE.BoxGeometry(0.2, 0.78, 0.22);
  for (const [name, x, y, mat] of [['legL', -0.17, 0.72, pants], ['legR', 0.17, 0.72, pants], ['armL', -0.42, 1.42, shirt], ['armR', 0.42, 1.42, shirt]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const m = new THREE.Mesh(limbGeoL, mat);
    m.position.y = name.startsWith('leg') ? -0.36 : -0.3;
    m.castShadow = true;
    pivot.add(m);
    g.add(pivot);
    limbs[name] = pivot;
  }
  scene.add(g);
  return {
    mesh: g, limbs, pos: g.position, heading: 0, speedNow: 0, walkPhase: 0,
    health: 100, inCar: null, dead: false,
  };
}

export function updatePlayer(p, dt, move, colliders) {
  // move: {x, z} desired direction in world space (already camera-relative), sprint flag.
  const mag = Math.hypot(move.x, move.z);
  const speed = (move.sprint ? 8.4 : 4.6) * Math.min(1, mag);
  if (mag > 0.05) {
    p.heading = Math.atan2(move.x, move.z);
    p.pos.x += move.x / mag * speed * dt * Math.min(1, mag);
    p.pos.z += move.z / mag * speed * dt * Math.min(1, mag);
    p.walkPhase += dt * (move.sprint ? 11 : 8);
  }
  p.speedNow = mag > 0.05 ? speed : 0;
  collideCircle(p.pos, 0.55, colliders);
  p.mesh.position.copy(p.pos);
  p.mesh.rotation.y = p.heading;
  const swing = Math.sin(p.walkPhase) * (mag > 0.05 ? 0.55 : 0);
  p.limbs.legL.rotation.x = swing; p.limbs.legR.rotation.x = -swing;
  p.limbs.armL.rotation.x = -swing * 0.8; p.limbs.armR.rotation.x = swing * 0.8;
  if (mag <= 0.05) { // settle back to a stance
    for (const k in p.limbs) p.limbs[k].rotation.x *= 0.8;
  }
}

// Third-person camera: yaw/pitch orbit around a target, smoothed, with a wider and
// higher stance when driving.
export const camRig = { yaw: Math.PI, pitch: 0.32, dist: 8.5 };
export function updateCamera(camera, target, dt, driving) {
  const wantDist = driving ? 11.5 : 7.5;
  camRig.dist += (wantDist - camRig.dist) * Math.min(1, dt * 3);
  const cy = Math.cos(camRig.pitch), sy = Math.sin(camRig.pitch);
  const back = new THREE.Vector3(
    Math.sin(camRig.yaw) * cy,
    sy,
    Math.cos(camRig.yaw) * cy,
  );
  const eye = target.clone().addScaledVector(back, camRig.dist);
  eye.y = Math.max(eye.y, 1.1);
  camera.position.lerp(eye, Math.min(1, dt * (driving ? 5 : 8)));
  camera.lookAt(target.x, target.y + 1.6, target.z);
}
