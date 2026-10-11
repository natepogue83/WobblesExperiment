// lab/research/run.mjs — every experiment in the pre-registration, from one command.
//   node lab/research/run.mjs            all experiments, N = 64 seeds, results into lab/research/results/
//   N=8 node lab/research/run.mjs        quicker look
//   ONLY=h3 node lab/research/run.mjs    one experiment (h1, h2, h3, ablations)
// Runs colonies in parallel on worker threads; aggregates; writes JSON, markdown tables and SVG figures.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newColony, run, keeperPlace, fireReport } from '../sim.js';
import { bootstrapMeanCI, bootstrapDiffCI, spearman, fmt } from './stats.js';
import { dotCI, bars } from './figures.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'results');
const N = Number(process.env.N || 64);
const SEEDS = Array.from({ length: N }, (_, i) => i + 1);
const DAY = 24;

// ---- one colony, one condition: returns plain numbers only -------------------------------------
function job({ exp, seed, cond }) {
  if (exp === 'h1') {
    // Fire-feeding: learned, spread, and never by an isolated creature.
    const w = newColony(seed, 6, { threat: false });
    run(w, 48); keeperPlace(w, 'ember', 9, 5, { fuel: 120 });
    for (let t = 0; t < 14 * DAY; t++) { const c = w.creatures.find(k => k.id === 'c2'); if (c) { c.x = 16; c.y = 1; } run(w, 1); if (c && Math.abs(c.x - 9) < 6) { c.x = 16; c.y = 1; } }
    const rep = fireReport(w);
    return { alive: rep.alive ? 1 : 0, doers: rep.doers.filter(d => d !== 'c2').length, isolatedLearned: rep.knowers.includes('c2') ? 1 : 0, feeds: rep.feeds };
  }
  if (exp === 'h2') {
    const w = newColony(seed, 6, { threat: false });
    run(w, 48); keeperPlace(w, 'ember', 9, 5, { fuel: 120 }); run(w, 70 * DAY - 48);
    const founders = w.creatures.slice(0, 6);
    const late = w.events.filter(e => e.kind === 'fed_fire' && e.who && e.t > 66 * DAY && !founders.some(f => f.id === e.who)).length;
    return { foundersGone: founders.every(c => !c.alive) ? 1 : 0, alive: fireReport(w).alive ? 1 : 0, lateFeeds: late, culture: founders.every(c => !c.alive) && fireReport(w).alive && late > 0 ? 1 : 0, living: w.creatures.filter(c => c.alive).length };
  }
  if (exp === 'h3' || exp === 'ablation') {
    const opts = { control: { threat: false }, predator: { threat: true }, targeted: { threat: true, threatMode: 'targeted' }, baseline: { threat: true },
      noWatch: { threat: true, noWatch: true }, wipeDaily: { threat: true, wipeDaily: true }, noBreed: { threat: true, noBreed: true } }[cond];
    const w = newColony(seed, 6, opts);
    const days = exp === 'ablation' ? 50 : 120;   // without children every colony dies of old age by day 60, so ablations are read at day 50
    run(w, 48); keeperPlace(w, 'ember', 9, 5, { fuel: 120 }); run(w, days * DAY - 48);
    const live = w.creatures.filter(c => c.alive), founders = w.creatures.slice(0, 6);
    const mean = (arr, k) => arr.length ? arr.reduce((a, c) => a + c.genome[k], 0) / arr.length : NaN;
    const deaths = w.events.filter(e => e.kind === 'died');
    // per-individual rows for the mechanism analysis (only creatures that lived at least 8 days as adults)
    const rows = w.creatures.filter(c => (c.alive ? w.tick : (deaths.find(d => d.who === c.id) || { t: w.tick }).t) - c.born >= 16 * DAY).map(c => {
      const na = c.nightActs, tot = Object.values(na).reduce((a, b) => a + b, 0) || 1;
      return { caution: c.genome.caution, brawn: c.genome.brawn, offspring: c.offspring, flee: na.flee / tot, restClosed: na.rest_closed / tot, restOpen: na.rest_open / tot, eat: na.eat / tot };
    });
    return { cautionStart: mean(founders, 'caution'), cautionEnd: mean(live, 'caution'), brawnStart: mean(founders, 'brawn'), brawnEnd: mean(live, 'brawn'),
      born: w.events.filter(e => e.kind === 'born').length, died: deaths.length, byBeast: deaths.filter(d => d.cause === 'the beast').length, hunger: deaths.filter(d => /hunger/.test(d.cause)).length,
      alive: live.length, extinct: live.length ? 0 : 1, fireAlive: fireReport(w).alive ? 1 : 0, attacks: w.events.filter(e => e.kind === 'attacked').length, droveOff: w.events.filter(e => e.kind === 'drove_off').length,
      shards: w.events.filter(e => e.kind === 'made_shard').length, felled: w.events.filter(e => e.kind === 'felled').length, joined: w.events.filter(e => e.kind === 'joined').length, rows };
  }
  throw new Error('unknown experiment ' + exp);
}

