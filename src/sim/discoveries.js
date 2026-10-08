// discoveries.js — the 30-node invention graph. Pure data.
//
// prereqs: each entry is a discovery id, or an array meaning "any of these".
// stimuli: every requirement must be met in the Wobblin's zone or an adjacent
//   zone. A requirement is { anyOf: [token, ...] } or a special form:
//     token "fire" etc.  a live object of that kind
//     "river"            the riverbank (always there)
//     "wet"              soft mud: rain in the last 6 ticks
//     "kept_fire"        a fire that no longer burns out (Fire Carrying)
//     "item:flint"       a curio or gift with that id (flint matches flint_stone)
//   { stones: n }      n stones counted over piles (1), boulders (4), walls (2)
//   { zone: z }        the Wobblin itself must be in zone z ({ near: true }: z or next to it)
//   { wobblins: n }    n Wobblins (including this one) in the zone
//   { condition: c }   elder_and_young | surplus | witnessed | faith | clear | injured
// drivers.traits: which traits raise the chance (weights).
// drivers.needs: which unmet needs raise the chance (food, warmth, rest, mood, safety).
//   "comfort" means the opposite: a warm, fed Wobblin is more likely.
// hobby: a hobby that makes this discovery more likely.
// build: the structure this discovery puts in the world (effects.js).
// embodiedBy: object kinds that keep this knowledge alive after the last knower dies.

const T = (id, name, tier, prereqs, stimuli, traits, needs, extra = {}) =>
  ({ id, name, tier, prereqs, stimuli, drivers: { traits, needs }, social: false, build: null, embodiedBy: [], hobby: null, ...extra });

