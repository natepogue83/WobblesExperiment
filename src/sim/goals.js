// goals.js — the Keeper's path. Ages name how far the colony has come; goals
// are outcomes to aim for (never recipes), read from the world and its event
// log. Claiming a reached goal is a Keeper action ({ type: "claim", goal }), so
// it replays, and it adds belief. Never adds knowledge.
import { BY_ID, DISCOVERIES } from './discoveries.js';

export const AGES = [
  { tier: 0, name: 'The First Days' },
  { tier: 1, name: 'The Pebble Age' },
  { tier: 2, name: 'The Ember Age' },
  { tier: 3, name: 'The Village Age' },
  { tier: 4, name: 'The Age of Wonders' }
];

// One pass over the log: everything the goals need.
export function progressOf(world) {
  const found = Object.keys(world.discoveries).filter(id => BY_ID[id]);
  const tier = found.reduce((m, id) => Math.max(m, BY_ID[id].tier), 0);
  let friends = 0, births = 0, grandkids = 0, festivals = 0;
  let added = 0;
  for (const e of world.events) {
    if (e.kind === 'friends') friends++;
    else if (e.kind === 'festival') festivals++;
    if (e.kind === 'birth') { births++; added++; }
    else if (e.kind === 'stranger_arrived') added++;
    else if (e.kind === 'seed_pod_hatched') added += e.actors.length;
  }
  // Population over time, replayed from the log: founders, then arrivals and deaths.
  let pop = world.wobblins.length - added, maxPop = pop;
  const byId = new Map(world.wobblins.map(w => [w.id, w]));
  for (const e of world.events) {
    if (e.kind === 'birth' || e.kind === 'stranger_arrived') pop++;
    else if (e.kind === 'seed_pod_hatched') pop += e.actors.length;
    else if (e.kind === 'death') pop--;
    if (pop > maxPop) maxPop = pop;
    if (e.kind === 'birth') {
      const parents = e.actors.slice(1).map(id => byId.get(id)).filter(Boolean);
      if (parents.some(p => p.parents && p.parents.length)) grandkids++;
    }
  }
  return { found: found.length, known: id => !!world.discoveries[id], tier, friends, births, grandkids, festivals, maxPop };
}

export function ageOf(world, p = progressOf(world)) {
  return AGES[p.tier];
}

// text: the goal; hint: a nudge toward it (what helps, never the recipe).
export const GOALS = [
  { id: 'first_idea', belief: 2, text: 'Watch them work something out', hint: 'Put something new near a curious Wobblin and wait.', done: p => p.found >= 1 },
  { id: 'friends', belief: 2, text: 'See two of them become best friends', hint: 'Time together builds friendships. Set friends down side by side.', done: p => p.friends >= 1 },
  { id: 'fire', belief: 3, text: 'Help them tame fire', hint: 'Fire has to start somehow, and someone brave has to go near it.', done: p => p.known('fire_warmth') },
  { id: 'ember', belief: 3, text: 'Reach the Ember Age', hint: 'Ideas build on ideas. Keep giving them new things to puzzle over.', done: p => p.tier >= 2 },
  { id: 'baby', belief: 3, text: 'Welcome a baby', hint: 'Two happy friends with a roof over their heads.', done: p => p.births >= 1 },
  { id: 'home', belief: 3, text: 'See them build a home', hint: 'Only a Wobblin who worries enough thinks of shelter.', done: p => p.known('hut') },
  { id: 'five', belief: 4, text: 'Grow the colony to five', hint: 'Babies, or strangers who wander in when the valley looks good.', done: p => p.maxPop >= 5 },
  { id: 'song', belief: 3, text: 'Hear them sing together', hint: 'Music comes from playful, sociable Wobblins.', done: p => p.known('song') },
  { id: 'ten', belief: 4, text: 'Ten discoveries', hint: 'Different discoveries need different temperaments. Breed for them.', done: p => p.found >= 10 },
  { id: 'village', belief: 4, text: 'Reach the Village Age', hint: 'Homes, hearths, gardens: a real village.', done: p => p.tier >= 3 },
  { id: 'three_gen', belief: 5, text: 'See three generations', hint: 'A baby whose parent was born in your valley.', done: p => p.grandkids >= 1 },
  { id: 'temple', belief: 5, text: 'Have them build you a temple', hint: 'Faith in you, a devout Wobblin, and something big to build on.', done: p => p.known('temple') },
  { id: 'wonders', belief: 5, text: 'Reach the Age of Wonders', hint: 'The last ideas need the wisest, oldest knowledge.', done: p => p.tier >= 4 },
  { id: 'festival', belief: 4, text: 'Throw a festival', hint: 'A big, happy, musical colony celebrates.', done: p => p.festivals >= 1 || p.known('festival') },
  { id: 'all', belief: 10, text: `All ${DISCOVERIES.length} discoveries`, hint: 'Every temperament, every material, every season.', done: p => p.found >= DISCOVERIES.length }
];
export const GOAL_BY_ID = Object.fromEntries(GOALS.map(g => [g.id, g]));

// Each goal's state for the UI: claimed, ready (reached, not claimed) or open.
export function goalStates(world, p = progressOf(world)) {
  const claimed = new Set(world.goalsClaimed || []);
  return GOALS.map(g => ({ ...g, state: claimed.has(g.id) ? 'claimed' : g.done(p) ? 'ready' : 'open' }));
}
