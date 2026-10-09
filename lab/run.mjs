// lab/run.mjs — the fire-keeping scenario and Astra's four tests.
//   node lab/run.mjs [seed]
// A glowing lump appears on day 3. Can anyone learn to keep it alive? Does the
// practice spread by watching, and outlive the one who found it?
import { newColony, run, step, keeperPlace, clone, fireReport, fireStory } from './sim.js';
import { beliefs } from './creature.js';

const seed = Number(process.argv[2] || 1);
const SEEDS = process.argv[2] ? [seed] : [1, 2, 3, 4, 5, 6, 7, 8];
const DAYS = 14;

function scenario(seed, { isolate = null, forget = null, forgetAt = 0 } = {}) {
  const w = newColony(seed, 6);
  run(w, 48);
  keeperPlace(w, 'ember', 9, 5, { fuel: 120 });
  for (let t = 0; t < DAYS * 24; t++) {
    if (isolate && w.tick % 24 === 0) { const c = w.creatures.find(k => k.id === isolate); if (c) { c.x = 16; c.y = 1; } }   // kept on the far rise, out of sight
    if (forget && w.tick === forgetAt) { const c = w.creatures.find(k => k.id === forget); if (c) { c.exp.clear(); c.episodes = []; c.plan = null; } }
    step(w);
    if (isolate) { const c = w.creatures.find(k => k.id === isolate); if (c && (Math.abs(c.x - 9) < 6)) { c.x = 16; c.y = 1; } }
  }
  return w;
}

let kept = 0, spread = 0, survived = 0;
for (const s of SEEDS) {
  const w = scenario(s);
  const rep = fireReport(w);
  if (rep.alive) kept++;
  if (rep.doers.length >= 2) spread++;
  // Did the practice outlive the discoverer? Branch: remove the first feeder, run 5 more days.
  let outlived = false;
  if (rep.first) {
    const b = clone(w);
    const d = b.creatures.find(c => c.id === rep.first); if (d) d.alive = false;
    const before = b.events.length;
    run(b, 5 * 24);
    outlived = b.events.slice(before).some(e => e.kind === 'fed_fire' && e.who && e.who !== rep.first) && fireReport(b).alive;
    if (outlived) survived++;
  }
  console.log(`seed ${s}: fire ${rep.alive ? 'alive' : 'out'} (fuel ${rep.fuel}), ${rep.feeds} feeds by ${JSON.stringify(rep.byWho)}, first ${rep.first}, doers ${rep.doers.join(',')}, knowers ${rep.knowers.join(',')}, living ${rep.living}/6, outlived discoverer: ${outlived}`);
  if (SEEDS.length === 1) {
    console.log(fireStory(w).join('\n'));
    for (const c of w.creatures) console.log(c.id, c.alive ? 'alive' : 'dead', JSON.stringify(c.genome, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v), '\n  ', beliefs(c, 4).map(b => `${b.key} v${b.value} n${b.n}${b.seen ? ' seen' + b.seen : ''} ${JSON.stringify(b.outcomes)}`).join('\n   '));
  }
}
console.log(`\n${SEEDS.length} colonies: fire kept to day ${DAYS + 2} in ${kept}, practice spread to 2+ doers in ${spread}, outlived the discoverer in ${survived}`);

// Scenario B: no glowing lump at all. Does anyone make fire from sparks?
{
  let made = 0, kept = 0;
  for (const s of SEEDS) {
    const w = newColony(s, 6);
    run(w, 24 * 20);
    const first = w.events.find(e => e.kind === 'made_fire');
    if (first) made++;
    const rep = fireReport(w);
    if (rep.alive) kept++;
    if (SEEDS.length === 1) console.log('B:', first ? `${first.who} made fire on day ${Math.floor(first.t / 24) + 1} with ${first.material}` : 'nobody made fire', '| feeds', rep.feeds, '| alive at day 20:', rep.alive);
  }
  console.log(`Scenario B (no ember given), 20 days: fire made from sparks in ${made}/${SEEDS.length}, still burning at day 20 in ${kept}`);
}

// Scenario C: scarce ground food, fruit up high on tall bushes, stones about. Does anyone stack a step and reach it?
{
  let reached = 0, builders = 0;
  for (const s of SEEDS) {
    const w = newColony(s, 6, { berries: 8, tallbushes: 3 });
    run(w, 24 * 20);
    const high = w.events.filter(e => e.kind === 'ate' && e.high);
    if (high.length) reached++;
    const onBuilt = high.filter(e => e.built);
    if (onBuilt.length) builders++;

    if (SEEDS.length === 1) console.log('C:', high.length ? `${high.length} high fruits eaten (${onBuilt.length} from a step someone built), first by ${high[0].who} on day ${Math.floor(high[0].t / 24) + 1}` : 'nobody reached the high fruit', '| living', w.creatures.filter(c => c.alive).length);
  }
  console.log(`Scenario C (fruit up high), 20 days: someone reached it in ${reached}/${SEEDS.length}, standing on a step a creature had built in ${builders}/${SEEDS.length}`);
}

