// actions.js — validateAction / applyAction for Keeper powers and nudges.
// Actions shape conditions only. They NEVER add knowledge (rule zero).
// Validation reads world state alone, so replay rejects exactly what live
// play rejected, with no events.
import { COOLDOWN, COST, POWER } from './constants.js';
import { rngFor } from './rng.js';
import { slotInfo, ZONES, ZONE_IDS } from './geometry.js';
import { r3, clamp, objectAtSlot, findWobblin, alive, liveObjects } from './util.js';
import { emit } from './events.js';
import { makeObject } from './world.js';
import { strike, digPond, flood, freeSlotIn } from './nature.js';
import { grantWishes } from './culture.js';
import { landOnto, powerOnto, quake } from './interactions.js';
import { reactToAction } from './reactions.js';
import { GOAL_BY_ID, progressOf } from './goals.js';
import { isUnlocked, addBelief, BELIEF } from './belief.js';

export const POWERS = ['stone', 'plant', 'rain', 'lightning', 'water', 'season', 'quake'];
export const NUDGES = ['bless', 'curio', 'miracle', 'carry', 'rename', 'move'];
export const MOVABLE = new Set(['stones', 'gift', 'curio', 'sprout', 'clay']);
export const NAME_RE = /^[A-Za-z][A-Za-z' -]{0,13}$/;
export const BLESS_TRAITS = ['curiosity', 'boldness', 'sociability', 'patience', 'caution', 'playfulness', 'piety'];
// Each curio unlocks once a Wobblin has noticed its material.
export const CURIOS = {
  hollow_log: ['tree'],
  flint: ['stones', 'boulder'],
  feather: ['gift', 'bush'],
  reed_bundle: ['reeds'],
  clay_lump: ['clay']
};
export const GIFT_POOL = [
  'flint_stone', 'hollow_log', 'shiny_shell', 'moon_stone', 'feather_crown', 'seed_pouch',
  'honey_comb', 'reed_bundle', 'clay_lump', 'warm_pelt', 'bell_flower', 'firefly_jar'
];

// Three seeded options for a real-world day index.
export function giftOptions(seed, day) {
  const r = rngFor(seed, 'gift', day);
  const pool = GIFT_POOL.slice();
  const out = [];
  for (let i = 0; i < 3; i++) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out;
}

export function unlockedCurios(world) {
  return Object.keys(CURIOS).filter(c => CURIOS[c].some(k => world.noticed[k] !== undefined));
}

export function hasPond(world) { return liveObjects(world).some(o => o.kind === 'pond'); }

function costOf(world, key) {
  if (key === 'season' && world.seasonUses === 0) return 0;
  return COST[key] || 0;
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

const MAX_PILE = 4;

function freeSlotNear(world, zone) {
  return freeSlotIn(world, zone) || ZONES[zone] && ['meadow', 'grove', 'hill', 'hollow'].map(z => freeSlotIn(world, z)).find(Boolean) || null;
}

export function validateAction(world, a) {
  if (!a || typeof a !== 'object') return bad('malformed');
  if (a.t !== world.tick) return bad('wrong_tick');

  if (a.type === 'power' || a.type === 'nudge') {
    const key = a.type === 'power' ? a.power : a.nudge;
    const list = a.type === 'power' ? POWERS : NUDGES;
    if (!list.includes(key)) return bad('unknown_' + a.type);
    if (!isUnlocked(world, key)) return bad('locked_power');
    if (world.cooldowns[key] > world.tick) return bad('cooldown');
    if (world.devotion < costOf(world, key)) return bad('devotion');
  }

  if ((a.type === 'power' || a.type === 'gift') && a.onto !== undefined) {
    // Dropped right on a Wobblin's head (stones, seeds, lightning, the gift).
    if (a.type === 'power' && !['stone', 'plant', 'lightning'].includes(a.power)) return bad('onto');
    const w = findWobblin(world, a.onto);
    if (!w || !w.alive) return bad('onto');
  }

  if (a.type === 'power') {
    switch (a.power) {
      case 'stone': {
        if (a.variant !== 'stones' && a.variant !== 'boulder') return bad('variant');
        if (a.onto !== undefined && a.slot === undefined) return { ok: true };   // straight onto a head, then gone
        if (!slotInfo(a.slot)) return bad('slot');
        const there = objectAtSlot(world, a.slot);
        // More stones on a small pile just make the pile bigger.
        if (there && !(a.variant === 'stones' && there.kind === 'stones' && (there.state.count || 1) < MAX_PILE)) return bad('occupied');
        if (a.variant === 'boulder' && !boulderSlots(world, a.slot)) return bad('no_room');
        return { ok: true };
      }
      case 'plant': {
        if (a.variant !== 'tree' && a.variant !== 'bush') return bad('variant');
        if (a.onto !== undefined && a.slot === undefined) return { ok: true };   // a seed that only ever blooms on a head
        const info = slotInfo(a.slot);
        if (!info) return bad('slot');
        if (info.zone === 'riverbank' && a.variant === 'tree') return bad('slot');
        if (objectAtSlot(world, a.slot)) return bad('occupied');
        return { ok: true };
      }
      case 'rain':
        return { ok: true };
      case 'lightning':
        return slotInfo(a.slot) ? { ok: true } : bad('slot');
      case 'water': {
        if (!hasPond(world)) {
          if (objectAtSlot(world, 'pondsite.1') || objectAtSlot(world, 'pondsite.2')) return bad('occupied');
          return { ok: true };
        }
        const info = slotInfo(a.slot);
        if (!info || info.zone !== 'riverbank') return bad('slot');
        if (world.riverBend === a.slot) return bad('already');
        return { ok: true };
      }
      case 'season':
        return a.variant === 'cold' || a.variant === 'warm' ? { ok: true } : bad('variant');
      case 'quake':
        return { ok: true };
    }
    return bad('unknown_power');
  }

  if (a.type === 'nudge') {
    switch (a.nudge) {
      case 'bless': {
        const w = findWobblin(world, a.target);
        if (!w || !w.alive) return bad('target');
        if (!BLESS_TRAITS.includes(a.trait)) return bad('trait');
        return { ok: true };
      }
      case 'curio': {
        if (!CURIOS[a.curio]) return bad('curio');
        if (!unlockedCurios(world).includes(a.curio)) return bad('locked');
        if (!Array.isArray(a.targets) || a.targets.length !== 2 || a.targets[0] === a.targets[1]) return bad('targets');
        const ws = a.targets.map(id => findWobblin(world, id));
        if (ws.some(w => !w || !w.alive)) return bad('targets');
        if (!freeSlotNear(world, ws[0].zone)) return bad('no_room');
        return { ok: true };
      }
      case 'miracle':
        return { ok: true };
      case 'move': {
        const o = world.objects.find(x => x.id === a.target);
        if (!o || o.state.gone || !MOVABLE.has(o.kind) || !o.slot) return bad('target');
        if (!slotInfo(a.slot) || a.slot === o.slot) return bad('slot');
        if (objectAtSlot(world, a.slot)) return bad('occupied');
        if (o.kind === 'sprout' && slotInfo(a.slot).zone === 'riverbank' && o.state.grows === 'tree') return bad('slot');
        return { ok: true };
      }
      case 'rename': {
        const w = findWobblin(world, a.target);
        if (!w || !w.alive) return bad('target');
        if (typeof a.name !== 'string' || !NAME_RE.test(a.name) || a.name === w.name) return bad('name');
        return { ok: true };
      }
      case 'carry': {
        // Pick a Wobblin up and set it down somewhere. It only moves them.
        const w = findWobblin(world, a.target);
        if (!w || !w.alive) return bad('target');
        if (!ZONE_IDS.includes(a.zone)) return bad('zone');
        if (a.splash && a.zone !== 'riverbank' && a.zone !== 'pondsite') return bad('splash');
        if (a.onto !== undefined) {
          const o = findWobblin(world, a.onto) || world.objects.find(x => x.id === a.onto);
          if (!o || o.alive === false || (o.state && o.state.gone) || a.onto === a.target) return bad('onto');
        }
        return { ok: true };
      }
    }
    return bad('unknown_nudge');
  }

  if (a.type === 'gift') {
    if (!isUnlocked(world, 'gift')) return bad('locked_power');
    if (!Number.isInteger(a.day)) return bad('day');
    if (world.giftsByDay[a.day] !== undefined) return bad('gift_used');
    if (!giftOptions(world.seed, a.day).includes(a.giftId)) return bad('gift_option');
    if (a.slot !== undefined) {
      if (!slotInfo(a.slot)) return bad('slot');
      if (objectAtSlot(world, a.slot)) return bad('occupied');
    } else if (!freeSlotNear(world, 'meadow')) return bad('no_room');
    return { ok: true };
  }

  if (a.type === 'collect_offerings') {
    if (world.offerings <= 0) return bad('nothing');
    return { ok: true };
  }

  if (a.type === 'claim') {
    const g = GOAL_BY_ID[a.goal];
    if (!g) return bad('goal');
    if ((world.goalsClaimed || []).includes(g.id)) return bad('claimed');
    if (!g.done(progressOf(world))) return bad('not_yet');
    return { ok: true };
  }

  return bad('unknown_type');
}

function faithAll(world, d) {
  for (const w of alive(world)) w.faith = r3(clamp(w.faith + d, -1, 1));
}

function witnesses(world, zone, except) {
  return alive(world).filter(w => w.zone === zone && w.id !== except).map(w => w.id);
}

// Apply a valid action, then record how each Wobblin felt about it.
export function applyAction(world, a) {
  const firstEvent = world.nextIds.e;
  const res = applyActionEffects(world, a);
  if (!res.ok || a.type === 'claim') return res;   // claiming a goal is bookkeeping: nobody reacts
  let ev = null;
  for (let i = world.events.length - 1; i >= 0 && world.events[i].id >= firstEvent; i--) {
    if (KEEPER_EVENT.has(world.events[i].kind)) ev = world.events[i];   // the earliest one this action made
  }
  reactToAction(world, a, ev || null);
  return res;
}

const KEEPER_EVENT = new Set(['keeper_power', 'keeper_nudge', 'keeper_gift', 'offerings_collected']);

function applyActionEffects(world, a) {
  const v = validateAction(world, a);
  if (!v.ok) return v;
  const origin = { action: a.seq };
  const causes = [{ action: a.seq }];
  const t = world.tick;
  if (a.type === 'claim') {
    const g = GOAL_BY_ID[a.goal];
    world.goalsClaimed = [...(world.goalsClaimed || []), g.id];
    const ev = emit(world, { kind: 'goal_reached', target: g.id, data: { goal: g.id, text: g.text, belief: g.belief }, salience: 3, causes });
    addBelief(world, g.belief, [{ event: ev.id }]);
    return { ok: true };
  }
  world.lastKeeperTick = t;

  if (a.type === 'power' || a.type === 'nudge') {
    const key = a.type === 'power' ? a.power : a.nudge;
    if (COOLDOWN[key]) world.cooldowns[key] = t + COOLDOWN[key];
    world.devotion = r3(world.devotion - costOf(world, key));
  }

  const power = (data, target, salience = 2) =>
    emit(world, { kind: 'keeper_power', target: target || null, data, salience, causes });

  if (a.type === 'power') {
    switch (a.power) {
      case 'stone': {
        if (a.slot === undefined) {
          const w = findWobblin(world, a.onto);
          const ev = power({ power: 'stone', variant: a.variant, zone: w.zone, onto: a.onto, bounced: true }, null);
          powerOnto(world, w, a, ev);
          break;
        }
        const pile = a.variant === 'stones' && objectAtSlot(world, a.slot);
        if (pile) {
          pile.state.count = (pile.state.count || 1) + 1;
          pile.builtTick = t;   // freshly topped up
          const ev = power({ power: 'stone', variant: 'stones', slot: a.slot, zone: pile.zone, added: true, ...(a.onto ? { onto: a.onto } : {}) }, pile.id);
          if (a.onto) powerOnto(world, findWobblin(world, a.onto), a, ev);
          break;
        }
        const slots = a.variant === 'boulder' ? boulderSlots(world, a.slot) : null;
        const o = makeObject(world, {
          kind: a.variant, slot: a.slot, slots: slots || undefined, origin,
          state: { count: a.variant === 'boulder' ? 4 : 1 }
        });
        const ev = power({ power: 'stone', variant: a.variant, slot: a.slot, zone: o.zone, ...(a.onto ? { onto: a.onto } : {}) }, o.id);
        if (a.onto) powerOnto(world, findWobblin(world, a.onto), a, ev);
        break;
      }
      case 'plant': {
        if (a.slot === undefined) {
          const w = findWobblin(world, a.onto);
          const ev = power({ power: 'plant', variant: a.variant, zone: w.zone, onto: a.onto }, null);
          powerOnto(world, w, a, ev);
          break;
        }
        const o = makeObject(world, {
          kind: 'sprout', slot: a.slot, origin,
          state: { grows: a.variant, readyAt: t + POWER.sproutGrowTicks }
        });
        const ev = power({ power: 'plant', variant: a.variant, slot: a.slot, zone: o.zone, ...(a.onto ? { onto: a.onto } : {}) }, o.id);
        if (a.onto) powerOnto(world, findWobblin(world, a.onto), a, ev);
        break;
      }
      case 'rain': {
        world.rainUses = world.rainUses.filter(x => t - x <= POWER.floodWindow).concat([t]);
        const ev = power({ power: 'rain', ticks: POWER.rainTicks });
        world.climate.rain = POWER.rainTicks;
        world.climate.rainEvent = ev.id;
        world.climate.wetUntil = t + POWER.rainTicks + POWER.wetTicks;
        for (const f of liveObjects(world).filter(o => o.kind === 'fire' && !o.state.kept)) f.state.until = t;
        if (world.rainUses.length >= POWER.floodUses) {
          world.rainUses = [];
          flood(world, [{ action: a.seq }, { event: ev.id }]);
        }
        break;
      }
      case 'lightning': {
        const ev = strike(world, a.slot, causes, { power: 'lightning', zone: slotInfo(a.slot).zone, ...(a.onto ? { onto: a.onto } : {}) });
        if (a.onto) powerOnto(world, findWobblin(world, a.onto), a, ev);
        break;
      }
      case 'water': {
        if (!hasPond(world)) {
          const ev = power({ power: 'water', variant: 'pond', zone: 'pondsite' }, null, 3);
          digPond(world, ev.id);
        } else {
          world.riverBend = a.slot;
          const ev = power({ power: 'water', variant: 'bend', slot: a.slot, zone: 'riverbank' });
          makeObject(world, { kind: 'fish', slot: null, zone: 'riverbank', origin: { event: ev.id }, state: { until: t + 12 } });
        }
        break;
      }
      case 'quake': {
        const ev = power({ power: 'quake' }, null, 3);
        quake(world, ev);
        break;
      }
      case 'season': {
        world.seasonUses++;
        const c = world.climate;
        c.season = a.variant;
        c.tempMod = a.variant === 'cold' ? -0.06 : 0.05;
        c.until = t + POWER.seasonTicks;
        power({ power: 'season', variant: a.variant, ticks: POWER.seasonTicks }, null, 3);
        break;
      }
    }
    grantWishes(world, a, world.events[world.events.length - 1].id);
    return { ok: true };
  }

  if (a.type === 'nudge') {
    if (a.nudge === 'bless') {
      const w = findWobblin(world, a.target);
      w.temp[a.trait] = { add: POWER.blessAdd, until: t + POWER.blessTicks };
      w.faith = r3(clamp(w.faith + 0.1, -1, 1));
      const seen = witnesses(world, w.zone, w.id);
      for (const id of [w.id, ...seen]) findWobblin(world, id).witnessed = true;
      emit(world, { kind: 'keeper_nudge', actors: [w.id, ...seen], target: w.id,
        data: { nudge: 'bless', trait: a.trait, witnesses: seen }, salience: 2, causes });
    } else if (a.nudge === 'curio') {
      const [w1, w2] = a.targets.map(id => findWobblin(world, id));
      const slot = freeSlotNear(world, w1.zone);
      const o = makeObject(world, { kind: 'curio', slot, origin,
        state: { curio: a.curio, targets: a.targets.slice(), until: t + POWER.curioTicks } });
      emit(world, { kind: 'keeper_nudge', actors: [w1.id, w2.id], target: o.id,
        data: { nudge: 'curio', curio: a.curio, zone: o.zone }, salience: 2, causes });
    } else if (a.nudge === 'carry') {
      const w = findWobblin(world, a.target);
      const from = w.zone;
      w.zone = a.zone;
      w.heldUntil = t + POWER.carryStay;
      // Playful ones love the ride; timid ones find it a bit much.
      w.needs.mood = r3(clamp(w.needs.mood + 0.06 * w.traits.playfulness, 0, 1));
      w.needs.safety = r3(clamp(w.needs.safety - 0.08 * (1 - w.traits.boldness), 0, 1));
      if (a.thrown) {
        // Flung through the air: playful ones whoop, timid ones are a bit shaken,
        // and everyone trusts the sky-hand slightly less. Never hurt.
        w.needs.mood = r3(clamp(w.needs.mood + 0.12 * (w.traits.playfulness - 0.4), 0, 1));
        w.needs.safety = r3(clamp(w.needs.safety - 0.15 * (1 - w.traits.boldness), 0, 1));
        w.faith = r3(clamp(w.faith - 0.02, -1, 1));
      }
      if (a.splash) w.needs.warmth = r3(clamp(w.needs.warmth - 0.15, 0, 1));   // a dunk in the river is chilly
      emit(world, { kind: 'keeper_nudge', actors: [w.id], target: w.id,
        data: { nudge: 'carry', from, zone: a.zone, ...(a.thrown ? { thrown: true } : {}), ...(a.splash ? { splash: true } : {}) },
        salience: a.thrown ? 2 : 1, causes });
      if (a.onto !== undefined) landOnto(world, w, a, causes);
    } else if (a.nudge === 'move') {
      // Picked up and set down somewhere else. Moving it doesn't make it new.
      const o = world.objects.find(x => x.id === a.target);
      const from = o.zone;
      o.slot = a.slot; o.zone = slotInfo(a.slot).zone;
      emit(world, { kind: 'keeper_nudge', actors: witnesses(world, o.zone), target: o.id, data: { nudge: 'move', kind: o.kind, from, zone: o.zone, slot: a.slot }, salience: 1, causes });
    } else if (a.nudge === 'rename') {
      // The Keeper gives them a name of your own choosing. They rather like it.
      const w = findWobblin(world, a.target);
      const from = w.name;
      w.name = a.name;
      w.needs.mood = r3(clamp(w.needs.mood + 0.05, 0, 1));
      emit(world, { kind: 'keeper_nudge', actors: [w.id], target: w.id, data: { nudge: 'rename', from, to: a.name }, salience: 1, causes });
    } else if (a.nudge === 'miracle') {
      world.miracleUntil = t + POWER.miracleTicks;
      faithAll(world, 0.15);
      const seen = alive(world).map(w => w.id);
      for (const x of alive(world)) x.witnessed = true;
      emit(world, { kind: 'keeper_nudge', actors: seen, data: { nudge: 'miracle', ticks: POWER.miracleTicks, witnesses: seen },
        salience: 4, causes });
      grantWishes(world, a, world.events[world.events.length - 1].id);
    }
    return { ok: true };
  }

  if (a.type === 'gift') {
    world.giftsByDay[a.day] = a.giftId;
    const o = makeObject(world, { kind: 'gift', slot: a.slot !== undefined ? a.slot : freeSlotNear(world, 'meadow'), origin, state: { giftId: a.giftId } });
    const ev = emit(world, { kind: 'keeper_gift', actors: witnesses(world, o.zone), target: o.id,
      data: { giftId: a.giftId, day: a.day, zone: o.zone, ...(a.onto ? { onto: a.onto } : {}) }, salience: 2, causes });
    if (a.onto) powerOnto(world, findWobblin(world, a.onto), a, ev);
    return { ok: true };
  }

  if (a.type === 'collect_offerings') {
    const n = world.offerings;
    world.devotion = r3(world.devotion + n);
    world.offerings = 0;
    const ev = emit(world, { kind: 'offerings_collected', data: { amount: n }, salience: 1, causes });
    addBelief(world, n * BELIEF.perOffering, [{ event: ev.id }]);
    return { ok: true };
  }
  return { ok: false, reason: 'unreachable' };
}
