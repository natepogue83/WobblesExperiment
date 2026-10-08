// actions.js — validateAction / applyAction for Keeper powers and nudges.
// Actions shape conditions only. They NEVER add knowledge (rule zero).
// Validation reads world state alone, so replay rejects exactly what live
// play rejected, with no events.
//
// Day 1: the full validation frame for every action type, with effects for
// stone, plant, rain, bless, gift and collect_offerings. Lightning, water,
// season, curio and miracle effects land on Day 3 (rejected until then).
import { COOLDOWN, COST, POWER } from './constants.js';
import { rngFor } from './rng.js';
import { slotInfo, ZONES } from './geometry.js';
import { r3, clamp, objectAtSlot, findWobblin } from './util.js';
import { emit } from './events.js';
import { makeObject } from './world.js';

export const POWERS = ['stone', 'plant', 'rain', 'lightning', 'water', 'season'];
export const NUDGES = ['bless', 'curio', 'miracle'];
export const BLESS_TRAITS = ['curiosity', 'boldness', 'sociability', 'patience'];
export const CURIOS = ['hollow_log', 'flint', 'feather', 'reed_bundle', 'clay_lump'];
export const GIFT_POOL = [
  'flint_stone', 'hollow_log', 'shiny_shell', 'moon_stone', 'feather_crown', 'seed_pouch',
  'honey_comb', 'reed_bundle', 'clay_lump', 'warm_pelt', 'bell_flower', 'firefly_jar'
];
const IMPLEMENTED = new Set(['stone', 'plant', 'rain', 'bless']);

// Three seeded options for a real-world day index.
export function giftOptions(seed, day) {
  const r = rngFor(seed, 'gift', day);
  const pool = GIFT_POOL.slice();
  const out = [];
  for (let i = 0; i < 3; i++) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out;
}

function bad(reason) { return { ok: false, reason }; }

function boulderSlots(world, slot) {
  const info = slotInfo(slot);
  const n = ZONES[info.zone].slots.length;
  const next = info.index + 2 <= n ? info.index + 2 : info.index;  // 1-based neighbour
  const other = info.zone + '.' + next;
  if (other === slot || objectAtSlot(world, other)) return null;
  return [slot, other];
}

export function validateAction(world, a) {
  if (!a || typeof a !== 'object') return bad('malformed');
  if (a.t !== world.tick) return bad('wrong_tick');
  const cdKey = a.type === 'power' ? a.power : a.type === 'nudge' ? a.nudge : null;

  if (a.type === 'power' || a.type === 'nudge') {
    const list = a.type === 'power' ? POWERS : NUDGES;
    if (!list.includes(cdKey)) return bad('unknown_' + a.type);
    if (!IMPLEMENTED.has(cdKey)) return bad('not_implemented');
    if (world.cooldowns[cdKey] > world.tick) return bad('cooldown');
    const cost = cdKey === 'season' && world.seasonUses === 0 ? 0 : (COST[cdKey] || 0);
    if (world.devotion < cost) return bad('devotion');
  }

  if (a.type === 'power') {
    switch (a.power) {
      case 'stone': {
        if (a.variant !== 'stones' && a.variant !== 'boulder') return bad('variant');
        if (!slotInfo(a.slot)) return bad('slot');
        if (objectAtSlot(world, a.slot)) return bad('occupied');
        if (a.variant === 'boulder' && !boulderSlots(world, a.slot)) return bad('no_room');
        return { ok: true };
      }
      case 'plant': {
        if (a.variant !== 'tree' && a.variant !== 'bush') return bad('variant');
        const info = slotInfo(a.slot);
        if (!info) return bad('slot');
        if (info.zone === 'riverbank' && a.variant === 'tree') return bad('slot');
        if (objectAtSlot(world, a.slot)) return bad('occupied');
        return { ok: true };
      }
      case 'rain':
        return { ok: true };
    }
    return bad('unknown_power');
  }

  if (a.type === 'nudge') {
    if (a.nudge === 'bless') {
      const w = findWobblin(world, a.target);
      if (!w || !w.alive) return bad('target');
      if (!BLESS_TRAITS.includes(a.trait)) return bad('trait');
      return { ok: true };
    }
    return bad('unknown_nudge');
  }

  if (a.type === 'gift') {
    if (!Number.isInteger(a.day)) return bad('day');
    if (world.giftsByDay[a.day] !== undefined) return bad('gift_used');
    if (!giftOptions(world.seed, a.day).includes(a.giftId)) return bad('gift_option');
    if (!freeSlot(world, 'meadow')) return bad('no_room');
    return { ok: true };
  }

  if (a.type === 'collect_offerings') {
    if (world.offerings <= 0) return bad('nothing');
    return { ok: true };
  }

  return bad('unknown_type');
}

