// lab/research/stats.js — the little statistics the report needs, with no dependencies.
// Bootstrap intervals use their own seeded generator so the numbers are reproducible.
import { rngFor } from '../../src/sim/rng.js';

const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
function quantile(sorted, q) { const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo); }

// 95% percentile bootstrap CI of a mean, 10,000 resamples.
export function bootstrapMeanCI(values, B = 10000) {
  const v = values.filter(Number.isFinite);
  if (!v.length) return { mean: NaN, lo: NaN, hi: NaN, n: 0 };
  const r = rngFor(7, 'boot', v.length, Math.round(mean(v) * 1e6));
  const ms = new Array(B);
  for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < v.length; i++) s += v[Math.floor(r() * v.length)]; ms[b] = s / v.length; }
  ms.sort((a, b) => a - b);
  return { mean: mean(v), lo: quantile(ms, 0.025), hi: quantile(ms, 0.975), n: v.length };
}
// 95% bootstrap CI of a difference of means between two independent samples.
export function bootstrapDiffCI(a, b, B = 10000) {
  const A = a.filter(Number.isFinite), Bv = b.filter(Number.isFinite);
  if (!A.length || !Bv.length) return { mean: NaN, lo: NaN, hi: NaN, n: 0 };
  const r = rngFor(7, 'bootdiff', A.length, Bv.length);
  const ds = new Array(B);
  for (let k = 0; k < B; k++) { let sa = 0, sb = 0; for (let i = 0; i < A.length; i++) sa += A[Math.floor(r() * A.length)]; for (let i = 0; i < Bv.length; i++) sb += Bv[Math.floor(r() * Bv.length)]; ds[k] = sa / A.length - sb / Bv.length; }
  ds.sort((x, y) => x - y);
  return { mean: mean(A) - mean(Bv), lo: quantile(ds, 0.025), hi: quantile(ds, 0.975), n: A.length + Bv.length };
}
function ranks(a) { const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = new Array(a.length); for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; const rank = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k][1]] = rank; i = j + 1; } return r; }
// Spearman rank correlation with a bootstrap CI.
export function spearman(x, y, B = 2000) {
  const n = Math.min(x.length, y.length);
  if (n < 4) return { mean: NaN, lo: NaN, hi: NaN, n };
  const rho = (xs, ys) => { const rx = ranks(xs), ry = ranks(ys), mx = mean(rx), my = mean(ry); let num = 0, dx = 0, dy = 0; for (let i = 0; i < rx.length; i++) { num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2; } return dx && dy ? num / Math.sqrt(dx * dy) : 0; };
  const r = rngFor(7, 'spear', n);
  const bs = new Array(B);
  for (let b = 0; b < B; b++) { const xs = [], ys = []; for (let i = 0; i < n; i++) { const k = Math.floor(r() * n); xs.push(x[k]); ys.push(y[k]); } bs[b] = rho(xs, ys); }
  bs.sort((a, b) => a - b);
  return { mean: rho(x.slice(0, n), y.slice(0, n)), lo: quantile(bs, 0.025), hi: quantile(bs, 0.975), n };
}
export function fmt(ci, d = 2) { return Number.isFinite(ci.mean) ? `${ci.mean.toFixed(d)} [${ci.lo.toFixed(d)}, ${ci.hi.toFixed(d)}]` : 'n/a'; }

// ---- added for v2 (after the 2026-10-11 review) -------------------------------------------------
// Paired bootstrap over seeds: a[i] and b[i] come from the same seed. Pairs with a missing value on
// either side are dropped (and the count of dropped pairs is returned, so it can be reported).
export function pairedDiffCI(a, b, B = 10000) {
  const pairs = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (Number.isFinite(a[i]) && Number.isFinite(b[i])) pairs.push(a[i] - b[i]);
  if (!pairs.length) return { mean: NaN, lo: NaN, hi: NaN, n: 0, dropped: a.length };
  const r = rngFor(7, 'paired', pairs.length);
  const ms = new Array(B);
  for (let k = 0; k < B; k++) { let s = 0; for (let i = 0; i < pairs.length; i++) s += pairs[Math.floor(r() * pairs.length)]; ms[k] = s / pairs.length; }
  ms.sort((x, y) => x - y);
  return { mean: mean(pairs), lo: quantile(ms, 0.025), hi: quantile(ms, 0.975), n: pairs.length, dropped: Math.min(a.length, b.length) - pairs.length };
}
// Spearman correlation with a cluster bootstrap: whole colonies are resampled, keeping each
// colony's individuals together. `within` ranks inside each colony first, so colony-level
// differences cannot create the association.
export function clusterSpearman(groups, xKey, yKey, { B = 10000, within = false } = {}) {
  const prep = groups.filter(g => g.length >= 2).map(g => {
    let xs = g.map(r => r[xKey]), ys = g.map(r => r[yKey]);
    if (within) { const rx = ranks(xs), ry = ranks(ys), n = g.length; xs = rx.map(v => (v - (n + 1) / 2) / n); ys = ry.map(v => (v - (n + 1) / 2) / n); }
    return { xs, ys };
  });
  const rho = gs => { const xs = gs.flatMap(g => g.xs), ys = gs.flatMap(g => g.ys); const rx = ranks(xs), ry = ranks(ys), mx = mean(rx), my = mean(ry); let num = 0, dx = 0, dy = 0; for (let i = 0; i < rx.length; i++) { num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) ** 2; dy += (ry[i] - my) ** 2; } return dx && dy ? num / Math.sqrt(dx * dy) : 0; };
  if (!prep.length) return { mean: NaN, lo: NaN, hi: NaN, n: 0 };
  const r = rngFor(7, 'cluster', prep.length, within ? 1 : 0);
  const bs = new Array(B);
  for (let b = 0; b < B; b++) { const s = []; for (let i = 0; i < prep.length; i++) s.push(prep[Math.floor(r() * prep.length)]); bs[b] = rho(s); }
  bs.sort((x, y) => x - y);
  return { mean: rho(prep), lo: quantile(bs, 0.025), hi: quantile(bs, 0.975), n: prep.reduce((a, g) => a + g.xs.length, 0), clusters: prep.length };
}
// Robertson–Price selection differential for one colony: the offspring-weighted mean of a trait
// minus its plain mean, over a cohort. Positive means parents of more children had more of it.
export function selectionDifferential(cohort, trait) {
  if (cohort.length < 2) return NaN;
  const w = cohort.map(c => c.offspring), z = cohort.map(c => c[trait]), W = w.reduce((a, b) => a + b, 0);
  if (!W) return NaN;
  return z.reduce((a, v, i) => a + v * w[i], 0) / W - mean(z);
}
