// life.js — deaths, graves, healing, Hut-gated pairing, births, seed pod.
import { LIFE, SOCIAL, POP_CAP } from './constants.js';
import { rngFor, chance } from './rng.js';
import { emit } from './events.js';
import { makeObject, makeWobblin, TRAITS } from './world.js';
import { trait } from './creatures.js';
import { buildStructure } from './effects.js';
import { cultureStep } from './culture.js';
import { alive, liveObjects, findWobblin, idNum, r3 } from './util.js';

// Huts are built only by the Hut discovery (Day 5). Each intact hut houses
// one pair, so pairing is gated on huts existing and having room.
export function hutCapacity(world) {
  return liveObjects(world).filter(o => o.kind === 'hut' && !o.state.ruined).length;
}
function pairCount(world) { return alive(world).filter(w => w.partnerId).length / 2; }

export function kill(world, w, cause, causes = []) {
  w.alive = false;
  w.deathTick = world.tick;
  w.deathCause = cause;
  if (w.partnerId) {
    const p = findWobblin(world, w.partnerId);
    if (p) p.partnerId = null;
  }
  const ev = emit(world, { kind: 'death', actors: [w.id], data: { cause, age: world.tick - w.bornTick, zone: w.zone },
    salience: 4, causes });
  const graves = world.objects.filter(o => o.kind === 'grave').length;
  makeObject(world, { kind: 'grave', slot: null, zone: 'hill', origin: { event: ev.id },
    state: { of: w.id, name: w.name, index: graves } });
  return ev;
}

function deathsStep(world) {
  for (const w of alive(world)) {
    const age = world.tick - w.bornTick;
    if (age >= w.lifespan) kill(world, w, 'old_age');
    else if (w.hungry > LIFE.starveTicks) kill(world, w, 'starvation');
    else if (w.freezing > LIFE.coldTicks) kill(world, w, 'cold');
    else if (w.injuries >= SOCIAL.injuryDeath) kill(world, w, 'injury');
  }
}

function healStep(world) {
  for (const w of alive(world)) {
    if (w.injuries > 0 && (world.tick - w.bornTick) % SOCIAL.healEvery === 0) {
      w.injuries--;
      emit(world, { kind: 'healed', actors: [w.id], salience: 1 });
    }
  }
}

function pairingStep(world) {
  const live = alive(world);
  if (pairCount(world) >= hutCapacity(world)) return;
  const single = live.filter(w => !w.partnerId && w.stage !== 'baby' &&
    trait(w, 'sociability', world.tick) > SOCIAL.pairSociabilityMin && w.needs.mood > SOCIAL.pairMood);
  for (let i = 0; i < single.length; i++) {
    for (let j = i + 1; j < single.length; j++) {
      const a = single[i], b = single[j];
      if (a.partnerId || b.partnerId || a.zone !== b.zone) continue;
      // The pair together must be sociable (each > 0.25, average > 0.4).
      if ((trait(a, 'sociability', world.tick) + trait(b, 'sociability', world.tick)) / 2 <= SOCIAL.pairSociability) continue;
      if (a.parents.includes(b.id) || b.parents.includes(a.id) ||
          (a.parents.length && a.parents.some(p => b.parents.includes(p)))) continue;
      const r = rngFor(world.seed, 'pair', world.tick, a.id, b.id);
      if (!chance(r, SOCIAL.pairChance)) continue;
      a.partnerId = b.id; b.partnerId = a.id;
      emit(world, { kind: 'paired', actors: [a.id, b.id], data: { zone: a.zone }, salience: 3 });
      if (pairCount(world) >= hutCapacity(world)) return;
    }
  }
}

