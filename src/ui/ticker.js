// ticker.js — while you watch, the day's most interesting happening floats up
// in the corner (friendships, squabbles, new huts, strangers, a snowman...), with
// a portrait of who it's about. Big beats (discoveries, babies) get moments instead.
import { describeEvent } from '../sim/recap.js';
import { portrait } from './panels.js';

const SKIP = new Set(['discovery', 'birth', 'keeper_power', 'keeper_nudge', 'keeper_gift', 'offerings_collected', 'goal_reached',
  'taught', 'experiment_failed', 'pondering', 'rain', 'fire_out', 'offering', 'keepsake', 'power_unlocked']);
const MAX = 3;

export function tickerFor(world, events) {
  const pick = events.filter(e => !SKIP.has(e.kind) && e.salience >= (e.kind === 'level_up' ? 3 : 2) && !(e.kind === 'interaction' && ['pond_thawed', 'snowman_melted'].includes(e.data.what)))
    .sort((a, b) => b.salience - a.salience || b.id - a.id).slice(0, 2);
  for (const e of pick.reverse()) push(world, e);
}

function push(world, e) {
  let box = document.getElementById('ticker');
  if (!box) { box = document.createElement('div'); box.id = 'ticker'; document.body.append(box); }
  const text = describeEvent(world, e);
  if (!text) return;
  const item = document.createElement('div');
  item.className = 'tick-item';
  const who = e.actors && e.actors[0] && world.wobblins.find(w => w.id === e.actors[0]);
  if (who) item.append(portrait(who, 30, world));
  const span = document.createElement('span'); span.textContent = text; item.append(span);
  box.append(item);
  while (box.children.length > MAX) box.firstChild.remove();
  setTimeout(() => { item.classList.add('out'); setTimeout(() => item.remove(), 600); }, 6500);
}
