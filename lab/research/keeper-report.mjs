// lab/research/keeper-report.mjs — tables from the Keeper runs in results/keeper/.
//   node lab/research/keeper-report.mjs
// Reads every per-run JSON, groups by Keeper, and writes results/keeper/KEEPER.md with
// outcomes per Keeper plus every model decision that changed the world, with its reason.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootstrapMeanCI, fmt } from './stats.js';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'results', 'keeper');
const runs = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !f.startsWith('summary')).map(f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')));
const PRICE = { 'claude-opus-5-5': [4, 20], 'claude-sonnet-5-5': [2, 10], 'claude-haiku-4-5': [1, 5] };
// Cost of one run from the tokens its own decisions used (the harness's running total spans runs).
function runCost(r) { const p = PRICE[r.summary.keeper.replace('model:', '')]; if (!p) return 0; let c = 0; for (const l of r.log) if (l.decision && l.decision.usage) c += (l.decision.usage.in * p[0] + l.decision.usage.out * p[1]) / 1e6; return c; }
const byKeeper = {};
for (const r of runs) (byKeeper[r.summary.keeper] ||= []).push(r);
const order = Object.keys(byKeeper).sort((a, b) => (a.startsWith('model') ? 0 : 1) - (b.startsWith('model') ? 0 : 1) || a.localeCompare(b));
const md = [`# The Keeper study (H4, exploratory)\n`, `Each Keeper saw the colony every 3 days for 120 days and could intervene up to 12 times. Seeds are identical across Keepers. Intervals are 95% bootstrap CIs over seeds (small N; read as rough).\n`];
md.push(`| Keeper | seeds | alive at day 120 | died | hunger deaths | killed by predator | fire burning at the end | interventions used | tries past budget | unparseable replies | cost |`);
md.push(`|---|---|---|---|---|---|---|---|---|---|---|`);
for (const k of order) {
  const rs = byKeeper[k].map(r => r.summary);
  const m = key => fmt(bootstrapMeanCI(rs.map(r => r[key])), 1);
  md.push(`| ${k} | ${rs.length} | ${m('alive')} | ${m('died')} | ${m('hunger')} | ${m('byBeast')} | ${rs.filter(r => r.fireAlive).length}/${rs.length} | ${m('interventions')} | ${rs.reduce((a, r) => a + r.overBudgetAttempts, 0)} | ${byKeeper[k].reduce((a, r) => a + r.log.filter(l => l.decision && l.decision.unparseable).length, 0)} | ${byKeeper[k].reduce((a, r) => a + runCost(r), 0).toFixed(2)} |`);
}
md.push('');
for (const k of order) {
  if (!k.startsWith('model')) continue;
  md.push(`## What ${k} did\n`);
  for (const r of byKeeper[k].sort((a, b) => a.summary.seed - b.summary.seed)) {
    const acts = r.log.filter(l => l.decision && l.decision.action !== 'wait');
    md.push(`### seed ${r.summary.seed}: ${r.summary.alive} alive at the end, ${r.summary.died} died, fire ${r.summary.fireAlive ? 'burning' : 'out'}, ${r.summary.interventions} interventions\n`);
    for (const l of acts) md.push(`- **Day ${l.day}: ${l.decision.action}${l.decision.material ? ' ' + l.decision.material : ''}${Number.isInteger(l.decision.x) ? ` at (${l.decision.x},${l.decision.y})` : ''}** (${l.applied}). ${l.decision.reason}${l.decision.worry ? ` *Worry:* ${l.decision.worry}` : ''}`);
    const last = r.log.filter(l => l.decision).slice(-1)[0];
    if (last) md.push(`- *Last word (day ${last.day}):* ${last.decision.assessment || ''} ${last.decision.reason}`);
    md.push('');
  }
}
fs.writeFileSync(path.join(DIR, 'KEEPER.md'), md.join('\n'));
console.log(md.slice(0, 4 + order.length).join('\n'));
