// save.js — the save file: seed, metadata, and the action list.
// Pure helpers (newSave, appendAction, encode/decode) run in node tests;
// the localStorage wrappers are browser-only.

export const SAVE_KEY = 'wobblins.save.v1';
export const DEBUG_OFFSET_KEY = 'wobblins.debugOffsetTicks';

export function newSave({ seed, createdAt, colonyName, keeperName, barren } = {}) {
  const s = { v: 1, seed: seed >>> 0, createdAt, actions: [], lastSeenTick: 0 };
  if (colonyName) s.colonyName = colonyName;
  if (keeperName) s.keeperName = keeperName;
  if (barren) s.barren = true;
  return s;
}

export function randomSeed() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0];
}

// Adds seq and t; returns the stored action.
export function appendAction(save, t, action) {
  const seq = save.actions.length ? save.actions[save.actions.length - 1].seq + 1 : 1;
  const a = Object.assign({ seq, t }, action);
  save.actions.push(a);
  return a;
}

// Drop the last action (used when live validation rejects it, so the save
// only carries actions that actually did something).
export function popAction(save) { save.actions.pop(); }

// ---- compact storage form ----------------------------------------------
// In memory a save holds full action objects (CONTRACT.md section 7). On disk
// and in exports the action list is packed into tuples to stay under 20 KB
// after 500 actions: [code, dt, ...fields], with seq implied by position
// (seq = index + 1) and t stored as a delta from the previous action.
const CODES = {
  st: ['power', 'stone', ['slot', 'variant']],
  pl: ['power', 'plant', ['slot', 'variant']],
  ra: ['power', 'rain', []],
  li: ['power', 'lightning', ['slot']],
  wa: ['power', 'water', ['slot']],
  se: ['power', 'season', ['variant']],
  bl: ['nudge', 'bless', ['target', 'trait']],
  cu: ['nudge', 'curio', ['curio', 'targets']],
  mi: ['nudge', 'miracle', []],
  ca: ['nudge', 'carry', ['target', 'zone']],
  gi: ['gift', null, ['day', 'giftId', 'slot']],
  co: ['collect_offerings', null, []]
};
const CODE_OF = {};
for (const [code, [type, sub]] of Object.entries(CODES)) CODE_OF[type + ':' + (sub || '')] = code;

function subOf(a) { return a.type === 'power' ? a.power : a.type === 'nudge' ? a.nudge : ''; }

export function packActions(actions) {
  let prevT = 0;
  return actions.map((a, i) => {
    const code = CODE_OF[a.type + ':' + (subOf(a) || '')];
    const fields = code ? CODES[code][2] : null;
    const known = new Set(['seq', 't', 'type', 'power', 'nudge'].concat(fields || []));
    const clean = code && a.seq === i + 1 && Number.isInteger(a.t) && a.t >= prevT &&
      Object.keys(a).every(k => known.has(k));
    if (!clean) { prevT = a.t; return a; }          // rare: keep the full object
    const tuple = [code, a.t - prevT];
    for (const f of fields) tuple.push(a[f] === undefined ? null : a[f]);
    while (tuple.length > 2 && tuple[tuple.length - 1] === null) tuple.pop();
    prevT = a.t;
    return tuple;
  });
}

export function unpackActions(packed) {
  let prevT = 0;
  return packed.map((p, i) => {
    if (!Array.isArray(p)) { prevT = p.t; return p; }
    const [type, sub, fields] = CODES[p[0]];
    const a = { seq: i + 1, t: prevT + p[1], type };
    if (type === 'power') a.power = sub;
    if (type === 'nudge') a.nudge = sub;
    fields.forEach((f, k) => { if (p[2 + k] !== undefined && p[2 + k] !== null) a[f] = p[2 + k]; });
    prevT = a.t;
    return a;
  });
}

export function serializeSave(save) {
  const { actions, ...rest } = save;
  return JSON.stringify({ ...rest, a: packActions(actions) });
}

export function parseSave(json) {
  const s = JSON.parse(json);
  if (s.a) { s.actions = unpackActions(s.a); delete s.a; }
  if (s.v !== 1 || !Number.isInteger(s.seed) || !Array.isArray(s.actions)) throw new Error('not a Wobblins save');
  return s;
}

function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function b64decode(b64) {
  const bin = atob(b64.trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function exportSave(save) { return b64encode(serializeSave(save)); }

export function importSave(b64) { return parseSave(b64decode(b64)); }

export function loadSave(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(SAVE_KEY);
    return raw ? parseSave(raw) : null;
  } catch { return null; }
}

export function storeSave(save, storage = globalThis.localStorage) {
  try { storage.setItem(SAVE_KEY, serializeSave(save)); return true; } catch { return false; }
}

export function clearSave(storage = globalThis.localStorage) {
  try { storage.removeItem(SAVE_KEY); storage.removeItem(DEBUG_OFFSET_KEY); } catch { /* ignore */ }
}
