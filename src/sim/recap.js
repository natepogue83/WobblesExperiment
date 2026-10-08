// recap.js — "While you were away": a templated story built only from the
// event log. Pure and deterministic (template variants come from
// rngFor(seed, "recap", eventId)). Week 2's AI rewrites these lines under the
// grounding rule; these templates stay as the fallback.
import { rngFor } from './rng.js';
import { BY_ID } from './discoveries.js';
import { keeperRoot } from './causes.js';

const KEEPER_KINDS = new Set(['keeper_power', 'keeper_nudge', 'keeper_gift', 'offerings_collected', 'colony_founded']);
const BATCHED = new Set(['taught', 'experiment_failed', 'offering', 'healed', 'grew_up', 'rain', 'fire_out', 'faith_shift']);

// ---- names ----------------------------------------------------------------
function wob(world, id) { const w = world.wobblins.find(x => x.id === id); return w ? w.name : 'a Wobblin'; }
function disc(id) { return BY_ID[id] ? BY_ID[id].name : id; }
function item(id) { return String(id || 'something').replace(/_/g, ' '); }
const ZONE_NAMES = { hill: 'the hill', grove: 'the grove', meadow: 'the meadow', hollow: 'the hollow', pondsite: 'the pond', riverbank: 'the river' };
function zone(z) { return ZONE_NAMES[z] || 'the valley'; }
const ZONE_IN = { hill: 'on the hill', grove: 'in the grove', meadow: 'in the meadow', hollow: 'in the hollow', pondsite: 'by the pond', riverbank: 'by the river' };
function zoneIn(z) { return ZONE_IN[z] || 'in the valley'; }
const TOKEN_WORDS = { wet: 'soft mud', fire: 'fire', kept_fire: 'a fire that stays lit', stones: 'stones', boulder: 'a boulder', bush: 'berry bushes',
  sprout: 'sprouts', tree: 'a tree', reeds: 'reeds', clay: 'clay', fish: 'fish', pond: 'a pond', river: 'the river', hearth: 'a hearth',
  garden: 'a garden', gift: 'a gift', curio: 'a curio', wall: 'a wall' };
function token(t) { return TOKEN_WORDS[t] || (t.startsWith('item:') ? 'a ' + item(t.slice(5)) : item(t)); }
const RECENT = 30;   // ticks: older Keeper roots are told as 'long ago'

export function actionName(ev) {
  const d = ev.data || {};
  if (ev.kind === 'keeper_gift') return 'gift of the ' + item(d.giftId);
  switch (d.power || d.nudge) {
    case 'stone': return d.variant === 'boulder' ? 'boulder' : 'stones';
    case 'plant': return d.variant === 'tree' ? 'tree' : 'bush';
    case 'rain': return 'rain';
    case 'lightning': return 'lightning storm';
    case 'water': return d.variant === 'pond' ? 'new pond' : 'river bend';
    case 'season': return d.variant === 'cold' ? 'cold snap' : 'warm spell';
    case 'bless': return 'blessing';
    case 'curio': return item(d.curio);
    case 'miracle': return 'rainbow';
  }
  return 'touch';
}

function daysPhrase(n) {
  if (n <= 0) return 'right';
  if (n === 1) return 'a day';
  const words = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  return (words[n] || String(n)) + ' days';
}

// The Keeper event a cause chain is rooted at, or null.
export function keeperCause(world, e) {
  const root = keeperRoot(world, e);
  if (!root) return null;
  const ke = world.events.find(x => KEEPER_KINDS.has(x.kind) && x.causes.some(c => c.action === root.action));
  return ke ? { action: root.action, event: ke } : null;
}

