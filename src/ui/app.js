// app.js — clock, input, panels. The only place real time and the DOM meet the sim.
import { tick, applyAction, replay, stateHash, giftOptions, BLESS_TRAITS, CONST } from '../sim/index.js';
import { unlockedCurios, hasPond } from '../sim/actions.js';
import { experimentPreview } from '../sim/experiment.js';
import { renderState, drawSVG } from '../render/render.js';
import { newSave, randomSeed, appendAction, popAction, loadSave, storeSave, clearSave,
         exportSave, importSave, DEBUG_OFFSET_KEY } from './save.js';
import { nowTickFor, localDayIndex, localHour } from './clock.js';
import { narrateRecap } from '../ai/narrate.js';
import { buildRecap, buildRecapInput } from '../sim/recap.js';
import { showRecapCard, showChronicle, showBook, showWobblinCard } from './panels.js';
import { WAITLIST_URL, FEEDBACK_LABEL } from './config.js';
import { trayItems, ICONS, zoneAt } from './inventory.js';
import { RIVER } from '../sim/geometry.js';
import { emoteSVG } from '../render/sprites.js';
import { press, toSvgPoint, overSvg, makeGhost, drawHint, clearHint } from './drag.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const $ = sel => document.querySelector(sel);
const TRAY = trayItems();

let save = null, world = null, lastHash = '';
let lastRS = null;          // the render state on screen (positions for hit tests)
let dragging = false;       // pause redraws while something is in the air
let armed = null;           // a tray item tapped (not dragged): next valley tap drops it
let highlight = [];
const dropped = {};
const EMOTE_MS = 4000;
let emoteEvent = null, emoteUntil = 0, emoteTimer = 0;         // wobblinId -> { x, y, tick, at } where the Keeper set it down

function offset() {
  try { return Number(localStorage.getItem(DEBUG_OFFSET_KEY)) || 0; } catch { return 0; }
}
function setOffset(n) { try { localStorage.setItem(DEBUG_OFFSET_KEY, String(n)); } catch { /* ignore */ } }
function nowTick() { return nowTickFor(save, Date.now(), DEBUG ? offset() : 0); }

// ------------------------------------------------------------ boot
function centerStage() {
  const st = document.querySelector('#stage');
  if (st.scrollWidth > st.clientWidth) st.scrollLeft = (st.scrollWidth - st.clientWidth) / 2;
}

function boot() {
  setTimeout(centerStage, 50);
  wireValley();
  save = loadSave();
  if (!save) { showNewColony(); return; }
  const now = nowTick();
  world = replay(save, now);
  const from = Math.min(save.lastSeenTick, now);
  if (now > from) showRecap(from, now);
  save.lastSeenTick = now;
  storeSave(save);
  draw();
  setInterval(advance, 1000);
}

function showNewColony() {
  $('#newColony').hidden = false;
  $('#newColonyForm').onsubmit = ev => {
    ev.preventDefault();
    save = newSave({
      seed: randomSeed(), createdAt: Date.now(),
      colonyName: $('#colonyName').value.trim() || undefined,
      keeperName: $('#keeperName').value.trim() || undefined
    });
    setOffset(0);
    storeSave(save);
    $('#newColony').hidden = true;
    world = replay(save, nowTick());
    draw();
    toast('Drag things from your tray onto the valley. You can pick Wobblins up, too.');
    setInterval(advance, 1000);
  };
}

// Advance the live world when the real clock (or the warp) crosses a boundary.
function advance() {
  if (dragging) return;   // never yank the valley out from under a drag
  const now = nowTick();
  if (now <= world.tick) return;
  const from = world.tick;
  while (world.tick < now) tick(world);
  save.lastSeenTick = now;
  storeSave(save);
  if (now - from >= 6) showRecap(from, now);
  draw();
}

// ------------------------------------------------------------ actions
function act(action) {
  advance();
  const a = appendAction(save, world.tick, action);
  const res = applyAction(world, a);
  if (!res.ok) { popAction(save); toast(whyNot(res.reason)); }
  else {
    storeSave(save);
    // Show how everyone felt about it for a few seconds.
    for (let i = world.events.length - 1; i >= 0 && world.events[i].t === world.tick; i--) {
      if (world.events[i].data.reactions) { emoteEvent = world.events[i].id; break; }
    }
    emoteUntil = Date.now() + EMOTE_MS;
    clearTimeout(emoteTimer);
    emoteTimer = setTimeout(draw, EMOTE_MS + 50);
  }
  armed = null;
  draw();
  return res.ok;
}

