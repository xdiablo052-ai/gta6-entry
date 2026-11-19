// Neon Harbor — boot, game state and the main loop. Viceport is a living city: traffic
// drives the grid, pedestrians walk the kerbs, every car can be stolen, the pistol is
// always loaded, and the police answer every crime with a wanted level. Delia's five
// jobs tell the story; after them, the city keeps offering odd work.
import * as THREE from 'three';
import { createWorld } from './world.js';
import { buildCity } from './city.js';
import { makeTrafficCar, spawnParked, updateTraffic, updateDriven } from './cars.js';
import { makePlayer, updatePlayer, camRig, updateCamera } from './player.js';
import { spawnPeds, updatePed, knockDown, scarePeds } from './peds.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { initAudio, toggleMute, updateEngine, updateSiren, sfx } from './audio.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { initInput, keys, takePress, mouse, endFrame } from './input.js';
import * as hud from './hud.js';

const canvas = document.getElementById('gl');
const { renderer, scene, camera } = createWorld(canvas);
const { colliders } = buildCity(scene);
const player = makePlayer(scene);
const cars = [];
for (let i = 0; i < 14; i++) makeTrafficCar(scene, cars);
spawnParked(scene, cars, colliders);
const peds = spawnPeds(scene, 26);

const state = {
  mode: 'menu', cash: 250, time: 0, dtNow: 0,
  focus: player.pos, heading: 0,
  cars, peds, player, target: null,
  flags: { stoleCar: false },
};
player.pos.set(-30, 0, 196); // start on the harbor promenade, Delia's diner behind him
player.mesh.position.copy(player.pos);

const hooks = {
  colliders,
  onStars: (n) => { if (n > 0) hud.toast(`Wanted level ${n}`, 1.6); },
  onRamPlayer: (amt) => { if (player.inCar) player.health -= amt * state.dtNow * 3.2; },
  onBusted: () => endRun('BUSTED', 'The Viceport PD got their man.'),
  onPedDown: () => {},
  addCash: (n) => { state.cash += n; if (n > 0) sfx.coin(); },
  save: () => writeSave({ cash: state.cash, missionIndex: missions.index, done: missions.done }),
  police: null,
};
const police = createPolice(scene, cars, hooks);
hooks.police = police;
const combat = createCombat(scene, { police, onPedDown: () => {} });
const missions = createMissions(scene, state, { police, addCash: hooks.addCash, save: hooks.save });
state.missions = missions;

initInput(canvas);
hud.initHud();

// --- Cars -------------------------------------------------------------------
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
  const wasTraffic = !!car.traffic;
  car.traffic = null;
  player.mesh.visible = false;
  state.flags.stoleCar = true;
  sfx.door();
  // A steal with a witness is a crime; an empty street is a gift.
  const witnessed = peds.some((p) => Math.hypot(p.pos.x - car.pos.x, p.pos.z - car.pos.z) < 24) || police.nearest < 40;
  if (witnessed) police.reportCrime('steal');
  hud.toast(car.police ? 'You stole a police cruiser!' : wasTraffic ? 'Car jacked!' : 'Car stolen — it\'s yours now', 2);
}

function exitCar() {
  const car = player.inCar;
  player.inCar = null;
  car.driver = null;
  player.pos.set(car.pos.x + Math.cos(car.heading) * -1.9, 0, car.pos.z + Math.sin(car.heading) * 1.9);
  player.mesh.visible = true;
  sfx.door();
}

// --- Run lifecycle ------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const save0 = loadSave();
if (save0) $('btn-continue').classList.remove('hidden');

function startGame(fromSave) {
  initAudio();
  $('menu').classList.add('hidden');
  $('endcard').classList.add('hidden');
  hud.setHudVisible(true);
  state.mode = 'playing';
  if (fromSave && save0) {
    state.cash = save0.cash ?? 250;
    missions.startAt(save0.done ? 99 : (save0.missionIndex ?? 0));
    hud.toast('Welcome back to Viceport', 2.5);
  } else {
    clearSave();
    state.cash = 250;
    missions.startAt(0);
  }
  canvas.requestPointerLock?.();
}
$('btn-new').addEventListener('click', () => startGame(false));
$('btn-free').addEventListener('click', () => { initAudio(); $('menu').classList.add('hidden'); hud.setHudVisible(true); state.mode = 'playing'; missions.startAt(99); canvas.requestPointerLock?.(); });
$('btn-continue').addEventListener('click', () => startGame(true));
$('btn-resume').addEventListener('click', () => { $('pause').classList.add('hidden'); state.mode = 'playing'; hooks.save(); canvas.requestPointerLock?.(); });
$('btn-restart').addEventListener('click', () => { $('pause').classList.add('hidden'); missions.restart(); state.mode = 'playing'; canvas.requestPointerLock?.(); });
$('btn-quit').addEventListener('click', () => { $('pause').classList.add('hidden'); $('menu').classList.remove('hidden'); hud.setHudVisible(false); state.mode = 'menu'; hooks.save(); });
$('btn-again').addEventListener('click', () => { $('endcard').classList.add('hidden'); respawn(); hud.setHudVisible(true); state.mode = 'playing'; canvas.requestPointerLock?.(); });

function respawn() {
  if (player.inCar) { player.inCar.driver = null; player.inCar = null; player.mesh.visible = true; }
  player.pos.set(-30, 0, 196);
  player.health = 100;
  police.clear();
  missions.restart();
}

