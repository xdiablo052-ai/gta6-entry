// The story of Neon Harbor: five jobs for a fixer named Delia, then open-ended odd jobs.
// A stage machine over simple verbs — talk, go, drive, steal, hold, earn — with dialogue
// that plays in the HUD box and a target marker the minimap and the world both show.
import * as THREE from 'three';
import { makePed } from './peds.js';
import * as hud from './hud.js';
import { sfx } from './audio.js';

export const DELIA_POS = { x: -34, z: 208 };
const SPOTS = {
  diner: DELIA_POS,
  warehouse: { x: 96, z: -150 },
  clubNova: { x: -96, z: 96 },
  rico: { x: 150, z: -96 },
  pawn: { x: -150, z: 12 },
  boat: { x: -120, z: 240 },
};

const STORY = [
  {
    title: 'MEET DELIA', reward: 0,
    stages: [
      { kind: 'talk', at: 'diner', lines: [
        ['DELIA', 'You must be Marlo. I run small errands out of this diner — packages, rides, favours nobody logs.'],
        ['DELIA', 'Viceport pays people who show up and don\'t ask questions. First rule: you need wheels. Any wheels.'],
        ['MARLO', 'Steal a car. You\'re serious.'],
        ['DELIA', 'I\'m always serious. Take one, bring it back here. Then we talk money.'],
      ] },
    ],
  },
  {
    title: 'FIRST WHEELS', reward: 150,
    stages: [
      { kind: 'steal', text: 'Steal any car (walk up to one, press F)' },
      { kind: 'drive', at: 'diner', text: 'Bring the car back to Delia at the diner' },
      { kind: 'talk', at: 'diner', lines: [
        ['DELIA', 'Ha! Not bad for a first lift. Here — $150, and the city just got smaller for you.'],
        ['DELIA', 'Next job\'s a package. Warehouse up north-east. It\'s already warm, so don\'t dawdle.'],
      ] },
    ],
  },
  {
    title: 'PACKAGE RUN', reward: 300,
    stages: [
      { kind: 'goto', at: 'warehouse', text: 'Pick up the package at the warehouse', heat: true },
      { kind: 'drive', at: 'clubNova', text: 'Deliver it to Club Nova', time: 180 },
      { kind: 'talk', at: 'clubNova', lines: [
        ['DOORMAN', 'Delia\'s package. You\'re late and you smell like trouble.'],
        ['MARLO', 'Tell her the trouble was complimentary.'],
      ] },
    ],
  },
  {
    title: 'RICO\'S RIDE', reward: 450,
    stages: [
      { kind: 'goto', at: 'rico', text: 'Pick up Rico — he\'s hot, move fast', lines: [
        ['RICO', 'Drive! I may have taken something that wasn\'t mine from people who shoot first.'],
        ['MARLO', 'Get in. Pawn shop, right?'],
        ['RICO', 'Pawn shop. And friend — the sirens are not a coincidence.'],
      ], heat: 2 },
      { kind: 'drive', at: 'pawn', text: 'Drop Rico at the pawn shop' },
      { kind: 'talk', at: 'pawn', lines: [
        ['RICO', 'You drive like the city owes you money. Delia\'s cut is in your account.'],
      ] },
    ],
  },
  {
    title: 'HARBOR HEAT', reward: 700,
    stages: [
      { kind: 'goto', at: 'boat', text: 'Get heat on you (2 stars), then reach the boat at the quay', needStars: 2 },
      { kind: 'hold', at: 'boat', text: 'Stay by the boat while the crew casts off', holdTime: 5, needStars: 1 },
      { kind: 'talk', at: 'boat', lines: [
        ['DELIA', 'You just outran the whole Viceport PD for a boat ride. The city\'s yours now, Marlo.'],
        ['DELIA', 'Keep your phone on. There\'s always another job.'],
      ] },
    ],
  },
];

