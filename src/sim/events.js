// events.js — the append-only event log.
// Knowledge events can only be emitted with the KNOWLEDGE tag, and only
// experiment.js may import it (rule zero, enforced by tests/test-sim.js).
import { MEMORY_LEN } from './constants.js';
import { findWobblin } from './util.js';

export const KNOWLEDGE = Symbol('knowledge-emitter');

export const KNOWLEDGE_KINDS = new Set([
  'discovery', 'rediscovery', 'taught', 'learned_from_structure', 'forgotten'
]);

// emit(world, { kind, actors, target, data, salience, causes }, tag?) -> event
export function emit(world, ev, tag) {
  if (KNOWLEDGE_KINDS.has(ev.kind) && tag !== KNOWLEDGE) {
    throw new Error('rule zero: "' + ev.kind + '" may only be emitted by experiment.js');
  }
  const e = {
    id: world.nextIds.e++,
    t: world.tick,
    kind: ev.kind,
    actors: ev.actors || [],
    target: ev.target === undefined ? null : ev.target,
    data: ev.data || {},
    salience: ev.salience || 1,
    causes: ev.causes || []
  };
  world.events.push(e);
  // Salient events become memories of the Wobblins involved.
  if (e.salience >= 2) {
    for (const id of e.actors) {
      const w = findWobblin(world, id);
      if (!w) continue;
      w.memories.push(e.id);
      if (w.memories.length > MEMORY_LEN) w.memories.shift();
    }
  }
  return e;
}

export function eventsBetween(world, fromTick, toTick) {
  // (fromTick, toTick]
  return world.events.filter(e => e.t > fromTick && e.t <= toTick);
}
