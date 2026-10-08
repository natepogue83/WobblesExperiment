// test-actions.js — validation rejects cleanly; actions never add knowledge.
import assert from 'node:assert/strict';
import { createWorld, tick, applyAction, stateHash, giftOptions } from '../src/sim/index.js';
import { stableStringify } from '../src/sim/util.js';
import { section, ok, generousActions } from './lib.js';

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

section('Every power and nudge');
{
  const w = createWorld(31, { barren: true });
  let seq = 100;
  const A = a => applyAction(w, { seq: ++seq, t: w.tick, ...a });
  const run = n => { for (let i = 0; i < n; i++) tick(w); };

  // Devotion costs; Season is free the first time.
  rejects(w, { seq: 1, t: 0, type: 'nudge', nudge: 'miracle' }, 'devotion');
  assert.equal(A({ type: 'power', power: 'season', variant: 'cold' }).ok, true);
  assert.equal(w.climate.season, 'cold');
  assert.ok(w.climate.tempMod < 0);
  run(24);
  assert.equal(w.climate.season, 'mild');
  rejects(w, { seq: 2, t: w.tick, type: 'power', power: 'season', variant: 'warm' }, 'devotion');
  w.devotion = 30;
  assert.equal(A({ type: 'power', power: 'season', variant: 'warm' }).ok, true);
  assert.equal(w.devotion, 20);
  assert.equal(A({ type: 'nudge', nudge: 'miracle' }).ok, true);
  assert.equal(w.devotion, 0);
  assert.ok(w.miracleUntil > w.tick);
  ok('Season free once then 10 Devotion; Miracle costs 20; cold snap lasts 24 ticks');

  // Lightning on a tree: fire, whose origin chains back to the action.
  const plant = A({ type: 'power', power: 'plant', slot: 'grove.2', variant: 'tree' });
  assert.equal(plant.ok, true);
  run(6);
  const tree = w.objects.find(o => o.kind === 'tree' && !o.state.gone);
  assert.ok(tree, 'sprout grew into a tree');
  rejects(w, { seq: 3, t: w.tick, type: 'power', power: 'lightning', slot: 'nowhere.1' }, 'slot');
  const lseq = seq + 1;
  assert.equal(A({ type: 'power', power: 'lightning', slot: 'grove.2' }).ok, true);
  const fire = w.objects.find(o => o.kind === 'fire');
  assert.ok(fire && tree.state.gone, 'tree became a fire');
  const strikeEv = w.events.find(e => e.id === fire.origin.event);
  assert.deepEqual(strikeEv.causes, [{ action: lseq }]);
  rejects(w, { seq: 4, t: w.tick, type: 'power', power: 'lightning', slot: 'grove.1' }, 'cooldown');
  run(8);
  assert.ok(fire.state.gone, 'fire burned out');
  assert.ok(w.events.some(e => e.kind === 'fire_out' && e.target === fire.id));
  ok('lightning turns a tree into a fire that burns out; the fire\'s origin is the lightning action');

  // Shape Water: a pond, then reeds, clay, fish over 12 ticks; then river bends.
  assert.equal(A({ type: 'power', power: 'water' }).ok, true);
  const pond = w.objects.find(o => o.kind === 'pond');
  assert.deepEqual(pond.slots, ['pondsite.1', 'pondsite.2']);
  run(13);
  for (const k of ['reeds', 'clay', 'fish']) assert.ok(w.objects.some(o => o.kind === k && o.zone === 'pondsite' && !o.state.gone), 'pond grew ' + k);
  rejects(w, { seq: 5, t: w.tick, type: 'power', power: 'water', slot: 'meadow.1' }, 'slot');
  assert.equal(A({ type: 'power', power: 'water', slot: 'riverbank.3' }).ok, true);
  assert.equal(w.riverBend, 'riverbank.3');
  ok('Shape Water digs the pond (reeds, clay, fish follow), then bends the river');

  // Rain three times within 6 ticks floods.
  for (let i = 0; i < 3; i++) {
    assert.equal(A({ type: 'power', power: 'rain' }).ok, true);
    assert.equal(w.events.filter(e => e.kind === 'flood').length, i < 2 ? 0 : 1);
    run(3);
  }
  ok('three rains within 6 ticks cause a flood');

  // Curio: locked until the material has been noticed; needs two living targets.
  const w2 = createWorld(31, { barren: true });
  rejects(w2, { seq: 1, t: 0, type: 'nudge', nudge: 'curio', curio: 'flint', targets: ['w1', 'w2'] }, 'locked');
  applyAction(w2, { seq: 2, t: 0, type: 'power', power: 'stone', slot: 'meadow.1', variant: 'stones' });
  for (let i = 0; i < 30 && w2.noticed.stones === undefined; i++) tick(w2);
  assert.ok(w2.noticed.stones !== undefined, 'someone noticed the stones');
  rejects(w2, { seq: 3, t: w2.tick, type: 'nudge', nudge: 'curio', curio: 'flint', targets: ['w1', 'w1'] }, 'targets');
  rejects(w2, { seq: 4, t: w2.tick, type: 'nudge', nudge: 'curio', curio: 'flint', targets: ['w1', 'w9'] }, 'targets');
  assert.equal(applyAction(w2, { seq: 5, t: w2.tick, type: 'nudge', nudge: 'curio', curio: 'flint', targets: ['w1', 'w3'] }).ok, true);
  const cur = w2.objects.find(o => o.kind === 'curio');
  tick(w2);
  for (const id of ['w1', 'w3']) assert.equal(w2.wobblins.find(x => x.id === id).zone, cur.zone, id + ' pulled to the curio');
  ok('curio unlocks after its material is noticed and pulls both chosen Wobblins to it');
}

