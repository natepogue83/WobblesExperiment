// lab/creature.js — a creature that learns what happens when it acts.
//
// It senses only what is visible, has a few primitive actions, needs that
// make some outcomes valuable, and a memory of (what I saw, what I did) ->
// (what happened, how it felt). Curiosity rewards what it is still learning.
// Seeing another creature act gives a weaker memory than doing it yourself.
// No recipes, no hidden property is ever read here.
import { rngFor } from '../src/sim/rng.js';
import { MATERIALS, cellAt, objectsAt, live, lookAt, featureKey, isNight, emit, sparksAt, stackHeight, covered, walled, cutTree, splitLog, protectedAt, addObject, indexObjects, W, H } from './world.js';

// Predator-risk learning (v3). Everything a creature learns about the predator lives here or in
// experience keys that start with 'dark beast'. The 'noRiskLearn' switch removes exactly this, and
// nothing else; see lab/research/RISK-LEARNING.md for the contract and tests/test-lab-audit.js.
export const PLACE_KINDS = ['fire', 'walls', 'roof', 'crowd', 'open'];
const isRiskKey = key => key.startsWith('dark beast');
export function learnRisk(c, place, weight) { if (c.noRiskLearn) return; c.risk[place] = Math.max(0, (c.risk[place] || 0) + weight); }

export const ACTIONS = ['pickup', 'place', 'taste', 'strike', 'approach', 'climb', 'watch', 'beckon', 'rest', 'flee', 'wander'];
const VIEW = 3;             // how far they see
const REACH = 1;            // adjacent cells

export function makeCreature(world, id, genome, x, y) {
  const c = {
    id, x, y, carrying: null, alive: true,
    needs: { energy: 0.8, warmth: 0.8, rest: 0.9, social: 0.7 },
    // Inherited: how they learn and what moves them. Changes slowly, by evolution only.
    genome: { curiosity: 0.5, patience: 0.5, sociability: 0.5, learnRate: 1, caution: 0.5, brawn: 0.5, ...genome },
    // Learned: expectations about (seen features, action) -> outcomes, and a few episodes.
    exp: new Map(), episodes: [], places: {},
    plan: null, bonds: {}, born: world.tick, acted: 0, lifespan: 60 * 24, parents: null, builds: [],
    offspring: 0,
    // Measured at night, after acting (see sim.js): where it was and what it actually did.
    night: { ticks: 0, fire: 0, walls: 0, roof: 0, crowd: 0, open: 0, exposed: 0, rested: 0, restedProtected: 0, ate: 0, fled: 0, attacked: 0 },
    noRiskLearn: !!world.opts.noRiskLearn, noObserve: false, did: null, didOutcome: null, attackProcessed: -1,
    risk: {}, vuln: { ticks: 0, default: 0, targeted: 0, exposure: 0, direct: 0, restOpen: 0 }
  };
  world.creatures.push(c);
  return c;
}

