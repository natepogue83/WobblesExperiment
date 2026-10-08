// panels.js — recap card, Chronicle, Discovery Book and Wobblin cards.
// Read-only views of the world; they never change it.
import { DISCOVERIES, BY_ID } from '../sim/discoveries.js';
import { inheritance } from './moments.js';
import { voiceLine } from './voice.js';
import { describeEvent, keeperCause, actionName } from '../sim/recap.js';
import { wobblinSVG } from '../render/sprites.js';
import { temperOf, decorOf } from '../render/render.js';
import { SKILLS, SKILL_NAMES, levelOf, xpForLevel, MAX_LEVEL, titleOf } from '../sim/growth.js';

const h = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const k in props) {
    if (k === 'class') e.className = props[k];
    else if (k.startsWith('on')) e[k] = props[k];
    else e.setAttribute(k, props[k]);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : String(c));
  return e;
};

export function portrait(w, size = 44, world = null) {
  if (world && w.traits) w = { ...w, ...decorOf(world, w) };
  const span = h('span', { class: 'portrait', style: `width:${size}px;height:${size}px` });
  span.innerHTML = `<svg viewBox="-28 -52 56 58" width="${size}" height="${size}" aria-hidden="true">${wobblinSVG({ ...w, temper: w.traits ? temperOf(w) : w.temper, carry: [] })}</svg>`;
  return span;
}

function closeButton(panel, onClose) {
  return h('button', { class: 'ghost close', onclick: () => { panel.hidden = true; if (onClose) onClose(); } }, 'Close');
}

// ---- recap ------------------------------------------------------------------
export function showRecapCard(panel, world, narrated, { onPick, onClose }) {
  panel.replaceChildren(h('h2', {}, narrated.header));
  const list = h('ul', { class: 'recap-lines' });
  for (const line of narrated.lines) {
    const ev = line.eventIds.map(id => world.events[id - 1]).find(e => e && e.actors && e.actors.length);
    const who = ev && world.wobblins.find(w => w.id === ev.actors[0]);
    const li = h('li', { tabindex: 0 }, who ? portrait(who, 30, world) : h('span', { class: 'dot' }), h('span', {}, line.text));
    li.onclick = () => {
      for (const x of list.children) x.classList.remove('on');
      li.classList.add('on');
      onPick(line.eventIds);
    };
    list.append(li);
  }
  panel.append(list);
  if (narrated.stats) {
    const s = narrated.stats;
    panel.append(h('p', { class: 'stats' }, [
      `${s.discoveries} discover${s.discoveries === 1 ? 'y' : 'ies'}`, `${s.births} birth${s.births === 1 ? '' : 's'}`,
      `${s.deaths} death${s.deaths === 1 ? '' : 's'}`, `${s.built} built`, `${Math.round(s.offerings)} offering${Math.round(s.offerings) === 1 ? '' : 's'}`
    ].join(' · ')));
  }
  panel.append(h('button', { onclick: () => { panel.hidden = true; onClose(); } }, 'Back to the valley'));
  panel.hidden = false;
}

// ---- chronicle --------------------------------------------------------------
const CHRONICLE_HIDE = new Set(['taught', 'experiment_failed', 'offering', 'healed', 'rain', 'fire_out', 'grew_up', 'faith_shift', 'tree_grown']);

export function showChronicle(panel, world, { filter = 'all', onPick }) {
  const draw = f => {
    panel.replaceChildren(h('h2', {}, 'Chronicle of ' + world.colonyName));
    const tabs = h('div', { class: 'tabs' },
      h('button', { class: f === 'all' ? 'on' : '', onclick: () => draw('all') }, 'Everything'),
      h('button', { class: f === 'disc' ? 'on' : '', onclick: () => draw('disc') }, 'Discoveries'));
    panel.append(tabs);
    const list = h('ol', { class: 'chronicle', reversed: '' });
    const evs = world.events.filter(e => f === 'disc'
      ? ['discovery', 'rediscovery', 'forgotten'].includes(e.kind)
      : !CHRONICLE_HIDE.has(e.kind)).slice(-300).reverse();
    for (const e of evs) {
      const li = h('li', {}, h('span', { class: 'day' }, 'Day ' + (e.t + 1)), ' ', describeEvent(world, e));
      if (f === 'disc' && e.kind !== 'forgotten') {
        const kc = keeperCause(world, e);
        const inv = world.wobblins.find(w => w.id === e.actors[0]);
        li.append(h('div', { class: 'why' },
          'Inventor: ' + (inv ? inv.name : '?') + (kc ? ` · started with your ${actionName(kc.event)} (day ${kc.event.t + 1})` : ' · their own idea')));
      }
      li.onclick = () => onPick([e.id]);
      list.append(li);
    }
    if (!evs.length) list.append(h('li', {}, 'Nothing yet.'));
    panel.append(list, closeButton(panel));
  };
  draw(filter);
  panel.hidden = false;
}

