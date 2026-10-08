// render.js — renderState(world) is pure data; drawSVG(svg, rs, opts) paints it.
// Layers back to front: sky, hills, terrain, nature, structures, wobblins,
// effects, halos. Every living Wobblin and live object gets a stable element id.
// The painted backdrop lives in scene.js; Wobblin art in sprites.js.
import { VIEW, ZONES, GRAVEYARD, slotInfo } from '../sim/geometry.js';
import { rngFor } from '../sim/rng.js';
import { BY_ID } from '../sim/discoveries.js';
import { wobblinSVG, objectSVG, bubbleSVG, emoteSVG, wantSVG } from './sprites.js';
import { sceneSVG, lightSVG, timeOfDay, sceneOverlaySVG, ambientSVG } from './scene.js';
import { ART_DEFS } from './objects.js';

export const LAYERS = ['sky', 'hills', 'terrain', 'nature', 'structures', 'wobblins', 'effects', 'halos'];
const NATURE = new Set(['tree', 'bush', 'sprout', 'stones', 'boulder', 'reeds', 'fish', 'clay', 'gift', 'curio', 'fire']);

function objectPos(o) {
  if (o.kind === 'grave') {
    const i = o.state.index;
    return { x: GRAVEYARD.x + (i % GRAVEYARD.perRow) * GRAVEYARD.dx, y: GRAVEYARD.y + Math.floor(i / GRAVEYARD.perRow) * GRAVEYARD.dy };
  }
  if (!o.slot) {
    // Unslotted things (fish) sit in the water of their zone.
    if (o.zone === 'pondsite') return { x: 905, y: 440 };
    const z = ZONES[o.zone];
    return { x: z.cx + 60, y: z.cy + 50 };
  }
  const s = slotInfo(o.slot);
  const s2 = o.slots ? slotInfo(o.slots[1]) : null;
  return s2 ? { x: (s.x + s2.x) / 2, y: (s.y + s2.y) / 2 } : { x: s.x, y: s.y };
}

const BUBBLE = { discovery: 'spark', rediscovery: 'spark', misfire: 'smoke', experiment_failed: 'question', pondering: 'ponder', paired: 'heart', taught: 'question' };
const BUBBLE_RANK = { spark: 5, smoke: 4, ponder: 3, heart: 2, question: 1 };

// The face follows how they feel right now.
export function faceOf(w) {
  const n = w.needs;
  if (w.activity === 'rest') return 'sleep';
  if (n.warmth < 0.25) return 'cold';
  if (n.safety < 0.4) return 'scared';
  if (n.mood > 0.78) return 'happy';
  if (n.mood < 0.35) return 'sad';
  if (n.mood < 0.5) return 'meh';
  return 'content';
}

// Stimulus token -> icon for "something's missing".
const TOKEN_ICON = { fire: 'fire', kept_fire: 'fire', hearth: 'fire', stones: 'stones', boulder: 'stones', wall: 'stones', tree: 'tree',
  bush: 'berry', sprout: 'berry', garden: 'berry', reeds: 'tree', river: 'water', pond: 'water', fish: 'water', wet: 'rain', clay: 'stones', gift: 'gift', curio: 'gift' };

// What a Wobblin wants most right now (null if nothing pressing).
export function wantOf(world, w, lonely) {
  const n = w.needs;
  if (n.food < 0.3) return { kind: 'hungry', item: 'berry' };
  if (n.warmth < 0.32) return { kind: 'cold', item: 'cold' };
  if (n.safety < 0.45) return { kind: 'scared', item: 'scared' };
  if (n.rest < 0.18 && w.activity !== 'rest') return { kind: 'tired', item: 'tired' };
  const p = world.pondering[w.id];
  if (p) {
    const ids = Object.keys(p).filter(d => world.tick - p[d] >= 6).sort((a, b) => p[a] - p[b]);
    if (ids.length && BY_ID[ids[0]]) {
      const st = BY_ID[ids[0]].stimuli.find(s => s.anyOf);
      const tok = st ? st.anyOf[0] : 'idea';
      return { kind: 'idea', item: TOKEN_ICON[tok] || (tok.startsWith('item:') ? 'gift' : 'idea'), discovery: ids[0] };
    }
  }
  if (n.mood < 0.35) return { kind: 'sad', item: 'sad' };
  if (lonely && w.traits.sociability > 0.6 && w.stage !== 'baby') return { kind: 'lonely', item: 'friend' };
  return null;
}

