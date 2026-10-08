// test-discovery.js — the invention graph and the discovery engine.
import assert from 'node:assert/strict';
import { createWorld, tick, applyAction } from '../src/sim/index.js';
import { DISCOVERIES, BY_ID, prereqIds, stimulusTokens, PRODUCERS } from '../src/sim/discoveries.js';
import { recordDiscovery } from '../src/sim/experiment.js';
import { keeperRoot } from '../src/sim/causes.js';
import { kill } from '../src/sim/life.js';
import { makeObject, makeWobblin } from '../src/sim/world.js';
import { ALL_SLOTS } from '../src/sim/geometry.js';
import { rngFor, pick } from '../src/sim/rng.js';
import { generousActions, runScript, section, ok } from './lib.js';

const discEvents = w => w.events.filter(e => e.kind === 'discovery' || e.kind === 'rediscovery');

section('Graph integrity');
{
  assert.equal(DISCOVERIES.length, 30);
  assert.equal(new Set(DISCOVERIES.map(d => d.id)).size, 30);
  const tiers = [1, 2, 3, 4].map(t => DISCOVERIES.filter(d => d.tier === t).length);
  assert.deepEqual(tiers, [8, 8, 8, 6]);
  for (const d of DISCOVERIES) {
    for (const p of prereqIds(d)) {
      assert.ok(BY_ID[p], d.id + ' -> unknown ' + p);
      assert.ok(BY_ID[p].tier <= d.tier, d.id + ' prereq ' + p + ' is a higher tier');
    }
    if (d.tier === 1) assert.equal(d.prereqs.length, 0);
    else assert.ok(d.prereqs.length > 0);
  }
  // Acyclic: depth-first search with colors.
  const color = {};
  const visit = id => {
    if (color[id] === 1) assert.fail('cycle through ' + id);
    if (color[id] === 2) return;
    color[id] = 1;
    for (const p of prereqIds(BY_ID[id])) visit(p);
    color[id] = 2;
  };
  for (const d of DISCOVERIES) visit(d.id);
  ok('30 discoveries (8/8/8/6); prereqs never point up a tier and the graph is acyclic');

  // Reachable: fixed point over "all prereqs satisfiable".
  const reach = new Set(DISCOVERIES.filter(d => d.tier === 1).map(d => d.id));
  for (let changed = true; changed;) {
    changed = false;
    for (const d of DISCOVERIES) {
      if (reach.has(d.id)) continue;
      if (d.prereqs.every(p => Array.isArray(p) ? p.some(x => reach.has(x)) : reach.has(p))) { reach.add(d.id); changed = true; }
    }
  }
  assert.equal(reach.size, 30);
  ok('every node is reachable from tier 1');

  // Every stimulus token is producible by a power, gift, nudge or natural event,
  // or by a discovery that is itself reachable.
  const direct = p => /^(power|nudge|natural):|^gift$/.test(p);
  for (const d of DISCOVERIES) {
    for (const tok of stimulusTokens(d)) {
      const prods = PRODUCERS[tok];
      assert.ok(prods && prods.length, d.id + ': no producer for ' + tok);
      assert.ok(prods.some(p => direct(p) || (p.startsWith('discovery:') && reach.has(p.slice(10)))), d.id + ': ' + tok);
    }
  }
  ok('every stimulus kind can be produced by at least one power, gift, nudge or natural event');
}

section('Inventor and source recorded (rule zero, second half)');
{
  let n = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const w = createWorld(seed);
    runScript(w, 1000, generousActions, world => {
      for (const e of world.events.slice(world._seen || 0)) {
        if (e.kind === 'discovery' || e.kind === 'rediscovery') {
          n++;
          const inv = world.wobblins.find(x => x.id === e.actors[0]);
          assert.ok(inv && (inv.alive || inv.deathTick >= e.t) && inv.bornTick <= e.t, 'living inventor at that tick');
          assert.ok(['experiment', 'rediscovery'].includes(e.data.source));
          assert.equal(world.discoveries[e.target].inventor, e.actors[0]);
          if (e.t - inv.bornTick < 12) assert.equal(BY_ID[e.target].tier, 1, 'babies only play at tier 1');
        }
      }
      world._seen = world.events.length;
    });
    delete w._seen;
  }
  ok(n + ' discoveries over 60 seeds x 1,000 ticks: living inventor, matching record, source experiment|rediscovery');
}

