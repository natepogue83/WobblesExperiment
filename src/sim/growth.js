// growth.js — Wobblins get better at what they do, and change with what
// happens to them. Skills earn XP from practice and level up; level-ups and
// experiences nudge their traits, so personalities develop over a life.
// Deterministic (no rolls at all) and never adds knowledge.
import { emit } from './events.js';
import { alive, r3, clamp01 } from './util.js';

export const SKILLS = ['foraging', 'building', 'crafting', 'social', 'explore'];
export const SKILL_NAMES = { foraging: 'Foraging', building: 'Building', crafting: 'Tinkering', social: 'Storytelling', explore: 'Exploring' };
// Each skill's level-ups grow a matching trait.
const SKILL_TRAIT = { foraging: 'patience', building: 'patience', crafting: 'curiosity', social: 'sociability', explore: 'boldness' };
// Hobbies practise a skill.
const HOBBY_SKILL = {
  'stacking stones': 'building', 'humming': 'social', 'collecting shiny things': 'crafting', 'napping in sun': null,
  'watching clouds': 'explore', 'chasing bugs': 'explore', 'poking puddles': 'explore', 'sniffing flowers': 'foraging'
};

export const MAX_LEVEL = 10;
export function levelOf(xp) { return Math.min(MAX_LEVEL, Math.floor(Math.sqrt((xp || 0) / 4))); }
export function xpForLevel(l) { return 4 * l * l; }
export function skillLevel(w, s) { return w.skills ? levelOf(w.skills[s]) : 0; }

export function newSkills() { return { foraging: 0, building: 0, crafting: 0, social: 0, explore: 0 }; }

// Add XP; announce level-ups and grow the matching trait.
export function practice(world, w, skill, xp) {
  if (!w.skills) w.skills = newSkills();
  const before = levelOf(w.skills[skill]);
  w.skills[skill] = r3(w.skills[skill] + xp);
  const after = levelOf(w.skills[skill]);
  if (after > before) {
    const t = SKILL_TRAIT[skill];
    w.traits[t] = r3(clamp01(w.traits[t] + 0.02 * (after - before)));
    emit(world, { kind: 'level_up', actors: [w.id], target: skill, data: { skill, level: after, trait: t }, salience: after < 3 ? 1 : after % 3 === 0 ? 3 : 2 });
  }
}

// Experiences shape temperament a little.
export function shapeTrait(w, trait, d) {
  if (w.traits[trait] === undefined) return;
  w.traits[trait] = r3(clamp01(w.traits[trait] + d));
}

// Once per tick: practice whatever they spent the day doing.
export function growthStep(world) {
  for (const w of alive(world)) {
    if (w.stage === 'baby') { practice(world, w, 'explore', 0.5); continue; }
    switch (w.activity) {
      case 'forage': practice(world, w, 'foraging', 1); break;
      case 'inspect': practice(world, w, 'explore', 1); break;
      case 'hobby': { const s = HOBBY_SKILL[w.hobby]; if (s) practice(world, w, s, 1); break; }
      case 'warm': case 'rest': break;
    }
  }
}

// Titles for cards and recaps: "the Brave Builder", "the Curious".
const ADJ = { curiosity: 'Curious', boldness: 'Brave', sociability: 'Friendly', patience: 'Patient', playfulness: 'Playful', piety: 'Devout', caution: 'Careful' };
const NOUN = { foraging: 'Forager', building: 'Builder', crafting: 'Tinkerer', social: 'Storyteller', explore: 'Explorer' };
export function titleOf(w) {
  const tr = Object.entries(w.traits).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
  const sk = w.skills ? Object.entries(w.skills).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0] : null;
  const adj = tr && tr[1] >= 0.6 ? ADJ[tr[0]] : null;
  const noun = sk && levelOf(sk[1]) >= 3 ? NOUN[sk[0]] : null;
  if (adj && noun) return 'the ' + adj + ' ' + noun;
  if (noun) return 'the ' + noun;
  if (adj) return 'the ' + adj;
  return w.stage === 'baby' ? 'the Little' : 'the Ordinary';
}
