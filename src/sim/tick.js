// tick.js — one tick = one colony day.
// Order: environment -> creatures -> experiments -> teaching -> life events.
import { NATURE, POWER } from './constants.js';
import { rngFor, chance } from './rng.js';
import { emit } from './events.js';
import { creaturesStep } from './creatures.js';
import { experimentStep, teachingStep } from './experiment.js';

function environmentStep(world) {
  const c = world.climate;
  const t = world.tick;
  const r = rngFor(world.seed, 'weather', t);

  if (c.until !== null && t >= c.until) {
    c.season = 'mild'; c.tempMod = 0; c.until = null;
  }

  if (c.rain > 0) {
    c.rain--;
    c.wetUntil = t + POWER.wetTicks;
  } else if (chance(r, NATURE.rainChance)) {
    c.rain = 1;
    c.wetUntil = t + POWER.wetTicks;
    emit(world, { kind: 'rain', data: { natural: true, ticks: 1 }, salience: 1 });
  }

  const coldP = NATURE.coldNightChance + (c.season === 'cold' ? 0.5 : c.season === 'warm' ? -0.2 : 0);
  c.cold = chance(r, coldP);
}

function lifeEventsStep(world) {
  // Day 2: pairing, births, deaths, graves, seed pod. Day 5: wishes, offerings.
  void world;
}

export function tick(world) {
  environmentStep(world);
  creaturesStep(world);
  experimentStep(world);
  teachingStep(world);
  lifeEventsStep(world);
  world.tick++;
  return world;
}
