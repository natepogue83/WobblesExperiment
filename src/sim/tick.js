// tick.js — one tick = one colony day.
// Order: environment -> creatures -> experiments -> teaching -> life events.
import { environmentStep } from './nature.js';
import { creaturesStep } from './creatures.js';
import { experimentStep, teachingStep } from './experiment.js';
import { lifeEventsStep } from './life.js';
import { growthStep } from './growth.js';
import { socialStep, iceStep } from './interactions.js';

export function tick(world) {
  environmentStep(world);
  creaturesStep(world);
  growthStep(world);
  socialStep(world);
  iceStep(world);
  experimentStep(world);
  teachingStep(world);
  lifeEventsStep(world);
  world.tick++;
  return world;
}