section('Pick up and drop a Wobblin');
{
  const w = createWorld(51, { barren: true });
  rejects(w, { seq: 1, t: 0, type: 'nudge', nudge: 'carry', target: 'w9', zone: 'hill' }, 'target');
  rejects(w, { seq: 2, t: 0, type: 'nudge', nudge: 'carry', target: 'w1', zone: 'moon' }, 'zone');
  assert.equal(applyAction(w, { seq: 3, t: 0, type: 'nudge', nudge: 'carry', target: 'w1', zone: 'hill' }).ok, true);
  assert.equal(w.wobblins[0].zone, 'hill');
  assert.equal(applyAction(w, { seq: 4, t: 0, type: 'nudge', nudge: 'carry', target: 'w2', zone: 'hill' }).ok, true, 'no cooldown');
  tick(w); tick(w);
  assert.equal(w.wobblins[0].zone, 'hill', 'stays where it was put for a while');
  rejects(w, { seq: 5, t: w.tick, type: 'nudge', nudge: 'carry', target: 'w3', zone: 'hill', splash: true }, 'splash');
  const w3 = w.wobblins[2], warm = w3.needs.warmth, faith = w3.faith;
  assert.equal(applyAction(w, { seq: 6, t: w.tick, type: 'nudge', nudge: 'carry', target: 'w3', zone: 'riverbank', thrown: true, splash: true }).ok, true);
  assert.ok(w3.needs.warmth < warm && w3.faith < faith && w3.alive && w3.injuries === 0);
  ok('carry moves a living Wobblin to a zone, has no cooldown, and they stay put for a few ticks');
  ok('flinging one into the river chills it and shakes its faith a little, but never hurts it');
}

section('Every Keeper act gets a visible reaction');
{
  const seen = {};
  let acts = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const w = createWorld(seed);
    let seq = 0;
    for (let i = 0; i < 120; i++) {
      for (const a of generousActions(w)) {
        const before = w.events.length;
        const res = applyAction(w, { seq: ++seq, t: w.tick, ...a });
        if (!res.ok) continue;
        acts++;
        const ev = w.events.slice(before).find(e => e.kind.startsWith('keeper_') || e.kind === 'offerings_collected');
        assert.ok(ev && ev.data.reactions, 'no reactions for ' + JSON.stringify(a));
        if (w.wobblins.some(x => x.alive)) assert.ok(Object.keys(ev.data.reactions).length >= 1 || a.type === 'collect_offerings' || a.power, 'nobody reacted');
        for (const [id, e] of Object.entries(ev.data.reactions)) { seen[e] = (seen[e] || 0) + 1; assert.ok(['love', 'like', 'curious', 'scared', 'upset'].includes(e)); }
      }
      tick(w);
    }
  }
  for (const e of ['love', 'like', 'curious', 'scared', 'upset']) assert.ok(seen[e] > 0, 'never ' + e);
  ok(acts + ' Keeper acts, each with per-Wobblin reactions: ' + Object.entries(seen).map(([k, v]) => k + ' ' + v).join(', '));

  // Lightning right next to a timid Wobblin scares it; a blessing delights its target.
  const w = createWorld(3, { barren: true });
  for (const x of w.wobblins) { x.traits.boldness = 0.05; x.zone = 'meadow'; }
  applyAction(w, { seq: 1, t: 0, type: 'power', power: 'lightning', slot: 'meadow.1' });
  const lr = w.events.find(e => e.data.power === 'lightning').data.reactions;
  assert.ok(Object.values(lr).every(e => e === 'scared'), JSON.stringify(lr));
  applyAction(w, { seq: 2, t: 0, type: 'nudge', nudge: 'bless', target: 'w2', trait: 'curiosity' });
  assert.equal(w.events.find(e => e.data.nudge === 'bless').data.reactions.w2, 'love');
  ok('lightning beside timid Wobblins scares them all; a blessing makes its target light up');
}

