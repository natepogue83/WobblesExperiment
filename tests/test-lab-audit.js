// test-lab-audit.js — regression tests for the defects found in the 2026-10-11 independent
// review (lab/research/reviews/2026-10-11-astra-review.md). Each test is the review's probe.
import assert from 'node:assert/strict';
import { newColony, run, step, fireReport } from '../lab/sim.js';
import { remember, creatureStep } from '../lab/creature.js';
import { addObject, worldStep, walled, DAY } from '../lab/world.js';
import { section, ok } from './lib.js';

section('Audit A: watching a fire being fed does not make a practitioner');
{
  const w = newColony(1, 6, { threat: false });
  const c = w.creatures[0];
  for (let i = 0; i < 7; i++) remember(c, 'glowing lump|mid|dry|glow>place+pale tuft|small|dry|', 'fire_grew', 0.2, 0.6);
  assert.equal(fireReport(w).doers.includes(c.id), false);
  w.events.push({ t: w.tick, kind: 'fed_fire', who: c.id, material: 'grass' });
  assert.equal(fireReport(w).doers.includes(c.id), true);
  ok('seven invited observations make no doer; one real feed makes one');
}

section('Audit B: one attack is remembered once');
{
  const w = newColony(2, 6, { threat: false });
  run(w, 20);
  const c = w.creatures[0];
  c.attackedAt = { x: c.x, y: c.y, t: w.tick };
  const before = w.events.length;
  const count = () => [...c.exp.values()].reduce((a, e) => a + (e.outcomes.attacked || 0), 0);
  run(w, 8);
  const witness = w.events.slice(before).filter(e => e.kind === 'saw' && e.outcome === 'attacked').length;
  assert.equal(count(), 1, 'victim attack memories: ' + count());
  assert.ok(witness <= 5, 'witness events ' + witness);   // at most one per nearby creature, once
  const again = w.events.length; run(w, 8);
  assert.equal(w.events.slice(again).filter(e => e.kind === 'saw' && e.outcome === 'attacked').length, 0);
  ok(`a single attack gives the victim one memory and witnesses one each (${witness}), and nothing after`);
}

section('Audit C: walking toward shelter is not resting in it');
{
  const w = newColony(3, 1, { threat: false });
  run(w, 17);   // night
  const c = w.creatures[0];
  c.plan = { action: 'rest', target: { x: Math.min(17, c.x + 3), y: c.y, cell: true, kind: null }, key: 'night>rest+walls', since: w.tick };
  const n0 = { ...c.night };
  step(w);
  assert.equal(c.night.rested - n0.rested, 0);
  assert.equal(c.night.ticks - n0.ticks, 1);
  ok('a night tick spent walking toward a resting place counts as a night tick, not a rest');
}

section('Audit D: the targeted predator reads what was actually done');
{
  const w = newColony(4, 1, { threat: false });
  run(w, 10);
  const c = w.creatures[0];
  c.lastAction = 'rest';
  c.plan = { action: 'wander', target: null, key: 'wander', since: w.tick };
  step(w);
  assert.notEqual(c.lastAction, 'rest');
  ok('after a wandering step lastAction is "' + c.lastAction + '", not "rest"');
}

section('Audit: Keeper rain is a real spell of rain');
{
  const w = newColony(5, 1, { threat: false });
  run(w, 30);
  w.weather.forcedUntil = w.tick + 4;
  step(w);
  assert.equal(w.weather.rain, 1);
  ok('rain forced by the Keeper is not overwritten by the schedule on the next step');
}

section('Audit: the positive-control predator kills an exposed sleeper');
{
  let deaths = 0;
  for (const s of [1, 2, 3, 4]) { const w = newColony(s, 6, { threat: true, threatMode: 'exposure' }); run(w, 20 * DAY); deaths += w.events.filter(e => e.cause === 'the beast').length; }
  assert.ok(deaths >= 4, 'deaths ' + deaths);
  ok(`the exposure predator killed ${deaths} in four 20-day colonies`);
}

console.log('\ntest-lab-audit: all passed');
