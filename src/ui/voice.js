// voice.js — what a Wobblin would say if you asked: one short line in their own
// voice, built only from their state and their memories (the event log), so it
// never claims anything that didn't happen. A stand-in for the AI layer, which
// will follow the same grounding rule.
import { BY_ID } from '../sim/discoveries.js';
import { temperOf } from '../render/render.js';
import { SKILL_NAMES } from '../sim/growth.js';

const nameOf = (world, id) => (world.wobblins.find(w => w.id === id) || {}).name || 'someone';
const item = id => String(id || 'thing').replace(/_/g, ' ');

// From a memory, if it is recent and about them.
function fromMemory(world, w, e) {
  const d = e.data || {}, me = e.actors[0] === w.id, other = e.actors.find(id => id !== w.id);
  const bold = w.traits.boldness > 0.6, careful = (w.traits.caution || 0) > 0.6;
  switch (e.kind) {
    case 'discovery': return me ? `I figured something out: ${BY_ID[e.target] ? BY_ID[e.target].name : 'a new trick'}!` : null;
    case 'taught': return e.actors[1] === w.id ? `${nameOf(world, e.actors[0])} showed me ${BY_ID[e.target] ? BY_ID[e.target].name.toLowerCase() : 'a trick'}. I think I get it.` : `I taught ${nameOf(world, e.actors[1])} something today.`;
    case 'birth': return me ? null : `My little ${nameOf(world, e.actors[0])}! Look at them.`;
    case 'paired': return `${nameOf(world, other)} and me. That's us now.`;
    case 'friends': return `${nameOf(world, other)} is my best friend.`;
    case 'rivals': return `Ugh. ${nameOf(world, other)}.`;
    case 'death': return null;
    case 'level_up': return `I'm getting really good at ${(SKILL_NAMES[d.skill] || item(d.skill)).toLowerCase()}.`;
    case 'injured': return careful ? 'I got hurt. I knew something like this would happen.' : 'Ow. That still hurts.';
    case 'keeper_nudge':
      if (d.nudge === 'bless' && e.target === w.id) return 'Something warm came down from the sky. I feel special.';
      if (d.nudge === 'carry' && e.target === w.id) return d.thrown ? (w.traits.playfulness > 0.55 ? 'I FLEW! Again! Again!' : "Don't throw me again. Please.") : 'A big hand picked me up and set me down. Strange.';
      if (d.nudge === 'miracle') return 'Did you see the sky? Everything glowed.';
      return null;
    case 'interaction': {
      const T = {
        hug: `${nameOf(world, other)} gives the best hugs.`, bonk: `${nameOf(world, other)} bumped right into me.`,
        bowled_over: me ? `I knocked ${nameOf(world, other)} flat. Not my fault!` : `${nameOf(world, other)} came flying out of nowhere and knocked me over.`,
        bush_squashed: 'I landed in the berries. Sticky.', snack: 'Berries! Right where I landed.',
        stuck_in_tree: 'I was stuck up a tree for ages.', fire_walk: 'The fire didn\'t scare me.', singed: 'My bottom is still warm from that fire.',
        caught_fish: 'I caught a fish with my bare hands!', through_the_roof: 'I went right through a roof. Everyone is cross with me.',
        bonked: 'A stone fell on my head. From the SKY.', bonk_idea: 'A stone hit my head and gave me an idea!',
        squashed: careful ? 'A boulder fell on me. I knew the sky was dangerous.' : 'A boulder squashed me flat. I\'m fine. Mostly.',
        flower_crown: 'Do you like my flowers? They grew on my head!', zapped: d.bold ? 'ZAP! That was amazing!' : 'The sky bit me. My fur is all fuzzy.',
        gift_caught: `Look what fell into my arms! My ${item(d.item)}!`, treasure: `This ${item(d.item)} is mine now.`,
        quake: w.traits.playfulness > 0.6 ? 'The whole ground wobbled! Do it again!' : 'The ground shook. Did we do something wrong?',
        cradled: 'I had the nicest nap in a giant warm hand.',
        shaken: w.traits.playfulness > 0.6 ? 'Everything was spinning! It was great!' : 'The sky shook me. My insides are still wobbly.',
        skating: 'The pond is all slidey! Wheee!', slipped: 'The pond went hard and slippery. I fell.', squabble: `${nameOf(world, other)} started it.`,
        king_of_the_hill: `I can see everything from up on the ${item(d.on)}.`, remembers: `I miss ${d.of || 'them'}.`, made_a_cairn: 'I made a little tower of stones.'
      };
      return T[d.what] || null;
    }
  }
  return null;
}

// Right now, how they feel (strong needs win).
function fromNeeds(w) {
  const n = w.needs;
  if (n.food < 0.2) return 'So hungry. Are there any berries left?';
  if (n.warmth < 0.2) return 'Brrr. I can\'t feel my feet.';
  if (n.safety < 0.25) return 'Something is out there. I don\'t like it.';
  return null;
}

const IDLE = {
  caution: ['Is it safe out here?', 'We should build something sturdy. Just in case.', 'I keep an eye on the sky.'],
  boldness: ['Let\'s go see what\'s over there!', 'I\'m not scared of anything.', 'Fire? Water? Bring it on.'],
  curiosity: ['What happens if I poke this?', 'I wonder how that works.', 'There\'s always something new to figure out.'],
  patience: ['Good things take time.', 'I like doing things slowly and properly.', 'No rush.'],
  sociability: ['Where is everybody? Let\'s all sit together.', 'I love it when we\'re all here.', 'Has anyone seen my friends?'],
  playfulness: ['Bet you can\'t catch me!', 'Let\'s play a game!', 'Everything is more fun with a song.'],
  none: ['Nice day for it.', 'Hmm-hmm-hmm.', 'I like it here.']
};

const ASK_LINE = { berries: 'Could you grow us some berries? Please?', stones: 'I would love some stones to stack. Right here?', rain: 'It is so dry. Could it rain, just a little?', company: 'It is lonely over here. Could someone come and sit with me?', flowers: 'Flowers! I want flowers. On my head, maybe?' };
export function voiceLine(world, w) {
  if (!w.alive) return null;
  const ask = (world.asks || []).find(a => !a.done && a.by === w.id);
  if (ask) return ASK_LINE[ask.want];
  const need = fromNeeds(w);
  if (need) return need;
  // The most notable thing that happened to them in the last two colony days.
  let best = null, bp = 0;
  for (let i = w.memories.length - 1; i >= 0; i--) {
    const e = world.events[w.memories[i] - 1];
    if (!e || world.tick - e.t > 48) break;
    const p = PRIORITY[e.kind] || 2;
    if (p <= bp) continue;
    const line = fromMemory(world, w, e);
    if (line) { best = line; bp = p; }
  }
  if (best) return best;
  if (w.needs.rest < 0.12) return 'So... sleepy...';
  const pal = Object.entries(w.bonds || {}).filter(([id, v]) => v >= 0.5 && world.wobblins.some(x => x.id === id && x.alive)).sort((x, y) => y[1] - x[1])[0];
  const lines = IDLE[temperOf(w) || 'none'];
  const pickIdx = (world.tick + Number(String(w.id).slice(1))) % (lines.length + (pal ? 1 : 0));
  return pickIdx === lines.length ? nameOf(world, pal[0]) + ' is my favourite.' : lines[pickIdx];
}
const PRIORITY = { discovery: 6, birth: 6, interaction: 5, injured: 5, paired: 5, friends: 4, rivals: 4, keeper_nudge: 3, level_up: 1 };
