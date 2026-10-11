// lab/research/run.mjs — v2 of the experiment harness (see PREREGISTRATION-v2.md).
//   node lab/research/run.mjs              every v2 experiment, N = 64, into lab/research/results/
//   N=8 node lab/research/run.mjs          quicker look
//   ONLY=h3 node lab/research/run.mjs      one experiment (h1, h2, h3, ablations); merges into raw.json
//   CALIBRATE=1 node lab/research/run.mjs  the positive-control calibration on development seeds 101-116
// v1 (the original confirmatory run) is reproducible from git tag confirmatory-v1; its outputs are in results-v1/.
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import { cpus } from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { newColony, run, step, keeperPlace, fireReport } from '../sim.js';
import { bootstrapMeanCI, pairedDiffCI, clusterSpearman, selectionDifferential, fmt } from './stats.js';
import { dotCI, bars } from './figures.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'results');
const N = Number(process.env.N || 64);
const SEEDS = Array.from({ length: N }, (_, i) => i + 1);
const DEV_SEEDS = Array.from({ length: 16 }, (_, i) => 101 + i);
const DAY = 24;
// Frozen by the calibration recorded in PREREGISTRATION-v2.md.
const EXPOSURE_CHANCE = Number(process.env.EXPOSURE_CHANCE || 0.01), DIRECT_CHANCE = Number(process.env.DIRECT_CHANCE || 0.002);
const PRED = { none: { threat: false }, default: { threat: true }, targeted: { threat: true, threatMode: 'targeted' }, exposure: { threat: true, threatMode: 'exposure', exposureChance: EXPOSURE_CHANCE }, direct: { threat: true, threatMode: 'direct', directChance: DIRECT_CHANCE } };

