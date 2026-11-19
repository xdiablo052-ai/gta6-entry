// HUD: cash/health/weapon readouts, wanted stars, mission card, dialogue box, toasts and
// the round minimap (roads, water, blips for the player, police, traffic and the mission
// target, rotated so the player's heading is up).
import { LINES, CITY_EDGE, HARBOR_Z } from './city.js';

const $ = (id) => document.getElementById(id);
const els = {};
export function initHud() {
  for (const id of ['hud', 'cash', 'healthfill', 'weapon', 'wanted', 'mission', 'mission-title', 'mission-text', 'mission-dist', 'dialogue', 'dlg-name', 'dlg-text', 'toast', 'prompt', 'banner', 'crosshair']) els[id] = $(id);
  els.mm = $('minimap').getContext('2d');
}

export function setHudVisible(v) { els.hud.classList.toggle('hidden', !v); }
export function setCrosshair(v) { els.crosshair.classList.toggle('hidden', !v); }

export function updateStats(cash, health, weaponText) {
  els.cash.textContent = '$' + cash.toLocaleString('en-US');
  els.healthfill.style.width = Math.max(0, Math.min(100, health)) + '%';
  els.weapon.textContent = weaponText || '';
}

export function updateWanted(stars) {
  let html = '';
  for (let i = 0; i < 5; i++) html += `<span class="${i < stars ? '' : 'off'}">★</span>`;
  els.wanted.innerHTML = html;
}

export function showMission(title, text, distText) {
  els.mission.classList.remove('hidden');
  els['mission-title'].textContent = title;
  els['mission-text'].textContent = text;
  els['mission-dist'].textContent = distText || '';
}
export function hideMission() { els.mission.classList.add('hidden'); }

let toastTimer = 0;
export function toast(text, secs = 3) {
  els.toast.textContent = text;
  els.toast.classList.remove('hidden');
  toastTimer = secs;
}
export function tickToast(dt) {
  if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) els.toast.classList.add('hidden'); }
}

export function showPrompt(text) {
  if (text) { els.prompt.textContent = text; els.prompt.classList.remove('hidden'); }
  else els.prompt.classList.add('hidden');
}

let bannerTimer = 0;
export function banner(text, red = false, secs = 2.4) {
  els.banner.textContent = text;
  els.banner.classList.toggle('red', red);
  els.banner.classList.remove('hidden');
  bannerTimer = secs;
}
export function tickBanner(dt) {
  if (bannerTimer > 0) { bannerTimer -= dt; if (bannerTimer <= 0) els.banner.classList.add('hidden'); }
}

export function showDialogue(name, text) {
  els.dialogue.classList.remove('hidden');
  els['dlg-name'].textContent = name;
  els['dlg-text'].textContent = text;
}
export function hideDialogue() { els.dialogue.classList.add('hidden'); }

// Minimap: world -> map with the player's heading up. Range ~150 units.
const MM_R = 108, MM_RANGE = 150;
export function drawMinimap(state) {
  const g = els.mm, p = state.focus;
  g.clearRect(0, 0, 216, 216);
  g.save();
  g.beginPath(); g.arc(MM_R, MM_R, MM_R, 0, Math.PI * 2); g.clip();
  g.fillStyle = '#232733'; g.fillRect(0, 0, 216, 216);
  const cos = Math.cos(-state.heading), sin = Math.sin(-state.heading);
  const toMap = (wx, wz) => {
    const dx = (wx - p.x) / MM_RANGE * MM_R, dz = (wz - p.z) / MM_RANGE * MM_R;
    return [MM_R + dx * cos - dz * sin, MM_R + dx * sin + dz * cos];
  };
  // Water south.
  g.fillStyle = '#14384e';
  const [wx1, wz1] = toMap(-CITY_EDGE - 60, HARBOR_Z); const [wx2, wz2] = toMap(CITY_EDGE + 60, HARBOR_Z + 400);
  g.fillRect(Math.min(wx1, wx2), Math.min(wz1, wz2), Math.abs(wx2 - wx1), Math.abs(wz2 - wz1));
  // Roads.
  g.strokeStyle = '#3d4152'; g.lineWidth = 9;
  for (const l of LINES) {
    let [ax, az] = toMap(l, -CITY_EDGE - 20); let [bx, bz] = toMap(l, CITY_EDGE + 20);
    g.beginPath(); g.moveTo(ax, az); g.lineTo(bx, bz); g.stroke();
    [ax, az] = toMap(-CITY_EDGE - 20, l); [bx, bz] = toMap(CITY_EDGE + 20, l);
    g.beginPath(); g.moveTo(ax, az); g.lineTo(bx, bz); g.stroke();
  }
  const blip = (wx, wz, color, r) => {
    const [x, y] = toMap(wx, wz);
    if (x < -6 || y < -6 || x > 222 || y > 222) return;
    g.fillStyle = color; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  };
  for (const c of state.cars) {
    if (c.police) blip(c.pos.x, c.pos.z, (performance.now() % 700 < 350) ? '#ff4a4a' : '#4a7aff', 3.4);
    else blip(c.pos.x, c.pos.z, 'rgba(200,205,220,.5)', 2);
  }
  for (const ped of state.peds) blip(ped.pos.x, ped.pos.z, 'rgba(220,190,150,.55)', 1.8);
  if (state.target) {
    const [tx, ty] = toMap(state.target.x, state.target.z);
    const cx = Math.max(10, Math.min(206, tx)), cy = Math.max(10, Math.min(206, ty));
    g.fillStyle = '#ffd34d';
    g.beginPath(); g.moveTo(cx, cy - 8); g.lineTo(cx + 6, cy + 4); g.lineTo(cx - 6, cy + 4); g.closePath(); g.fill();
  }
  // Player arrow, always centre, pointing up.
  g.fillStyle = '#ffffff';
  g.beginPath(); g.moveTo(MM_R, MM_R - 8); g.lineTo(MM_R + 5.5, MM_R + 6); g.lineTo(MM_R - 5.5, MM_R + 6); g.closePath(); g.fill();
  g.restore();
  // North tick.
  g.fillStyle = '#e8b64c'; g.font = 'bold 12px Arial'; g.textAlign = 'center';
  const nx = MM_R + Math.sin(-state.heading) * (MM_R - 10), ny = MM_R - Math.cos(-state.heading) * (MM_R - 10);
  g.fillText('N', nx, ny + 4);
}