function whyNot(reason) {
  return ({
    cooldown: 'Not yet. It needs to recharge.', occupied: 'Something is already there.', no_room: 'No room there.',
    devotion: 'You need more Devotion. Collect offerings at the shrine.', slot: 'That spot will not work.',
    gift_used: "Today's gift is already in the world.", locked: 'They have not noticed that material yet.'
  })[reason] || 'Not now (' + reason.replace(/_/g, ' ') + ').';
}

// ------------------------------------------------------------ menus
function menu(title, items, onPick) {
  const card = $('#giftCard');
  card.replaceChildren();
  const h = document.createElement('h3');
  h.textContent = title;
  card.append(h);
  for (const [label, value] of items) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.onclick = () => { card.hidden = true; onPick(value); };
    card.append(btn);
  }
  const close = document.createElement('button');
  close.textContent = 'Never mind'; close.className = 'ghost';
  close.onclick = () => { card.hidden = true; };
  card.append(close);
  card.hidden = false;
}

function blessMenu(id) {
  const w = world.wobblins.find(x => x.id === id);
  menu('Bless ' + w.name + ' with...', BLESS_TRAITS.map(t => [t, t]), t => act({ type: 'nudge', nudge: 'bless', target: id, trait: t }));
}

function curioMenu(targets) {
  const open = unlockedCurios(world);
  if (!open.length) { toast('No curios yet. They unlock once a Wobblin notices a material.'); return; }
  const names = targets.map(id => world.wobblins.find(x => x.id === id).name).join(' and ');
  if (open.length === 1) { act({ type: 'nudge', nudge: 'curio', curio: open[0], targets }); return; }
  menu('Leave a curio for ' + names, open.map(c => [c.replace(/_/g, ' '), c]), c => act({ type: 'nudge', nudge: 'curio', curio: c, targets }));
}

function giftMenu(slot) {
  const day = localDayIndex(Date.now());
  if (world.giftsByDay[day] !== undefined) { toast("Today's gift is already in the world. Come back tomorrow."); return; }
  menu("Today's gift", giftOptions(world.seed, day).map(g => [g.replace(/_/g, ' '), g]), g => act({ type: 'gift', day, giftId: g, slot }));
}

// ------------------------------------------------------------ the tray
function itemState(item) {
  if (item.id === 'gift') {
    const used = world.giftsByDay[localDayIndex(Date.now())] !== undefined;
    return { ready: !used, left: 0, frac: used ? 1 : 0, note: used ? 'tomorrow' : '' };
  }
  const readyAt = world.cooldowns[item.cd] || 0;
  const left = Math.max(0, readyAt - world.tick);
  const poor = item.cost && world.devotion < item.cost && !(item.id === 'cold' || item.id === 'warm');
  const seasonPoor = (item.id === 'cold' || item.id === 'warm') && world.seasonUses > 0 && world.devotion < 10;
  return { ready: left === 0 && !poor && !seasonPoor, left, frac: left / (CONST.COOLDOWN[item.cd] || 1),
    note: left ? left + 'h' : (poor || seasonPoor) ? 'needs Devotion' : '' };
}

function ctx() {
  return { world, rs: lastRS, hasPond: hasPond(world), blessMenu, curioMenu, giftMenu };
}

function dropItem(item, pt) {
  const res = item.drop(pt, ctx());
  if (!res) return;                    // the item opened a menu
  if (res.error) { toast(res.error); return; }
  act(res);
}

function drawTray() {
  for (const row of ['powers', 'nudges']) {
    const bar = $('#' + row);
    bar.replaceChildren();
    for (const item of TRAY.filter(i => i.row === row)) {
      const st = itemState(item);
      const tile = document.createElement('button');
      tile.className = 'tile' + (st.ready ? '' : ' cooling') + (armed === item ? ' armed' : '') +
        (item.id === 'gift' && st.ready ? ' pulse' : '');
      tile.style.setProperty('--cd', st.frac);
      tile.innerHTML = `<span class="icon">${ICONS[item.id]}</span><span class="name">${item.label}</span>` +
        (st.note ? `<span class="note">${st.note}</span>` : '');
      tile.setAttribute('aria-label', item.label + (st.note ? ', ' + st.note : ''));
      wireTile(tile, item);
      bar.append(tile);
    }
  }
}