// ---- one colony, one condition: plain numbers only ----------------------------------------------
function job({ exp, seed, cond, opts }) {
  if (exp === 'h1') {
    // Transmission: c2 lives in the colony with the same access to the fire and fuel, but in the
    // 'blocked' arm it learns nothing from watching anyone. Does it still come to feed the fire?
    const w = newColony(seed, 6, { threat: false });
    if (cond === 'blocked') w.creatures.find(c => c.id === 'c2').noObserve = true;
    run(w, 48); keeperPlace(w, 'ember', 9, 5, { fuel: 120 }); run(w, 14 * DAY);
    const rep = fireReport(w), feeders = new Set(w.events.filter(e => e.kind === 'fed_fire' && e.who).map(e => e.who));
    return { c2Fed: feeders.has('c2') ? 1 : 0, c2Feeds: w.events.filter(e => e.kind === 'fed_fire' && e.who === 'c2').length, practitioners: feeders.size, twoPlus: [...feeders].filter(id => id !== 'c2').length >= 2 ? 1 : 0, fireAlive: rep.alive ? 1 : 0 };
  }
  if (exp === 'h2') {
    const w = newColony(seed, 6, { threat: false });
    run(w, 48); keeperPlace(w, 'ember', 9, 5, { fuel: 120 });
    let gapTicks = 0, longestGap = 0, cur = 0;
    for (let t = 48; t < 70 * DAY; t++) { step(w); const burning = w.objects.some(o => !o.gone && o.burning > 0 && o.fuel > 0); if (!burning) { gapTicks++; cur++; longestGap = Math.max(longestGap, cur); } else cur = 0; }
    const founders = new Set(w.creatures.slice(0, 6).map(c => c.id));
    const feeds = w.events.filter(e => e.kind === 'fed_fire' && e.who);
    const late = feeds.filter(e => e.t > 66 * DAY && !founders.has(e.who)).length;
    // For each descendant who ever fed a fire: had it seen a fire grow when fed, before its first feed?
    const firstFeed = {}; for (const e of feeds) if (!(e.who in firstFeed)) firstFeed[e.who] = e.t;
    const desc = Object.keys(firstFeed).filter(id => !founders.has(id));
    const social = desc.filter(id => w.events.some(e => e.kind === 'saw' && e.who === id && e.outcome === 'fire_grew' && e.t < firstFeed[id])).length;
    const foundersGone = w.creatures.slice(0, 6).every(c => !c.alive);
    return { foundersGone: foundersGone ? 1 : 0, fireAlive: fireReport(w).alive ? 1 : 0, lateFeeds: late, persisted: foundersGone && fireReport(w).alive && late > 0 ? 1 : 0, descPractitioners: desc.length, descSawFirst: social, unbroken: gapTicks === 0 ? 1 : 0, longestGapDays: +(longestGap / DAY).toFixed(2), lit: w.events.filter(e => e.kind === 'made_fire').length };
  }
  if (exp === 'h3' || exp === 'ablation') {
    const days = exp === 'ablation' ? 50 : 120;
    const w = newColony(seed, 6, opts);
    run(w, 48); keeperPlace(w, 'ember', 9, 5, { fuel: 120 }); run(w, days * DAY - 48);
    const deaths = w.events.filter(e => e.kind === 'died'), diedAt = {}; for (const d of deaths) diedAt[d.who] = d.t;
    const live = w.creatures.filter(c => c.alive);
    const mean = (arr, k) => arr.length ? arr.reduce((a, c) => a + c.genome[k], 0) / arr.length : NaN;
    // Individuals: everyone who ever lived, with the trait, offspring, age at death or end, and measured nights.
    const ind = w.creatures.map(c => { const end = c.alive ? w.tick : diedAt[c.id]; const n = c.night; return { id: c.id, founder: w.creatures.indexOf(c) < 6 ? 1 : 0, born: c.born, ageDays: +((end - c.born) / DAY).toFixed(2), cause: c.alive ? null : (deaths.find(d => d.who === c.id) || {}).cause || null, caution: +c.genome.caution.toFixed(4), brawn: +c.genome.brawn.toFixed(4), curiosity: +c.genome.curiosity.toFixed(4), sociability: +c.genome.sociability.toFixed(4), offspring: c.offspring, nights: n.ticks, exposed: n.exposed, rested: n.rested, restedProtected: n.restedProtected, ate: n.ate, fled: n.fled }; });
    // Selection differentials over the cohort born by day 60 (so every member had a full 60-day life
    // to reproduce by day 120), counting early deaths as zero offspring.
    const cohort = ind.filter(i => i.born <= 60 * DAY);
    const viab = cohort.map(i => ({ ...i, offspring: i.ageDays >= 16 ? 1 : 0 }));   // survival to breeding age
    return { extinct: live.length ? 0 : 1, alive: live.length, cautionFounders: mean(w.creatures.slice(0, 6), 'caution'), cautionEnd: mean(live, 'caution'), brawnEnd: mean(live, 'brawn'),
      S_caution: selectionDifferential(cohort, 'caution'), S_caution_viability: selectionDifferential(viab, 'caution'), S_brawn: selectionDifferential(cohort, 'brawn'), cohortN: cohort.length,
      born: w.events.filter(e => e.kind === 'born').length, byBeast: deaths.filter(d => d.cause === 'the beast').length, hunger: deaths.filter(d => /hunger/.test(d.cause)).length,
      attacks: w.events.filter(e => e.kind === 'attacked').length, droveOff: w.events.filter(e => e.kind === 'drove_off').length, fireAlive: fireReport(w).alive ? 1 : 0, ind };
  }
  throw new Error('unknown experiment ' + exp);
}


async function runAll(jobs) {
  const nWorkers = Math.max(1, Math.min(cpus().length - 1, jobs.length));
  const results = []; let next = 0, done = 0; const t0 = Date.now();
  await new Promise((resolve, reject) => {
    const workers = Array.from({ length: nWorkers }, () => new Worker(fileURLToPath(import.meta.url)));
    for (const wk of workers) {
      const feed = () => { if (next < jobs.length) wk.postMessage(jobs[next++]); else wk.terminate(); };
      wk.on('message', m => { if (!m.ok) return reject(new Error(m.err)); results.push({ ...m.j, ...m.r }); done++; if (done % 16 === 0 || done === jobs.length) process.stdout.write(`\r  ${done}/${jobs.length} runs, ${((Date.now() - t0) / 1000).toFixed(0)}s`); if (done === jobs.length) resolve(); else feed(); });
      wk.on('error', reject); feed();
    }
  });
  process.stdout.write('\n');
  // Completion order varies between machines; analysis order must not.
  return results.sort((a, b) => a.exp.localeCompare(b.exp) || a.cond.localeCompare(b.cond) || a.seed - b.seed);
}
const pick = (rs, exp, cond) => rs.filter(r => r.exp === exp && (!cond || r.cond === cond)).sort((a, b) => a.seed - b.seed);
const bySeed = (rs, exp, cond, key, seeds = SEEDS) => { const m = new Map(pick(rs, exp, cond).map(r => [r.seed, r[key]])); return seeds.map(s => m.has(s) ? m.get(s) : NaN); };
const pct = v => (v * 100).toFixed(1) + '%';
const h3cond = (p, l) => `${p}|${l}`;

