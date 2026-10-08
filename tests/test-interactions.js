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

section('Dropped right on their heads');
{
  const w = createWorld(31, { barren: true });
  const [a, b, c] = w.wobblins;
  for (const x of [a, b, c]) x.zone = 'meadow';
  let seq = 0;
  const go = act => {
    const k = knowledge(w);
    const res = applyAction(w, { seq: ++seq, t: w.tick, ...act });
    assert.equal(knowledge(w), k, 'a gag never adds knowledge');
    return res;
  };

  assert.equal(go({ type: 'power', power: 'rain', onto: a.id }).ok, false);
  assert.equal(go({ type: 'power', power: 'stone', variant: 'stones', slot: 'meadow.1', onto: 'w999' }).ok, false);
  ok('only stones, seeds, lightning and the gift can land on a Wobblin, and it must be alive');

  assert.equal(go({ type: 'power', power: 'stone', variant: 'stones', slot: 'meadow.1', onto: a.id }).ok, true);
  const bonk = w.events.filter(e => e.kind === 'interaction').pop();
  assert.ok(['bonked', 'bonk_idea'].includes(bonk.data.what));
  assert.ok(w.events.find(e => e.kind === 'keeper_power' && e.data.onto === a.id).data.reactions[a.id]);
  ok(`stones on the head: ${bonk.data.what}, and a reaction from the one it hit`);

  const inj = b.injuries;
  b.injuries = 2;  // one more would be fatal
  tick(w); tick(w);
  assert.equal(go({ type: 'power', power: 'stone', variant: 'boulder', slot: 'meadow.3', onto: b.id }).ok, true);
  assert.ok(last(w, 'squashed'));
  assert.equal(b.injuries, 2);
  assert.ok(b.alive);
  b.injuries = inj;
  ok('a boulder squashes them flat, hurts, but never kills');

  for (let i = 0; i < 8; i++) tick(w);
  assert.equal(go({ type: 'power', power: 'plant', variant: 'bush', slot: 'meadow.5', onto: c.id }).ok, true);
  assert.ok(last(w, 'flower_crown'));
  assert.ok(c.flowerUntil > w.tick);
  ok('a seed on the head grows a flower crown');

  for (let i = 0; i < 4; i++) tick(w);
  let objs = w.objects.length;
  assert.equal(go({ type: 'power', power: 'plant', variant: 'tree', onto: a.id }).ok, true);
  assert.equal(w.objects.length, objs, 'no spot needed: nothing is placed');
  assert.ok(a.flowerUntil > w.tick);
  for (let i = 0; i < 4; i++) tick(w);
  objs = w.objects.length;
  assert.equal(go({ type: 'power', power: 'stone', variant: 'stones', onto: b.id }).ok, true);
  assert.ok(['bonked', 'bonk_idea'].includes(w.events.filter(e => e.kind === 'interaction').pop().data.what));
  assert.equal(w.objects.length, objs, 'no spot needed: nothing is placed');
  assert.equal(go({ type: 'power', power: 'stone', variant: 'stones' }).reason, 'cooldown');
  ok('with no room left in the valley, stones and seeds still land on a head (and nothing is placed)');

  let zaps = 0, ideas = 0, hurts = 0;
  for (const x of [a, b, c]) x.lifespan = 99999;   // nobody dies of old age mid-test
  for (let i = 0; i < 30; i++) {
    for (let k = 0; k < 8; k++) { for (const x of [a, b, c]) Object.assign(x.needs, { food: 1, warmth: 1, rest: 1 }); tick(w); }
    const tgt = [a, b, c][i % 3];
    for (const x of [a, b, c]) x.zone = x === tgt ? 'meadow' : 'grove';   // bystanders out of the blast
    const res = go({ type: 'power', power: 'lightning', slot: 'meadow.6', onto: tgt.id });
    assert.equal(res.ok, true, res.reason);
    const z = last(w, 'zapped');
    if (z && z.t === w.tick) { zaps++; if (z.data.idea) ideas++; if (z.data.hurt) hurts++; }
  }
  assert.ok(zaps >= 25 && ideas > 0, zaps + " zaps");
  assert.ok([a, b, c].every(x => x.alive));
  ok(`${zaps} zaps: ${ideas} knocked an idea loose, ${hurts} hurt someone, nobody died of it`);

  ok('nothing dropped on a head ever adds knowledge (rule zero)');

  const save = newSave({ seed: 31, createdAt: 0 });
  const live = createWorld(31);
  const doIt = (t, x) => applyAction(live, appendAction(save, t, x));
  doIt(0, { type: 'power', power: 'stone', variant: 'stones', slot: 'meadow.1', onto: 'w1' });
  doIt(0, { type: 'power', power: 'lightning', slot: 'meadow.4', onto: 'w2' });
  for (let i = 0; i < 6; i++) tick(live);
  const back = parseSave(serializeSave(save));
  assert.equal(stateHash(replay(back, 6)), stateHash(live));
  assert.ok(serializeSave(save).includes('"w1"'));
  ok('on-head drops pack into the save and replay to the same world');
}