export const DISCOVERIES = [
  // ---- Tier 1: Noticing ---------------------------------------------------
  T('fire_warmth', 'Fire Warmth', 1, [], [{ anyOf: ['fire', 'hearth'] }], { boldness: 1 }, { warmth: 1 }),
  T('stone_stacking', 'Stone Stacking', 1, [], [{ anyOf: ['stones', 'boulder'] }], { patience: 1 }, {},
    { hobby: 'stacking stones', build: 'stack' }),
  T('foraging', 'Foraging', 1, [], [{ anyOf: ['bush', 'sprout', 'garden'] }], { curiosity: 1 }, { food: 1 }),
  T('wading', 'Wading', 1, [], [{ anyOf: ['river', 'pond'] }], { boldness: 1 }, { comfort: 1 },
    { hobby: 'poking puddles' }),
  T('rhythm', 'Rhythm', 1, [], [{ anyOf: ['item:hollow_log', 'tree'] }, { wobblins: 2 }], { playfulness: 1, sociability: 0.5 }, { mood: 0.5 },
    { social: true, hobby: 'humming' }),
  T('digging', 'Digging', 1, [], [{ anyOf: ['wet'] }], { curiosity: 1 }, { food: 1 }),
  T('leaf_bed', 'Leaf Bed', 1, [], [{ anyOf: ['tree', 'reeds'] }], { patience: 0.5, curiosity: 0.5 }, { warmth: 1, rest: 1 },
    { hobby: 'napping in sun' }),
  T('shiny_keeping', 'Shiny Keeping', 1, [], [{ anyOf: ['gift', 'curio', 'clay'] }], { playfulness: 1, curiosity: 0.5 }, {},
    { hobby: 'collecting shiny things' }),

  // ---- Tier 2: Making -----------------------------------------------------
  T('fire_carrying', 'Fire Carrying', 2, ['fire_warmth'], [{ anyOf: ['fire'] }, { anyOf: ['tree'] }], { boldness: 1 }, { warmth: 1 },
    { build: 'kept_fire', embodiedBy: ['kept_fire'] }),
  T('sharp_stone', 'Sharp Stone', 2, ['stone_stacking'], [{ anyOf: ['stones', 'boulder', 'item:flint'] }], { patience: 1 }, {}),
  T('wall', 'Wall', 2, ['stone_stacking'], [{ stones: 3 }], { patience: 1 }, { safety: 1 },
    { build: 'wall', embodiedBy: ['wall'] }),
  T('planting', 'Planting', 2, ['foraging', 'digging'], [{ anyOf: ['sprout', 'bush', 'item:seed_pouch'] }, { anyOf: ['wet'] }], { patience: 1 }, { food: 1 },
    { build: 'spread_bush' }),
  T('fishing', 'Fishing', 2, ['wading'], [{ anyOf: ['fish'] }], { patience: 1 }, { food: 1 }),
  T('clay_shaping', 'Clay Shaping', 2, ['digging'], [{ anyOf: ['clay', 'item:clay_lump'] }], { playfulness: 1, patience: 0.5 }, {}),
  T('song', 'Song', 2, ['rhythm'], [{ wobblins: 2 }], { sociability: 1 }, { mood: 1 }, { social: true, hobby: 'humming' }),
  T('weaving', 'Weaving', 2, ['leaf_bed'], [{ anyOf: ['reeds', 'tree', 'item:reed_bundle'] }], { patience: 1 }, {}),

  // ---- Tier 3: Building ---------------------------------------------------
  T('hearth', 'Hearth', 3, ['fire_carrying', 'stone_stacking'], [{ anyOf: ['kept_fire'] }, { anyOf: ['stones', 'boulder'] }], { patience: 1 }, { warmth: 1 },
    { build: 'hearth', embodiedBy: ['hearth'] }),
  T('hut', 'Hut', 3, ['wall', 'weaving'], [{ zone: 'hollow', near: true }, { anyOf: ['stones', 'boulder', 'wall'] }, { anyOf: ['reeds', 'tree', 'bush', 'item:reed_bundle'] }],
    { patience: 1 }, { warmth: 1, safety: 1 }, { build: 'hut', embodiedBy: ['hut'] }),
  T('cooking', 'Cooking', 3, ['hearth', ['foraging', 'fishing']], [{ anyOf: ['hearth'] }, { anyOf: ['bush', 'fish', 'garden'] }], { curiosity: 1 }, { food: 1 }),
  T('pottery', 'Pottery', 3, ['clay_shaping', 'hearth'], [{ anyOf: ['clay', 'item:clay_lump'] }, { anyOf: ['hearth'] }], { patience: 1 }, {},
    { build: 'pots' }),
  T('garden', 'Garden', 3, ['planting', 'sharp_stone'], [{ anyOf: ['wet'] }, { anyOf: ['sprout', 'bush'] }], { patience: 1 }, { food: 0.5 },
    { build: 'garden', embodiedBy: ['garden'] }),
  T('raft', 'Raft', 3, ['weaving', 'wading'], [{ anyOf: ['river', 'pond'] }, { anyOf: ['reeds', 'tree', 'item:reed_bundle'] }], { boldness: 1 }, {},
    { build: 'raft', embodiedBy: ['raft'] }),
  T('ritual', 'Ritual', 3, ['song', 'hearth'], [{ anyOf: ['hearth'] }, { wobblins: 3 }], { piety: 1, sociability: 0.5 }, {}, { social: true }),
  T('paint', 'Paint', 3, ['clay_shaping', 'shiny_keeping'], [{ anyOf: ['clay', 'item:clay_lump'] }, { anyOf: ['bush', 'gift', 'curio'] }], { playfulness: 1 }, {},
    { build: 'mural', embodiedBy: ['mural'] }),

  // ---- Tier 4: Believing and remembering ----------------------------------
  T('lore', 'Lore', 4, ['ritual', 'paint'], [{ anyOf: ['hearth'] }, { condition: 'elder_and_young' }], { sociability: 1 }, {}, { social: true }),
  T('festival', 'Festival', 4, ['cooking', 'ritual'], [{ anyOf: ['hearth'] }, { condition: 'surplus' }, { wobblins: 3 }], { sociability: 1 }, {}, { social: true }),
  T('totem', 'Totem', 4, ['sharp_stone', 'paint'], [{ anyOf: ['tree'] }, { condition: 'witnessed' }], { piety: 1 }, {},
    { build: 'totem', embodiedBy: ['totem'] }),
  T('temple', 'Temple to the Keeper', 4, ['totem', 'wall'], [{ zone: 'hill' }, { stones: 4 }, { condition: 'faith' }], { piety: 1 }, {},
    { build: 'temple', embodiedBy: ['temple'] }),
  T('star_watching', 'Star Watching', 4, ['lore'], [{ zone: 'hill' }, { condition: 'clear' }], { curiosity: 1, patience: 1 }, {},
    { hobby: 'watching clouds' }),
  T('herb_healing', 'Herb Healing', 4, ['garden', 'lore'], [{ anyOf: ['garden'] }, { condition: 'injured' }], { sociability: 1, patience: 1 }, {})
];

