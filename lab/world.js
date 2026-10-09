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
export const MATERIALS = {
  stone: { look: 'grey lump', weight: 3, hard: 1, burn: 0, absorb: 0, nourish: 0 },
  stick: { look: 'brown stick', weight: 1, hard: 0.4, burn: 0.8, absorb: 0.5, nourish: 0 },
  grass: { look: 'pale tuft', weight: 0.3, hard: 0, burn: 0.9, absorb: 0.9, nourish: 0.05 },
  log: { look: 'brown trunk', weight: 4, hard: 0.6, burn: 0.7, absorb: 0.3, nourish: 0 },
  berry: { look: 'red bead', weight: 0.2, hard: 0, burn: 0.2, absorb: 0.2, nourish: 0.6 },
  root: { look: 'knobbly lump', weight: 0.8, hard: 0.7, burn: 0.3, absorb: 0.3, nourish: 0.4 },
  ember: { look: 'glowing lump', weight: 2, hard: 0.5, burn: 0, absorb: 0, nourish: 0, source: true }
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
    weather: { rain: 0 }, opts: { rainEvery: 60, rainFor: 5, nightCold: true, ...opts }
  };
  // Scatter materials.
  const spawn = (kind, n, where) => { for (let i = 0; i < n; i++) { const c = where(); addObject(world, kind, c.x, c.y); } };
  const land = () => { for (;;) { const c = cells[Math.floor(r() * cells.length)]; if (!c.water) return c; } };
  const grassy = () => { for (;;) { const c = land(); if (c.grass) return c; } };
  spawn('stick', 14, land); spawn('grass', 12, grassy); spawn('log', 4, land); spawn('stone', 8, () => { for (;;) { const c = land(); if (c.stony || r() < 0.2) return c; } });
  spawn('berry', 24, grassy); spawn('root', 8, land);
  return world;
}

export function cellAt(world, x, y) { return x >= 0 && y >= 0 && x < W && y < H ? world.cells[y * W + x] : null; }
export function addObject(world, kind, x, y, state = {}) {
  const m = MATERIALS[kind];
  const o = { id: 'o' + world.nextId++, kind, x, y, wet: 0, burning: 0, fuel: m.source ? 40 : 0, held: null, gone: false, ...state };
  world.objects.push(o);
  return o;
}
export function objectsAt(world, x, y) { return world.objects.filter(o => !o.gone && !o.held && o.x === x && o.y === y); }
export function live(world) { return world.objects.filter(o => !o.gone); }
export function emit(world, ev) { world.events.push({ t: world.tick, ...ev }); return ev; }

export function isNight(world) { const h = world.tick % DAY; return h >= 16 || h < 5; }

// ---- physics: weather, wetness, heat and fire, growth -------------------------------
export function worldStep(world) {
  const t = world.tick, r = rngFor(world.seed, 'phys', t);
  const o = world.opts;
  // Rain comes in spells.
  world.weather.rain = (t % o.rainEvery) < o.rainFor && t > 10 ? 1 : 0;
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
      if (world.weather.rain) ob.wet = Math.min(1, ob.wet + 0.5 * (0.3 + m.absorb));
      else ob.wet = Math.max(0, ob.wet - 0.04 - (c ? c.heat * 0.3 : 0));
      if (c && c.water) ob.wet = 1;
    }
    // Fire: a source burns its fuel down; rain and wetness smother it.
    if (ob.burning > 0) {
      ob.fuel -= 1;
      if (world.weather.rain) ob.fuel -= 1.5;
      if (ob.fuel <= 0) { ob.burning = 0; ob.fuel = 0; emit(world, { kind: 'fire_out', obj: ob.id, x: ob.x, y: ob.y }); if (m.source) ob.kind = 'stone'; else ob.gone = true; }
    }
    // Dry burnable things in a hot cell catch and feed the fire there.
    if (!ob.held && ob.burning === 0 && m.burn > 0 && c && c.heat >= 1 && ob.wet < 0.35) {
      const source = objectsAt(world, ob.x, ob.y).find(s => s.burning > 0);
      if (source && r() < m.burn) {
        const fuel = Math.round(9 * m.burn * Math.max(0.5, m.weight) * (1 - ob.wet));
        source.fuel += fuel; ob.gone = true;
        emit(world, { kind: 'fed_fire', obj: ob.id, material: ob.kind, fuel, source: source.id, x: ob.x, y: ob.y });
      }
    }
    if (!ob.held && ob.burning === 0 && m.burn > 0 && c && c.heat >= 1 && ob.wet >= 0.35 && objectsAt(world, ob.x, ob.y).some(s => s.burning > 0)) {
      if (!ob.hissed || t - ob.hissed > 3) { ob.hissed = t; emit(world, { kind: 'hiss', obj: ob.id, material: ob.kind, x: ob.x, y: ob.y }); }
    }
  }
  // Growth: grass tufts and berries come back slowly.
  if (t % 12 === 0) {
    for (const c of world.cells) {
      if (c.grass && r() < 0.22 && objectsAt(world, c.x, c.y).length < 2) addObject(world, r() < 0.45 ? 'grass' : 'berry', c.x, c.y);
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

// Visible features of an object, from a creature's point of view.
export function lookAt(world, o) {
  const m = MATERIALS[o.kind], c = cellAt(world, o.x, o.y);
  return {
    look: m.look, size: m.weight >= 3 ? 'big' : m.weight >= 0.8 ? 'mid' : 'small',
    wet: o.wet >= 0.35, glowing: o.burning > 0, warm: !!(c && c.heat > 0)
  };
}
// A compact key for "things that look like this, in this state".
export function featureKey(f) { return `${f.look}|${f.size}|${f.wet ? 'wet' : 'dry'}|${f.glowing ? 'glow' : ''}`; }