// ---- memory ----------------------------------------------------------------------------
function expKey(fk, action, with_) { return `${fk}>${action}${with_ ? '+' + with_ : ''}`; }
export function remember(c, key, outcome, delta, weight = 1) {
  if (c.noRiskLearn && isRiskKey(key)) return;
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
function beasts(world, c, d = VIEW + 2) { return (world.prowlers || []).filter(p => !p.gone && near(c, p, d)); }
// The nearest spot that would keep a beast off: by a fire, inside walls, or in a crowd.
function safeSpot(world, c) {
  let best = null, bd = 99; const idx = indexObjects(world);
  for (const cell of world.cells) { if (cell.water) continue; const d = Math.max(Math.abs(cell.x - c.x), Math.abs(cell.y - c.y)); if (d > VIEW + 2 || d >= bd) continue; if (cell.heat > 0 || walled(world, cell.x, cell.y, idx)) { best = cell; bd = d; } }
  if (!best) { const crowd = others(world, c, VIEW + 2).filter(k => others(world, k, 1).length >= 1)[0]; if (crowd) best = { x: crowd.x, y: crowd.y }; }
  return best;
}
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
  const idx = indexObjects(world);   // one pass over the objects for all the cell questions below
  notePlaces(world, c);
  const seenKeys = new Set(seen.map(o => featureKey(lookAt(world, o))));
  const carryFk = c.carrying ? featureKey(lookAt(world, c.carrying)) : null;
  const me = stackHeight(world, c.x, c.y, idx) >= 1 ? 'high' : 'low';
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
  if (c.carrying) {
    out.push({ action: 'place', target: null, key: expKey('ground', 'place', carryFk) });
    // or just beside me (that is how a wall goes up around a sleeping place)
    const side = [[1, 0], [-1, 0], [0, 1], [0, -1]][(c.acted + c.x) % 4], bc = cellAt(world, c.x + side[0], c.y + side[1]);
    if (bc && !bc.water && !objectsAt(world, bc.x, bc.y).some(o => MATERIALS[o.kind].fixed)) out.push({ action: 'place', target: { x: bc.x, y: bc.y, cell: true, kind: null }, key: expKey('beside', 'place', carryFk) });
  }
  // Climb onto a stack next to me.
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const cx = c.x + dx, cy = c.y + dy; if (stackHeight(world, cx, cy, idx) >= 1) out.push({ action: 'climb', target: { x: cx, y: cy, kind: null, cell: true }, key: expKey('stack', 'climb') }); }
  for (const k of others(world, c)) { out.push({ action: 'watch', target: k, key: expKey('creature', 'watch') }); if ((c.bonds[k.id] || 0) > 0.1) out.push({ action: 'beckon', target: k, key: expKey('creature', 'beckon') }); }
  // A beast in sight: run for somewhere safe, or hit it with what I carry.
  for (const b of beasts(world, c)) {
    const safe = safeSpot(world, c);
    out.push({ action: 'flee', target: safe ? { x: safe.x, y: safe.y, cell: true, kind: null } : null, beast: b, key: expKey('dark beast', 'flee', safe ? (cellAt(world, safe.x, safe.y).heat > 0 ? 'fire' : walled(world, safe.x, safe.y) ? 'walls' : 'crowd') : 'away') });
    if (c.carrying) out.push({ action: 'strike', target: b, key: expKey('dark beast', 'strike', carryFk) });
  }
  // Rest here, or go and rest somewhere particular: by a fire, under a roof, inside walls.
  const when = isNight(world) ? 'night' : 'day';
  out.push({ action: 'rest', target: null, key: expKey(when, 'rest', placeKind(world, c.x, c.y, idx)) });
  const spots = [];
  for (let dy = -VIEW; dy <= VIEW; dy++) for (let dx = -VIEW; dx <= VIEW; dx++) { const cell = cellAt(world, c.x + dx, c.y + dy); if (!cell || cell.water || (!dx && !dy)) continue; const pk = placeKind(world, cell.x, cell.y, idx); if (pk !== 'open' && !spots.some(s => s.pk === pk)) spots.push({ pk, cell }); }
  for (const s of spots) out.push({ action: 'rest', target: { x: s.cell.x, y: s.cell.y, cell: true, kind: null }, key: expKey(when, 'rest', s.pk) });
  out.push({ action: 'wander', target: null, key: 'wander' });
  return out;
}

