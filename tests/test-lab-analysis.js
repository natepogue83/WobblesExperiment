// test-lab-analysis.js — known-answer tests for the v3 analysis (after the second review).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { selectionDifferential, pairedDiffCI, clusterSpearman, bootstrapMeanCI } from '../lab/research/stats.js';
import { interaction, commonSeedEffects, decide, seedsFor, observedFeedFirst, bySeed } from '../lab/research/analyze.js';
import { section, ok } from './lib.js';

section('S: Robertson-Price selection differential, known answers');
{
  assert.equal(+selectionDifferential([{ caution: 0.2, offspring: 0 }, { caution: 0.8, offspring: 2 }], 'caution').toFixed(6), 0.3);
  assert.equal(selectionDifferential([{ caution: 0.5, offspring: 1 }, { caution: 0.5, offspring: 3 }], 'caution'), 0);
  assert.ok(Number.isNaN(selectionDifferential([{ caution: 0.2, offspring: 0 }, { caution: 0.8, offspring: 0 }], 'caution')), 'no reproduction gives undefined S, not zero');
  assert.ok(Number.isNaN(selectionDifferential([{ caution: 0.2, offspring: 4 }], 'caution')));
  ok('0.3 for the two-creature case; 0 when the trait does not vary; undefined with no births or a cohort of one');
}

section('Paired contrasts and the four-arm interaction');
{
  const a = [1, 2, 3, 4, NaN], b = [0, 1, 2, 3, 1];
  const d = pairedDiffCI(a, b, 2000);
  assert.equal(d.mean, 1); assert.equal(d.n, 4); assert.equal(d.dropped, 1); assert.equal(d.lo, 1); assert.equal(d.hi, 1);
  // I = (pOff - nOff) - (pOn - nOn) = (0.05 - 0) - (0.01 - 0) = 0.04 on every complete seed
  const pOff = [0.05, 0.05, 0.05, NaN], nOff = [0, 0, 0, 0], pOn = [0.01, 0.01, 0.01, 0.01], nOn = [0, 0, 0, 0];
  const I = interaction(pOff, nOff, pOn, nOn, 2000);
  assert.equal(+I.mean.toFixed(6), 0.04); assert.equal(I.n, 3); assert.equal(I.dropped, 1);
  // after a JSON round trip NaN becomes null; it must still be dropped, not read as zero
  const back = JSON.parse(JSON.stringify({ pOff, nOff, pOn, nOn }));
  const J = interaction(back.pOff, back.nOff, back.pOn, back.nOn, 2000);
  assert.equal(J.n, 3); assert.equal(+J.mean.toFixed(6), 0.04);
  // missing in each arm in turn
  for (const k of ['pOff', 'nOff', 'pOn', 'nOn']) { const arms = { pOff: [...pOff], nOff: [...nOff], pOn: [...pOn], nOn: [...nOn] }; arms[k][0] = null; assert.equal(interaction(arms.pOff, arms.nOff, arms.pOn, arms.nOn, 500).n, 2, 'missing in ' + k); }
  const e = commonSeedEffects(pOff, nOff, pOn, nOn, 500);
  assert.equal(e.commonSeeds, 3); assert.equal(e.Eon.n, 3); assert.equal(e.Eoff.n, 3);
  // bySeed tolerates nulls from JSON and unequal seed sets
  const rows = [{ exp: 'h3', cond: 'x', seed: 2, S: null }, { exp: 'h3', cond: 'x', seed: 3, S: 0.1 }];
  assert.deepEqual(bySeed(rows, 'h3', 'x', 'S', [1, 2, 3]).map(v => Number.isNaN(v) ? 'NaN' : v), ['NaN', 'NaN', 0.1]);
  ok('pairing drops incomplete seeds; I = 0.04 survives a JSON round trip and missingness in any arm; E_on, E_off and I share one seed set');
}

