// test-replay.js — live incremental play equals a fresh replay, hash for hash.
// Also: save size, performance, export/import.
import assert from 'node:assert/strict';
import { createWorld, tick, applyAction, replay, stateHash } from '../src/sim/index.js';
import { newSave, appendAction, exportSave, importSave, serializeSave, parseSave } from '../src/ui/save.js';
import { nowTickFor } from '../src/ui/clock.js';
import { TICK_MS } from '../src/sim/constants.js';
import { proposeActions, section, ok, timeIt } from './lib.js';

// Play live the way the UI does: at each tick, log the action with the current
// t and apply it to the live world immediately; then advance.
function playLive(seed, ticks, scriptSeed, checkpoints) {
  const save = newSave({ seed, createdAt: 0 });
  const live = createWorld(seed);
  const hashes = {};
  for (;;) {
    for (const a of proposeActions(live, scriptSeed)) applyAction(live, appendAction(save, live.tick, a));
    if (checkpoints.includes(live.tick)) hashes[live.tick] = stateHash(live);
    if (live.tick >= ticks) break;
    tick(live);
  }
  return { save, live, hashes };
}

section('Replay equivalence');
{
  const checkpoints = [0, 1, 5, 24, 100, 333, 720];
  let total = 0, rejected = 0;
  for (const seed of [1, 2, 77, 9001, 4242424]) {
    const { save, live, hashes } = playLive(seed, 720, seed * 3 + 1, checkpoints);
    for (const t of checkpoints) assert.equal(stateHash(replay(save, t)), hashes[t], 'seed ' + seed + ' tick ' + t);
    assert.equal(stateHash(replay(JSON.parse(JSON.stringify(save)), 720)), stateHash(live));
    total += save.actions.length;
    const applied = live.events.filter(e => e.causes.some(c => c.action !== undefined)).length;
    rejected += save.actions.length - applied;
  }
  assert.ok(rejected > 0, 'script should include some invalid actions');
  ok('5 seeds x 7 checkpoints: replay(save, t) == live hash (' + total + ' actions, ' + rejected + ' rejected identically)');
}

section('Actions at nowTick are included');
{
  const save = newSave({ seed: 3, createdAt: 0, barren: true });
  appendAction(save, 0, { type: 'power', power: 'stone', slot: 'meadow.2', variant: 'boulder' });
  appendAction(save, 5, { type: 'power', power: 'plant', slot: 'grove.1', variant: 'tree' });
  const w5 = replay(save, 5), w4 = replay(save, 4);
  assert.equal(w5.tick, 5);
  assert.ok(w5.objects.some(o => o.origin.action === 2));
  assert.ok(!w4.objects.some(o => o.origin.action === 2));
  ok('an action logged at t is applied by replay(save, t) and not by replay(save, t-1)');
}

section('Clock');
{
  const save = newSave({ seed: 1, createdAt: 1_000_000 });
  assert.equal(nowTickFor(save, 1_000_000), 0);
  assert.equal(nowTickFor(save, 1_000_000 + TICK_MS - 1), 0);
  assert.equal(nowTickFor(save, 1_000_000 + TICK_MS), 1);
  assert.equal(nowTickFor(save, 1_000_000 + 9 * TICK_MS + 5, 72), 81);
  ok('nowTick = floor((now - createdAt) / TICK_MS) + debug offset');
}

section('Performance and save size');
{
  const save = newSave({ seed: 31337, createdAt: 1760000000000, colonyName: 'Wobble Hollow', keeperName: 'Nate' });
  // 500 actions spread over 2,160 ticks.
  const kinds = [
    t => ({ type: 'power', power: 'stone', slot: 'meadow.' + (1 + t % 6), variant: 'stones' }),
    t => ({ type: 'power', power: 'plant', slot: 'grove.' + (1 + t % 5), variant: 'bush' }),
    () => ({ type: 'power', power: 'rain' }),
    t => ({ type: 'nudge', nudge: 'bless', target: 'w' + (1 + t % 3), trait: 'curiosity' }),
    () => ({ type: 'collect_offerings' })
  ];
  for (let i = 0; i < 500; i++) {
    const t = Math.floor(i * 2160 / 500);
    appendAction(save, t, kinds[i % kinds.length](t));
  }
  replay(save, 2160); // warm up the JIT once, like a page that already ran
  // Best of three, so a busy machine does not fail the build.
  const runs = [0, 1, 2].map(() => timeIt(() => replay(save, 2160)));
  const { v: w, ms } = runs.sort((a, b) => a.ms - b.ms)[0];
  assert.equal(w.tick, 2160);
  assert.ok(ms < 250, 'replay took ' + ms + ' ms');
  ok('2,160 ticks + 500 actions replay in ' + ms.toFixed(1) + ' ms (< 250)');
  const bytes = serializeSave(save).length;
  assert.ok(bytes < 20 * 1024, 'save is ' + bytes + ' bytes');
  ok('save with 500 actions is ' + (bytes / 1024).toFixed(1) + ' KB (< 20)');

  // The scripted live saves include every action kind, so round-trip those too.
  for (const seed of [1, 2]) {
    const { save: s } = playLive(seed, 400, seed, []);
    s.actions.push({ seq: 999, t: 400, type: 'power', power: 'stone', slot: 'meadow.1', variant: 'stones', extra: 1 });
    assert.deepEqual(parseSave(serializeSave(s)), s);
  }
  ok('packed storage form round-trips every action kind, including odd ones');
  const back = importSave(exportSave(save));
  assert.deepEqual(back, save);
  assert.equal(stateHash(replay(back, 2160)), stateHash(w));
  ok('export/import round-trips and replays to the same hash');
  assert.throws(() => importSave(btoa('{"v":2}')));
  ok('import rejects non-saves');
}

console.log('\ntest-replay: all passed');
