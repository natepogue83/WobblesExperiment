// tick.js — one tick = one colony day.
// Order: environment -> creatures -> experiments -> teaching -> life events.
import { environmentStep } from './nature.js';
import { creaturesStep } from './creatures.js';
import { experimentStep, teachingStep } from './experiment.js';
import { lifeEventsStep } from './life.js';
import { growthStep } from './growth.js';
import { socialStep, iceStep } from './interactions.js';
import { asksStep } from './asks.js';
import { beginTickCache, endTickCache } from './util.js';

export function tick(world) {
  beginTickCache(world);
  try {
  environmentStep(world);
  creaturesStep(world);
  growthStep(world);
  socialStep(world);
  iceStep(world);
  asksStep(world);
  experimentStep(world);
  teachingStep(world);
  lifeEventsStep(world);
  } finally { endTickCache(); }
  world.tick++;
  return world;
}
