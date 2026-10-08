// replay.js — rebuild a world from a save: seed + ordered action list.
import { createWorld } from './world.js';
import { tick } from './tick.js';
import { applyAction } from './actions.js';

export function sortActions(actions) {
  return actions.slice().sort((a, b) => a.t - b.t || a.seq - b.seq);
}

// Apply every action logged for the world's current tick, in seq order.
export function applyActionsAt(world, sorted, from) {
  let i = from;
  while (i < sorted.length && sorted[i].t < world.tick) i++;  // stale, skip
  while (i < sorted.length && sorted[i].t === world.tick) applyAction(world, sorted[i++]);
  return i;
}

// replay(save, nowTick) -> world with world.tick === nowTick.
// For t = 0..nowTick: apply actions with that t, then tick() if t < nowTick.
export function replay(save, nowTick) {
  const world = createWorld(save.seed, { colonyName: save.colonyName, keeperName: save.keeperName, barren: save.barren });
  const sorted = sortActions(save.actions || []);
  let i = 0;
  for (;;) {
    i = applyActionsAt(world, sorted, i);
    if (world.tick >= nowTick) break;
    tick(world);
  }
  return world;
}