// ---- templates --------------------------------------------------------------
// Each returns an array of variants; one is picked per event, deterministically.
const MISFIRE_TEXT = {
  cooked_a_rock: 'tried to cook a rock. It did not go well. Everyone laughed.',
  singed_eyebrows: 'got a little too close to the fire and singed their eyebrows.',
  fed_fire_a_berry: 'tried to feed the fire a berry. The fire was not hungry.',
  tried_to_hug_the_fire: 'tried to hug the fire. Once.',
  taught_a_fish_to_sing: 'spent all afternoon trying to teach a fish to sing.',
  sat_in_the_river: 'sat down in the river to think and floated off a little way.',
  chased_a_reflection: 'chased their own reflection around the water.',
  wall_around_sleeping_friend: 'built a little wall around a sleeping friend.',
  stacked_stones_on_head: 'stacked stones on their own head. The stack fell.',
  named_a_rock: 'gave a rock a name and now carries it everywhere.',
  planted_a_pebble: 'planted a pebble and is waiting for it to grow.',
  talked_to_a_bush: 'had a long talk with a bush.',
  hid_berries_and_forgot: 'hid some berries for later and forgot where.',
  hummed_off_key: 'hummed so off key that everyone stopped to stare.',
  danced_into_a_bush: 'danced straight into a bush.',
  started_a_staring_contest: 'started a staring contest that nobody won.',
  wove_themselves_in: 'wove themselves into a mat by accident.',
  made_a_lumpy_hat: 'made a very lumpy hat and wears it proudly.',
  painted_a_friend_by_accident: 'painted a friend by accident.',
  fell_asleep_mid_thought: 'fell asleep halfway through a big idea.',
  forgot_what_they_were_doing: 'forgot what they were doing, twice.',
  licked_it: 'licked it. That was the whole experiment.',
  hurt_themselves: 'got hurt trying something new.'
};

const SUPERSTITION_TEXT = {
  rain_dance: ['The Wobblins now believe singing brings rain. They might be right.', 'Someone decided that singing calls the rain, and now everyone sings when it is dry.', 'A new belief: sing, and the sky will answer.'],
  tree_fear: ['After the lightning, they have started keeping away from the tallest tree.', 'The Wobblins now believe the tall tree is unlucky.', 'Nobody naps under the big tree anymore.'],
  lucky_stone: ['They have decided a certain gift is lucky and carry it to every experiment.', 'A lucky charm is going round the colony.', 'Some Wobblins swear their lucky charm helps. Maybe it does.'],
  fire_taboo: ['After the fire, the Wobblins have sworn off fire experiments for a while.', 'Fire is taboo for now. Nobody goes near the flames.', 'They are very careful around fire these days.'],
  keeper_watches_pond: ['The Wobblins believe you watch from the pond. Offerings now go into the water.', 'A new belief: the Keeper lives in the pond.', 'They have started leaving gifts by the pond, for you.']
};

