// moments.js — the big beats get a moment of their own: a discovery card with
// confetti, a baby's arrival, a goodbye. UI only; reads events, never the clock
// of the sim.
import { BY_ID } from '../sim/discoveries.js';
import { wobblinSVG } from '../render/sprites.js';
import { discoveryIcon } from '../render/icons.js';

// What changes for them once they know it (never how to find it).
const BLURB = {
  fire_warmth: 'They will gather round a fire to keep warm now.',
  stone_stacking: 'Stacked stones: their first idea of building.',
  foraging: 'They know which berries are good. Fewer hungry days.',
  wading: 'The water is less scary now. The river is theirs to explore.',
  rhythm: 'Tapping, clapping, stomping. The valley has a beat.',
  digging: 'They can dig. The ground holds secrets.',
  leaf_bed: 'Soft beds of leaves. Better naps, better moods.',
  shiny_keeping: 'They collect pretty things. Treasure means something now.',
  fire_carrying: 'They can carry fire with them, anywhere they go.',
  sharp_stone: 'Their first tool. Everything gets a little easier.',
  wall: 'A wall against the wind and the dark.',
  planting: 'They plant seeds on purpose. Food that grows where they want.',
  fishing: 'Fish for dinner. The river feeds them now.',
  clay_shaping: 'Squishing clay into shapes. The start of pottery.',
  song: 'Their first song. They sing together now.',
  weaving: 'Woven baskets. They can carry more.',
  hearth: 'A fire that stays: a heart for their home.',
  hut: 'A real home. Warm nights, and room for babies.',
  cooking: 'Cooked food. Tastier and more filling.',
  pottery: 'Pots to keep food and water.',
  garden: 'A garden of their own, tended every day.',
  raft: 'A raft! The river is a road now, and strangers may follow it.',
  ritual: 'A ritual for you, the Keeper. Their faith takes shape.',
  paint: 'Paint! Their memories go up on the walls.',
  lore: 'Stories passed down. What the old ones know will not be lost.',
  festival: 'A festival: the whole colony celebrates together.',
  totem: 'A totem to watch over them.',
  temple: 'A temple, built for you. They can ask you for things now.',
  star_watching: 'They watch the stars and count the seasons.',
  herb_healing: 'Healing herbs. Injuries mend faster now.'
};

const TRAIT_WORD = { curiosity: 'curiosity', boldness: 'bravery', sociability: 'friendliness', patience: 'patience', playfulness: 'playfulness', piety: 'faith', caution: 'caution' };

// Which parent a baby takes after, trait by trait (from the birth event).
export function inheritance(world, e) {
  const name = id => (world.wobblins.find(w => w.id === id) || {}).name || '?';
  const from = e.data.from || {}, born = e.data.born || {};
  const lines = [];
  for (const [k, who] of Object.entries(from)) {
    if (who === 'surprise') lines.push({ k, text: (born[k] > (e.data.mid || {})[k] ? 'a surprising amount of ' : 'surprisingly little ') + TRAIT_WORD[k], v: born[k], rank: 2 });
    else if (who !== 'both' && born[k] >= 0.55) lines.push({ k, text: name(who) + "'s " + TRAIT_WORD[k], v: born[k], rank: born[k] });
  }
  return lines.sort((x, y) => y.rank - x.rank).slice(0, 3);
}

let queue = [], showing = false, lastWorld = null;

// Banners (unlocks, milestones) wait their turn behind discovery and baby cards.
export function queueBanner(title, sub) {
  queue.push({ kind: 'banner', title, sub });
  if (!showing) next(null);
}
export function momentShowing() { return showing; }

function bannerCard(title, sub, done) {
  const b = document.createElement('div');
  b.className = 'banner';
  b.innerHTML = `<b>${title}</b><span>${sub}</span>`;
  document.body.append(b);
  setTimeout(() => { b.remove(); done(); }, 3600);
}

export function momentsFor(world, events) {
  lastWorld = world;
  for (const e of events) {
    if (e.kind === 'discovery') queue.push({ kind: 'discovery', e });
    else if (e.kind === 'birth') queue.push({ kind: 'birth', e });
    else if (e.kind === 'goal_reached') continue;
  }
  if (!showing) next(world);
}

