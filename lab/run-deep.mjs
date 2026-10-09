// lab/run-deep.mjs — the deeper world: tools, wood, walls and the thing in the dark.
//   node lab/run-deep.mjs [seed]
// Forty days with a prowler that comes some nights. What do they work out?
import { newColony, run, keeperPlace } from './sim.js';
import { walled, covered } from './world.js';

const seed = Number(process.argv[2] || 0);
const SEEDS = seed ? [seed] : [1, 2, 3, 4, 5, 6, 7, 8];
const DAYS = Number(process.env.DAYS || 40);

function count(w, kind, from = 0) { return w.events.filter(e => e.kind === kind && e.t >= from).length; }
// What share of creature-nights were spent somewhere a beast cannot reach (by a fire, in walls, in a crowd)?
function protectedNights(w, log) { const n = log.filter(l => l.night); return n.length ? n.filter(l => l.safe).length / n.length : 0; }

const tot = { shards: 0, felled: 0, joined: 0, split: 0, visits: 0, attacks: 0, drove: 0, walls: 0, roofs: 0, learned: 0, survived: 0 };
for (const s of SEEDS) {
  const w = newColony(s, 6);
  run(w, 48); keeperPlace(w, 'ember', 9, 5, { fuel: 120 });
  const log = [];
  for (let t = 0; t < DAYS * 24; t++) {
    run(w, 1);
    // sample every creature at 2am: is it somewhere safe?
    if (w.tick % 24 === 2) for (const c of w.creatures) if (c.alive) { const cell = w.cells[c.y * 18 + c.x]; const company = w.creatures.filter(k => k.alive && k !== c && Math.max(Math.abs(k.x - c.x), Math.abs(k.y - c.y)) <= 1).length; log.push({ t: w.tick, night: true, safe: cell.heat > 0 || walled(w, c.x, c.y) || company >= 2 }); }
  }
  const half = 48 + DAYS * 12;
  const early = protectedNights(w, log.filter(l => l.t < half)), late = protectedNights(w, log.filter(l => l.t >= half));
  const wallsBuilt = w.cells.filter(c => !c.water && walled(w, c.x, c.y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => w.objects.some(o => !o.gone && !o.held && o.placedBy && o.x === c.x + dx && o.y === c.y + dy))).length;
  const roofs = w.cells.filter(c => covered(w, c.x, c.y)).length;
  const r = { shards: count(w, 'made_shard'), felled: count(w, 'felled'), joined: count(w, 'joined'), split: count(w, 'split'), visits: count(w, 'prowler_came'), attacks: count(w, 'attacked'), drove: count(w, 'drove_off') };
  const living = w.creatures.filter(c => c.alive).length, died = w.events.filter(e => e.kind === 'died');
  for (const k of Object.keys(r)) tot[k] += r[k];
  if (wallsBuilt) tot.walls++; if (roofs) tot.roofs++; if (late > early + 0.1) tot.learned++; if (living >= 4) tot.survived++;
  console.log(`seed ${s}: shards ${r.shards}, trees felled ${r.felled}, tools joined ${r.joined}, logs split ${r.split} | beast came ${r.visits}x, attacks ${r.attacks}, driven off ${r.drove} | safe nights early ${(early * 100).toFixed(0)}% → late ${(late * 100).toFixed(0)}% | built walls ${wallsBuilt}, roofs ${roofs} | living ${living}, died ${died.length} (${died.map(d => d.cause).join(', ')})`);
  if (SEEDS.length === 1) {
    const tell = e => `day ${Math.floor(e.t / 24) + 1}: ${e.kind}${e.who ? ' by ' + e.who : ''}${e.material ? ' with ' + e.material : ''}`;
    for (const e of w.events.filter(e => ['made_shard', 'felled', 'joined', 'split', 'prowler_came', 'attacked', 'drove_off', 'died'].includes(e.kind)).slice(0, 60)) console.log('  ' + tell(e));
  }
}
console.log(`\n${SEEDS.length} colonies, ${DAYS} days: shards ${tot.shards}, trees felled ${tot.felled}, tools joined ${tot.joined}, logs split ${tot.split}; beast visits ${tot.visits}, attacks ${tot.attacks}, driven off ${tot.drove}; safer nights later in ${tot.learned}, walls built in ${tot.walls}, roofs in ${tot.roofs}, 4+ alive at the end in ${tot.survived}`);