function templates(world, e, ctx) {
  const a = e.actors[0], name = wob(world, a);
  const d = e.data || {};
  switch (e.kind) {
    case 'discovery':
    case 'rediscovery': {
      const D = disc(e.target);
      const kc = ctx.keeper;
      if (e.kind === 'rediscovery') {
        const prev = d.previousInventor ? wob(world, d.previousInventor) : null;
        return [
          `Long after it was forgotten, ${name} worked out ${D} all over again.`,
          `${D} is back. ${name} figured it out anew${prev ? `, long after ${prev}` : ''}.`,
          `${name} rediscovered ${D}, a skill the colony had lost.`
        ];
      }
      if (kc && e.t - kc.event.t > RECENT) {
        const what = actionName(kc.event);
        return [
          `${name} discovered ${D}, building on the ${what} you left long ago.`,
          `${name} figured out ${D}. It goes all the way back to your ${what}.`,
          `Your ${what} ${what.endsWith('s') ? 'are' : 'is'} still paying off: ${name} discovered ${D}.`
        ];
      }
      if (kc) {
        const when = daysPhrase(e.t - kc.event.t);
        const what = actionName(kc.event);
        const after = when === 'right' ? 'right after' : when + ' after';
        return [
          `${name} discovered ${D} ${after} your ${what}.`,
          `Your ${what} got ${name} thinking. ${when === 'right' ? 'Soon' : capital(when) + ' later'}, they discovered ${D}.`,
          `${name} figured out ${D}. It started with your ${what}.`
        ];
      }
      return [
        `${name} figured out ${D} all on their own.`,
        `Nobody showed them how. ${name} just worked out ${D}.`,
        `${name} discovered ${D}.`
      ];
    }
    case 'forgotten': {
      const D = disc(e.target);
      return e.actors.length ? [
        `When ${name} died, nobody else knew ${D}. It is forgotten.`,
        `${D} died with ${name}. Nobody remembers how.`,
        `${name} never passed on ${D}, and now it is gone.`
      ] : [`The colony has forgotten ${D}.`, `Nobody remembers ${D} anymore.`, `${D} has been lost.`];
    }
    case 'pondering': {
      const miss = (d.missing || []).map(token).join(' or ') || 'something';
      return [
        `${name} keeps staring at ${zone(d.zone)}, as if waiting for ${miss}. Something is missing.`,
        `${name} seems to be on the edge of an idea, if only there were ${miss}.`,
        `${name} keeps wondering about ${miss}.`
      ];
    }
    case 'misfire': {
      const txt = MISFIRE_TEXT[d.flavor] || 'tried something that did not work.';
      return [`${name} ${txt}`, `Meanwhile, ${name} ${txt}`, `${name} ${txt}`];
    }
    case 'burned': {
      const owner = d.owner ? wob(world, d.owner) + "'s" : 'a';
      const thing = d.was === 'hut' ? 'hut' : 'wall';
      return [
        `A fire experiment got out of hand and ${owner} ${thing} burned down. They will rebuild.`,
        `${name} was playing with fire and ${owner} ${thing} went up in smoke.`,
        `Bad news: ${owner} ${thing} burned. ${name} feels terrible.`
      ];
    }
    case 'superstition': return SUPERSTITION_TEXT[e.target] || [`The Wobblins have a new belief.`];
    case 'lost': return [
      `The ${item(d.item)} went ${d.where === 'river' ? 'down the river' : 'missing in the grass'} during one of ${name}'s experiments.`,
      `${name} lost the ${item(d.item)}.`,
      `Nobody can find the ${item(d.item)} since ${name} borrowed it.`
    ];
    case 'built': {
      const k = d.kind;
      const on = d.builtOn && ctx.builtOn;
      if (k === 'temple' && on) return [`The Wobblins built a temple to you. It stands on the ${on} you placed.`, `A temple now stands on your ${on}. It is for you.`, `They raised a temple on top of your ${on}.`];
      if (d.rebuilt) return [`${name} rebuilt the ${k}.`, `The ${k} is back up, thanks to ${name}.`, `${name} put the ${k} back together.`];
      const label = { wall: 'a low stone wall', hearth: 'a stone hearth', hut: 'a hut', garden: 'a garden', raft: 'a raft', totem: 'a carved totem of you', temple: 'a temple to you', mural: 'a mural' }[k] || 'something';
      return [`${name} built ${label} ${zoneIn(d.zone)}.`, `There is ${label} ${zoneIn(d.zone)} now. ${name} made it.`, `${name} finished ${label}.`];
    }
    case 'birth': return [
      `A baby Wobblin, ${name}, was born to ${wob(world, e.actors[1])} and ${wob(world, e.actors[2])}.`,
      `Welcome, ${name}. ${wob(world, e.actors[1])} and ${wob(world, e.actors[2])} have a baby.`,
      `${name} was born.`
    ];
    case 'death': {
      const why = { old_age: 'of old age', starvation: 'of hunger', cold: 'of the cold', injury: 'of their injuries' }[d.cause] || '';
      return [`${name} died ${why}. Their grave is on the hill.`, `The colony said goodbye to ${name}, who died ${why}.`, `${name} is gone, ${why}.`];
    }
    case 'paired': return [`${name} and ${wob(world, e.actors[1])} have paired up.`, `${name} and ${wob(world, e.actors[1])} are inseparable now.`, `${name} moved into a hut with ${wob(world, e.actors[1])}.`];
    case 'stranger_arrived': return d.by === 'raft'
      ? [`The raft came back with a stranger: ${name}.`, `${name} arrived by raft and decided to stay.`, `A stranger named ${name} floated in on the raft.`]
      : [`A stranger named ${name} wandered in and stayed.`, `${name} showed up from somewhere far away.`, `The colony has a newcomer: ${name}.`];
    case 'seed_pod_hatched': return [`The valley was empty, until a seed pod hatched: ${name} and ${wob(world, e.actors[1])}.`, `New life: a seed pod split open and out came ${name} and ${wob(world, e.actors[1])}.`, `After a long quiet, two new Wobblins hatched.`];
    case 'festival': return [`The Wobblins held a festival with lanterns and far too much food.`, `There was a festival! Everyone danced.`, `A big festival lit up the night.`];
    case 'ritual': return d.kind === 'rain_dance'
      ? [`The Wobblins danced for rain.`, `A rain dance broke out.`, `They sang to the dry sky.`]
      : [`They danced around the fire for you.`, `A fire dance in your honor.`, `The colony held a ritual by the hearth.`];
    case 'wish': return [`${name} made a wish: ${item(e.target)}.`, `${name} wishes for ${item(e.target)}.`, `At the temple, ${name} asked you for ${item(e.target)}.`];
    case 'wish_granted': return [`You granted ${name}'s wish. They are overjoyed.`, `${name} wished, and you answered.`, `${name}'s wish came true.`];
    case 'wish_expired': return [`${name}'s wish went unanswered.`, `${name} waited, but the wish did not come true.`, `${name} has stopped asking.`];
    case 'flood': return [`The river flooded.`, `Too much rain: the river burst its banks.`, `A flood swept the riverbank.`];
    case 'prowler': return [`Something prowled around ${zone(d.zone)} in the night.`, `A prowler scared everyone ${zoneIn(d.zone)}.`, `There were eyes in the dark near ${zone(d.zone)}.`];
    case 'injured': return [`${name} got hurt.`, `${name} is nursing an injury.`, `${name} was injured.`];
    case 'fire_started': return [`A fire started ${zoneIn(d.zone)}.`, `Flames ${zoneIn(d.zone)}!`, `Something caught fire ${zoneIn(d.zone)}.`];
    case 'pond_formed': return [`A new pond filled with water.`, `The pond is full.`, `Water filled the new pond.`];
    case 'tree_grown': {
      const what = { tree: 'A tree grew', bush: 'A berry bush grew', reeds: 'Reeds sprang up', clay: 'Clay showed up' }[d.kind] || 'Something green came up';
      return [`${what} ${zoneIn(d.zone)}.`, `${what} ${zoneIn(d.zone)}.`, `${what} ${zoneIn(d.zone)}.`];
    }
    case 'became_elder': return [`${name} is an elder now.`, `${name} has grown old and wise.`, `${name} has started telling long stories.`];
    case 'learned_from_structure': return [`${name} worked out ${disc(e.target)} just by studying what was left behind.`, `${name} figured out ${disc(e.target)} from an old structure.`, `${name} learned ${disc(e.target)} by watching how it was built.`];
    case 'ruin': return [`The ${item(d.was)} has fallen into ruin.`, `Nobody remembers how to keep the ${item(d.was)} up. It is a ruin now.`, `The old ${item(d.was)} is crumbling.`];
    case 'lightning': return [`Lightning struck in the night.`, `A dry storm cracked over the valley.`, `Lightning hit something.`];
  }
  return null;
}