export function renderState(world) {
  const evById = id => world.events[id - 1];
  const objects = world.objects.filter(o => !o.state.gone).map(o => {
    const st = o.kind === 'mural' && o.state.depicts ? { ...o.state, depictsKind: (evById(o.state.depicts) || { data: {} }).data.power || (evById(o.state.depicts) || { data: {} }).data.nudge || 'gift' } : o.state;
    return {
      id: o.id, kind: o.kind, zone: o.zone, ...objectPos(o),
      layer: o.kind === 'pond' ? 'terrain' : NATURE.has(o.kind) ? 'nature' : 'structures',
      state: st, keeper: o.origin.action !== undefined, age: world.tick - o.builtTick
    };
  });
  // Thought bubbles from what happened last tick.
  const bubbles = {};
  for (let i = world.events.length - 1; i >= 0 && world.events[i].t >= world.tick - 1; i--) {
    const e = world.events[i];
    const b = BUBBLE[e.kind];
    if (!b || !e.actors.length) continue;
    const who = e.kind === 'taught' ? e.actors[1] : e.actors[0];
    if (!bubbles[who] || BUBBLE_RANK[b] > BUBBLE_RANK[bubbles[who]]) bubbles[who] = b;
  }
  // Spread Wobblins around their zone, stable per id and tick (the UI's
  // puppets then walk them around from here).
  const live = world.wobblins.filter(w => w.alive);
  const perZone = {};
  const wobblins = live.map(w => {
    const z = ZONES[w.zone];
    const k = perZone[w.zone] = (perZone[w.zone] || 0) + 1;
    const r = rngFor(world.seed, 'pose', w.id, world.tick);
    const ring = (k - 1) % 5, row = Math.floor((k - 1) / 5);
    const lonely = !live.some(o => o !== w && o.zone === w.zone);
    return {
      id: w.id, name: w.name, stage: w.stage, look: w.look, zone: w.zone, activity: w.activity,
      bubble: bubbles[w.id] || null,
      face: faceOf(w), want: wantOf(world, w, lonely), mood: w.needs.mood,
      carry: [w.knows.fire_carrying && 'torch', w.knows.sharp_stone && 'tool', w.knows.weaving && 'basket'].filter(Boolean),
      x: Math.round(z.cx + (ring - 2) * 44 + (r() - 0.5) * 24),
      y: Math.round(z.cy + 10 + row * 26 + (r() - 0.5) * 16)
    };
  });
  // The Keeper's latest act this tick, so Wobblins can react to it at once.
  const last = world.events.slice(-40).reverse().find(e => e.t === world.tick &&
    (e.kind === 'keeper_power' || e.kind === 'keeper_nudge' || e.kind === 'keeper_gift' || e.kind === 'offerings_collected'));
  let reaction = null;
  if (last) {
    const tgt = last.target && objects.find(o => o.id === last.target);
    const s = last.data.slot && slotInfo(last.data.slot);
    const z = ZONES[last.data.zone || 'meadow'];
    reaction = { id: last.id, kind: last.data.power || last.data.nudge || 'gift', zone: last.data.zone || null,
      reactions: last.data.reactions || {},
      x: tgt ? tgt.x : s ? s.x : z.cx, y: tgt ? tgt.y : s ? s.y : z.cy };
  }
  return {
    seed: world.seed, tick: world.tick, colonyName: world.colonyName, reaction,
    climate: { ...world.climate },
    objects, wobblins
  };
}

const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

// The backdrop only changes with the light, season and wet ground: cache it.
let sceneCache = { key: null, svg: '' };
function backdrop(rs, hour) {
  const key = rs.seed + '|' + timeOfDay(hour) + '|' + Math.round(hour * 4) + '|' + rs.climate.season + '|' + (rs.climate.wetUntil >= rs.tick);
  if (sceneCache.key !== key) sceneCache = { key, svg: sceneSVG(rs.seed, { hour, season: rs.climate.season, wet: rs.climate.wetUntil >= rs.tick }) };
  return sceneCache.svg;
}

// One Wobblin's markup: body + whatever is over its head (reaction > event
// bubble > what it wants).
export function wobblinMarkup(w, { emote = null, lookDx = 0 } = {}) {
  const face = emote === 'love' || emote === 'like' ? 'happy' : emote === 'scared' ? 'scared' : emote === 'upset' ? 'sad' : w.face;
  const over = emote ? emoteSVG(emote) : w.bubble ? bubbleSVG(w.bubble) : wantSVG(w.want);
  return wobblinSVG({ ...w, face }, { lookDx }) + over;
}

export function wobblinScale(w) { return 1.7 * (w.stage === 'baby' ? 0.62 : w.stage === 'elder' ? 0.95 : 1); }

