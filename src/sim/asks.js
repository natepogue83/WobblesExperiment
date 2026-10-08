// asks.js — small, everyday requests. From day one a Wobblin may look up and ask
// the Keeper for something: berries when hungry, a friend when lonely, rain in a
// dry spell, stones to stack, flowers. Granting it (with the matching act) makes
// them glow and grows belief; ignoring it is fine, they give up after a while.
// The Temple's bigger wishes are culture.js. Deterministic; never adds knowledge.
import { emit } from './events.js';
import { rngFor, chance, pick } from './rng.js';
import { alive, liveObjects, r3, clamp, clamp01 } from './util.js';
import { slotInfo } from './geometry.js';
import { addBelief } from './belief.js';

export const ASK_TICKS = 12;
export const ASK_BELIEF = 2;

function wantFor(world, w, live, objs, r) {
  const alone = !live.some(o => o !== w && o.zone === w.zone);
  const bushes = objs.filter(o => o.kind === 'bush' && (o.state.berries || 0) > 0).length;
  const opts = [];
  if (w.needs.food < 0.45 || bushes < 2) opts.push('berries', 'berries');
  if (alone && w.traits.sociability > 0.4) opts.push('company', 'company');
  if (world.climate.drought > 0.3 || world.climate.wetUntil < world.tick - 12) opts.push('rain', 'rain');
  if (w.hobby === 'stacking stones' || (w.knows.stone_stacking && r() < 0.3)) opts.push('stones');
  if (w.traits.playfulness > 0.55) opts.push('flowers');
  if (!opts.length) opts.push('stones', 'flowers');
  return pick(r, opts);
}

export function asksStep(world) {
  const t = world.tick;
  world.asks ||= [];
  for (const a of world.asks) {
    if (!a.done && t >= a.until) {
      a.done = 'expired';
      emit(world, { kind: 'ask_expired', actors: [a.by], target: a.want, data: { ask: a.id }, salience: 1, causes: [{ event: a.event }] });
    }
  }
  if (world.asks.some(a => !a.done)) return;
  const r = rngFor(world.seed, 'ask', t);
  if (!chance(r, 0.05)) return;
  const live = alive(world).filter(w => w.stage !== 'baby');
  if (!live.length) return;
  const by = pick(r, live);
  const want = wantFor(world, by, alive(world), liveObjects(world), r);
  const id = world.asks.length + 1;
  const ev = emit(world, { kind: 'ask', actors: [by.id], target: want, data: { ask: id, zone: by.zone }, salience: 2 });
  world.asks.push({ id, by: by.id, want, t, until: t + ASK_TICKS, event: ev.id, done: null });
}

// After a valid Keeper act: does it give the asker what they asked for?
export function grantAsks(world, a) {
  if (!world.asks) return;
  for (const ask of world.asks) {
    if (ask.done) continue;
    const w = world.wobblins.find(x => x.id === ask.by);
    if (!w || !w.alive) { ask.done = 'expired'; continue; }
    const near = slot => !!slot && slotInfo(slot) && slotInfo(slot).zone === w.zone;
    const ok =
      (ask.want === 'berries' && a.type === 'power' && a.power === 'plant' && a.variant === 'bush') ||
      (ask.want === 'stones' && a.type === 'power' && a.power === 'stone' && (near(a.slot) || a.onto === w.id)) ||
      (ask.want === 'rain' && a.type === 'power' && a.power === 'rain') ||
      (ask.want === 'company' && a.type === 'nudge' && a.nudge === 'carry' && a.target !== w.id && (a.zone === w.zone || a.onto === w.id)) ||
      (ask.want === 'flowers' && a.type === 'power' && a.power === 'plant' && (a.onto === w.id || near(a.slot)));
    if (!ok) continue;
    ask.done = 'granted';
    w.needs.mood = r3(clamp01(w.needs.mood + 0.15));
    w.faith = r3(clamp(w.faith + 0.1, -1, 1));
    const ev = emit(world, { kind: 'ask_granted', actors: [w.id], target: ask.want, data: { ask: ask.id }, salience: 3,
      causes: [{ action: a.seq }, { event: ask.event }] });
    addBelief(world, ASK_BELIEF, [{ event: ev.id }]);
  }
}

// The open ask, if any (for the UI).
export function openAsk(world) {
  return (world.asks || []).find(a => !a.done) || null;
}
