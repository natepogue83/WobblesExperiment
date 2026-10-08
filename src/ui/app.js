// app.js — clock, input, panels. The only place real time and the DOM meet the sim.
import { tick, applyAction, replay, stateHash, giftOptions, BLESS_TRAITS, CONST } from '../sim/index.js';
import { unlockedCurios, hasPond } from '../sim/actions.js';
import { experimentPreview } from '../sim/experiment.js';
import { renderState, drawSVG } from '../render/render.js';
import { ZONES, ZONE_IDS, slotIds, slotInfo } from '../sim/geometry.js';
import { objectAtSlot } from '../sim/util.js';
import { newSave, randomSeed, appendAction, popAction, loadSave, storeSave, clearSave,
         exportSave, importSave, DEBUG_OFFSET_KEY } from './save.js';
import { nowTickFor, localDayIndex, localHour } from './clock.js';
import { narrateRecap } from '../ai/narrate.js';
import { buildRecap, buildRecapInput } from '../sim/recap.js';
import { showRecapCard, showChronicle, showBook, showWobblinCard } from './panels.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const $ = sel => document.querySelector(sel);

let save = null, world = null, mode = null, lastHash = '';

function offset() {
  try { return Number(localStorage.getItem(DEBUG_OFFSET_KEY)) || 0; } catch { return 0; }
}
function setOffset(n) { try { localStorage.setItem(DEBUG_OFFSET_KEY, String(n)); } catch { /* ignore */ } }
function nowTick() { return nowTickFor(save, Date.now(), DEBUG ? offset() : 0); }

// ------------------------------------------------------------ boot
function boot() {
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
    setInterval(advance, 1000);
  };
}

// Advance the live world when the real clock (or the warp) crosses a boundary.
function advance() {
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
  if (!res.ok) { popAction(save); toast('Not now (' + res.reason.replace(/_/g, ' ') + ')'); }
  else storeSave(save);
  mode = null;
  draw();
  return res.ok;
}

const POWER_UI = [
  { key: 'stone', label: 'Drop Stone', variants: ['stones', 'boulder'], slot: true },
  { key: 'plant', label: 'Plant', variants: ['bush', 'tree'], slot: true },
  { key: 'rain', label: 'Rain' },
  { key: 'lightning', label: 'Lightning', slot: true },
  { key: 'water', label: 'Shape Water' },
  { key: 'season', label: 'Season' }
];
const NUDGE_UI = [
  { key: 'bless', label: 'Bless' },
  { key: 'curio', label: 'Curio' },
  { key: 'gift', label: 'Daily Gift' },
  { key: 'miracle', label: 'Miracle', cost: 20 }
];

function onButton(b) {
  if (b.key === 'rain') { act({ type: 'power', power: 'rain' }); return; }
  if (b.key === 'miracle') { act({ type: 'nudge', nudge: 'miracle' }); return; }
  if (b.key === 'gift') { showGift(); return; }
  if (b.key === 'season') { showSeason(); return; }
  if (b.key === 'curio') { showCurio(); return; }
  if (b.key === 'bless') { mode = { kind: 'bless' }; toast('Tap a Wobblin to bless.'); draw(); return; }
  if (b.key === 'water') {
    if (!hasPond(world)) { act({ type: 'power', power: 'water' }); return; }
    mode = { kind: 'slot', power: 'water', zone: 'riverbank' };
    toast('Shape Water: tap a spot on the riverbank to bend the river there.');
    draw(); return;
  }
  if (b.key === 'lightning') {
    mode = { kind: 'slot', power: 'lightning', any: true };
    toast('Lightning: tap where it should strike. Trees and bushes catch fire.');
    draw(); return;
  }
  if (b.variants) {
    mode = { kind: 'slot', power: b.key, variant: mode && mode.power === b.key && mode.variant === b.variants[0] ? b.variants[1] : b.variants[0] };
    toast(b.label + ': ' + mode.variant + '. Tap a spot (tap the button again to switch).');
    draw();
  }
}

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
  close.textContent = 'Close'; close.className = 'ghost';
  close.onclick = () => { card.hidden = true; mode = null; draw(); };
  card.append(close);
  card.hidden = false;
}

function showSeason() {
  const cost = world.seasonUses === 0 ? 'free the first time' : '10 Devotion';
  menu('Bring a season for a day (' + cost + ')', [['Cold Snap', 'cold'], ['Warm Spell', 'warm']],
    v => act({ type: 'power', power: 'season', variant: v }));
}

function showCurio() {
  const open = unlockedCurios(world);
  if (!open.length) { toast('No curios yet. They unlock once a Wobblin notices a material.'); return; }
  menu('Place a curio between two Wobblins', open.map(c => [c.replace(/_/g, ' '), c]), c => {
    mode = { kind: 'curio', curio: c, picked: [] };
    toast('Tap two Wobblins.');
    draw();
  });
}

