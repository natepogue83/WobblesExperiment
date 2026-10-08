// app.js — clock, input, panels. The only place real time and the DOM meet the sim.
import { tick, applyAction, replay, stateHash, giftOptions, BLESS_TRAITS, CONST } from '../sim/index.js';
import { unlockedCurios, hasPond } from '../sim/actions.js';
import { experimentPreview } from '../sim/experiment.js';
import { renderState, drawSVG } from '../render/render.js';
import { newSave, randomSeed, appendAction, popAction, loadSave, storeSave, clearSave,
         exportSave, importSave, DEBUG_OFFSET_KEY } from './save.js';
import { nowTickFor, localDayIndex, localHour, setClockMode, heartbeat, msToNextTick } from './clock.js';
import { Puppets } from './puppets.js';
import { valleyImage } from '../render/painter.js';
import { isUnlocked, UNLOCKS, nextUnlock } from '../sim/belief.js';
import { wantOf } from '../render/render.js';
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
const dropped = {};         // wobblinId -> { at, dizzy } just set down by the Keeper
const EMOTE_MS = 4000;
let emoteEvent = null, emoteUntil = 0, emoteTimer = 0;
const puppets = new Puppets();
let shownUnlock = null;
let wiping = false;         // erasing the save: never write it back on the way out
function wipe() { wiping = true; clearSave(); location.href = location.pathname + location.search.replace(/[?&]fresh=1/, ''); }     // last power_unlocked event already celebrated
const UNLOCK_OF = { stones: 'stone', boulder: 'stone', bush: 'plant', tree: 'plant', rain: 'rain', lightning: 'lightning', water: 'water',
  cold: 'season', warm: 'season', bless: 'bless', curio: 'curio', gift: 'gift', miracle: 'miracle' };

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
  if (DEBUG && params.get('fresh') === '1') { wipe(); return; }   // dev: start over
  if (DEBUG && params.get('devload')) {                              // dev: load a prepared save
    wiping = true;
    fetch(params.get('devload')).then(r => r.json()).then(s2 => {
      const ticks = s2.lastSeenTick || 0;
      s2.createdAt = Date.now() - ticks * 3_600_000 - 1000; delete s2.clock;
      localStorage.setItem('wobblins.save.v1', JSON.stringify(s2));
      localStorage.setItem('wobblins.debugOffsetTicks', '0');
      location.href = location.pathname + '?debug=1';
    });
    return;
  }
  save = loadSave();
  if (!save) { showNewColony(); return; }
  const now = nowTick();
  world = replay(save, now);
  const from = Math.min(save.lastSeenTick, now);
  if (now > from) showRecap(from, now);
  save.lastSeenTick = now;
  startWatching();
}

// While the page is open a colony day passes every minute; away, every hour.
function startWatching() {
  setClockMode(save, 'watch', Date.now());
  storeSave(save);
  draw();
  setInterval(() => advance(false), 1000);
  requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => {
    if (!save || !world) return;
    if (wiping) return;
    if (document.hidden) { setClockMode(save, 'away', Date.now()); storeSave(save); }
    else { advance(true); setClockMode(save, 'watch', Date.now()); storeSave(save); }
  });
  window.addEventListener('pagehide', () => { if (save && !wiping) { setClockMode(save, 'away', Date.now()); storeSave(save); } });
}

function frame(now) {
  if (world) { puppets.step(now); puppets.apply($('#world'), now); }
  requestAnimationFrame(frame);
}

function showNewColony() {
  $('#newColony').hidden = false;
  $('#newColonyForm').onsubmit = ev => {
    ev.preventDefault();
    save = newSave({
      seed: randomSeed(), createdAt: Date.now(),
      colonyName: $('#colonyName').value.trim() || undefined,
      keeperName: $('#keeperName').value.trim() || undefined,
      progression: true
    });
    setOffset(0);
    $('#newColony').hidden = true;
    world = replay(save, nowTick());
    startWatching();
    toast('Three Wobblins just woke up. See what they need, and drag things from your tray to help. You can pick them up, too.');
  };
}

