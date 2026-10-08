// nature.js — weather, seasonal drift, fire, growth, and natural events.
// Shared by the environment step and (from Day 3) Keeper powers, so a Keeper
// lightning bolt and a dry-lightning strike burn the same way.
import { NATURE, POWER, FIRE, CLIMATE, NEEDS } from './constants.js';
import { rngFor, chance, randInt, pick } from './rng.js';
import { emit } from './events.js';
import { makeObject } from './world.js';
import { slotIds } from './geometry.js';
import { alive, liveObjects, objectAtSlot, r3, clamp01 } from './util.js';

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
  if (target && burnableAt(world, slot)) igniteObject(world, target, ev.id);
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
    if (world.climate.rain > 0 || world.tick >= f.state.until) {
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
    if (o.kind === 'sprout' && world.tick >= o.state.readyAt) {
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
  if (r() < 0.35 - 0.25 * victim.traits.boldness) { victim.injuries++; hurt = victim.id; }
  for (const w of here) w.needs.safety = r3(clamp01(w.needs.safety - NEEDS.prowlerFear));
  const ev = emit(world, { kind: 'prowler', actors: here.map(w => w.id), data: { zone, hurt }, salience: 3 });
  if (hurt) emit(world, { kind: 'injured', actors: [hurt], data: { cause: 'prowler' }, salience: 3, causes: [{ event: ev.id }] });
}

export function environmentStep(world) {
  const c = world.climate;
  const t = world.tick;
  const r = rngFor(world.seed, 'weather', t);

  if (c.until !== null && t >= c.until) {
    c.season = 'mild'; c.tempMod = 0; c.until = null;
  }
  c.drift = r3(CLIMATE.driftAmp * tri((t + (world.seed % CLIMATE.driftPeriod)) / CLIMATE.driftPeriod));

  if (c.rain > 0) {
    c.rain--;
    c.wetUntil = t + POWER.wetTicks;
  } else if (chance(r, NATURE.rainChance + (c.season === 'warm' ? -0.02 : 0))) {
    c.rain = 1;
    c.wetUntil = t + POWER.wetTicks;
    emit(world, { kind: 'rain', data: { natural: true, ticks: 1 }, salience: 1 });
  }

  const coldP = NATURE.coldNightChance + (c.season === 'cold' ? 0.5 : c.season === 'warm' ? -0.2 : 0) - c.drift;
  c.cold = chance(r, coldP);

  if (c.rain === 0 && chance(r, NATURE.dryLightningChance)) {
    const targets = liveObjects(world).filter(o => o.kind === 'tree' || o.kind === 'bush');
    if (targets.length) {
      const o = targets[Math.floor(r() * targets.length)];
      strike(world, o.slot, [], { natural: true });
    }
  }

  fireStep(world);
  growthStep(world);
  prowlerStep(world, r);
}

