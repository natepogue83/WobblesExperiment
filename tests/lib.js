// lib.js — shared fixtures for node tests.
import { rngFor, pick, randInt } from '../src/sim/rng.js';
import { ALL_SLOTS, ADJACENT } from '../src/sim/geometry.js';
import { giftOptions, BLESS_TRAITS, CURIOS, applyAction } from '../src/sim/actions.js';
import { tick } from '../src/sim/tick.js';

// A deterministic "busy player": proposes one or two actions on some ticks.
// Some will be invalid (cooldowns, occupied slots), which is on purpose:
// replay must ignore exactly what live play ignored.
export function proposeActions(world, scriptSeed) {
  const r = rngFor(scriptSeed, 'script', world.tick);
  const out = [];
  if (r() < 0.25) {
    const kind = pick(r, ['stone', 'stone', 'plant', 'plant', 'rain', 'bless', 'gift', 'collect',
      'lightning', 'water', 'season', 'curio', 'miracle', 'carry', 'carry', 'quake']);
    const slot = pick(r, ALL_SLOTS);
    if (kind === 'stone') out.push({ type: 'power', power: 'stone', slot, variant: r() < 0.3 ? 'boulder' : 'stones' });
    else if (kind === 'plant') out.push({ type: 'power', power: 'plant', slot, variant: r() < 0.5 ? 'tree' : 'bush' });
    else if (kind === 'rain') out.push({ type: 'power', power: 'rain' });
    else if (kind === 'bless') {
      const live = world.wobblins.filter(w => w.alive);
      out.push({ type: 'nudge', nudge: 'bless', target: live.length ? pick(r, live).id : 'w99', trait: pick(r, BLESS_TRAITS) });
    } else if (kind === 'gift') {
      const day = 20000 + Math.floor(world.tick / 24) + randInt(r, 0, 1);
      out.push({ type: 'gift', day, giftId: pick(r, giftOptions(world.seed, day)) });
    } else if (kind === 'lightning') out.push({ type: 'power', power: 'lightning', slot });
    else if (kind === 'water') out.push({ type: 'power', power: 'water', slot: 'riverbank.' + randInt(r, 1, 5) });
    else if (kind === 'season') out.push({ type: 'power', power: 'season', variant: r() < 0.5 ? 'cold' : 'warm' });
    else if (kind === 'curio') {
      const live = world.wobblins.filter(w => w.alive);
      out.push({ type: 'nudge', nudge: 'curio', curio: pick(r, Object.keys(CURIOS)),
        targets: live.length >= 2 ? [live[0].id, live[live.length - 1].id] : ['w1', 'w2'] });
    } else if (kind === 'miracle') out.push({ type: 'nudge', nudge: 'miracle' });
    else if (kind === 'quake') out.push({ type: 'power', power: 'quake' });
    else if (kind === 'carry') out.push({ type: 'nudge', nudge: 'carry', target: 'w' + randInt(r, 1, 6), zone: pick(r, ['hill', 'grove', 'meadow', 'hollow', 'pondsite', 'riverbank']) });
    else out.push({ type: 'collect_offerings' });
  }
  return out;
}

// A "generous player": every power on cooldown with sensible targets, daily
// gifts, periodic blessings and curios, offerings collected, miracles when
// affordable. Returns proposed actions (without seq/t) for the current tick.
export function generousActions(world, scriptSeed = 1) {
  const t = world.tick;
  const r = rngFor(scriptSeed, 'generous', t);
  const ready = k => world.cooldowns[k] <= t;
  const free = zones => zones.flatMap(z => slotIdsOf(z)).filter(s => !occupied(world, s));
  const live = world.wobblins.filter(w => w.alive);
  const crowd = live.length ? mostCommon(live.map(w => w.zone)) : 'meadow';
  const out = [];
  if (ready('stone')) {
    const s = free([pick(r, ['hollow', 'hill', 'meadow', crowd])]);
    if (s.length) out.push({ type: 'power', power: 'stone', slot: s[0], variant: r() < 0.25 ? 'boulder' : 'stones' });
  }
  if (ready('plant')) {
    const s = free([pick(r, ['grove', 'meadow', 'hollow', crowd])]);
    if (s.length) out.push({ type: 'power', power: 'plant', slot: s[0], variant: r() < 0.5 ? 'tree' : 'bush' });
  }
  if (t % 24 === 12 && ready('rain')) out.push({ type: 'power', power: 'rain' });
  if (ready('lightning') && t % 16 === 0) {
    const near = [crowd, ...ADJACENT[crowd]].filter(z => z !== 'riverbank' && z !== 'pondsite');
    const burnable = world.objects.filter(o => !o.state.gone && (o.kind === 'tree' || o.kind === 'bush') && near.includes(o.zone));
    const s = r() < 0.5 && burnable.length ? [burnable[0].slot] : free(near);
    if (s.length) out.push({ type: 'power', power: 'lightning', slot: s[0] });
  }
  if (ready('water') && (t === 2 || t % 120 === 60)) {
    out.push({ type: 'power', power: 'water', slot: 'riverbank.' + randInt(r, 1, 5) });
  }
  if (ready('season') && t % 96 === 30 && (world.seasonUses === 0 || world.devotion >= 10)) {
    out.push({ type: 'power', power: 'season', variant: r() < 0.6 ? 'cold' : 'warm' });
  }
  if (ready('bless') && live.length) {
    out.push({ type: 'nudge', nudge: 'bless', target: live[t % live.length].id, trait: BLESS_TRAITS[(t >> 2) % BLESS_TRAITS.length] });
  }
  const curios = Object.keys(CURIOS).filter(c => CURIOS[c].some(k => world.noticed[k] !== undefined));
  if (ready('curio') && curios.length && live.length >= 2) {
    out.push({ type: 'nudge', nudge: 'curio', curio: curios[t % curios.length], targets: [live[t % live.length].id, live[(t + 1) % live.length].id] });
  }
  if (t % 24 === 1) {
    const day = 20000 + Math.floor(t / 24);
    out.push({ type: 'gift', day, giftId: giftOptions(world.seed, day)[t % 3] });
  }
  if (t % 12 === 6 && world.offerings > 0) out.push({ type: 'collect_offerings' });
  if (ready('miracle') && world.devotion >= 30) out.push({ type: 'nudge', nudge: 'miracle' });
  return out;
}

function slotIdsOf(zone) { return ALL_SLOTS.filter(s => s.startsWith(zone + '.')); }
function occupied(world, s) { return world.objects.some(o => !o.state.gone && (o.slot === s || (o.slots && o.slots.includes(s)))); }
function mostCommon(list) {
  const c = {};
  for (const x of list) c[x] = (c[x] || 0) + 1;
  return Object.keys(c).sort().sort((a, b) => c[b] - c[a])[0];
}

// Run a script live: each tick apply its proposed actions, then tick.
export function runScript(world, ticks, propose, onTick) {
  let seq = 0;
  for (let i = 0; i < ticks; i++) {
    for (const a of propose(world)) applyAction(world, { seq: ++seq, t: world.tick, ...a });
    if (onTick) onTick(world);
    tick(world);
  }
  return world;
}

export function timeIt(fn) {
  const t0 = process.hrtime.bigint();
  const v = fn();
  return { v, ms: Number(process.hrtime.bigint() - t0) / 1e6 };
}

export function section(name) { console.log('\n# ' + name); }
export function ok(msg) { console.log('  ok  ' + msg); }
