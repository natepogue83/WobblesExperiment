// sound.js — little synthesized sounds for everything you do (Web Audio, no
// files). Pops, boings, splashes, zaps, giggles and a chime for discoveries.
// UI only; starts silent until the first tap (browsers require a gesture).

const MUTE_KEY = 'wobblins.muted';
let ctx = null, master = null, noiseBuf = null;
let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* private mode */ }

function ready() {
  if (muted) return false;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return true;
}

// Unlock audio on the first gesture anywhere.
export function initSound() {
  const wake = () => { if (!muted) ready(); window.removeEventListener('pointerdown', wake); };
  window.addEventListener('pointerdown', wake);
}

export function isMuted() { return muted; }
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* ignore */ }
  if (ctx) m ? ctx.suspend() : ctx.resume();
}

// One enveloped oscillator. f may be [from, to] for a slide.
function tone(f, dur, { type = 'sine', vol = 0.5, at = 0, attack = 0.008, vibrato = 0, to = null } = {}) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  if (vibrato) {
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 9; lg.gain.value = vibrato;
    lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.05);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

// Filtered noise: splashes, thumps, rain, crackle.
function noise(dur, { freq = 1000, q = 0.8, type = 'bandpass', vol = 0.4, at = 0, sweepTo = null, attack = 0.01 } = {}) {
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noiseBuf; src.loop = true;
  f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
}

const SOUNDS = {
  pop: () => tone(520, 0.09, { to: 900, vol: 0.4 }),
  lift: () => { tone(300, 0.16, { type: 'triangle', to: 720, vol: 0.35 }); },
  drop: () => { tone(480, 0.12, { to: 240, vol: 0.35 }); noise(0.12, { freq: 300, type: 'lowpass', vol: 0.25 }); },
  whoosh: () => noise(0.4, { freq: 400, sweepTo: 2400, q: 1.4, vol: 0.35, attack: 0.08 }),
  boing: () => { tone(170, 0.4, { to: 420, vibrato: 30, vol: 0.4, type: 'triangle' }); noise(0.08, { freq: 200, type: 'lowpass', vol: 0.3 }); },
  splash: () => {
    noise(0.55, { freq: 1600, sweepTo: 300, type: 'lowpass', vol: 0.45, attack: 0.005 });
    for (let i = 0; i < 5; i++) tone(700 + Math.random() * 700, 0.06, { at: 0.08 + i * 0.07, to: 1600 + Math.random() * 400, vol: 0.12 });
  },
  thud: () => { tone(130, 0.22, { to: 55, vol: 0.55 }); noise(0.14, { freq: 400, type: 'lowpass', vol: 0.35 }); },
  thump: () => { tone(80, 0.4, { to: 38, vol: 0.7 }); noise(0.3, { freq: 250, type: 'lowpass', vol: 0.5 }); },
  zap: () => {
    tone(1400, 0.28, { type: 'sawtooth', to: 70, vol: 0.22 });
    noise(0.35, { freq: 3500, type: 'highpass', vol: 0.4, attack: 0.002 });
    noise(0.5, { freq: 120, type: 'lowpass', vol: 0.5, at: 0.05 });
  },
  rain: () => { noise(1.6, { freq: 4200, q: 0.4, vol: 0.18, attack: 0.3 }); noise(1.2, { freq: 900, vol: 0.08, attack: 0.3, at: 0.2 }); },
  sprout: () => { tone(620, 0.08, { type: 'triangle', to: 980, vol: 0.3 }); tone(880, 0.12, { type: 'triangle', to: 1320, vol: 0.25, at: 0.09 }); },
  chime: () => [880, 1320, 1760].forEach((f, i) => tone(f, 0.9, { at: i * 0.09, vol: 0.18, attack: 0.004 })),
  sparkle: () => [1568, 1976, 2349, 2637, 3136].forEach((f, i) => tone(f, 0.25, { at: i * 0.05, vol: 0.1, attack: 0.003 })),
  heart: () => { tone(660, 0.1, { vol: 0.22 }); tone(990, 0.16, { vol: 0.22, at: 0.09 }); },
  uhoh: () => { tone(440, 0.14, { type: 'square', vol: 0.08 }); tone(330, 0.22, { type: 'square', vol: 0.08, at: 0.14 }); },
  giggle: () => { for (let i = 0; i < 4; i++) tone(720 + Math.random() * 320, 0.07, { type: 'triangle', at: i * 0.085, to: 900 + Math.random() * 300, vol: 0.2 }); },
  eureka: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, { type: 'triangle', at: i * 0.1, vol: 0.25 }));
    SOUNDS.sparkle_late();
  },
  sparkle_late: () => [2093, 2637, 3136].forEach((f, i) => tone(f, 0.3, { at: 0.45 + i * 0.06, vol: 0.08 })),
  fanfare: () => {
    [523, 659, 784].forEach((f, i) => tone(f, 0.16, { type: 'square', at: i * 0.12, vol: 0.09 }));
    tone(1047, 0.7, { type: 'square', at: 0.36, vol: 0.1, vibrato: 6 });
    tone(523, 0.7, { type: 'triangle', at: 0.36, vol: 0.18 });
  },
  levelup: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.18, { type: 'triangle', at: i * 0.06, vol: 0.18 })),
  coo: () => { tone(600, 0.25, { to: 820, vol: 0.2, vibrato: 12 }); tone(820, 0.3, { to: 700, vol: 0.15, at: 0.25 }); },
  sad: () => [392, 330, 262].forEach((f, i) => tone(f, 0.5, { type: 'triangle', at: i * 0.3, vol: 0.16 })),
  hug: () => { tone(500, 0.18, { to: 700, vol: 0.2 }); tone(750, 0.25, { to: 620, vol: 0.18, at: 0.15 }); },
  bonk: () => { tone(900, 0.06, { type: 'square', to: 500, vol: 0.12 }); tone(240, 0.15, { to: 120, vol: 0.4, at: 0.02 }); },
  rumble: () => { noise(1.3, { freq: 90, type: 'lowpass', vol: 0.8, attack: 0.08 }); tone(48, 1.2, { to: 36, vol: 0.5, vibrato: 4 }); noise(0.9, { freq: 600, q: 1, vol: 0.15, at: 0.2 }); },
  crunch: () => { noise(0.25, { freq: 2200, q: 2, vol: 0.35 }); noise(0.2, { freq: 600, q: 1.5, vol: 0.3, at: 0.06 }); }
};

