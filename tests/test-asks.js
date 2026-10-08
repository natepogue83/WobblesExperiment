// test-asks.js — everyday requests: asked from day one, granted by the matching act.
import assert from 'node:assert/strict';
import { createWorld, tick, applyAction, replay, stateHash, openAsk } from '../src/sim/index.js';
import { stableStringify } from '../src/sim/util.js';
import { slotIds } from '../src/sim/geometry.js';
import { newSave, appendAction, serializeSave, parseSave } from '../src/ui/save.js';
import { section, ok } from './lib.js';

const knowledge = w => stableStringify({ d: w.discoveries, k: w.wobblins.map(x => [x.id, x.knows]) });
const freeIn = (w, zone) => slotIds(zone).find(s => !w.objects.some(o => !o.state.gone && (o.slot === s || (o.slots || []).includes(s))));
const anyFree = w => ['meadow', 'grove', 'hill', 'hollow', 'pondsite'].map(z => freeIn(w, z)).find(Boolean);

// The act that answers each kind of ask.
function answer(w, ask) {
  const by = w.wobblins.find(x => x.id === ask.by);
  const other = w.wobblins.find(x => x.alive && x.id !== by.id);
  switch (ask.want) {
    case 'berries': { const s = anyFree(w); return s ? { type: 'power', power: 'plant', variant: 'bush', slot: s } : null; }
    case 'stones': return { type: 'power', power: 'stone', variant: 'stones', onto: by.id };
    case 'rain': return { type: 'power', power: 'rain' };
    case 'company': return other ? { type: 'nudge', nudge: 'carry', target: other.id, zone: by.zone } : null;
    case 'flowers': return { type: 'power', power: 'plant', variant: 'bush', onto: by.id };
  }
  return null;
}

section('Asks from day one');
{
  let made = 0, granted = 0, expired = 0, belief = 0;
  const kinds = {};
  for (let seed = 1; seed <= 30; seed++) {
    const w = createWorld(seed, { progression: true });
    let seq = 0;
    for (let i = 0; i < 240; i++) {
      const ask = openAsk(w);
      if (ask && ask.id % 3 !== 0 && w.tick - ask.t >= 1) {
        const a = answer(w, ask);
        if (a) {
          const k = knowledge(w), b0 = w.belief;
          if (applyAction(w, { seq: ++seq, t: w.tick, ...a }).ok && ask.done === 'granted') belief += w.belief - b0;
          assert.equal(knowledge(w), k, 'asks never add knowledge');
        }
      }
      tick(w);
    }
    for (const e of w.events) {
      if (e.kind === 'ask') { made++; kinds[e.target] = (kinds[e.target] || 0) + 1; }
      if (e.kind === 'ask_granted') { granted++; assert.ok(e.causes.some(c => c.action), 'granted by an act'); }
      if (e.kind === 'ask_expired') expired++;
    }
  }
  assert.ok(made > 100 && granted > 40 && expired > 10, `${made} ${granted} ${expired}`);
  assert.ok(Object.keys(kinds).length >= 4);
  ok(`30 colonies x 10 days, no Temple needed: ${made} asks (${Object.entries(kinds).map(([k, v]) => k + ' ' + v).join(', ')}); ${granted} granted for +${belief.toFixed(0)} belief, ${expired} given up on`);
}

section('Asks replay');
{
  const save = newSave({ seed: 9, createdAt: 0, progression: true });
  const live = createWorld(9, save);
  for (let i = 0; i < 120; i++) {
    const ask = openAsk(live);
    if (ask && live.tick - ask.t >= 1) { const a = answer(live, ask); if (a) applyAction(live, appendAction(save, live.tick, a)); }
    tick(live);
  }
  assert.equal(stateHash(replay(parseSave(serializeSave(save)), 120)), stateHash(live));
  ok('granting asks replays to the same world');
}

console.log('\ntest-asks: all passed');
