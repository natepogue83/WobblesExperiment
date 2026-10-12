// lab/research/analyze.js — pure analysis functions for the v3 study. No simulation here, so
// every function can be tested on synthetic data with a known answer (tests/test-lab-analysis.js).
import { bootstrapMeanCI, pairedDiffCI } from './stats.js';

export const finite = v => typeof v === 'number' && Number.isFinite(v);

// Values of one key for one experiment/condition, in the order of a fixed seed list; missing -> NaN.
export function bySeed(rows, exp, cond, key, seeds) {
  const m = new Map(rows.filter(r => r.exp === exp && r.cond === cond).map(r => [r.seed, r[key]]));
  return seeds.map(s => (m.has(s) && finite(m.get(s)) ? m.get(s) : NaN));
}

// The four-arm interaction I = (P_off - N_off) - (P_on - N_on), per seed, using only seeds where all
// four operands are finite. null (what JSON makes of NaN) never becomes zero here.
export function interaction(pOff, nOff, pOn, nOn, B = 10000) {
  const per = [];
  for (let i = 0; i < pOff.length; i++) {
    const a = pOff[i], b = nOff[i], c = pOn[i], d = nOn[i];
    if (finite(a) && finite(b) && finite(c) && finite(d)) per.push((a - b) - (c - d));
  }
  const ci = per.length ? bootstrapMeanCI(per, B) : { mean: NaN, lo: NaN, hi: NaN, n: 0 };
  return { ...ci, n: per.length, dropped: pOff.length - per.length };
}

// The same seeds for E_on and E_off as for I, so the three numbers describe one common set.
export function commonSeedEffects(pOff, nOff, pOn, nOn, B = 10000) {
  const keep = pOff.map((_, i) => [pOff[i], nOff[i], pOn[i], nOn[i]].every(finite));
  const sel = arr => arr.filter((_, i) => keep[i]);
  return { Eon: pairedDiffCI(sel(pOn), sel(nOn), B), Eoff: pairedDiffCI(sel(pOff), sel(nOff), B), I: interaction(pOff, nOff, pOn, nOn, B), commonSeeds: keep.filter(Boolean).length };
}

// The pre-registered decision rules (PREREGISTRATION-v3.md), applied mechanically.
// delta: the smallest effect on S worth resolving; validated: did the method checks pass?
export function decide({ Eoff, I }, delta, validated) {
  if (!validated) return 'unvalidated: report estimates and limitations only';
  const pos = ci => ci.lo > 0, neg = ci => ci.hi < 0, inside = ci => ci.lo > -delta && ci.hi < delta;
  if (pos(I) && pos(Eoff)) return 'attenuation: the specified risk learning attenuates a positive predator-related advantage of caution';
  if (pos(I)) return 'effect modification: I is positive but a positive advantage of caution without risk learning is not shown';
  if (neg(I)) return 'opposite direction: risk learning strengthens the predator effect on caution';
  if (inside(I)) return `equivalence: any attenuation is smaller than ${delta} in this setting`;
  return 'inconclusive: the interval includes zero and effects of meaningful size';
}

// Sample size for a two-sided 5% test with 80% power, from the per-seed SD of a contrast.
export function seedsFor(sd, delta) { return Math.ceil(((1.96 + 0.84) * sd / delta) ** 2); }

// H2 provenance: did each descendant practitioner observe an actual feed before its own first feed,
// in event order (index), not just by tick?
export function observedFeedFirst(events, founderIds) {
  const firstFeed = {};
  events.forEach((e, i) => { if (e.kind === 'fed_fire' && e.who && !(e.who in firstFeed)) firstFeed[e.who] = i; });
  const desc = Object.keys(firstFeed).filter(id => !founderIds.has(id));
  const saw = desc.filter(id => events.some((e, i) => i < firstFeed[id] && e.kind === 'saw' && e.who === id && e.outcome === 'fire_grew' && typeof e.key === 'string' && e.key.includes('>place')));
  return { practitioners: desc.length, observedFirst: saw.length };
}