export function play(name) {
  if (!SOUNDS[name] || !ready()) return;
  try { SOUNDS[name](); } catch { /* audio hiccup: never break the game */ }
}

// Sounds for things that happen in the world on their own (a new tick's events).
const EVENT_SOUND = {
  discovery: 'eureka', rediscovery: 'chime', birth: 'coo', death: 'sad', level_up: 'levelup', power_unlocked: 'fanfare',
  friends: 'hug', built: 'thud', fire_started: 'crunch', festival: 'fanfare', wish_granted: 'chime'
};
const INTERACTION_SOUND = {
  hug: 'hug', bonk: 'bonk', bowled_over: 'bonk', bush_squashed: 'crunch', snack: 'pop', stuck_in_tree: 'boing', singed: 'uhoh',
  caught_fish: 'splash', scared_fish: 'splash', through_the_roof: 'crunch', made_a_cairn: 'thud', treasure: 'chime',
  bonked: 'bonk', bonk_idea: 'bonk', squashed: 'thump', flower_crown: 'sprout', zapped: 'zap', gift_caught: 'chime',
  boulder_split: 'crunch', fish_stunned: 'splash', squabble: 'uhoh', skating: 'giggle', slipped: 'bonk', ice_cracked: 'splash'
};
export function soundForEvents(events) {
  // One sound per batch, the most notable first.
  const order = ['power_unlocked', 'discovery', 'birth', 'death', 'level_up', 'friends', 'wish_granted', 'festival', 'rediscovery', 'interaction', 'built', 'fire_started'];
  for (const k of order) {
    const e = events.find(x => x.kind === k);
    if (!e) continue;
    play(k === 'interaction' ? INTERACTION_SOUND[e.data.what] : EVENT_SOUND[k]);
    return;
  }
}

export function soundForReaction(reactions) {
  const vals = Object.values(reactions || {});
  if (!vals.length) return;
  const good = vals.filter(v => v === 'love' || v === 'like').length, bad = vals.filter(v => v === 'scared' || v === 'upset').length;
  setTimeout(() => play(good >= bad ? 'heart' : 'uhoh'), 260);
}