async function calibrate() {
  if (process.env.CALIBRATE === 'direct') { const ch = [0.001, 0.002, 0.004]; const jobs = []; for (const s of DEV_SEEDS) { jobs.push({ exp: 'h3', seed: s, cond: 'none|on', opts: { ...PRED.none } }); for (const c of ch) jobs.push({ exp: 'h3', seed: s, cond: 'direct' + c, opts: { threat: true, threatMode: 'direct', directChance: c } }); } const rs = await runAll(jobs); const base = bySeed(rs, 'h3', 'none|on', 'S_caution', DEV_SEEDS); const lines = ['| direct chance per night tick | extinct | killed | S_caution | difference vs none, paired |', '|---|---|---|---|---|']; for (const c of ch) { const k = 'direct' + c; lines.push(`| ${c} | ${pick(rs, 'h3', k).filter(x => x.extinct).length}/${DEV_SEEDS.length} | ${pick(rs, 'h3', k).reduce((a, x) => a + x.byBeast, 0)} | ${fmt(bootstrapMeanCI(bySeed(rs, 'h3', k, 'S_caution', DEV_SEEDS)), 3)} | ${fmt(pairedDiffCI(bySeed(rs, 'h3', k, 'S_caution', DEV_SEEDS), base), 3)} |`); } fs.appendFileSync(path.join(OUT, 'CALIBRATION.md'), '\n## Assay check: a predator whose kill chance depends directly on the caution gene\n\n' + lines.join('\n') + '\n'); console.log(lines.join('\n')); return; }
  const chances = [0.005, 0.01, 0.02, 0.03];
  const jobs = [];
  for (const s of DEV_SEEDS) { jobs.push({ exp: 'h3', seed: s, cond: 'none|on', opts: { ...PRED.none } }); for (const ch of chances) jobs.push({ exp: 'h3', seed: s, cond: 'exposure' + ch, opts: { threat: true, threatMode: 'exposure', exposureChance: ch } }); }
  console.log(`Calibration: ${jobs.length} runs on development seeds ${DEV_SEEDS[0]}-${DEV_SEEDS.at(-1)}`);
  const rs = await runAll(jobs);
  const base = bySeed(rs, 'h3', 'none|on', 'S_caution', DEV_SEEDS);
  const lines = ['| exposure chance per resting tick | extinct | S_caution (exposure) | S_caution difference vs none, paired |', '|---|---|---|---|'];
  for (const ch of chances) { const c = 'exposure' + ch, ext = pick(rs, 'h3', c).filter(r => r.extinct).length; lines.push(`| ${ch} | ${ext}/${DEV_SEEDS.length} | ${fmt(bootstrapMeanCI(bySeed(rs, 'h3', c, 'S_caution', DEV_SEEDS)), 3)} | ${fmt(pairedDiffCI(bySeed(rs, 'h3', c, 'S_caution', DEV_SEEDS), base), 3)} |`); }
  lines.push(`\nno predator, S_caution: ${fmt(bootstrapMeanCI(base), 3)}`);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'CALIBRATION.md'), `# Positive-control calibration (development seeds ${DEV_SEEDS[0]}-${DEV_SEEDS.at(-1)}, not used in the confirmatory run)\n\n${lines.join('\n')}\n`);
  console.log(lines.join('\n'));
}

