// interactions.js — things bump into things. When the Keeper drops or flings a
// Wobblin onto something, or lightning hits something odd, the world reacts in
// its own (often funny) way, with consequences that last: squashed bushes,
// stunned fish, split boulders, a hut with a Wobblin-shaped hole in the roof,
// new friendships and grudges. Deterministic; never adds knowledge.
import { emit } from './events.js';
import { rngFor } from './rng.js';
import { alive, liveObjects, findWobblin, findObject, r3, clamp, clamp01 } from './util.js';
import { makeObject } from './world.js';
import { slotIds } from './geometry.js';
import { practice, shapeTrait } from './growth.js';

// ---- bonds: friends and rivals --------------------------------------------------
export function bond(w, otherId) { return (w.bonds && w.bonds[otherId]) || 0; }
export function addBond(world, a, b, d) {
  if (!a || !b || a === b) return;
  for (const [x, y] of [[a, b], [b, a]]) {
    x.bonds ||= {};
    const before = x.bonds[y.id] || 0;
    const after = r3(clamp(before + d, -1, 1));
    x.bonds[y.id] = after;
    if (x === a) {
      if (before < 0.5 && after >= 0.5) emit(world, { kind: 'friends', actors: [a.id, b.id], data: {}, salience: 3 });
      if (before > -0.4 && after <= -0.4) emit(world, { kind: 'rivals', actors: [a.id, b.id], data: {}, salience: 3 });
    }
  }
}

function mood(w, d) { w.needs.mood = r3(clamp01(w.needs.mood + d)); }
function witnessesOf(world, zone, except) { return alive(world).filter(x => x.zone === zone && !except.includes(x.id)); }

function freeSlotIn(world, zone) {
  for (const s of slotIds(zone)) if (!liveObjects(world).some(o => o.slot === s || (o.slots && o.slots.includes(s)))) return s;
  return null;
}

