// Neon Harbor — boot, game state and the main loop. Viceport is a living city: traffic
// drives the grid, cars can be stolen, and (from the police module) the law answers back.
// This file owns the state machine: menu -> playing <-> paused -> busted/wasted card.
import * as THREE from 'three';
import { createWorld } from './world.js';
import { buildCity } from './city.js';
import { makeTrafficCar, spawnParked, updateTraffic, updateDriven } from './cars.js';
import { makePlayer, updatePlayer, camRig, updateCamera } from './player.js';
import { initInput, keys, takePress, mouse, endFrame } from './input.js';
import * as hud from './hud.js';

const canvas = document.getElementById('gl');
const { renderer, scene, camera } = createWorld(canvas);
const { colliders } = buildCity(scene);
const player = makePlayer(scene);
const cars = [];
for (let i = 0; i < 14; i++) makeTrafficCar(scene, cars);
spawnParked(scene, cars, colliders);

const state = {
  mode: 'menu', // menu | playing | paused | over
  cash: 250, wanted: 0, time: 0,
  focus: player.pos, heading: 0,
  cars, peds: [], target: null,
};
player.pos.set(-30, 0, 196); // start on the harbor promenade
player.mesh.position.copy(player.pos);

initInput(canvas);
hud.initHud();

// --- Car entry / exit ------------------------------------------------------
function nearestCar(maxDist) {
  let best = null, bd = maxDist;
  for (const c of cars) {
    const d = Math.hypot(c.pos.x - player.pos.x, c.pos.z - player.pos.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function enterCar(car) {
  player.inCar = car;
  car.driver = 'player';
  car.traffic = null;
  player.mesh.visible = false;
  hud.toast(car.police ? 'You stole a police cruiser!' : 'Car stolen — it\'s yours now', 2);
}

function exitCar() {
  const car = player.inCar;
  player.inCar = null;
  car.driver = null;
  // Step out on the left side of the car.
  player.pos.set(car.pos.x + Math.cos(car.heading) * -1.8, 0, car.pos.z + Math.sin(car.heading) * 1.8);
  player.mesh.visible = true;
}

// --- Menus -----------------------------------------------------------------
const $ = (id) => document.getElementById(id);
function startGame() {
  $('menu').classList.add('hidden');
  $('endcard').classList.add('hidden');
  hud.setHudVisible(true);
  state.mode = 'playing';
  canvas.requestPointerLock?.();
}
$('btn-new').addEventListener('click', startGame);
$('btn-free').addEventListener('click', startGame);
$('btn-continue').addEventListener('click', startGame);
$('btn-resume').addEventListener('click', () => { $('pause').classList.add('hidden'); state.mode = 'playing'; canvas.requestPointerLock?.(); });
$('btn-restart').addEventListener('click', () => { $('pause').classList.add('hidden'); state.mode = 'playing'; });
$('btn-quit').addEventListener('click', () => { $('pause').classList.add('hidden'); $('menu').classList.remove('hidden'); hud.setHudVisible(false); state.mode = 'menu'; });
$('btn-again').addEventListener('click', () => { $('endcard').classList.add('hidden'); player.health = 100; state.wanted = 0; state.mode = 'playing'; hud.setHudVisible(true); });

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && state.mode === 'playing') {
    // Losing the lock (Esc) pauses, like every desktop game.
    state.mode = 'paused';
    $('pause').classList.remove('hidden');
  }
});
canvas.addEventListener('click', () => { if (state.mode === 'playing' && document.pointerLockElement !== canvas) canvas.requestPointerLock?.(); });

// --- Loop ------------------------------------------------------------------
const clock = new THREE.Clock();
const camTarget = new THREE.Vector3();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (state.mode === 'playing') {
    state.time += dt;
    // Camera orbit from the mouse.
    camRig.yaw -= mouse.dx * 0.0032;
    camRig.pitch = Math.max(0.06, Math.min(1.15, camRig.pitch + mouse.dy * 0.0026));

    if (player.inCar) {
      const car = player.inCar;
      const hit = updateDriven(car, dt, {
        forward: keys.KeyW || keys.ArrowUp, back: keys.KeyS || keys.ArrowDown,
        left: keys.KeyA || keys.ArrowLeft, right: keys.KeyD || keys.ArrowRight,
      }, colliders, cars);
      if (hit && Math.abs(car.speed) > 8) hud.toast('You rammed a car!', 1.4);
      player.pos.copy(car.pos);
      state.focus = car.pos; state.heading = car.heading;
      camTarget.copy(car.pos);
      if (takePress('KeyF')) exitCar();
      hud.showPrompt(null);
    } else {
      // On foot: move relative to the camera yaw.
      const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
      const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
      const sin = Math.sin(camRig.yaw), cos = Math.cos(camRig.yaw);
      // Forward is -(sin, cos) (from the camera toward the player); right is (cos, -sin).
      const move = {
        x: -sin * f + cos * s,
        z: -cos * f - sin * s,
        sprint: keys.ShiftLeft || keys.ShiftRight,
      };
      updatePlayer(player, dt, move, colliders);
      state.focus = player.pos; state.heading = player.heading;
      camTarget.copy(player.pos);
      const near = nearestCar(3.4);
      hud.showPrompt(near ? 'F — steal this car' : null);
      if (near && takePress('KeyF')) enterCar(near);
    }

    for (const c of cars) if (c.traffic) updateTraffic(c, dt, cars, colliders);
    updateCamera(camera, camTarget, dt, !!player.inCar);
    hud.updateStats(state.cash, player.health, player.inCar ? 'DRIVING' : 'ON FOOT');
    hud.updateWanted(state.wanted);
    hud.drawMinimap(state);
    hud.tickToast(dt); hud.tickBanner(dt);
    if (takePress('KeyP')) { state.mode = 'paused'; $('pause').classList.remove('hidden'); document.exitPointerLock?.(); }
  }
  endFrame();
  renderer.render(scene, camera);
}
frame();

// Screenshot staging + a handle for scripted captures (see shots.json in the kit).
window.neonharbor = { state, player, cars, startGame, scene, camera };
const shot = new URLSearchParams(location.search).get('shot');
if (shot) { $('menu').classList.add('hidden'); hud.setHudVisible(true); state.mode = 'playing'; }