// What kind of place a cell is, in visible terms.
export function placeKind(world, x, y, idx) {
  const cell = cellAt(world, x, y);
  if (cell && cell.heat > 0) return 'fire';
  if (covered(world, x, y, idx)) return 'roof';
  if (walled(world, x, y, idx)) return 'walls';
  return 'open';   // crowds move, so a resting place is never 'crowd'; attacks in a crowd are recorded as 'crowd'
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
  if (opt.action === 'rest') {
    s += (1 - n.rest) * 1.6 + (isNight(world) ? 0.4 : 0) - 0.3;
    // Instinct after a fright: for some days, the careful want to sleep somewhere closed in or by a fire.
    const pk = opt.key.split('+')[1];
    if (isNight(world) && pk && pk !== 'open') s += g.caution * 0.25;
    if (!c.noRiskLearn && c.attackedAt && world.tick - c.attackedAt.t < 10 * 24 && isNight(world)) s += pk && pk !== 'open' ? g.caution * 0.8 : -g.caution * 0.6;
    if (isNight(world)) s -= 0.5 * Math.min(3, c.risk[pk || 'open'] || 0) * (0.5 + g.caution);
  }
  if (opt.action === 'flee') { const d = Math.max(Math.abs(opt.beast.x - c.x), Math.abs(opt.beast.y - c.y)); s += 1.2 + g.caution * 1.5 - d * 0.12 + (e ? e.value : 0); if (protectedAt(world, c.x, c.y, world.creatures)) s -= 1.6; }
  if (opt.action === 'strike' && opt.target && opt.target.came !== undefined) { const sz = lookAt(world, c.carrying).size; s += ({ big: 0.5, mid: 0.3, small: 0.1 }[sz] || 0) + g.brawn * 0.35 - g.caution * 0.8 + (e ? e.value * 2 : 0); }
  if (opt.action === 'watch') s += g.sociability * (0.05 + (1 - n.social) * 0.7) + (c.parents && c.parents.includes(opt.target.id) && world.tick - c.born < 10 * 24 ? 0.6 : 0);
  if (opt.action === 'wander') s += 0.15 + (1 - n.energy) * 0.3;
  if (opt.action === 'climb') s -= 0.1;
  if (opt.action === 'beckon') { if (world.tick - (c.lastBeckon || -99) < 36 || (opt.target.plan && opt.target.plan.action === 'watch')) return -Infinity; let known = 0; for (const v of c.exp.values()) if (v.n >= 4 && v.value > 0.08) known++; s += known ? g.sociability * 0.3 + (1 - n.social) * 0.2 - 0.4 : -1; }
  // Instinct: when cold, warm-looking things draw you (what happens there is still learned).
  if (opt.action === 'approach') s += ((opt.target.burning > 0) || (cellAt(world, opt.target.x, opt.target.y) || {}).heat > 0 ? (1 - n.warmth) * 1.8 : 0) - 0.35;
  if (opt.action === 'rest' && cell0(world, c).heat > 0) s += (1 - n.warmth) * 1.2;
  // The place where a beast got me stays frightening for a while.
  if (!c.noRiskLearn && c.attackedAt && world.tick - c.attackedAt.t < 6 * 24 && (opt.action === 'rest' || opt.action === 'wander')) { const px = opt.target ? opt.target.x : c.x, py = opt.target ? opt.target.y : c.y; if (Math.max(Math.abs(px - c.attackedAt.x), Math.abs(py - c.attackedAt.y)) <= 1) s -= g.caution * 0.9; }
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
  if (world.opts.noBreed) return;
  const live = world.creatures.filter(c => c.alive);
  if (live.length >= (world.opts.popCap || 12)) return;
  const r = rngFor(world.seed, 'breed', world.tick);
  for (let i = live.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [live[i], live[j]] = [live[j], live[i]]; }
  for (const a of live) {
    if (world.tick - a.born < 8 * 24 || a.needs.energy < 0.7) continue;
    const b = live.find(k => k !== a && Math.abs(k.x - a.x) <= 1 && Math.abs(k.y - a.y) <= 1 && world.tick - k.born >= 8 * 24 && k.needs.energy >= 0.7 && (a.bonds[k.id] || 0) + (k.bonds[a.id] || 0) >= 0.4);
    if (!b || r() > 0.02) continue;
    const g = {};
    for (const key of Object.keys(a.genome)) { const v = r() < 0.5 ? a.genome[key] : b.genome[key]; g[key] = Math.max(0.05, Math.min(1.6, v + (r() - 0.5) * 0.16)); }
    const id = 'c' + (world.creatures.length + 1);
    const child = makeCreature(world, id, g, a.x, a.y);
    child.parents = [a.id, b.id]; child.needs.energy = 0.6; a.offspring++; b.offspring++;
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
  c.needs.energy = Math.max(0, c.needs.energy - 0.0035 * (0.85 + 0.3 * c.genome.brawn));
  c.needs.rest = Math.max(0, c.needs.rest - 0.004);
  c.needs.social = Math.max(0, c.needs.social - 0.003);
  const cold = isNight(world) && world.opts.nightCold ? 0.012 : 0.002;
  c.needs.warmth = Math.min(1, Math.max(0, c.needs.warmth - cold + (cell ? cell.heat * 0.07 : 0)));
  if (c.needs.warmth < 0.2) c.needs.energy = Math.max(0, c.needs.energy - 0.004);   // shivering burns food
  if (world.tick - c.born > c.lifespan) { c.alive = false; emit(world, { kind: 'died', who: c.id, cause: 'old age', x: c.x, y: c.y }); return; }
  if (c.needs.energy <= 0) { c.alive = false; emit(world, { kind: 'died', who: c.id, cause: c.needs.warmth < 0.2 ? 'cold and hunger' : 'hunger', x: c.x, y: c.y }); return; }

  // Mauled since my last step: remember it, once, against what I was doing, and where.
  if (!c.alive) return;
  c.did = 'nothing'; c.didOutcome = null;
  if (world.opts.wipeDaily && world.tick % 24 === 5) { c.exp.clear(); c.episodes = []; c.places = {}; c.builds = []; c.plan = null; c.attackedAt = null; c.risk = {}; }   // bonds are kept
  if (c.attackedAt && c.attackedAt.t !== c.attackProcessed) {
    c.attackProcessed = c.attackedAt.t;
    const place = c.attackedAt.place || placeKind(world, c.attackedAt.x, c.attackedAt.y);
    learnRisk(c, place, 1);
    c.plan = null;
    if (!world.opts.noWatch) for (const k of others(world, c, 3)) { if (k.noObserve) continue; learnRisk(k, place, 0.3); emit(world, { kind: 'saw', who: k.id, whom: c.id, key: 'attack@' + place, outcome: 'attacked', x: k.x, y: k.y }); }
  }
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
  if (p.target && p.target.cell && (p.action === 'rest' || p.action === 'flee') && (c.x !== p.target.x || c.y !== p.target.y)) { stepToward(world, c, p.target.x, p.target.y); if (p.action === 'flee') stepToward(world, c, p.target.x, p.target.y); c.needs.energy -= 0.002; c.did = p.action === 'flee' ? 'flee' : 'move'; if (p.action === 'flee' && (c.x !== p.target.x || c.y !== p.target.y)) return; if (p.action === 'rest') return; }
  else if (p.target && !near(c, p.target)) { stepToward(world, c, p.target.x, p.target.y); c.needs.energy -= 0.002; c.did = 'move'; return; }
  if (p.action === 'wander') { const tx = Math.floor(r() * W), ty = Math.floor(r() * (H - 1)); stepToward(world, c, tx, ty); c.plan = null; c.did = 'move'; return; }

  // Do it, see what happens, remember.
  let outcome = 'nothing';
  let tgt = p.target;
  if (tgt && tgt.remembered) {
    const real = objectsAt(world, tgt.x, tgt.y).find(o => featureKey(lookAt(world, o)) === tgt.remembered);
    if (!real) { outcome = 'gone'; delete c.places[tgt.remembered]; remember(c, p.key, outcome, -0.02, 0.5); c.plan = null; c.did = 'move'; return; }
    tgt = real;
  }
  switch (p.action) {
    case 'pickup': {
      if (tgt && !tgt.gone && !tgt.held && MATERIALS[tgt.kind].weight <= 3.5 + c.genome.brawn && !MATERIALS[tgt.kind].fixed) {
        if (tgt.burning > 0) { outcome = 'hurt'; c.needs.warmth = Math.min(1, c.needs.warmth + 0.05); }
        else { tgt.held = c.id; c.carrying = tgt; outcome = MATERIALS[tgt.kind].weight >= 3 ? 'heavy' : 'held'; }
      }
      break;
    }
    case 'place': {
      const o = c.carrying; if (!o) break;
      const x = tgt ? tgt.x : c.x, y = tgt ? tgt.y : c.y;
      if (tgt && tgt.cell) tgt = null;   // an empty spot beside me, not a thing
      o.held = null; o.x = x; o.y = y; c.carrying = null; o.placedBy = c.id; o.placedAt = world.tick;
      c.builds.push({ x, y, key: p.key, t: world.tick }); if (c.builds.length > 20) c.builds.shift();
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
      if (tgt.came !== undefined) {
        // A beast. Hit hard enough and it runs; too soft and it turns on me.
        const m = MATERIALS[o.kind], power = m.weight * m.hard + (m.sharp || 0) * 2 + c.genome.brawn * 1.5;
        if (power >= 2.5 || (power >= 1.5 && r() < 0.4)) { tgt.fled = true; outcome = 'drove_off'; emit(world, { kind: 'drove_off', who: c.id, material: o.kind, x: c.x, y: c.y }); }
        else { outcome = 'mauled'; c.needs.energy = Math.max(0.02, c.needs.energy - 0.25); c.hurt = world.tick; c.lastHurt = world.tick; c.attackedAt = { x: c.x, y: c.y, t: world.tick, place: placeKind(world, c.x, c.y) }; tgt.fed = 1; emit(world, { kind: 'attacked', who: c.id, x: c.x, y: c.y, struckBack: true }); }
        break;
      }
      const mo = MATERIALS[o.kind], mt = MATERIALS[tgt.kind];
      const power = 1 + (mo.sharp || 0) + (mo.long ? 1 : 0) + c.genome.brawn;
      if (mo.hard >= 0.9 && mt.hard >= 0.9 && !mo.sharp && !mt.sharp) {
        // Stone on stone: sparks fly, and now and then a sharp shard breaks off.
        if (r() < 0.5) {
          outcome = 'sparks'; emit(world, { kind: 'sparks', who: c.id, x: tgt.x, y: tgt.y });
          const lit = sparksAt(world, tgt.x, tgt.y, r);
          if (lit) { outcome = 'fire_grew'; lit.litBy = c.id; emit(world, { kind: 'made_fire', who: c.id, obj: lit.id, material: lit.kind, x: lit.x, y: lit.y }); }
        } else if (r() < 0.3) { addObject(world, 'shard', tgt.x, tgt.y, { madeBy: c.id }); outcome = 'shard'; emit(world, { kind: 'made_shard', who: c.id, x: tgt.x, y: tgt.y }); }
        else outcome = 'thud';
      }
      else if (mo.sharp && tgt.kind === 'tree') { outcome = cutTree(world, tgt, power, c.id); if (outcome === 'felled') c.needs.rest -= 0.05; }
      else if (mo.sharp && tgt.kind === 'log') outcome = splitLog(world, tgt, c.id);
      else if (mo.sharp && !mo.long && tgt.kind === 'stick' && r() < 0.4) {
        // A shard driven into a stick stays there: now I hold a shard on a stick.
        tgt.gone = true; o.kind = 'axe'; outcome = 'joined'; emit(world, { kind: 'joined', who: c.id, obj: o.id, x: tgt.x, y: tgt.y });
      }
      else if (mo.hard > mt.hard + 0.3 && mt.nourish > 0.3) { outcome = 'cracked'; tgt.kind = 'berry'; }   // a cracked root is easy eating
      else outcome = 'thud';
      break;
    }
    case 'flee': {
      // Got away from it, or at least got somewhere.
      if (!p.target) { const b = p.beast; stepToward(world, c, c.x + Math.sign(c.x - b.x) * 3, c.y + Math.sign(c.y - b.y) * 3); stepToward(world, c, c.x + Math.sign(c.x - b.x) * 3, c.y + Math.sign(c.y - b.y) * 3); }
      outcome = protectedAt(world, c.x, c.y, world.creatures) ? 'safe' : 'ran';
      break;
    }
    case 'approach': {
      if (tgt && !tgt.gone) outcome = cell0(world, c).heat > 0 ? 'warmer' : 'nearby';
      break;
    }
    case 'beckon': {
      // A friend comes to watch; what they see of me next, they remember better.
      if (tgt && tgt.alive && (!tgt.plan || ['wander', 'watch', 'rest'].includes(tgt.plan.action))) { tgt.plan = { action: 'watch', target: c, key: expKey('creature', 'watch'), since: world.tick, invited: true }; outcome = 'company'; c.lastBeckon = world.tick; c.needs.social = Math.min(1, c.needs.social + 0.05); emit(world, { kind: 'beckoned', who: c.id, whom: tgt.id, x: c.x, y: c.y }); }
      break;
    }
    case 'watch': {
      if (tgt && tgt.alive) { c.needs.social = Math.min(1, c.needs.social + 0.08); c.bonds[tgt.id] = (c.bonds[tgt.id] || 0) + 0.05; outcome = 'company'; }
      break;
    }
    case 'rest': {
      c.needs.rest = Math.min(1, c.needs.rest + 0.1);
      if (covered(world, c.x, c.y)) c.needs.warmth = Math.min(1, c.needs.warmth + 0.02);
      else if (walled(world, c.x, c.y)) c.needs.warmth = Math.min(1, c.needs.warmth + 0.012);
      outcome = cell && cell.heat > 0 ? 'cosy' : covered(world, c.x, c.y) ? 'sheltered' : walled(world, c.x, c.y) ? 'snug' : isNight(world) ? 'cold_rest' : 'rested';
      break;
    }
  }
  if (outcome === 'hurt') c.needs.warmth = Math.max(0, c.needs.warmth - 0.05);
  const delta = needDelta(before, c.needs) + (outcome === 'fire_grew' ? 0.15 : 0) + (outcome === 'hurt' ? -0.2 : 0) + (outcome === 'sparks' ? 0.05 : 0)
    + (outcome === 'shard' ? 0.06 : 0) + (outcome === 'chipped' ? 0.04 : 0) + (outcome === 'felled' ? 0.2 : 0) + (outcome === 'split' ? 0.06 : 0) + (outcome === 'joined' ? 0.1 : 0)
    + (outcome === 'drove_off' ? 0.35 : 0) + (outcome === 'mauled' ? -0.4 : 0) + (outcome === 'safe' ? 0.12 : 0) + (outcome === 'snug' ? 0.01 : 0);
  const riskAct = isRiskKey(p.key), credit = !(c.noRiskLearn && riskAct);
  remember(c, p.key, outcome, delta, 1);
  if (credit && outcome === 'safe') learnRisk(c, placeKind(world, c.x, c.y), -0.2);   // got somewhere the beast could not follow
  if (credit) if (outcome === 'sheltered' || outcome === 'cosy' || outcome === 'ate' || outcome === 'snug' || outcome === 'safe') for (const b of c.builds) if (Math.max(Math.abs(b.x - c.x), Math.abs(b.y - c.y)) <= (outcome === 'snug' || outcome === 'safe' ? 1 : 0) && world.tick - b.t < 400) remember(c, b.key, 'paid_off', Math.max(0.05, delta) * 0.8, 0.5);
  if (credit && delta > 0.08) { let w = 0.5; for (let i = c.episodes.length - 1; i >= 0 && i >= c.episodes.length - 3; i--) { const ep = c.episodes[i]; if (world.tick - ep.t > 10 || ep.key === p.key) continue; remember(c, ep.key, 'led_on', delta * w, 0.4); w *= 0.6; } }
  c.episodes.push({ t: world.tick, key: p.key, outcome, delta }); if (c.episodes.length > 60) c.episodes.shift();
  c.acted++; c.did = p.action; c.didOutcome = outcome;
  emit(world, { kind: 'acted', who: c.id, action: p.action, key: p.key, outcome, x: c.x, y: c.y });
  // Others nearby who were watching (or just looking that way) pick up a weaker memory.
  if (!world.opts.noWatch) for (const k of others(world, c, 2)) {
    if (k.noObserve) continue;
    if (k.noRiskLearn && riskAct) continue;
    const watching = k.plan && k.plan.action === 'watch' && k.plan.target === c;
    const w = watching ? (k.plan.invited ? 0.6 : 0.45) : 0.15;
    const noticed = watching || r() < 0.5;
    if (noticed) remember(k, p.key, outcome, delta, w);
    if (noticed && (watching || ['fire_grew', 'sparks', 'hurt', 'ate', 'felled', 'shard', 'joined', 'drove_off', 'split'].includes(outcome))) emit(world, { kind: 'saw', who: k.id, whom: c.id, key: p.key, outcome, x: k.x, y: k.y });
  }
  c.plan = null;
}

// Human-readable: what does this creature expect to be good?
export function beliefs(c, top = 5) {
  return [...c.exp.entries()].filter(([, e]) => e.n >= 1).sort((a, b) => b[1].value - a[1].value).slice(0, top)
    .map(([k, e]) => ({ key: k, value: +e.value.toFixed(3), n: +e.n.toFixed(1), seen: e.seen, outcomes: e.outcomes }));
}