// What a carried Wobblin lands on. Returns the interaction event or null.
export function landOnto(world, w, a, causes) {
  const t = world.tick;
  const r = rngFor(world.seed, 'interact', t, a.seq);
  const thrown = !!a.thrown;
  const say = (kind, data, salience = 2, actors = [w.id], extra = []) =>
    emit(world, { kind: 'interaction', actors, target: a.onto, data: { what: kind, thrown, ...data }, salience, causes: [...causes, ...extra] });
  const laugh = (except) => { for (const x of witnessesOf(world, w.zone, except)) mood(x, 0.04); };

  const other = findWobblin(world, a.onto);
  if (other && other.alive && other !== w) {
    const friends = bond(w, other.id) > 0.2 || w.partnerId === other.id || w.parents.includes(other.id) || other.parents.includes(w.id);
    if (!thrown && (friends || r() < 0.5 + w.traits.sociability * 0.4)) {
      mood(w, 0.1); mood(other, 0.1);
      addBond(world, w, other, 0.15);
      return say('hug', {}, 2, [w.id, other.id]);
    }
    // Flung into someone (or an unwelcome drop): a bonk, and a grudge.
    mood(w, -0.08); mood(other, -0.12);
    other.heldUntil = t + 2; w.heldUntil = t + 2;
    addBond(world, w, other, thrown ? -0.3 : -0.15);
    laugh([w.id, other.id]);
    return say(thrown ? 'bowled_over' : 'bonk', {}, 3, [w.id, other.id]);
  }

  const o = findObject(world, a.onto);
  if (!o || o.state.gone) return null;
  switch (o.kind) {
    case 'bush': {
      if (thrown) {
        const lost = o.state.berries || 0;
        o.state.berries = 0;
        w.needs.food = r3(clamp01(w.needs.food + 0.1 * lost));
        laugh([w.id]);
        return say('bush_squashed', { berries: lost }, 3, [w.id], [{ object: o.id }]);
      }
      if ((o.state.berries || 0) > 0) {
        o.state.berries--;
        w.needs.food = r3(clamp01(w.needs.food + 0.3));
        mood(w, 0.06);
        practice(world, w, 'foraging', 2);
        return say('snack', {}, 2, [w.id], [{ object: o.id }]);
      }
      return say('empty_bush', {}, 1);
    }
    case 'tree': {
      if (thrown) {
        w.heldUntil = t + 3;
        mood(w, w.traits.playfulness > 0.5 ? 0.08 : -0.1);
        laugh([w.id]);
        // The bump shakes a seed loose: a sprout pops up nearby.
        const slot = freeSlotIn(world, o.zone);
        if (slot && r() < 0.5) makeObject(world, { kind: 'sprout', slot, origin: { action: a.seq }, state: { grows: r() < 0.5 ? 'tree' : 'bush', readyAt: t + 6 } });
        return say('stuck_in_tree', { sprouted: !!slot }, 3, [w.id], [{ object: o.id }]);
      }
      mood(w, 0.05); w.needs.rest = r3(clamp01(w.needs.rest + 0.1));
      return say('shade_nap', {}, 1);
    }
    case 'fire': case 'hearth': {
      w.needs.warmth = 1;
      if (w.traits.boldness > 0.7 && !thrown) {
        shapeTrait(w, 'boldness', 0.02); mood(w, 0.08);
        for (const x of witnessesOf(world, w.zone, [w.id])) x.needs.safety = r3(clamp01(x.needs.safety - 0.05));
        return say('fire_walk', {}, 3, [w.id], [{ object: o.id }]);
      }
      // Hot hot hot: a dash for the river.
      mood(w, -0.2);
      shapeTrait(w, 'caution', 0.03);
      w.zone = 'riverbank'; w.heldUntil = t + 2;
      w.needs.warmth = r3(clamp01(w.needs.warmth - 0.3));
      laugh([w.id]);
      return say('singed', {}, 3, [w.id], [{ object: o.id }]);
    }
    case 'pond': case 'fish': {
      const fish = liveObjects(world).find(x => x.kind === 'fish' && (x.zone === o.zone || x === o));
      if (fish && (w.knows.fishing || r() < 0.4)) {
        fish.state.gone = true; fish.hp = 0;
        w.needs.food = r3(clamp01(w.needs.food + 0.4));
        practice(world, w, 'foraging', 3);
        return say('caught_fish', {}, 3, [w.id], [{ object: fish.id }]);
      }
      if (fish && thrown) { fish.state.gone = true; fish.hp = 0; return say('scared_fish', {}, 2, [w.id], [{ object: fish.id }]); }
      return null;
    }
    case 'hut': {
      if (thrown) {
        const was = o.kind;
        o.kind = 'scorch'; o.state.was = was; o.state.burnedTick = t; o.state.wrecked = true;
        w.heldUntil = t + 3; mood(w, -0.05);
        for (const x of witnessesOf(world, o.zone, [w.id])) mood(x, -0.06);
        return say('through_the_roof', {}, 4, [w.id], [{ object: o.id }]);
      }
      w.needs.rest = r3(clamp01(w.needs.rest + 0.2));
      return say('tucked_in', {}, 1);
    }
    case 'stones': {
      o.state.stacked = true;
      practice(world, w, 'building', 3);
      return say('made_a_cairn', {}, 2, [w.id], [{ object: o.id }]);
    }
    case 'gift': case 'curio': {
      w.luckyCharm = o.id; mood(w, 0.12);
      return say('treasure', { item: o.state.giftId || o.state.curio }, 2, [w.id], [{ object: o.id }]);
    }
    case 'boulder': case 'temple': case 'totem': case 'wall': {
      mood(w, w.traits.playfulness * 0.15);
      if (o.kind === 'temple' || o.kind === 'totem') w.faith = r3(clamp(w.faith + 0.05, -1, 1));
      return say('king_of_the_hill', { on: o.kind }, 2, [w.id], [{ object: o.id }]);
    }
    case 'grave': {
      mood(w, -0.08);
      return say('remembers', { of: o.state.name }, 2, [w.id], [{ object: o.id }]);
    }
  }
  return null;
}