// Advance the live world when the real clock (or the warp) crosses a boundary.
function advance(returning = false) {
  if (dragging) return;   // never yank the valley out from under a drag
  heartbeat(save, Date.now());
  const now = nowTick();
  if (now <= world.tick) { if (Date.now() % 5000 < 1000) storeSave(save); drawHud(); drawTray(); return; }
  const from = world.tick;
  while (world.tick < now) tick(world);
  save.lastSeenTick = now;
  storeSave(save);
  if (returning && now - from >= 2) showRecap(from, now);
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
  const key = UNLOCK_OF[item.id];
  if (key && !isUnlocked(world, key)) {
    const u = UNLOCKS.find(x => x.key === key);
    return { ready: false, locked: true, left: 0, frac: 0, note: 'belief ' + u.at };
  }
  if (item.id === 'gift') {
    const used = world.giftsByDay[localDayIndex(Date.now())] !== undefined;
    return { ready: !used, left: 0, frac: used ? 1 : 0, note: used ? 'tomorrow' : '' };
  }
  const readyAt = world.cooldowns[item.cd] || 0;
  const left = Math.max(0, readyAt - world.tick);
  const poor = item.cost && world.devotion < item.cost && !(item.id === 'cold' || item.id === 'warm');
  const seasonPoor = (item.id === 'cold' || item.id === 'warm') && world.seasonUses > 0 && world.devotion < 10;
  return { ready: left === 0 && !poor && !seasonPoor, left, frac: left / (CONST.COOLDOWN[item.cd] || 1),
    note: left ? timeLeft(left) : (poor || seasonPoor) ? 'needs Devotion' : '' };
}

// Cooldowns are in colony days; show the real time left at the current speed.
function timeLeft(ticks) {
  const watching = save.clock && save.clock.mode === 'watch';
  if (!watching) return ticks + 'h';
  const secs = Math.ceil(((ticks - 1) * 60_000 + msToNextTick(save, Date.now())) / 1000);
  return secs >= 60 ? Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0') : secs + 's';
}

// The render state with where the Wobblins actually are right now.
function liveRS() {
  return { ...lastRS, wobblins: lastRS.wobblins.map(w => ({ ...w, ...(puppets.position(w.id) || {}) })) };
}