section('Matchmaking');
{
  const firstPair = hug => {
    let total = 0, n = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const w = createWorld(seed);
      makeObject(w, { kind: 'hut', slot: 'hollow.1', origin: { natural: true } });
      makeObject(w, { kind: 'hut', slot: 'hollow.3', origin: { natural: true } });
      const [a, b] = w.wobblins;
      let seq = 0, t = 0;
      for (; t < 120 && !a.partnerId && !b.partnerId; t++) {
        if (hug && t % 2 === 0) applyAction(w, { seq: ++seq, t: w.tick, type: 'nudge', nudge: 'carry', target: a.id, zone: b.zone, onto: b.id });
        tick(w);
      }
      total += t; n++;
    }
    return total / n;
  };
  const alone = firstPair(false), matched = firstPair(true);
  assert.ok(matched < alone * 0.8, `${matched} vs ${alone}`);
  ok(`hugging two Wobblins together makes a match sooner: first pair after ${matched.toFixed(1)} days, against ${alone.toFixed(1)} left alone`);
}

section('Cradled or shaken');
{
  const w = createWorld(41, { barren: true });
  const [a, b] = w.wobblins;
  a.needs.rest = 0.2; b.needs.safety = 0.8;
  const r0 = a.needs.rest, s0 = b.needs.safety;
  assert.equal(applyAction(w, { seq: 1, t: 0, type: 'nudge', nudge: 'carry', target: a.id, zone: 'meadow', cradled: true }).ok, true);
  assert.ok(a.needs.rest > r0 && last(w, 'cradled'));
  assert.equal(applyAction(w, { seq: 2, t: 0, type: 'nudge', nudge: 'carry', target: b.id, zone: 'meadow', shaken: true }).ok, true);
  assert.ok(b.needs.safety < s0 && last(w, 'shaken'));
  assert.equal(applyAction(w, { seq: 3, t: 0, type: 'nudge', nudge: 'carry', target: b.id, zone: 'meadow', shaken: true, cradled: true }).ok, false);
  const save = newSave({ seed: 41, createdAt: 0 });
  const live = createWorld(41);
  applyAction(live, appendAction(save, 0, { type: 'nudge', nudge: 'carry', target: 'w1', zone: 'hill', cradled: true }));
  applyAction(live, appendAction(save, 0, { type: 'nudge', nudge: 'carry', target: 'w2', zone: 'hill', shaken: true, thrown: true }));
  for (let i = 0; i < 4; i++) tick(live);
  assert.equal(stateHash(replay(parseSave(serializeSave(save)), 4)), stateHash(live));
  ok('held still, a Wobblin dozes off in your hand; shaken, it is rattled; both replay');
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

  const cairn = makeObject(w, { kind: 'stones', slot: 'hill.3', origin: { natural: true }, state: { count: 3, stacked: true } });
  const totem = makeObject(w, { kind: 'totem', slot: 'hill.4', origin: { natural: true } });
  for (let i = 0; i < 8; i++) tick(w);
  applyAction(w, { seq: 4, t: w.tick, type: 'power', power: 'lightning', slot: 'hill.3' });
  assert.ok(last(w, 'stones_burst') && !cairn.state.stacked && cairn.state.count === 1);
  for (let i = 0; i < 8; i++) tick(w);
  applyAction(w, { seq: 5, t: w.tick, type: 'power', power: 'lightning', slot: 'hill.4' });
  assert.ok(last(w, 'charged') && totem.state.chargedUntil > w.tick);
  ok('lightning bursts a cairn apart, and makes a totem hum with power');
}

section('Static shock');
{
  const w = createWorld(29, { barren: true });
  const [a, b] = w.wobblins;
  let shocks = 0;
  for (let i = 0; i < 40; i++) {
    for (const x of w.wobblins) { x.zone = 'meadow'; Object.assign(x.needs, { food: 1, warmth: 1, rest: 1 }); }
    a.zappedUntil = w.tick + 3;
    tick(w);
    if (w.events.some(e => e.t === w.tick - 1 && e.kind === 'interaction' && e.data.what === 'static_shock')) shocks++;
  }
  assert.ok(shocks > 5, 'shocks ' + shocks);
  ok(`a still-crackling Wobblin shocks whoever it bumps into (${shocks} of 40 days)`);
}

