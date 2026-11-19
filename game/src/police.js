// The law: a wanted level fed by reported crimes, police cruisers that spawn on the ring
// roads and run a pursuit steering model, a bust meter when they corner Marlo on foot,
// and heat that cools when every cruiser loses sight of him.
import { makeCar, placeCar, spinWheels } from './cars.js';
import { LINES, CITY_EDGE, collideCircle } from './city.js';

const CRIME_STARS = { steal: 1, ram: 1, hitPed: 2, shot: 1, shootPed: 2, missionHeat: 1 };
const CRIME_COOLDOWN = { steal: 2, ram: 1.2, hitPed: 1, shot: 0.9, shootPed: 1, missionHeat: 5 };

export function createPolice(scene, cars, hooks) {
  const cops = [];
  const cooldowns = {};
  const P = {
    stars: 0, bustMeter: 0, hiddenFor: 0, nearest: Infinity,

    reportCrime(kind) {
      const now = performance.now() / 1000;
      if (cooldowns[kind] && now - cooldowns[kind] < (CRIME_COOLDOWN[kind] ?? 1)) return;
      cooldowns[kind] = now;
      const before = P.stars;
      P.stars = Math.min(5, P.stars + (CRIME_STARS[kind] ?? 1));
      P.hiddenFor = 0;
      if (P.stars > before) hooks.onStars(P.stars);
    },

    setStars(n) { P.stars = Math.max(0, Math.min(5, n)); P.hiddenFor = 0; },
    clear() {
      P.stars = 0; P.bustMeter = 0; P.hiddenFor = 0;
      for (const c of cops) { scene.remove(c.mesh); const i = cars.indexOf(c); if (i >= 0) cars.splice(i, 1); }
      cops.length = 0;
    },

    update(dt, focus, focusSpeed, onFoot) {
      // Spawn up to stars+1 cruisers, arriving from the ring roads.
      const want = P.stars > 0 ? Math.min(5, P.stars + 1) : 0;
      if (cops.length < want) {
        const line = LINES[(Math.random() * LINES.length) | 0];
        const vertical = Math.random() < 0.5;
        const edge = (Math.random() < 0.5 ? -1 : 1) * (CITY_EDGE - 6);
        const cop = makeCar(scene, { police: true });
        if (vertical) placeCar(cop, line, edge, edge > 0 ? Math.PI : 0);
        else placeCar(cop, edge, line, edge > 0 ? -Math.PI / 2 : Math.PI / 2);
        cop.traffic = null;
        cars.push(cop); cops.push(cop);
      }
      P.nearest = Infinity;
      let anySight = false;
      const flash = (performance.now() % 460) < 230;
      for (let i = cops.length - 1; i >= 0; i--) {
        const cop = cops[i];
        if (P.stars === 0) { // heat is gone: they peel off and despawn at range
          if (Math.hypot(cop.pos.x - focus.x, cop.pos.z - focus.z) > 60) {
            scene.remove(cop.mesh);
            const ix = cars.indexOf(cop); if (ix >= 0) cars.splice(ix, 1);
            cops.splice(i, 1);
          }
          continue;
        }
        const dx = focus.x - cop.pos.x, dz = focus.z - cop.pos.z;
        const dist = Math.hypot(dx, dz);
        P.nearest = Math.min(P.nearest, dist);
        if (dist < 75) anySight = true;
        // Pursuit steering: turn toward the target at a limited rate, drive hard.
        const wantHeading = Math.atan2(dx, dz);
        let turn = wantHeading - cop.heading;
        while (turn > Math.PI) turn -= Math.PI * 2;
        while (turn < -Math.PI) turn += Math.PI * 2;
        cop.heading += Math.max(-1.9 * dt, Math.min(1.9 * dt, turn));
        const topSpeed = 35.5 - Math.min(2.5, Math.abs(turn) * 1.6);
        cop.speed += Math.sign(topSpeed - cop.speed) * Math.min(Math.abs(topSpeed - cop.speed), 13 * dt);
        cop.pos.x += Math.sin(cop.heading) * cop.speed * dt;
        cop.pos.z += Math.cos(cop.heading) * cop.speed * dt;
        collideCircle(cop.pos, 2.1, hooks.colliders);
        cop.mesh.rotation.y = cop.heading;
        spinWheels(cop, dt);
        const bar = cop.mesh.userData.lightbar;
        if (bar) { bar.children[0].material.color.setHex(flash ? 0xff2a2a : 0x551111); bar.children[1].material.color.setHex(flash ? 0x112255 : 0x2a5aff); }
        // Contact with the player's car: shove and wear him down.
        if (!onFoot && dist < 4.1) {
          hooks.onRamPlayer(Math.abs(cop.speed) * 0.14);
          cop.speed *= 0.9;
        }
      }
      // Bust: cornered on foot with a cruiser alongside.
      if (onFoot && P.stars > 0 && P.nearest < 6.5) {
        P.bustMeter += dt;
        if (P.bustMeter > 2.2) hooks.onBusted();
      } else {
        P.bustMeter = Math.max(0, P.bustMeter - dt * 1.6);
      }
      // Cooling off: unseen long enough, a star falls away.
      if (P.stars > 0) {
        if (!anySight) {
          P.hiddenFor += dt;
          if (P.hiddenFor > 6) { P.stars -= 1; P.hiddenFor = 0; hooks.onStars(P.stars); }
        } else P.hiddenFor = 0;
      }
      return P.nearest;
    },
  };
  return P;
}
