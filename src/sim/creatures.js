// creatures.js — needs, activity choice, movement, aging.
// Each tick every living Wobblin updates needs, then picks an activity and a
// zone by needs, traits and hobby. Hardship matters: unmet needs are what will
// drive experiments (Day 4).
import { LIFE, NEEDS, SOCIAL } from './constants.js';
import { rngFor, weightedPick } from './rng.js';
import { ZONE_IDS, isAdjacent } from './geometry.js';
import { alive, liveObjects, sortedKeys, r3, clamp01 } from './util.js';
import { emit } from './events.js';

export function stageFor(w, tick) {
  const age = tick - w.bornTick;
  if (age < LIFE.babyUntil) return 'baby';
  if (age >= w.lifespan * LIFE.elderAt) return 'elder';
  return 'adult';
}

// Effective trait including active blessings.
export function trait(w, name, tick) {
  const t = w.temp[name];
  const add = t && t.until > tick ? t.add : 0;
  return Math.min(1, w.traits[name] + add);
}

export function knows(w, d) { return !!w.knows[d]; }
const NEED_KEYS = ['food', 'mood', 'rest', 'safety', 'warmth'];

// Where each hobby likes to be, and what object kinds it is drawn to.
const HOBBY_ZONES = {
  'stacking stones': { kinds: ['stones', 'boulder'], zones: ['hill', 'meadow'] },
  'humming': { kinds: [], zones: [] },               // goes where friends are
  'collecting shiny things': { kinds: ['gift', 'curio', 'clay'], zones: ['riverbank'] },
  'napping in sun': { kinds: [], zones: ['meadow', 'hill'] },
  'watching clouds': { kinds: [], zones: ['hill'] },
  'chasing bugs': { kinds: ['bush', 'tree'], zones: ['grove'] },
  'poking puddles': { kinds: ['pond'], zones: ['riverbank', 'pondsite'] },
  'sniffing flowers': { kinds: ['bush', 'sprout'], zones: ['meadow', 'grove'] }
};

// Per-tick index of live objects by zone (objs.byZone), built in creaturesStep.
function zoneObjects(objs, zone) { return objs.byZone ? objs.byZone[zone] || [] : objs.filter(o => o.zone === zone); }

function warmthSources(objs, zone) {
  return objs.filter(o => (o.kind === 'fire' || o.kind === 'hearth') && isAdjacent(zone, o.zone)).length;
}

function zoneFood(objs, zone) {
  if (objs.stats && objs.stats[zone].food) return objs.stats[zone].food;
  const here = zoneObjects(objs, zone);
  const s = { bushes: here.filter(o => o.kind === 'bush').length, fish: here.some(o => o.kind === 'fish'),
    garden: here.some(o => o.kind === 'garden'), hearth: here.some(o => o.kind === 'hearth') };
  if (objs.stats) objs.stats[zone].food = s;
  return s;
}

function foodIn(objs, zone, w) {
  let f = NEEDS.forage[zone];
  const s = zoneFood(objs, zone);
  const bushes = s.bushes;
  f += bushes * NEEDS.bushFood * (knows(w, 'foraging') ? 2 : 1);
  if (s.fish && knows(w, 'fishing')) f += 0.2;
  if (s.garden) f += knows(w, 'garden') ? 0.3 : 0.1;
  if (s.hearth && knows(w, 'cooking')) f += 0.15;
  return f;
}