section('Shake the Valley');
{
  const w = createWorld(19, { barren: true });
  const bush = makeObject(w, { kind: 'bush', slot: 'meadow.2', origin: { natural: true }, state: { berries: 3 } });
  const cairn = makeObject(w, { kind: 'stones', slot: 'hill.2', origin: { natural: true }, state: { count: 2, stacked: true } });
  const wall = makeObject(w, { kind: 'wall', slot: 'hollow.2', origin: { natural: true } });
  for (const x of w.wobblins) { x.zone = 'meadow'; x.needs.food = 0.2; }
  const [a, b] = w.wobblins;
  a.traits.playfulness = 0.9; a.traits.boldness = 0.8; b.traits.playfulness = 0.1;
  const K = knowledge(w), safeB = b.needs.safety;
  assert.equal(applyAction(w, { seq: 1, t: 0, type: 'power', power: 'quake' }).ok, true);
  const q = last(w, 'quake');
  assert.equal(bush.state.berries, 0);
  assert.equal(q.data.berries, 3);
  assert.ok(w.wobblins.every(x => x.needs.food > 0.2), 'a feast of fallen berries');
  assert.equal(cairn.state.stacked, false);
  assert.ok(b.needs.safety < safeB);
  assert.equal(knowledge(w), K);
  assert.equal(applyAction(w, { seq: 2, t: 0, type: 'power', power: 'quake' }).reason, 'cooldown');
  ok(`berries rain down (${q.data.berries}), cairns topple, timid ones are shaken${wall.kind === 'ruin' ? ', a wall fell' : ''}; no knowledge, and it recharges`);

  const p = createWorld(19, { progression: true });
  assert.equal(applyAction(p, { seq: 1, t: 0, type: 'power', power: 'quake' }).reason, 'locked_power');
  const save = newSave({ seed: 23, createdAt: 0 });
  const live = createWorld(23);
  applyAction(live, appendAction(save, 0, { type: 'power', power: 'quake' }));
  for (let i = 0; i < 10; i++) tick(live);
  assert.equal(stateHash(replay(parseSave(serializeSave(save)), 10)), stateHash(live));
  ok('locked until belief 26 in a new game; packs into the save and replays');
}

section('Snowmen');
{
  let built = 0, smashed = 0, melted = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const w = createWorld(seed, { barren: true });
    let seq = 0;
    for (const x of w.wobblins) { x.traits.playfulness = 0.8; x.zone = 'meadow'; }
    applyAction(w, { seq: ++seq, t: 0, type: 'power', power: 'season', variant: 'cold' });
    applyAction(w, { seq: ++seq, t: 0, type: 'power', power: 'rain' });
    for (let i = 0; i < 6; i++) { for (const x of w.wobblins) Object.assign(x.needs, { food: 1, warmth: 1 }); tick(w); }
    const s = w.objects.find(o => o.kind === 'snowman' && !o.state.gone);
    if (w.events.some(e => e.kind === 'interaction' && e.data.what === 'snowman')) built++;
    if (s) {
      const x = w.wobblins.find(y => y.alive);
      if (applyAction(w, { seq: ++seq, t: w.tick, type: 'nudge', nudge: 'carry', target: x.id, zone: s.zone, thrown: true, onto: s.id }).ok && s.state.gone) smashed++;
    }
    for (let i = 0; i < 30; i++) { for (const x of w.wobblins) Object.assign(x.needs, { food: 1, warmth: 1 }); tick(w); }
    if (!w.objects.some(o => o.kind === 'snowman' && !o.state.gone)) melted++;
  }
  assert.ok(built >= 10 && smashed >= 5 && melted === 20, `${built} ${smashed} ${melted}`);
  ok(`snow (cold snap + rain): playful ones built snowmen in ${built}/20 valleys; flung Wobblins smashed ${smashed}; all melted when the cold passed`);
}

section('Ice');
{
  const w = createWorld(17, { barren: true });
  let seq = 0;
  const go = a => applyAction(w, { seq: ++seq, t: w.tick, ...a });
  assert.equal(go({ type: 'power', power: 'water' }).ok, true);
  const pond = w.objects.find(o => o.kind === 'pond');
  assert.equal(go({ type: 'power', power: 'season', variant: 'cold' }).ok, true);
  tick(w);
  assert.ok(pond.state.frozen);
  assert.ok(last(w, 'pond_froze'));
  const [a, b] = w.wobblins;
  a.traits.playfulness = 0.9;
  assert.equal(go({ type: 'nudge', nudge: 'carry', target: a.id, zone: 'pondsite', thrown: true, onto: pond.id }).ok, true);
  assert.ok(last(w, 'skating'));
  ok('a cold snap freezes the pond, and a Wobblin flung onto it goes skating');
  for (let i = 0; i < 8; i++) tick(w);
  b.zone = 'pondsite'; a.zone = 'pondsite';
  assert.ok(pond.state.frozen);
  assert.equal(go({ type: 'power', power: 'lightning', slot: 'pondsite.1' }).ok, true);
  const crack = last(w, 'ice_cracked');
  assert.ok(crack && crack.actors.includes(b.id));
  assert.ok(!pond.state.frozen);
  tick(w);
  assert.ok(!pond.state.frozen, 'it does not refreeze straight away');
  ok(`lightning on the frozen pond cracks the ice and dunks the skaters (${crack.actors.length} went in)`);
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
  assert.ok(friends > 20 && rivals > 5 && squabbles > 5, `${friends} / ${rivals} / ${squabbles}`);
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
