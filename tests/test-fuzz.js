// test-fuzz.js — a chaotic Keeper hammers the world with every kind of act,
// including drops on heads, flings onto things, quakes and claims. Nothing may
// throw, no number may go bad, and render, recap, goals and voices must all cope.
import assert from 'node:assert/strict';
import { createWorld, tick, applyAction, replay, stateHash, goalStates, GOALS } from '../src/sim/index.js';
import { renderState } from '../src/render/render.js';
import { buildRecap } from '../src/sim/recap.js';
import { voiceLine } from '../src/ui/voice.js';
import { newSave, appendAction, serializeSave, parseSave } from '../src/ui/save.js';
import { rngFor, pick } from '../src/sim/rng.js';
import { ALL_SLOTS, ZONE_IDS } from '../src/sim/geometry.js';
import { giftOptions, BLESS_TRAITS, CURIOS } from '../src/sim/actions.js';
import { section, ok } from './lib.js';

function chaos(world, r) {
  const live = world.wobblins.filter(w => w.alive);
  const any = () => (live.length ? pick(r, live).id : 'w1');
  const objs = world.objects.filter(o => !o.state.gone);
  const thing = () => (objs.length ? pick(r, objs).id : 'o1');
  const kinds = [
    () => ({ type: 'power', power: 'stone', slot: pick(r, ALL_SLOTS), variant: r() < 0.3 ? 'boulder' : 'stones', ...(r() < 0.4 ? { onto: any() } : {}) }),
    () => ({ type: 'power', power: 'stone', variant: 'stones', onto: any() }),
    () => ({ type: 'power', power: 'plant', slot: pick(r, ALL_SLOTS), variant: r() < 0.5 ? 'tree' : 'bush', ...(r() < 0.4 ? { onto: any() } : {}) }),
    () => ({ type: 'power', power: 'plant', variant: 'bush', onto: any() }),
    () => ({ type: 'power', power: 'rain' }),
    () => ({ type: 'power', power: 'lightning', slot: pick(r, ALL_SLOTS), ...(r() < 0.4 ? { onto: any() } : {}) }),
    () => ({ type: 'power', power: 'water', slot: 'riverbank.' + (1 + Math.floor(r() * 6)) }),
    () => ({ type: 'power', power: 'season', variant: r() < 0.5 ? 'cold' : 'warm' }),
    () => ({ type: 'power', power: 'quake' }),
    () => ({ type: 'nudge', nudge: 'bless', target: any(), trait: pick(r, BLESS_TRAITS) }),
    () => ({ type: 'nudge', nudge: 'curio', curio: pick(r, Object.keys(CURIOS)), targets: [any(), any()] }),
    () => ({ type: 'nudge', nudge: 'miracle' }),
    () => ({ type: 'nudge', nudge: 'carry', target: any(), zone: pick(r, ZONE_IDS), ...(r() < 0.5 ? { thrown: true } : {}), ...(r() < 0.5 ? { onto: r() < 0.5 ? any() : thing() } : {}), ...(r() < 0.2 ? { cradled: true } : r() < 0.2 ? { shaken: true } : {}), ...(r() < 0.2 ? { zone: 'riverbank', splash: true } : {}) }),
    () => ({ type: 'nudge', nudge: 'rename', target: any(), name: pick(r, ['Bo', 'Pip', 'Sir Wob', "O'Dell", 'Mo-Mo']) }),
    () => { const day = 20000 + Math.floor(world.tick / 24); return { type: 'gift', day, giftId: pick(r, giftOptions(world.seed, day)), ...(r() < 0.5 ? { onto: any() } : {}) }; },
    () => ({ type: 'nudge', nudge: 'move', target: thing(), slot: pick(r, ALL_SLOTS) }),
    () => ({ type: 'collect_offerings' }),
    () => ({ type: 'claim', goal: pick(r, GOALS).id })
  ];
  return pick(r, kinds)();
}

const bad = v => typeof v === 'number' && !Number.isFinite(v);
function checkNumbers(world) {
  for (const w of world.wobblins) {
    for (const [k, v] of Object.entries(w.needs)) assert.ok(!bad(v) && v >= 0 && v <= 1, `${w.id} need ${k}=${v}`);
    for (const [k, v] of Object.entries(w.traits)) assert.ok(!bad(v) && v >= 0 && v <= 1, `${w.id} trait ${k}=${v}`);
    assert.ok(!bad(w.faith) && w.faith >= -1 && w.faith <= 1, `${w.id} faith ${w.faith}`);
    for (const v of Object.values(w.bonds || {})) assert.ok(!bad(v) && v >= -1 && v <= 1);
    assert.ok(w.injuries >= 0);
  }
  assert.ok(!bad(world.belief) && world.belief >= 0);
}

section('A chaotic Keeper');
{
  let acts = 0, okActs = 0, seeds = 0;
  for (let seed = 1; seed <= 16; seed++) {
    const save = newSave({ seed, createdAt: 0, progression: seed % 2 === 0 });
    const w = createWorld(seed, save);
    const r = rngFor(seed, 'fuzz');
    for (let t = 0; t < 360; t++) {
      const n = Math.floor(r() * 4);
      for (let i = 0; i < n; i++) {
        acts++;
        if (applyAction(w, appendAction(save, w.tick, chaos(w, r))).ok) okActs++;
        else save.actions.pop();
      }
      tick(w);
      if (t % 30 === 0) {
        checkNumbers(w);
        const rs = renderState(w);
        assert.ok(rs.wobblins.every(x => Number.isFinite(x.x) && Number.isFinite(x.y)));
        buildRecap(w, Math.max(0, w.tick - 12), w.tick);
        for (const x of w.wobblins.filter(x => x.alive)) assert.equal(typeof voiceLine(w, x), 'string');
        goalStates(w);
      }
    }
    checkNumbers(w);
    assert.equal(stateHash(replay(parseSave(serializeSave(save)), 360)), stateHash(w), 'seed ' + seed + ' replays');
    seeds++;
  }
  ok(`${seeds} colonies x 360 days, ${acts} chaotic acts (${okActs} valid): no crashes, no bad numbers, render/recap/voices/goals fine, every save replays`);
}

console.log('\ntest-fuzz: all passed');
