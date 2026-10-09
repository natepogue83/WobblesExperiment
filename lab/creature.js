// lab/creature.js — a creature that learns what happens when it acts.
//
// It senses only what is visible, has a few primitive actions, needs that
// make some outcomes valuable, and a memory of (what I saw, what I did) ->
// (what happened, how it felt). Curiosity rewards what it is still learning.
// Seeing another creature act gives a weaker memory than doing it yourself.
// No recipes, no hidden property is ever read here.
import { rngFor } from '../src/sim/rng.js';
import { MATERIALS, cellAt, objectsAt, live, lookAt, featureKey, isNight, emit, sparksAt, stackHeight, covered, W, H } from './world.js';

export const ACTIONS = ['pickup', 'place', 'taste', 'strike', 'approach', 'climb', 'watch', 'rest', 'wander'];
const VIEW = 3;             // how far they see
const REACH = 1;            // adjacent cells

export function makeCreature(world, id, genome, x, y) {
  const c = {
    id, x, y, carrying: null, alive: true,
    needs: { energy: 0.8, warmth: 0.8, rest: 0.9, social: 0.7 },
    // Inherited: how they learn and what moves them. Changes slowly, by evolution only.
    genome: { curiosity: 0.5, patience: 0.5, sociability: 0.5, learnRate: 1, caution: 0.5, ...genome },
    // Learned: expectations about (seen features, action) -> outcomes, and a few episodes.
    exp: new Map(), episodes: [], places: {},
    plan: null, bonds: {}, born: world.tick, acted: 0, lifespan: 60 * 24, parents: null
  };
  world.creatures.push(c);
  return c;
}

// ---- memory ----------------------------------------------------------------------------
function expKey(fk, action, with_) { return `${fk}>${action}${with_ ? '+' + with_ : ''}`; }
export function remember(c, key, outcome, delta, weight = 1) {
  let e = c.exp.get(key);
  if (!e) { e = { n: 0, seen: 0, outcomes: {}, value: 0 }; c.exp.set(key, e); }
  e.n += weight; if (weight < 1) e.seen += 1;
  e.outcomes[outcome] = (e.outcomes[outcome] || 0) + weight;
  // Running mean of how good it felt, weighted; what you did yourself counts most.
  e.value += (delta - e.value) * (weight * c.genome.learnRate) / (e.n + 0.5);
}
export function expect(c, key) { return c.exp.get(key) || null; }
export function knows(c, key, minN = 1) { const e = c.exp.get(key); return !!e && e.n >= minN; }

// ---- senses ----------------------------------------------------------------------------
function near(c, o, d = REACH) { return Math.max(Math.abs(o.x - c.x), Math.abs(o.y - c.y)) <= d; }
function visible(world, c) { return live(world).filter(o => !o.held && near(c, o, o.burning > 0 ? VIEW * 3 : VIEW)); }
function others(world, c, d = VIEW) { return world.creatures.filter(k => k !== c && k.alive && near(c, k, d)); }
function needDelta(before, after) { return (after.energy - before.energy) * 1.0 + (after.warmth - before.warmth) * 1.2 + (after.rest - before.rest) * 0.6 + (after.social - before.social) * 0.5; }

// ---- what could I do right now? ----------------------------------------------------------------
const REMEMBER_FOR = 240;   // ticks a remembered place stays worth a trip
function notePlaces(world, c) {
  for (const o of visible(world, c)) c.places[featureKey(lookAt(world, o))] = { x: o.x, y: o.y, t: world.tick };
}
// Something I remember seeing somewhere, as a target I can walk to.
function remembered(c, fk, p) { return { x: p.x, y: p.y, remembered: fk, kind: null }; }

