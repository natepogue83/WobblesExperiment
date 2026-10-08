// culture.js — what discoveries and beliefs do once they exist:
// songs, rituals, festivals, rain dances, rebuilding, belief spread and
// fading, stargazer warnings, healing, raft strangers, and wishes.
// Runs inside the life-events step. Never adds knowledge (rule zero).
import { emit } from './events.js';
import { rngFor, chance, pick } from './rng.js';
import { alive, liveObjects, r3, clamp, clamp01 } from './util.js';
import { makeWobblin, makeObject } from './world.js';
import { buildStructure } from './effects.js';
import { freeSlotIn } from './nature.js';
import { LIFE, POP_CAP } from './constants.js';
import { ZONE_IDS } from './geometry.js';

const knowsIt = (w, d) => !!w.knows[d];

function byZone(live) {
  const m = {};
  for (const w of live) (m[w.zone] ||= []).push(w);
  return m;
}

function mood(w, d) { w.needs.mood = r3(clamp01(w.needs.mood + d)); }
function faith(w, d) { w.faith = r3(clamp(w.faith + d, -1, 1)); }

function gatherings(world, live, objs, r) {
  const t = world.tick;
  const zones = byZone(live);
  const hearthZones = new Set(objs.filter(o => o.kind === 'hearth').map(o => o.zone));
  for (const z of ZONE_IDS) {
    const here = zones[z] || [];
    if (here.length < 2) continue;
    // Song: humming circles at dusk.
    const singers = here.filter(w => knowsIt(w, 'song'));
    if (singers.length >= 2) {
      for (const w of here) mood(w, 0.04);
      if (t - (world.lastSong ?? -99) >= 6 && chance(r, 0.15)) {
        world.lastSong = t;
        emit(world, { kind: 'ritual', actors: singers.map(w => w.id), data: { zone: z, kind: 'song' }, salience: 2 });
      }
    }
    // Ritual: dances around the hearth with 3+ who know it.
    const dancers = here.filter(w => knowsIt(w, 'ritual'));
    if (hearthZones.has(z) && dancers.length >= 3 && chance(r, 0.25)) {
      for (const w of here) { mood(w, 0.08); faith(w, 0.06); }
      emit(world, { kind: 'ritual', actors: here.map(w => w.id), data: { zone: z, kind: 'fire_dance' }, salience: 3 });
    }
    // Rain dance: believers sing for rain when it has been dry.
    const dancersR = here.filter(w => w.beliefs.includes('rain_dance'));
    if (dancersR.length >= 2 && world.climate.wetUntil < t - 10 && chance(r, 0.08)) {
      emit(world, { kind: 'ritual', actors: dancersR.map(w => w.id), data: { zone: z, kind: 'rain_dance' }, salience: 2 });
    }
  }
  // Festival: a recurring big night when there is food to spare.
  const knowers = live.filter(w => knowsIt(w, 'festival'));
  const fed = live.length && live.reduce((s, w) => s + w.needs.food, 0) / live.length > 0.55;
  const last = world.lastFestival ?? -999;
  if (knowers.length && fed && hearthZones.size && t - last >= 24 && chance(r, 0.2)) {
    world.lastFestival = t;
    for (const w of live) { mood(w, 0.2); faith(w, 0.04); }
    emit(world, { kind: 'festival', actors: live.map(w => w.id), data: { zone: [...hearthZones].sort()[0] }, salience: 4 });
  }
}

// Scorched huts and walls are rebuilt by someone who still knows how.
function rebuilding(world, live, objs, r) {
  for (const o of objs.filter(x => x.kind === 'scorch' && x.state.was)) {
    if (world.tick - o.state.burnedTick < 12) continue;
    const builder = live.find(w => knowsIt(w, o.state.was) && w.stage !== 'baby');
    if (!builder || !chance(r, 0.1)) continue;
    o.kind = o.state.was;
    o.by = [builder.id];
    delete o.state.was;
    emit(world, { kind: 'built', actors: [builder.id], target: o.id, data: { kind: o.kind, zone: o.zone, rebuilt: true },
      salience: 3, causes: [{ object: o.id }] });
  }
}