section('The pre-registered decision rules, on invented examples');
{
  const ci = (lo, hi) => ({ lo, hi, mean: (lo + hi) / 2 });
  // Astra's first example: both arms favour caution equally; I = 0 tightly. Not "no selection".
  assert.match(decide({ Eoff: ci(0.03, 0.05), I: ci(-0.005, 0.005) }, 0.02, true), /^equivalence/);
  // Astra's second example: I positive only because E_on is negative; not shielding.
  assert.match(decide({ Eoff: ci(-0.01, 0.01), I: ci(0.02, 0.06) }, 0.02, true), /^effect modification/);
  assert.match(decide({ Eoff: ci(0.01, 0.05), I: ci(0.01, 0.05) }, 0.02, true), /^attenuation/);
  assert.match(decide({ Eoff: ci(0, 0.02), I: ci(-0.03, 0.04) }, 0.02, true), /^inconclusive/);
  assert.match(decide({ Eoff: ci(0, 0.02), I: ci(-0.05, -0.01) }, 0.02, true), /^opposite/);
  assert.match(decide({ Eoff: ci(0.01, 0.05), I: ci(0.01, 0.05) }, 0.02, false), /^unvalidated/);
  ok('attenuation needs both I and E_off clearly positive; a wide null is inconclusive; failed checks override everything');
}

section('Sample size from per-seed variability');
{
  assert.equal(seedsFor(0.057, 0.02), 64);   // matches the review's illustration: SD 0.057 at delta 0.02
  assert.equal(seedsFor(0.1, 0.02), 196);
  ok('N = ((1.96 + 0.84) x SD / delta)^2');
}

section('Cluster correlation: constant inputs are undefined, not zero');
{
  const groups = [[{ x: 1, y: 2 }, { x: 1, y: 3 }], [{ x: 1, y: 1 }, { x: 1, y: 5 }]];
  const c = clusterSpearman(groups, 'x', 'y', { within: true, B: 200 });
  assert.ok(Number.isNaN(c.mean));
  const perfect = [[{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }], [{ x: 5, y: 9 }, { x: 6, y: 10 }]];
  assert.ok(clusterSpearman(perfect, 'x', 'y', { within: true, B: 200 }).mean > 0.9);
  ok('constant traits give NaN; a perfect within-colony order gives close to 1');
}

section('H2 provenance: an actual observed feed, before the first feed, in event order');
{
  const F = new Set(['c1']);
  const feedKey = 'glowing lump|mid|dry|glow>place+pale tuft|small|dry|';
  const ignite = 'pale tuft|small|dry|>strike+grey lump|big|dry|';
  // c7 saw an ignition (fire_grew via strike), never a feed: must not count
  assert.equal(observedFeedFirst([{ t: 1, kind: 'saw', who: 'c7', outcome: 'fire_grew', key: ignite }, { t: 2, kind: 'fed_fire', who: 'c7' }], F).observedFirst, 0);
  // same tick, saw then fed: counts (event order, not tick)
  assert.equal(observedFeedFirst([{ t: 5, kind: 'saw', who: 'c7', outcome: 'fire_grew', key: feedKey }, { t: 5, kind: 'fed_fire', who: 'c7' }], F).observedFirst, 1);
  // saw after its own first feed: does not count
  assert.equal(observedFeedFirst([{ t: 5, kind: 'fed_fire', who: 'c7' }, { t: 6, kind: 'saw', who: 'c7', outcome: 'fire_grew', key: feedKey }], F).observedFirst, 0);
  // founders are not descendants
  assert.equal(observedFeedFirst([{ t: 5, kind: 'fed_fire', who: 'c1' }], F).practitioners, 0);
  ok('ignitions do not count; same-tick order is kept; founders are excluded');
}

section('The harness exits cleanly');
{
  const r = spawnSync(process.execPath, ['lab/research/run.mjs'], { env: { ...process.env, SMOKE: '1' }, timeout: 60000, encoding: 'utf8' });
  assert.equal(r.status, 0, 'exit ' + r.status + ' ' + r.stderr);
  assert.match(r.stdout, /smoke ok 2/);
  const bad = spawnSync(process.execPath, ['lab/research/run.mjs'], { env: { ...process.env, N: '8' }, timeout: 60000, encoding: 'utf8' });
  assert.notEqual(bad.status, 0, 'a confirmatory run with an override must refuse');
  assert.match(bad.stderr, /takes no overrides/);
  ok('the worker pool terminates every worker; a confirmatory run refuses overrides');
}

console.log('\ntest-lab-analysis: all passed');