function options(world, c) {
  const out = [];
  const seen = visible(world, c);
  notePlaces(world, c);
  const seenKeys = new Set(seen.map(o => featureKey(lookAt(world, o))));
  const carryFk = c.carrying ? featureKey(lookAt(world, c.carrying)) : null;
  const me = stackHeight(world, c.x, c.y) >= 1 ? 'high' : 'low';
  for (const o of seen) {
    const fk = featureKey(lookAt(world, o));
    if (!c.carrying) out.push({ action: 'pickup', target: o, key: expKey(fk, 'pickup') });
    out.push({ action: 'approach', target: o, key: expKey(fk, 'approach') });   // go and sit by it
    out.push({ action: 'taste', target: o, key: expKey(fk, 'taste', MATERIALS[o.kind].tall ? me : undefined) });
    if (c.carrying && c.carrying !== o) {
      out.push({ action: 'place', target: o, key: expKey(fk, 'place', carryFk) });     // put what I carry where this is
      out.push({ action: 'strike', target: o, key: expKey(fk, 'strike', carryFk) });   // hit this with what I carry
    }
  }
  // Out of sight but remembered: worth fetching or carrying something to, if experience says so.
  for (const [fk, p] of Object.entries(c.places)) {
    if (seenKeys.has(fk) || world.tick - p.t > REMEMBER_FOR) continue;
    const tgt = remembered(c, fk, p);
    if (!c.carrying) out.push({ action: 'pickup', target: tgt, key: expKey(fk, 'pickup'), far: true });
    else if (fk !== carryFk) { out.push({ action: 'place', target: tgt, key: expKey(fk, 'place', carryFk), far: true }); out.push({ action: 'strike', target: tgt, key: expKey(fk, 'strike', carryFk), far: true }); }
  }
  if (c.carrying) out.push({ action: 'place', target: null, key: expKey('ground', 'place', carryFk) });
  // Climb onto a stack next to me.
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const cx = c.x + dx, cy = c.y + dy; if (stackHeight(world, cx, cy) >= 1) out.push({ action: 'climb', target: { x: cx, y: cy, kind: null, cell: true }, key: expKey('stack', 'climb') }); }
  for (const k of others(world, c)) out.push({ action: 'watch', target: k, key: expKey('creature', 'watch') });
  out.push({ action: 'rest', target: null, key: expKey(isNight(world) ? 'night' : 'day', 'rest') });
  out.push({ action: 'wander', target: null, key: 'wander' });
  return out;
}

// How much I want each option: what I expect it to do for my needs, how much I
// still have to learn about it, and a little company-seeking.
function score(world, c, opt, r) {
  const g = c.genome, n = c.needs;
  const e = expect(c, opt.key);
  let s = 0;
  if (e) {
    // Expected feeling, scaled by how much the need behind it bites right now.
    s += e.value * 3;
    // Chains: if what I carry has led somewhere good when placed/struck, carrying it is worth something.
    if (opt.action === 'pickup') {
      const fk = opt.target.remembered || featureKey(lookAt(world, opt.target));
      let best = 0;
      for (const [k, v] of c.exp) if (k.includes('+' + fk) && v.value > best) best = v.value;
      s += best * 2.2 * (0.5 + g.patience);
    }
  } else if (opt.action === 'pickup') {
    const fk = opt.target.remembered || featureKey(lookAt(world, opt.target));
    let best = 0;
    for (const [k, v] of c.exp) if (k.includes('+' + fk) && v.value > best) best = v.value;
    s += best * 2.2 * (0.5 + g.patience);
  }
  if (opt.far) { if (s <= 0.08 && (!e || e.value <= 0.02)) return -Infinity; s -= 0.4; }
  // Curiosity: things I have tried a few times but not settled are the most interesting.
  const tries = e ? e.n : 0;
  const unsettled = tries < 1 ? 0.7 : tries < 4 ? 1 : tries < 8 ? 0.5 : 0.1;
  s += g.curiosity * unsettled * (opt.action === 'wander' || opt.action === 'rest' || opt.action === 'watch' ? 0.1 : 1.0);
  if (e && e.outcomes.ate) s += (1 - n.energy) * 3 * (e.outcomes.ate / e.n);
  if (e && e.outcomes.fire_grew) s += (1 - n.warmth) * 2 * (e.outcomes.fire_grew / e.n);
  // Needs that bite.
  if (opt.action === 'rest') s += (1 - n.rest) * 1.6 + (isNight(world) ? 0.4 : 0) - 0.3;
  if (opt.action === 'watch') s += g.sociability * (0.05 + (1 - n.social) * 0.7) + (c.parents && c.parents.includes(opt.target.id) && world.tick - c.born < 10 * 24 ? 0.6 : 0);
  if (opt.action === 'wander') s += 0.15 + (1 - n.energy) * 0.3;
  if (opt.action === 'climb') s -= 0.1;
  // Instinct: when cold, warm-looking things draw you (what happens there is still learned).
  if (opt.action === 'approach') s += ((opt.target.burning > 0) || (cellAt(world, opt.target.x, opt.target.y) || {}).heat > 0 ? (1 - n.warmth) * 1.8 : 0) - 0.35;
  if (opt.action === 'rest' && cell0(world, c).heat > 0) s += (1 - n.warmth) * 1.2;
  // Distance costs effort.
  if (opt.target && !near(c, opt.target)) s -= 0.08 * Math.max(Math.abs(opt.target.x - c.x), Math.abs(opt.target.y - c.y));
  // Caution: things that hurt before are avoided by the careful.
  if (e && e.outcomes.hurt) s -= g.caution * 1.5 * (e.outcomes.hurt / e.n);
  s += (r() - 0.5) * 0.25;
  return s;
}