if (!isMainThread) {
  parentPort.on('message', j => { try { parentPort.postMessage({ ok: true, j, r: job(j) }); } catch (e) { parentPort.postMessage({ ok: false, j, err: String(e && e.stack || e) }); } });
} else {
  main().catch(e => { console.error(e); process.exit(1); });
}

async function runAll(jobs) {
  const nWorkers = Math.max(1, Math.min(cpus().length - 1, jobs.length));
  const results = [];
  let next = 0, done = 0;
  const t0 = Date.now();
  await new Promise((resolve, reject) => {
    const workers = Array.from({ length: nWorkers }, () => new Worker(fileURLToPath(import.meta.url), { workerData: {} }));
    for (const wk of workers) {
      const feed = () => { if (next < jobs.length) wk.postMessage(jobs[next++]); else wk.terminate(); };
      wk.on('message', m => { if (!m.ok) return reject(new Error(m.err)); results.push({ ...m.j, ...m.r }); done++; if (done % 16 === 0 || done === jobs.length) process.stdout.write(`\r  ${done}/${jobs.length} runs, ${((Date.now() - t0) / 1000).toFixed(0)}s`); if (done === jobs.length) resolve(); else feed(); });
      wk.on('error', reject);
      feed();
    }
  });
  process.stdout.write('\n');
  return results;
}
const pick = (rs, exp, cond) => rs.filter(r => r.exp === exp && (!cond || r.cond === cond));
const col = (rs, k) => rs.map(r => r[k]).filter(v => Number.isFinite(v));

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const only = process.env.ONLY;
  const jobs = [];
  if (!only || only === 'h1') for (const s of SEEDS) jobs.push({ exp: 'h1', seed: s, cond: 'default' });
  if (!only || only === 'h2') for (const s of SEEDS) jobs.push({ exp: 'h2', seed: s, cond: 'default' });
  if (!only || only === 'h3') for (const cond of ['control', 'predator', 'targeted']) for (const s of SEEDS) jobs.push({ exp: 'h3', seed: s, cond });
  if (!only || only === 'ablations') for (const cond of ['baseline', 'noWatch', 'wipeDaily', 'noBreed']) for (const s of SEEDS) jobs.push({ exp: 'ablation', seed: s, cond });
  console.log(`${jobs.length} runs, N = ${N} seeds, ${Math.min(cpus().length - 1, jobs.length)} workers`);
  const fresh = await runAll(jobs);
  const ran = new Set(fresh.map(r => r.exp));
  const old = only && fs.existsSync(path.join(OUT, 'raw.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'raw.json'), 'utf8')).filter(r => !ran.has(r.exp)) : [];
  const rs = [...old, ...fresh];
  fs.writeFileSync(path.join(OUT, 'raw.json'), JSON.stringify(rs));

  const md = [`# Results (N = ${N} seeds per condition)\n`, `Generated ${new Date().toISOString().slice(0, 10)} by \`node lab/research/run.mjs\`. Intervals are 95% bootstrap CIs over seeds.\n`];
  const summary = {};

  // ---- H1 ------------------------------------------------------------------------------------------
  const h1 = pick(rs, 'h1');
  if (h1.length) {
    const spread = h1.filter(r => r.doers >= 2).length, kept = h1.filter(r => r.alive).length, iso = h1.filter(r => r.isolatedLearned).length;
    summary.h1 = { spread, kept, isolatedLearned: iso, n: h1.length, spreadCI: bootstrapMeanCI(h1.map(r => r.doers >= 2 ? 1 : 0)) };
    md.push(`## H1: social transmission\n`, `| measure | result |\n|---|---|`,
      `| colonies where the practice had 2+ practitioners by day 17 | ${spread}/${h1.length} (${fmt(summary.h1.spreadCI)}) |`,
      `| colonies where the fire was still burning at day 17 | ${kept}/${h1.length} |`,
      `| isolated creatures that acquired the practice | ${iso}/${h1.length} |\n`);
  }
  // ---- H2 ------------------------------------------------------------------------------------------
  const h2 = pick(rs, 'h2');
  if (h2.length) {
    const culture = h2.filter(r => r.culture).length, gone = h2.filter(r => r.foundersGone).length;
    summary.h2 = { culture, foundersGone: gone, n: h2.length, cultureCI: bootstrapMeanCI(h2.map(r => r.culture)) };
    md.push(`## H2: culture outlives its founders (70 days)\n`, `| measure | result |\n|---|---|`,
      `| colonies where every founder had died by day 70 | ${gone}/${h2.length} |`,
      `| ...and the fire was still fed in the last four days by creatures born after the lump appeared | ${culture}/${h2.length} (${fmt(summary.h2.cultureCI)}) |\n`);
  }
  // ---- H3 ------------------------------------------------------------------------------------------
  const h3 = pick(rs, 'h3');
  if (h3.length) {
    const conds = ['control', 'predator', 'targeted'], names = { control: 'no predator', predator: 'predator', targeted: 'targeted predator' };
    const stats = {};
    for (const c of conds) {
      const r = pick(h3, 'h3', c), surv = r.filter(x => !x.extinct);
      const dC = surv.map(x => x.cautionEnd - x.cautionStart), dB = surv.map(x => x.brawnEnd - x.brawnStart);
      stats[c] = { n: r.length, extinct: r.filter(x => x.extinct).length, dCaution: bootstrapMeanCI(dC), dBrawn: bootstrapMeanCI(dB), born: bootstrapMeanCI(col(r, 'born')), byBeast: col(r, 'byBeast').reduce((a, b) => a + b, 0), hunger: col(r, 'hunger').reduce((a, b) => a + b, 0), fireAlive: r.filter(x => x.fireAlive).length, attacks: col(r, 'attacks').reduce((a, b) => a + b, 0), droveOff: col(r, 'droveOff').reduce((a, b) => a + b, 0), shards: col(r, 'shards').reduce((a, b) => a + b, 0), felled: col(r, 'felled').reduce((a, b) => a + b, 0), joined: col(r, 'joined').reduce((a, b) => a + b, 0), _dC: dC };
    }
    const diff = (a, b) => bootstrapDiffCI(stats[a]._dC, stats[b]._dC);
    summary.h3 = { control: { ...stats.control, _dC: undefined }, predator: { ...stats.predator, _dC: undefined }, targeted: { ...stats.targeted, _dC: undefined }, predMinusControl: diff('predator', 'control'), targetedMinusControl: diff('targeted', 'control') };
    md.push(`## H3: does the predator select for caution? (120 days)\n`, `| | ${conds.map(c => names[c]).join(' | ')} |\n|---|${conds.map(() => '---').join('|')}|`,
      `| change in mean caution, founders to survivors | ${conds.map(c => fmt(stats[c].dCaution)).join(' | ')} |`,
      `| change in mean brawn | ${conds.map(c => fmt(stats[c].dBrawn)).join(' | ')} |`,
      `| births per colony | ${conds.map(c => fmt(stats[c].born)).join(' | ')} |`,
      `| colonies extinct by day 120 | ${conds.map(c => stats[c].extinct + '/' + stats[c].n).join(' | ')} |`,
      `| killed by the predator (all colonies) | ${conds.map(c => stats[c].byBeast).join(' | ')} |`,
      `| hunger deaths (all colonies) | ${conds.map(c => stats[c].hunger).join(' | ')} |`,
      `| predator attacks / driven off | ${conds.map(c => stats[c].attacks + ' / ' + stats[c].droveOff).join(' | ')} |`,
      `| shards struck / trees felled / tools joined | ${conds.map(c => [stats[c].shards, stats[c].felled, stats[c].joined].join(' / ')).join(' | ')} |`,
      ``, `Difference in caution change, predator minus control: **${fmt(summary.h3.predMinusControl)}**. Targeted predator minus control: **${fmt(summary.h3.targetedMinusControl)}**.\n`);
    // mechanism: per-individual caution vs offspring, within predator colonies
    for (const c of ['predator', 'targeted', 'control']) {
      const rows = pick(h3, 'h3', c).flatMap(r => r.rows);
      const rho = spearman(rows.map(r => r.caution), rows.map(r => r.offspring));
      const cautious = rows.filter(r => r.caution >= 0.6), bold = rows.filter(r => r.caution < 0.4);
      const share = (arr, k) => arr.length ? arr.reduce((a, r) => a + r[k], 0) / arr.length : NaN;
      summary.h3[c].mechanism = { individuals: rows.length, rhoCautionOffspring: rho, cautiousN: cautious.length, boldN: bold.length,
        cautiousOffspring: share(cautious, 'offspring'), boldOffspring: share(bold, 'offspring'), cautiousFlee: share(cautious, 'flee'), boldFlee: share(bold, 'flee'), cautiousRestClosed: share(cautious, 'restClosed'), boldRestClosed: share(bold, 'restClosed'), cautiousEat: share(cautious, 'eat'), boldEat: share(bold, 'eat') };
      const m = summary.h3[c].mechanism;
      md.push(`### H3a mechanism, ${names[c]} colonies (${rows.length} individuals who lived 16+ days)\n`,
        `Spearman rho, caution vs offspring: **${fmt(rho)}**.\n`, `| | cautious (≥0.6, n=${cautious.length}) | bold (<0.4, n=${bold.length}) |\n|---|---|---|`,
        `| offspring per individual | ${m.cautiousOffspring.toFixed(2)} | ${m.boldOffspring.toFixed(2)} |`,
        `| share of night ticks fleeing | ${(m.cautiousFlee * 100).toFixed(1)}% | ${(m.boldFlee * 100).toFixed(1)}% |`,
        `| share of night ticks resting somewhere closed | ${(m.cautiousRestClosed * 100).toFixed(1)}% | ${(m.boldRestClosed * 100).toFixed(1)}% |`,
        `| share of night ticks eating | ${(m.cautiousEat * 100).toFixed(1)}% | ${(m.boldEat * 100).toFixed(1)}% |\n`);
    }
    fs.writeFileSync(path.join(OUT, 'fig-h3-caution.svg'), dotCI({ title: 'Change in mean caution, founders to day-120 survivors', unit: 'caution (0 to 1.6)', rows: conds.map(c => ({ label: names[c], ci: stats[c].dCaution })) }));
    fs.writeFileSync(path.join(OUT, 'fig-h3-births.svg'), dotCI({ title: 'Births per colony over 120 days', unit: 'births', rows: conds.map(c => ({ label: names[c], ci: stats[c].born })) }));
    const mp = summary.h3.predator.mechanism;
    fs.writeFileSync(path.join(OUT, 'fig-h3a-nights.svg'), bars({ title: 'Nights in predator colonies: cautious versus bold', unit: 'share of night ticks', groups: ['fleeing', 'resting somewhere closed', 'eating'], series: [{ name: 'cautious (≥0.6)', values: [mp.cautiousFlee, mp.cautiousRestClosed, mp.cautiousEat] }, { name: 'bold (<0.4)', values: [mp.boldFlee, mp.boldRestClosed, mp.boldEat] }], pct: true }));
  }
  // ---- ablations -------------------------------------------------------------------------------
  const ab = pick(rs, 'ablation');
  if (ab.length) {
    const conds = ['baseline', 'noWatch', 'wipeDaily', 'noBreed'], names = { baseline: 'unchanged', noWatch: 'no learning by watching', wipeDaily: 'memory wiped every dawn', noBreed: 'no children' };
    summary.ablations = {};
    md.push(`## Ablations (predator present, 50 days)\n`, `| | ${conds.map(c => names[c]).join(' | ')} |\n|---|${conds.map(() => '---').join('|')}|`);
    for (const c of conds) { const r = pick(ab, 'ablation', c); summary.ablations[c] = { n: r.length, extinct: r.filter(x => x.extinct).length, fireAlive: r.filter(x => x.fireAlive).length, alive: bootstrapMeanCI(col(r, 'alive')), hunger: col(r, 'hunger').reduce((a, b) => a + b, 0), shards: col(r, 'shards').reduce((a, b) => a + b, 0) }; }
    md.push(`| colonies extinct by day 50 | ${conds.map(c => summary.ablations[c].extinct + '/' + summary.ablations[c].n).join(' | ')} |`,
      `| fire still burning at day 50 | ${conds.map(c => summary.ablations[c].fireAlive + '/' + summary.ablations[c].n).join(' | ')} |`,
      `| creatures alive at day 50 | ${conds.map(c => fmt(summary.ablations[c].alive)).join(' | ')} |`,
      `| hunger deaths (all colonies) | ${conds.map(c => summary.ablations[c].hunger).join(' | ')} |\n`);
  }
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(OUT, 'RESULTS.md'), md.join('\n'));
  console.log(md.join('\n'));
}
