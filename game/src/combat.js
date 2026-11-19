// The pistol: hitscan from the camera through the crosshair, a tracer that fades in a
// blink, pedestrians who fall, cars that spark. Fired only on foot with the pointer
// locked; every shot is a crime the whole street hears.
import * as THREE from 'three';
import { knockDown, scarePeds } from './peds.js';
import { sfx } from './audio.js';

export function createCombat(scene, hooks) {
  let cooldown = 0;
  const tracers = [];
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.9 });

  function fire(camera, state) {
    const origin = camera.position.clone();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    let bestT = 70, bestPed = null, bestCar = null;
    // Pedestrians: distance from their chest point to the ray.
    for (const p of state.peds) {
      if (p.state === 'down') continue;
      const chest = new THREE.Vector3(p.pos.x, 1.1, p.pos.z);
      const to = chest.clone().sub(origin);
      const t = to.dot(dir);
      if (t < 0 || t > bestT) continue;
      const closest = origin.clone().addScaledVector(dir, t);
      if (closest.distanceTo(chest) < 1.05) { bestT = t; bestPed = p; bestCar = null; }
    }
    // Cars: a generous sphere at the body centre.
    for (const c of state.cars) {
      if (state.player.inCar === c) continue;
      const centre = new THREE.Vector3(c.pos.x, 0.8, c.pos.z);
      const to = centre.clone().sub(origin);
      const t = to.dot(dir);
      if (t < 0 || t > bestT) continue;
      const closest = origin.clone().addScaledVector(dir, t);
      if (closest.distanceTo(centre) < 2.5) { bestT = t; bestCar = c; bestPed = null; }
    }
    const end = origin.clone().addScaledVector(dir, bestPed || bestCar ? bestT : 70);
    const geo = new THREE.BufferGeometry().setFromPoints([origin.clone().addScaledVector(dir, 1.2), end]);
    const line = new THREE.Line(geo, tracerMat.clone());
    scene.add(line);
    tracers.push({ line, life: 0.06 });
    sfx.shot();
    hooks.police.reportCrime('shot');
    scarePeds(state.peds, state.player.pos, 30);
    if (bestPed) {
      knockDown(bestPed, 16);
      hooks.police.reportCrime('shootPed');
      hooks.onPedDown(bestPed);
    } else if (bestCar) {
      bestCar.broken = Math.min(1, (bestCar.broken || 0) + 0.4);
      sfx.hit();
    }
  }

  return {
    update(dt, camera, state, wantFire) {
      cooldown -= dt;
      for (let i = tracers.length - 1; i >= 0; i--) {
        tracers[i].life -= dt;
        tracers[i].line.material.opacity = Math.max(0, tracers[i].life / 0.06) * 0.9;
        if (tracers[i].life <= 0) { scene.remove(tracers[i].line); tracers.splice(i, 1); }
      }
      if (wantFire && cooldown <= 0 && !state.player.inCar) {
        cooldown = 0.22;
        fire(camera, state);
      }
    },
  };
}
