// All sound is synthesized WebAudio — no files. A tiny SFX kit (shots, hits, coins,
// sirens, jingles), an engine hum tied to the driven car's speed, and a slow synthwave
// loop (bass pulse + minor pad) that gives Viceport its dusk.
let ctx = null, master = null, muted = false;
let engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null, sirenLfo = null;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    startMusic();
  } catch { /* no audio: the game still plays */ }
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

function env(gain, t0, a, peak, d) {
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + a);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + a + d);
}

function blip(freq, dur, type = 'sine', vol = 0.2, slide = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  env(g, t, 0.005, vol, dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

function noise(dur, vol = 0.3, freq = 1200) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const len = Math.max(1, (dur * ctx.sampleRate) | 0);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = ctx.createGain(); env(g, t, 0.002, vol, dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t);
}

export const sfx = {
  shot() { noise(0.14, 0.5, 2600); blip(160, 0.1, 'square', 0.16, -110); },
  hit() { noise(0.1, 0.3, 500); },
  crash() { noise(0.32, 0.55, 700); blip(70, 0.25, 'sawtooth', 0.2, -40); },
  coin() { blip(880, 0.09, 'sine', 0.22); setTimeout(() => blip(1320, 0.14, 'sine', 0.22), 70); },
  door() { blip(220, 0.07, 'square', 0.12, -60); noise(0.05, 0.1, 900); },
  jingle() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.22), i * 110)); },
  fail() { [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.24, 'triangle', 0.2), i * 130)); },
  bust() { [330, 262, 196].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'square', 0.14), i * 150)); },
};

// Engine: a sawtooth whose pitch follows the driven car's speed; silent on foot.
export function updateEngine(speedRatio) {
  if (!ctx) return;
  if (speedRatio > 0.02 && !muted) {
    if (!engineOsc) {
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth';
      engineGain = ctx.createGain(); engineGain.gain.value = 0;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
      engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
    }
    engineOsc.frequency.value = 55 + speedRatio * 130;
    engineGain.gain.value = 0.05 + speedRatio * 0.05;
  } else if (engineGain) {
    engineGain.gain.value = 0;
  }
}

// Siren: a two-tone wail whose volume follows the nearest police car.
export function updateSiren(nearestCopDist) {
  if (!ctx) return;
  const want = nearestCopDist < 90 && !muted ? Math.max(0, 0.075 * (1 - nearestCopDist / 90)) : 0;
  if (want > 0 && !sirenOsc) {
    sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 700;
    sirenLfo = ctx.createOscillator(); sirenLfo.frequency.value = 0.55;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 160;
    sirenLfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
    sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain); sirenGain.connect(master);
    sirenOsc.start(); sirenLfo.start();
  }
  if (sirenGain) sirenGain.gain.value = want;
}

// Music: an 8-step loop — Am–F–C–G pads over a pulsing bass, scheduled a step at a time.
const CHORDS = [[110, 220, 261.6, 329.6], [87.3, 174.6, 220, 261.6], [130.8, 196, 261.6, 329.6], [98, 196, 246.9, 293.7]];
let step = 0;
function startMusic() {
  setInterval(() => {
    if (!ctx || muted || document.hidden) return;
    const chord = CHORDS[(step / 8 | 0) % 4];
    if (step % 8 === 0) {
      for (const f of chord.slice(1)) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        const t = ctx.currentTime;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.028, t + 0.4);
        g.gain.linearRampToValueAtTime(0.0001, t + 3.4);
        o.connect(g); g.connect(master);
        o.start(t); o.stop(t + 3.5);
      }
    }
    if (step % 2 === 0) blip(chord[0], 0.32, 'sawtooth', 0.045);
    step++;
  }, 420);
}
