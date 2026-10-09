// test-lab.js — the artificial-life lab keeps its results. Four colonies each,
// loose thresholds: this guards against regressions, not luck.
import assert from 'node:assert/strict';
import { newColony, run, keeperPlace, clone, fireReport } from '../lab/sim.js';
import { section, ok } from './lib.js';

const SEEDS = [1, 3, 4, 5];

section('Lab: fire-keeping is learned, spreads by watching, outlives its discoverer');
{
  let kept = 0, spread = 0, outlived = 0;
  for (const s of SEEDS) {
    const w = newColony(s, 6);
    run(w, 48); keeperPlace(w, 'ember', 9, 5, { fuel: 120 }); run(w, 14 * 24);
    const rep = fireReport(w);
    if (rep.alive) kept++;
    if (rep.doers.length >= 2) spread++;
    if (rep.first) {
      const b = clone(w); const d = b.creatures.find(c => c.id === rep.first); if (d) d.alive = false;
      const before = b.events.length; run(b, 5 * 24);
      if (b.events.slice(before).some(e => e.kind === 'fed_fire' && e.who && e.who !== rep.first) && fireReport(b).alive) outlived++;
    }
  }
  assert.ok(kept >= 2 && spread >= 2 && outlived >= 2, `kept ${kept} spread ${spread} outlived ${outlived}`);
  ok(`4 colonies: fire kept in ${kept}, spread to 2+ in ${spread}, outlived its discoverer in ${outlived}`);
}

section('Lab: knowledge travels only by contact');
{
  let clean = 0;
  for (const s of SEEDS) {
    const w = newColony(s, 6);
    run(w, 48); keeperPlace(w, 'ember', 9, 5, { fuel: 120 });
    for (let t = 0; t < 14 * 24; t++) { const c = w.creatures.find(k => k.id === 'c2'); if (c) { c.x = 16; c.y = 1; } run(w, 1); }
    if (!fireReport(w).knowers.includes('c2')) clean++;
  }
  assert.equal(clean, SEEDS.length);
  ok('an isolated creature never learned feeding in 4/4');
}

section('Lab: culture outlives its founders');
{
  let culture = 0;
  for (const s of SEEDS) {
    const w = newColony(s, 6);
    run(w, 48); keeperPlace(w, 'ember', 9, 5, { fuel: 120 }); run(w, 70 * 24 - 48);
    const founders = w.creatures.slice(0, 6);
    const late = w.events.filter(e => e.kind === 'fed_fire' && e.who && e.t > 66 * 24 && !founders.some(f => f.id === e.who));
    if (founders.every(c => !c.alive) && fireReport(w).alive && late.length) culture++;
  }
  assert.ok(culture >= 2, 'culture ' + culture);
  ok(`the fire outlived every founder and was fed by their descendants in ${culture}/4`);
}


section('Lab: the deeper world holds together (tools, wood, the prowler)');
{
  let shards = 0, drove = 0, visits = 0, alive = 0;
  for (const s of SEEDS) {
    const w = newColony(s, 6);
    run(w, 48); keeperPlace(w, 'ember', 9, 5, { fuel: 120 }); run(w, 30 * 24);
    if (w.events.some(e => e.kind === 'made_shard')) shards++;
    drove += w.events.filter(e => e.kind === 'drove_off').length;
    visits += w.events.filter(e => e.kind === 'prowler_came').length;
    if (w.creatures.filter(c => c.alive).length >= 3) alive++;
  }
  assert.ok(visits >= 4, 'the prowler came ' + visits);
  assert.ok(shards >= 1, 'shards in ' + shards);
  assert.ok(alive >= 3, 'colonies with 3+ alive: ' + alive);
  ok('30 days: the prowler came ' + visits + ' times and was driven off ' + drove + '; a shard was struck in ' + shards + '/4 colonies; 3+ alive at the end in ' + alive + '/4');
}

section('Lab: deterministic');
{
  const a = newColony(7, 6), b = newColony(7, 6);
  run(a, 48); run(b, 48); keeperPlace(a, 'ember', 9, 5, { fuel: 120 }); keeperPlace(b, 'ember', 9, 5, { fuel: 120 }); run(a, 200); run(b, 200);
  assert.equal(JSON.stringify(a.events.slice(-40)), JSON.stringify(b.events.slice(-40)));
  assert.equal(a.creatures.map(c => c.x + ',' + c.y + ',' + c.needs.energy.toFixed(4)).join(';'), b.creatures.map(c => c.x + ',' + c.y + ',' + c.needs.energy.toFixed(4)).join(';'));
  ok('the same seed gives the same world, tick for tick');
}

console.log('\ntest-lab: all passed');