export function createMissions(scene, state, hooks) {
  // Delia stands outside her diner, day and night.
  const delia = makePed(scene, DELIA_POS.x, DELIA_POS.z);
  delia.state = 'stand';
  delia.mesh.rotation.y = Math.PI;
  const rico = makePed(scene, SPOTS.rico.x, SPOTS.rico.z);
  rico.state = 'stand';

  // Objective marker: a pillar of light at the current target.
  const marker = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 2.6, 30, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.33, side: THREE.DoubleSide, depthWrite: false }),
  );
  marker.position.y = 15;
  scene.add(marker);

  const M = {
    index: 0, stage: 0, done: false, dialogue: null, dlgIdx: 0,
    timer: null, holdT: 0, jobCount: 0,

    current() { return this.done ? null : STORY[this.index]; },
    stageDef() { const m = this.current(); return m ? m.stages[this.stage] : this.oddStage; },

    startAt(index) {
      this.index = index; this.stage = 0; this.done = index >= STORY.length;
      if (this.done && !this.oddStage) this.newOddJob();
      this.beginStage();
    },

    beginStage() {
      const s = this.stageDef();
      this.holdT = 0;
      this.timer = s && s.time ? s.time : null;
      if (s && s.heat) hooks.police.reportCrime('missionHeat');
      if (s && typeof s.heat === 'number') hooks.police.setStars(Math.max(hooks.police.stars, s.heat));
    },

    say(lines) {
      this.dialogue = lines; this.dlgIdx = 0;
      hud.showDialogue(lines[0][0], lines[0][1]);
    },
    advanceDialogue() {
      if (!this.dialogue) return false;
      this.dlgIdx++;
      if (this.dlgIdx >= this.dialogue.length) {
        this.dialogue = null;
        hud.hideDialogue();
        this.nextStage();
      } else {
        hud.showDialogue(this.dialogue[this.dlgIdx][0], this.dialogue[this.dlgIdx][1]);
      }
      return true;
    },

    completeMission() {
      const m = this.current();
      if (m && m.reward) { hooks.addCash(m.reward); hud.toast(`+$${m.reward} — job done`, 3); }
      sfx.jingle();
      hud.banner(this.index === STORY.length - 1 ? 'STORY COMPLETE' : 'JOB DONE');
      this.index++;
      this.stage = 0;
      if (this.index >= STORY.length) { this.done = true; this.newOddJob(); }
      else this.beginStage();
      hooks.save();
    },

    nextStage() {
      const m = this.current();
      if (!m) { this.newOddJob(); hooks.save(); return; }
      this.stage++;
      if (this.stage >= m.stages.length) this.completeMission();
      else this.beginStage();
    },

    failMission() {
      sfx.fail();
      hud.banner('JOB FAILED', true);
      this.stage = 0;
      this.beginStage();
      hooks.save();
    },

    restart() { // after a bust or a wasted: same mission, first stage, no lecture
      this.dialogue = null; hud.hideDialogue();
      this.stage = 0; this.beginStage();
    },

    newOddJob() {
      const keys = Object.keys(SPOTS).filter((k) => k !== 'diner');
      const a = SPOTS[keys[(Math.random() * keys.length) | 0]];
      let b = SPOTS[keys[(Math.random() * keys.length) | 0]];
      if (b === a) b = SPOTS.clubNova;
      this.jobCount++;
      this.oddStage = { kind: 'drive', atPos: a, text: `Odd job #${this.jobCount}: pick up at the marker` };
      this.oddSecond = { kind: 'drive', atPos: b, text: 'Now drop it at the second marker', reward: 120 + ((Math.random() * 160) | 0) };
      this.oddPhase = 0;
    },

    targetPos() {
      const s = this.stageDef();
      if (!s) return null;
      return s.atPos || SPOTS[s.at] || null;
    },

    update(dt) {
      const s = this.stageDef();
      const tp = this.targetPos();
      if (tp && !this.dialogue) {
        marker.visible = true;
        marker.position.set(tp.x, 15, tp.z);
        marker.material.opacity = 0.26 + Math.sin(performance.now() * 0.004) * 0.1;
      } else marker.visible = false;

      if (this.dialogue || !s) { state.target = tp; return; }

      const dist = tp ? Math.hypot(state.player.pos.x - tp.x, state.player.pos.z - tp.z) : 0;
      const title = this.done ? 'ODD JOBS' : `JOB ${this.index + 1} — ${this.current().title}`;
      let text = s.text || defaultText(s);
      if (s.kind === 'hold' && s.needStars && hooks.police.stars < s.needStars) text = `You need ${s.needStars} stars of heat first — make some noise`;
      if (this.timer !== null && s.time) text += ` — ${Math.max(0, Math.ceil(this.timer))}s`;
      hud.showMission(title, text, tp ? `${Math.round(dist)}m` : '');
      state.target = tp;

      if (this.timer !== null) {
        this.timer -= dt;
        if (this.timer <= 0) { this.timer = null; this.failMission(); return; }
      }

      switch (s.kind) {
        case 'talk':
          if (dist < 3.4 && !state.player.inCar) { if (s.lines) this.say(s.lines); else this.nextStage(); }
          break;
        case 'goto':
          if (dist < 4.5) { if (s.lines) this.say(s.lines); else this.nextStage(); }
          break;
        case 'drive':
          if (dist < 6 && state.player.inCar) {
            if (this.done) { // odd job bookkeeping
              if (this.oddPhase === 0) { this.oddPhase = 1; this.oddStage = this.oddSecond; hud.toast('Picked up — one more marker', 2.5); }
              else { hooks.addCash(this.oddSecond.reward); hud.toast(`+$${this.oddSecond.reward} — odd job done`, 3); sfx.jingle(); this.newOddJob(); hooks.save(); }
            } else this.nextStage();
          }
          break;
        case 'steal':
          if (state.flags.stoleCar) { state.flags.stoleCar = false; this.nextStage(); }
          break;
        case 'hold': {
          const need = s.needStars || 0;
          if (dist < 7 && hooks.police.stars >= need) {
            this.holdT += dt;
            hud.showMission(title, `Hold on… ${Math.ceil(s.holdTime - this.holdT)}s`, '');
            if (this.holdT >= s.holdTime) this.nextStage();
          } else this.holdT = Math.max(0, this.holdT - dt);
          break;
        }
      }
    },
  };

  function defaultText(s) {
    return { talk: 'Talk to them', goto: 'Go to the marker', drive: 'Drive to the marker', steal: 'Steal a car', hold: 'Hold your ground at the marker' }[s.kind] || 'Follow the marker';
  }

  return M;
}
