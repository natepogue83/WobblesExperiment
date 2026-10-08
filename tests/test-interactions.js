// test-interactions.js — things bumping into things, and what it leaves behind.
import assert from 'node:assert/strict';
import { createWorld, tick, applyAction, replay, stateHash } from '../src/sim/index.js';
import { makeObject } from '../src/sim/world.js';
import { stableStringify } from '../src/sim/util.js';
import { newSave, appendAction, serializeSave, parseSave } from '../src/ui/save.js';
import { section, ok } from './lib.js';

const knowledge = w => stableStringify({ d: w.discoveries, k: w.wobblins.map(x => [x.id, x.knows]) });
const last = (w, what) => w.events.filter(e => e.kind === 'interaction' && e.data.what === what).pop();

section('Dropping and flinging onto things');
{
  const w = createWorld(12, { barren: true });
  const [a, b, c] = w.wobblins;
  const bush = makeObject(w, { kind: 'bush', slot: 'meadow.2', origin: { natural: true }, state: { berries: 3 } });
  const fire = makeObject(w, { kind: 'fire', slot: 'meadow.4', origin: { natural: true }, state: { until: 99 } });
  const hut = makeObject(w, { kind: 'hut', slot: 'hollow.1', origin: { natural: true } });
  let seq = 0;
  const K = knowledge(w);
  const carry = (x, extra) => applyAction(w, { seq: ++seq, t: w.tick, type: 'nudge', nudge: 'carry', target: x.id, zone: extra.zone || 'meadow', ...extra });

  assert.equal(carry(a, { onto: 'o999' }).ok, false);
  assert.equal(carry(a, { onto: a.id }).ok, false);
  ok('dropping onto nothing (or onto itself) is rejected');

  assert.equal(carry(a, { onto: bush.id, thrown: true }).ok, true);
  assert.equal(bush.state.berries, 0);
  assert.ok(last(w, 'bush_squashed'));
  ok('a flung Wobblin squashes every berry on the bush');

  b.bonds = { [c.id]: 0.6 }; c.bonds = { [b.id]: 0.6 };
  assert.equal(carry(b, { onto: c.id }).ok, true);
  assert.ok(last(w, 'hug'));
  assert.ok(b.bonds[c.id] > 0.6);
  assert.equal(carry(a, { onto: c.id, thrown: true }).ok, true);
  assert.ok(last(w, 'bowled_over'));
  assert.ok(a.bonds[c.id] < 0 && c.bonds[a.id] < 0);
  ok('set down beside a friend: a hug; flung into someone: bowled over, and a grudge');

  a.traits.boldness = 0.2;
  assert.equal(carry(a, { onto: fire.id }).ok, true);
  assert.ok(last(w, 'singed'));
  assert.equal(a.zone, 'riverbank');
  ok('dropped onto the fire, a timid Wobblin runs screaming into the river');

  assert.equal(carry(b, { onto: hut.id, zone: 'hollow', thrown: true }).ok, true);
  assert.equal(hut.kind, 'scorch');
  assert.equal(hut.state.was, 'hut');
  ok('flung through a hut roof: the hut needs rebuilding');

  assert.equal(knowledge(w), K, 'interactions never add knowledge');
  ok('none of it adds knowledge (rule zero)');
}

section('Lightning on odd things');
{
  const w = createWorld(13, { barren: true });
  const boulder = { seq: 1, t: 0, type: 'power', power: 'stone', slot: 'meadow.1', variant: 'boulder' };
  applyAction(w, boulder);
  const bo = w.objects.find(o => o.kind === 'boulder');
  applyAction(w, { seq: 2, t: 0, type: 'power', power: 'lightning', slot: 'meadow.1' });
  assert.ok(bo.state.gone);
  assert.equal(w.objects.filter(o => o.kind === 'stones' && !o.state.gone).length, 2);
  ok('lightning splits a boulder into two piles of stones');
  for (let i = 0; i < 8; i++) tick(w);
  const before = w.objects.filter(o => o.kind === 'fish' && !o.state.gone).length;
  applyAction(w, { seq: 3, t: w.tick, type: 'power', power: 'lightning', slot: 'riverbank.3' });
  assert.ok(w.objects.filter(o => o.kind === 'fish' && !o.state.gone).length > before);
  assert.ok(last(w, 'fish_stunned'));
  ok('lightning in the river stuns fish up to the surface');
}

section('Friends and rivals form over time');
{
  let friends = 0, rivals = 0, squabbles = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const w = createWorld(seed);
    for (let i = 0; i < 300; i++) tick(w);
    friends += w.events.filter(e => e.kind === 'friends').length;
    squabbles += w.events.filter(e => e.kind === 'interaction' && e.data.what === 'squabble').length;
    rivals += w.events.filter(e => e.kind === 'rivals').length;
  }
  assert.ok(friends > 0);
  ok(`30 colonies x 300 days: ${friends} friendships formed (${rivals} rivalries, ${squabbles} squabbles without any Keeper help)`);
}

section('Interactions replay exactly');
{
  const save = newSave({ seed: 21, createdAt: 0 });
  const live = createWorld(21);
  const act = (t, a) => applyAction(live, appendAction(save, t, a));
  act(0, { type: 'nudge', nudge: 'carry', target: 'w1', zone: 'meadow', onto: 'w2', thrown: true });
  const bush = live.objects.find(o => o.kind === 'bush');
  if (bush) act(0, { type: 'nudge', nudge: 'carry', target: 'w3', zone: bush.zone, onto: bush.id });
  for (let i = 0; i < 20; i++) tick(live);
  const back = parseSave(serializeSave(save));
  assert.equal(stateHash(replay(back, 20)), stateHash(live));
  ok('a save with drops and flings onto things replays to the same world');
}

console.log('\ntest-interactions: all passed');