function freeSlot(world, zone) {
  for (let i = 1; i <= ZONES[zone].slots.length; i++) {
    const s = zone + '.' + i;
    if (!objectAtSlot(world, s)) return s;
  }
  return null;
}

export function applyAction(world, a) {
  const v = validateAction(world, a);
  if (!v.ok) return v;
  const origin = { action: a.seq };
  const causes = [{ action: a.seq }];
  const t = world.tick;

  if (a.type === 'power' || a.type === 'nudge') {
    const key = a.type === 'power' ? a.power : a.nudge;
    world.cooldowns[key] = t + COOLDOWN[key];
    const cost = key === 'season' && world.seasonUses === 0 ? 0 : (COST[key] || 0);
    world.devotion = r3(world.devotion - cost);
  }

  if (a.type === 'power') {
    if (a.power === 'stone') {
      const slots = a.variant === 'boulder' ? boulderSlots(world, a.slot) : null;
      const o = makeObject(world, {
        kind: a.variant, slot: a.slot, slots: slots || undefined, origin,
        state: { count: a.variant === 'boulder' ? 4 : 1 }
      });
      emit(world, { kind: 'keeper_power', target: o.id, data: { power: 'stone', variant: a.variant, slot: a.slot }, salience: 2, causes });
    } else if (a.power === 'plant') {
      const o = makeObject(world, {
        kind: 'sprout', slot: a.slot, origin,
        state: { grows: a.variant, readyAt: t + POWER.sproutGrowTicks }
      });
      emit(world, { kind: 'keeper_power', target: o.id, data: { power: 'plant', variant: a.variant, slot: a.slot }, salience: 2, causes });
    } else if (a.power === 'rain') {
      world.climate.rain = POWER.rainTicks;
      world.climate.wetUntil = t + POWER.rainTicks + POWER.wetTicks;
      emit(world, { kind: 'keeper_power', data: { power: 'rain', ticks: POWER.rainTicks }, salience: 2, causes });
    }
    return { ok: true };
  }

  if (a.type === 'nudge' && a.nudge === 'bless') {
    const w = findWobblin(world, a.target);
    w.temp[a.trait] = { add: POWER.blessAdd, until: t + POWER.blessTicks };
    w.faith = r3(clamp(w.faith + 0.1, -1, 1));
    emit(world, { kind: 'keeper_nudge', actors: [w.id], target: w.id, data: { nudge: 'bless', trait: a.trait }, salience: 2, causes });
    return { ok: true };
  }

  if (a.type === 'gift') {
    world.giftsByDay[a.day] = a.giftId;
    const o = makeObject(world, { kind: 'gift', slot: freeSlot(world, 'meadow'), origin, state: { giftId: a.giftId } });
    emit(world, { kind: 'keeper_gift', target: o.id, data: { giftId: a.giftId, day: a.day }, salience: 2, causes });
    return { ok: true };
  }

  if (a.type === 'collect_offerings') {
    const n = world.offerings;
    world.devotion = r3(world.devotion + n);
    world.offerings = 0;
    emit(world, { kind: 'offerings_collected', data: { amount: n }, salience: 1, causes });
    return { ok: true };
  }
  return { ok: false, reason: 'unreachable' };
}
