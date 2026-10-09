// lore.js — what things are, in the Keeper's words, and what they might lead
// to. Read-only over the world and the discovery graph; it never reveals a
// recipe, only "this is the kind of thing that gets Wobblins thinking about X".
import { DISCOVERIES, BY_ID, prereqsMet } from '../sim/discoveries.js';
import { ZONES } from '../sim/geometry.js';
import { titleOf } from '../sim/growth.js';
import { BLURB } from './moments.js';

// What each kind of thing is.
const OBJECT_WHAT = {
  bush: 'A berry bush. Berries feed whoever picks them, and it grows more after rain.',
  tree: 'A tree. Shade, leaves, wood for those who know what to do with it, and seeds that fall now and then.',
  sprout: 'A seed you dropped, settling in. In a few days it grows into a bush or a tree.',
  reeds: 'Reeds by the water. Bendy, light, good for weaving once someone works that out.',
  clay: 'A patch of soft clay, uncovered by rain. It keeps a shape when pressed.',
  stones: 'Loose stones. They can be stacked, chipped, or dropped on a head.',
  boulder: 'A boulder. Too heavy to move; big enough to climb, split, or build on.',
  fish: 'Fish, up near the surface. Food for anyone brave enough to grab one.',
  pond: 'The pond you dug. It draws fish, freezes in a cold snap, and gives the raft somewhere to float.',
  fire: 'A fire. It warms, it burns, it frightens the timid and fascinates the bold. Rain puts it out.',
  hearth: 'A hearth: a fire the Wobblins keep alive in a ring of stones. Their first home-making.',
  wall: 'A wall of stacked stones. It makes the worried feel safer.',
  hut: 'A hut, built by Wobblins who worried enough about the dark. Families start here.',
  garden: 'A garden. Tended rows that feed the colony steadily. Trampled crops stand back up in a while.',
  totem: 'A totem, carved for you after something they saw you do. The devout gather round it.',
  temple: 'A temple to the Keeper. Offerings pile up here, and wishes get made.',
  mural: 'A mural: a painted record of something you did. They remember you through it.',
  raft: 'A raft. Strangers sometimes arrive on it when the valley looks good.',
  grave: 'A grave. Someone they loved. They visit.',
  gift: 'The daily gift you dropped. Whoever picks it up keeps it as a treasure.',
  curio: 'A curio: a strange object that pulls two Wobblins together to puzzle over it.',
  snowman: 'A snowman, rolled by a playful Wobblin. It melts when the cold passes.',
  ruin: 'A ruin. Nobody remembers how to keep it up. Grass will take it.',
  scorch: 'A scorched patch where something burned. Grass grows back in time.',
  shrine: 'The shrine, where offerings to you appear. Collect them for Devotion.'
};
const OBJECT_TITLE = { bush: 'Berry bush', sprout: 'Sprout', clay: 'Clay', stones: 'Stones', fish: 'Fish', pond: 'Pond', hearth: 'Hearth', hut: 'Hut', mural: 'Mural', temple: 'Temple', gift: 'Gift', curio: 'Curio', scorch: 'Scorch', snowman: 'Snowman' };
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// Discoveries this token (object kind, 'wet', 'fire'...) can set off, split into
// ones some living Wobblin is ready for and ones that are further off.
function leadsFrom(world, tokens) {
  const live = world.wobblins.filter(w => w.alive);
  const soon = [], later = [];
  for (const d of DISCOVERIES) {
    if (world.discoveries[d.id]) continue;
    const hit = d.stimuli.some(s => s.anyOf && s.anyOf.some(t => tokens.includes(t))) ||
      (tokens.includes('stones') && d.stimuli.some(s => s.stones)) || (tokens.includes('boulder') && d.stimuli.some(s => s.stones));
    if (!hit) continue;
    (live.some(w => prereqsMet(d, w.knows)) ? soon : later).push(d.name);
  }
  return { soon, later };
}
export function leadsLine({ soon, later }) {
  if (!soon.length && !later.length) return '';
  const parts = [];
  if (soon.length) parts.push('could get them thinking about ' + list(soon));
  if (later.length) parts.push((soon.length ? 'and later ' : 'much later, ') + list(later));
  return cap(parts.join(', ')) + '.';
}
function list(a) { return a.length <= 3 ? a.join(', ') : a.slice(0, 3).join(', ') + ' and more'; }
function dayWord(world, t) { const d = world.tick - t; return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago'; }
function nameOf(world, id) { const w = world.wobblins.find(x => x.id === id); return w ? w.name : null; }

export function objectLore(world, o) {
  const kind = o.kind;
  const title = OBJECT_TITLE[kind] || cap(kind);
  const lines = [OBJECT_WHAT[kind] || 'Something in the valley.'];
  const s = o.state || {};
  if (kind === 'bush') lines.push((s.berries || 0) ? `${s.berries} berr${s.berries === 1 ? 'y' : 'ies'} on it.` : 'Picked bare for now.');
  if (kind === 'stones') lines.push(s.stacked ? 'Stacked into a little tower.' : `A pile of ${s.count || 1}.`);
  if (kind === 'pond' && s.frozen) lines.push('Frozen over. Wobblins skate on it, or slip.');
  if (kind === 'garden' && s.trampled !== undefined) lines.push('Trampled flat for the moment.');
  if (kind === 'mural' && s.smudged !== undefined) lines.push('Smudged. The painter will fix it.');
  if (kind === 'sprout') lines.push(`It will be a ${s.grows || 'bush'}.`);
  const by = (o.by || []).map(id => nameOf(world, id)).filter(Boolean);
  if (by.length) lines.push(`Built by ${list(by)} ${dayWord(world, o.builtTick)}.`);
  else if (o.origin && o.origin.action !== undefined) lines.push(`You put it here ${dayWord(world, o.builtTick)}.`);
  const known = DISCOVERIES.filter(d => d.embodiedBy.includes(kind) && world.discoveries[d.id]).map(d => d.name);
  if (known.length) lines.push(`It keeps ${list(known)} alive even if the knowers die.`);
  const tokens = [kind];
  if (kind === 'hearth') tokens.push('kept_fire');
  if (kind === 'pond') tokens.push('river');
  return { title, lines, leads: leadsLine(leadsFrom(world, tokens)) };
}

// What a tray power does, and what it tends to set off.
const TILE_WHAT = {
  stones: ['Drops a small pile of stones where you point.', 'On a pile already there it makes it bigger; on a head it bonks (and sometimes knocks an idea loose).', ['stones']],
  boulder: ['Drops a boulder. It takes two spots and never moves again, unless lightning splits it or a quake rolls it.', 'On a head it squashes (never fatally). Wobblins climb it, and a temple may rise on one.', ['boulder']],
  bush: ['Plants a berry seed. In a few days: a bush with berries.', 'On a head it grows a flower crown instead.', ['bush', 'sprout']],
  tree: ['Plants a tree seed. In a few days: a tree.', 'Trees give leaves, shade, seeds, and wood for those who know how.', ['tree', 'sprout']],
  rain: ['Rain over the whole valley for a day.', 'Wets the ground (clay shows up, planting gets easier), puts fires out, fills the pond. Three rains close together flood the river. With a cold snap it snows.', ['wet']],
  lightning: ['A bolt where you drop it.', 'Starts fires, splits boulders into stones, bursts cairns, stuns fish, cracks ice, makes a totem hum, frizzes whoever it lands on.', ['fire']],
  water: ['Digs a pond, or once there is one, bends the river for more fish.', 'Water draws fish and gives wading Wobblins somewhere to be brave.', ['pond', 'fish', 'river']],
  quake: ['Shakes the valley.', 'Berries fall, cairns topple, old walls fall, a hill boulder may roll down, and everyone holds on. Timid ones never forget it.', []],
  cold: ['A cold snap for several days.', 'The pond freezes; with rain it snows and the playful build snowmen. Those who know Weaving wear hats.', []],
  warm: ['A warm spell for several days.', 'Fewer cold nights and warmer moods.', []],
  bless: ['Drop on a Wobblin to lift one trait for a while.', 'Use it to push someone over the line for a discovery that needs more of a trait.', []],
  curio: ['A strange object that pulls two Wobblins together to study it.', 'Shared puzzling builds a friendship and sometimes an idea.', ['curio']],
  gift: ['One gift a day. Drop it on a Wobblin and they catch it and keep it.', 'Treasures become charms, and shiny things get them collecting.', ['gift']],
  miracle: ['A rainbow over the valley.', 'Everyone sees it, everyone remembers it, and faith in you jumps. Costs Devotion.', []]
};
export function tileLore(world, id, label) {
  const t = TILE_WHAT[id];
  if (!t) return { title: label, lines: [label], leads: '' };
  return { title: label, lines: [t[0], t[1]], leads: leadsLine(leadsFrom(world, t[2])) };
}

// A place in the valley.
export function zoneLore(world, zone, objs) {
  const z = ZONES[zone];
  const here = objs.filter(o => o.zone === zone && !o.state.gone);
  const who = world.wobblins.filter(w => w.alive && w.zone === zone).map(w => w.name);
  const kinds = {};
  for (const o of here) kinds[o.kind] = (kinds[o.kind] || 0) + 1;
  const things = Object.entries(kinds).map(([k, n]) => n > 1 ? `${n} ${(OBJECT_TITLE[k] || cap(k)).toLowerCase()}s` : (OBJECT_TITLE[k] || cap(k)).toLowerCase());
  const lines = [];
  lines.push(things.length ? `Here: ${list(things)}.` : 'Nothing here yet. Room to drop things.');
  lines.push(who.length ? `${list(who)} ${who.length === 1 ? 'is' : 'are'} here now.` : 'Nobody here right now.');
  const special = DISCOVERIES.filter(d => !world.discoveries[d.id] && d.stimuli.some(s => s.zone === zone)).map(d => d.name);
  if (special.length) lines.push(`Some ideas only come to Wobblins standing here: ${list(special)}.`);
  return { title: cap(z.name), lines, leads: '' };
}

// One Wobblin, right now.
const DOING = { forage: 'looking for food', inspect: 'poking at something new', hobby: 'enjoying a hobby', rest: 'resting', warm: 'keeping warm', play: 'playing', social: 'with friends', sleep: 'asleep', build: 'building', explore: 'exploring', eat: 'eating' };
export function wobblinLore(world, w, wantText) {
  const lines = [];
  lines.push(`${w.name}, ${titleOf(w)}. ${cap(w.stage)}, ${world.tick - w.bornTick} days old, ${DOING[w.activity] || 'pottering about'}.`);
  if (wantText) lines.push(wantText);
  const knows = Object.keys(w.knows || {}).filter(id => BY_ID[id]).length;
  lines.push(knows ? `Knows ${knows} thing${knows === 1 ? '' : 's'}.` : 'Knows nothing yet. Everything is new.');
  const known = Object.keys(world.discoveries).filter(id => w.knows[id] && BLURB[id]).slice(-1)[0];
  if (known) lines.push('Newest idea: ' + BLURB[known]);
  return { title: w.name, lines, leads: '' };
}