export function drawSVG(svg, rs, opts = {}) {
  svg.setAttribute('viewBox', `0 0 ${VIEW.w} ${VIEW.h}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');   // fill the screen, no letterbox
  svg.replaceChildren();
  const L = {};
  for (const name of LAYERS) L[name] = el('g', { id: 'layer-' + name }, svg);
  const hour = opts.hour ?? 12;

  // A painted valley when the browser has made one; vector fallback otherwise.
  L.sky.innerHTML = opts.backdrop
    ? `<image href="${opts.backdrop}" x="0" y="0" width="${VIEW.w}" height="${VIEW.h}" preserveAspectRatio="none"/>` + sceneOverlaySVG(rs.seed, { hour })
    : backdrop(rs, hour);
  el('g', { id: 'art-defs' }, L.terrain).innerHTML = ART_DEFS;
  const sh = ZONES.hill.shrine;
  const shrine = el('g', { id: 'shrine', transform: `translate(${sh.x},${sh.y})`, class: 'shrine' + (opts.offerings ? ' glowing' : '') }, L.structures);
  shrine.innerHTML = '<ellipse cx="0" cy="2" rx="18" ry="5" fill="rgba(0,0,0,.18)"/><rect x="-12" y="-26" width="24" height="26" rx="3" fill="#d6ccb5" stroke="#8f846f"/><path d="M-16 -26 L0 -38 L16 -26 Z" fill="#b9ab8e" stroke="#8f846f"/><circle cx="0" cy="-14" r="5" fill="#f3d36b"/>' +
    (opts.offerings ? '<circle class="halo-soft" cx="0" cy="-14" r="26" fill="#ffe28a" opacity=".35"/>' : '');

  for (const o of rs.objects.slice().sort((a, b) => a.y - b.y)) {
    const g = el('g', { id: o.id, transform: `translate(${o.x},${o.y})`, class: 'obj obj-' + o.kind + (o.keeper && o.age < 1 ? ' fresh' : '') }, L[o.layer]);
    g.innerHTML = objectSVG(o);
  }

  // Wobblins glance toward the newest Keeper act (instant reaction).
  const fresh = rs.reaction || rs.objects.filter(o => o.keeper && o.age <= 1).sort((a, b) => b.age - a.age).pop();
  const flinchZone = rs.reaction && rs.reaction.kind === 'lightning' ? rs.reaction.zone : null;
  for (const w of rs.wobblins.slice().sort((a, b) => a.y - b.y)) {
    const s = wobblinScale(w);
    const emote = opts.emotes && rs.reaction && rs.reaction.id === opts.emotes ? rs.reaction.reactions[w.id] : null;
    const g = el('g', { id: w.id, transform: `translate(${w.x},${w.y}) scale(${s})`,
      class: 'wobblin act-' + w.activity + (flinchZone === w.zone && !emote ? ' flinch' : '') + (emote ? ' react react-' + emote : '') }, L.wobblins);
    const lookDx = fresh ? Math.max(-1.5, Math.min(1.5, (fresh.x - w.x) / 60)) : 0;
    g.innerHTML = wobblinMarkup(w, { emote, lookDx });
  }

  for (const f of rs.objects.filter(o => o.kind === 'fire' || o.kind === 'hearth')) {
    el('circle', { cx: f.x, cy: f.y - 10, r: 80, fill: 'url(#fireglow)', class: 'fireglow', 'pointer-events': 'none' }, L.effects);
  }
  if (rs.climate.rain > 0) {
    const r = rngFor(rs.seed, 'raindrops', rs.tick);
    let drops = '';
    for (let i = 0; i < 110; i++) {
      const x = r() * VIEW.w, y = r() * VIEW.h;
      drops += `<line x1="${x.toFixed(0)}" y1="${y.toFixed(0)}" x2="${(x - 7).toFixed(0)}" y2="${(y + 20).toFixed(0)}" style="animation-delay:-${(r()).toFixed(2)}s"/>`;
    }
    el('g', { class: 'rainfall' }, L.effects).innerHTML = drops;
    el('rect', { width: VIEW.w, height: VIEW.h, fill: '#46566e', opacity: 0.18, 'pointer-events': 'none' }, L.effects);
  }
  if (rs.reaction && rs.reaction.kind === 'lightning') {
    const { x, y } = rs.reaction;
    el('path', { d: `M${x + 30} 0 L${x - 10} ${y * 0.45} L${x + 14} ${y * 0.5} L${x - 4} ${y - 10}`, class: 'bolt' }, L.effects);
    el('rect', { width: VIEW.w, height: VIEW.h, class: 'flash', 'pointer-events': 'none' }, L.effects);
  }
  if (rs.reaction && rs.reaction.kind === 'miracle') {
    for (const [i, c] of ['#e66', '#eb5', '#ee6', '#6c6', '#69e', '#a7e'].entries()) {
      el('path', { d: `M150 520 A450 330 0 0 1 1050 520`, stroke: c, 'stroke-width': 10, fill: 'none', opacity: 0.55, transform: `translate(0 ${i * 10})` }, L.effects);
    }
  }
  el('g', { class: 'ambient', 'pointer-events': 'none' }, L.effects).innerHTML = ambientSVG(rs.seed, { hour, season: rs.climate.season, rain: rs.climate.rain > 0 });
  const light = el('g', { class: 'light', 'pointer-events': 'none' }, L.effects);
  light.innerHTML = '<defs><radialGradient id="fireglow"><stop offset="0" stop-color="#ffb35a" stop-opacity=".45"/><stop offset="1" stop-color="#ffb35a" stop-opacity="0"/></radialGradient></defs>' +
    lightSVG(rs.seed, { hour, season: rs.climate.season, painted: !!opts.backdrop });

  for (const id of opts.highlight || []) {
    const t = rs.objects.find(o => o.id === id) || rs.wobblins.find(w => w.id === id);
    if (!t) continue;
    el('ellipse', { id: 'halo-' + id, cx: t.x, cy: t.y - 16, rx: 40, ry: 34, class: 'halo' }, L.halos);
  }
}