function capital(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function choose(world, e, variants) {
  const r = rngFor(world.seed, 'recap', e.id);
  return variants[Math.floor(r() * variants.length)];
}

function ctxFor(world, e) {
  const ctx = {};
  if (e.kind === 'discovery') ctx.keeper = keeperCause(world, e);
  if (e.kind === 'built' && e.data.builtOn) {
    const o = world.objects.find(x => x.id === e.data.builtOn);
    if (o && o.origin.action !== undefined) ctx.builtOn = o.kind === 'boulder' ? 'boulder' : 'stones';
  }
  return ctx;
}

// One line for one event (Chronicle, Wobblin memories).
export function describeEvent(world, e) {
  const v = templates(world, e, ctxFor(world, e));
  if (v) return choose(world, e, v);
  switch (e.kind) {
    case 'keeper_power': case 'keeper_nudge': case 'keeper_gift': return 'You sent ' + aOrNone(actionName(e)) + '.';
    case 'taught': return `${wob(world, e.actors[0])} taught ${wob(world, e.actors[1])} ${disc(e.target)}.`;
    case 'experiment_failed': return `${wob(world, e.actors[0])} tried for ${disc(e.target)} and failed.`;
    case 'offering': return `${wob(world, e.actors[0])} left an offering${e.data.into === 'pond' ? ' in the pond' : ' at the shrine'}.`;
    case 'offerings_collected': return `You collected ${e.data.amount} offerings.`;
    case 'colony_founded': return `${e.data.colonyName} was founded.`;
    case 'healed': return `${wob(world, e.actors[0])} healed.`;
    case 'rain': return 'It rained.';
    case 'fire_out': return 'A fire went out.';
    case 'grew_up': return `${wob(world, e.actors[0])} grew up.`;
    case 'faith_shift': return `${wob(world, e.actors[0])}'s faith in you ${e.data.rising ? 'grew' : 'faded'}.`;
  }
  return e.kind.replace(/_/g, ' ');
}

function aOrNone(s) { return /^(rain|stones)$/.test(s) ? s : (/^[aeiou]/.test(s) ? 'an ' : 'a ') + s; }

// ---- the recap ----------------------------------------------------------------
// Window: everything that happened while away, ticks from..to-1 (the Keeper
// had seen the world at tick `from`; their own actions at `from` are not news).
export function recapEvents(world, fromTick, toTick) {
  return world.events.filter(e => e.t >= fromTick && e.t < toTick && !KEEPER_KINDS.has(e.kind));
}

export function buildRecap(world, fromTick, toTick) {
  const hours = Math.max(0, toTick - fromTick);
  const events = recapEvents(world, fromTick, toTick);
  const stats = {
    discoveries: events.filter(e => e.kind === 'discovery' || e.kind === 'rediscovery').length,
    births: events.filter(e => e.kind === 'birth').length,
    deaths: events.filter(e => e.kind === 'death').length,
    built: events.filter(e => e.kind === 'built').length,
    offerings: events.filter(e => e.kind === 'offering').reduce((s, e) => s + (e.data.amount || 1), 0)
  };
  const header = `You were gone ${hours} hour${hours === 1 ? '' : 's'}. ${hours} day${hours === 1 ? '' : 's'} passed in ${world.colonyName}.`;

  // Candidates: salient events with templates, ranked by salience then recency.
  const salient = events.filter(e => !BATCHED.has(e.kind) && e.salience >= 2 && templates(world, e, ctxFor(world, e)));
  const rank = e => (e.kind === 'discovery' || e.kind === 'rediscovery' ? 100 : 0) + e.salience * 10 + e.t / (toTick + 1);
  salient.sort((a, b) => rank(b) - rank(a) || b.id - a.id);
  const perKind = {};
  const chosen = [];
  for (const e of salient) {
    const k = e.kind === 'rediscovery' ? 'discovery' : e.kind;
    if ((perKind[k] || 0) >= 2) continue;   // at most 2 lines per kind
    perKind[k] = (perKind[k] || 0) + 1;
    chosen.push(e);
  }
  // Always include a Keeper-consequence line when any event in the window has one.
  const hasKeeperLine = list => list.some(e => e.kind === 'discovery' && keeperCause(world, e));
  let picked = chosen.slice(0, 6);
  if (!hasKeeperLine(picked)) {
    const kc = chosen.find(e => e.kind === 'discovery' && keeperCause(world, e)) ||
      salient.find(e => e.kind === 'discovery' && keeperCause(world, e));
    if (kc) picked = [kc, ...picked.filter(e => e !== kc)].slice(0, 6);
  }
  // Discoveries lead.
  picked.sort((a, b) => (isDisc(b) - isDisc(a)) || rank(b) - rank(a));

  const lines = picked.map(e => ({ text: describeEvent(world, e), eventIds: [e.id] }));

  // Batch the quiet stuff into one line.
  const taught = events.filter(e => e.kind === 'taught');
  if (taught.length && lines.length < 7) {
    const byD = {};
    for (const e of taught) (byD[e.target] ||= new Set()).add(e.actors[1]);
    const top = Object.keys(byD).sort().sort((a, b) => byD[b].size - byD[a].size)[0];
    const n = byD[top].size;
    const others = Object.keys(byD).length - 1;
    lines.push({
      text: `${disc(top)} spread to ${n} more Wobblin${n === 1 ? '' : 's'}` + (others > 0 ? `, and ${others} other skill${others === 1 ? ' was' : 's were'} passed on.` : '.'),
      eventIds: taught.filter(e => e.target === top).map(e => e.id)
    });
  }
  const fails = events.filter(e => e.kind === 'experiment_failed');
  if (fails.length >= 3 && lines.length < 3) {
    lines.push({ text: `They kept experimenting: ${fails.length} ideas did not work out (yet).`, eventIds: fails.map(e => e.id) });
  }
  if (stats.offerings > 0 && lines.length < 7) {
    const off = events.filter(e => e.kind === 'offering');
    const n = Math.round(stats.offerings);
    lines.push({ text: `${n} offering${n === 1 ? ' is' : 's are'} waiting for you at the shrine.`, eventIds: off.map(e => e.id) });
  }
  if (!lines.length) lines.push({ text: 'A quiet stretch. Everyone ate, napped, and hummed.', eventIds: [] });

  const highlights = [];
  for (const l of lines.slice(0, 7)) {
    for (const id of l.eventIds.slice(0, 3)) {
      const e = world.events[id - 1];
      if (!e) continue;
      const tgt = e.target && world.objects.find(o => o.id === e.target && !o.state.gone);
      if (tgt && !highlights.includes(tgt.id)) highlights.push(tgt.id);
      const who = world.wobblins.find(w => w.id === e.actors[0] && w.alive);
      if (who && !highlights.includes(who.id)) highlights.push(who.id);
    }
  }
  return { header, lines: lines.slice(0, 7), highlights, stats, fromTick, toTick };
}

function isDisc(e) { return e.kind === 'discovery' || e.kind === 'rediscovery' ? 1 : 0; }

// Plain JSON for the week-2 AI: selected events with resolved causes and the
// profiles of everyone involved. Everything the AI may mention is in here.
export function buildRecapInput(world, fromTick, toTick) {
  const recap = buildRecap(world, fromTick, toTick);
  const ids = new Set(recap.lines.flatMap(l => l.eventIds));
  const events = [...ids].map(id => world.events[id - 1]).filter(Boolean).map(e => {
    const kc = keeperCause(world, e);
    return { id: e.id, t: e.t, kind: e.kind, actors: e.actors, target: e.target, data: e.data,
      keeperCause: kc ? { action: kc.action, what: actionName(kc.event), daysBefore: e.t - kc.event.t } : null };
  });
  const who = new Set(events.flatMap(e => e.actors));
  const wobblins = world.wobblins.filter(w => who.has(w.id)).map(w => ({
    id: w.id, name: w.name, alive: w.alive, stage: w.stage, traits: w.traits, hobby: w.hobby,
    faith: w.faith, beliefs: w.beliefs, memories: w.memories.slice(-5).map(id => describeEvent(world, world.events[id - 1]))
  }));
  return { colonyName: world.colonyName, keeperName: world.keeperName, hoursAway: toTick - fromTick,
    header: recap.header, templateLines: recap.lines, events, wobblins, stats: recap.stats };
}
