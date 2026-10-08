// effects.js — the visible world change each discovery makes.
// Called only from experiment.js after a discovery or rediscovery event.
// Day 4: structures appear at once. Day 5 turns the big ones into build jobs.
import { emit } from './events.js';
import { makeObject } from './world.js';
import { freeSlotIn } from './nature.js';
import { liveObjects } from './util.js';
import { ADJACENT } from './geometry.js';

const SITES = {
  wall: ['hollow', 'meadow'],
  hearth: ['meadow', 'hollow'],
  hut: ['hollow', 'meadow'],
  garden: ['meadow', 'grove'],
  raft: ['riverbank', 'pondsite'],
  mural: ['hill', 'grove', 'meadow'],   // never the hollow: that is where huts go
  totem: ['hill', 'meadow'],
  temple: ['hill']
};

function nearest(world, w, kinds, pred = () => true) {
  const reach = [w.zone, ...ADJACENT[w.zone]];
  return liveObjects(world).filter(o => kinds.includes(o.kind) && pred(o))
    .sort((a, b) => (a.zone === w.zone ? 0 : 1) - (b.zone === w.zone ? 0 : 1) || reach.indexOf(a.zone) - reach.indexOf(b.zone))
    .find(o => reach.includes(o.zone)) || null;
}

// Builders use up a plain stone pile when the site has no free slot.
const USES_STONE = new Set(['wall', 'hut', 'hearth', 'temple', 'totem']);

export function buildStructure(world, kind, w, ev, state = {}, zones = SITES[kind]) {
  for (const zone of zones) {
    let slot = freeSlotIn(world, zone);
    if (!slot && USES_STONE.has(kind)) {
      // A temple rises on the boulder you dropped, if there is one.
      const kinds = kind === 'temple' ? ['boulder', 'stones'] : ['stones'];
      const pile = kinds.map(k => liveObjects(world).find(o => o.kind === k && o.zone === zone)).find(Boolean);
      if (pile) { pile.state.gone = true; pile.hp = 0; pile.state.usedFor = kind; slot = pile.slot; state = { ...state, builtOn: pile.id }; }
    }
    if (!slot) continue;
    const o = makeObject(world, { kind, slot, by: [w.id], origin: { event: ev.id }, state });
    const causes = [{ event: ev.id }];
    if (state.builtOn) causes.push({ object: state.builtOn });
    emit(world, { kind: 'built', actors: [w.id], target: o.id, data: { kind, zone, discovery: ev.target, builtOn: state.builtOn || null }, salience: 4, causes });
    return o;
  }
  return null;
}

// The Keeper event a mural depicts: the most salient recent one.
function depictable(world) {
  const ks = world.events.filter(e => e.kind.startsWith('keeper_') && e.salience >= 2);
  return ks.length ? ks.sort((a, b) => b.salience - a.salience || b.id - a.id)[0] : null;
}

export function applyDiscoveryEffect(world, d, w, ev) {
  switch (d.build) {
    case 'stack': {
      const s = nearest(world, w, ['stones', 'boulder']);
      if (s) s.state.stacked = true;
      break;
    }
    case 'kept_fire': {
      const f = nearest(world, w, ['fire'], o => !o.state.kept);
      if (f) { f.state.kept = true; f.state.keeper = w.id; }
      break;
    }
    case 'spread_bush': {
      const slot = freeSlotIn(world, w.zone) || freeSlotIn(world, 'meadow');
      if (slot) makeObject(world, { kind: 'sprout', slot, by: [w.id], origin: { event: ev.id }, state: { grows: 'bush', readyAt: world.tick + 6 } });
      break;
    }
    case 'pots': {
      const h = liveObjects(world).find(o => o.kind === 'hearth');
      if (h) h.state.pots = true;
      break;
    }
    case 'mural': {
      const dep = depictable(world);
      buildStructure(world, 'mural', w, ev, { depicts: dep ? dep.id : null });
      break;
    }
    case 'wall': case 'hearth': case 'hut': case 'garden': case 'raft': case 'totem': case 'temple':
      buildStructure(world, d.build, w, ev);
      break;
  }
}

// What keeps a discovery alive after its last knower dies.
export function embodiments(world, d, objs = liveObjects(world)) {
  if (!d.embodiedBy.length) return [];
  return objs.filter(o =>
    (d.embodiedBy.includes(o.kind) && !o.state.decayFrom) ||
    (d.embodiedBy.includes('kept_fire') && o.kind === 'fire' && o.state.kept));
}

// One pass over live objects: kind -> objects that can hold knowledge.
export function embodimentIndex(objs) {
  const idx = {};
  for (const o of objs) {
    if (o.state.decayFrom === undefined) (idx[o.kind] ||= []).push(o);
    if (o.kind === 'fire' && o.state.kept) (idx.kept_fire ||= []).push(o);
  }
  return idx;
}

export function embodimentsFrom(idx, d) {
  if (d.embodiedBy.length === 1) return idx[d.embodiedBy[0]] || [];
  return d.embodiedBy.flatMap(k => idx[k] || []);
}