// Ongoing works: Wobblins keep using what they know, so the valley keeps
// changing while you are away (stacks, walls, gardens, new murals, pots).
const WORKS = [
  { d: 'stone_stacking', ok: (world, objs) => objs.some(o => o.kind === 'stones' && !o.state.stacked),
    run: (world, objs, w, r) => { const s = objs.filter(o => o.kind === 'stones' && !o.state.stacked); const o = s[Math.floor(r() * s.length)]; o.state.stacked = true; return { o, kind: 'stack' }; } },
  // (No extra walls: they ate the stone piles that Huts and the Temple need.)
  { d: 'garden', ok: (world, objs) => objs.filter(o => o.kind === 'garden').length < 3, build: 'garden', zones: ['meadow', 'grove'] },
  { d: 'paint', ok: (world, objs) => objs.filter(o => o.kind === 'mural').length < 6 && newKeeperEvent(world, objs), build: 'mural', zones: ['hill', 'grove'] },
  { d: 'raft', ok: (world, objs) => !objs.some(o => o.kind === 'raft'), build: 'raft' },
  { d: 'pottery', ok: (world, objs) => objs.some(o => o.kind === 'hearth' && !o.state.pots),
    run: (world, objs) => { const o = objs.find(x => x.kind === 'hearth' && !x.state.pots); o.state.pots = true; return { o, kind: 'pots' }; } },
  { d: 'planting', ok: (world, objs) => objs.filter(o => o.kind === 'bush' || o.kind === 'sprout').length < 6,
    run: (world, objs, w) => {
      const slot = freeSlotIn(world, 'grove');
      if (!slot) return null;
      const o = makeObject(world, { kind: 'sprout', slot, by: [w.id], origin: { natural: true }, state: { grows: 'bush', readyAt: world.tick + 6 } });
      return { o, kind: 'planted' };
    } }
];

function newKeeperEvent(world, objs) {
  const last = Math.max(0, ...objs.filter(o => o.kind === 'mural').map(o => o.state.depicts || 0));
  return world.lastKeeperEvent !== null && world.lastKeeperEvent > last;
}

function works(world, live, objs, r) {
  if (!chance(r, 0.35)) return;
  const options = WORKS.filter(x => live.some(w => w.stage !== 'baby' && knowsIt(w, x.d)) && x.ok(world, objs));
  if (!options.length) return;
  const job = options[Math.floor(r() * options.length)];
  const builders = live.filter(w => w.stage !== 'baby' && knowsIt(w, job.d));
  const w = builders[Math.floor(r() * builders.length)];
  const rec = world.discoveries[job.d];
  const disc = rec && rec.event ? world.events[rec.event - 1] : null;
  if (job.build) {
    let state = {};
    if (job.build === 'mural') {
      state = { depicts: world.lastKeeperEvent };
    }
    if (disc) buildStructure(world, job.build, w, disc, state, job.zones);
    return;
  }
  const done = job.run(world, objs, w, r);
  if (done) emit(world, { kind: 'built', actors: [w.id], target: done.o.id, data: { kind: done.kind, zone: done.o.zone, work: true },
    salience: 2, causes: disc ? [{ event: disc.id }] : [] });
}

// Beliefs spread like knowledge (more slowly); Lore lets them fade.
function beliefs(world, live, r) {
  for (const L of live) {
    for (const K of live) {
      if (K === L || K.zone !== L.zone) continue;
      for (const b of K.beliefs) {
        if (L.beliefs.includes(b) || r() >= 0.03 * (0.5 + K.traits.sociability)) continue;
        L.beliefs = [...L.beliefs, b].sort();
        if (b === 'lucky_stone' && K.luckyCharm) L.luckyCharm = K.luckyCharm;
      }
    }
    if (L.beliefs.length && knowsIt(L, 'lore') && r() < 0.01) {
      const b = L.beliefs[0];
      L.beliefs = L.beliefs.slice(1);
      if (b === 'lucky_stone') delete L.luckyCharm;
    }
  }
}

