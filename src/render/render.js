// render.js — renderState(world) is pure data; drawSVG(svg, rs, opts) paints it.
// Layers back to front: sky, hills, terrain, nature, structures, wobblins,
// effects, halos. Every living Wobblin and live object gets a stable element id.
// The painted backdrop lives in scene.js; Wobblin art in sprites.js.
import { VIEW, ZONES, GRAVEYARD, slotInfo } from '../sim/geometry.js';
import { rngFor } from '../sim/rng.js';
import { BY_ID } from '../sim/discoveries.js';
import { titleOf } from '../sim/growth.js';
import { wobblinSVG, objectSVG, bubbleSVG, emoteSVG, wantSVG, askSVG } from './sprites.js';
import { sceneSVG, lightSVG, timeOfDay, sceneOverlaySVG, ambientSVG, foregroundSVG, rainSplashSVG } from './scene.js';
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

const BUBBLE = { discovery: 'spark', rediscovery: 'spark', misfire: 'smoke', experiment_failed: 'question', pondering: 'ponder', paired: 'heart', taught: 'question', level_up: 'levelup' };
const INTERACTION_BUBBLE = { static_shock: 'spark', charged: 'spark', stones_burst: 'smoke', bonk_idea: 'idea', flower_crown: 'heart', gift_caught: 'heart', squashed: 'smoke', bonked: 'smoke', zapped: 'spark', hug: 'heart', comforted: 'heart', juggled: 'spark', swam: 'heart', rescued: 'heart', swept_downstream: 'question', paint_splat: 'spark', trampled: 'smoke', snack: 'heart', caught_fish: 'spark', treasure: 'spark', bonk: 'smoke', bowled_over: 'smoke', singed: 'smoke', squabble: 'smoke', stuck_in_tree: 'question', fire_walk: 'spark', made_a_cairn: 'spark' };
const BUBBLE_RANK = { spark: 5, levelup: 4.5, smoke: 4, ponder: 3, heart: 2, question: 1 };

// Their strongest trait, if it really stands out (it shows in their brows).
export function temperOf(w) {
  let best = null, bv = 0.62;
  for (const k of ['caution', 'boldness', 'curiosity', 'patience', 'sociability', 'playfulness']) if ((w.traits[k] || 0) > bv) { bv = w.traits[k]; best = k; }
  return best;
}

// Things are drawn a little larger than life so they sit right next to the
// Wobblins (drawn at 1.7): a hut is big enough to go inside.
export const OBJECT_SCALE = { snowman: 1.45, hut: 1.75, temple: 1.45, totem: 1.7, wall: 1.45, hearth: 1.35, fire: 1.35, mural: 1.45, raft: 1.35,
  garden: 1.25, tree: 1.35, bush: 1.3, boulder: 1.15, stones: 1.25, gift: 1.35, curio: 1.35, sprout: 1.3, grave: 1.45,
  pond: 1, reeds: 1.25, clay: 1.2, fish: 1.2, ruin: 1.4, scorch: 1.35 };

// The keepsake a Wobblin treasures (its lucky charm), worn where you can see it.
// What a portrait needs beyond the raw Wobblin: brows, crown, frizz, charm.
export function decorOf(world, w) {
  return { temper: temperOf(w), flower: (w.flowerUntil || 0) > world.tick, zapped: (w.zappedUntil || 0) > world.tick, charm: charmOf(world, w), paint: paintOf(world, w) };
}
function paintOf(world, w) { return (w.paintUntil || 0) > world.tick ? (w.paint || 0) : null;
}
function charmOf(world, w) {
  if (!w.luckyCharm) return null;
  const o = world.objects.find(x => x.id === w.luckyCharm);
  return o ? (o.state.giftId || o.state.curio || null) : null;
}

