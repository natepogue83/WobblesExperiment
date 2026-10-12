// lab/sim.js — run the world: physics, then every creature in a fixed order.
// The Keeper's only verbs: put something down, and make it rain.
import { createLab, worldStep, addObject, live, emit, isNight, walled, covered, cellAt, W } from './world.js';
import { makeCreature, creatureStep, breedingStep } from './creature.js';
import { rngFor } from '../src/sim/rng.js';

export function newColony(seed, n = 6, opts = {}) {
  const world = createLab(seed, opts);
  const r = rngFor(seed, 'genomes');
  for (let i = 0; i < n; i++) {
    const g = { curiosity: 0.25 + r() * 0.6, patience: 0.25 + r() * 0.6, sociability: 0.25 + r() * 0.6, learnRate: 0.8 + r() * 0.5, caution: 0.2 + r() * 0.6, brawn: 0.3 + r() * 0.5 };
    makeCreature(world, 'c' + (i + 1), g, 6 + (i % 3) * 2, 4 + Math.floor(i / 3) * 2);
  }
  return world;
}

export function step(world) {
  worldStep(world);
  for (const c of world.creatures) creatureStep(world, c);
  breedingStep(world);
  // Night bookkeeping, measured after everyone has acted: where each creature is and what it actually did.
  if (isNight(world)) for (const c of world.creatures) {
    if (!c.alive) continue;
    const cell = cellAt(world, c.x, c.y), n = c.night;
    const company = world.creatures.filter(k => k !== c && k.alive && Math.max(Math.abs(k.x - c.x), Math.abs(k.y - c.y)) <= 1).length;
    const kind = cell.heat > 0 ? 'fire' : walled(world, c.x, c.y) ? 'walls' : covered(world, c.x, c.y) ? 'roof' : company >= 2 ? 'crowd' : 'open';
    n.ticks++; n[kind]++;
    // 'exposed' (post-action, descriptive): outside fire and walls, and, for the default predator's rules, not in a crowd of three.
    if (!(cell.heat > 0 || walled(world, c.x, c.y)) && company < 2) n.exposed++;
    if (c.did === 'rest') { n.rested++; if (cell.heat > 0 || walled(world, c.x, c.y)) n.restedProtected++; }
    if (c.didOutcome === 'ate') n.ate++;
    if (c.did === 'flee') n.fled++;
    if (c.attackedAt && c.attackedAt.t === world.tick) n.attacked++;
  }
  for (const c of world.creatures) c.lastAction = c.did;
  world.tick++;
  if (world.tick % 24 === 0) world.objects = world.objects.filter(o => !o.gone);   // drop what is gone; nothing points at it any more
}
export function run(world, ticks) { for (let i = 0; i < ticks; i++) step(world); return world; }

// Keeper verbs.
export function keeperPlace(world, kind, x, y, state = {}) {
  const o = addObject(world, kind, x, y, state);
  if (kind === 'ember') { o.burning = 1; o.fuel = state.fuel ?? 40; }
  if (kind === 'tree') o.hp = 6;
  emit(world, { kind: 'keeper_placed', material: kind, x, y, obj: o.id });
  return o;
}

// A snapshot deep enough to branch an experiment from (plain data).
export function clone(world) {
  const w = JSON.parse(JSON.stringify({ ...world, creatures: [], objects: world.objects.map(o => ({ ...o })) }));
  const byId = Object.fromEntries(w.objects.map(o => [o.id, o]));
  w.creatures = world.creatures.map(c => ({ ...c, needs: { ...c.needs }, genome: { ...c.genome }, bonds: { ...c.bonds }, places: JSON.parse(JSON.stringify(c.places || {})), builds: (c.builds || []).map(b => ({ ...b })), night: { ...(c.night || {}) }, risk: { ...(c.risk || {}) }, vuln: { ...(c.vuln || {}) }, attackedAt: c.attackedAt ? { ...c.attackedAt } : null, plan: null,
    carrying: c.carrying ? byId[c.carrying.id] : null, episodes: c.episodes.slice(),
    exp: new Map([...c.exp].map(([k, e]) => [k, { ...e, outcomes: { ...e.outcomes } }])) }));
  return w;
}

// Who fed the fire, and how knowledge of it sits in each head.
export function fireReport(world) {
  const feeds = world.events.filter(e => e.kind === 'fed_fire' && e.who);
  const byWho = {};
  for (const e of feeds) byWho[e.who] = (byWho[e.who] || 0) + 1;
  const source = live(world).find(o => o.burning > 0 && o.fuel > 0);
  // Knowers have any memory of a fire growing when fed (their own or seen). Doers have actually fed one.
  const knowers = world.creatures.filter(c => [...c.exp].some(([k, e]) => k.includes('glow>place') && e.outcomes.fire_grew));
  const doerIds = [...new Set(feeds.map(e => e.who))];
  const doers = doerIds.map(id => world.creatures.find(c => c.id === id)).filter(Boolean);
  return { alive: !!source, fuel: source ? source.fuel : 0, feeds: feeds.length, byWho, first: feeds[0] ? feeds[0].who : null,
    knowers: knowers.map(c => c.id), doers: doers.map(c => c.id), doersAlive: doers.filter(c => c.alive).map(c => c.id), living: world.creatures.filter(c => c.alive).length };
}

// Tell the story of the fire from the log, in plain words.
export function fireStory(world) {
  const lines = [];
  const k = world.events.find(e => e.kind === 'keeper_placed' && e.material === 'ember');
  if (k) lines.push(`Day ${Math.floor(k.t / 24) + 1}: a glowing lump appeared.`);
  const seenFeed = new Set();
  for (const e of world.events) {
    if (e.kind === 'fed_fire' && e.who && !seenFeed.has(e.who)) {
      seenFeed.add(e.who);
      const saw = world.events.find(s => s.kind === 'saw' && s.who === e.who && s.outcome === 'fire_grew' && s.t < e.t);
      lines.push(`Day ${Math.floor(e.t / 24) + 1}: ${e.who} put a ${e.material} on the glow and it grew` + (saw ? `, after watching ${saw.whom} do it.` : '. First to do it.'));
    }
    if (e.kind === 'fire_out') lines.push(`Day ${Math.floor(e.t / 24) + 1}: the glow went out.`);
    if (e.kind === 'died') lines.push(`Day ${Math.floor(e.t / 24) + 1}: ${e.who} died of ${e.cause}.`);
  }
  return lines;
}