function wireTile(tile, item) {
  let ghost = null;
  const svg = $('#world');
  press(tile, {
    onTap: () => {
      const st = itemState(item);
      if (!st.ready) { toast(item.label + ': ' + (st.note === 'tomorrow' ? 'one gift a day.' : st.note === 'needs Devotion' ? 'you need more Devotion.' : 'ready in ' + st.note + '.')); return; }
      armed = armed === item ? null : item;
      if (armed) toast('Drag ' + item.label.toLowerCase() + ' onto the valley, or tap where it should go.');
      drawTray();
    },
    onStart: ev => {
      if (!itemState(item).ready) { ghost = null; return; }
      dragging = true;
      armed = null;
      ghost = makeGhost(ICONS[item.id], item.label);
      ghost.move(ev.clientX, ev.clientY);
      document.body.classList.add('is-dragging');
    },
    onMove: ev => {
      if (!ghost) return;
      ghost.move(ev.clientX, ev.clientY);
      drawHint(svg, overSvg(svg, ev.clientX, ev.clientY) ? item.hint(toSvgPoint(svg, ev.clientX, ev.clientY), ctx()) : null);
    },
    onDrop: ev => {
      if (!ghost) { toast(item.label + ' is not ready yet.'); return; }
      endDrag(ghost);
      if (overSvg(svg, ev.clientX, ev.clientY)) dropItem(item, toSvgPoint(svg, ev.clientX, ev.clientY));
      else draw();
    },
    onCancel: () => { if (ghost) endDrag(ghost); draw(); }
  });
}

function endDrag(ghost) {
  ghost.remove();
  clearHint($('#world'));
  dragging = false;
  document.body.classList.remove('is-dragging');
}

// Taps on empty valley drop an armed item there.
function wireValley() {
  const svg = $('#world');
  svg.addEventListener('click', ev => {
    if (!armed || ev.target.closest('.wobblin')) return;
    dropItem(armed, toSvgPoint(svg, ev.clientX, ev.clientY));
  });
}

// ------------------------------------------------------------ Wobblins in hand
function wireWobblins(svg) {
  for (const w of lastRS.wobblins) {
    const g = svg.querySelector('#' + w.id);
    if (!g) continue;
    let base = null, trail = [];
    press(g, {
      onTap: ev => {
        if (armed) { dropItem(armed, toSvgPoint(svg, ev.clientX, ev.clientY)); return; }
        poke(g);
        showWobblin(world.wobblins.find(x => x.id === w.id));
      },
      onStart: () => {
        dragging = true;
        base = g.getAttribute('transform');
        trail = [];
        g.classList.add('held');
        g.parentNode.append(g);           // lift above the others
        document.body.classList.add('is-dragging');
        // Everyone else turns to watch.
        svg.classList.add('watching');
      },
      onMove: ev => {
        const p = toSvgPoint(svg, ev.clientX, ev.clientY);
        trail.push({ x: p.x, y: p.y, t: performance.now() });
        if (trail.length > 8) trail.shift();
        const s = w.stage === 'baby' ? 0.93 : 1.6;
        g.setAttribute('transform', `translate(${p.x},${p.y + 30}) scale(${s})`);
        const z = zoneAt(p);
        drawHint(svg, { x: p.x, y: p.y + 34, r: 30, ok: true, label: zoneLabel(z) });
      },
      onDrop: ev => {
        dragging = false;
        document.body.classList.remove('is-dragging');
        svg.classList.remove('watching');
        clearHint(svg);
        const p = toSvgPoint(svg, ev.clientX, ev.clientY);
        if (!overSvg(svg, ev.clientX, ev.clientY)) { g.setAttribute('transform', base); g.classList.remove('held'); return; }
        const v = releaseVelocity(trail);
        if (Math.hypot(v.x, v.y) > FLING_SPEED) { fling(svg, g, w, { x: p.x, y: p.y + 30 }, v); return; }
        const water = waterAt(p.x, p.y + 30);
        const zone = water || zoneAt(p);
        dropped[w.id] = { x: Math.round(p.x), y: Math.round(p.y + 30), at: Date.now() };
        act({ type: 'nudge', nudge: 'carry', target: w.id, zone, ...(water ? { splash: true } : {}) });
      },
      onCancel: () => {
        dragging = false;
        document.body.classList.remove('is-dragging');
        svg.classList.remove('watching');
        clearHint(svg);
        g.setAttribute('transform', base);
        g.classList.remove('held');
      }
    });
  }
}

