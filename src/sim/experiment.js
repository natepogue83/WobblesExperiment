// experiment.js — the discovery engine. The ONLY module that may add knowledge
// (world.discoveries, wobblin.knows) or emit knowledge events (rule zero).
// Day 1: skeleton. Candidates, scoring, teaching and forgetting land on Day 4.
import { KNOWLEDGE, emit } from './events.js';

export function experimentStep(world) {
  // Day 4: per eligible Wobblin, score candidates, roll attempts (colony cap),
  // roll success, record inventor + causes, or roll a misfire.
  void world;
}

export function teachingStep(world) {
  // Day 4: knower/non-knower pairs in the same zone, learning from structures,
  // forgetting when the last knower dies, Lore effects.
  void world;
}

// Internal: the single place a discovery is written. Exported for the
// experiment engine's own use and for tests of the emitter guard.
export function recordDiscovery(world, wobblin, discoveryId, causes, source) {
  const prev = world.discoveries[discoveryId];
  const kind = prev && prev.forgotten ? 'rediscovery' : 'discovery';
  world.discoveries[discoveryId] = { inventor: wobblin.id, tick: world.tick, causes, forgotten: false };
  wobblin.knows[discoveryId] = { since: world.tick, from: 'self' };
  return emit(world, {
    kind,
    actors: [wobblin.id],
    target: discoveryId,
    data: { source: kind === 'rediscovery' ? 'rediscovery' : source, zone: wobblin.zone },
    salience: 5,
    causes
  }, KNOWLEDGE);
}
