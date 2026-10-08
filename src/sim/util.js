// util.js — deterministic helpers shared across the sim.
import { cyrb53 } from './rng.js';

export function r3(x) { return Math.round(x * 1000) / 1000; }
export function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
export function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }

// "w10" -> 10. Used so w2 sorts before w10.
export function idNum(id) { return typeof id === 'number' ? id : Number(String(id).slice(1)); }
export function cmpId(a, b) { return idNum(a.id) - idNum(b.id); }
export function byId(list) { return list.slice().sort(cmpId); }
export function sortedKeys(obj) { return Object.keys(obj).sort(); }

// Stable stringify: object keys sorted, arrays in order, undefined dropped.
export function stableStringify(v) {
  if (v === null || typeof v !== 'object') {
    if (typeof v === 'number' && !Number.isFinite(v)) throw new Error('non-finite number in state');
    return JSON.stringify(v);
  }
  if (Array.isArray(v)) return '[' + v.map(x => x === undefined ? 'null' : stableStringify(x)).join(',') + ']';
  const keys = Object.keys(v).sort();
  const parts = [];
  for (const k of keys) {
    if (v[k] === undefined) continue;
    parts.push(JSON.stringify(k) + ':' + stableStringify(v[k]));
  }
  return '{' + parts.join(',') + '}';
}

export function stateHash(world) {
  const s = stableStringify(world);
  const a = cyrb53(s, 1), b = cyrb53(s, 2);
  return a.toString(16).padStart(14, '0').slice(-8) + b.toString(16).padStart(14, '0').slice(-8);
}

// world.wobblins and world.objects are append-only and ids are allocated in
// increasing order, so both arrays are always in id order. Filtering keeps it.
export function alive(world) { return world.wobblins.filter(w => w.alive); }
export function liveObjects(world) { return world.objects.filter(o => !o.state.gone); }
export function findWobblin(world, id) { return world.wobblins.find(w => w.id === id) || null; }
export function findObject(world, id) { return world.objects.find(o => o.id === id) || null; }
export function objectAtSlot(world, slot) {
  return world.objects.find(o => !o.state.gone && (o.slot === slot || (o.slots && o.slots.includes(slot)))) || null;
}
