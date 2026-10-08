// misfires.js — what happens when an experiment fails.
// Day 4: a plain experiment_failed event. Day 5 adds the misfire table,
// injuries, burned structures, lost items and superstitions.
import { emit } from './events.js';

export function onExperimentFailed(world, w, d, match, r) {
  void match; void r;
  emit(world, { kind: 'experiment_failed', actors: [w.id], target: d.id, data: { zone: w.zone }, salience: 1 });
}
