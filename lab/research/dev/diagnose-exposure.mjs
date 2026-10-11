// Development-stage diagnostic (seeds 101-116 only): why the exposure predator produced no selection on caution.
import { newColony, run, keeperPlace } from '../../sim.js';
const rows = { none: [], exposure: [] };
for (const s of Array.from({ length: 16 }, (_, i) => 101 + i)) for (const [k, o] of [['none', { threat: false }], ['exposure', { threat: true, threatMode: 'exposure', exposureChance: 0.02 }]]) {
  const w = newColony(s, 6, o); run(w, 48); keeperPlace(w, 'ember', 9, 5, { fuel: 120 }); run(w, 120 * 24 - 48);
  const died = {}; for (const e of w.events) if (e.kind === 'died') died[e.who] = e;
  for (const c of w.creatures) if (c.born <= 60 * 24) rows[k].push({ caution: c.genome.caution, off: c.offspring, beast: died[c.id] && died[c.id].cause === 'the beast' ? 1 : 0, age: ((died[c.id] ? died[c.id].t : w.tick) - c.born) / 24, exposed: c.night.ticks ? c.night.exposed / c.night.ticks : 0, ate: c.night.ticks ? c.night.ate / c.night.ticks : 0, sociability: c.genome.sociability });
}
for (const k of Object.keys(rows)) {
  const r = rows[k], q = (lo, hi) => r.filter(x => x.caution >= lo && x.caution < hi);
  for (const [lab, g] of [['bold <0.4', q(0, 0.4)], ['mid', q(0.4, 0.6)], ['cautious >=0.6', q(0.6, 9)]]) {
    const m = f => (g.reduce((a, x) => a + f(x), 0) / g.length).toFixed(3);
    console.log(k.padEnd(9), lab.padEnd(15), 'n', String(g.length).padStart(4), 'offspring', m(x => x.off), 'killedByBeast', m(x => x.beast), 'ageDays', m(x => x.age), 'exposedShare', m(x => x.exposed), 'nightEat', m(x => x.ate));
  }
}