function birthStep(world) {
  for (const a of alive(world)) {
    if (alive(world).length >= POP_CAP) return;
    const b = a.partnerId && findWobblin(world, a.partnerId);
    if (!b || !b.alive || idNum(a.id) > idNum(b.id)) continue;   // each pair once
    if (a.needs.food < SOCIAL.birthFood || b.needs.food < SOCIAL.birthFood) continue;
    if (a.lastBirth !== null && world.tick - a.lastBirth < SOCIAL.birthGap) continue;
    const r = rngFor(world.seed, 'birth', world.tick, a.id);
    if (!chance(r, SOCIAL.birthChance)) continue;
    const traits = {};
    for (const k of TRAITS) traits[k] = (a.traits[k] + b.traits[k]) / 2;
    const baby = makeWobblin(world, { bornTick: world.tick, parents: [a.id, b.id], traits, zone: a.zone });
    a.lastBirth = b.lastBirth = world.tick;
    // Babies inherit what their parents believe; knowledge comes by teaching.
    baby.beliefs = [...new Set([...a.beliefs, ...b.beliefs])].sort();
    baby.faith = r3((a.faith + b.faith) / 2);
    emit(world, { kind: 'birth', actors: [baby.id, a.id, b.id], data: { zone: a.zone }, salience: 4 });
  }
}

// Huts let a small colony take in a wanderer now and then, so a family of
// siblings is not a dead end.
function strangerStep(world) {
  const live = alive(world);
  if (!live.length || live.length >= 6 || hutCapacity(world) === 0) return;
  const r = rngFor(world.seed, 'stranger', world.tick);
  if (!chance(r, SOCIAL.strangerChance * (live.length < 4 ? 2 : 1))) return;
  const w = makeWobblin(world, { bornTick: world.tick - LIFE.babyUntil - 8, zone: 'riverbank' });
  emit(world, { kind: 'stranger_arrived', actors: [w.id], data: { zone: 'riverbank', by: 'road' }, salience: 4 });
}

// Wobblins who know Hut build more as the colony grows (one per pair).
function hutBuildingStep(world) {
  const live = alive(world);
  const builders = live.filter(w => w.knows.hut && w.stage !== 'baby' && w.zone === 'hollow');
  if (!builders.length || hutCapacity(world) >= Math.ceil(live.length / 2) + 1) return;
  const r = rngFor(world.seed, 'hut-build', world.tick);
  if (!chance(r, SOCIAL.hutBuildChance)) return;
  const disc = world.events.filter(e => (e.kind === 'discovery' || e.kind === 'rediscovery') && e.target === 'hut').pop();
  if (disc) buildStructure(world, 'hut', builders[0], disc);
}

function seedPodStep(world) {
  const live = alive(world);
  if (live.length > 0) { world.seedPod = null; return; }
  if (!world.seedPod) {
    world.seedPod = { at: world.tick + LIFE.seedPodDelay };
    return;
  }
  if (world.tick < world.seedPod.at) return;
  const born = [];
  for (let i = 0; i < 2; i++) {
    born.push(makeWobblin(world, { bornTick: world.tick - LIFE.babyUntil, zone: 'meadow' }).id);
  }
  world.seedPod = null;
  emit(world, { kind: 'seed_pod_hatched', actors: born, data: {}, salience: 5 });
}

// Faithful Wobblins leave offerings at the shrine; long neglect erodes faith.
function faithStep(world) {
  const neglected = world.tick - world.lastKeeperTick > 72;
  const mult = liveObjects(world).some(o => o.kind === 'temple') ? 2 : liveObjects(world).some(o => o.kind === 'totem') ? 1.5 : 1;
  for (const w of alive(world)) {
    const before = w.faith;
    if (neglected) w.faith = r3(Math.max(-1, w.faith - 0.003));
    for (const th of [0.3, 0.5, -0.3]) {
      if ((before < th) !== (w.faith < th)) {
        emit(world, { kind: 'faith_shift', actors: [w.id], data: { threshold: th, rising: w.faith > before }, salience: 2 });
      }
    }
    if (w.faith > 0.3 && w.stage !== 'baby') {
      const r = rngFor(world.seed, 'offering', world.tick, w.id);
      if (chance(r, 0.08)) {
        world.offerings = r3(world.offerings + mult);
        const pond = w.beliefs.includes('keeper_watches_pond') && liveObjects(world).some(o => o.kind === 'pond');
        emit(world, { kind: 'offering', actors: [w.id], data: { amount: mult, into: pond ? 'pond' : 'shrine' }, salience: 1 });
      }
    }
  }
}

export function lifeEventsStep(world) {
  faithStep(world);
  cultureStep(world);
  deathsStep(world);
  healStep(world);
  hutBuildingStep(world);
  strangerStep(world);
  pairingStep(world);
  birthStep(world);
  seedPodStep(world);
}
