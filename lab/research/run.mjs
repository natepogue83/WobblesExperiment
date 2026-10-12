// lab/research/run.mjs — v3 of the experiment harness (see PREREGISTRATION-v3.md).
//
//   node lab/research/run.mjs                  the v3 confirmatory run, on the confirmation seed bank
//   PRECISION=1 node lab/research/run.mjs      development: variability of the real contrasts, and N
//   SMOKE=1 node lab/research/run.mjs          two tiny jobs on test seeds; checks the harness exits cleanly
//   ANALYZE=1 node lab/research/run.mjs        re-analyse results/raw.json without simulating anything
//
// Seed banks never overlap: regression tests use 1-7, v1 and the stopped v2 used 1-64, the v2
// calibration used 101-116, v3 development uses 1001-1064, v3 confirmation uses 2001 onward.
// v1 is reproducible from git tag confirmatory-v1; its outputs are in results-v1/.
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import { cpus } from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { newColony, run, step, keeperPlace, fireReport } from '../sim.js';
import { bootstrapMeanCI, pairedDiffCI, clusterSpearman, selectionDifferential, fmt } from './stats.js';
import { bySeed, interaction, commonSeedEffects, decide, seedsFor, observedFeedFirst, finite } from './analyze.js';
import { dotCI } from './figures.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = 24, END = 120 * DAY, COHORT_BORN_BY = 60 * DAY;
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// ---- frozen settings (PREREGISTRATION-v3.md). A confirmatory run refuses any override. -----------
export const FROZEN = {
  N: 256,                       // chosen from the precision run on the development bank (results-dev/PRECISION.md)
  delta: 0.01,                  // smallest effect on S worth resolving (PREREGISTRATION-v3.md)
  directChance: 0.002,
  geneChance: 0.02,
  confirmSeeds: null            // filled below from N
};
FROZEN.confirmSeeds = range(2001, 2000 + FROZEN.N);
const DEV_SEEDS = range(1001, 1064), TEST_SEEDS = [1, 2];

const PRED = {
  none: { threat: false },
  default: { threat: true },
  direct: { threat: true, threatMode: 'direct', directChance: FROZEN.directChance },
  gene: { threat: true, threatMode: 'gene', geneChance: FROZEN.geneChance }
};
const h3cond = (p, l) => `${p}|${l}`;