section('Belief unlocks powers (new games)');
{
  const w = createWorld(8, { progression: true });
  rejects(w, { seq: 1, t: 0, type: 'power', power: 'lightning', slot: 'meadow.1' }, 'locked_power');
  rejects(w, { seq: 2, t: 0, type: 'nudge', nudge: 'miracle' }, 'locked_power');
  assert.deepEqual(w.unlocked.slice().sort(), ['carry', 'gift', 'plant', 'stone']);
  // Keep doing things they enjoy until Lightning opens up.
  let seq = 10;
  for (let i = 0; i < 200 && !w.unlocked.includes('lightning'); i++) {
    for (const x of w.wobblins.filter(x => x.alive)) applyAction(w, { seq: ++seq, t: w.tick, type: 'nudge', nudge: 'carry', target: x.id, zone: x.zone });
    const s2 = ['meadow', 'grove', 'hollow', 'hill'].flatMap(z => [1, 2, 3, 4, 5].map(n => z + '.' + n)).find(sl => !w.objects.some(o => !o.state.gone && (o.slot === sl || (o.slots || []).includes(sl))));
    if (s2) applyAction(w, { seq: ++seq, t: w.tick, type: 'power', power: 'plant', slot: s2, variant: 'bush' });
    tick(w);
  }
  const ups = w.events.filter(e => e.kind === 'power_unlocked').map(e => e.target);
  assert.ok(ups.includes('rain') && ups.includes('bless') && ups.includes('lightning'), ups.join(','));
  assert.ok(ups.indexOf('rain') < ups.indexOf('bless') && ups.indexOf('bless') < ups.indexOf('lightning'));
  ok('a new game starts with hand, stones, seeds and the gift; their delight unlocked ' + ups.join(', ') + ' in that order (belief ' + w.belief + ')');
  const old = createWorld(8);
  assert.ok(['lightning', 'miracle', 'season'].every(k => old.unlocked.includes(k)));
  ok('worlds without progression (old saves) keep every power');
}

section('Offerings');
{
  const w = createWorld(41);
  for (const x of w.wobblins) x.faith = 0.6;
  for (let i = 0; i < 40; i++) { w.lastKeeperTick = w.tick; tick(w); }
  assert.ok(w.offerings > 0, 'faithful Wobblins leave offerings');
  const n = w.offerings;
  assert.equal(applyAction(w, { seq: 1, t: w.tick, type: 'collect_offerings' }).ok, true);
  assert.equal(w.devotion, n);
  assert.equal(w.offerings, 0);
  ok('faithful Wobblins left ' + n + ' offerings; collecting turns them into Devotion');
}

section('Player never creates discoveries (actions half)');
{
  const w = createWorld(21);
  for (let i = 0; i < 30; i++) tick(w);
  // Give the world some knowledge so "unchanged" is a real check.
  w.wobblins[0].knows.stone_stacking = { since: 1, from: 'self' };
  w.discoveries.stone_stacking = { inventor: 'w1', tick: 1, causes: [], forgotten: false };
  w.devotion = 100; w.offerings = 3;
  w.noticed.stones = 1;
  const stoneSlot = ['hollow.1', 'hollow.2', 'hollow.3', 'hollow.4', 'hollow.5'].find(s => !w.objects.some(o => o.slot === s && !o.state.gone));
  const plantSlot = ['grove.1', 'grove.2', 'grove.3', 'grove.4', 'grove.5'].find(s => !w.objects.some(o => o.slot === s && !o.state.gone));
  const actions = [
    { type: 'power', power: 'stone', slot: stoneSlot, variant: 'stones' },
    { type: 'power', power: 'plant', slot: plantSlot, variant: 'tree' },
    { type: 'power', power: 'rain' },
    { type: 'power', power: 'lightning', slot: plantSlot },
    { type: 'power', power: 'water' },
    { type: 'power', power: 'season', variant: 'cold' },
    { type: 'nudge', nudge: 'bless', target: 'w2', trait: 'curiosity' },
    { type: 'nudge', nudge: 'curio', curio: 'flint', targets: ['w1', 'w2'] },
    { type: 'nudge', nudge: 'miracle' },
    { type: 'nudge', nudge: 'carry', target: 'w3', zone: 'hill' },
    { type: 'gift', day: 20400, giftId: giftOptions(w.seed, 20400)[0] },
    { type: 'collect_offerings' }
  ];
  let seq = 1;
  const firstEvent = w.events.length;
  for (const a of actions) {
    const before = knowledge(w);
    const res = applyAction(w, { seq: seq++, t: w.tick, ...a });
    assert.equal(res.ok, true, (a.power || a.nudge || a.type) + ' ' + res.reason);
    assert.equal(knowledge(w), before, 'action changed knowledge');
  }
  assert.ok(!w.events.slice(firstEvent).some(e => ['discovery', 'rediscovery', 'taught', 'learned_from_structure'].includes(e.kind)));
  ok('all 12 action types leave world.discoveries and every knows unchanged, and emit no knowledge events');
}

console.log('\ntest-actions: all passed');