function next(world) {
  world = world || lastWorld;
  const m = queue.shift();
  if (!m) { showing = false; return; }
  showing = true;
  if (m.kind === 'banner') bannerCard(m.title, m.sub, () => next(world));
  else if (m.kind === 'discovery') discoveryCard(world, m.e, () => next(world));
  else if (m.kind === 'birth') birthCard(world, m.e, () => next(world));
}

function discoveryCard(world, e, done) {
  const d = BY_ID[e.target];
  if (!d) { done(); return; }
  const inv = world.wobblins.find(w => w.id === e.actors[0]);
  const n = Object.keys(world.discoveries).length;
  const card = document.createElement('div');
  card.className = 'moment discovery tier' + d.tier;
  card.innerHTML = `
    <div class="burst" aria-hidden="true"></div>
    <div class="who">${inv ? `<svg viewBox="-30 -58 60 64" width="96" height="100" aria-hidden="true">${wobblinSVG({ ...inv, face: 'love', carry: [] })}</svg>` : ''}</div>
    <div class="what">
      <small>Eureka! · ${inv ? esc(inv.name) : 'Someone'} worked something out</small>
      <b><span class="dicon">${discoveryIcon(d.id, 30)}</span>${esc(d.name)}</b>
      <p>${BLURB[d.id] || ''}</p>
      <span class="meta">Tier ${d.tier} · ${n} of 30 discovered</span>
    </div>`;
  document.body.append(card);
  confetti(card.querySelector('.burst'), d.tier);
  let gone = false;
  const close = () => { if (gone) return; gone = true; card.classList.add('out'); setTimeout(() => { card.remove(); done(); }, 350); };
  card.addEventListener('pointerdown', close);
  setTimeout(close, 5200);
}

function birthCard(world, e, done) {
  const [baby, a, b] = e.actors.map(id => world.wobblins.find(w => w.id === id));
  if (!baby) { done(); return; }
  const got = inheritance(world, e);
  const card = document.createElement('div');
  card.className = 'moment birth';
  card.innerHTML = `
    <div class="burst" aria-hidden="true"></div>
    <div class="who">${wobblinSVGBox(baby)}</div>
    <div class="what">
      <small>A baby! · born to ${esc(a ? a.name : '?')} and ${esc(b ? b.name : '?')}</small>
      <b>${esc(baby.name)}</b>
      <p>${got.length ? esc(baby.name) + ' got ' + got.map(g => esc(g.text) + ' (' + Math.max(1, Math.round(g.v * 10)) + ')').join(', ').replace(/, ([^,]*)$/, ' and $1') + '.' : esc(baby.name) + ' is a little of both.'}</p>
      <span class="meta">Tap them to see all their stats</span>
    </div>`;
  document.body.append(card);
  confetti(card.querySelector('.burst'), 0, ['#ffc2d4', '#ffe1ea', '#ffd86b', '#c9e8ff']);
  let gone = false;
  const close = () => { if (gone) return; gone = true; card.classList.add('out'); setTimeout(() => { card.remove(); done(); }, 350); };
  card.addEventListener('pointerdown', close);
  setTimeout(close, 5200);
}

function wobblinSVGBox(w) {
  return `<svg viewBox="-30 -58 60 64" width="96" height="100" aria-hidden="true">${wobblinSVG({ ...w, face: 'love', carry: [] })}</svg>`;
}

function confetti(el, tier, palette) {
  const colors = palette || ['#ffd24a', '#ff8fa3', '#7cc6ff', '#8ee08a', '#c9a6ff', '#ffb36b'];
  const n = 26 + tier * 6;
  let html = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.3, d = 90 + Math.random() * 120;
    html += `<i style="--x:${(Math.cos(a) * d).toFixed(0)}px;--y:${(Math.sin(a) * d * 0.7 - 30).toFixed(0)}px;--r:${(Math.random() * 720 - 360).toFixed(0)}deg;background:${colors[i % colors.length]};animation-delay:${(Math.random() * 0.12).toFixed(2)}s"></i>`;
  }
  el.innerHTML = html;
}

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
