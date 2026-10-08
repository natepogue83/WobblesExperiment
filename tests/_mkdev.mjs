import fs from 'node:fs';
import { createWorld, tick, applyAction, goalStates } from '../src/sim/index.js';
import { newSave, appendAction, serializeSave } from '../src/ui/save.js';
import { generousActions } from './lib.js';
const seed = Number(process.argv[2] || 7), ticks = Number(process.argv[3] || 300);
const save = newSave({ seed, createdAt: 0, colonyName: 'Bramble Hollow', keeperName: 'Nate' });
const w = createWorld(seed, save);
for (let t = 0; t < ticks; t++) {
  for (const a of generousActions(w, seed)) applyAction(w, appendAction(save, w.tick, a));
  for (const g of goalStates(w).filter(g => g.state === 'ready')) applyAction(w, appendAction(save, w.tick, { type: 'claim', goal: g.id }));
  tick(w);
}
save.lastSeenTick = ticks;
fs.writeFileSync('_dev_save.json', serializeSave(save));
const alive = w.wobblins.filter(x => x.alive);
console.log('seed', seed, 'pop', alive.length, 'discoveries', Object.keys(w.discoveries).length, 'objects', w.objects.filter(o => !o.state.gone).map(o => o.kind).join(','));
