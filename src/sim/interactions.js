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
import { SOCIAL } from './constants.js';

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
      // Frozen: they slide right across, squealing (or flat on their face).
      const pond = o.kind === 'pond' ? o : liveObjects(world).find(x => x.kind === 'pond');
      if (pond && pond.state.frozen && o.kind === 'pond') {
        const fun = w.traits.playfulness > 0.45 || thrown;
        mood(w, fun ? 0.12 : -0.06);
        laugh([w.id]);
        return say(fun ? 'skating' : 'slipped', { flung: thrown }, 2, [w.id], [{ object: pond.id }]);
      }
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

// A Keeper power dropped right on a Wobblin's head. Pocket God slapstick, with
// consequences: bumps and grudges, a flower crown, a frizzy zap that sometimes
// knocks an idea loose (a short curiosity boost; the idea itself still has to be
// worked out in experiment.js). A squash or zap can hurt, but never fatally.
export function powerOnto(world, w, a, ev) {
  if (!w || !w.alive) return null;
  const t = world.tick;
  const r = rngFor(world.seed, 'onto', t, a.seq);
  const causes = [{ event: ev.id }];
  const say = (what, data = {}, salience = 3) =>
    emit(world, { kind: 'interaction', actors: [w.id], target: w.id, data: { what, ...data }, salience, causes });
  const laugh = () => { for (const x of witnessesOf(world, w.zone, [w.id])) mood(x, r3(0.02 + 0.04 * x.traits.playfulness)); };
  const faith = d => { w.faith = r3(clamp(w.faith + d, -1, 1)); };
  const hurt = () => {
    if (w.injuries >= SOCIAL.injuryDeath - 1) return false;
    w.injuries++;
    emit(world, { kind: 'injured', actors: [w.id], data: { cause: a.type === 'power' ? a.power : a.type, zone: w.zone }, salience: 3, causes });
    return true;
  };
  const idea = (add, ticks) => {
    const cur = w.temp.curiosity;
    if (!cur || cur.until <= t || cur.add < add) w.temp.curiosity = { add, until: t + ticks };
  };
  if (a.type === 'gift') {
    w.luckyCharm = ev.target; mood(w, 0.15); faith(0.05);
    return say('gift_caught', { item: a.giftId }, 2);
  }
  switch (a.power) {
    case 'stone':
      if (a.variant === 'boulder') {
        const hurtNow = hurt();
        mood(w, -0.2); faith(-0.08); w.heldUntil = t + 3;
        shapeTrait(w, 'caution', 0.04);
        for (const x of witnessesOf(world, w.zone, [w.id])) x.needs.safety = r3(clamp01(x.needs.safety - 0.1));
        return say('squashed', { hurt: hurtNow }, 4);
      }
      mood(w, -0.06); faith(-0.02); w.heldUntil = t + 1;
      laugh();
      if (r() < 0.4) { idea(0.15, 3); return say('bonk_idea'); }
      return say('bonked');
    case 'plant':
      w.flowerUntil = t + 24; mood(w, 0.12); faith(0.02);
      shapeTrait(w, 'playfulness', 0.01);
      return say('flower_crown', { variant: a.variant }, 2);
    case 'lightning': {
      w.zappedUntil = t + 3; w.heldUntil = t + 2; w.needs.warmth = 1;
      const bold = w.traits.boldness > 0.65;
      const hurtNow = !bold && r() < 0.3 * (1.2 - w.traits.boldness) && hurt();
      if (bold) { mood(w, 0.1); shapeTrait(w, 'boldness', 0.02); faith(0.03); }
      else { mood(w, -0.12); shapeTrait(w, 'caution', 0.03); faith(-0.06); }
      const bright = r() < 0.5;
      if (bright) idea(0.2, 4);
      return say('zapped', { bold, idea: bright, hurt: !!hurtNow });
    }
  }
  return null;
}