// ------------------------------------------------------------ flinging
// Let go while moving and a Wobblin flies: it arcs, tumbles, bounces once and
// lands where physics puts it (in the river, it splashes). Purely visual until
// it lands; then the landing becomes an ordinary carry action.
const FLING_SPEED = 0.55;      // SVG units per ms
const GRAVITY = 0.0032;        // SVG units per ms^2
const fx = [];                 // short-lived splash / dust effects: { kind, x, y, at }

// requestAnimationFrame, with a timer fallback for background tabs, so a
// thrown Wobblin always lands.
function nextFrame(cb) {
  let done = false;
  const go = () => { if (!done) { done = true; cb(performance.now()); } };
  requestAnimationFrame(go);
  setTimeout(go, 50);
}

function releaseVelocity(trail) {
  const now = performance.now();
  const recent = trail.filter(p => now - p.t < 90);
  if (recent.length < 2) return { x: 0, y: 0 };
  const a = recent[0], b = recent[recent.length - 1];
  const dt = Math.max(8, b.t - a.t);
  const clamp = v => Math.max(-3, Math.min(3, v));
  return { x: clamp((b.x - a.x) / dt), y: clamp((b.y - a.y) / dt) };
}

function riverYAt(x) {
  for (let i = 1; i < RIVER.length; i++) {
    const [x0, y0] = RIVER[i - 1], [x1, y1] = RIVER[i];
    if (x >= x0 && x <= x1) return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
  }
  return RIVER[RIVER.length - 1][1];
}

// 'riverbank' or 'pondsite' if (x, y) is in the water, else null.
function waterAt(x, y) {
  if (Math.abs(y - riverYAt(x)) < 20) return 'riverbank';
  if (hasPond(world) && ((x - 915) / 62) ** 2 + ((y - 437) / 22) ** 2 < 1) return 'pondsite';
  return null;
}

function fling(svg, g, w, start, v) {
  dragging = true;
  g.classList.add('flying');
  const s = w.stage === 'baby' ? 0.93 : 1.6;
  // Thrown downward, it lands further down the valley (maybe in the river).
  const ground = Math.max(300, Math.min(640, start.y + 25 + Math.max(0, v.y) * 140));
  let x = start.x, y = start.y, vx = v.x, vy = v.y, spin = 0, bounces = 0, last = performance.now();
  const t0 = last;
  const step = now => {
    const dt = Math.min(32, now - last); last = now;
    vy += GRAVITY * dt;
    x += vx * dt; y += vy * dt;
    spin += vx * dt * 0.9;
    if (x < 20 || x > 1180) { vx = -vx * 0.6; x = Math.max(20, Math.min(1180, x)); }
    const wet = vy > 0 && waterAt(x, y);
    if (wet || (vy > 0 && y >= ground)) {
      if (!wet && bounces === 0 && vy > 0.35) {
        bounces++; y = ground; vy = -vy * 0.35; vx *= 0.55;
        fx.push({ kind: 'dust', x, y, at: Date.now() });
      } else return land(svg, g, w, x, Math.min(y, ground), wet);
    }
    if (now - t0 > 2200) return land(svg, g, w, x, ground, waterAt(x, ground));
    g.setAttribute('transform', `translate(${x},${y}) rotate(${spin}) scale(${s})`);
    nextFrame(step);
  };
  nextFrame(step);
}

function land(svg, g, w, x, y, water) {
  dragging = false;
  g.classList.remove('flying');
  const zone = water || zoneAt({ x, y: y - 30 });
  fx.push({ kind: water ? 'splash' : 'dust', x, y, at: Date.now() });
  dropped[w.id] = { x: Math.round(x), y: Math.round(y), at: Date.now(), dizzy: true };
  if (water) toast(world.wobblins.find(o => o.id === w.id).name + ' went SPLASH. Brr.');
  act({ type: 'nudge', nudge: 'carry', target: w.id, zone, thrown: true, ...(water ? { splash: true } : {}) });
}