async function main() {
  if (process.env.CALIBRATE) return calibrate();
  fs.mkdirSync(OUT, { recursive: true });
  const only = process.env.ONLY, jobs = [];
  if (!only || only === 'h1') for (const cond of ['open', 'blocked']) for (const s of SEEDS) jobs.push({ exp: 'h1', seed: s, cond });
  if (!only || only === 'h2') for (const s of SEEDS) jobs.push({ exp: 'h2', seed: s, cond: 'default' });
  if (!only || only === 'h3') for (const p of Object.keys(PRED)) for (const l of ['on', 'off']) for (const s of SEEDS) jobs.push({ exp: 'h3', seed: s, cond: h3cond(p, l), opts: { ...PRED[p], noProtLearn: l === 'off' } });
  if (!only || only === 'ablations') { const A = { baseline: {}, noWatch: { noWatch: true }, wipeDaily: { wipeDaily: true }, noBreed: { noBreed: true } }; for (const [k, o] of Object.entries(A)) for (const s of SEEDS) jobs.push({ exp: 'ablation', seed: s, cond: k, opts: { threat: true, ...o } }); }
  console.log(`${jobs.length} runs, N = ${N} seeds, ${Math.min(cpus().length - 1, jobs.length)} workers`);
  const fresh = await runAll(jobs);
  const ran = new Set(fresh.map(r => r.exp));
  const old = only && fs.existsSync(path.join(OUT, 'raw.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'raw.json'), 'utf8')).filter(r => !ran.has(r.exp)) : [];
  const rs = [...old, ...fresh].sort((a, b) => a.exp.localeCompare(b.exp) || a.cond.localeCompare(b.cond) || a.seed - b.seed);
  let commit = 'unknown'; try { commit = execSync('git rev-parse HEAD', { cwd: HERE }).toString().trim(); } catch {}
  fs.writeFileSync(path.join(OUT, 'raw.json'), JSON.stringify(rs));
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ harness: 'v2', commit, N, seeds: [SEEDS[0], SEEDS.at(-1)], exposureChance: EXPOSURE_CHANCE, directChance: DIRECT_CHANCE, runs: rs.length, generated: new Date().toISOString(), node: process.version }, null, 2));

  const md = [`# Results v2 (N = ${N} seeds per condition)\n`, `Generated by \`node lab/research/run.mjs\` at commit \`${commit.slice(0, 10)}\`. Differences between conditions are paired by seed (95% bootstrap over seeds, 10,000 resamples); correlations resample whole colonies. Pre-registration: PREREGISTRATION-v2.md.\n`];
  const summary = { commit, N };

  // ---- H1: transmission --------------------------------------------------------------------------
  if (pick(rs, 'h1').length) {
    const o = bySeed(rs, 'h1', 'open', 'c2Fed'), b = bySeed(rs, 'h1', 'blocked', 'c2Fed');
    summary.h1 = { c2FedOpen: bootstrapMeanCI(o), c2FedBlocked: bootstrapMeanCI(b), diff: pairedDiffCI(o, b), twoPlus: bootstrapMeanCI(bySeed(rs, 'h1', 'open', 'twoPlus')), practitioners: bootstrapMeanCI(bySeed(rs, 'h1', 'open', 'practitioners')) };
    md.push(`## H1: does the practice need watching?\n`, `c2 lives in the colony with the same access to the fire and fuel. In the blocked arm it learns nothing from watching.\n`, `| | watching allowed | watching blocked |\n|---|---|---|`,
      `| c2 fed the fire at least once by day 17 | ${o.filter(v => v).length}/${N} | ${b.filter(v => v).length}/${N} |`,
      `| c2 feeds, mean | ${fmt(bootstrapMeanCI(bySeed(rs, 'h1', 'open', 'c2Feeds')), 1)} | ${fmt(bootstrapMeanCI(bySeed(rs, 'h1', 'blocked', 'c2Feeds')), 1)} |`,
      `\nPaired difference in the share of colonies where c2 fed the fire (allowed minus blocked): **${fmt(summary.h1.diff)}**.`,
      `Colonies with two or more practitioners besides c2 (actual feeders, event-based): ${fmt(summary.h1.twoPlus)}; practitioners per colony ${fmt(summary.h1.practitioners, 1)}.\n`);
  }
  // ---- H2: persistence ----------------------------------------------------------------------------
  const h2 = pick(rs, 'h2');
  if (h2.length) {
    const sum = k => h2.reduce((a, r) => a + r[k], 0);
    summary.h2 = { persisted: bootstrapMeanCI(h2.map(r => r.persisted)), unbroken: sum('unbroken'), descPractitioners: sum('descPractitioners'), descSawFirst: sum('descSawFirst') };
    md.push(`## H2: does the practice persist after the founders die? (70 days)\n`, `| measure | result |\n|---|---|`,
      `| every founder dead by day 70 | ${sum('foundersGone')}/${N} |`,
      `| late fire-feeding by creatures born after the ember, with a fire burning at day 70 | ${sum('persisted')}/${N} (${fmt(summary.h2.persisted)}) |`,
      `| a fire burned without a single gap from day 3 to day 70 | ${sum('unbroken')}/${N} |`,
      `| fires lit from sparks by the creatures | ${sum('lit')} in all |`,
      `| descendants who ever fed a fire | ${sum('descPractitioners')} |`,
      `| ...of whom had seen a fire grow when fed before their first feed | ${sum('descSawFirst')} (${pct(sum('descSawFirst') / Math.max(1, sum('descPractitioners')))}) |\n`);
  }
  // ---- H3: selection ---------------------------------------------------------------------------------
  if (pick(rs, 'h3').length) {
    const P = Object.keys(PRED), name = { none: 'no predator', default: 'predator', targeted: 'targeted predator', exposure: 'exposure predator', direct: 'direct gene predator (assay check)' };
    const S = (p, l, k = 'S_caution') => bySeed(rs, 'h3', h3cond(p, l), k);
    summary.h3 = {};
    md.push(`## H3: does a predator select for caution? (120 days)\n`, `Selection differential S: the offspring-weighted mean caution minus the plain mean, over each colony's cohort born by day 60, early deaths included. Positive S means the parents of more children were more cautious.\n`,
      `| | ${P.map(p => name[p]).join(' | ')} |\n|---|${P.map(() => '---').join('|')}|`,
      `| S on caution, learning on | ${P.map(p => fmt(bootstrapMeanCI(S(p, 'on')), 3)).join(' | ')} |`,
      `| S on caution, protective learning off | ${P.map(p => fmt(bootstrapMeanCI(S(p, 'off')), 3)).join(' | ')} |`,
      `| S on caution through survival to breeding age, learning on | ${P.map(p => fmt(bootstrapMeanCI(S(p, 'on', 'S_caution_viability')), 3)).join(' | ')} |`,
      `| S on brawn, learning on | ${P.map(p => fmt(bootstrapMeanCI(S(p, 'on', 'S_brawn')), 3)).join(' | ')} |`,
      `| mean caution of the living at day 120, learning on | ${P.map(p => fmt(bootstrapMeanCI(bySeed(rs, 'h3', h3cond(p, 'on'), 'cautionEnd')), 3)).join(' | ')} |`,
      `| colonies extinct, learning on / off | ${P.map(p => `${pick(rs, 'h3', h3cond(p, 'on')).filter(r => r.extinct).length} / ${pick(rs, 'h3', h3cond(p, 'off')).filter(r => r.extinct).length}`).join(' | ')} |`,
      `| killed by the predator, learning on | ${P.map(p => pick(rs, 'h3', h3cond(p, 'on')).reduce((a, r) => a + r.byBeast, 0)).join(' | ')} |`,
      `| hunger deaths, learning on | ${P.map(p => pick(rs, 'h3', h3cond(p, 'on')).reduce((a, r) => a + r.hunger, 0)).join(' | ')} |`,
      `| births per colony, learning on | ${P.map(p => fmt(bootstrapMeanCI(bySeed(rs, 'h3', h3cond(p, 'on'), 'born')), 1)).join(' | ')} |`, '');
    const rows = [];
    for (const p of ['default', 'targeted', 'exposure', 'direct']) {
      const effOn = pairedDiffCI(S(p, 'on'), S('none', 'on')), effOff = pairedDiffCI(S(p, 'off'), S('none', 'off'));
      const inter = (() => { const a = S(p, 'off'), b = S('none', 'off'), c = S(p, 'on'), d = S('none', 'on'); const x = SEEDS.map((_, i) => (a[i] - b[i]) - (c[i] - d[i])); return { ...bootstrapMeanCI(x.filter(Number.isFinite)), dropped: x.filter(v => !Number.isFinite(v)).length }; })();
      summary.h3[p] = { effOn, effOff, interaction: inter, finalMeanDiff: pairedDiffCI(bySeed(rs, 'h3', h3cond(p, 'on'), 'cautionEnd'), bySeed(rs, 'h3', h3cond('none', 'on'), 'cautionEnd')) };
      rows.push(`| ${name[p]} | ${fmt(effOn, 3)} (n=${effOn.n}) | ${fmt(effOff, 3)} (n=${effOff.n}) | **${fmt(inter, 3)}** (n=${inter.n}) | ${fmt(summary.h3[p].finalMeanDiff, 3)} |`);
    }
    md.push(`### Predator effect on selection, and its interaction with protective learning\n`, `Each cell is paired by seed against the no-predator colonies with the same learning setting. Seeds where a colony had no differential (too few in the cohort, or no births) are dropped from that contrast; n is the number used.\n`,
      `| predator | effect on S, learning on | effect on S, protective learning off | interaction (off minus on) | final mean caution, predator minus none (learning on, survivors) |`, `|---|---|---|---|---|`, ...rows, '');
    // Mechanism (descriptive): within-colony association between caution and measured night behaviour, and offspring.
    md.push(`### Caution and what individuals actually did at night (learning on; individuals who lived 16+ days)\n`, `Rank correlations with caution, resampling whole colonies; "within" ranks inside each colony first.\n`, `| | ${P.map(p => name[p]).join(' | ')} |\n|---|${P.map(() => '---').join('|')}|`);
    const share = k => r => r.nights ? r[k] / r.nights : NaN;
    summary.h3.mech = {};
    for (const [label, key, f] of [['share of night ticks exposed', 'exposedShare', share('exposed')], ['share of night ticks resting', 'restShare', share('rested')], ['share of night ticks resting by fire or in walls', 'restProtShare', share('restedProtected')], ['share of night ticks eating', 'ateShare', share('ate')], ['offspring (within colony)', 'offspring', r => r.offspring]]) {
      const cells = P.map(p => { const groups = pick(rs, 'h3', h3cond(p, 'on')).map(r => r.ind.filter(i => i.ageDays >= 16).map(i => ({ caution: i.caution, v: f(i) })).filter(i => Number.isFinite(i.v))); const c = clusterSpearman(groups, 'caution', 'v', { within: true, B: 2000 }); summary.h3.mech[p + ':' + key] = c; return fmt(c, 3); });
      md.push(`| ${label} | ${cells.join(' | ')} |`);
    }
    md.push('');
    fs.writeFileSync(path.join(OUT, 'fig-v2-selection.svg'), dotCI({ title: 'Predator effect on selection for caution', unit: 'difference in S from no predator, paired by seed, learning on', rows: ['default', 'targeted', 'exposure', 'direct'].map(p => ({ label: name[p].replace(' (assay check)', ''), ci: summary.h3[p].effOn })) }));
    fs.writeFileSync(path.join(OUT, 'fig-v2-interaction.svg'), dotCI({ title: 'Does protective learning shield selection?', unit: 'interaction: effect with protective learning off minus effect with it on', rows: ['default', 'targeted', 'exposure', 'direct'].map(p => ({ label: name[p].replace(' (assay check)', ''), ci: summary.h3[p].interaction })) }));
  }
  // ---- ablations --------------------------------------------------------------------------------------
  if (pick(rs, 'ablation').length) {
    const C = ['baseline', 'noWatch', 'wipeDaily', 'noBreed'], name = { baseline: 'unchanged', noWatch: 'no learning by watching', wipeDaily: 'memory wiped every dawn', noBreed: 'no children' };
    summary.ablations = {};
    for (const c of C) summary.ablations[c] = { fire: bootstrapMeanCI(bySeed(rs, 'ablation', c, 'fireAlive')), alive: bootstrapMeanCI(bySeed(rs, 'ablation', c, 'alive')), fireVsBaseline: pairedDiffCI(bySeed(rs, 'ablation', c, 'fireAlive'), bySeed(rs, 'ablation', 'baseline', 'fireAlive')) };
    md.push(`## Ablations (predator present, 50 days; descriptive, not pre-registered as tests)\n`, `| | ${C.map(c => name[c]).join(' | ')} |\n|---|${C.map(() => '---').join('|')}|`,
      `| fire burning at day 50 | ${C.map(c => pick(rs, 'ablation', c).filter(r => r.fireAlive).length + '/' + N).join(' | ')} |`,
      `| fire, paired difference from unchanged | ${C.map(c => fmt(summary.ablations[c].fireVsBaseline)).join(' | ')} |`,
      `| colonies extinct by day 50 | ${C.map(c => pick(rs, 'ablation', c).filter(r => r.extinct).length + '/' + N).join(' | ')} |`,
      `| creatures alive at day 50 | ${C.map(c => fmt(summary.ablations[c].alive, 1)).join(' | ')} |`,
      `| hunger deaths, all colonies | ${C.map(c => pick(rs, 'ablation', c).reduce((a, r) => a + r.hunger, 0)).join(' | ')} |\n`);
  }
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(OUT, 'RESULTS.md'), md.join('\n'));
  console.log(md.join('\n'));
}

if (!isMainThread) {
  parentPort.on('message', j => { try { parentPort.postMessage({ ok: true, j, r: job(j) }); } catch (e) { parentPort.postMessage({ ok: false, j, err: String(e && e.stack || e) }); } });
} else main().catch(e => { console.error(e); process.exit(1); });
