// misfires.js — what happens when an experiment fails, and superstitions.
// Weights are starting guesses (build plan section 8).
import { emit } from './events.js';
import { alive, liveObjects, r3, clamp01 } from './util.js';
import { ADJACENT } from './geometry.js';
import { weightedPick } from './rng.js';
import { shapeTrait } from './growth.js';

export const FIRE_DISCOVERIES = new Set(['fire_warmth', 'fire_carrying', 'hearth', 'cooking', 'pottery', 'ritual']);
const WATER_DISCOVERIES = new Set(['wading', 'fishing', 'raft']);
const STONE_DISCOVERIES = new Set(['stone_stacking', 'sharp_stone', 'wall', 'hut', 'temple']);

// Funny fails, by what they were trying. Flavor ids; text lives in the recap.
export const FUNNY = {
  fire: ['cooked_a_rock', 'singed_eyebrows', 'fed_fire_a_berry', 'tried_to_hug_the_fire'],
  water: ['taught_a_fish_to_sing', 'sat_in_the_river', 'chased_a_reflection'],
  stone: ['wall_around_sleeping_friend', 'stacked_stones_on_head', 'named_a_rock'],
  plant: ['planted_a_pebble', 'talked_to_a_bush', 'hid_berries_and_forgot'],
  social: ['hummed_off_key', 'danced_into_a_bush', 'started_a_staring_contest'],
  craft: ['wove_themselves_in', 'made_a_lumpy_hat', 'painted_a_friend_by_accident'],
  any: ['fell_asleep_mid_thought', 'forgot_what_they_were_doing', 'licked_it']
};

function flavorGroup(d) {
  if (FIRE_DISCOVERIES.has(d.id)) return 'fire';
  if (WATER_DISCOVERIES.has(d.id)) return 'water';
  if (STONE_DISCOVERIES.has(d.id)) return 'stone';
  if (['foraging', 'planting', 'garden', 'digging', 'herb_healing'].includes(d.id)) return 'plant';
  if (d.social) return 'social';
  if (['weaving', 'clay_shaping', 'paint', 'leaf_bed', 'shiny_keeping', 'totem'].includes(d.id)) return 'craft';
  return 'any';
}

export const SUPERSTITIONS = ['rain_dance', 'tree_fear', 'lucky_stone', 'fire_taboo', 'keeper_watches_pond'];

// The most recent Keeper act or natural event within 3 ticks, if any.
export function recentOmen(world) {
  const t = world.tick;
  for (let i = world.events.length - 1; i >= 0; i--) {
    const e = world.events[i];
    if (e.t < t - 3) break;
    if (e.kind.startsWith('keeper_') || e.kind === 'rain' || e.kind === 'lightning' || e.kind === 'flood' || e.kind === 'prowler') return e;
  }
  return null;
}

function pickSuperstition(world, omen, d) {
  const p = omen.data.power;
  if (omen.kind === 'rain' || p === 'rain') return 'rain_dance';
  if (omen.kind === 'lightning' || p === 'lightning') return FIRE_DISCOVERIES.has(d.id) ? 'fire_taboo' : 'tree_fear';
  if (omen.kind === 'keeper_gift' || (omen.kind === 'keeper_nudge' && omen.data.nudge === 'curio')) return 'lucky_stone';
  if (liveObjects(world).some(o => o.kind === 'pond')) return 'keeper_watches_pond';
  return 'lucky_stone';
}

// Adds a belief to w and to everyone watching in the zone.
export function formSuperstition(world, w, id, omen, success) {
  const believers = alive(world).filter(x => x.zone === w.zone && !x.beliefs.includes(id));
  if (!believers.includes(w)) return null;
  for (const x of believers) {
    x.beliefs = [...x.beliefs, id].sort();
    if (id === 'fire_taboo') x.tabooUntil = world.tick + 24;
    if (id === 'lucky_stone' && omen.target) x.luckyCharm = omen.target;
  }
  return emit(world, { kind: 'superstition', actors: [w.id, ...believers.filter(x => x !== w).map(x => x.id)], target: id,
    data: { after: success ? 'success' : 'failure', omen: omen.id }, salience: 3, causes: [{ event: omen.id }] });
}