// The Keeper shakes the whole valley. Berries rain down (a feast, for once),
// cairns topple, fish leap, a seed or two shakes loose, an old wall may fall,
// and everyone has an opinion: playful ones whoop, careful ones never forget.
export function quake(world, ev) {
  const t = world.tick;
  const r = rngFor(world.seed, 'quake', t);
  const causes = [{ event: ev.id }];
  const live = alive(world);
  const out = { berries: 0, toppled: 0, sprouts: 0, fish: 0, walls: 0 };
  for (const o of liveObjects(world)) {
    if (o.kind === 'bush' && (o.state.berries || 0) > 0) {
      const n = o.state.berries; o.state.berries = 0; out.berries += n;
      for (const w of live.filter(x => x.zone === o.zone)) w.needs.food = r3(clamp01(w.needs.food + 0.08 * n));
    } else if (o.kind === 'stones' && o.state.stacked) { o.state.stacked = false; out.toppled++; }
    else if (o.kind === 'tree' && r() < 0.35) {
      const slot = freeSlotIn(world, o.zone);
      if (slot) { makeObject(world, { kind: 'sprout', slot, origin: { event: ev.id }, state: { grows: r() < 0.5 ? 'tree' : 'bush', readyAt: t + 6 } }); out.sprouts++; }
    } else if (o.kind === 'wall' && r() < 0.25) { o.kind = 'ruin'; o.state.was = 'wall'; o.builtTick = t; out.walls++; }
  }
  if (r() < 0.7) { makeObject(world, { kind: 'fish', slot: null, zone: 'riverbank', origin: { event: ev.id }, state: { until: t + 8 } }); out.fish++; }
  for (const w of live) {
    w.heldUntil = Math.max(w.heldUntil || 0, t + 1);
    if (w.activity === 'rest') w.needs.rest = r3(clamp01(w.needs.rest - 0.15));   // rudely woken
    const fun = w.traits.playfulness > 0.6 && w.traits.boldness > 0.4;
    if (fun) mood(w, 0.08);
    else { w.needs.safety = r3(clamp01(w.needs.safety - 0.25)); shapeTrait(w, 'caution', 0.02); }
    w.faith = r3(clamp(w.faith + (w.traits.piety > 0.6 ? 0.03 : -0.02), -1, 1));   // the devout think you are speaking to them
  }
  return emit(world, { kind: 'interaction', actors: live.map(w => w.id).slice(0, 8), data: { what: 'quake', ...out }, salience: 3, causes });
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
  if (target && target.kind === 'stones') {
    // KABOOM: the pile (or cairn) bursts, stones everywhere, nobody hurt.
    const was = target.state.stacked ? 'cairn' : 'pile';
    target.state.stacked = false; target.state.count = 1;
    for (const x of alive(world).filter(x => x.zone === target.zone)) { x.needs.safety = r3(clamp01(x.needs.safety - 0.1)); if (x.traits.playfulness > 0.6) mood(x, 0.05); }
    return emit(world, { kind: 'interaction', target: target.id, data: { what: 'stones_burst', was, zone: target.zone }, salience: 2, causes });
  }
  if (target && (target.kind === 'totem' || target.kind === 'temple')) {
    // It hums with your power for a day. The devout are sure it means something.
    target.state.chargedUntil = t + 24;
    const seen = alive(world).filter(x => x.zone === target.zone || x.traits.piety > 0.6);
    for (const x of seen) x.faith = r3(clamp(x.faith + 0.04 + 0.06 * x.traits.piety, -1, 1));
    return emit(world, { kind: 'interaction', actors: seen.slice(0, 6).map(x => x.id), target: target.id, data: { what: 'charged', on: target.kind }, salience: 3, causes });
  }
  if (target && target.kind === 'hut') {
    target.kind = 'scorch'; target.state.was = 'hut'; target.state.burnedTick = t;
    for (const x of alive(world).filter(x => x.zone === target.zone)) { mood(x, -0.15); x.faith = r3(clamp(x.faith - 0.05, -1, 1)); }
    return emit(world, { kind: 'burned', target: target.id, data: { was: 'hut', zone: target.zone, at: target.zone, by: 'lightning', discovery: null, owner: (target.by || [])[0] || null }, salience: 4, causes });
  }
  return null;
}

