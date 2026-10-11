// lab/world.js — a small world with real rules and no recipes.
//
// The world knows what things ARE (a stick burns, a berry nourishes). Creatures
// only ever get what they can SEE (see creature.js senses): colour, size, wet,
// glowing, moving. Everything a creature comes to "know" is learned from what
// happened when it acted. Deterministic: all randomness through rngFor.
import { rngFor } from '../src/sim/rng.js';

export const W = 18, H = 12;
export const DAY = 24;              // ticks per day; nights are cold

// Materials: hidden truths. 'look' is what a creature perceives.
// sharp: cuts wood. long: can be held and swung; a sharp thing can be wedged into it.
// hp: how much cutting a standing thing takes before it comes down.
export const MATERIALS = {
  tree: { look: 'tall tree', weight: 30, hard: 0.6, burn: 0.3, absorb: 0.4, nourish: 0, fixed: true, tall: true, hp: 6 },
  sapling: { look: 'thin sapling', weight: 5, hard: 0.3, burn: 0.5, absorb: 0.6, nourish: 0, fixed: true },
  shard: { look: 'sharp shard', weight: 0.5, hard: 1, burn: 0, absorb: 0, nourish: 0, sharp: 1 },
  axe: { look: 'shard on a stick', weight: 1.5, hard: 0.9, burn: 0.3, absorb: 0.3, nourish: 0, sharp: 1, long: 1 },
  stone: { look: 'grey lump', weight: 3, hard: 1, burn: 0, absorb: 0, nourish: 0 },
  stick: { look: 'brown stick', weight: 1, hard: 0.4, burn: 0.8, absorb: 0.5, nourish: 0, long: 1 },
  grass: { look: 'pale tuft', weight: 0.3, hard: 0, burn: 0.9, absorb: 0.9, nourish: 0.05 },
  log: { look: 'brown trunk', weight: 4, hard: 0.6, burn: 0.7, absorb: 0.3, nourish: 0, long: 1 },
  berry: { look: 'red bead', weight: 0.2, hard: 0, burn: 0.2, absorb: 0.2, nourish: 0.6 },
  root: { look: 'knobbly lump', weight: 0.8, hard: 0.7, burn: 0.3, absorb: 0.3, nourish: 0.4 },
  ember: { look: 'glowing lump', weight: 2, hard: 0.5, burn: 0, absorb: 0, nourish: 0, source: true },
  tallbush: { look: 'tall bush with red beads', weight: 9, hard: 0.3, burn: 0.5, absorb: 0.6, nourish: 0.6, fixed: true, tall: true, fruit: 6 }
};

export function createLab(seed, opts = {}) {
  const r = rngFor(seed, 'lab');
  const cells = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // A stream along the bottom; grassy meadow; a stony rise top-left.
    const water = y === H - 1 && x % 7 !== 3;
    const stony = x < 5 && y < 4;
    cells.push({ x, y, water, stony, wet: water ? 1 : 0, heat: 0, grass: !water && !stony && r() < 0.5 ? 1 : 0 });
  }
  const world = {
    seed, tick: 0, cells, objects: [], creatures: [], events: [], nextId: 1,
    weather: { rain: 0, lean: 0 }, opts: { rainEvery: 96, rainFor: 4, nightCold: true, threat: true, leanEvery: 30 * DAY, leanFor: 6 * DAY, ...opts }
  };
  // Scatter materials.
  const spawn = (kind, n, where) => { for (let i = 0; i < n; i++) { const c = where(); addObject(world, kind, c.x, c.y); } };
  const land = () => { for (;;) { const c = cells[Math.floor(r() * cells.length)]; if (!c.water) return c; } };
  const grassy = () => { for (;;) { const c = land(); if (c.grass) return c; } };
  spawn('stick', 14, land); spawn('grass', 12, grassy); spawn('log', 4, land); spawn('stone', 8, () => { for (;;) { const c = land(); if (c.stony || r() < 0.2) return c; } });
  spawn('berry', opts.berries ?? 24, grassy); spawn('root', 8, land);
  for (let i = 0; i < (opts.tallbushes ?? 2); i++) { const c = grassy(); addObject(world, 'tallbush', c.x, c.y, { fruit: 6 }); }
  for (let i = 0; i < (opts.trees ?? 5); i++) { const c = land(); if (objectsAt(world, c.x, c.y).some(o => MATERIALS[o.kind].fixed)) continue; addObject(world, 'tree', c.x, c.y, { hp: 6 }); }
  world.prowlers = [];
  return world;
}