// ---- discovery book -----------------------------------------------------------
export function showBook(panel, world) {
  const found = DISCOVERIES.filter(d => world.discoveries[d.id]);
  panel.replaceChildren(h('h2', {}, 'Discovery Book'),
    h('p', { class: 'muted' }, `${found.length} of 30 discovered. You can't teach them; you can only set the stage.`));
  const grid = h('div', { class: 'book' });
  for (const tier of [1, 2, 3, 4]) {
    for (const d of DISCOVERIES.filter(x => x.tier === tier)) {
      const rec = world.discoveries[d.id];
      if (!rec) { grid.append(h('div', { class: 'page unknown', title: 'Not yet discovered' }, h('span', { class: 'sil' }, '?'), h('small', {}, 'Tier ' + tier))); continue; }
      const inv = world.wobblins.find(w => w.id === rec.inventor);
      grid.append(h('div', { class: 'page' + (rec.forgotten ? ' forgotten' : '') },
        inv ? portrait(inv, 40, world) : '',
        h('b', {}, d.name),
        h('small', {}, (inv ? inv.name : '?') + ', day ' + (rec.tick + 1) + (rec.forgotten ? ' · forgotten' : ''))));
    }
  }
  panel.append(grid, closeButton(panel));
  panel.hidden = false;
}

// ---- the family: every Wobblin by generation, strongest traits at a glance ----
const TRAIT_SHORT = { curiosity: 'Curious', boldness: 'Brave', sociability: 'Friendly', patience: 'Patient', playfulness: 'Playful', piety: 'Devout', caution: 'Careful' };
export function showFamily(panel, world, { onPick }) {
  const gen = new Map();
  const genOf = w => {
    if (gen.has(w.id)) return gen.get(w.id);
    const ps = w.parents.map(id => world.wobblins.find(x => x.id === id)).filter(Boolean);
    const g = ps.length ? 1 + Math.max(...ps.map(genOf)) : 1;
    gen.set(w.id, g);
    return g;
  };
  const name = id => (world.wobblins.find(x => x.id === id) || {}).name || '?';
  const all = world.wobblins.slice();
  const maxGen = Math.max(1, ...all.map(genOf));
  const rows = [];
  for (let g = maxGen; g >= 1; g--) {
    const ws = all.filter(w => genOf(w) === g).sort((a, b) => (b.alive - a.alive) || a.bornTick - b.bornTick);
    if (!ws.length) continue;
    const living = ws.filter(w => w.alive);
    const shown = [...living, ...ws.filter(w => !w.alive).slice(-6)];
    rows.push(h('div', { class: 'gen' }, h('h3', { class: 'sub' }, g === 1 ? 'Founders and wanderers' : 'Generation ' + g),
      h('div', { class: 'fam' }, shown.map(w => {
        const top = Object.entries(w.traits).sort((a, b) => b[1] - a[1]).slice(0, 2);
        const card = h('button', { class: 'kin' + (w.alive ? '' : ' gone'), onclick: () => w.alive && onPick(w) },
          portrait(w, 52, world), h('b', {}, w.name),
          h('small', {}, top.map(([k, v]) => TRAIT_SHORT[k] + ' ' + Math.max(1, Math.round(v * 10))).join(' · ')),
          h('small', { class: 'par' }, w.parents.length ? 'of ' + w.parents.map(name).join(' & ') : w.alive ? (w.partnerId ? 'with ' + name(w.partnerId) : 'single') : 'remembered'));
        return card;
      }))));
  }
  const pairs = world.wobblins.filter(w => w.alive && w.partnerId && w.id < w.partnerId).length;
  panel.replaceChildren(h('h2', {}, 'The family of ' + world.colonyName),
    h('p', { class: 'muted' }, `${all.filter(w => w.alive).length} alive · ${pairs} pair${pairs === 1 ? '' : 's'} · ${maxGen} generation${maxGen === 1 ? '' : 's'}. Babies take after one parent or the other in each trait. To breed for a trait, set two single Wobblins who have it down together, somewhere with a hut.`),
    ...rows, closeButton(panel));
  panel.hidden = false;
}