// Lightning in the water: stunned fish bob up for anyone who wants them. On a
// frozen pond the ice cracks instead, and anyone skating goes in.
export function lightningInWater(world, zone, strikeEvent) {
  const pond = zone === 'pondsite' && liveObjects(world).find(o => o.kind === 'pond');
  if (pond && pond.state.frozen) {
    delete pond.state.frozen;
    pond.state.crackedTick = world.tick;
    const dunked = alive(world).filter(x => x.zone === 'pondsite' && x.stage !== 'baby');
    for (const x of dunked) { x.needs.warmth = r3(clamp01(x.needs.warmth - 0.35)); mood(x, -0.1); x.heldUntil = world.tick + 1; }
    return emit(world, { kind: 'interaction', actors: dunked.map(x => x.id), target: pond.id, data: { what: 'ice_cracked', dunked: dunked.length }, salience: 3, causes: [{ event: strikeEvent.id }] });
  }
  const n = 1 + (rngFor(world.seed, 'stunfish', world.tick)() < 0.5 ? 1 : 0);
  for (let i = 0; i < n; i++) makeObject(world, { kind: 'fish', slot: null, zone, origin: { event: strikeEvent.id }, state: { until: world.tick + 6, stunned: true } });
  return emit(world, { kind: 'interaction', data: { what: 'fish_stunned', zone, count: n }, salience: 3, causes: [{ event: strikeEvent.id }] });
}

// Daily social life: time together builds friendships; grumpy rivals squabble.
export function socialStep(world) {
  const live = alive(world);
  const r = rngFor(world.seed, 'social', world.tick);
  // Still crackling from a zap? Whoever it bumps into gets a static shock.
  for (const z of live.filter(x => (x.zappedUntil || 0) > world.tick)) {
    const near = live.filter(x => x !== z && x.zone === z.zone && !((x.zappedUntil || 0) > world.tick));
    if (!near.length || r() > 0.35) continue;
    const v = near[Math.floor(r() * near.length)];
    v.zappedUntil = world.tick + 2;
    mood(v, v.traits.playfulness > 0.6 ? 0.05 : -0.05);
    emit(world, { kind: 'interaction', actors: [z.id, v.id], target: v.id, data: { what: 'static_shock' }, salience: 2 });
  }
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j];
    if (a.zone !== b.zone) continue;
    const b0 = bond(a, b.id);
    // Opposites grate: a wild one and a worrier rub each other the wrong way.
    const clash = Math.max(0, Math.abs(a.traits.playfulness - b.traits.playfulness) + Math.abs((a.traits.caution || 0.5) - (b.traits.caution || 0.5)) - 0.45);
    // Two bold ones always want to be top Wobblin; a bad mood makes anyone prickly.
    const pride = a.traits.boldness > 0.7 && b.traits.boldness > 0.7 ? 0.012 : 0;
    const grumpy = (a.needs.mood < 0.3 ? 0.008 : 0) + (b.needs.mood < 0.3 ? 0.008 : 0);
    addBond(world, a, b, 0.016 * (a.traits.sociability + b.traits.sociability) - 0.08 * clash - pride - grumpy);
    // Two hungry Wobblins after the same few berries get on each other's nerves.
    if (a.needs.food < 0.3 && b.needs.food < 0.3 && a.activity === 'forage' && b.activity === 'forage') addBond(world, a, b, -0.05 - 0.04 * (1 - (a.traits.sociability + b.traits.sociability) / 2));
    if (b0 < -0.15 && r() < 0.04 + (a.needs.mood < 0.5 || b.needs.mood < 0.5 ? 0.06 : 0)) {
      mood(a, -0.05); mood(b, -0.05);
      emit(world, { kind: 'interaction', actors: [a.id, b.id], data: { what: 'squabble' }, salience: 2 });
    }
  }
}

// A cold snap freezes the pond: playful Wobblins go skating, careful ones slip.
export function iceStep(world) {
  const pond = liveObjects(world).find(o => o.kind === 'pond');
  if (!pond) return;
  const frozen = world.climate.season === 'cold' && !(pond.state.crackedTick !== undefined && world.tick - pond.state.crackedTick < 6);
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