function drawFx(svg) {
  const NS = 'http://www.w3.org/2000/svg';
  const now = Date.now();
  for (let i = fx.length - 1; i >= 0; i--) if (now - fx[i].at > 1200) fx.splice(i, 1);
  for (const e of fx) {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'fx fx-' + e.kind);
    g.setAttribute('transform', `translate(${e.x},${e.y})`);
    g.innerHTML = e.kind === 'splash'
      ? '<ellipse class="ring" rx="10" ry="4"/><ellipse class="ring r2" rx="10" ry="4"/><path class="drops" d="M-8 -4 q-6 -16 -12 -6 M0 -6 q0 -20 4 -22 M8 -4 q8 -14 12 -4"/>'
      : '<circle class="puff" cx="-10" r="6"/><circle class="puff" cx="10" r="5"/><circle class="puff" cy="-4" r="5"/>';
    svg.append(g);
  }
}

const ZONE_LABEL = { hill: 'the hill', grove: 'the grove', meadow: 'the meadow', hollow: 'the hollow', pondsite: 'the pond', riverbank: 'the river' };
function zoneLabel(z) { return ZONE_LABEL[z] || z; }

function poke(g) {
  // A poke gets a little reaction of its own (just for show).
  const w = world.wobblins.find(x => x.id === g.id);
  g.querySelector('.emote')?.remove();
  if (w) g.insertAdjacentHTML('beforeend', emoteSVG(w.traits.playfulness > 0.5 ? 'love' : w.traits.boldness < 0.3 ? 'scared' : 'like'));
  g.classList.remove('poked');
  void g.getBBox();       // restart the animation
  g.classList.add('poked');
}

// ------------------------------------------------------------ drawing
function draw() {
  if (dragging) return;
  const rs = renderState(world);
  // A Wobblin you just set down lands exactly where you let go.
  for (const w of rs.wobblins) {
    const d = dropped[w.id];
    if (!d) continue;
    const fresh = Date.now() - d.at < 60_000 && world.wobblins.find(x => x.id === w.id).heldUntil > world.tick;
    if (fresh) { w.x = d.x; w.y = d.y; w.landed = Date.now() - d.at < (d.dizzy ? 2600 : 900); } else delete dropped[w.id];
  }
  lastRS = rs;
  const svg = $('#world');
  drawSVG(svg, rs, { hour: localHour(Date.now()), highlight, emotes: Date.now() < emoteUntil ? emoteEvent : null });
  for (const w of rs.wobblins) {
    const el = w.landed && svg.querySelector('#' + w.id);
    if (!el) continue;
    el.classList.add('landed');
    if (dropped[w.id]?.dizzy) {
      el.classList.add('dizzy');
      el.insertAdjacentHTML('beforeend', '<g class="stars" transform="translate(0,-44)"><g class="orbit"><path d="M10 0 l2 4 4 1 -3 3 1 4 -4 -2 -4 2 1 -4 -3 -3 4 -1 Z"/><path d="M-12 2 l1.5 3 3 .7 -2 2 .6 3 -3 -1.4 -3 1.4 .6 -3 -2 -2 3 -.7 Z"/></g></g>');
    }
  }
  drawFx(svg);
  wireWobblins(svg);
  drawHud();
  drawTray();
  if (DEBUG) { drawDebug(); window.__wob = { world, rs, svg }; }   // dev inspection only
}

function drawHud() {
  const pop = world.wobblins.filter(w => w.alive).length;
  const n = Object.values(world.discoveries).filter(d => !d.forgotten).length;
  const hud = $('#hud');
  hud.replaceChildren();
  const name = document.createElement('div'); name.className = 'colony'; name.textContent = world.colonyName;
  const line = document.createElement('div');
  line.textContent = `Day ${world.tick + 1} · ${pop} Wobblins · Discoveries ${n}/30 · Devotion ${Math.round(world.devotion)}`;
  const row = document.createElement('div'); row.className = 'hud-buttons';
  const btn = (label, fn, cls = '') => { const b = document.createElement('button'); b.textContent = label; b.className = cls; b.onclick = fn; row.append(b); };
  btn('Chronicle', () => showChronicle($('#panel'), world, { onPick: ids => highlightEvents(ids) }));
  btn('Discovery Book', () => showBook($('#panel'), world));
  if (WAITLIST_URL) { const a = document.createElement('a'); a.href = WAITLIST_URL; a.target = '_blank'; a.rel = 'noopener'; a.className = 'waitlist'; a.textContent = FEEDBACK_LABEL; row.append(a); }
  if (world.offerings >= 1) btn('Collect ' + Math.floor(world.offerings) + ' offerings', () => act({ type: 'collect_offerings' }), 'glow');
  hud.append(name, line, row);
}