section('Causes recorded');
{
  // Scripted: plant two bushes side by side, strike one, let it spread, and
  // check that Fire Warmth is rooted at the lightning action.
  let checked = 0, spread = 0;
  for (let seed = 1; seed <= 300 && spread < 3; seed++) {
    const w = createWorld(seed, { barren: true });
    applyAction(w, { seq: 1, t: 0, type: 'power', power: 'plant', slot: 'meadow.2', variant: 'bush' });
    for (let i = 0; i < 3; i++) tick(w);
    applyAction(w, { seq: 2, t: 3, type: 'power', power: 'plant', slot: 'meadow.3', variant: 'bush' });
    for (let i = 0; i < 6; i++) tick(w);
    if (w.climate.wetUntil >= w.tick) continue;
    applyAction(w, { seq: 3, t: w.tick, type: 'power', power: 'lightning', slot: 'meadow.2' });
    for (let i = 0; i < 20; i++) tick(w);
    const fw = discEvents(w).find(e => e.target === 'fire_warmth');
    if (!fw || w.events.some(e => e.kind === 'lightning' && e.t <= fw.t)) continue;   // skip natural strikes
    const root = keeperRoot(w, fw);
    assert.ok(root, 'fire warmth has a Keeper root');
    assert.equal(root.action, 3, 'rooted at the lightning action');
    checked++;
    const fireObj = w.objects.find(o => o.id === fw.causes.find(c => c.object).object);
    if (fireObj && fireObj.kind === 'fire') {
      const started = w.events.find(e => e.id === fireObj.origin.event);
      if (started && started.kind === 'fire_started') spread++;   // a wildfire, one hop further
    }
  }
  assert.ok(checked >= 5, 'scripted lightning runs with fire warmth: ' + checked);
  assert.ok(spread >= 1, 'saw a wildfire-rooted case');
  ok(checked + ' scripted runs: lightning -> fire (' + spread + ' via wildfire) -> Fire Warmth, keeperRoot = the lightning action');

  // General: a discovery whose stimulus object came from an action is rooted at it.
  let rooted = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const w = createWorld(seed, { barren: true });
    runScript(w, 300, generousActions);
    for (const e of discEvents(w)) {
      const c = e.causes.find(x => x.object);
      if (!c) continue;
      const o = w.objects.find(x => x.id === c.object);
      if (o && o.origin.action !== undefined) {
        const root = keeperRoot(w, e);
        assert.ok(root, e.target);
        assert.equal(root.action, o.origin.action);
        rooted++;
      }
    }
  }
  ok(rooted + ' discoveries with a Keeper-placed stimulus are rooted at that action');
}

