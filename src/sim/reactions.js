// reactions.js — how each Wobblin feels about a Keeper act, the moment it happens.
// Deterministic (traits, needs, beliefs, a seeded nudge). Recorded on the
// Keeper's event as data.reactions so the UI can show hearts, ?, ! or X, and
// it nudges mood and faith a little. Never adds knowledge.
import { rngFor } from './rng.js';
import { ADJACENT, slotInfo } from './geometry.js';
import { alive, r3, clamp } from './util.js';
import { addBelief, BELIEF } from './belief.js';
import { shapeTrait } from './growth.js';

export const EMOTES = ['love', 'like', 'curious', 'scared', 'upset'];
const EFFECT = {
  love: { mood: 0.05, faith: 0.02 },
  like: { mood: 0.02, faith: 0.005 },
  curious: { mood: 0, faith: 0 },
  scared: { mood: -0.03, faith: -0.01 },
  upset: { mood: -0.04, faith: -0.01 }
};

// Where did it happen? Zone of the slot/target, or null for valley-wide acts.
function whereOf(world, a) {
  if (a.slot && slotInfo(a.slot)) return slotInfo(a.slot).zone;
  if (a.onto) { const w = world.wobblins.find(x => x.id === a.onto); if (w) return w.zone; }
  if (a.nudge === 'carry') return a.zone;
  if (a.power === 'water' && !a.slot) return 'pondsite';
  if (a.target) { const w = world.wobblins.find(x => x.id === a.target); return w ? w.zone : null; }
  if (a.targets) { const w = world.wobblins.find(x => x.id === a.targets[0]); return w ? w.zone : null; }
  return null;
}

