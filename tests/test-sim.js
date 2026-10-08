// test-sim.js — determinism, purity, rule-zero emitter guard, world creation.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorld, tick, stateHash } from '../src/sim/index.js';
import { mulberry32, rngFor } from '../src/sim/rng.js';
import { emit } from '../src/sim/events.js';
import { recordDiscovery } from '../src/sim/experiment.js';
import { section, ok, timeIt } from './lib.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SIM = join(ROOT, 'src', 'sim');

section('RNG');
{
  // mulberry32 must match ISO's implementation bit for bit.
  const isoSim = 'C:\\Users\\ignit\\iso\\sim.js';
  if (existsSync(isoSim)) {
    const m = readFileSync(isoSim, 'utf8').match(/function mulberry32[\s\S]*?4294967296\}\}/);
    const isoMul = new Function(m[0] + '; return mulberry32;')();
    for (const seed of [0, 1, 42, 123456789, 4294967295]) {
      const a = mulberry32(seed), b = isoMul(seed);
      for (let i = 0; i < 1000; i++) assert.equal(a(), b());
    }
    ok('mulberry32 matches ISO sim.js bit for bit (5 seeds x 1000 draws)');
  } else ok('ISO repo not found, skipped mulberry32 cross-check');

  const a = rngFor(7, 'experiment', 3, 'w1'), b = rngFor(7, 'experiment', 3, 'w1');
  assert.equal(a(), b());
  assert.notEqual(rngFor(7, 'experiment', 3, 'w1')(), rngFor(7, 'experiment', 3, 'w2')());
  assert.notEqual(rngFor(7, 'weather', 3)(), rngFor(8, 'weather', 3)());
  ok('rngFor sub-streams are stable and independent');
}

section('Determinism');
{
  const run = seed => { const w = createWorld(seed); for (let i = 0; i < 2160; i++) tick(w); return w; };
  const { v: w1, ms } = timeIt(() => run(12345));
  const w2 = run(12345);
  assert.equal(w1.tick, 2160);
  assert.equal(stateHash(w1), stateHash(w2));
  ok('same seed after 2,160 ticks gives identical stateHash ' + stateHash(w1) + ' (' + ms.toFixed(1) + ' ms)');
  assert.notEqual(stateHash(run(12346)), stateHash(w1));
  ok('different seed gives a different hash');
  // Stored floats are rounded to 3 decimals.
  const bad = [];
  JSON.stringify(w1, (k, v) => { if (typeof v === 'number' && Math.round(v * 1000) / 1000 !== v) bad.push(k + '=' + v); return v; });
  assert.deepEqual(bad, []);
  ok('every stored number is rounded to 3 decimals');
}

section('Purity');
{
  const files = readdirSync(SIM).filter(f => f.endsWith('.js'));
  assert.ok(files.length >= 8);
  for (const f of files) {
    const src = readFileSync(join(SIM, f), 'utf8');
    assert.ok(!/Math\.random/.test(src), f + ' uses Math.random');
    assert.ok(!/\bDate\b/.test(src), f + ' mentions Date');
    assert.ok(!/\bperformance\b/.test(src), f + ' uses performance');
    assert.ok(!/localStorage|document\.|window\./.test(src), f + ' touches the browser');
  }
  ok(files.length + ' files in src/sim/ are free of Math.random, Date, performance and browser APIs');
}

section('Rule zero: knowledge emitter guard');
{
  const w = createWorld(1);
  for (const kind of ['discovery', 'rediscovery', 'taught', 'learned_from_structure', 'forgotten']) {
    assert.throws(() => emit(w, { kind }), /rule zero/);
  }
  ok('knowledge events cannot be emitted without the internal tag');

  const importers = [];
  const walk = dir => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (p.endsWith('.js') && /\bKNOWLEDGE\b/.test(readFileSync(p, 'utf8'))) importers.push(p.slice(ROOT.length + 1).replace(/\\/g, '/'));
    }
  };
  walk(join(ROOT, 'src'));
  assert.deepEqual(importers.sort(), ['src/sim/events.js', 'src/sim/experiment.js']);
  ok('only experiment.js uses the KNOWLEDGE tag');

  const e = recordDiscovery(w, w.wobblins[0], 'fire_warmth', [], 'experiment');
  assert.equal(e.kind, 'discovery');
  assert.equal(e.data.source, 'experiment');
  assert.equal(w.discoveries.fire_warmth.inventor, 'w1');
  w.discoveries.fire_warmth.forgotten = true;
  const e2 = recordDiscovery(w, w.wobblins[1], 'fire_warmth', [], 'experiment');
  assert.equal(e2.kind, 'rediscovery');
  assert.equal(e2.data.source, 'rediscovery');
  ok('recordDiscovery tags source and marks rediscovery');
}

section('createWorld');
{
  for (let seed = 1; seed <= 200; seed++) {
    const w = createWorld(seed);
    const count = k => w.objects.filter(o => o.kind === k).length;
    assert.equal(w.wobblins.length, 3);
    assert.ok(w.wobblins.every(x => x.stage === 'adult'));
    assert.ok(count('stones') >= 1 && count('stones') <= 2);
    assert.equal(count('bush'), 1);
    assert.ok(count('tree') <= 1);
    assert.equal(count('fire') + count('pond') + count('clay'), 0);
    assert.ok(w.objects.every(o => o.origin.natural === true));
    assert.equal(new Set(w.objects.map(o => o.slot)).size, w.objects.length);
    assert.equal(new Set(w.wobblins.map(x => x.name)).size, 3);
    assert.equal(w.events[0].kind, 'colony_founded');
  }
  ok('200 seeds: sparse start (1-2 stones, 1 bush, 0-1 tree, no fire/pond/clay), unique slots and names');
  const b = createWorld(5, { barren: true });
  assert.equal(b.objects.length, 0);
  ok('barren fixture has no objects');
  assert.equal(createWorld(9, { colonyName: 'Test Nook', keeperName: 'Nate' }).colonyName, 'Test Nook');
  ok('names pass through opts');
}

console.log('\ntest-sim: all passed');