function showWobblin(w) {
  showWobblinCard($('#panel'), world, w, { onBless: ww => { $('#panel').hidden = true; blessMenu(ww.id); } });
}

// Tapping a recap or Chronicle line haloes its subject.
function highlightEvents(ids) {
  highlight = [];
  for (const id of ids) {
    const e = world.events[id - 1];
    if (!e) continue;
    const o = e.target && world.objects.find(x => x.id === e.target && !x.state.gone);
    if (o) highlight.push(o.id);
    for (const a of e.actors.slice(0, 2)) if (world.wobblins.some(w => w.id === a && w.alive)) highlight.push(a);
  }
  draw();
}

async function showRecap(from, to) {
  const narrated = await narrateRecap(buildRecapInput(world, from, to));
  narrated.stats = buildRecap(world, from, to).stats;
  showRecapCard($('#recap'), world, narrated, {
    onPick: ids => highlightEvents(ids),
    onClose: () => { highlight = []; draw(); }
  });
}

let toastTimer = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2800);
}

// ------------------------------------------------------------ debug
function drawDebug() {
  const p = $('#debug');
  if (p.dataset.closed) { p.hidden = true; return; }
  p.hidden = false;
  const h = stateHash(world);
  if (h === lastHash && p.dataset.built) { p.querySelector('.dbg-info').textContent = info(h); return; }
  lastHash = h;
  p.dataset.built = '1';
  p.replaceChildren();
  const title = document.createElement('div'); title.className = 'dbg-title'; title.textContent = 'debug · time warp ';
  const x = document.createElement('button'); x.textContent = 'hide'; x.onclick = () => { p.dataset.closed = '1'; p.hidden = true; };
  title.append(x);
  const row = document.createElement('div');
  for (const [label, n] of [['+1h', 1], ['+12h', 12], ['+3d', 72]]) {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = () => { setOffset(offset() + n); advance(); };
    row.append(b);
  }
  const infoEl = document.createElement('div'); infoEl.className = 'dbg-info'; infoEl.textContent = info(h);
  const log = document.createElement('ol'); log.className = 'dbg-log';
  for (const e of world.events.slice(-14).reverse()) {
    const li = document.createElement('li');
    li.textContent = `t${e.t} ${e.kind} ${e.actors.join(',')} ${e.target || ''} ${JSON.stringify(e.data)}`;
    log.append(li);
  }
  const tools = document.createElement('div');
  const ex = document.createElement('button'); ex.textContent = 'Export';
  ex.onclick = () => { navigator.clipboard?.writeText(exportSave(save)); toast('Save copied to clipboard.'); };
  const im = document.createElement('button'); im.textContent = 'Import';
  im.onclick = () => {
    const s = window.prompt('Paste a save string');
    if (!s) return;
    try { save = importSave(s); storeSave(save); location.reload(); } catch { toast('That is not a Wobblins save.'); }
  };
  const verify = document.createElement('button'); verify.textContent = 'Verify replay';
  verify.onclick = () => {
    const ok = stateHash(replay(save, world.tick)) === stateHash(world);
    toast(ok ? 'Replay matches the live world.' : 'MISMATCH: replay differs from live world!');
  };
  const reset = document.createElement('button'); reset.textContent = 'New colony';
  reset.onclick = () => { if (window.confirm('Erase this colony and start over?')) { clearSave(); location.reload(); } };
  tools.append(ex, im, verify, reset);
  const exp = document.createElement('div'); exp.className = 'dbg-exp';
  exp.textContent = 'experiments (p attempt · top candidates score/pSuccess):\n' + experimentPreview(world).map(x =>
    `${x.name} @${x.zone}/${x.activity} p=${x.pAttempt}  ` + x.top.map(c => `${c.id} ${c.score}/${c.pSuccess}`).join(', ')).join('\n');
  const known = document.createElement('div'); known.className = 'dbg-exp';
  known.textContent = 'known: ' + Object.entries(world.discoveries).map(([k, v]) => k + (v.forgotten ? ' (forgotten)' : '')).join(', ');
  p.append(title, row, infoEl, tools, exp, known, log);
}

function info(h) {
  return `tick ${world.tick} · warp +${offset()}h · seed ${world.seed} · ${save.actions.length} actions · hash ${h}`;
}

boot();