export function cellAt(world, x, y) { return x >= 0 && y >= 0 && x < W && y < H ? world.cells[y * W + x] : null; }
export function addObject(world, kind, x, y, state = {}) {
  const m = MATERIALS[kind];
  const o = { id: 'o' + world.nextId++, kind, x, y, wet: 0, burning: 0, fuel: m.source ? 40 : 0, held: null, gone: false, ...state };
  world.objects.push(o);
  return o;
}
export function objectsAt(world, x, y, idx) { if (idx) return x >= 0 && y >= 0 && x < W && y < H ? idx.get(y * W + x) || EMPTY : EMPTY; return world.objects.filter(o => !o.gone && !o.held && o.x === x && o.y === y); }
const EMPTY = Object.freeze([]);
// Everything lying in each cell, built once when many cells are about to be asked.
export function indexObjects(world) { const m = new Map(); for (const o of world.objects) { if (o.gone || o.held) continue; const k = o.y * W + o.x; let a = m.get(k); if (!a) m.set(k, a = []); a.push(o); } return m; }
export function live(world) { return world.objects.filter(o => !o.gone); }
export function emit(world, ev) { world.events.push({ t: world.tick, ...ev }); return ev; }

export function isNight(world) { const h = world.tick % DAY; return h >= 16 || h < 5; }

// ---- physics: weather, wetness, heat and fire, growth -------------------------------
export function worldStep(world) {
  const t = world.tick, r = rngFor(world.seed, 'phys', t);
  const o = world.opts;
  // Rain comes in spells.
  world.weather.rain = (t % o.rainEvery) < o.rainFor && t > 10 ? 1 : 0;
  // Lean seasons: for a stretch every so often, little grows. Then what was learned about high fruit, roots and stores matters.
  const lean = o.leanEvery && t > 12 * DAY && (t % o.leanEvery) < o.leanFor ? 1 : 0;
  if (lean && !world.weather.lean) emit(world, { kind: 'lean_began', x: 0, y: 0 }); if (!lean && world.weather.lean) emit(world, { kind: 'lean_ended', x: 0, y: 0 });
  world.weather.lean = lean;
  for (const c of world.cells) { c.heat = 0; if (world.weather.rain) c.wet = 1; else if (!c.water) c.wet = Math.max(0, c.wet - 0.05); }
  // Heat from burning things.
  for (const ob of live(world)) if (ob.burning > 0 && !ob.held) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const c = cellAt(world, ob.x + dx, ob.y + dy); if (c) c.heat = Math.max(c.heat, dx || dy ? 0.5 : 1); }
  }
  for (const ob of live(world)) {
    const m = MATERIALS[ob.kind];
    const c = cellAt(world, ob.x, ob.y);
    // Wetting and drying. Heat dries fast.
    if (!ob.held) {
      if (world.weather.rain && !covered(world, ob.x, ob.y)) ob.wet = Math.min(1, ob.wet + 0.5 * (0.3 + m.absorb));
      else ob.wet = Math.max(0, ob.wet - (isNight(world) ? 0.03 : 0.07) - (c ? c.heat * 0.3 : 0));
      if (c && c.water) ob.wet = 1;
    }
    // Fire: a source burns its fuel down; rain and wetness smother it.
    if (ob.burning > 0) {
      ob.fuel -= 1;
      if (world.weather.rain) ob.fuel -= 0.8;
      if (ob.fuel <= 0) { ob.burning = 0; ob.fuel = 0; emit(world, { kind: 'fire_out', obj: ob.id, x: ob.x, y: ob.y }); if (m.source) ob.kind = 'stone'; else ob.gone = true; }
    }
    // Dry burnable things in a hot cell catch and feed the fire there.
    if (!ob.held && ob.burning === 0 && m.burn > 0 && c && c.heat >= 1 && ob.wet < 0.45) {
      const source = objectsAt(world, ob.x, ob.y).find(s => s.burning > 0);
      if (source && r() < m.burn) {
        const fuel = Math.round(9 * m.burn * Math.max(0.5, m.weight) * (1 - ob.wet));
        source.fuel += fuel; ob.gone = true;
        emit(world, { kind: 'fed_fire', obj: ob.id, material: ob.kind, fuel, source: source.id, x: ob.x, y: ob.y });
      }
    }
    if (!ob.held && ob.burning === 0 && m.burn > 0 && c && c.heat >= 1 && ob.wet >= 0.45 && objectsAt(world, ob.x, ob.y).some(s => s.burning > 0)) {
      if (!ob.hissed || t - ob.hissed > 3) { ob.hissed = t; emit(world, { kind: 'hiss', obj: ob.id, material: ob.kind, x: ob.x, y: ob.y }); }
    }
  }
  prowlerStep(world, r);
  // Growth: grass tufts and berries come back slowly; tall bushes refruit.
  if (t % 12 === 0) {
    for (const ob of live(world)) if (ob.kind === 'tallbush' && (ob.fruit || 0) < 6 && r() < (world.weather.lean ? 0.3 : 0.5)) ob.fruit = (ob.fruit || 0) + 1;
    for (const ob of live(world)) if (ob.kind === 'grass' && !ob.held && ob.grown !== undefined && t - ob.grown > 15 * DAY && r() < 0.3) ob.gone = true;
    // Saplings grow into trees in about twelve days; a few saplings come up where nothing stands.
    for (const ob of live(world)) if (ob.kind === 'sapling' && t - (ob.planted || 0) > 12 * DAY) { ob.kind = 'tree'; ob.hp = 6; emit(world, { kind: 'grew', obj: ob.id, x: ob.x, y: ob.y }); }
    if (r() < 0.25 && live(world).filter(o => o.kind === 'tree' || o.kind === 'sapling').length < 9) { const c = world.cells[Math.floor(r() * world.cells.length)]; if (!c.water && !c.stony && !objectsAt(world, c.x, c.y).length) addObject(world, 'sapling', c.x, c.y, { planted: t }); }
    for (const c of world.cells) {
      if (!c.grass || r() >= (world.weather.lean ? 0.09 : 0.22)) continue;
      const here = objectsAt(world, c.x, c.y);
      if (here.some(o => MATERIALS[o.kind].fixed) || here.length >= 4) continue;
      // Berries come back where there are none; a tuft only where there is no tuft.
      if (r() < 0.45) { if (!here.some(o => o.kind === 'grass')) addObject(world, 'grass', c.x, c.y, { grown: t }); }
      else if (!here.some(o => o.kind === 'berry')) addObject(world, 'berry', c.x, c.y, { grown: t });
    }
  }
}