function ctx() {
  return { world, rs: liveRS(), hasPond: hasPond(world), blessMenu, curioMenu, giftMenu };
}
const freshTiles = new Set();

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
    // Show what you have, plus a teaser of the next power their belief will unlock.
    const next = nextUnlock(world);
    for (const item of TRAY.filter(i => i.row === row)) {
      const key = UNLOCK_OF[item.id];
      if (key && !isUnlocked(world, key) && (!next || next.key !== key)) continue;
      const st = itemState(item);
      const tile = document.createElement('button');
      tile.className = 'tile' + (st.locked ? ' locked' : st.ready ? '' : ' cooling') + (armed === item ? ' armed' : '') + (freshTiles.has(item.id) ? ' new' : '') +
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
      freshTiles.delete(item.id);
      if (st.locked) { toast(item.label + ' unlocks when their belief in you reaches ' + st.note.split(' ')[1] + '. Do things they love.'); return; }
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
        puppets.pin(w.id, true);
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
        const s = w.stage === 'baby' ? 1.05 : 1.8;
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
        if (!overSvg(svg, ev.clientX, ev.clientY)) { g.setAttribute('transform', base); g.classList.remove('held'); puppets.pin(w.id, false); return; }
        const v = releaseVelocity(trail);
        if (Math.hypot(v.x, v.y) > FLING_SPEED) { fling(svg, g, w, { x: p.x, y: p.y + 30 }, v); return; }
        const water = waterAt(p.x, p.y + 30);
        const zone = water || zoneAt(p);
        dropped[w.id] = { at: Date.now() };
        puppets.place(w.id, p.x, p.y + 30);
        act({ type: 'nudge', nudge: 'carry', target: w.id, zone, ...(water ? { splash: true } : {}) });
      },
      onCancel: () => {
        dragging = false;
        document.body.classList.remove('is-dragging');
        svg.classList.remove('watching');
        clearHint(svg);
        g.setAttribute('transform', base);
        g.classList.remove('held');
        puppets.pin(w.id, false);
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
  const s = w.stage === 'baby' ? 1.05 : 1.8;
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
  dropped[w.id] = { at: Date.now(), dizzy: true };
  puppets.place(w.id, x, y);
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
// The painted valley is made once per light/season/wet state, off the main draw.
let backdropURL = null, backdropKey = null;
function ensureBackdrop() {
  const hour = localHour(Date.now()), season = world.climate.season, wet = world.climate.wetUntil >= world.tick;
  const key = [world.seed, Math.round(hour * 2), season, wet].join('|');
  if (key === backdropKey) return;
  backdropKey = key;
  valleyImage(world.seed, { hour, season, wet }).then(url => { if (backdropKey === key) { backdropURL = url; draw(); } });
}

function draw() {
  if (dragging) return;
  ensureBackdrop();
  const rs = renderState(world);
  // Draw each Wobblin where its puppet is walking right now.
  for (const w of rs.wobblins) {
    const pp = puppets.position(w.id);
    if (pp) { w.x = pp.x; w.y = pp.y; }
    const d = dropped[w.id];
    if (!d) continue;
    if (Date.now() - d.at < 2600) w.landed = Date.now() - d.at < (d.dizzy ? 2600 : 900); else delete dropped[w.id];
  }
  lastRS = rs;
  const svg = $('#world');
  drawSVG(svg, rs, { hour: localHour(Date.now()), highlight, emotes: Date.now() < emoteUntil ? emoteEvent : null, offerings: world.offerings >= 1, backdrop: backdropURL });
  puppets.sync(rs);
  puppets.noteTeaching(world.events.filter(e => e.kind === 'taught' && e.t >= world.tick - 1).map(e => e.actors));
  celebrateUnlocks();
  for (const w of rs.wobblins) {
    const el = w.landed && svg.querySelector('#' + w.id);
    if (!el) continue;
    el.classList.add('landed');
    if (dropped[w.id]?.dizzy) {
      el.classList.add('dizzy');
      el.insertAdjacentHTML('beforeend', '<g class="stars" transform="translate(0,-54)"><g class="orbit"><path d="M10 0 l2 4 4 1 -3 3 1 4 -4 -2 -4 2 1 -4 -3 -3 4 -1 Z"/><path d="M-12 2 l1.5 3 3 .7 -2 2 .6 3 -3 -1.4 -3 1.4 .6 -3 -2 -2 3 -.7 Z"/></g></g>');
    }
  }
  drawFx(svg);
  wireWobblins(svg);
  drawHud();
  drawTray();
  if (DEBUG) { drawDebug(); window.__wob = { world, rs, svg, puppets }; }   // dev inspection only
}

function drawHud() {
  const pop = world.wobblins.filter(w => w.alive).length;
  const n = Object.values(world.discoveries).filter(d => !d.forgotten).length;
  const hud = $('#hud');
  hud.replaceChildren();
  const name = document.createElement('div'); name.className = 'colony'; name.textContent = world.colonyName;
  const line = document.createElement('div');
  const secs = Math.ceil(msToNextTick(save, Date.now()) / 1000);
  const watching = save.clock && save.clock.mode === 'watch';
  line.textContent = `Day ${world.tick + 1}` + (watching ? ` (next in ${secs}s)` : '') + ` · ${pop} Wobblins · Discoveries ${n}/30`;
  const belief = document.createElement('div'); belief.className = 'belief';
  const nu = nextUnlock(world);
  const prev = [...UNLOCKS].reverse().find(u => world.unlocked.includes(u.key));
  const frac = nu ? Math.max(0, Math.min(1, (world.belief - (prev ? prev.at : 0)) / Math.max(1, nu.at - (prev ? prev.at : 0)))) : 1;
  belief.innerHTML = `<span class="label">Belief ${Math.floor(world.belief)}</span><span class="bar"><i style="width:${(frac * 100).toFixed(0)}%"></i></span><span class="next">${nu ? 'next: ' + nu.name + ' at ' + nu.at : 'all powers unlocked'}</span>`;
  const needs = colonyNeeds();
  const needLine = document.createElement('div'); needLine.className = 'needs';
  needLine.textContent = needs || 'Everyone is doing fine.';
  const row = document.createElement('div'); row.className = 'hud-buttons';
  const btn = (label, fn, cls = '') => { const b = document.createElement('button'); b.textContent = label; b.className = cls; b.onclick = fn; row.append(b); };
  btn('Chronicle', () => showChronicle($('#panel'), world, { onPick: ids => highlightEvents(ids) }));
  btn('Discovery Book', () => showBook($('#panel'), world));
  if (WAITLIST_URL) { const a = document.createElement('a'); a.href = WAITLIST_URL; a.target = '_blank'; a.rel = 'noopener'; a.className = 'waitlist'; a.textContent = FEEDBACK_LABEL; row.append(a); }
  if (world.offerings >= 1) btn('Collect ' + Math.floor(world.offerings) + ' offerings', () => act({ type: 'collect_offerings' }), 'glow');
  hud.append(name, line, belief, needLine, row);
}

const WANT_WORD = { hungry: 'hungry', cold: 'cold', scared: 'scared', tired: 'worn out', idea: 'missing something', sad: 'sad', lonely: 'lonely' };
function colonyNeeds() {
  const c = {};
  for (const w of (lastRS || renderState(world)).wobblins) if (w.want) c[w.want.kind] = (c[w.want.kind] || 0) + 1;
  return Object.entries(c).map(([k, v]) => v + ' ' + WANT_WORD[k]).join(' · ');
}

// A new power is a moment: banner, and its tile glows until you use it.
function celebrateUnlocks() {
  const ups = world.events.filter(e => e.kind === 'power_unlocked');
  if (shownUnlock === null) { shownUnlock = ups.length ? ups[ups.length - 1].id : 0; return; }
  for (const e of ups.filter(e => e.id > shownUnlock)) {
    shownUnlock = e.id;
    for (const [id, key] of Object.entries(UNLOCK_OF)) if (key === e.data.power) freshTiles.add(id);
    banner('Their belief grows. New power: ' + e.data.name + '!', 'Drag it from your tray.');
  }
}

function banner(title, sub) {
  const b = document.createElement('div');
  b.className = 'banner';
  b.innerHTML = `<b>${title}</b><span>${sub}</span>`;
  document.body.append(b);
  setTimeout(() => b.remove(), 4200);
}

const WANT_TEXT = {
  hungry: n => `${n} is hungry. Berry bushes nearby would help (or carry them to some).`,
  cold: n => `${n} is cold. A fire, a hut or a friend to huddle with would help.`,
  scared: n => `${n} is scared. Give them a moment, or something they love.`,
  tired: n => `${n} is worn out and needs a nap.`,
  idea: (n, item) => `${n} keeps thinking about ${item}. Something is missing...`,
  sad: n => `${n} feels low. Do something they love.`,
  lonely: n => `${n} is lonely. Carry a friend over.`
};
const ITEM_WORD = { fire: 'fire', stones: 'stones', tree: 'trees', berry: 'berries', water: 'water', rain: 'rain', gift: 'something shiny', idea: 'an idea' };

function showWobblin(w) {
  const lonely = !world.wobblins.some(o => o !== w && o.alive && o.zone === w.zone);
  const want = wantOf(world, w, lonely);
  const wantText = want ? WANT_TEXT[want.kind](w.name, ITEM_WORD[want.item] || want.item) : w.name + ' is happy right now.';
  showWobblinCard($('#panel'), world, w, { wantText, onBless: ww => { $('#panel').hidden = true; if (isUnlocked(world, 'bless')) blessMenu(ww.id); else toast('Bless unlocks when their belief in you grows.'); } });
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
  reset.onclick = () => { if (window.confirm('Erase this colony and start over?')) wipe(); };
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
