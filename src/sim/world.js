// world.js — createWorld(seed, opts). Deliberately sparse so the Keeper matters.
import { rngFor, randInt, pick, range, chance } from './rng.js';
import { WORLD_VERSION, START_WOBBLINS, LIFE, COOLDOWN } from './constants.js';
import { slotIds, slotInfo } from './geometry.js';
import { r3, clamp01 } from './util.js';
import { emit } from './events.js';

const SYL_A = ['Bi', 'Mi', 'To', 'Pu', 'Ny', 'Ze', 'Lo', 'Fi', 'Wu', 'Ka', 'Ro', 'Sa', 'Di', 'Hu', 'Qe', 'Ji'];
const SYL_B = ['x', 'p', 'k', 'bble', 'mo', 'ri', 'n', 'zz', 'lo', 'sh', 'ff', 'ndle', 'ti', 'mp', 'v', 'ro'];
const COLONY_A = ['Wobble', 'Mossy', 'Puddle', 'Thistle', 'Hum', 'Pebble', 'Burrow', 'Dew'];
const COLONY_B = ['Hollow', 'Dell', 'Nook', 'Bottom', 'Glen', 'Patch', 'Hollow', 'Meadow'];

export const HOBBIES = [
  'stacking stones', 'humming', 'collecting shiny things', 'napping in sun',
  'watching clouds', 'chasing bugs', 'poking puddles', 'sniffing flowers'
];
export const TRAITS = ['curiosity', 'boldness', 'sociability', 'patience', 'playfulness', 'piety'];
const PATTERNS = ['plain', 'spots', 'stripes', 'freckles', 'patch'];
const EARS = ['nubs', 'droopy', 'pointy', 'tufts', 'none'];
const TAILS = ['none', 'stub', 'curl', 'fluff'];

export function wobblinName(seed, n) {
  const r = rngFor(seed, 'name', n);
  return pick(r, SYL_A) + pick(r, SYL_B);
}

function uniqueName(world, n) {
  const used = new Set(world.wobblins.map(w => w.name));
  for (let k = 0; k < 20; k++) {
    const name = wobblinName(world.seed, n * 31 + k);
    if (!used.has(name)) return name;
  }
  return wobblinName(world.seed, n) + n;
}

// makeWobblin(world, { bornTick, parents?, traits?, zone? }) -> wobblin (pushed)
export function makeWobblin(world, spec) {
  const n = world.nextIds.w++;
  const id = 'w' + n;
  const r = rngFor(world.seed, 'wobblin', n);
  const traits = {};
  for (const k of TRAITS) {
    const base = spec.traits ? spec.traits[k] + range(r, -0.15, 0.15) : range(r, 0.1, 0.9);
    traits[k] = r3(clamp01(base));
  }
  const lifespan = randInt(r, LIFE.lifespanMin, LIFE.lifespanMax);
  const age = world.tick - spec.bornTick;
  const w = {
    id, name: uniqueName(world, n),
    look: {
      hue: randInt(r, 0, 359),
      pattern: pick(r, PATTERNS),
      ears: pick(r, EARS),
      eyeSize: r3(range(r, 0.8, 1.3)),
      tail: pick(r, TAILS),
      wobble: r3(range(r, 0.6, 1.4))
    },
    traits,
    hobby: pick(r, HOBBIES),
    bornTick: spec.bornTick,
    stage: age < LIFE.babyUntil ? 'baby' : age >= lifespan * LIFE.elderAt ? 'elder' : 'adult',
    lifespan,
    needs: { food: 0.8, warmth: 0.8, rest: 0.8, mood: 0.7, safety: 0.8 },
    zone: spec.zone || 'meadow',
    activity: 'rest',
    seen: [],
    knows: {},
    temp: {},
    partnerId: null,
    parents: spec.parents || [],
    faith: 0,
    beliefs: [],
    memories: [],
    injuries: 0,
    hungry: 0, freezing: 0, lastBirth: null,
    heldUntil: -1,                // set down by the Keeper: stays put until this tick
    witnessed: false,             // has seen a Keeper blessing or miracle (Totem)
    alive: true,
    deathTick: null,
    deathCause: null
  };
  world.wobblins.push(w);
  return w;
}

// makeObject(world, { kind, slot, origin, by?, state?, hp? }) -> object (pushed)
export function makeObject(world, spec) {
  const info = slotInfo(spec.slot);
  const o = {
    id: 'o' + world.nextIds.o++,
    kind: spec.kind,
    zone: info ? info.zone : spec.zone,
    slot: spec.slot,
    hp: spec.hp === undefined ? 1 : spec.hp,
    builtTick: world.tick,
    by: spec.by || [],
    origin: spec.origin,
    state: spec.state || {}
  };
  if (spec.slots) o.slots = spec.slots;
  world.objects.push(o);
  return o;
}

function defaultColonyName(seed) {
  const r = rngFor(seed, 'colonyName');
  return pick(r, COLONY_A) + ' ' + pick(r, COLONY_B);
}

export function createWorld(seed, opts = {}) {
  seed = seed >>> 0;
  const cooldowns = {};
  for (const k of Object.keys(COOLDOWN).sort()) cooldowns[k] = 0;
  const world = {
    version: WORLD_VERSION,
    seed,
    tick: 0,
    colonyName: opts.colonyName || defaultColonyName(seed),
    keeperName: opts.keeperName || 'Keeper',
    climate: { season: 'mild', tempMod: 0, until: null, drought: 0, rain: 0, wetUntil: -1, cold: false, drift: 0, rainEvent: null },
    wobblins: [],
    objects: [],
    discoveries: {},
    devotion: 0,
    offerings: 0,
    cooldowns,
    seasonUses: 0,
    giftsByDay: {},
    pondering: {},
    pondered: {},                 // discoveryId -> tick its pondering hint was shown
    seedPod: null,
    rainUses: [],                 // ticks of recent Keeper rain (flood check)
    miracleUntil: -1,
    riverBend: null,
    lastKeeperTick: 0,
    wishes: [],                   // { id, by, want, t, until, event, done }
    lastFestival: null,
    lastKeeperEvent: null,        // id of the latest salient Keeper event (murals)
    noticed: {},                  // material kind -> first tick a Wobblin saw it
    events: [],
    nextIds: { w: 1, o: 1, e: 1 }
  };

  const r = rngFor(seed, 'start');
  if (!opts.barren) {
    // 1-2 stones, 1 berry bush, 0-1 small tree, scattered over free slots.
    const free = ['meadow', 'grove', 'hollow', 'hill'].flatMap(slotIds);
    const take = () => free.splice(Math.floor(r() * free.length), 1)[0];
    const nStones = randInt(r, 1, 2);
    for (let i = 0; i < nStones; i++) {
      makeObject(world, { kind: 'stones', slot: take(), origin: { natural: true }, state: { count: 1 } });
    }
    makeObject(world, { kind: 'bush', slot: take(), origin: { natural: true }, state: { berries: 3 } });
    if (chance(r, 0.5)) {
      makeObject(world, { kind: 'tree', slot: take(), origin: { natural: true }, state: { size: 1 } });
    }
  }

  for (let i = 0; i < START_WOBBLINS; i++) {
    const rr = rngFor(seed, 'founder', i);
    makeWobblin(world, { bornTick: -randInt(rr, 12, 30), zone: 'meadow' });
  }

  emit(world, {
    kind: 'colony_founded',
    actors: world.wobblins.map(w => w.id),
    data: { colonyName: world.colonyName, keeperName: world.keeperName, barren: !!opts.barren },
    salience: 3
  });
  return world;
}
