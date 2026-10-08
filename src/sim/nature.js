// nature.js — weather, seasonal drift, fire, growth, and natural events.
// Shared by the environment step and (from Day 3) Keeper powers, so a Keeper
// lightning bolt and a dry-lightning strike burn the same way.
import { NATURE, POWER, FIRE, CLIMATE, NEEDS } from './constants.js';
import { rngFor, chance, randInt, pick } from './rng.js';
import { emit } from './events.js';
import { makeObject } from './world.js';
import { slotIds, slotInfo } from './geometry.js';
import { lightningOnto, lightningInWater } from './interactions.js';
import { alive, liveObjects, objectAtSlot, r3, clamp01, clamp } from './util.js';

// Triangle wave, period 1, range [-1, 1]. Add/mul/abs only (bit identical).
function tri(x) { const f = x - Math.floor(x); return 1 - 4 * Math.abs(f - 0.5); }

export function isWet(world) { return world.climate.wetUntil >= world.tick; }

export function burnableAt(world, slot) {
  const o = objectAtSlot(world, slot);
  return o && (o.kind === 'tree' || o.kind === 'bush' || o.kind === 'sprout') ? o : null;
}

// Strike a slot. A tree/bush/sprout there becomes a fire. Returns the
// lightning event. `causes` link to the Keeper action or natural origin.
export function strike(world, slot, causes, data) {
  const target = objectAtSlot(world, slot);
  const ev = emit(world, { kind: data.natural ? 'lightning' : 'keeper_power', target: target ? target.id : null,
    data: { ...data, slot }, salience: data.natural ? 2 : 2, causes });
  const zoneHit = slotInfo(slot).zone;
  if (target && burnableAt(world, slot)) igniteObject(world, target, ev.id).state.byKeeper = !data.natural;
  else if (target && target.kind !== 'pond') lightningOnto(world, target, ev);
  else if (zoneHit === 'riverbank' || (zoneHit === 'pondsite' && liveObjects(world).some(o => o.kind === 'pond'))) lightningInWater(world, zoneHit, ev);
  else if (!target && !isWet(world) && slotInfo(slot).zone !== 'riverbank' && slotInfo(slot).zone !== 'pondsite') {
    // Dry grass catches: a small fire that burns out fast.
    const fire = makeObject(world, { kind: 'fire', slot, origin: { event: ev.id }, state: { until: world.tick + 4, fuel: 'grass', byKeeper: !data.natural } });
    emit(world, { kind: 'fire_started', target: fire.id, data: { zone: fire.zone, fuel: 'grass' }, salience: 3, causes: [{ event: ev.id }] });
  }
  // Everyone nearby flinches; someone standing right there may get hurt.
  const zone = slotInfo(slot).zone;
  const r = rngFor(world.seed, 'strike', world.tick, slot);
  for (const w of alive(world).filter(x => x.zone === zone)) {
    w.needs.safety = r3(clamp01(w.needs.safety - 0.3));
    if (w.id === data.onto) continue;
    if (r() < 0.12 * (1.2 - w.traits.boldness)) {
      w.injuries++;
      if (!data.natural) w.faith = r3(clamp(w.faith - 0.1, -1, 1));
      emit(world, { kind: 'injured', actors: [w.id], data: { cause: 'lightning', zone }, salience: 3, causes: [{ event: ev.id }] });
    }
  }
  return ev;
}

// ---- the valley tidies itself ------------------------------------------------
// Old Keeper things get used up so the valley never fills for good: curios and
// gifts are taken home as keepsakes, spare stone piles are carried off for
// building, scorch marks grow over and ruins crumble.
export const TIDY = { keepsake: 48, stones: 72, cairn: 144, spareStones: 3, scorch: 48, ruin: 240 };
function tidyStep(world) {
  const t = world.tick;
  if (t % 4 !== 0) return;   // every few days is plenty (and keeps replay fast)
  if (world.trails && t % 48 === 44) for (const k of Object.keys(world.trails).sort()) { world.trails[k] = Math.floor(world.trails[k] * 0.9); if (!world.trails[k]) delete world.trails[k]; }
  const live = alive(world);
  const takerIn = zone => live.find(w => w.zone === zone && w.stage !== 'baby') || live.find(w => w.stage !== 'baby') || null;
  const piles = liveObjects(world).filter(o => o.kind === 'stones');
  let spare = piles.length - TIDY.spareStones;
  for (const o of liveObjects(world)) {
    const age = t - o.builtTick;
    if ((o.kind === 'curio' && o.state.pullDone && age >= TIDY.keepsake) || (o.kind === 'gift' && age >= TIDY.keepsake)) {
      const w = takerIn(o.zone);
      o.state.gone = true; o.hp = 0; o.state.takenBy = w ? w.id : null;
      if (w && !w.luckyCharm) w.luckyCharm = o.id;
      if (w) emit(world, { kind: 'keepsake', actors: [w.id], target: o.id, data: { item: o.state.curio || o.state.giftId, zone: o.zone }, salience: 1, causes: [{ object: o.id }] });
    } else if (o.kind === 'stones' && spare > 0 && age >= (o.state.stacked ? TIDY.cairn : TIDY.stones)) {
      spare--;
      const w = takerIn(o.zone);
      o.state.gone = true; o.hp = 0; o.state.usedFor = 'building';
      if (w) emit(world, { kind: 'keepsake', actors: [w.id], target: o.id, data: { item: 'stones', zone: o.zone }, salience: 1, causes: [{ object: o.id }] });
    } else if ((o.kind === 'scorch' && age >= TIDY.scorch && t - (o.state.burnedTick ?? o.builtTick) >= TIDY.scorch) ||
               (o.kind === 'ruin' && age >= TIDY.ruin)) {
      o.state.gone = true; o.hp = 0; o.state.faded = true;
    }
  }
}

