// test-lab-audit.js — regression tests for the defects found in the 2026-10-11 independent
// review (lab/research/reviews/2026-10-11-astra-review.md). Each test is the review's probe.
import assert from 'node:assert/strict';
import { newColony, run, step, fireReport } from '../lab/sim.js';
import { remember, creatureStep, learnRisk } from '../lab/creature.js';
import { addObject, worldStep, walled, DAY, vulnerable, MATERIALS } from '../lab/world.js';
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
  // v3: attacks go into the predator-risk memory (weight 1 for the victim, 0.3 per witness), once.
  const count = k => Object.values(k.risk).reduce((a, b) => a + b, 0);
  const others0 = Object.fromEntries(w.creatures.map(k => [k.id, count(k)]));
  run(w, 8);
  const witnesses = w.events.slice(before).filter(e => e.kind === 'saw' && e.outcome === 'attacked');
  assert.equal(+count(c).toFixed(6), 1, 'victim risk memory: ' + count(c));
  assert.equal(new Set(witnesses.map(e => e.who)).size, witnesses.length, 'each witness at most once');
  for (const e of witnesses) { const k = w.creatures.find(x => x.id === e.who); assert.equal(+(count(k) - others0[k.id]).toFixed(6), 0.3, 'witness ' + k.id); }
  const again = w.events.length; run(w, 8);
  assert.equal(w.events.slice(again).filter(e => e.kind === 'saw' && e.outcome === 'attacked').length, 0);
  assert.equal(+count(c).toFixed(6), 1);
  ok(`one attack: the victim learns 1, each of ${witnesses.length} witnesses learns 0.3 once, and nothing after`);
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

// ---- added after the second review (v3) ----------------------------------------------------------
section('Risk learning off: no route into predator memory, own or observed');
{
  for (const off of [false, true]) {
    const w = newColony(1, 6, { threat: true, noRiskLearn: off });
    run(w, 20);
    const [v, k] = w.creatures; k.x = v.x; k.y = v.y;   // a witness right beside the victim
    v.attackedAt = { x: v.x, y: v.y, t: w.tick, place: 'open' };   // a predator attack, processed next step
    remember(v, 'dark beast>strike+grey lump|big|dry|', 'mauled', -0.4, 1);     // the failed-strike route
    remember(k, 'dark beast>strike+grey lump|big|dry|', 'mauled', -0.4, 0.45);  // ...as seen by the witness
    remember(v, 'dark beast>flee+fire', 'safe', 0.12, 1);                       // flight
    learnRisk(v, 'walls', 1);
    run(w, 3);
    const risk = c => Object.values(c.risk).reduce((a, b) => a + b, 0);
    const keys = c => [...c.exp.keys()].filter(x => x.startsWith('dark beast')).length;
    if (off) { assert.equal(risk(v), 0); assert.equal(risk(k), 0); assert.equal(keys(v), 0); assert.equal(keys(k), 0); }
    else { assert.ok(risk(v) > 0 && risk(k) > 0, 'risk learned when on'); assert.ok(keys(v) > 0 && keys(k) > 0); }
  }
  ok('with risk learning on, victim and witness learn from attack, mauling and flight; with it off, neither learns anything about the predator');
}

section('Risk learning off keeps comfort learning about rest, and credit from non-predator outcomes');
{
  const w = newColony(2, 6, { threat: false, noRiskLearn: true });
  run(w, 10 * DAY);
  const restKeys = w.creatures.reduce((a, c) => a + [...c.exp.keys()].filter(k => />rest/.test(k)).length, 0);
  const credited = w.creatures.reduce((a, c) => a + [...c.exp.values()].filter(e => e.outcomes.led_on || e.outcomes.paid_off).length, 0);
  assert.ok(restKeys > 0, 'rest comfort memories exist'); assert.ok(credited > 0, 'credit propagation still works');
  ok(`${restKeys} rest memories and ${credited} credited memories with risk learning off`);
}

section('Each predator rule is one definition: the direct predator ignores crowds');
{
  const w = newColony(3, 3, { threat: false });
  run(w, 17);
  const [a, b, c] = w.creatures; b.x = a.x; b.y = a.y; c.x = a.x; c.y = a.y;
  w.cells.forEach(cell => { cell.heat = 0; });
  assert.equal(vulnerable(w, a, 'default'), false, 'a crowd of three protects against the default predator');
  assert.equal(vulnerable(w, a, 'direct'), true, 'but not against the direct predator');
  ok('a creature in a crowd of three is safe from the default predator and takeable by the direct one');
}

section('Eligibility is logged before the attack, including on the tick a creature dies');
{
  const w = newColony(4, 6, { threat: true, threatMode: 'direct', directChance: 1e9 });   // certain death when eligible
  run(w, 6 * DAY - 7);
  let guard = 0; while (!w.events.some(e => e.cause === 'the beast') && guard++ < 5 * DAY) step(w);
  const e = w.events.find(x => x.cause === 'the beast');
  assert.ok(e, 'someone was taken');
  const victim = w.creatures.find(c => c.id === e.who);
  assert.ok(victim.vuln.ticks >= 1 && victim.vuln.direct >= 1, 'the fatal tick is counted');
  ok('the victim of a fatal attack has its last night tick and its eligibility recorded');
}

section('Striking the predator does not read hidden properties');
{
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../lab/creature.js', import.meta.url), 'utf8');
  const line = src.split('\n').find(l => l.includes("opt.action === 'strike' && opt.target && opt.target.came !== undefined"));
  assert.ok(line, 'found the strike-a-beast score');
  assert.ok(!line.includes('MATERIALS'), 'it reads no material table');
  assert.ok(line.includes('lookAt'), 'it reads what can be seen');
  ok('the strike-a-beast score uses visible size, brawn, caution and experience only');
}

section('Dawn wipe clears fright memory; breeding order is shuffled');
{
  const w = newColony(6, 6, { threat: false, wipeDaily: true });
  run(w, 20);
  w.creatures[0].attackedAt = { x: 0, y: 0, t: w.tick };
  while (w.tick % 24 !== 6) step(w);
  assert.equal(w.creatures[0].attackedAt, null);
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../lab/creature.js', import.meta.url), 'utf8');
  assert.ok(src.includes('[live[i], live[j]] = [live[j], live[i]]'), 'breeding scans in shuffled order');
  ok('the dawn wipe removes the fright location; breeding uses a seeded shuffle');
}

console.log('\ntest-lab-audit: all passed');