export function onExperimentFailed(world, w, d, match, r) {
  const reach = [w.zone, ...ADJACENT[w.zone]];
  const objs = liveObjects(world);
  const fireish = FIRE_DISCOVERIES.has(d.id);
  const risky = fireish || WATER_DISCOVERIES.has(d.id) || STONE_DISCOVERIES.has(d.id);
  const builtNear = objs.filter(o => (o.kind === 'hut' || o.kind === 'wall') && reach.includes(o.zone));
  const items = objs.filter(o => (o.kind === 'gift' || o.kind === 'curio') && reach.includes(o.zone));
  const omen = recentOmen(world);
  const table = [
    { k: 'nothing', w: 40 },
    { k: 'funny', w: 35 },
    { k: 'injury', w: risky ? 10 : 0 },
    { k: 'burned', w: fireish && builtNear.length ? 5 : 0 },
    { k: 'lost', w: items.length ? 5 : 0 },
    { k: 'superstition', w: omen ? 5 : 0 }
  ];
  const out = weightedPick(r, table, x => x.w).k;
  const base = { actors: [w.id], target: d.id };
  switch (out) {
    case 'funny': {
      const list = FUNNY[flavorGroup(d)];
      emit(world, { ...base, kind: 'misfire', data: { flavor: list[Math.floor(r() * list.length)], zone: w.zone }, salience: 2 });
      w.needs.mood = r3(clamp01(w.needs.mood + 0.05));   // everyone laughed
      return out;
    }
    case 'injury': {
      w.injuries++;
      w.needs.mood = r3(clamp01(w.needs.mood - 0.15));
      shapeTrait(w, 'caution', 0.03); shapeTrait(w, 'boldness', -0.02);
      const watchers = alive(world).filter(x => x !== w && x.zone === w.zone);
      for (const x of watchers) x.traits.boldness = r3(clamp01(x.traits.boldness - 0.05));
      const ev = emit(world, { ...base, kind: 'misfire', data: { flavor: 'hurt_themselves', zone: w.zone }, salience: 2 });
      emit(world, { kind: 'injured', actors: [w.id, ...watchers.map(x => x.id)], target: w.id,
        data: { cause: 'experiment', discovery: d.id }, salience: 3, causes: [{ event: ev.id }] });
      return out;
    }
    case 'burned': {
      const o = builtNear.sort((a, b) => (a.zone === w.zone ? 0 : 1) - (b.zone === w.zone ? 0 : 1))[0];
      const was = o.kind;
      o.kind = 'scorch';
      o.state.was = was;
      o.state.burnedTick = world.tick;
      const fire = match.contrib.find(x => x.kind === 'fire');
      const causes = [{ object: o.id }];
      if (fire) causes.push({ object: fire.id });
      if (fire && fire.state.byKeeper) {
        for (const x of alive(world)) x.faith = r3(Math.max(-1, x.faith - 0.08));
      }
      emit(world, { ...base, kind: 'burned', target: o.id, data: { was, discovery: d.id, zone: o.zone, at: w.zone, owner: (o.by || [])[0] || null },
        salience: 4, causes });
      // A burned hut teaches a lesson: no fire experiments for a while. With
      // an omen in the air it hardens into the Fire Taboo belief.
      if (was === 'hut') {
        for (const x of alive(world).filter(x => x.zone === w.zone)) x.tabooUntil = world.tick + 24;
        if (omen) formSuperstition(world, w, 'fire_taboo', omen, false);
      }
      return out;
    }
    case 'lost': {
      const o = items[Math.floor(r() * items.length)];
      o.state.gone = true; o.hp = 0;
      const where = reach.includes('riverbank') ? 'river' : 'grass';
      emit(world, { ...base, kind: 'lost', target: o.id, data: { item: o.state.giftId || o.state.curio, where, discovery: d.id },
        salience: 3, causes: [{ object: o.id }] });
      return out;
    }
    case 'superstition': {
      if (formSuperstition(world, w, pickSuperstition(world, omen, d), omen, false)) return out;
      break;
    }
  }
  emit(world, { ...base, kind: 'experiment_failed', data: { zone: w.zone }, salience: 1 });
  return 'nothing';
}

// After a success, an omen nearby can still start a belief (rarely).
export function onExperimentSucceeded(world, w, d, r) {
  const omen = recentOmen(world);
  if (omen && r() < 0.05) formSuperstition(world, w, pickSuperstition(world, omen, d), omen, true);
}