// ---- water: rain side effects, ponds, floods ----------------------------
export function freeSlotIn(world, zone) {
  for (const s of slotIds(zone)) if (!objectAtSlot(world, s)) return s;
  return null;
}

function hasKind(world, kind, zone) { return liveObjects(world).some(o => o.kind === kind && o.zone === zone); }

// Called once per tick while it rains. Rain softens soil, brings fish up in
// the river, and shows clay on the bank. `rainEvent` is the cause.
function rainEffects(world, r, rainEvent) {
  if (!rainEvent) return;
  if (!hasKind(world, 'fish', 'riverbank') && chance(r, 0.5)) {
    makeObject(world, { kind: 'fish', slot: null, zone: 'riverbank', origin: { event: rainEvent }, state: { until: world.tick + 8 } });
  }
  if (!hasKind(world, 'clay', 'riverbank') && chance(r, 0.35)) {
    const s = freeSlotIn(world, 'riverbank');
    if (s) makeObject(world, { kind: 'clay', slot: s, origin: { event: rainEvent }, state: {} });
  }
}

// Dig the pond. Reeds, then clay, then fish follow over 12 ticks.
export function digPond(world, causeEventId) {
  const pond = makeObject(world, { kind: 'pond', slot: 'pondsite.1', slots: ['pondsite.1', 'pondsite.2'],
    origin: { event: causeEventId }, state: { dug: world.tick } });
  emit(world, { kind: 'pond_formed', target: pond.id, data: { zone: 'pondsite' }, salience: 3, causes: [{ event: causeEventId }] });
  return pond;
}

function pondStep(world) {
  const pond = liveObjects(world).find(o => o.kind === 'pond');
  if (!pond) return;
  const age = world.tick - pond.state.dug;
  const grow = (kind, zone) => {
    const s = freeSlotIn(world, zone);
    if (!s) return;
    const o = makeObject(world, { kind, slot: s, origin: { object: pond.id }, state: {} });
    emit(world, { kind: 'tree_grown', target: o.id, data: { zone, kind }, salience: 2, causes: [{ object: pond.id }] });
  };
  if (age === 4 && !hasKind(world, 'reeds', 'pondsite')) grow('reeds', 'pondsite');
  if (age === 8 && !hasKind(world, 'clay', 'pondsite')) grow('clay', 'pondsite');
  if (age >= 12 && !hasKind(world, 'fish', 'pondsite')) {
    makeObject(world, { kind: 'fish', slot: null, zone: 'pondsite', origin: { object: pond.id }, state: {} });
  }
}

export function flood(world, causes) {
  const ev = emit(world, { kind: 'flood', data: { zones: ['riverbank', 'pondsite'] }, salience: 4, causes });
  const r = rngFor(world.seed, 'flood', world.tick);
  for (const w of alive(world).filter(x => x.zone === 'riverbank' || x.zone === 'pondsite')) {
    w.needs.safety = r3(clamp01(w.needs.safety - 0.4));
    if (r() < 0.15) {
      w.injuries++;
      emit(world, { kind: 'injured', actors: [w.id], data: { cause: 'flood' }, salience: 3, causes: [{ event: ev.id }] });
    }
  }
  for (const o of liveObjects(world).filter(x => x.zone === 'riverbank' && x.slot && x.kind !== 'pond')) {
    if (r() < 0.3) {
      o.state.gone = true; o.hp = 0;
      emit(world, { kind: 'lost', target: o.id, data: { cause: 'flood', kind: o.kind }, salience: 2, causes: [{ event: ev.id }] });
    }
  }
  return ev;
}

export function igniteObject(world, o, causeEventId) {
  const r = rngFor(world.seed, 'fire', world.tick, o.id);
  o.state.gone = true;
  o.hp = 0;
  const fire = makeObject(world, {
    kind: 'fire', slot: o.slot, origin: { event: causeEventId },
    state: { until: world.tick + randInt(r, FIRE.burnMin, FIRE.burnMax), fuel: o.kind }
  });
  emit(world, { kind: 'fire_started', target: fire.id, data: { zone: fire.zone, fuel: o.kind, burned: o.id },
    salience: 3, causes: [{ event: causeEventId }, { object: o.id }] });
  return fire;
}