// Sorted driver keys, computed once (hot path).
for (const d of DISCOVERIES) {
  d.traitKeys = Object.keys(d.drivers.traits).sort();
  d.needKeys = Object.keys(d.drivers.needs).sort();
  d.primaryTrait = d.traitKeys.slice().sort((a, b) => d.drivers.traits[b] - d.drivers.traits[a])[0] || null;
}

export const BY_ID = Object.fromEntries(DISCOVERIES.map(d => [d.id, d]));
export const DISCOVERY_IDS = DISCOVERIES.map(d => d.id).sort();

// Flatten prereqs into every id mentioned (for graph checks).
export function prereqIds(d) { return d.prereqs.flatMap(p => Array.isArray(p) ? p : [p]); }

export function prereqsMet(d, knows) {
  return d.prereqs.every(p => Array.isArray(p) ? p.some(x => knows[x]) : !!knows[p]);
}

// Which tokens each producer can create. Used by tests for "every stimulus can
// be produced by at least one power, gift, or natural event".
export const PRODUCERS = {
  fire: ['power:lightning', 'natural:dry_lightning'],
  hearth: ['discovery:hearth'],
  stones: ['power:stone', 'natural:start'],
  boulder: ['power:stone'],
  bush: ['power:plant', 'natural:start'],
  sprout: ['power:plant'],
  tree: ['power:plant', 'natural:start'],
  garden: ['discovery:garden'],
  river: ['natural:river'],
  pond: ['power:water'],
  wet: ['power:rain', 'natural:rain'],
  reeds: ['power:water'],
  clay: ['power:rain', 'power:water', 'natural:rain'],
  fish: ['power:rain', 'power:water', 'natural:rain'],
  gift: ['gift'],
  curio: ['nudge:curio'],
  kept_fire: ['discovery:fire_carrying'],
  wall: ['discovery:wall'],
  'item:hollow_log': ['nudge:curio', 'gift'],
  'item:flint': ['nudge:curio', 'gift'],
  'item:seed_pouch': ['gift'],
  'item:clay_lump': ['nudge:curio', 'gift'],
  'item:reed_bundle': ['nudge:curio', 'gift'],
  stones_n: ['power:stone'],
  'condition:elder_and_young': ['natural:aging'],
  'condition:surplus': ['natural:forage'],
  'condition:witnessed': ['nudge:bless', 'nudge:miracle'],
  'condition:faith': ['nudge:bless', 'nudge:miracle', 'gift'],
  'condition:clear': ['natural:weather'],
  'condition:injured': ['natural:prowler', 'power:lightning'],
  'zone:hollow': ['natural:movement'],
  'zone:hill': ['natural:movement'],
  'wobblins:n': ['natural:movement']
};

export function stimulusTokens(d) {
  const out = [];
  for (const s of d.stimuli) {
    if (s.anyOf) out.push(...s.anyOf);
    else if (s.stones) out.push('stones_n');
    else if (s.zone) out.push('zone:' + s.zone);
    else if (s.wobblins) out.push('wobblins:n');
    else if (s.condition) out.push('condition:' + s.condition);
  }
  return out;
}
