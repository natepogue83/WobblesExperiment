// rng.js — seeded randomness. mulberry32 is ported verbatim from ISO.
// Every system derives its own sub-stream with rngFor(seed, ...keys) so that
// adding a roll in one system never shifts the rolls of another.

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;
var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;
return((t^t>>>14)>>>0)/4294967296}}

// cyrb53: 53-bit string hash, integer math only, identical on every engine.
export function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// rngFor(seed, "experiment", tick, "w3") -> () => float in [0,1)
export function rngFor(seed, ...keys) {
  const h = cyrb53(keys.join('|'), seed >>> 0);
  return mulberry32(h % 4294967296);
}

// Small helpers that take a stream so call sites stay readable.
export function randInt(r, lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); }
export function pick(r, list) { return list[Math.floor(r() * list.length)]; }
export function chance(r, p) { return r() < p; }
export function range(r, lo, hi) { return lo + r() * (hi - lo); }

export function weightedPick(r, items, weightOf) {
  let total = 0;
  for (const it of items) total += Math.max(0, weightOf(it));
  if (total <= 0) return null;
  let x = r() * total;
  for (const it of items) {
    x -= Math.max(0, weightOf(it));
    if (x < 0) return it;
  }
  return items[items.length - 1];
}