function showGift() {
  const day = localDayIndex(Date.now());
  const card = $('#giftCard');
  card.replaceChildren();
  const h = document.createElement('h3');
  if (world.giftsByDay[day] !== undefined) {
    h.textContent = "Today's gift is already in the world. Come back tomorrow.";
    card.append(h);
  } else {
    h.textContent = 'Choose a gift to leave';
    card.append(h);
    for (const g of giftOptions(world.seed, day)) {
      const btn = document.createElement('button');
      btn.textContent = g.replace(/_/g, ' ');
      btn.onclick = () => { card.hidden = true; act({ type: 'gift', day, giftId: g }); };
      card.append(btn);
    }
  }
  const close = document.createElement('button');
  close.textContent = 'Close'; close.className = 'ghost';
  close.onclick = () => { card.hidden = true; };
  card.append(close);
  card.hidden = false;
}

function blessMenu(w) {
  const card = $('#giftCard');
  card.replaceChildren();
  const h = document.createElement('h3');
  h.textContent = 'Bless ' + w.name + ' with...';
  card.append(h);
  for (const t of BLESS_TRAITS) {
    const btn = document.createElement('button');
    btn.textContent = t;
    btn.onclick = () => { card.hidden = true; act({ type: 'nudge', nudge: 'bless', target: w.id, trait: t }); };
    card.append(btn);
  }
  card.hidden = false;
}

// ------------------------------------------------------------ drawing
function draw() {
  const rs = renderState(world);
  const svg = $('#world');
  drawSVG(svg, rs, { hour: localHour(Date.now()), highlight: highlight });
  if (mode && mode.kind === 'slot') drawSlotTargets(svg);
  for (const w of rs.wobblins) {
    const g = svg.querySelector('#' + w.id);
    if (!g) continue;
    g.style.cursor = 'pointer';
    g.onclick = () => {
      const ww = world.wobblins.find(x => x.id === w.id);
      if (mode && mode.kind === 'bless') blessMenu(ww);
      else if (mode && mode.kind === 'curio') {
        if (!mode.picked.includes(ww.id)) mode.picked.push(ww.id);
        if (mode.picked.length === 2) act({ type: 'nudge', nudge: 'curio', curio: mode.curio, targets: mode.picked });
        else toast(ww.name + ' picked. Tap one more.');
      } else showWobblin(ww);
    };
  }
  drawHud();
  drawBars();
  if (DEBUG) drawDebug();
}

function drawSlotTargets(svg) {
  const NS = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(NS, 'g');
  g.id = 'slot-targets';
  for (const z of ZONE_IDS) {
    for (const s of slotIds(z)) {
      if (mode.zone && z !== mode.zone) continue;
      if (!mode.any && mode.power !== 'water' && objectAtSlot(world, s)) continue;
      if (mode.power === 'plant' && mode.variant === 'tree' && z === 'riverbank') continue;
      const { x, y } = slotInfo(s);
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 16);
      c.setAttribute('class', 'slot-target');
      c.onclick = () => act(Object.assign({ type: 'power', power: mode.power, slot: s }, mode.variant ? { variant: mode.variant } : {}));
      g.append(c);
    }
  }
  svg.append(g);
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
  if (world.offerings >= 1) btn('Collect ' + Math.floor(world.offerings) + ' offerings', () => act({ type: 'collect_offerings' }), 'glow');
  hud.append(name, line, row);
}

function cooldownFrac(key) {
  const ready = world.cooldowns[key];
  if (ready === undefined || ready <= world.tick) return 0;
  return (ready - world.tick) / CONST.COOLDOWN[key];
}

function drawBars() {
  for (const [id, list] of [['#powers', POWER_UI], ['#nudges', NUDGE_UI]]) {
    const bar = $(id);
    bar.replaceChildren();
    for (const b of list) {
      const btn = document.createElement('button');
      btn.className = 'power' + (b.cost && world.devotion < b.cost ? ' soon' : '') + (mode && (mode.power === b.key || mode.kind === b.key) ? ' active' : '');
      const f = cooldownFrac(b.key);
      btn.style.setProperty('--cd', f);
      btn.disabled = f > 0;
      btn.textContent = b.label + (f > 0 ? ' · ' + (world.cooldowns[b.key] - world.tick) + 'h' : '');
      if (b.key === 'gift' && world.giftsByDay[localDayIndex(Date.now())] === undefined) btn.className += ' pulse';
      btn.onclick = () => onButton(b);
      bar.append(btn);
    }
  }
}

function showWobblin(w) {
  showWobblinCard($('#panel'), world, w, { onBless: ww => { $('#panel').hidden = true; blessMenu(ww); } });
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

let highlight = [];
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
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

// ------------------------------------------------------------ debug
function drawDebug() {
  const p = $('#debug');
  p.hidden = false;
  const h = stateHash(world);
  if (h === lastHash && p.dataset.built) { p.querySelector('.dbg-info').textContent = info(h); return; }
  lastHash = h;
  p.dataset.built = '1';
  p.replaceChildren();
  const title = document.createElement('div'); title.className = 'dbg-title'; title.textContent = 'debug · time warp';
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
