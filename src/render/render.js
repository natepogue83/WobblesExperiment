// render.js — renderState(world) is pure data; drawSVG(svg, rs, opts) paints it.
// Layers back to front: sky, hills, terrain, nature, structures, wobblins,
// effects, halos. Every living Wobblin and live object gets a stable element id.
// Day 1: simple placeholder shapes. Sprites and animation arrive on Day 2.
import { VIEW, ZONES, ZONE_IDS, RIVER, slotInfo } from '../sim/geometry.js';
import { rngFor } from '../sim/rng.js';

export const LAYERS = ['sky', 'hills', 'terrain', 'nature', 'structures', 'wobblins', 'effects', 'halos'];
const NATURE = new Set(['tree', 'bush', 'sprout', 'stones', 'boulder', 'reeds', 'fish', 'clay', 'gift', 'curio']);

export function renderState(world) {
  const objects = world.objects.filter(o => !o.state.gone).map(o => {
    const s = slotInfo(o.slot);
    const s2 = o.slots ? slotInfo(o.slots[1]) : null;
    return {
      id: o.id, kind: o.kind, zone: o.zone,
      x: s2 ? (s.x + s2.x) / 2 : s.x, y: s2 ? (s.y + s2.y) / 2 : s.y,
      layer: NATURE.has(o.kind) ? 'nature' : 'structures',
      state: o.state
    };
  });
  // Spread Wobblins around their zone center, stable per id.
  const perZone = {};
  const wobblins = world.wobblins.filter(w => w.alive).map(w => {
    const z = ZONES[w.zone];
    const k = perZone[w.zone] = (perZone[w.zone] || 0) + 1;
    const r = rngFor(world.seed, 'pose', w.id, world.tick);
    return {
      id: w.id, name: w.name, stage: w.stage, look: w.look, zone: w.zone,
      x: Math.round(z.cx + (k - 2) * 46 + (r() - 0.5) * 30),
      y: Math.round(z.cy + 18 + (r() - 0.5) * 20)
    };
  });
  return {
    seed: world.seed, tick: world.tick, colonyName: world.colonyName,
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

function drawObject(g, o) {
  const grp = el('g', { id: o.id, transform: `translate(${o.x},${o.y})`, class: 'obj obj-' + o.kind }, g);
  switch (o.kind) {
    case 'stones':
      el('ellipse', { cx: -8, cy: 0, rx: 10, ry: 7, fill: '#9a9488' }, grp);
      el('ellipse', { cx: 7, cy: 2, rx: 8, ry: 6, fill: '#827c71' }, grp);
      el('ellipse', { cx: 0, cy: -7, rx: 7, ry: 5, fill: '#b0a99c' }, grp);
      break;
    case 'boulder':
      el('path', { d: 'M-46 8 Q-50 -30 -10 -38 Q30 -44 46 -10 Q54 8 40 12 Z', fill: '#8a8478' }, grp);
      el('path', { d: 'M-30 -18 Q-10 -32 16 -28', stroke: '#a49e92', 'stroke-width': 4, fill: 'none' }, grp);
      break;
    case 'bush':
      el('circle', { cx: -10, cy: -6, r: 14, fill: '#4f8a4a' }, grp);
      el('circle', { cx: 10, cy: -8, r: 15, fill: '#5c9a52' }, grp);
      el('circle', { cx: 0, cy: -18, r: 13, fill: '#66a85b' }, grp);
      for (const [x, y] of [[-8, -10], [6, -16], [12, -4]]) el('circle', { cx: x, cy: y, r: 3, fill: '#c4365a' }, grp);
      break;
    case 'tree': {
      const s = o.state.size || 1;
      el('rect', { x: -4, y: -30 * s, width: 8, height: 30 * s, fill: '#7a5a3a' }, grp);
      el('circle', { cx: 0, cy: -40 * s, r: 24 * s, fill: '#3f7a45' }, grp);
      el('circle', { cx: -14 * s, cy: -30 * s, r: 14 * s, fill: '#4a8a4c' }, grp);
      break;
    }
    case 'sprout':
      el('path', { d: 'M0 0 L0 -14', stroke: '#5a9a4a', 'stroke-width': 3 }, grp);
      el('ellipse', { cx: -6, cy: -14, rx: 6, ry: 3, fill: '#6db35a' }, grp);
      el('ellipse', { cx: 6, cy: -16, rx: 6, ry: 3, fill: '#6db35a' }, grp);
      break;
    case 'gift':
      el('circle', { cx: 0, cy: -8, r: 9, fill: '#f3d36b', stroke: '#c79a2e', 'stroke-width': 2 }, grp);
      break;
    default:
      el('circle', { cx: 0, cy: -8, r: 10, fill: '#c9a', stroke: '#866', 'stroke-width': 2 }, grp);
  }
}

function drawWobblin(g, w, tick) {
  const s = w.stage === 'baby' ? 0.6 : 1;
  const grp = el('g', { id: w.id, transform: `translate(${w.x},${w.y}) scale(${s})`, class: 'wobblin' }, g);
  const body = el('g', { class: 'wobble', style: `animation-duration:${(2.2 / w.look.wobble).toFixed(2)}s` }, grp);
  const fill = `hsl(${w.look.hue} 55% 62%)`, dark = `hsl(${w.look.hue} 45% 42%)`;
  el('ellipse', { cx: 0, cy: 2, rx: 16, ry: 4, fill: 'rgba(0,0,0,0.18)' }, grp);
  el('path', { d: 'M-17 0 Q-20 -30 0 -32 Q20 -30 17 0 Q0 6 -17 0 Z', fill, stroke: dark, 'stroke-width': 1.5 }, body);
  const e = 4 * w.look.eyeSize;
  for (const ex of [-6, 6]) {
    el('circle', { cx: ex, cy: -18, r: e, fill: '#fff' }, body);
    el('circle', { cx: ex + 1, cy: -17.5, r: e * 0.5, fill: '#222' }, body);
  }
  void tick;
}

export function drawSVG(svg, rs, opts = {}) {
  svg.setAttribute('viewBox', `0 0 ${VIEW.w} ${VIEW.h}`);
  svg.replaceChildren();
  const L = {};
  for (const name of LAYERS) L[name] = el('g', { id: 'layer-' + name }, svg);

  const [top, bottom] = skyColors(opts.hour ?? 12);
  const defs = el('defs', {}, L.sky);
  const grad = el('linearGradient', { id: 'skyg', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  el('stop', { offset: 0, 'stop-color': top }, grad);
  el('stop', { offset: 1, 'stop-color': bottom }, grad);
  el('rect', { x: 0, y: 0, width: VIEW.w, height: VIEW.h, fill: 'url(#skyg)' }, L.sky);

  el('path', { d: `M0 ${VIEW.horizonY + 40} Q250 120 520 ${VIEW.horizonY + 20} T1200 ${VIEW.horizonY + 10} V675 H0 Z`, fill: '#9cc48a' }, L.hills);
  el('path', { d: `M0 ${VIEW.horizonY + 90} Q400 200 800 ${VIEW.horizonY + 70} T1200 ${VIEW.horizonY + 60} V675 H0 Z`, fill: '#8fbb78' }, L.hills);

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

  const sorted = rs.objects.slice().sort((a, b) => a.y - b.y);
  for (const o of sorted) drawObject(L[o.layer], o);
  for (const w of rs.wobblins.slice().sort((a, b) => a.y - b.y)) drawWobblin(L.wobblins, w, rs.tick);

  if (rs.climate.rain > 0) {
    const r = rngFor(rs.seed, 'raindrops', rs.tick);
    for (let i = 0; i < 90; i++) {
      const x = r() * VIEW.w, y = r() * VIEW.h;
      el('line', { x1: x, y1: y, x2: x - 6, y2: y + 18, stroke: 'rgba(200,220,255,0.6)', 'stroke-width': 2 }, L.effects);
    }
  }

  for (const id of opts.highlight || []) {
    const t = rs.objects.find(o => o.id === id) || rs.wobblins.find(w => w.id === id);
    if (!t) continue;
    el('ellipse', { id: 'halo-' + id, cx: t.x, cy: t.y - 16, rx: 40, ry: 34, class: 'halo' }, L.halos);
  }
}