function gatheringsSVG(list) {
  let s = '';
  const NOTE = '<path d="M-2 4 V-6 L6 -8 V2" stroke="#6b4fb0" stroke-width="2" fill="none"/><circle cx="-3.6" cy="4" r="2.8" fill="#6b4fb0"/><circle cx="4.4" cy="2" r="2.8" fill="#6b4fb0"/>';
  for (const g of list) {
    const z = ZONES[g.zone];
    if (!z) continue;
    if (g.kind === 'song') {
      for (let i = 0; i < 5; i++) s += `<g transform="translate(${z.cx - 60 + i * 30} ${z.cy - 60})"><g class="gnote" style="animation-delay:-${(i * 0.45).toFixed(2)}s">${NOTE}</g></g>`;
    } else if (g.kind === 'fire_dance' || g.kind === 'rain_dance') {
      const c = g.kind === 'fire_dance' ? '#ffb35a' : '#8fc6f0';
      s += `<ellipse class="gring" cx="${z.cx}" cy="${z.cy + 18}" rx="${z.rx * 0.55}" ry="${z.ry * 0.45}" fill="none" stroke="${c}" stroke-width="4" stroke-dasharray="10 8"/>`;
    } else if (g.kind === 'festival') {
      const x0 = z.cx - z.rx * 0.8, x1 = z.cx + z.rx * 0.8, y = z.cy - 70;
      s += `<path d="M${x0} ${y} Q${z.cx} ${y + 40} ${x1} ${y}" stroke="#7a5a3a" stroke-width="1.6" fill="none"/>`;
      const cols = ['#c9563c', '#ffd24a', '#4a8ac9', '#5aa86b', '#b9a0f0', '#ff9fb2'];
      for (let i = 1; i < 14; i++) {
        const t = i / 14, x = x0 + (x1 - x0) * t, yy = y + 40 * 2 * t * (1 - t) * 1.0;
        s += `<path class="gflag" style="animation-delay:-${(i * 0.13).toFixed(2)}s" d="M${(x - 6).toFixed(0)} ${yy.toFixed(0)} L${x.toFixed(0)} ${(yy + 14).toFixed(0)} L${(x + 6).toFixed(0)} ${yy.toFixed(0)} Z" fill="${cols[i % cols.length]}"/>`;
      }
      for (let i = 0; i < 4; i++) s += `<g transform="translate(${z.cx - 80 + i * 55} ${z.cy - 95})"><g class="gnote" style="animation-delay:-${(i * 0.6).toFixed(2)}s">${NOTE}</g></g>`;
    }
  }
  return s;
}