// ---- the Keeper's path: ages and goals ----------------------------------------
export function showGoals(panel, world, { states, age, onClaim, feedback }) {
  const nextOpen = states.find(g => g.state === 'open');
  const rows = states.map(g => h('li', { class: 'goal ' + g.state },
    h('span', { class: 'tick' }, g.state === 'claimed' ? '✓' : g.state === 'ready' ? '!' : ''),
    h('div', {}, h('b', {}, g.text), g === nextOpen ? h('small', {}, g.hint) : ''),
    g.state === 'ready' ? h('button', { class: 'claim', onclick: () => onClaim(g.id) }, 'Claim +' + g.belief) :
      h('span', { class: 'reward' }, '+' + g.belief)));
  const done = states.filter(g => g.state === 'claimed').length;
  panel.replaceChildren(h('h2', {}, "The Keeper's path"),
    h('p', { class: 'age-line' }, h('b', {}, age.name), ' · ' + done + ' of ' + states.length + ' milestones'),
    h('p', { class: 'muted' }, 'Milestones are things to aim for. Each one you reach deepens their belief in you, and belief unlocks new powers.'),
    h('ul', { class: 'goals' }, rows),
    feedback ? h('p', { class: 'goals-foot' }, h('a', { href: feedback.url, target: '_blank', rel: 'noopener' }, feedback.label)) : '',
    closeButton(panel));
  panel.hidden = false;
}

// ---- wobblin card -------------------------------------------------------------
// Tap the name to type a new one (letters, spaces, ' and -; up to 14).
function renameField(btn, w, onRename) {
  if (!onRename) return;
  const input = h('input', { class: 'name-input', value: w.name, maxlength: '14', 'aria-label': 'New name' });
  const done = save => { if (save && input.value.trim() && input.value.trim() !== w.name) onRename(w, input.value.trim()); else input.replaceWith(btn); };
  input.addEventListener('keydown', ev => { if (ev.key === 'Enter') done(true); if (ev.key === 'Escape') done(false); });
  input.addEventListener('blur', () => done(true));
  btn.replaceWith(input);
  input.focus(); input.select();
}
const TRAIT_LABEL = { curiosity: 'Curiosity', boldness: 'Bravery', sociability: 'Friendliness', patience: 'Patience', playfulness: 'Playfulness', piety: 'Faith in you', caution: 'Caution' };
const TRAIT_HELP = { curiosity: 'tries new things', boldness: 'brave around fire, water, danger', sociability: 'teaches, sings, pairs up', patience: 'fiddly work: tools, weaving, gardens',
  playfulness: 'music, shiny things, paint', piety: 'rituals, totems, the temple', caution: 'worries enough to build walls and huts' };
const stat10 = v => Math.max(1, Math.round(v * 10));