// Scenario D: generations. Founders die of old age around day 60. Is the fire still fed on day 70, by creatures who never met the Keeper's lump?
{
  let culture = 0, pops = [];
  for (const s of SEEDS) {
    const w = newColony(s, 6);
    run(w, 48);
    keeperPlace(w, 'ember', 9, 5, { fuel: 120 });
    run(w, 70 * 24 - 48);
    const founders = w.creatures.slice(0, 6);
    const allGone = founders.every(c => !c.alive);
    const lateFeeds = w.events.filter(e => e.kind === 'fed_fire' && e.who && e.t > 66 * 24 && !founders.some(f => f.id === e.who));
    const rep = fireReport(w);
    pops.push(rep.living);
    if (allGone && rep.alive && lateFeeds.length) culture++;
    if (SEEDS.length === 1) console.log('D:', `founders all dead: ${allGone}, fire alive: ${rep.alive}, feeds by later generations in the last 4 days: ${lateFeeds.length}, living: ${rep.living}, born: ${w.events.filter(e => e.kind === 'born').length}`);
  }
  console.log(`Scenario D (generations), 70 days: the fire outlived every founder and was fed by their descendants in ${culture}/${SEEDS.length}; populations ${pops.join(',')}`);
}

// Scenario E: cover. 40 days of ordinary life: does anyone build a roof and sleep under it?
{
  let roofs = 0, slept = 0, beckons = 0;
  for (const s of SEEDS) {
    const w = newColony(s, 6);
    run(w, 40 * 24);
    const sheltered = w.events.filter(e => e.kind === 'acted' && e.outcome === 'sheltered');
    const anyCover = w.cells.some(c => { const here = w.objects.filter(o => !o.gone && !o.held && o.x === c.x && o.y === c.y); return here.some(o => o.kind === 'log') && here.filter(o => (o.kind === 'stone' || o.kind === 'log')).length >= 3; });
    if (anyCover) roofs++;
    if (sheltered.length) slept++;
    beckons += w.events.filter(e => e.kind === 'beckoned').length;
    if (SEEDS.length === 1) console.log('E:', `cover somewhere: ${anyCover}, sheltered rests: ${sheltered.length}, beckons: ${w.events.filter(e => e.kind === 'beckoned').length}`);
  }
  console.log(`Scenario E (cover), 40 days: a roof stood somewhere in ${roofs}/${SEEDS.length}, someone slept under one in ${slept}/${SEEDS.length}; ${beckons} beckons in all`);
}

// Test 1: memory matters. Wipe the first feeder's memory mid-run; it should feed less afterwards than its unwiped twin.
{
  let worse = 0, tried = 0;
  for (const s of SEEDS) {
    const w = scenario(s); const rep = fireReport(w); if (!rep.first) continue;
    tried++;
    const t0 = w.events.find(e => e.kind === 'fed_fire' && e.who === rep.first).t + 24;
    const a = scenario(s), b = scenario(s, { forget: rep.first, forgetAt: t0 });
    const feedsAfter = (x) => x.events.filter(e => e.kind === 'fed_fire' && e.who === rep.first && e.t > t0).length;
    if (feedsAfter(b) < feedsAfter(a)) worse++;
    if (SEEDS.length === 1) console.log(`T1 seed ${s}: ${rep.first} fed ${feedsAfter(a)} times after day ${Math.floor(t0 / 24) + 1} with memory, ${feedsAfter(b)} without`);
  }
  console.log(`T1 memory matters: wiping the discoverer's memory cut its later feeding in ${worse}/${tried}`);
}
// Test 2: knowledge spreads only by contact. Keep c2 far away: it should never learn feeding.
{
  let clean = 0;
  for (const s of SEEDS) { const w = scenario(s, { isolate: 'c2' }); const c = w.creatures.find(k => k.id === 'c2'); if (!fireReport(w).knowers.includes('c2')) clean++; }
  console.log(`T2 contact only: an isolated creature never learned feeding in ${clean}/${SEEDS.length}`);
}
// Test 3: histories diverge. Same genome, different lives -> different top beliefs.
{
  let differ = 0;
  for (const s of SEEDS) {
    const w = scenario(s);
    const [a, b] = w.creatures;
    b.genome = { ...a.genome };   // only for the comparison; what they learned already differs
    const ta = beliefs(a, 3).map(x => x.key).join(';'), tb = beliefs(b, 3).map(x => x.key).join(';');
    if (ta !== tb) differ++;
  }
  console.log(`T3 divergence: two creatures' top beliefs differed in ${differ}/${SEEDS.length}`);
}