section('Each power enables a discovery (barren valley, 100 seeds, 240 ticks)');
{
  const freeSlot = (w, r, zones) => {
    const slots = ALL_SLOTS.filter(s => zones.includes(s.split('.')[0]) && !w.objects.some(o => !o.state.gone && (o.slot === s || (o.slots && o.slots.includes(s)))));
    return slots.length ? pick(r, slots) : null;
  };
  const crowd = w => {
    const z = {};
    for (const x of w.wobblins.filter(x => x.alive)) z[x.zone] = (z[x.zone] || 0) + 1;
    return Object.keys(z).sort().sort((a, b) => z[b] - z[a])[0] || 'meadow';
  };
  const scripts = {
    'Drop Stone -> stone_stacking': { target: 'stone_stacking', run: (w, r) => {
      const s = freeSlot(w, r, [crowd(w), 'meadow', 'hill', 'hollow']);
      return s ? [{ type: 'power', power: 'stone', slot: s, variant: 'stones' }] : [];
    } },
    'Plant -> foraging': { target: 'foraging', run: (w, r) => {
      const s = freeSlot(w, r, [crowd(w), 'meadow', 'grove']);
      return s ? [{ type: 'power', power: 'plant', slot: s, variant: r() < 0.5 ? 'bush' : 'tree' }] : [];
    } },
    'Rain -> digging': { target: 'digging', run: () => [{ type: 'power', power: 'rain' }] },
    'Lightning -> fire_warmth': { target: 'fire_warmth', run: (w, r) => {
      const z = crowd(w);
      const s = freeSlot(w, r, [z === 'riverbank' || z === 'pondsite' ? 'meadow' : z]);
      return [{ type: 'power', power: 'lightning', slot: s || 'meadow.1' }];
    } },
    'Shape Water -> wading': { target: 'wading', run: () => [{ type: 'power', power: 'water', slot: 'riverbank.2' }] },
    'Cold + Plant -> leaf_bed': { target: 'leaf_bed', run: (w, r) => {
      const out = [{ type: 'power', power: 'season', variant: 'cold' }];
      const s = freeSlot(w, r, [crowd(w), 'meadow', 'grove', 'hollow']);
      if (s) out.push({ type: 'power', power: 'plant', slot: s, variant: 'tree' });
      return out;
    } },
    'Cold + Lightning -> fire_warmth': { target: 'fire_warmth', run: (w, r) => {
      const z = crowd(w);
      const s = freeSlot(w, r, [z === 'riverbank' || z === 'pondsite' ? 'meadow' : z]);
      return [{ type: 'power', power: 'season', variant: 'cold' }, { type: 'power', power: 'lightning', slot: s || 'meadow.1' }];
    } }
  };
  for (const [name, sc] of Object.entries(scripts)) {
    let hit = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const w = createWorld(seed, { barren: true });
      w.devotion = 1000;   // Season costs Devotion after its first use
      runScript(w, 240, world => sc.run(world, rngFor(seed, 'power-test', world.tick)));
      if (discEvents(w).some(e => e.target === sc.target)) hit++;
    }
    assert.ok(hit >= 70, name + ': ' + hit + '/100');
    ok(name + ': ' + hit + '/100 seeds');
  }
}

section('Teaching spreads');
{
  let cases = 0, spread = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const w = createWorld(seed);
    runScript(w, 200, generousActions);
    const first = discEvents(w).find(e => e.t < 150);
    if (!first) continue;
    cases++;
    const others = w.events.filter(e => e.kind === 'taught' && e.target === first.target && e.t > first.t && e.t <= first.t + 48);
    if (others.length) spread++;
  }
  assert.ok(spread / cases >= 0.8, spread + '/' + cases);
  ok('first discovery reached another Wobblin within 48 ticks in ' + spread + '/' + cases + ' seeds');
}

section('Forgetting and rediscovery');
{
  const w = createWorld(7, { barren: true });
  const [a, b, c] = w.wobblins;
  recordDiscovery(w, a, 'digging', [], 'experiment');
  recordDiscovery(w, a, 'clay_shaping', [], 'experiment');
  recordDiscovery(w, a, 'paint', [], 'experiment');
  // Paint leaves a mural, which depends on Paint.
  const mural = makeObject(w, { kind: 'mural', slot: 'hollow.1', origin: { natural: true } });
  kill(w, a, 'test');
  // No one is in the hollow, so nobody learns from the mural before the grace ends.
  for (const x of [b, c]) x.zone = 'riverbank';
  for (let i = 0; i < 60; i++) { for (const x of [b, c]) x.zone = 'riverbank'; tick(w); }
  for (const d of ['digging', 'clay_shaping', 'paint']) {
    const f = w.events.find(e => e.kind === 'forgotten' && e.target === d);
    assert.ok(f, d + ' forgotten');
    // Either still forgotten (nobody knows it), or someone has since worked it out anew.
    const again = w.events.find(e => e.kind === 'rediscovery' && e.target === d && e.t >= f.t);
    if (!again) { assert.equal(w.discoveries[d].forgotten, true); assert.ok(!w.wobblins.some(x => x.alive && x.knows[d])); }
  }
  assert.equal(mural.kind, 'ruin');
  assert.equal(mural.state.ruinOf, 'mural');
  ok('a sole knower died untaught: digging, clay shaping and paint are forgotten; the mural became a ruin');

  // Rediscovery: rain makes mud again, so someone works out Digging anew.
  let seq = 10;
  for (let i = 0; i < 300 && w.discoveries.digging.forgotten; i++) {
    if (w.cooldowns.rain <= w.tick) applyAction(w, { seq: ++seq, t: w.tick, type: 'power', power: 'rain' });
    tick(w);
  }
  const re = w.events.find(e => e.kind === 'rediscovery' && e.target === 'digging');
  assert.ok(re, 'digging rediscovered');
  assert.notEqual(re.actors[0], a.id);
  assert.equal(re.data.source, 'rediscovery');
  assert.equal(re.data.previousInventor, a.id);
  ok('Digging was rediscovered by ' + re.actors[0] + ' (a new inventor) as a rediscovery event');
}