function fireStep(world) {
  for (const f of liveObjects(world).filter(o => o.kind === 'fire')) {
    if (f.state.kept) continue;                       // a kept fire (Day 4+) does not burn out
    const r = rngFor(world.seed, 'fire-spread', world.tick, f.id);
    if ((world.climate.rain > 0 && !f.state.kept) || world.tick + 1 >= f.state.until) {
      f.state.gone = true; f.hp = 0;
      emit(world, { kind: 'fire_out', target: f.id, data: { zone: f.zone, rain: world.climate.rain > 0 }, salience: 1 });
      continue;
    }
    if (chance(r, FIRE.spreadChance)) {
      const near = slotIds(f.zone).filter(s => s !== f.slot && burnableAt(world, s));
      if (near.length) {
        const started = world.events.filter(e => e.kind === 'fire_started' && e.target === f.id).pop();
        igniteObject(world, burnableAt(world, pick(r, near)), started ? started.id : f.origin.event);
      }
    }
  }
}

function growthStep(world) {
  for (const o of liveObjects(world)) {
    if (o.kind === 'sprout' && world.tick + 1 >= o.state.readyAt) {
      o.kind = o.state.grows;
      o.state = o.kind === 'tree' ? { size: 1 } : { berries: 3 };
      emit(world, { kind: 'tree_grown', target: o.id, data: { zone: o.zone, kind: o.kind }, salience: 2,
        causes: [{ object: o.id }] });
    } else if (o.kind === 'tree' && o.state.size < 1.6 && (world.tick - o.builtTick) % 24 === 23) {
      o.state.size = r3(o.state.size + 0.1);
    } else if (o.kind === 'bush' && o.state.berries < 3 && (isWet(world) || world.tick % 3 === 0)) {
      o.state.berries += 1;
    }
  }
}

function prowlerStep(world, r) {
  const live = alive(world);
  if (live.length < NATURE.prowlerPop || !chance(r, NATURE.prowlerChance)) return;
  const counts = {};
  for (const w of live) counts[w.zone] = (counts[w.zone] || 0) + 1;
  const zone = Object.keys(counts).sort().sort((a, b) => counts[b] - counts[a])[0];
  const here = live.filter(w => w.zone === zone);
  let hurt = null;
  const victim = here[Math.floor(r() * here.length)];
  const walled = liveObjects(world).some(o => o.kind === 'wall' && o.zone === zone);
  if (r() < (0.35 - 0.25 * victim.traits.boldness) * (walled ? 0.3 : 1)) { victim.injuries++; hurt = victim.id; }
  for (const w of here) w.needs.safety = r3(clamp01(w.needs.safety - NEEDS.prowlerFear));
  const ev = emit(world, { kind: 'prowler', actors: here.map(w => w.id), data: { zone, hurt }, salience: 3 });
  if (hurt) emit(world, { kind: 'injured', actors: [hurt], data: { cause: 'prowler' }, salience: 3, causes: [{ event: ev.id }] });
}

export function environmentStep(world) {
  const c = world.climate;
  const t = world.tick;
  const r = rngFor(world.seed, 'weather', t);

  c.drift = r3(CLIMATE.driftAmp * tri((t + (world.seed % CLIMATE.driftPeriod)) / CLIMATE.driftPeriod));

  // c.rain = ticks of rain still to fall, counting this one.
  if (c.rain === 0 && chance(r, NATURE.rainChance + (c.season === 'warm' ? -0.02 : 0))) {
    c.rain = 1;
    c.rainEvent = emit(world, { kind: 'rain', data: { natural: true, ticks: 1 }, salience: 1 }).id;
  }
  if (c.rain > 0) {
    c.wetUntil = t + POWER.wetTicks;
    rainEffects(world, r, c.rainEvent);
  }

  const coldP = NATURE.coldNightChance + (c.season === 'cold' ? 0.25 : c.season === 'warm' ? -0.2 : 0) - c.drift;
  c.cold = chance(r, coldP);

  if (c.rain === 0 && chance(r, NATURE.dryLightningChance)) {
    const targets = liveObjects(world).filter(o => o.kind === 'tree' || o.kind === 'bush');
    if (targets.length) {
      const o = targets[Math.floor(r() * targets.length)];
      strike(world, o.slot, [], { natural: true });
    }
  }

  for (const o of liveObjects(world)) {
    if (o.state.until !== undefined && o.kind === 'fish' && t >= o.state.until) { o.state.gone = true; o.hp = 0; }
    if (o.kind === 'curio' && o.state.until !== undefined && t >= o.state.until) o.state.pullDone = true;
  }

  tidyStep(world);
  fireStep(world);
  growthStep(world);
  pondStep(world);
  prowlerStep(world, r);
  if (c.rain > 0) c.rain--;
  // A Keeper season covers ticks [start, until); it is over once the next tick is until.
  if (c.until !== null && t + 1 >= c.until) {
    c.season = 'mild'; c.tempMod = 0; c.until = null;
  }
}
