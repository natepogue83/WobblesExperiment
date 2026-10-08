import { createWorld, tick, applyAction, stateHash } from '../src/sim/index.js';
import { generousActions } from './lib.js';
const out = [];
for (const seed of [1, 7, 12, 31337]) {
  const w = createWorld(seed); let seq = 0;
  for (let t = 0; t < 600; t++) { for (const a of generousActions(w, seed)) applyAction(w, { seq: ++seq, t: w.tick, ...a }); tick(w); }
  out.push(stateHash(w));
}
console.log(out.join(' '));
