// test-tuning.js — Day 7 pacing targets, measured in ticks (1 tick = 1 real hour).
// These guard the feel: a first session should pay off fast, and coming back
// after a few hours should find things changed.
import assert from 'node:assert/strict';
import { createWorld, tick, applyAction } from '../src/sim/index.js';
import { BY_ID } from '../src/sim/discoveries.js';
import { generousActions, runScript, section, ok } from './lib.js';
import { renderState } from '../src/render/render.js';

const MEANINGFUL = new Set(['discovery', 'rediscovery', 'built', 'birth', 'death', 'superstition', 'burned', 'forgotten', 'paired',
  'stranger_arrived', 'festival', 'ritual', 'wish', 'misfire', 'pondering', 'lost', 'seed_pod_hatched', 'tree_grown', 'pond_formed',
  'fire_started', 'prowler', 'flood', 'learned_from_structure']);

// Meaningful changes in a window: salient events, plus one for "skills spread".
export function changes(w, from) {
  const win = w.events.filter(e => e.t >= from);
  return win.filter(e => MEANINGFUL.has(e.kind) && e.salience >= 2).length + (win.some(e => e.kind === 'taught') ? 1 : 0);
}

section('First session');
{
  let quick = 0, reacted = 0, instant = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const w = createWorld(seed);
    const z = w.wobblins[0].zone;
    const slot = [1, 2, 3, 4, 5, 6].map(n => z + '.' + n).find(s => !w.objects.some(o => !o.state.gone && o.slot === s));
    applyAction(w, { seq: 1, t: 0, type: 'power', power: 'stone', slot, variant: 'stones' });
    if (renderState(w).reaction) instant++;
    tick(w);
    if (w.wobblins.some(x => x.activity === 'inspect')) reacted++;
    for (let i = 1; i < 6; i++) tick(w);
    if (w.events.some(e => e.kind === 'discovery' && BY_ID[e.target].tier === 1)) quick++;
  }
  assert.equal(instant, 200);
  assert.ok(reacted >= 140, 'reacted ' + reacted);
  ok('one Drop Stone where they stand: an instant on-screen reaction in 200/200, and someone walks over to inspect it next tick in ' + reacted + '/200');
  assert.ok(quick >= 150, 'quick ' + quick);
  ok('a tier 1 discovery within 6 ticks of the first stimulus in ' + quick + '/200 seeds');
}

section('Coming back after 6-8 hours');
{
  const rows = [];
  for (const [T0, minPct] of [[24, 85], [72, 40], [200, 40]]) {
    let good = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const w = createWorld(seed);
      runScript(w, T0, generousActions);
      const from = w.tick;
      for (let i = 0; i < 8; i++) tick(w);
      if (changes(w, from) >= 3) good++;
    }
    rows.push(`after ${T0} ticks of play: ${good}/100`);
    assert.ok(good >= minPct, `after ${T0}: ${good}/100 (want ${minPct})`);
  }
  ok('3+ meaningful changes in an 8-hour absence: ' + rows.join('; '));
}

console.log('\ntest-tuning: all passed');
