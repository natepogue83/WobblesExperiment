// render.js — renderState(world) is pure data; drawSVG(svg, rs, opts) paints it.
// Layers back to front: sky, hills, terrain, nature, structures, wobblins,
// effects, halos. Every living Wobblin and live object gets a stable element id.
import { VIEW, ZONES, ZONE_IDS, RIVER, GRAVEYARD, slotInfo } from '../sim/geometry.js';
import { rngFor } from '../sim/rng.js';
import { wobblinSVG, objectSVG, bubbleSVG, emoteSVG } from './sprites.js';

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
  // Spread Wobblins around their zone, stable per id and tick.
  const perZone = {};
  const wobblins = world.wobblins.filter(w => w.alive).map(w => {
    const z = ZONES[w.zone];
    const k = perZone[w.zone] = (perZone[w.zone] || 0) + 1;
    const r = rngFor(world.seed, 'pose', w.id, world.tick);
    const ring = (k - 1) % 5, row = Math.floor((k - 1) / 5);
    return {
      id: w.id, name: w.name, stage: w.stage, look: w.look, zone: w.zone, activity: w.activity,
      bubble: bubbles[w.id] || null,
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

// Sky color from the player's real local hour (render-only).
function skyColors(hour) {
  if (hour < 5 || hour >= 21) return ['#1d2340', '#39406b'];
  if (hour < 7) return ['#f2b48a', '#a9c2e0'];
  if (hour < 18) return ['#9fd0f0', '#e4f3fb'];
  return ['#f19a76', '#8c86b8'];
}

export function drawSVG(svg, rs, opts = {}) {
  svg.setAttribute('viewBox', `0 0 ${VIEW.w} ${VIEW.h}`);
  svg.replaceChildren();
  const L = {};
  for (const name of LAYERS) L[name] = el('g', { id: 'layer-' + name }, svg);
  const hour = opts.hour ?? 12;
  const night = hour < 6 || hour >= 20;

  const [top, bottom] = skyColors(hour);
  const defs = el('defs', {}, L.sky);
  const grad = el('linearGradient', { id: 'skyg', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  el('stop', { offset: 0, 'stop-color': top }, grad);
  el('stop', { offset: 1, 'stop-color': bottom }, grad);
  el('rect', { x: 0, y: 0, width: VIEW.w, height: VIEW.h, fill: 'url(#skyg)' }, L.sky);
  if (night) {
    const r = rngFor(rs.seed, 'stars');
    for (let i = 0; i < 60; i++) el('circle', { cx: r() * VIEW.w, cy: r() * VIEW.horizonY, r: r() * 1.4 + 0.3, fill: '#fff', opacity: 0.7 }, L.sky);
  }

  const cold = rs.climate.season === 'cold';
  el('path', { d: `M0 ${VIEW.horizonY + 40} Q250 120 520 ${VIEW.horizonY + 20} T1200 ${VIEW.horizonY + 10} V675 H0 Z`, fill: cold ? '#b9cbbf' : '#9cc48a' }, L.hills);
  el('path', { d: `M0 ${VIEW.horizonY + 90} Q400 200 800 ${VIEW.horizonY + 70} T1200 ${VIEW.horizonY + 60} V675 H0 Z`, fill: cold ? '#aac2b2' : '#8fbb78' }, L.hills);

  for (const id of ZONE_IDS) {
    const z = ZONES[id];
    el('ellipse', { id: 'zone-' + id, cx: z.cx, cy: z.cy, rx: z.rx, ry: z.ry, fill: 'rgba(255,255,255,0.08)', class: 'zone' }, L.terrain);
  }
  const rv = RIVER.map(([x, y], i) => (i ? 'L' : 'M') + x + ' ' + y).join(' ');
  el('path', { d: rv, stroke: '#5f9fcf', 'stroke-width': 34, fill: 'none', 'stroke-linecap': 'round' }, L.terrain);
  el('path', { d: rv, stroke: '#8cc3e8', 'stroke-width': 10, fill: 'none', 'stroke-linecap': 'round', opacity: 0.7 }, L.terrain);
  if (rs.climate.wetUntil >= rs.tick) {
    for (const id of ZONE_IDS) {
      const z = ZONES[id];
      el('ellipse', { cx: z.cx, cy: z.cy + 10, rx: z.rx * 0.5, ry: z.ry * 0.35, fill: 'rgba(110,80,50,0.18)' }, L.terrain);
    }
  }
  const sh = ZONES.hill.shrine;
  el('rect', { id: 'shrine', x: sh.x - 10, y: sh.y - 22, width: 20, height: 22, rx: 4, fill: '#cbbfa8', stroke: '#8f846f' }, L.structures);

  for (const o of rs.objects.slice().sort((a, b) => a.y - b.y)) {
    const g = el('g', { id: o.id, transform: `translate(${o.x},${o.y})`, class: 'obj obj-' + o.kind + (o.keeper && o.age < 1 ? ' fresh' : '') }, L[o.layer]);
    g.innerHTML = objectSVG(o);
  }

  // Wobblins glance toward the newest Keeper object (instant reaction).
  const fresh = rs.reaction || rs.objects.filter(o => o.keeper && o.age <= 1).sort((a, b) => b.age - a.age).pop();
  const flinchZone = rs.reaction && rs.reaction.kind === 'lightning' ? rs.reaction.zone : null;
  for (const w of rs.wobblins.slice().sort((a, b) => a.y - b.y)) {
    const s = 1.5 * (w.stage === 'baby' ? 0.62 : w.stage === 'elder' ? 0.95 : 1);
    // How they feel about what you just did (shown for a few seconds).
    const emote = opts.emotes && rs.reaction && rs.reaction.id === opts.emotes ? rs.reaction.reactions[w.id] : null;
    const g = el('g', { id: w.id, transform: `translate(${w.x},${w.y}) scale(${s})`,
      class: 'wobblin act-' + w.activity + (flinchZone === w.zone && !emote ? ' flinch' : '') + (emote ? ' react react-' + emote : '') }, L.wobblins);
    const lookDx = fresh ? Math.max(-1.5, Math.min(1.5, (fresh.x - w.x) / 60)) : 0;
    g.innerHTML = wobblinSVG(w, { lookDx }) + (emote ? emoteSVG(emote) : bubbleSVG(w.bubble));
  }

  if (rs.climate.rain > 0) {
    const r = rngFor(rs.seed, 'raindrops', rs.tick);
    for (let i = 0; i < 90; i++) {
      const x = r() * VIEW.w, y = r() * VIEW.h;
      el('line', { x1: x, y1: y, x2: x - 6, y2: y + 18, stroke: 'rgba(200,220,255,0.6)', 'stroke-width': 2 }, L.effects);
    }
  }
  if (rs.reaction && rs.reaction.kind === 'lightning') {
    const { x, y } = rs.reaction;
    el('path', { d: `M${x + 30} 0 L${x - 10} ${y * 0.45} L${x + 14} ${y * 0.5} L${x - 4} ${y - 10}`, class: 'bolt' }, L.effects);
  }
  if (rs.reaction && rs.reaction.kind === 'miracle') {
    for (const [i, c] of ['#e66', '#eb5', '#ee6', '#6c6', '#69e', '#a7e'].entries()) {
      el('path', { d: `M150 520 A450 330 0 0 1 1050 520`, stroke: c, 'stroke-width': 10, fill: 'none', opacity: 0.55, transform: `translate(0 ${i * 10})` }, L.effects);
    }
  }
  if (night) el('rect', { x: 0, y: 0, width: VIEW.w, height: VIEW.h, fill: 'rgba(20,24,60,0.32)', 'pointer-events': 'none' }, L.effects);
  for (const f of rs.objects.filter(o => o.kind === 'fire' || o.kind === 'hearth')) {
    el('circle', { cx: f.x, cy: f.y - 10, r: 70, fill: 'rgba(255,170,80,0.18)', 'pointer-events': 'none' }, L.effects);
  }

  for (const id of opts.highlight || []) {
    const t = rs.objects.find(o => o.id === id) || rs.wobblins.find(w => w.id === id);
    if (!t) continue;
    el('ellipse', { id: 'halo-' + id, cx: t.x, cy: t.y - 16, rx: 40, ry: 34, class: 'halo' }, L.halos);
  }
}