// ---- one colony, one condition: plain numbers only -------------------------------------------------
function job({ exp, seed, cond, opts, days }) {
  if (exp === 'h1') {
    const w = newColony(seed, 6, { threat: false });
    if (cond === 'blocked') w.creatures.find(c => c.id === 'c2').noObserve = true;
    run(w, 48); keeperPlace(w, 'ember', 9, 5, { fuel: 120 }); run(w, 17 * DAY - 48);
    const feeders = new Set(w.events.filter(e => e.kind === 'fed_fire' && e.who).map(e => e.who));
    return { c2Fed: feeders.has('c2') ? 1 : 0, c2Feeds: w.events.filter(e => e.kind === 'fed_fire' && e.who === 'c2').length, practitioners: feeders.size, twoPlus: [...feeders].filter(id => id !== 'c2').length >= 2 ? 1 : 0 };
  }
  if (exp === 'h2') {
    const w = newColony(seed, 6, { threat: false });
    run(w, 48); keeperPlace(w, 'ember', 9, 5, { fuel: 120 });
    let gap = 0, longest = 0, cur = 0;
    for (let t = 48; t < 70 * DAY; t++) { step(w); if (!w.objects.some(o => !o.gone && o.burning > 0 && o.fuel > 0)) { gap++; cur++; longest = Math.max(longest, cur); } else cur = 0; }
    const founders = new Set(w.creatures.slice(0, 6).map(c => c.id));
    const late = w.events.filter(e => e.kind === 'fed_fire' && e.who && e.t > 66 * DAY && !founders.has(e.who)).length;
    const foundersGone = w.creatures.slice(0, 6).every(c => !c.alive), alive = fireReport(w).alive;
    const prov = observedFeedFirst(w.events, founders);
    return { foundersGone: foundersGone ? 1 : 0, fireAlive: alive ? 1 : 0, latePractice: foundersGone && alive && late > 0 ? 1 : 0, unbroken: gap === 0 ? 1 : 0, longestGapDays: +(longest / DAY).toFixed(2), descPractitioners: prov.practitioners, observedFirst: prov.observedFirst, lit: w.events.filter(e => e.kind === 'made_fire').length };
  }
  if (exp === 'h3' || exp === 'ablation') {
    const until = (days || (exp === 'ablation' ? 50 : 120)) * DAY;
    const w = newColony(seed, 6, opts);
    run(w, 48); keeperPlace(w, 'ember', 9, 5, { fuel: 120 }); run(w, until - 48);
    const deaths = w.events.filter(e => e.kind === 'died'), diedAt = {}, cause = {}; for (const d of deaths) { diedAt[d.who] = d.t; cause[d.who] = d.cause; }
    const live = w.creatures.filter(c => c.alive);
    const ind = w.creatures.map((c, i) => {
      const end = c.alive ? w.tick : diedAt[c.id];
      return { id: c.id, founder: i < 6 ? 1 : 0, born: c.born, ageTicks: end - c.born, cause: c.alive ? null : cause[c.id] || null, caution: +c.genome.caution.toFixed(4), brawn: +c.genome.brawn.toFixed(4), offspring: c.offspring,
        vuln: { ...c.vuln }, night: { ...c.night }, riskTotal: +Object.values(c.risk).reduce((a, b) => a + b, 0).toFixed(3), riskKeys: [...c.exp.keys()].filter(k => k.startsWith('dark beast')).length, restKeys: [...c.exp.keys()].filter(k => />rest/.test(k)).length };
    });
    // Cohort: born at or before day 60, so each member had a full 60-day lifespan before the end.
    const cohort = ind.filter(i => i.born <= COHORT_BORN_BY);
    const viab = cohort.map(i => ({ ...i, offspring: i.ageTicks >= 8 * DAY ? 1 : 0 }));   // survival to breeding age (8 days)
    return { tick: w.tick, extinct: live.length ? 0 : 1, alive: live.length, cohortN: cohort.length, cohortOffspring: cohort.reduce((a, i) => a + i.offspring, 0),
      S_caution: selectionDifferential(cohort, 'caution'), S_viability: selectionDifferential(viab, 'caution'), S_brawn: selectionDifferential(cohort, 'brawn'),
      cautionEnd: live.length ? live.reduce((a, c) => a + c.genome.caution, 0) / live.length : NaN,
      born: w.events.filter(e => e.kind === 'born').length, byBeast: deaths.filter(d => d.cause === 'the beast').length, hunger: deaths.filter(d => /hunger/.test(d.cause)).length,
      livingTicks: ind.reduce((a, i) => a + Math.max(0, Math.min(w.tick, i.born + i.ageTicks) - Math.max(0, i.born)), 0), fireAlive: fireReport(w).alive ? 1 : 0, ind };
  }
  if (exp === 'smoke') { const w = newColony(seed, 2, { threat: false }); run(w, 10); return { tick: w.tick }; }
  throw new Error('unknown experiment ' + exp);
}