// ---- acting -----------------------------------------------------------------------------------
function cell0(world, c) { return cellAt(world, c.x, c.y) || { heat: 0 }; }
function stepToward(world, c, tx, ty) {
  const dx = Math.sign(tx - c.x), dy = Math.sign(ty - c.y);
  const nx = c.x + dx, ny = c.y + dy;
  const cell = cellAt(world, nx, ny);
  if (cell && !cell.water) { c.x = nx; c.y = ny; return; }
  const alt = cellAt(world, c.x + dx, c.y); if (alt && !alt.water && dx) { c.x += dx; return; }
  const alt2 = cellAt(world, c.x, c.y + dy); if (alt2 && !alt2.water && dy) { c.y += dy; }
}

// Two well-fed adults who like each other, side by side: now and then, a child.
// It inherits a blend of how its parents learn and what moves them, with a
// little mutation, and no memories at all. Culture has to be passed on.
export function breedingStep(world) {
  const live = world.creatures.filter(c => c.alive);
  if (live.length >= (world.opts.popCap || 12)) return;
  const r = rngFor(world.seed, 'breed', world.tick);
  for (const a of live) {
    if (world.tick - a.born < 8 * 24 || a.needs.energy < 0.7) continue;
    const b = live.find(k => k !== a && k.id > a.id && Math.abs(k.x - a.x) <= 1 && Math.abs(k.y - a.y) <= 1 && world.tick - k.born >= 8 * 24 && k.needs.energy >= 0.7 && (a.bonds[k.id] || 0) + (k.bonds[a.id] || 0) >= 0.4);
    if (!b || r() > 0.02) continue;
    const g = {};
    for (const key of Object.keys(a.genome)) { const v = r() < 0.5 ? a.genome[key] : b.genome[key]; g[key] = Math.max(0.05, Math.min(1.6, v + (r() - 0.5) * 0.16)); }
    const id = 'c' + (world.creatures.length + 1);
    const child = makeCreature(world, id, g, a.x, a.y);
    child.parents = [a.id, b.id]; child.needs.energy = 0.6;
    a.needs.energy -= 0.15; b.needs.energy -= 0.15;
    a.bonds[id] = 0.4; b.bonds[id] = 0.4; child.bonds[a.id] = 0.3; child.bonds[b.id] = 0.3;
    emit(world, { kind: 'born', who: id, parents: [a.id, b.id], x: a.x, y: a.y });
    return;
  }
}