// Worn dirt paths between the places they go back and forth between most.
function trailsSVG(trails) {
  let s = '';
  for (const { a, b, n } of trails) {
    const A = ZONES[a], B = ZONES[b];
    if (!A || !B) continue;
    const w = Math.min(16, 3 + Math.log2(n) * 2.2), op = Math.min(0.55, 0.12 + Math.log2(n) * 0.06);
    const x1 = A.cx, y1 = A.cy + 14, x2 = B.cx, y2 = B.cy + 14;
    const mx = (x1 + x2) / 2 + (y2 - y1) * 0.12, my = (y1 + y2) / 2 + 10;
    const d = `M${x1} ${y1} Q${mx.toFixed(0)} ${my.toFixed(0)} ${x2} ${y2}`;
    s += `<path d="${d}" stroke="#9a7a4c" stroke-width="${w.toFixed(1)}" stroke-linecap="round" fill="none" opacity="${op.toFixed(2)}"/>` +
      `<path d="${d}" stroke="#c9ab78" stroke-width="${(w * 0.45).toFixed(1)}" stroke-linecap="round" stroke-dasharray="2 9" fill="none" opacity="${(op * 0.9).toFixed(2)}"/>`;
  }
  return s;
}

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
    let st = o.kind === 'mural' && o.state.depicts ? { ...o.state, depictsKind: (evById(o.state.depicts) || { data: {} }).data.power || (evById(o.state.depicts) || { data: {} }).data.nudge || 'gift' } : o.state;
    if ((o.state.chargedUntil || 0) > world.tick) st = { ...st, charged: true };
    if (o.kind === 'hut' && world.discoveries.hearth) st = { ...st, smoke: true };
    return {
      id: o.id, kind: o.kind, zone: o.zone, slot: o.slot || null, ...objectPos(o),
      layer: o.kind === 'pond' ? 'terrain' : NATURE.has(o.kind) ? 'nature' : 'structures',
      state: st, keeper: o.origin.action !== undefined, age: world.tick - o.builtTick
    };
  });
  // Thought bubbles from what happened last tick.
  const bubbles = {};
  for (let i = world.events.length - 1; i >= 0 && world.events[i].t >= world.tick - 1; i--) {
    const e = world.events[i];
    const b = e.kind === 'interaction' ? INTERACTION_BUBBLE[e.data.what] : BUBBLE[e.kind];
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
      face: faceOf(w), want: wantOf(world, w, lonely), mood: w.needs.mood, title: titleOf(w),
      flower: (w.flowerUntil || 0) > world.tick, charm: charmOf(world, w),
      ask: ((world.asks || []).find(a => !a.done && a.by === w.id) || {}).want || null, zapped: (w.zappedUntil || 0) > world.tick, temper: temperOf(w),
      wet: (w.wetUntil || 0) > world.tick, paint: paintOf(world, w),
      // In the rain the playful splash about; everyone else hides under a big leaf.
      rain: world.climate.rain > 0 ? (w.stage !== 'baby' && w.traits.playfulness > 0.6 ? 'splash' : 'leaf') : null,
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
  const gatherings = [];
  for (let i = world.events.length - 1; i >= 0; i--) {
    const e = world.events[i];
    if (e.t < world.tick - 1) break;
    if (e.kind === 'ritual' || e.kind === 'festival') gatherings.push({ kind: e.kind === 'festival' ? 'festival' : e.data.kind, zone: e.data.zone });
  }
  const trails = Object.entries(world.trails || {}).filter(([, n]) => n >= 4).map(([k, n]) => { const [a, b] = k.split('|'); return { a, b, n }; });
  return {
    seed: world.seed, tick: world.tick, colonyName: world.colonyName, reaction, trails, gatherings,
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
  const over = emote ? emoteSVG(emote) : w.bubble ? bubbleSVG(w.bubble) : w.ask ? askSVG(w.ask) : wantSVG(w.want);
  return `<title>${w.name} ${w.title || ''}</title>` + wobblinSVG({ ...w, face }, { lookDx }) + over;
}

export function wobblinScale(w) { return 1.7 * (w.stage === 'baby' ? 0.62 : w.stage === 'elder' ? 0.95 : 1); }

export function drawSVG(svg, rs, opts = {}) {
  svg.setAttribute('viewBox', `0 0 ${VIEW.w} ${VIEW.h}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');   // fill the screen, no letterbox
  svg.replaceChildren();
  const L = {};
  for (const name of LAYERS) L[name] = el('g', { id: 'layer-' + name }, svg);
  const hour = opts.hour ?? 12;
  svg.setAttribute('class', 'tod-' + timeOfDay(hour));   // CSS dims the foreground after dark

  // A painted valley when the browser has made one; vector fallback otherwise.
  L.sky.innerHTML = opts.backdrop
    ? `<image href="${opts.backdrop}" x="0" y="0" width="${VIEW.w}" height="${VIEW.h}" preserveAspectRatio="none"/>` + sceneOverlaySVG(rs.seed, { hour })
    : backdrop(rs, hour);
  el('g', { id: 'art-defs' }, L.terrain).innerHTML = ART_DEFS;
  if (rs.trails && rs.trails.length) el('g', { id: 'trails', 'pointer-events': 'none' }, L.terrain).innerHTML = trailsSVG(rs.trails);
  const sh = ZONES.hill.shrine;
  const shrine = el('g', { id: 'shrine', transform: `translate(${sh.x},${sh.y}) scale(1.5)`, class: 'shrine' + (opts.offerings ? ' glowing' : '') }, L.structures);
  shrine.innerHTML = '<ellipse cx="0" cy="2" rx="18" ry="5" fill="rgba(0,0,0,.18)"/><rect x="-12" y="-26" width="24" height="26" rx="3" fill="#d6ccb5" stroke="#8f846f"/><path d="M-16 -26 L0 -38 L16 -26 Z" fill="#b9ab8e" stroke="#8f846f"/><circle cx="0" cy="-14" r="5" fill="#f3d36b"/>' +
    (opts.offerings ? '<circle class="halo-soft" cx="0" cy="-14" r="26" fill="#ffe28a" opacity=".35"/>' : '');

  for (const o of rs.objects.slice().sort((a, b) => a.y - b.y)) {
    const k = OBJECT_SCALE[o.kind] || 1.3;
    const g = el('g', { id: o.id, transform: `translate(${o.x},${o.y}) scale(${k})`, class: 'obj obj-' + o.kind + (o.keeper && o.age < 1 ? ' fresh' : '') }, L[o.layer]);
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
    el('g', { class: 'rain-splashes', 'pointer-events': 'none' }, L.terrain).innerHTML = rainSplashSVG(rs.seed, rs.tick);
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

  // After dark: fires and hut doorways glow warm through the night tint.
  if (timeOfDay(hour) === 'night' || timeOfDay(hour) === 'dusk') {
    let glow = '';
    for (const f of rs.objects.filter(o => o.kind === 'fire' || o.kind === 'hearth')) glow += `<circle cx="${f.x}" cy="${f.y - 14}" r="120" fill="url(#nightglow)"/>`;
    for (const h of rs.objects.filter(o => o.kind === 'hut')) glow += `<ellipse cx="${h.x}" cy="${h.y - 8}" rx="34" ry="22" fill="url(#nightglow)" opacity=".7"/>`;
    const g = el('g', { class: 'nightglow', 'pointer-events': 'none', style: 'mix-blend-mode:screen' }, L.effects);
    g.innerHTML = '<defs><radialGradient id="nightglow"><stop offset="0" stop-color="#ffb35a" stop-opacity=".55"/><stop offset=".5" stop-color="#ff9a3a" stop-opacity=".18"/><stop offset="1" stop-color="#ff9a3a" stop-opacity="0"/></radialGradient></defs>' + glow;
  }

  // Gatherings you can see: notes over a song, a glowing ring for a dance, bunting for a festival.
  if (rs.gatherings && rs.gatherings.length) el('g', { class: 'gatherings', 'pointer-events': 'none' }, L.effects).innerHTML = gatheringsSVG(rs.gatherings);

  // The tall grass in front, last, so it frames the valley.
  el('g', { class: 'fg-grass', 'pointer-events': 'none' }, L.effects).innerHTML = foregroundSVG(rs.seed, { hour, season: rs.climate.season });

  for (const id of opts.highlight || []) {
    const t = rs.objects.find(o => o.id === id) || rs.wobblins.find(w => w.id === id);
    if (!t) continue;
    el('ellipse', { id: 'halo-' + id, cx: t.x, cy: t.y - 16, rx: 40, ry: 34, class: 'halo' }, L.halos);
  }
}