// ---- worker pool: every worker is terminated on success and on failure ---------------------------------
async function runAll(jobs) {
  const n = Math.max(1, Math.min(cpus().length - 1, jobs.length));
  const workers = Array.from({ length: n }, () => new Worker(fileURLToPath(import.meta.url)));
  const results = [], failed = []; let next = 0, done = 0; const t0 = Date.now();
  try {
    await new Promise((resolve, reject) => {
      for (const wk of workers) {
        const feed = () => { if (next < jobs.length) wk.postMessage(jobs[next++]); };
        wk.on('message', m => {
          if (!m.ok) { failed.push({ job: m.j, err: m.err }); return reject(new Error(m.err)); }
          results.push({ ...m.j, opts: undefined, ...m.r }); done++;
          if (done % 32 === 0 || done === jobs.length) process.stdout.write(`\r  ${done}/${jobs.length} runs, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
          if (done === jobs.length) resolve(); else feed();
        });
        wk.on('error', reject); feed();
      }
    });
  } finally { await Promise.all(workers.map(w => w.terminate())); }
  process.stdout.write('\n');
  return results.sort((a, b) => a.exp.localeCompare(b.exp) || a.cond.localeCompare(b.cond) || a.seed - b.seed);
}

function provenance(extra) {
  let commit = 'unknown', dirty = null;
  try { commit = execSync('git rev-parse HEAD', { cwd: HERE }).toString().trim(); dirty = execSync('git status --porcelain -- ../', { cwd: HERE }).toString().trim().length > 0; } catch {}
  const hash = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, f))).digest('hex').slice(0, 16);
  const files = ['../world.js', '../creature.js', '../sim.js', 'run.mjs', 'analyze.js', 'stats.js'];
  return { harness: 'v3', commit, dirty, node: process.version, generated: new Date().toISOString(), env: Object.fromEntries(Object.entries(process.env).filter(([k]) => ['N', 'ONLY', 'PRECISION', 'ANALYZE', 'SMOKE'].includes(k))), sourceHashes: Object.fromEntries(files.map(f => [f, hash(f)])), ...extra };
}

function h3jobs(seeds, preds, arms = { none: ['on', 'off'], default: ['on', 'off'], direct: ['on', 'off'], gene: ['on', 'off'] }) { const out = []; for (const p of preds) for (const l of arms[p]) for (const s of seeds) out.push({ exp: 'h3', seed: s, cond: h3cond(p, l), opts: { ...PRED[p], noRiskLearn: l === 'off' } }); return out; }
// Confirmatory arms. The direct and gene regimes have no prowler, so risk learning never occurs and
// their on and off arms are identical (verified on all 64 development seeds); only 'on' is run.
const CONFIRM_ARMS = { none: ['on', 'off'], default: ['on', 'off'], direct: ['on'], gene: ['on'] };
const S = (rs, p, l, seeds, k = 'S_caution') => bySeed(rs, 'h3', h3cond(p, l), k, seeds);

// ---- development: how variable are the real contrasts, and what N does that imply? -------------------------
async function precision() {
  const OUT = path.join(HERE, 'results-dev'); fs.mkdirSync(OUT, { recursive: true });
  const jobs = h3jobs(DEV_SEEDS, ['none', 'default', 'direct', 'gene']);
  console.log(`Precision run: ${jobs.length} runs on development seeds ${DEV_SEEDS[0]}-${DEV_SEEDS.at(-1)}`);
  const rs = await runAll(jobs);
  fs.writeFileSync(path.join(OUT, 'raw-precision.json'), JSON.stringify(rs));
  const sd = a => { const v = a.filter(finite), m = v.reduce((x, y) => x + y, 0) / v.length; return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); };
  const lines = [`# Precision on the development bank (seeds ${DEV_SEEDS[0]}-${DEV_SEEDS.at(-1)}; never used for confirmation)\n`, `delta = ${FROZEN.delta} (smallest effect on S worth resolving). N for 80% power at two-sided 5% = ((1.96 + 0.84) x SD / delta)^2.\n`, '| contrast | estimate [95% CI] | seeds used | per-seed SD | N for 80% power |', '|---|---|---|---|---|'];
  const rec = {};
  for (const p of ['default', 'direct', 'gene']) {
    const e = commonSeedEffects(S(rs, p, 'off', DEV_SEEDS), S(rs, 'none', 'off', DEV_SEEDS), S(rs, p, 'on', DEV_SEEDS), S(rs, 'none', 'on', DEV_SEEDS), 2000);
    const per = DEV_SEEDS.map((_, i) => { const a = S(rs, p, 'off', DEV_SEEDS)[i], b = S(rs, 'none', 'off', DEV_SEEDS)[i], c = S(rs, p, 'on', DEV_SEEDS)[i], d = S(rs, 'none', 'on', DEV_SEEDS)[i]; return [a, b, c, d].every(finite) ? (a - b) - (c - d) : NaN; });
    const eon = DEV_SEEDS.map((_, i) => { const c = S(rs, p, 'on', DEV_SEEDS)[i], d = S(rs, 'none', 'on', DEV_SEEDS)[i]; return finite(c) && finite(d) ? c - d : NaN; });
    rec[p] = { I: e.I, Eon: e.Eon, Eoff: e.Eoff, sdI: sd(per), sdEon: sd(eon), nI: seedsFor(sd(per), FROZEN.delta), nEon: seedsFor(sd(eon), FROZEN.delta) };
    lines.push(`| ${p}: E_on (predator minus none, risk learning on) | ${fmt(e.Eon, 3)} | ${e.Eon.n} | ${rec[p].sdEon.toFixed(3)} | ${rec[p].nEon} |`);
    lines.push(`| ${p}: interaction I | ${fmt(e.I, 3)} | ${e.I.n} | ${rec[p].sdI.toFixed(3)} | ${rec[p].nI} |`);
  }
  const ext = c => rs.filter(r => r.cond === c && r.extinct).length;
  lines.push('', '| condition | extinct | undefined S |', '|---|---|---|');
  for (const p of Object.keys(PRED)) for (const l of ['on', 'off']) lines.push(`| ${h3cond(p, l)} | ${ext(h3cond(p, l))}/${DEV_SEEDS.length} | ${S(rs, p, l, DEV_SEEDS).filter(v => !finite(v)).length} |`);
  fs.writeFileSync(path.join(OUT, 'PRECISION.md'), lines.join('\n') + '\n');
  fs.writeFileSync(path.join(OUT, 'precision.json'), JSON.stringify({ provenance: provenance({ seeds: DEV_SEEDS }), rec }, null, 2));
  console.log(lines.join('\n'));
}

// ---- the confirmatory analysis (also used by ANALYZE=1) -----------------------------------------------------
function analyze(rs, seeds, OUT) {
  const md = [`# Results v3 (${seeds.length} seeds per condition, seeds ${seeds[0]}-${seeds.at(-1)})\n`, `Pre-registration: PREREGISTRATION-v3.md. Contrasts are paired by seed (bootstrap over seeds, 10,000 resamples); the interaction uses only seeds where all four arms have a defined S. Correlations resample whole colonies.\n`];
  const summary = {};
  // Manipulation checks (pre-registered pass rules)
  const colonies = (p, l) => rs.filter(r => r.exp === 'h3' && r.cond === h3cond(p, l));
  const offRisk = ['default', 'none'].every(p => colonies(p, 'off').every(r => r.ind.every(i => i.riskTotal === 0 && i.riskKeys === 0)));
  const onRiskShare = colonies('default', 'on').filter(r => r.ind.some(i => i.riskTotal > 0)).length / Math.max(1, colonies('default', 'on').length);
  const restBoth = ['on', 'off'].every(l => colonies('default', l).every(r => r.ind.some(i => i.restKeys > 0)));
  const horizon = rs.filter(r => r.exp === 'h3').every(r => r.tick === END);
  const key = r => JSON.stringify([r.S_caution, r.born, r.alive, r.hunger, r.cohortN]);
  const offN = new Map(colonies('none', 'off').map(r => [r.seed, key(r)]));
  const specific = colonies('none', 'on').length > 0 && colonies('none', 'on').every(r => offN.get(r.seed) === key(r));
  const geneCheck = pairedDiffCI(S(rs, 'gene', 'on', seeds), S(rs, 'none', 'on', seeds));
  const checks = { riskOffHasNoRiskMemory: offRisk, riskOnLearnsInMostDefaultColonies: onRiskShare >= 0.9, restLearningInBothArms: restBoth, switchHasNoEffectWithoutPredator: specific, fullHorizon: horizon, geneCheckPositive: geneCheck.lo > 0 };
  const validated = Object.values(checks).every(Boolean);
  summary.checks = { ...checks, onRiskShare, geneCheck, validated };
  md.push('## Manipulation and method checks\n', '| check | rule | result |', '|---|---|---|',
    `| risk learning off removes risk memory | every creature in every off colony has none | ${offRisk ? 'pass' : 'FAIL'} |`,
    `| risk learning on learns risk | in at least 90% of default-predator colonies | ${(onRiskShare * 100).toFixed(0)}%: ${onRiskShare >= 0.9 ? 'pass' : 'FAIL'} |`,
    `| comfort learning about rest is kept | rest memories exist in both arms | ${restBoth ? 'pass' : 'FAIL'} |`,
    `| the switch is specific to predator risk | no-predator colonies identical with it on and off, every seed | ${specific ? 'pass' : 'FAIL'} |`,
    `| full horizon | every colony scored at tick ${END} | ${horizon ? 'pass' : 'FAIL'} |`,
    `| simulation check: the gene-only regime raises S | paired interval above zero | ${fmt(geneCheck, 3)}: ${geneCheck.lo > 0 ? 'pass' : 'FAIL'} |`,
    `\nAll checks ${validated ? '**passed**' : '**did not all pass**'}.\n`);
  // Primary: default predator
  const P = ['default', 'direct', 'gene'];
  summary.h3 = {};
  md.push('## H3: predator effect on selection for caution, and its interaction with risk learning\n', 'S is the offspring-weighted minus plain mean caution over each colony\'s cohort born by day 60, early deaths included. Default is primary; direct and gene are secondary checks.\n',
    '| predator | E_on | E_off | I = E_off - E_on | seeds with all four arms | decision |', '|---|---|---|---|---|---|');
  for (const p of P) {
    if (p !== 'default') { const eon = pairedDiffCI(S(rs, p, 'on', seeds), S(rs, 'none', 'on', seeds)); summary.h3[p] = { Eon: eon }; md.push(`| ${p} | ${fmt(eon, 3)} | (same as E_on: no prowler, so no risk learning) | n/a | ${eon.n} | (secondary) |`); continue; }
    const e = commonSeedEffects(S(rs, p, 'off', seeds), S(rs, 'none', 'off', seeds), S(rs, p, 'on', seeds), S(rs, 'none', 'on', seeds));
    const d = p === 'default' ? decide(e, FROZEN.delta, validated) : '(secondary)';
    summary.h3[p] = { ...e, decision: d };
    md.push(`| ${p} | ${fmt(e.Eon, 3)} | ${fmt(e.Eoff, 3)} | **${fmt(e.I, 3)}** | ${e.commonSeeds} | ${d} |`);
  }
  md.push('', '### All-colony outcomes\n', `| condition | extinct | cohort births | births | killed by predator | hunger deaths | mean caution of the living at day 120 | S undefined |`, '|---|---|---|---|---|---|---|---|');
  for (const p of ['none', ...P]) for (const l of CONFIRM_ARMS[p]) { const c = colonies(p, l); md.push(`| ${h3cond(p, l)} | ${c.filter(r => r.extinct).length}/${c.length} | ${fmt(bootstrapMeanCI(c.map(r => r.cohortOffspring)), 1)} | ${fmt(bootstrapMeanCI(c.map(r => r.born)), 1)} | ${c.reduce((a, r) => a + r.byBeast, 0)} | ${c.reduce((a, r) => a + r.hunger, 0)} | ${fmt(bootstrapMeanCI(c.map(r => r.cautionEnd)), 3)} | ${c.filter(r => !finite(r.S_caution)).length} |`); }
  // Behaviour (descriptive): does the caution gene change pre-attack vulnerability? (cohort, every member, no age filter)
  md.push('', '### Caution and vulnerability before each night attack draw (descriptive; cohort, all members)\n', 'Within-colony rank correlation between caution and the share of night ticks a creature was takeable under each predator\'s rule, scored for everyone in every arm.\n', '| arm | default rule | direct rule (outside fire and walls) | resting in the open |', '|---|---|---|---|');
  summary.behaviour = {};
  for (const p of ['none', ...P]) {
    const groups = k => colonies(p, 'on').map(r => r.ind.filter(i => i.born <= COHORT_BORN_BY && i.vuln.ticks > 0).map(i => ({ caution: i.caution, v: i.vuln[k] / i.vuln.ticks })));
    const cells = ['default', 'direct', 'restOpen'].map(k => { const c = clusterSpearman(groups(k), 'caution', 'v', { within: true, B: 2000 }); summary.behaviour[p + ':' + k] = c; return fmt(c, 3); });
    md.push(`| ${p}, risk learning on | ${cells.join(' | ')} |`);
  }
  // H1, H2, ablations
  const pick = (exp, cond) => rs.filter(r => r.exp === exp && (!cond || r.cond === cond));
  if (pick('h1').length) {
    const o = bySeed(rs, 'h1', 'open', 'c2Fed', seeds), b = bySeed(rs, 'h1', 'blocked', 'c2Fed', seeds);
    summary.h1 = { open: bootstrapMeanCI(o), blocked: bootstrapMeanCI(b), diff: pairedDiffCI(o, b) };
    md.push('', '## H1: does feeding the fire depend on watching?\n', '| | watching allowed | watching blocked |', '|---|---|---|', `| c2 fed the fire by day 17 | ${o.filter(v => v === 1).length}/${seeds.length} | ${b.filter(v => v === 1).length}/${seeds.length} |`, `\nPaired difference, allowed minus blocked: **${fmt(summary.h1.diff)}**.`);
  }
  if (pick('h2').length) {
    const h2 = pick('h2'), sum = k => h2.reduce((a, r) => a + r[k], 0);
    const perColony = h2.filter(r => r.descPractitioners > 0).map(r => r.observedFirst / r.descPractitioners);
    summary.h2 = { latePractice: bootstrapMeanCI(h2.map(r => r.latePractice)), observedFirstColonyMean: bootstrapMeanCI(perColony), coloniesWithDescPractitioners: perColony.length };
    md.push('', '## H2: persistence after the founders die (70 days)\n', '| measure | result |', '|---|---|', `| late practice: founders all dead, a fire burning, fed by a descendant in the last four days | ${sum('latePractice')}/${h2.length} (${fmt(summary.h2.latePractice)}) |`, `| a fire burned without any gap from day 3 to day 70 | ${sum('unbroken')}/${h2.length} |`, `| colonies with at least one descendant practitioner | ${perColony.length}/${h2.length} |`, `| share of a colony's descendant practitioners who observed an actual feed before their own first (mean over those colonies) | ${fmt(summary.h2.observedFirstColonyMean)} |`);
  }
  if (pick('ablation').length) {
    const C = ['baseline', 'noWatch', 'wipeDaily', 'noBreed'];
    md.push('', '## Ablations (predator present, 50 days; descriptive)\n', `| | ${C.join(' | ')} |`, `|---|${C.map(() => '---').join('|')}|`, `| fire burning at day 50 | ${C.map(c => pick('ablation', c).filter(r => r.fireAlive).length + '/' + pick('ablation', c).length).join(' | ')} |`, `| fire, paired difference from baseline | ${C.map(c => fmt(pairedDiffCI(bySeed(rs, 'ablation', c, 'fireAlive', seeds), bySeed(rs, 'ablation', 'baseline', 'fireAlive', seeds)))).join(' | ')} |`, `| creatures alive at day 50 | ${C.map(c => fmt(bootstrapMeanCI(pick('ablation', c).map(r => r.alive)), 1)).join(' | ')} |`);
  }
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(OUT, 'RESULTS.md'), md.join('\n') + '\n');
  if (summary.h3.default) fs.writeFileSync(path.join(OUT, 'fig-v3-interaction.svg'), dotCI({ title: 'Predator effect on selection for caution, by risk learning', unit: 'effect on S, paired by seed', rows: [{ label: 'risk learning on (E_on)', ci: summary.h3.default.Eon }, { label: 'risk learning off (E_off)', ci: summary.h3.default.Eoff }, { label: 'interaction (I)', ci: summary.h3.default.I }] }));
  console.log(md.join('\n'));
}

async function main() {
  if (process.env.SMOKE) { const rs = await runAll(TEST_SEEDS.map(s => ({ exp: 'smoke', seed: s, cond: 'smoke' }))); console.log('smoke ok', rs.length); return; }
  if (process.env.PRECISION) return precision();
  // Dry run of the confirmatory analysis on development data, to check it executes (not a result).
  if (process.env.ANALYZE_DEV) { const D = path.join(HERE, 'results-dev', 'dry-analysis'); fs.mkdirSync(D, { recursive: true }); const raw = JSON.parse(fs.readFileSync(path.join(HERE, 'results-dev', 'raw-precision.json'), 'utf8')); return analyze(raw, DEV_SEEDS, D); }
  const OUT = path.join(HERE, 'results'); fs.mkdirSync(OUT, { recursive: true });
  const seeds = FROZEN.confirmSeeds;
  if (process.env.ANALYZE) { const raw = JSON.parse(fs.readFileSync(path.join(OUT, 'raw.json'), 'utf8')); return analyze(raw, seeds, OUT); }
  for (const k of ['N', 'DIRECT_CHANCE', 'GENE_CHANCE', 'EXPOSURE_CHANCE', 'ONLY']) if (process.env[k]) throw new Error(`the confirmatory run takes no overrides (${k} is set); see PREREGISTRATION-v3.md`);
  { const p = provenance({}); if (p.dirty !== false) throw new Error('the confirmatory run needs a clean, committed tree (git status shows changes under lab/); see PREREGISTRATION-v3.md'); }
  const jobs = [
    ...['open', 'blocked'].flatMap(cond => seeds.map(s => ({ exp: 'h1', seed: s, cond }))),
    ...seeds.map(s => ({ exp: 'h2', seed: s, cond: 'default' })),
    ...h3jobs(seeds, Object.keys(PRED), CONFIRM_ARMS),
    ...Object.entries({ baseline: {}, noWatch: { noWatch: true }, wipeDaily: { wipeDaily: true }, noBreed: { noBreed: true } }).flatMap(([k, o]) => seeds.map(s => ({ exp: 'ablation', seed: s, cond: k, opts: { threat: true, ...o } })))
  ];
  console.log(`v3 confirmatory run: ${jobs.length} runs on seeds ${seeds[0]}-${seeds.at(-1)}`);
  const rs = await runAll(jobs);
  fs.writeFileSync(path.join(OUT, 'raw.json'), JSON.stringify(rs));
  if (rs.length !== jobs.length) throw new Error(`invalid run: ${rs.length} of ${jobs.length} completed`);
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(provenance({ seeds, frozen: FROZEN, runs: rs.length, expectedRuns: jobs.length, fresh: true }), null, 2));
  analyze(rs, seeds, OUT);
}

if (!isMainThread) {
  parentPort.on('message', j => { try { parentPort.postMessage({ ok: true, j, r: job(j) }); } catch (e) { parentPort.postMessage({ ok: false, j, err: String(e && e.stack || e) }); } });
} else if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch(e => { console.error(e); process.exit(1); });
