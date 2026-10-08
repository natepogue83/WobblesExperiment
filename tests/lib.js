// lib.js — shared fixtures for node tests.
import { rngFor, pick, randInt } from '../src/sim/rng.js';
import { ALL_SLOTS } from '../src/sim/geometry.js';
import { giftOptions, BLESS_TRAITS, CURIOS } from '../src/sim/actions.js';

// A deterministic "busy player": proposes one or two actions on some ticks.
// Some will be invalid (cooldowns, occupied slots), which is on purpose:
// replay must ignore exactly what live play ignored.
export function proposeActions(world, scriptSeed) {
  const r = rngFor(scriptSeed, 'script', world.tick);
  const out = [];
  if (r() < 0.25) {
    const kind = pick(r, ['stone', 'stone', 'plant', 'plant', 'rain', 'bless', 'gift', 'collect',
      'lightning', 'water', 'season', 'curio', 'miracle']);
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
    else out.push({ type: 'collect_offerings' });
  }
  return out;
}

export function timeIt(fn) {
  const t0 = process.hrtime.bigint();
  const v = fn();
  return { v, ms: Number(process.hrtime.bigint() - t0) / 1e6 };
}

export function section(name) { console.log('\n# ' + name); }
export function ok(msg) { console.log('  ok  ' + msg); }
