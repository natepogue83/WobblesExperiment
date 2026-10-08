// test-world.js — world changes, misfires, superstitions, wishes, and the long
// runs: full graph reachable and a typical player's colony staying alive.
import assert from 'node:assert/strict';
import { createWorld, tick, applyAction } from '../src/sim/index.js';
import { DISCOVERIES, BY_ID } from '../src/sim/discoveries.js';
import { makeObject } from '../src/sim/world.js';
import { ADJACENT } from '../src/sim/geometry.js';
import { generousActions, runScript, section, ok } from './lib.js';

const OMEN = e => e.kind.startsWith('keeper_') || ['rain', 'lightning', 'flood', 'prowler'].includes(e.kind);

section('Long runs: generous player, 200 seeds x 2,160 ticks');
const found = {};
let tier4Seeds = 0, misfires = 0, burned = 0, superstitions = 0, lost = 0, injuredExp = 0, healthy = 0;
for (let seed = 1; seed <= 200; seed++) {
  const w = createWorld(seed);
  let inRange = 0, sampled = 0;
  runScript(w, 2160, generousActions, world => {
    if (world.tick >= 100 && world.tick <= 1000 && world.tick % 10 === 0) {
      sampled++;
      const n = world.wobblins.filter(x => x.alive).length;
      if (n >= 3 && n <= 8) inRange++;
    }
  });
  if (inRange / sampled >= 0.9) healthy++;
  const disc = w.events.filter(e => e.kind === 'discovery' || e.kind === 'rediscovery');
  const ids = new Set(disc.map(e => e.target));
  for (const id of ids) found[id] = (found[id] || 0) + 1;
  if ([...ids].some(id => BY_ID[id].tier === 4)) tier4Seeds++;

  for (const e of w.events) {
    if (e.kind === 'misfire') misfires++;
    if (e.kind === 'lost') lost++;
    if (e.kind === 'injured' && e.data.cause === 'experiment') injuredExp++;
    if (e.kind === 'burned') {
      burned++;
      // Only when a hut or wall is within one zone of the fire experiment.
      assert.ok(['hut', 'wall'].includes(e.data.was), 'burned ' + e.data.was);
      assert.ok(e.data.zone === e.data.at || ADJACENT[e.data.at].includes(e.data.zone), 'burned too far away');
      assert.ok(['fire_warmth', 'fire_carrying', 'hearth', 'cooking', 'pottery', 'ritual'].includes(e.data.discovery));
    }
    if (e.kind === 'superstition') {
      superstitions++;
      // Only within 3 ticks after a Keeper act or natural event, and it is cited.
      const omen = w.events[e.causes[0].event - 1];
      assert.ok(omen && OMEN(omen), 'superstition without an omen');
      assert.ok(e.t - omen.t <= 3 && e.t >= omen.t, 'omen too old');
    }
  }
}
{
  const missing = DISCOVERIES.filter(d => !found[d.id]).map(d => d.id);
  assert.deepEqual(missing, [], 'never invented: ' + missing.join(', '));
  ok('all 30 discoveries were invented in at least one seed (rarest: ' +
    DISCOVERIES.map(d => [d.id, found[d.id]]).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([k, v]) => k + ' ' + v).join(', ') + ')');
  assert.ok(tier4Seeds >= 40, 'tier 4 in ' + tier4Seeds + '/200');
  ok('tier 4 reached in ' + tier4Seeds + '/200 seeds (>= 20%)');
  assert.ok(misfires > 0 && burned > 0 && superstitions > 0 && lost > 0 && injuredExp > 0);
  ok('misfires ' + misfires + ', injuries ' + injuredExp + ', burned ' + burned + ' (all next to a fire experiment), lost ' + lost +
    ', superstitions ' + superstitions + ' (all within 3 ticks of a cited omen)');
  assert.ok(healthy >= 160, 'healthy colonies ' + healthy + '/200');
  ok('typical (generous) player: population 3-8 for ticks 100-1,000 in ' + healthy + '/200 seeds (>= 80%)');
}

section('Wishes once the Temple exists');
{
  let granted = 0, expired = 0, made = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const w = createWorld(seed);
    makeObject(w, { kind: 'temple', slot: 'hill.3', origin: { natural: true } });
    let seq = 0;
    for (let i = 0; i < 300; i++) {
      const open = (w.wishes || []).find(x => !x.done);
      // Grant every other wish.
      if (open && open.id % 2 === 1 && w.tick - open.t >= 2) {
        const a = open.want === 'rain' ? { type: 'power', power: 'rain' }
          : open.want === 'warmth' ? { type: 'power', power: 'season', variant: 'warm' }
          : { type: 'power', power: 'stone', slot: ['hill.1', 'hill.2', 'hill.4', 'hill.5'].find(s => !w.objects.some(o => !o.state.gone && (o.slot === s || (o.slots || []).includes(s)))), variant: 'stones' };
        w.devotion = 100;
        applyAction(w, { seq: ++seq, t: w.tick, ...a });
      }
      tick(w);
    }
    made += w.events.filter(e => e.kind === 'wish').length;
    granted += w.events.filter(e => e.kind === 'wish_granted').length;
    expired += w.events.filter(e => e.kind === 'wish_expired').length;
    for (const g of w.events.filter(e => e.kind === 'wish_granted')) assert.ok(g.causes.some(c => c.action), 'granted by an action');
  }
  assert.ok(made > 0 && granted > 0 && expired > 0);
  ok(made + ' wishes: ' + granted + ' granted by the matching Keeper act, ' + expired + ' expired after 24 ticks');
  const w = createWorld(3);
  for (let i = 0; i < 300; i++) tick(w);
  assert.equal(w.events.filter(e => e.kind === 'wish').length, 0);
  ok('no Temple, no wishes');
}

console.log('\ntest-world: all passed');