// score > 0.55 love, > 0.2 like, > -0.2 curious, else scared or upset.
function feel(world, w, a, here, r) {
  const T = w.traits, n = w.needs;
  const near = !here || w.zone === here;
  const jitter = (r() - 0.5) * 0.3;
  let s = 0, fear = false;
  if (a.onto === w.id) {
    const kind = a.type === 'gift' ? 'gift' : a.power === 'stone' ? a.variant : a.power;
    s = { stones: -0.35 + 0.6 * T.playfulness, boulder: -1 + 0.3 * T.boldness, plant: 0.7 + 0.2 * T.playfulness,
      lightning: -0.9 + 1.5 * T.boldness, gift: 0.9 }[kind] + jitter;
    fear = kind === 'lightning';
    return s > 0.55 ? 'love' : s > 0.2 ? 'like' : s > -0.2 ? 'curious' : fear ? 'scared' : 'upset';
  }
  if (a.onto && (a.type === 'power' || a.type === 'gift')) {
    // Watching it land on someone else: friends wince, the playful laugh, a rival enjoys it.
    const kind = a.type === 'gift' ? 'gift' : a.power === 'stone' ? a.variant : a.power;
    const b = (w.bonds && w.bonds[a.onto]) || 0;
    s = { stones: -0.15 + 0.6 * T.playfulness - 0.2 * T.sociability, boulder: -0.3 + 0.8 * T.playfulness - 0.4 * T.sociability,
      plant: 0.3 + 0.4 * T.sociability, lightning: -0.5 + 0.7 * T.boldness, gift: 0.1 + 0.4 * T.sociability }[kind] + jitter;
    if (kind !== 'plant' && kind !== 'gift') s += b > 0 ? -0.9 * b : -0.7 * b;
    fear = kind === 'lightning' || (kind === 'boulder' && T.caution > 0.6);
    return s > 0.55 ? 'love' : s > 0.2 ? 'like' : s > -0.2 ? 'curious' : fear ? 'scared' : 'upset';
  }
  switch (a.type === 'power' ? a.power : a.type === 'nudge' ? a.nudge : a.type) {
    case 'stone': case 'plant':
      s = 0.1 + 0.5 * T.curiosity + (a.variant === 'boulder' ? 0.2 * T.boldness - 0.15 * (1 - T.boldness) : 0); break;
    case 'rain':
      s = (w.beliefs.includes('rain_dance') ? 0.6 : 0) + (w.knows.digging || w.knows.planting ? 0.3 : 0) + 0.3 * T.playfulness - (n.warmth < 0.5 ? 0.6 : 0.1); break;
    case 'lightning':
      fear = true; s = near ? -0.7 + 0.9 * T.boldness : -0.1 + 0.5 * T.boldness + (n.warmth < 0.4 ? 0.3 : 0); break;
    case 'water': s = 0.2 + 0.4 * T.playfulness + 0.2 * T.boldness; break;
    case 'quake': fear = true; s = -0.6 + 0.7 * T.playfulness + 0.5 * T.boldness + (n.food < 0.4 ? 0.3 : 0); break;
    case 'season':
      s = a.variant === 'warm' ? 0.4 + 0.4 * (1 - n.warmth) : -0.5 + 0.6 * n.warmth + 0.2 * T.boldness; fear = a.variant === 'cold'; break;
    case 'bless': s = w.id === a.target ? 0.9 : 0.25 + 0.3 * T.sociability; break;
    case 'curio': s = (a.targets.includes(w.id) ? 0.4 : 0) + 0.5 * T.curiosity; break;
    case 'miracle': s = 0.8; break;
    case 'move': s = 0.1 + 0.4 * T.curiosity; break;
    case 'rename': s = w.id === a.target ? 0.7 + 0.2 * T.sociability : 0.2 + 0.2 * T.curiosity; break;
    case 'gift': s = 0.3 + 0.5 * T.playfulness; break;
    case 'collect_offerings': s = w.faith > 0.3 ? 0.5 : 0.1; break;
    case 'carry':
      if (w.id !== a.target) { s = 0.1 + 0.3 * T.playfulness + (a.juggled ? 0.25 * T.playfulness : 0); break; }
      fear = true;
      s = a.thrown ? -0.4 + 1.1 * T.playfulness + 0.4 * T.boldness : 0.1 + 0.5 * T.playfulness + 0.2 * T.boldness;
      if (a.cradled) s = 0.45 + 0.5 * T.sociability;
      if (a.shaken) s = -0.7 + 0.6 * T.playfulness;
      if (a.juggled) s = -0.5 + 1.3 * T.playfulness;
      if (a.splash) s -= 0.4 - 0.3 * T.boldness;
      break;
  }
  s += jitter;
  if (s > 0.55) return 'love';
  if (s > 0.2) return 'like';
  if (s > -0.2) return 'curious';
  return fear ? 'scared' : 'upset';
}

// Who notices: the target(s), everyone in the zone it happened in and next
// to it, or everyone for valley-wide acts.
function witnesses(world, a, here) {
  const live = alive(world);
  const ids = new Set([a.target, a.onto, ...(a.targets || [])].filter(Boolean));
  if (!here) return live;
  return live.filter(w => ids.has(w.id) || w.zone === here || ADJACENT[here].includes(w.zone));
}

export function reactToAction(world, a, event) {
  const here = whereOf(world, a);
  const r = rngFor(world.seed, 'react', world.tick, a.seq);
  const out = {};
  for (const w of witnesses(world, a, here)) {
    const e = feel(world, w, a, here, r);
    out[w.id] = e;
    if (e === 'scared') shapeTrait(w, 'caution', 0.01);
    if (e === 'love') shapeTrait(w, 'piety', 0.005);
    w.needs.mood = r3(clamp(w.needs.mood + EFFECT[e].mood, 0, 1));
    w.faith = r3(clamp(w.faith + EFFECT[e].faith, -1, 1));
  }
  if (event) event.data.reactions = out;
  // Their delight (or dismay) is what your power grows from.
  let b = 0;
  for (const e of Object.values(out)) b += BELIEF[e];
  if (b) addBelief(world, b, event ? [{ event: event.id }] : []);
  return out;
}