// Sparks struck at (x, y): dry tinder there (or right next to it) may catch and
// become a small fire of its own. Nobody is told this; it is just how the world is.
export function sparksAt(world, x, y, r) {
  const here = world.objects.filter(o => !o.gone && !o.held && o.burning === 0 && Math.max(Math.abs(o.x - x), Math.abs(o.y - y)) <= 1);
  const tinder = here.filter(o => MATERIALS[o.kind].burn >= 0.75 && o.wet < 0.2);
  if (!tinder.length) return null;
  const o = tinder[0];
  const m = MATERIALS[o.kind];
  if (r() > 0.35 * m.burn) return null;
  o.burning = 1; o.fuel = Math.round(9 * m.burn * Math.max(0.5, m.weight)) + 4;
  emit(world, { kind: 'caught_fire', obj: o.id, material: o.kind, x: o.x, y: o.y });
  return o;
}

// How high the hard things in a cell are stacked (stones and logs make footing; sticks and grass don't).
export function stackHeight(world, x, y, idx) {
  let h = 0;
  for (const o of objectsAt(world, x, y, idx)) { const m = MATERIALS[o.kind]; if (m.fixed || o.burning) continue; if (m.hard >= 0.6 && m.weight >= 3) h += 1; else if (m.hard >= 0.6) h += 0.5; }
  return Math.floor(h);
}
// A cell is covered when something big and long (a trunk) lies on top of a stack at least one high.
export function covered(world, x, y, idx) {
  const here = objectsAt(world, x, y, idx);
  return stackHeight(world, x, y, idx) >= 1 && here.some(o => o.kind === 'log') && here.filter(o => MATERIALS[o.kind].hard >= 0.6 && MATERIALS[o.kind].weight >= 3).length >= 2;
}

// A cell is walled when three or more of its four sides are blocked by a stack, a standing
// tree or bush, or water. Nothing big can get in; it is also a little warmer out of the wind.
export function walled(world, x, y, idx) {
  let sides = 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const c = cellAt(world, x + dx, y + dy);
    if (!c || c.water || stackHeight(world, x + dx, y + dy, idx) >= 1 || objectsAt(world, x + dx, y + dy, idx).some(o => MATERIALS[o.kind].fixed)) sides++;
  }
  return sides >= 3;
}
// Cutting into a standing tree with something sharp. Enough cuts and it comes down as wood.
export function cutTree(world, tree, power, who) {
  tree.hp = (tree.hp ?? MATERIALS.tree.hp) - power;
  if (tree.hp > 0) return 'chipped';
  tree.gone = true;
  const spots = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1]].map(([dx, dy]) => cellAt(world, tree.x + dx, tree.y + dy)).filter(c => c && !c.water);
  const drops = ['log', 'log', 'stick', 'stick', 'stick'];
  drops.forEach((k, i) => { const c = spots[i % spots.length]; addObject(world, k, c.x, c.y, { felledBy: who }); });
  emit(world, { kind: 'felled', who, obj: tree.id, x: tree.x, y: tree.y });
  return 'felled';
}
// A trunk struck with something sharp splits into sticks.
export function splitLog(world, log, who) {
  log.gone = true;
  for (let i = 0; i < 3; i++) addObject(world, 'stick', log.x, log.y, { splitBy: who });
  emit(world, { kind: 'split', who, obj: log.id, x: log.x, y: log.y });
  return 'split';
}