export function creatureStep(world, c) {
  if (!c.alive) return;
  const r = rngFor(world.seed, 'cr', c.id, world.tick);
  const before = { ...c.needs };
  // Needs drift. Night is cold unless there is heat here.
  const cell = cellAt(world, c.x, c.y);
  c.needs.energy = Math.max(0, c.needs.energy - 0.0035);
  c.needs.rest = Math.max(0, c.needs.rest - 0.004);
  c.needs.social = Math.max(0, c.needs.social - 0.003);
  const cold = isNight(world) && world.opts.nightCold ? 0.012 : 0.002;
  c.needs.warmth = Math.min(1, Math.max(0, c.needs.warmth - cold + (cell ? cell.heat * 0.07 : 0)));
  if (c.needs.warmth < 0.2) c.needs.energy = Math.max(0, c.needs.energy - 0.004);   // shivering burns food
  if (world.tick - c.born > c.lifespan) { c.alive = false; emit(world, { kind: 'died', who: c.id, cause: 'old age', x: c.x, y: c.y }); return; }
  if (c.needs.energy <= 0) { c.alive = false; emit(world, { kind: 'died', who: c.id, cause: c.needs.warmth < 0.2 ? 'cold and hunger' : 'hunger', x: c.x, y: c.y }); return; }

  // Keep a plan until it is done or no longer makes sense (commitment).
  if (c.plan) {
    const tgt = c.plan.target;
    if (tgt && (tgt.gone || (tgt.held && tgt.held !== c.id))) c.plan = null;
    else if (c.plan.action === 'place' && !c.carrying) c.plan = null;
    else if (c.plan.action === 'pickup' && c.carrying) c.plan = null;
    else if (world.tick - c.plan.since > 12) c.plan = null;
  }
  if (!c.plan) {
    const opts = options(world, c);
    let best = null, bs = -Infinity;
    for (const o of opts) { const s = score(world, c, o, r); if (s > bs) { bs = s; best = o; } }
    c.plan = { ...best, since: world.tick };
  }
  const p = c.plan;
  // Walk there first.
  if (p.target && !near(c, p.target)) { stepToward(world, c, p.target.x, p.target.y); c.needs.energy -= 0.002; return; }
  if (p.action === 'wander') { const tx = Math.floor(r() * W), ty = Math.floor(r() * (H - 1)); stepToward(world, c, tx, ty); c.plan = null; return; }

  // Do it, see what happens, remember.
  let outcome = 'nothing';
  let tgt = p.target;
  if (tgt && tgt.remembered) {
    const real = objectsAt(world, tgt.x, tgt.y).find(o => featureKey(lookAt(world, o)) === tgt.remembered);
    if (!real) { outcome = 'gone'; delete c.places[tgt.remembered]; remember(c, p.key, outcome, -0.02, 0.5); c.plan = null; return; }
    tgt = real;
  }
  switch (p.action) {
    case 'pickup': {
      if (tgt && !tgt.gone && !tgt.held && MATERIALS[tgt.kind].weight <= 4 && !MATERIALS[tgt.kind].fixed) {
        if (tgt.burning > 0) { outcome = 'hurt'; c.needs.warmth = Math.min(1, c.needs.warmth + 0.05); }
        else { tgt.held = c.id; c.carrying = tgt; outcome = MATERIALS[tgt.kind].weight >= 3 ? 'heavy' : 'held'; }
      }
      break;
    }
    case 'place': {
      const o = c.carrying; if (!o) break;
      const x = tgt ? tgt.x : c.x, y = tgt ? tgt.y : c.y;
      o.held = null; o.x = x; o.y = y; c.carrying = null; o.placedBy = c.id; o.placedAt = world.tick;
      const here = cellAt(world, x, y);
      const source = objectsAt(world, x, y).find(s => s.burning > 0 && s !== o);
      if (source) {
        const m = MATERIALS[o.kind];
        if (m.burn > 0 && o.wet < 0.45 && r() < m.burn) {
          const fuel = Math.round(9 * m.burn * Math.max(0.5, m.weight) * (1 - o.wet));
          source.fuel += fuel; o.gone = true; outcome = 'fire_grew';
          emit(world, { kind: 'fed_fire', who: c.id, obj: o.id, material: o.kind, fuel, source: source.id, x, y });
          c.needs.warmth = Math.min(1, c.needs.warmth + 0.08);
        } else if (m.burn > 0 && o.wet >= 0.45) { outcome = 'hiss'; emit(world, { kind: 'hiss', who: c.id, obj: o.id, material: o.kind, x, y }); }
        else outcome = 'placed';
      } else if (here && here.water) { o.wet = 1; outcome = 'splash'; }
      else outcome = 'placed';
      if (tgt && !source && !tgt.gone) { tgt.stacked = (tgt.stacked || 0) + 1; outcome = 'stacked'; }
      emit(world, { kind: 'placed', who: c.id, obj: o.id, material: o.kind, x, y, outcome });
      break;
    }
    case 'climb': { if (tgt && stackHeight(world, tgt.x, tgt.y) >= 1) { c.x = tgt.x; c.y = tgt.y; outcome = 'high'; } break; }
    case 'taste': {
      if (tgt && !tgt.gone) {
        const m = MATERIALS[tgt.kind];
        if (tgt.burning > 0) { outcome = 'hurt'; }
        else if (m.tall) {
          if (stackHeight(world, c.x, c.y) < 1) outcome = 'out_of_reach';
          else if ((tgt.fruit || 0) > 0) { tgt.fruit--; c.needs.energy = Math.min(1, c.needs.energy + m.nourish * 0.6); outcome = 'ate'; const built = objectsAt(world, c.x, c.y).filter(o => o.placedBy).map(o => o.placedBy); emit(world, { kind: 'ate', who: c.id, material: 'tallbush', high: true, built: built.length ? built : null, x: tgt.x, y: tgt.y }); }
          else outcome = 'bare';
        }
        else if (m.nourish > 0.3) { c.needs.energy = Math.min(1, c.needs.energy + m.nourish * 0.6); if (m.weight < 1) tgt.gone = true; outcome = 'ate'; emit(world, { kind: 'ate', who: c.id, material: tgt.kind, x: tgt.x, y: tgt.y }); }
        else outcome = 'bitter';
      }
      break;
    }
    case 'strike': {
      const o = c.carrying; if (!o || !tgt || tgt.gone) break;
      const mo = MATERIALS[o.kind], mt = MATERIALS[tgt.kind];
      if (mo.hard >= 0.9 && mt.hard >= 0.9 && r() < 0.5) {
        outcome = 'sparks'; emit(world, { kind: 'sparks', who: c.id, x: tgt.x, y: tgt.y });
        const lit = sparksAt(world, tgt.x, tgt.y, r);
        if (lit) { outcome = 'fire_grew'; lit.litBy = c.id; emit(world, { kind: 'made_fire', who: c.id, obj: lit.id, material: lit.kind, x: lit.x, y: lit.y }); }
      }
      else if (mo.hard > mt.hard + 0.3 && mt.nourish > 0.3) { outcome = 'cracked'; tgt.kind = 'berry'; }   // a cracked root is easy eating
      else outcome = 'thud';
      break;
    }
    case 'approach': {
      if (tgt && !tgt.gone) outcome = cell0(world, c).heat > 0 ? 'warmer' : 'nearby';
      break;
    }
    case 'watch': {
      if (tgt && tgt.alive) { c.needs.social = Math.min(1, c.needs.social + 0.08); c.bonds[tgt.id] = (c.bonds[tgt.id] || 0) + 0.05; outcome = 'company'; }
      break;
    }
    case 'rest': {
      c.needs.rest = Math.min(1, c.needs.rest + 0.1);
      if (covered(world, c.x, c.y)) c.needs.warmth = Math.min(1, c.needs.warmth + 0.015);
      outcome = cell && cell.heat > 0 ? 'cosy' : covered(world, c.x, c.y) ? 'sheltered' : isNight(world) ? 'cold_rest' : 'rested';
      break;
    }
  }
  if (outcome === 'hurt') c.needs.warmth = Math.max(0, c.needs.warmth - 0.05);
  const delta = needDelta(before, c.needs) + (outcome === 'fire_grew' ? 0.15 : 0) + (outcome === 'hurt' ? -0.2 : 0) + (outcome === 'sparks' ? 0.05 : 0);
  remember(c, p.key, outcome, delta, 1);
  if (delta > 0.08) { let w = 0.5; for (let i = c.episodes.length - 1; i >= 0 && i >= c.episodes.length - 3; i--) { const ep = c.episodes[i]; if (world.tick - ep.t > 10 || ep.key === p.key) continue; remember(c, ep.key, 'led_on', delta * w, 0.4); w *= 0.6; } }
  c.episodes.push({ t: world.tick, key: p.key, outcome, delta }); if (c.episodes.length > 60) c.episodes.shift();
  c.acted++;
  emit(world, { kind: 'acted', who: c.id, action: p.action, key: p.key, outcome, x: c.x, y: c.y });
  // Others nearby who were watching (or just looking that way) pick up a weaker memory.
  for (const k of others(world, c, 2)) {
    const watching = k.plan && k.plan.action === 'watch' && k.plan.target === c;
    const w = watching ? 0.45 : 0.15;
    const noticed = watching || r() < 0.5;
    if (noticed) remember(k, p.key, outcome, delta, w);
    if (noticed && (watching || ['fire_grew', 'sparks', 'hurt', 'ate'].includes(outcome))) emit(world, { kind: 'saw', who: k.id, whom: c.id, key: p.key, outcome, x: k.x, y: k.y });
  }
  c.plan = null;
}

// Human-readable: what does this creature expect to be good?
export function beliefs(c, top = 5) {
  return [...c.exp.entries()].filter(([, e]) => e.n >= 1).sort((a, b) => b[1].value - a[1].value).slice(0, top)
    .map(([k, e]) => ({ key: k, value: +e.value.toFixed(3), n: +e.n.toFixed(1), seen: e.seen, outcomes: e.outcomes }));
}