function endRun(title, text) {
  if (state.mode !== 'playing') return;
  state.mode = 'over';
  const fine = Math.min(state.cash, 40 + police.stars * 30);
  state.cash -= fine;
  $('end-title').textContent = title;
  $('end-text').textContent = `${text} The city takes $${fine} for its trouble.`;
  $('endcard').classList.remove('hidden');
  hud.setHudVisible(false);
  document.exitPointerLock?.();
  if (title === 'BUSTED') sfx.bust(); else sfx.fail();
  hooks.save();
}

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && state.mode === 'playing') {
    state.mode = 'paused';
    $('pause').classList.remove('hidden');
    $('save-note').textContent = 'Progress saved.';
    hooks.save();
  }
});
canvas.addEventListener('click', () => { if (state.mode === 'playing' && document.pointerLockElement !== canvas) canvas.requestPointerLock?.(); });

// --- Loop ----------------------------------------------------------------------
const clock = new THREE.Clock();
const camTarget = new THREE.Vector3();

function carHitsPeds(car, byPlayer) {
  if (Math.abs(car.speed) < 3.5) return;
  for (const p of peds) {
    if (p.state === 'down') continue;
    if (Math.hypot(p.pos.x - car.pos.x, p.pos.z - car.pos.z) < 2.3) {
      if (knockDown(p, 14)) {
        sfx.crash();
        scarePeds(peds, car.pos, 24);
        if (byPlayer) police.reportCrime('hitPed');
      }
    }
  }
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  state.dtNow = dt;
  if (state.mode === 'playing') {
    state.time += dt;
    const inDialogue = !!missions.dialogue;
    if (inDialogue && (mouse.clicked || takePress('Space') || takePress('KeyE'))) missions.advanceDialogue();

    camRig.yaw -= mouse.dx * 0.0032;
    camRig.pitch = Math.max(0.06, Math.min(1.15, camRig.pitch + mouse.dy * 0.0026));

    if (!inDialogue && player.inCar) {
      const car = player.inCar;
      const hit = updateDriven(car, dt, {
        forward: keys.KeyW || keys.ArrowUp, back: keys.KeyS || keys.ArrowDown,
        left: keys.KeyA || keys.ArrowLeft, right: keys.KeyD || keys.ArrowRight,
      }, colliders, cars);
      if (hit) { police.reportCrime('ram'); sfx.crash(); scarePeds(peds, car.pos, 18); }
      carHitsPeds(car, true);
      player.pos.copy(car.pos);
      state.focus = car.pos; state.heading = car.heading;
      camTarget.copy(car.pos);
      if (takePress('KeyF')) exitCar();
      hud.showPrompt(null);
      updateEngine(Math.abs(car.speed) / 33);
    } else if (!inDialogue) {
      const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
      const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
      const sin = Math.sin(camRig.yaw), cos = Math.cos(camRig.yaw);
      updatePlayer(player, dt, { x: -sin * f + cos * s, z: -cos * f - sin * s, sprint: keys.ShiftLeft || keys.ShiftRight }, colliders);
      state.focus = player.pos; state.heading = player.heading;
      camTarget.copy(player.pos);
      const near = nearestCar(3.4);
      hud.showPrompt(near ? 'F — steal this car' : null);
      if (near && takePress('KeyF')) enterCar(near);
      updateEngine(0);
    }

    for (const c of cars) {
      if (c.traffic) { updateTraffic(c, dt, cars, colliders); carHitsPeds(c, false); }
    }
    for (const p of peds) if (p.state !== 'stand') updatePed(p, dt, colliders);

    const focusSpeed = player.inCar ? Math.abs(player.inCar.speed) : player.speedNow;
    police.update(dt, state.focus, focusSpeed, !player.inCar);
    state.wanted = police.stars;
    combat.update(dt, camera, state, mouse.down && document.pointerLockElement === canvas && !inDialogue);
    hud.setCrosshair(!player.inCar && !inDialogue);
    missions.update(dt);

    if (player.health < 100 && police.stars === 0) player.health = Math.min(100, player.health + dt * 2.2);
    if (player.health <= 0) endRun('WASTED', 'Marlo woke up in a hospital doorway.');

    updateCamera(camera, camTarget, dt, !!player.inCar);
    hud.updateStats(state.cash, player.health, player.inCar ? 'DRIVING' : 'PISTOL — click to shoot');
    hud.updateWanted(police.stars);
    hud.drawMinimap(state);
    hud.tickToast(dt); hud.tickBanner(dt);
    updateSiren(police.nearest);
    if (takePress('KeyM')) hud.toast(toggleMute() ? 'Sound off' : 'Sound on', 1.2);
    if (takePress('KeyP')) { state.mode = 'paused'; $('pause').classList.remove('hidden'); document.exitPointerLock?.(); }
  }
  endFrame();
  renderer.render(scene, camera);
}
frame();

// Screenshot staging + a handle for scripted captures (see shots.json in the kit).
window.neonharbor = { state, player, cars, peds, police, missions, startGame, respawn, scene, camera, camRig };
const shot = new URLSearchParams(location.search).get('shot');
if (shot) { $('menu').classList.add('hidden'); hud.setHudVisible(true); state.mode = 'playing'; missions.startAt(0); }