export function showWobblinCard(panel, world, w, { onBless, onRename, wantText, hints = [] }) {
  const age = world.tick - w.bornTick;
  const pct = v => Math.round(v * 100);
  const blessed = k => w.temp[k] && w.temp[k].until > world.tick;
  const traits = h('ul', { class: 'traits stats' }, Object.keys(TRAIT_LABEL).filter(k => w.traits[k] !== undefined).map(k => {
    const v = w.traits[k] + (blessed(k) ? w.temp[k].add : 0);
    return h('li', { title: TRAIT_HELP[k] }, h('span', { class: 'tl' }, TRAIT_LABEL[k]),
      h('span', { class: 'bar' + (blessed(k) ? ' blessed' : '') }, h('i', { style: `width:${Math.min(100, pct(v))}%` })),
      h('b', { class: 'num' }, String(Math.min(10, stat10(v))) + (blessed(k) ? '★' : '')));
  }));
  const skills = h('ul', { class: 'traits skills' }, SKILLS.map(k => {
    const xp = (w.skills || {})[k] || 0, lvl = levelOf(xp);
    const into = lvl >= MAX_LEVEL ? 1 : (xp - xpForLevel(lvl)) / (xpForLevel(lvl + 1) - xpForLevel(lvl));
    return h('li', {}, h('span', { class: 'tl' }, SKILL_NAMES[k]), h('span', { class: 'bar xp' }, h('i', { style: `width:${pct(into)}%` })), h('b', { class: 'num' }, 'Lv ' + lvl));
  }));
  const knows = Object.keys(w.knows).filter(k => BY_ID[k]).map(k => h('span', { class: 'chip' }, BY_ID[k].name));
  const faithWord = w.faith > 0.5 ? 'devoted to you' : w.faith > 0.2 ? 'trusts you' : w.faith < -0.3 ? 'afraid of you' : w.faith < 0 ? 'wary of you' : 'unsure about you';
  const memories = w.memories.slice(-4).reverse().map(id => world.events[id - 1]).filter(Boolean).map(e => h('li', {}, describeEvent(world, e)));
  const name = id => (world.wobblins.find(x => x.id === id) || {}).name;
  const kids = world.wobblins.filter(x => x.parents.includes(w.id));
  const birth = w.parents.length ? world.events.find(e => e.kind === 'birth' && e.actors[0] === w.id) : null;
  const got = birth ? inheritance(world, birth) : [];
  const pals = Object.entries(w.bonds || {}).filter(([id]) => world.wobblins.some(x => x.id === id && x.alive));
  const friends = pals.filter(([, v]) => v >= 0.5).map(([id]) => name(id)), rivals = pals.filter(([, v]) => v <= -0.4).map(([id]) => name(id));
  const family = [w.partnerId ? 'partner of ' + name(w.partnerId) : null, friends.length ? 'friends with ' + friends.join(', ') : null, rivals.length ? 'rivals with ' + rivals.join(', ') : null, w.parents.length ? 'child of ' + w.parents.map(name).join(' & ') : null,
    kids.length ? kids.length + (kids.length === 1 ? ' child' : ' children') : null].filter(Boolean).join(' · ');
  const takes = got.length ? h('p', { class: 'takes' }, 'Takes after: ' + got.map(g => g.text).join(', ')) : '';
  const hintList = hints.length ? h('div', { class: 'hints' }, h('b', {}, 'Could work out, if they were more...'),
    h('ul', {}, hints.map(x => h('li', {}, (stat10(x.have) >= stat10(x.need) ? `${x.name}: needs just a little more ${TRAIT_LABEL[x.trait]}` : `${x.name}: needs ${TRAIT_LABEL[x.trait]} ${stat10(x.need)} (has ${stat10(x.have)})`) + (x.here ? '. Everything else is right here!' : '.')))),
    h('p', { class: 'muted' }, 'Bless them for a boost, or raise a Wobblin born with more of it.')) : '';
  panel.replaceChildren(
    h('div', { class: 'card-head' }, portrait(w, 72, world), h('div', {},
      h('h2', {}, h('button', { class: 'name-btn', title: 'Give them a new name', onclick: ev => renameField(ev.currentTarget, w, onRename) }, w.name), ' ', h('span', { class: 'title' }, titleOf(w))),
      h('p', { class: 'muted' }, `${w.stage}, ${age} days old · loves ${w.hobby} · ${faithWord}`),
      family ? h('p', { class: 'muted' }, family) : '')),
    (() => { const v = voiceLine(world, w); return v ? h('p', { class: 'voice' }, '“' + v + '”') : ''; })(),
    wantText ? h('p', { class: 'want-line' }, wantText) : '',
    h('h3', { class: 'sub' }, 'Stats'), traits, takes,
    h('h3', { class: 'sub' }, 'Skills'), skills,
    hintList,
    h('p', { class: 'knows' }, h('b', {}, 'Knows: '), knows.length ? knows : 'nothing yet'),
    w.beliefs.length ? h('p', {}, h('b', {}, 'Believes: '), w.beliefs.map(b => b.replace(/_/g, ' ')).join(', ')) : '',
    memories.length ? h('div', {}, h('b', {}, 'Remembers'), h('ul', { class: 'memories' }, memories)) : '',
    h('button', { onclick: () => onBless(w) }, 'Bless ' + w.name),
    closeButton(panel));
  panel.hidden = false;
}