// Herb Healing doubles healing; a stargazer warns of cold nights.
function care(world, live) {
  const healer = live.some(w => knowsIt(w, 'herb_healing'));
  if (healer) {
    for (const w of live) {
      if (w.injuries > 0 && (world.tick - w.bornTick) % 8 === 4) {
        w.injuries--;
        emit(world, { kind: 'healed', actors: [w.id], data: { by: 'herbs' }, salience: 1 });
      }
    }
  }
  world.climate.warned = live.some(w => knowsIt(w, 'star_watching')) && world.climate.cold;
}

// A raft sometimes comes back with a stranger.
function raftStrangers(world, live, objs, r) {
  if (!objs.some(o => o.kind === 'raft') || live.length >= POP_CAP || !live.some(w => knowsIt(w, 'raft'))) return;
  if (!chance(r, 0.01)) return;
  const w = makeWobblin(world, { bornTick: world.tick - LIFE.babyUntil - 10, zone: 'riverbank' });
  const raft = objs.find(o => o.kind === 'raft');
  emit(world, { kind: 'stranger_arrived', actors: [w.id], data: { zone: 'riverbank', by: 'raft' }, salience: 4,
    causes: [{ object: raft.id }] });
}

// Temples and totems: those nearby grow in faith.
function shrines(world, live, objs) {
  const sacred = new Set(objs.filter(o => o.kind === 'temple' || o.kind === 'totem').map(o => o.zone));
  for (const w of live) if (sacred.has(w.zone)) faith(w, 0.01);
}

// ---- wishes -------------------------------------------------------------
export const WISHES = ['rain', 'stones_on_hill', 'warmth'];

function wishes(world, live, objs, r) {
  const t = world.tick;
  world.wishes ||= [];
  for (const wi of world.wishes) {
    if (!wi.done && t >= wi.until) {
      wi.done = 'expired';
      emit(world, { kind: 'wish_expired', actors: [wi.by], target: wi.want, data: { wish: wi.id }, salience: 2, causes: [{ event: wi.event }] });
    }
  }
  if (!objs.some(o => o.kind === 'temple')) return;
  if (world.wishes.some(wi => !wi.done) || !chance(r, 0.03)) return;
  const by = pick(r, live.filter(w => w.stage !== 'baby') || live);
  if (!by) return;
  const want = pick(r, WISHES);
  const id = world.wishes.length + 1;
  const ev = emit(world, { kind: 'wish', actors: [by.id], target: want, data: { wish: id }, salience: 3 });
  world.wishes.push({ id, by: by.id, want, t, until: t + 24, event: ev.id, done: null });
}

// Called by actions.js after a valid Keeper action: does it grant a wish?
export function grantWishes(world, action, actionEvent) {
  if (!world.wishes) return;
  for (const wi of world.wishes) {
    if (wi.done) continue;
    const ok =
      (wi.want === 'rain' && action.power === 'rain') ||
      (wi.want === 'stones_on_hill' && action.power === 'stone' && String(action.slot).startsWith('hill.')) ||
      (wi.want === 'warmth' && ((action.power === 'season' && action.variant === 'warm') || action.power === 'lightning')) ||
      (action.nudge === 'miracle');
    if (!ok) continue;
    wi.done = 'granted';
    for (const w of alive(world)) faith(w, w.id === wi.by ? 0.3 : 0.1);
    emit(world, { kind: 'wish_granted', actors: [wi.by], target: wi.want, data: { wish: wi.id },
      salience: 4, causes: [{ action: action.seq }, { event: wi.event }].concat(actionEvent ? [{ event: actionEvent }] : []) });
  }
}

export function cultureStep(world) {
  const live = alive(world);
  if (!live.length) return;
  const objs = liveObjects(world);
  const r = rngFor(world.seed, 'culture', world.tick);
  gatherings(world, live, objs, r);
  rebuilding(world, live, objs, r);
  works(world, live, objs, r);
  beliefs(world, live, r);
  care(world, live);
  raftStrangers(world, live, objs, r);
  shrines(world, live, objs);
  wishes(world, live, objs, r);
}
