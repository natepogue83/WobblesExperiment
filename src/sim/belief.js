// belief.js — their belief is your power.
// Belief grows when Wobblins love what you do, when a discovery traces back to
// you, and when you collect their offerings. Crossing a threshold unlocks the
// next power for good. Only worlds created with { progression: true } start
// locked; older saves and tests keep every power open.
import { emit } from './events.js';
import { r3 } from './util.js';

// Tray keys in unlock order. Thresholds are lifetime belief (tunable).
export const UNLOCKS = [
  { key: 'carry', at: 0, name: 'your hand' },
  { key: 'stone', at: 0, name: 'Drop Stone' },
  { key: 'plant', at: 0, name: 'Plant' },
  { key: 'gift', at: 0, name: 'the Daily Gift' },
  { key: 'rename', at: 0, name: 'Naming' },
  { key: 'move', at: 0, name: 'Moving things' },
  { key: 'poke', at: 0, name: 'Poking things' },
  { key: 'rain', at: 3, name: 'Rain' },
  { key: 'bless', at: 6, name: 'Bless' },
  { key: 'lightning', at: 10, name: 'Lightning' },
  { key: 'water', at: 16, name: 'Shape Water' },
  { key: 'curio', at: 22, name: 'Curios' },
  { key: 'quake', at: 26, name: 'Shake the Valley' },
  { key: 'season', at: 30, name: 'Seasons' },
  { key: 'miracle', at: 40, name: 'Miracles' }
];
export const ALL_KEYS = UNLOCKS.map(u => u.key);

export const BELIEF = { love: 1, like: 0.5, curious: 0.1, scared: -0.3, upset: -0.5, discovery: 2, perOffering: 0.5 };

export function initialUnlocks(progression) {
  return progression ? UNLOCKS.filter(u => u.at === 0).map(u => u.key) : ALL_KEYS.slice();
}

export function isUnlocked(world, key) {
  return !world.unlocked || world.unlocked.includes(key);
}

export function nextUnlock(world) {
  return UNLOCKS.find(u => !world.unlocked.includes(u.key)) || null;
}

// Add belief (never below 0) and unlock anything newly reached.
export function addBelief(world, amount, causes = []) {
  if (!world.unlocked) return;
  world.belief = r3(Math.max(0, (world.belief || 0) + amount));
  for (const u of UNLOCKS) {
    if (world.belief >= u.at && !world.unlocked.includes(u.key)) {
      world.unlocked = [...world.unlocked, u.key];
      emit(world, { kind: 'power_unlocked', target: u.key, data: { power: u.key, name: u.name, belief: world.belief }, salience: 4, causes });
    }
  }
}
