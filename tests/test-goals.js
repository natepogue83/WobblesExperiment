// test-goals.js — ages and milestones: read from the world, claimed as actions.
import assert from 'node:assert/strict';
import { createWorld, tick, applyAction, replay, stateHash, GOALS, goalStates, ageOf, progressOf } from '../src/sim/index.js';
import { stableStringify } from '../src/sim/util.js';
import { newSave, appendAction, serializeSave, parseSave } from '../src/ui/save.js';
import { generousActions, section, ok } from './lib.js';

const knowledge = w => stableStringify({ d: w.discoveries, k: w.wobblins.map(x => [x.id, x.knows]) });

section('A new colony');
{
  const w = createWorld(5, { progression: true });
  assert.equal(ageOf(w).name, 'The First Days');
  assert.ok(goalStates(w).every(g => g.state === 'open'));
  assert.equal(applyAction(w, { seq: 1, t: 0, type: 'claim', goal: 'first_idea' }).reason, 'not_yet');
  assert.equal(applyAction(w, { seq: 1, t: 0, type: 'claim', goal: 'nope' }).reason, 'goal');
  ok(`starts in ${ageOf(w).name}, all ${GOALS.length} goals open, nothing claimable yet`);
}

section('Goals are reached by playing, claimed once, and add belief');
{
  let reached = {}, claimedTotal = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const w = createWorld(seed, { progression: true });
    let seq = 0;
    for (let t = 0; t < 720; t++) {
      for (const a of generousActions(w, seed)) applyAction(w, { seq: ++seq, t: w.tick, ...a });
      for (const g of goalStates(w).filter(g => g.state === 'ready')) {
        const before = w.belief, k = knowledge(w);
        assert.equal(applyAction(w, { seq: ++seq, t: w.tick, type: 'claim', goal: g.id }).ok, true);
        assert.equal(knowledge(w), k, 'claiming never adds knowledge');
        assert.ok(w.belief >= before + g.belief - 1e-9);
        assert.equal(applyAction(w, { seq: ++seq, t: w.tick, type: 'claim', goal: g.id }).reason, 'claimed');
        reached[g.id] = (reached[g.id] || 0) + 1;
        claimedTotal++;
      }
      tick(w);
    }
  }
  for (const id of ['first_idea', 'friends', 'fire', 'ember', 'baby', 'home', 'five']) assert.ok(reached[id] >= 10, id + ' reached in ' + (reached[id] || 0));
  const line = GOALS.map(g => `${g.id} ${reached[g.id] || 0}`).join(', ');
  ok(`40 colonies x 30 days (generous player): ${claimedTotal} claims. ${line}`);
}

section('Tricks: small things to try with your own hands');
{
  const w = createWorld(9, { progression: true, barren: true });
  const [a, b] = w.wobblins;
  for (const x of [a, b]) x.zone = 'meadow';
  a.bonds = { [b.id]: 0.6 }; b.bonds = { [a.id]: 0.6 };
  assert.ok(goalStates(w).filter(g => g.trick).every(g => g.state === 'open'));
  let seq = 0;
  assert.equal(applyAction(w, { seq: ++seq, t: 0, type: 'nudge', nudge: 'carry', target: a.id, zone: 'meadow', onto: b.id }).ok, true);
  assert.equal(goalStates(w).find(g => g.id === 'trick_hug').state, 'ready');
  const before = w.belief, k = knowledge(w);
  assert.equal(applyAction(w, { seq: ++seq, t: 0, type: 'claim', goal: 'trick_hug' }).ok, true);
  assert.equal(knowledge(w), k);
  assert.ok(w.belief >= before + 1 - 1e-9);
  assert.equal(w.events[w.events.length - 1].data.trick, true);
  assert.equal(applyAction(w, { seq: ++seq, t: 0, type: 'claim', goal: 'trick_juggle' }).reason, 'not_yet');
  assert.equal(applyAction(w, { seq: ++seq, t: 0, type: 'nudge', nudge: 'carry', target: b.id, zone: 'meadow', thrown: true, juggled: 3 }).ok, true);
  assert.equal(applyAction(w, { seq: ++seq, t: 0, type: 'claim', goal: 'trick_juggle' }).ok, true);
  ok('a hug and a juggle each unlock a trick worth 1 belief; claiming never adds knowledge');

  // Skating on their own (no Keeper hand involved) is not your trick.
  w.events.push({ id: 'e9999', t: w.tick, kind: 'interaction', actors: [a.id], target: a.id, data: { what: 'skating' }, salience: 2, causes: [{ object: 'o1' }] });
  assert.equal(goalStates(w).find(g => g.id === 'trick_skate').state, 'open');
  ok('a trick only counts when the Keeper caused it');
}

section('Population over time is read correctly from the log');
{
  for (const seed of [3, 9, 14]) {
    const w = createWorld(seed);
    let seq = 0, maxAlive = w.wobblins.filter(x => x.alive).length;
    for (let t = 0; t < 600; t++) {
      for (const a of generousActions(w, seed)) applyAction(w, { seq: ++seq, t: w.tick, ...a });
      tick(w);
      maxAlive = Math.max(maxAlive, w.wobblins.filter(x => x.alive).length);
    }
    assert.equal(progressOf(w).maxPop, maxAlive);
  }
  ok('the largest the colony ever was matches a tick-by-tick count');
}

section('Claims replay');
{
  const save = newSave({ seed: 8, createdAt: 0, progression: true });
  const live = createWorld(8, save);
  let claimed = 0;
  for (let t = 0; t < 300; t++) {
    for (const a of generousActions(live, 8)) applyAction(live, appendAction(save, live.tick, a));
    for (const g of goalStates(live).filter(g => g.state === 'ready')) if (applyAction(live, appendAction(save, live.tick, { type: 'claim', goal: g.id })).ok) claimed++;
    tick(live);
  }
  assert.ok(claimed > 0);
  const back = parseSave(serializeSave(save));
  assert.equal(stateHash(replay(back, 300)), stateHash(live));
  ok(`${claimed} claims pack into the save and replay to the same world`);
}

console.log('\ntest-goals: all passed');
