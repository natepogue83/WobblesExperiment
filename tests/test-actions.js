// test-actions.js — validation rejects cleanly; actions never add knowledge.
import assert from 'node:assert/strict';
import { createWorld, tick, applyAction, stateHash, giftOptions } from '../src/sim/index.js';
import { stableStringify } from '../src/sim/util.js';
import { section, ok } from './lib.js';

function rejects(world, action, reason) {
  const before = stateHash(world), nEvents = world.events.length;
  const res = applyAction(world, action);
  assert.equal(res.ok, false, JSON.stringify(action) + ' should be rejected');
  if (reason) assert.equal(res.reason, reason);
  assert.equal(world.events.length, nEvents, 'rejected action emitted events');
  assert.equal(stateHash(world), before, 'rejected action changed state');
}

function knowledge(world) {
  return stableStringify({ d: world.discoveries, k: world.wobblins.map(w => [w.id, w.knows]) });
}

section('Validation');
{
  const w = createWorld(11, { barren: true });
  const stone = { seq: 1, t: 0, type: 'power', power: 'stone', slot: 'meadow.1', variant: 'stones' };
  assert.equal(applyAction(w, stone).ok, true);
  rejects(w, { ...stone, seq: 2, slot: 'meadow.3' }, 'cooldown');
  tick(w); tick(w);
  rejects(w, { ...stone, seq: 3, t: 2, slot: 'meadow.1' }, 'occupied');
  rejects(w, { ...stone, seq: 4, t: 2, slot: 'meadow.99' }, 'slot');
  rejects(w, { ...stone, seq: 5, t: 2, slot: 'nowhere.1' }, 'slot');
  rejects(w, { ...stone, seq: 6, t: 2, variant: 'pebble', slot: 'meadow.2' }, 'variant');
  rejects(w, { ...stone, seq: 7, t: 5, slot: 'meadow.2' }, 'wrong_tick');
  rejects(w, { seq: 8, t: 2, type: 'power', power: 'plant', slot: 'riverbank.1', variant: 'tree' }, 'slot');
  rejects(w, { seq: 9, t: 2, type: 'power', power: 'teleport' }, 'unknown_power');
  rejects(w, { seq: 10, t: 2, type: 'nudge', nudge: 'bless', target: 'w99', trait: 'curiosity' }, 'target');
  rejects(w, { seq: 11, t: 2, type: 'nudge', nudge: 'bless', target: 'w1', trait: 'piety' }, 'trait');
  rejects(w, { seq: 12, t: 2, type: 'collect_offerings' }, 'nothing');
  rejects(w, { seq: 13, t: 2, type: 'dance' }, 'unknown_type');
  ok('cooldown, occupied, bad slot, bad variant, wrong tick, unknown, bad target and empty collect are rejected with no events and no state change');

  const day = 20369, [g1, g2] = giftOptions(w.seed, day);
  rejects(w, { seq: 14, t: 2, type: 'gift', day, giftId: 'not_a_gift' }, 'gift_option');
  assert.equal(applyAction(w, { seq: 15, t: 2, type: 'gift', day, giftId: g1 }).ok, true);
  rejects(w, { seq: 16, t: 2, type: 'gift', day, giftId: g2 }, 'gift_used');
  assert.equal(applyAction(w, { seq: 17, t: 2, type: 'gift', day: day + 1, giftId: giftOptions(w.seed, day + 1)[0] }).ok, true);
  ok('gift: one per day, only from that day\'s 3 seeded options');

  const boulder = { seq: 18, t: 2, type: 'power', power: 'stone', slot: 'hill.1', variant: 'boulder' };
  assert.equal(applyAction(w, boulder).ok, true);
  const b = w.objects.find(o => o.kind === 'boulder');
  assert.deepEqual(b.slots, ['hill.1', 'hill.2']);
  assert.equal(b.origin.action, 18);
  ok('boulder takes 2 slots and records its action origin');
}

section('Player never creates discoveries (actions half)');
{
  const w = createWorld(21);
  for (let i = 0; i < 30; i++) tick(w);
  const actions = [
    { type: 'power', power: 'stone', slot: 'hollow.1', variant: 'stones' },
    { type: 'power', power: 'plant', slot: 'grove.5', variant: 'tree' },
    { type: 'power', power: 'rain' },
    { type: 'nudge', nudge: 'bless', target: 'w2', trait: 'curiosity' },
    { type: 'gift', day: 20400, giftId: giftOptions(w.seed, 20400)[0] }
  ];
  let seq = 1;
  for (const a of actions) {
    const before = knowledge(w);
    const res = applyAction(w, { seq: seq++, t: w.tick, ...a });
    assert.equal(res.ok, true, a.power || a.nudge || a.type);
    assert.equal(knowledge(w), before, 'action changed knowledge');
  }
  ok('every implemented action leaves world.discoveries and all knows unchanged');
}

console.log('\ntest-actions: all passed');