section('Lore protects knowledge');
{
  const rate = withLore => {
    let forgotten = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const w = createWorld(seed);
      const ws = w.wobblins;
      // Each founder alone knows two things; with Lore, everyone also knows Lore.
      const solo = [['digging', 'wading'], ['foraging', 'leaf_bed'], ['stone_stacking', 'rhythm']];
      ws.forEach((x, i) => solo[i].forEach(d => recordDiscovery(w, x, d, [], 'experiment')));
      if (withLore) for (const x of ws) { recordDiscovery(w, x, 'lore', [], 'experiment'); }
      // Founders are old: push them close to the end of their lives.
      for (const x of ws) x.bornTick = -Math.floor(x.lifespan * 0.9);
      // Two youngsters who could carry it on.
      makeWobblin(w, { bornTick: -14, zone: 'meadow' }); makeWobblin(w, { bornTick: -16, zone: 'meadow' });
      for (let i = 0; i < 40; i++) tick(w);
      forgotten += w.events.filter(e => e.kind === 'forgotten' && e.target !== 'lore').length;
    }
    return forgotten;
  };
  const without = rate(false), withL = rate(true);
  assert.ok(withL <= without * 0.5, 'with ' + withL + ' vs without ' + without);
  ok('forgotten events: ' + without + ' without Lore, ' + withL + ' with Lore (' + Math.round(100 - 100 * withL / without) + '% fewer)');
}

section('Diversity of discovery order');
{
  const orders = {};
  let counted = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const w = createWorld(seed);
    runScript(w, 400, generousActions);
    const seq = [];
    for (const e of discEvents(w)) if (!seq.includes(e.target)) seq.push(e.target);
    if (seq.length < 8) continue;
    counted++;
    const key = seq.slice(0, 8).join('>');
    orders[key] = (orders[key] || 0) + 1;
  }
  const distinct = Object.keys(orders).length, top = Math.max(...Object.values(orders));
  assert.ok(counted >= 90, 'seeds with 8+ discoveries: ' + counted);
  assert.ok(distinct >= 30, distinct + ' distinct');
  assert.ok(top <= 0.2 * counted, 'most common ordering ' + top);
  ok(distinct + ' distinct first-8 orderings over ' + counted + ' seeds; the most common appears ' + top + ' times');

  // Two different scripts on the same seed should change what comes first.
  const stonesFirst = w => {
    const out = generousActions(w, 1).filter(a => a.power !== 'plant' && a.power !== 'water');
    return out;
  };
  const plantsFirst = w => generousActions(w, 2).filter(a => a.power !== 'stone' && a.power !== 'lightning');
  let differ = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const first5 = script => {
      const w = createWorld(seed);
      runScript(w, 300, script);
      const s = [];
      for (const e of discEvents(w)) if (!s.includes(e.target)) s.push(e.target);
      return s.slice(0, 5).join('>');
    };
    if (first5(stonesFirst) !== first5(plantsFirst)) differ++;
  }
  assert.ok(differ >= 60, differ + '/100');
  ok('different action scripts on the same seed gave different first-5 orders in ' + differ + '/100 seeds');
}

console.log('\ntest-discovery: all passed');