// Lightning on things that aren't plants (plants already catch fire).
export function lightningOnto(world, target, strikeEvent) {
  const t = world.tick;
  const causes = [{ event: strikeEvent.id }];
  if (target && target.kind === 'boulder') {
    // Cracked clean in two: a pile of stones in each of its spots.
    target.state.gone = true; target.hp = 0;
    for (const s of target.slots || [target.slot]) makeObject(world, { kind: 'stones', slot: s, origin: { event: strikeEvent.id }, state: { count: 2 } });
    return emit(world, { kind: 'interaction', target: target.id, data: { what: 'boulder_split' }, salience: 3, causes });
  }
  if (target && target.kind === 'hut') {
    target.kind = 'scorch'; target.state.was = 'hut'; target.state.burnedTick = t;
    for (const x of alive(world).filter(x => x.zone === target.zone)) { mood(x, -0.15); x.faith = r3(clamp(x.faith - 0.05, -1, 1)); }
    return emit(world, { kind: 'burned', target: target.id, data: { was: 'hut', zone: target.zone, at: target.zone, by: 'lightning', discovery: null, owner: (target.by || [])[0] || null }, salience: 4, causes });
  }
  return null;
}

// Lightning in the water: stunned fish bob up for anyone who wants them.
export function lightningInWater(world, zone, strikeEvent) {
  const n = 1 + (rngFor(world.seed, 'stunfish', world.tick)() < 0.5 ? 1 : 0);
  for (let i = 0; i < n; i++) makeObject(world, { kind: 'fish', slot: null, zone, origin: { event: strikeEvent.id }, state: { until: world.tick + 6, stunned: true } });
  return emit(world, { kind: 'interaction', data: { what: 'fish_stunned', zone, count: n }, salience: 3, causes: [{ event: strikeEvent.id }] });
}

// Daily social life: time together builds friendships; grumpy rivals squabble.
export function socialStep(world) {
  const live = alive(world);
  const r = rngFor(world.seed, 'social', world.tick);
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j];
    if (a.zone !== b.zone) continue;
    const b0 = bond(a, b.id);
    // Opposites grate: a wild one and a worrier rub each other the wrong way.
    const clash = Math.max(0, Math.abs(a.traits.playfulness - b.traits.playfulness) + Math.abs((a.traits.caution || 0.5) - (b.traits.caution || 0.5)) - 0.55);
    addBond(world, a, b, 0.012 * (a.traits.sociability + b.traits.sociability) - 0.05 * clash);
    // Two hungry Wobblins after the same few berries get on each other's nerves.
    if (a.needs.food < 0.3 && b.needs.food < 0.3 && a.activity === 'forage' && b.activity === 'forage') addBond(world, a, b, -0.05 - 0.04 * (1 - (a.traits.sociability + b.traits.sociability) / 2));
    if (b0 < -0.2 && a.needs.mood < 0.5 && b.needs.mood < 0.5 && r() < 0.08) {
      mood(a, -0.05); mood(b, -0.05);
      emit(world, { kind: 'interaction', actors: [a.id, b.id], data: { what: 'squabble' }, salience: 2 });
    }
  }
}

// A cold snap freezes the pond: playful Wobblins go skating, careful ones slip.
export function iceStep(world) {
  const pond = liveObjects(world).find(o => o.kind === 'pond');
  if (!pond) return;
  const frozen = world.climate.season === 'cold';
  if (frozen !== !!pond.state.frozen) {
    if (frozen) pond.state.frozen = true; else delete pond.state.frozen;
    emit(world, { kind: 'interaction', target: pond.id, data: { what: frozen ? 'pond_froze' : 'pond_thawed' }, salience: 2, causes: [{ object: pond.id }] });
  }
  if (!frozen) return;
  const r = rngFor(world.seed, 'ice', world.tick);
  for (const w of alive(world).filter(x => x.zone === 'pondsite' && x.stage !== 'baby')) {
    if (r() > 0.2) continue;
    const fun = w.traits.playfulness > 0.45;
    mood(w, fun ? 0.1 : -0.05);
    emit(world, { kind: 'interaction', actors: [w.id], target: pond.id, data: { what: fun ? 'skating' : 'slipped' }, salience: 2 });
  }
}