// ---- the prowler: a hungry thing that comes out of the dark ------------------------------------
// It wants a creature on its own, in the open. Fire, walls and a crowd keep it off. It never
// learns; it is weather with teeth. What the creatures make of it, they make themselves.
export function protectedAt(world, x, y, creatures) {
  const c = cellAt(world, x, y);
  if (!c) return true;
  if (c.heat > 0 || walled(world, x, y)) return true;
  if (world.opts.threatMode === 'targeted') return false;   // numbers do not help against this one
  let company = 0; for (const k of creatures) if (k.alive && Math.max(Math.abs(k.x - x), Math.abs(k.y - y)) <= 1) company++;
  return company >= 3;
}
export function prowlerStep(world, r) {
  if (!world.opts.threat) return;
  world.prowlers = world.prowlers || [];
  const night = isNight(world);
  // One at a time; it comes on some nights, from the edge, and goes at dawn.
  if (!world.prowlers.length) {
    if (night && world.tick > 5 * DAY && r() < (world.opts.threatChance ?? 0.02)) {
      const edges = world.cells.filter(c => !c.water && (c.x === 0 || c.y === 0 || c.x === W - 1 || c.y === H - 2));
      const c = edges[Math.floor(r() * edges.length)];
      world.prowlers.push({ id: 'p' + world.tick, x: c.x, y: c.y, came: world.tick, fed: 0 });
      emit(world, { kind: 'prowler_came', x: c.x, y: c.y });
    }
    return;
  }
  for (const p of world.prowlers) {
    if (!night || p.fed >= 1 || p.fled) { p.gone = true; emit(world, { kind: 'prowler_left', x: p.x, y: p.y, fed: p.fed, fled: !!p.fled }); continue; }
    const targeted = world.opts.threatMode === 'targeted';
    const prey = world.creatures.filter(k => k.alive && Math.max(Math.abs(k.x - p.x), Math.abs(k.y - p.y)) <= (targeted ? 9 : 7) && !protectedAt(world, k.x, k.y, world.creatures) && (!targeted || k.lastAction === 'rest'))
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    if (!prey) { // wander the edge, slowly
      if (r() < 0.5) { const dx = Math.floor(r() * 3) - 1, dy = Math.floor(r() * 3) - 1; const c = cellAt(world, p.x + dx, p.y + dy); if (c && !c.water && c.heat === 0) { p.x = c.x; p.y = c.y; } }
      continue;
    }
    if (Math.max(Math.abs(prey.x - p.x), Math.abs(prey.y - p.y)) <= 1) {
      prey.hurt = world.tick; prey.attackedAt = { x: prey.x, y: prey.y, t: world.tick };
      p.fed = 1;
      if (prey.needs.energy < 0.35 || (prey.hurt && world.tick - (prey.lastHurt || -999) < 2 * DAY)) { prey.alive = false; emit(world, { kind: 'died', who: prey.id, cause: 'the beast', x: prey.x, y: prey.y }); emit(world, { kind: 'attacked', who: prey.id, x: prey.x, y: prey.y, killed: true }); }
      else { prey.needs.energy = Math.max(0.05, prey.needs.energy - 0.15); prey.lastHurt = world.tick; emit(world, { kind: 'attacked', who: prey.id, x: prey.x, y: prey.y }); }
      continue;
    }
    const dx = Math.sign(prey.x - p.x), dy = Math.sign(prey.y - p.y);
    for (const [mx, my] of [[dx, dy], [dx, 0], [0, dy]]) { const c = cellAt(world, p.x + mx, p.y + my); if (c && !c.water && c.heat === 0 && !walled(world, c.x, c.y) && (mx || my)) { p.x = c.x; p.y = c.y; break; } }
  }
  world.prowlers = world.prowlers.filter(p => !p.gone);
}

// Visible features of an object, from a creature's point of view.
export function lookAt(world, o) {
  const m = MATERIALS[o.kind], c = cellAt(world, o.x, o.y);
  return {
    look: o.kind === 'tallbush' ? (o.fruit > 0 ? m.look : 'tall bare bush') : o.kind === 'tree' && (o.hp ?? 6) < 6 ? 'notched tree' : m.look, size: m.weight >= 3 ? 'big' : m.weight >= 0.8 ? 'mid' : 'small',
    wet: o.wet >= 0.35, glowing: o.burning > 0, warm: !!(c && c.heat > 0)
  };
}
// A compact key for "things that look like this, in this state".
export function featureKey(f) { return `${f.look}|${f.size}|${f.wet ? 'wet' : 'dry'}|${f.glowing ? 'glow' : ''}`; }
