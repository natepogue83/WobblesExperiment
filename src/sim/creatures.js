// creatures.js — lifecycle, needs, movement, teaching hooks.
// Day 1: aging, stage changes, and expiry of temporary trait modifiers.
// Needs, movement, pairing, births and deaths arrive on Day 2.
import { LIFE } from './constants.js';
import { alive, sortedKeys } from './util.js';
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

export function creaturesStep(world) {
  for (const w of alive(world)) {
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
}