function updateNeeds(world, w, objs, live) {
  const n = w.needs, c = world.climate;
  // Food: decays; foraging (activity) refills, scaled by the zone.
  // Pottery: stored food goes further.
  n.food -= NEEDS.foodDecay * (knows(w, 'pottery') && objs.some(o => o.kind === 'hearth' && o.state.pots) ? 0.7 : 1);
  if (w.activity === 'forage') n.food += foodIn(objs, w.zone, w);
  // Warmth: drifts up on mild days; cold nights, cold snaps and rain chill.
  const others = live.filter(o => o !== w && o.zone === w.zone).length;
  n.warmth += NEEDS.warmthDrift + c.drift + c.tempMod;
  // Body heat: a chilled Wobblin loses warmth more slowly.
  // A stargazer's warning lets everyone bed down before a cold night.
  const loss = (c.cold ? NEEDS.coldNight * (c.warned ? 0.6 : 1) : 0) + (c.rain > 0 ? NEEDS.rainChill : 0);
  n.warmth -= n.warmth < 0.25 ? loss * 0.5 : loss;
  if (w.activity === 'warm' || w.activity === 'rest') {
    n.warmth += NEEDS.huddle * Math.min(3, others) + (w.zone === 'hollow' ? NEEDS.shelter : 0);
    if (knows(w, 'leaf_bed')) n.warmth += 0.06;
    if (objs.some(o => o.kind === 'hut' && o.zone === w.zone)) n.warmth += knows(w, 'hut') ? 0.25 : 0.15;
  }
  const fires = warmthSources(objs, w.zone);
  if (fires) n.warmth += knows(w, 'fire_warmth') ? 0.4 : NEEDS.fireWarm;
  if (knows(w, 'wall') && zoneObjects(objs, w.zone).some(o => o.kind === 'wall')) n.safety += 0.05;
  n.warmth = Math.min(n.warmth, 0.75 + (fires ? 0.25 : 0));
  // Rest.
  n.rest += w.activity === 'rest' ? NEEDS.restGain + (knows(w, 'leaf_bed') ? 0.1 : 0) : -NEEDS.restDecay;
  // Mood: drifts toward 0.6, hobby and company help, hardship hurts.
  n.mood += (0.6 - n.mood) * NEEDS.moodDrift;
  if (w.activity === 'hobby') n.mood += NEEDS.hobbyMood;
  n.mood += NEEDS.socialMood * Math.min(2, others) * (0.5 + w.traits.sociability);
  if (n.food < 0.2) n.mood -= 0.05;
  if (n.warmth < 0.2) n.mood -= 0.05;
  // Safety recovers toward 0.85.
  n.safety += (0.85 - n.safety) * NEEDS.safetyDrift;

  for (const k of NEED_KEYS) n[k] = r3(clamp01(n[k]));
  w.hungry = n.food <= 0 ? w.hungry + 1 : 0;
  w.freezing = n.warmth <= 0 ? w.freezing + 1 : 0;
}

