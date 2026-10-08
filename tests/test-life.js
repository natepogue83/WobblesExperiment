// test-life.js — survival, Hut gating, births, deaths, graves, seed pod.
import assert from 'node:assert/strict';
import { createWorld, tick } from '../src/sim/index.js';
import { makeObject } from '../src/sim/world.js';
import { POP_CAP } from '../src/sim/constants.js';
import { section, ok } from './lib.js';

const aliveCount = w => w.wobblins.filter(x => x.alive).length;

section('Survival with no player actions');
{
  let hardship = 0, deaths = 0, hatched = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const w = createWorld(seed);
    for (let i = 0; i < 336; i++) tick(w);
    const pod = w.events.some(e => e.kind === 'seed_pod_hatched');
    if (pod) hatched++;
    assert.ok(aliveCount(w) > 0 || pod, 'seed ' + seed + ' died out with no seed pod');
    for (const x of w.wobblins) if (!x.alive) {
      deaths++;
      if (x.deathCause === 'starvation' || x.deathCause === 'cold') hardship++;
      assert.ok(w.objects.some(o => o.kind === 'grave' && o.state.of === x.id), 'death leaves a grave');
    }
    // Needs and counters stay in range.
    for (const x of w.wobblins) for (const v of Object.values(x.needs)) assert.ok(v >= 0 && v <= 1);
  }
  ok('200 seeds x 336 ticks: colony alive or seed pod hatched in 100% (' + hatched + ' pods hatched)');
  assert.ok(hardship / deaths < 0.03, 'hardship deaths ' + hardship + '/' + deaths);
  ok('hardship deaths are rare without the Keeper: ' + hardship + ' of ' + deaths + ' (rest are old age)');
}

section('Seed pod');
{
  const w = createWorld(3);
  for (const x of w.wobblins) { x.alive = false; x.deathTick = 0; x.deathCause = 'test'; }
  for (let i = 0; i < 23; i++) tick(w);
  assert.equal(aliveCount(w), 0);
  for (let i = 0; i < 3; i++) tick(w);
  assert.equal(aliveCount(w), 2);
  assert.ok(w.events.some(e => e.kind === 'seed_pod_hatched'));
  assert.equal(w.events.filter(e => e.kind === 'colony_founded').length, 1);
  ok('an empty valley hatches 2 Wobblins after 24 ticks, and history stays');
}

section('Hut gating');
{
  for (let seed = 1; seed <= 50; seed++) {
    const w = createWorld(seed);
    for (let i = 0; i < 500; i++) tick(w);
    assert.equal(w.events.filter(e => e.kind === 'birth' || e.kind === 'paired').length, 0, 'seed ' + seed);
  }
  ok('50 seeds x 500 ticks without a Hut: no pairing, no births');

  let withBirth = 0, maxPop = 0;
  for (let seed = 1; seed <= 50; seed++) {
    const w = createWorld(seed);
    // Hut stub: place two huts directly (the Hut discovery builds them from Day 5).
    makeObject(w, { kind: 'hut', slot: 'hollow.1', origin: { natural: true } });
    makeObject(w, { kind: 'hut', slot: 'hollow.3', origin: { natural: true } });
    for (let i = 0; i < 500; i++) {
      tick(w);
      maxPop = Math.max(maxPop, aliveCount(w));
      assert.ok(aliveCount(w) <= POP_CAP);
    }
    const births = w.events.filter(e => e.kind === 'birth');
    if (births.length) withBirth++;
    for (const b of births) {
      const baby = w.wobblins.find(x => x.id === b.actors[0]);
      assert.deepEqual(baby.parents, b.actors.slice(1));
      assert.equal(baby.bornTick, b.t);
      assert.deepEqual(baby.knows, {}, 'babies are born knowing nothing');
      const [p1, p2] = baby.parents.map(id => w.wobblins.find(x => x.id === id));
      for (const k of Object.keys(baby.traits)) {
        assert.ok(Math.abs(baby.traits[k] - (p1.traits[k] + p2.traits[k]) / 2) <= 0.151, 'inherits ' + k);
      }
    }
  }
  assert.ok(withBirth / 50 >= 0.8, 'births in ' + withBirth + '/50');
  ok('with Huts, at least 1 birth in ' + withBirth + '/50 seeds (>= 80%); babies inherit parent traits +-0.15; max population ' + maxPop);
}

section('Natural events');
{
  const kinds = {};
  for (let seed = 1; seed <= 50; seed++) {
    const w = createWorld(seed);
    makeObject(w, { kind: 'hut', slot: 'hollow.1', origin: { natural: true } });
    makeObject(w, { kind: 'hut', slot: 'hollow.3', origin: { natural: true } });
    for (let i = 0; i < 1000; i++) tick(w);
    for (const e of w.events) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
    for (const f of w.events.filter(e => e.kind === 'fire_started')) assert.ok(f.causes.length && f.causes[0].event, 'fire has a cause');
  }
  for (const k of ['rain', 'lightning', 'fire_started', 'fire_out', 'prowler', 'death', 'became_elder']) {
    assert.ok(kinds[k] > 0, 'no ' + k);
  }
  ok('rain, dry lightning, fires, fire-outs and prowlers all happen: ' +
    ['rain', 'lightning', 'fire_started', 'prowler'].map(k => k + ' ' + kinds[k]).join(', '));
}

console.log('\ntest-life: all passed');