// Choose activity + zone. Weighted by need pressure, traits and hobby.
function chooseActivity(world, w, objs, live) {
  const r = rngFor(world.seed, 'move', world.tick, w.id);
  const n = w.needs;
  const options = [];
  const add = (activity, zone, weight, why) => { if (weight > 0) options.push({ activity, zone, weight, why }); };

  // Hunger: go where the food is.
  const hunger = Math.max(0, 1 - n.food / NEEDS.hungry);
  for (const z of ZONE_IDS) { const f = foodIn(objs, z, w) * 5; add('forage', z, (0.15 + 3 * hunger) * f * f, 'food'); }
  // Cold: fire if there is one, else huddle where others are.
  const cold = Math.max(0, 1 - n.warmth / NEEDS.cold);
  for (const z of ZONE_IDS) {
    const st = objs.stats[z];
    const heat = st.heat;
    const company = st.wobs - (w.zone === z ? 1 : 0);
    const huts = st.huts;
    add('warm', z, (2 * cold + 6 * cold * cold) * (0.2 + heat * (1 + w.traits.boldness) * 2 + company * 0.4 + (z === 'hollow' ? 0.3 : 0) + huts * 0.8), 'warmth');
  }
  // Tired: rest where you are, or in the hollow.
  const tired = Math.max(0, 1 - n.rest / NEEDS.tired);
  add('rest', w.zone, 0.2 + 4 * tired, 'rest');
  add('rest', 'hollow', 0.1 + 1.5 * tired, 'rest');
  // Curiosity pull: new Keeper objects from the last 24 ticks.
  // Only the two newest unseen things pull, and a hungry, cold or tired
  // Wobblin is much less curious.
  const comfort = Math.max(0.1, 1 - Math.max(hunger, cold, tired));
  const novel = objs.novel.filter(o => !w.seen.includes(o.id)).slice(0, 2);
  for (const o of novel) add('inspect', o.zone, (1.5 * w.traits.curiosity + 0.3) * comfort, o.id);
  // Hobby.
  const h = HOBBY_ZONES[w.hobby];
  for (const z of ZONE_IDS) {
    let wgt = h.zones.includes(z) ? 0.4 : 0.05;
    wgt += zoneObjects(objs, z).filter(o => h.kinds.includes(o.kind)).length * 0.3;
    if (w.hobby === 'humming') wgt += (objs.stats[z].wobs - (w.zone === z ? 1 : 0)) * 0.2;
    add('hobby', z, wgt * (0.5 + w.traits.playfulness), 'hobby');
  }
  // A Keeper curio pulls its two chosen Wobblins over for a while.
  // It is a strong pull, but needs still come first.
  const curio = objs.curios.find(o => o.state.targets.includes(w.id));
  if (curio && w.stage !== 'baby') add('inspect', curio.zone, 6 * comfort, curio.id);
  // Babies stay near a parent.
  if (w.stage === 'baby') {
    const parent = live.find(p => w.parents.includes(p.id));
    if (parent) return { activity: 'play', zone: parent.zone };
  }
  const choice = weightedPick(r, options, o => o.weight);
  return choice || { activity: 'rest', zone: w.zone };
}

export function creaturesStep(world) {
  const live = alive(world);
  const objs = liveObjects(world);
  objs.byZone = {};
  for (const o of objs) (objs.byZone[o.zone] ||= []).push(o);
  // Per-zone facts every Wobblin's choice reads (same snapshot for all).
  objs.stats = {};
  for (const z of ZONE_IDS) {
    objs.stats[z] = { heat: warmthSources(objs, z), huts: zoneObjects(objs, z).filter(o => o.kind === 'hut').length,
      wobs: live.filter(w => w.zone === z).length };
  }
  objs.novel = objs.filter(o => (o.origin.action !== undefined || o.state.byKeeper) && world.tick - o.builtTick <= SOCIAL.curiosityPull)
    .sort((a, b) => b.builtTick - a.builtTick);
  objs.curios = objs.filter(o => o.kind === 'curio' && !o.state.pullDone);
  for (const w of live) {
    for (const k of sortedKeys(w.temp)) {
      if (w.temp[k].until <= world.tick) delete w.temp[k];
    }
    const stage = stageFor(w, world.tick);
    if (stage !== w.stage) {
      const was = w.stage;
      w.stage = stage;
      if (stage === 'elder') emit(world, { kind: 'became_elder', actors: [w.id], salience: 2 });
      else if (was === 'baby') emit(world, { kind: 'grew_up', actors: [w.id], salience: 1 });
    }
  }
  // Decide first (from the same snapshot), then apply, so order by id cannot
  // let early movers change later choices within the tick.
  const plans = live.map(w => [w, chooseActivity(world, w, objs, live)]);
  for (const [w, p] of plans) {
    w.activity = p.activity;
    w.zone = p.zone;
    if (p.activity === 'inspect') {
      if (!w.seen.includes(p.why)) w.seen.push(p.why);
      if (w.seen.length > 8) w.seen.shift();
    }
  }
  for (const w of live) updateNeeds(world, w, objs, live);
  // Materials a Wobblin has been near (unlocks curios).
  for (const w of live) {
    for (const o of objs) {
      if (o.zone === w.zone && world.noticed[o.kind] === undefined) world.noticed[o.kind] = world.tick;
    }
  }
}
