// inventory.js — the Keeper's tray: things you drag onto the valley.
// Each item knows its icon, its cooldown key, how to preview a drop (hint) and
// what action a drop becomes. Pure UI: actions still go through applyAction.
import { ZONES, ALL_SLOTS, slotInfo } from '../sim/geometry.js';
import { objectAtSlot } from '../sim/util.js';
import { objectSVG } from '../render/sprites.js';

const svg = (inner, vb = '-30 -40 60 50') => `<svg viewBox="${vb}" aria-hidden="true">${inner}</svg>`;

export const ICONS = {
  stones: svg(objectSVG({ kind: 'stones', state: {} }), '-24 -22 48 30'),
  boulder: svg(objectSVG({ kind: 'boulder', state: {} }), '-56 -50 112 66'),
  bush: svg(`<ellipse cx="0" cy="2" rx="9" ry="4" fill="#7a5a3a"/><path d="M0 0 L0 -12" stroke="#5a9a4a" stroke-width="3"/><circle cx="-5" cy="-14" r="5" fill="#66a85b"/><circle cx="5" cy="-15" r="5" fill="#5c9a52"/><circle cx="3" cy="-12" r="2" fill="#c4365a"/>`, '-16 -24 32 30'),
  tree: svg(`<ellipse cx="0" cy="2" rx="9" ry="4" fill="#7a5a3a"/><path d="M0 0 L0 -14" stroke="#7a5a3a" stroke-width="3"/><circle cx="0" cy="-19" r="8" fill="#3f7a45"/>`, '-16 -30 32 36'),
  rain: svg(`<g fill="#e9eef5" stroke="#9fb0c6" stroke-width="1.5"><circle cx="-8" cy="-18" r="8"/><circle cx="4" cy="-22" r="10"/><circle cx="12" cy="-16" r="7"/><rect x="-14" y="-18" width="30" height="9" rx="4"/></g><g stroke="#5f9fcf" stroke-width="2.5" stroke-linecap="round"><path d="M-8 -4 l-3 7"/><path d="M2 -4 l-3 7"/><path d="M12 -4 l-3 7"/></g>`, '-22 -34 44 44'),
  lightning: svg(`<path d="M4 -30 L-10 -6 L-1 -6 L-6 10 L12 -14 L2 -14 Z" fill="#ffe36b" stroke="#c9a23a" stroke-width="2" stroke-linejoin="round"/>`, '-18 -34 36 48'),
  water: svg(`<path d="M0 -26 Q14 -8 12 2 Q10 12 0 12 Q-10 12 -12 2 Q-14 -8 0 -26 Z" fill="#6aa7cf" stroke="#3f7ea8" stroke-width="2"/><ellipse cx="-4" cy="-2" rx="3" ry="6" fill="#bfe0f5"/>`, '-18 -30 36 46'),
  cold: svg(`<g stroke="#8fc6f0" stroke-width="3" stroke-linecap="round"><path d="M0 -20 L0 16"/><path d="M-16 -11 L16 7"/><path d="M-16 7 L16 -11"/></g><circle r="4" cy="-2" fill="#dff1ff"/>`, '-20 -24 40 44'),
  warm: svg(`<circle r="10" cy="-4" fill="#ffc94a"/><g stroke="#ffb02e" stroke-width="3" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315].map(a => `<path d="M0 -18 L0 -23" transform="rotate(${a} 0 -4)"/>`).join('')}</g>`, '-26 -30 52 52'),
  bless: svg(`<path d="M0 -24 L4 -10 L18 -8 L6 0 L10 14 L0 6 L-10 14 L-6 0 L-18 -8 L-4 -10 Z" fill="#fff1a8" stroke="#e0b94a" stroke-width="2" stroke-linejoin="round"/>`, '-22 -28 44 46'),
  curio: svg(`<path d="M-12 8 Q0 -26 12 -22 Q4 -6 -12 8 Z" fill="#e6e0f2" stroke="#9a8fb8" stroke-width="2"/><path d="M-12 8 L6 -16" stroke="#9a8fb8" stroke-width="1.5"/>`, '-18 -28 36 40'),
  gift: svg(`<rect x="-12" y="-14" width="24" height="20" rx="3" fill="#e0864a"/><rect x="-14" y="-18" width="28" height="7" rx="2" fill="#f0a26a"/><path d="M0 -18 L0 6" stroke="#ffe28a" stroke-width="4"/><path d="M0 -18 Q-10 -28 -10 -20 Q-8 -16 0 -18 Q8 -16 10 -20 Q10 -28 0 -18" fill="#ffe28a"/>`, '-18 -30 36 40'),
  miracle: svg(['#e66', '#eb5', '#ee6', '#6c6', '#69e'].map((c, i) => `<path d="M${-18 + i * 2} 6 A${18 - i * 2} ${18 - i * 2} 0 0 1 ${18 - i * 2} 6" stroke="${c}" stroke-width="3" fill="none"/>`).join(''), '-22 -16 44 26')
};

// ---- geometry helpers (SVG coordinates) ------------------------------------
export function nearestSlot(world, pt, ok = () => true, max = 110) {
  let best = null, bd = Infinity;
  for (const s of ALL_SLOTS) {
    if (!ok(s)) continue;
    const { x, y } = slotInfo(s);
    const d = Math.hypot(x - pt.x, y - pt.y);
    if (d < bd) { bd = d; best = s; }
  }
  return bd <= max ? best : null;
}

export function zoneAt(pt) {
  let best = 'meadow', bd = Infinity;
  for (const [id, z] of Object.entries(ZONES)) {
    const d = ((pt.x - z.cx) / z.rx) ** 2 + ((pt.y - z.cy) / z.ry) ** 2;
    if (d < bd) { bd = d; best = id; }
  }
  return best;
}

export function nearestWobblin(rs, pt, max = 60, except = null) {
  let best = null, bd = Infinity;
  for (const w of rs.wobblins) {
    if (w.id === except) continue;
    const d = Math.hypot(w.x - pt.x, w.y - 20 - pt.y);
    if (d < bd) { bd = d; best = w; }
  }
  return bd <= max ? best : null;
}

const free = world => s => !objectAtSlot(world, s);

// ---- the tray ---------------------------------------------------------------
// drop(pt, ctx) returns an action, or calls ctx helpers for multi-step drops.
// hint(pt, ctx) returns { x, y, r, ok, label } for the drop preview.
export function trayItems() {
  // Over a Wobblin's head? It lands on them (the thing itself goes in the nearest open spot).
  const onHead = (pt, rs) => nearestWobblin(rs, pt, 30);
  const slotDrop = (power, variant, okFn, canOnto = true) => ({
    hint: (pt, { world, rs }) => {
      const w = canOnto && onHead(pt, rs);
      if (w) {
        const s = nearestSlot(world, { x: w.x, y: w.y }, s => okFn(world, s), 240);
        return s ? { x: w.x, y: w.y - 22, r: 34, ok: true, label: 'on ' + w.name + '!' } : { x: w.x, y: w.y - 22, r: 34, ok: false, label: 'no room' };
      }
      const s = nearestSlot(world, pt, s => okFn(world, s));
      if (!s) return { x: pt.x, y: pt.y, r: 26, ok: false, label: 'no room here' };
      const { x, y } = slotInfo(s);
      return { x, y, r: 22, ok: true };
    },
    drop: (pt, { world, rs }) => {
      const w = canOnto && onHead(pt, rs);
      const s = w ? nearestSlot(world, { x: w.x, y: w.y }, s => okFn(world, s), 240) : nearestSlot(world, pt, s => okFn(world, s));
      return s ? { type: 'power', power, slot: s, ...(variant ? { variant } : {}), ...(w ? { onto: w.id } : {}) } : { error: 'No room there. Try an open spot.' };
    }
  });
  const anywhere = action => ({ hint: pt => ({ x: pt.x, y: pt.y, r: 60, ok: true }), drop: () => action });
  return [
    { row: 'powers', id: 'stones', label: 'Stones', cd: 'stone', ...slotDrop('stone', 'stones', (w, s) => free(w)(s)) },
    { row: 'powers', id: 'boulder', label: 'Boulder', cd: 'stone', ...slotDrop('stone', 'boulder', (w, s) => free(w)(s)) },
    { row: 'powers', id: 'bush', label: 'Berry seed', cd: 'plant', ...slotDrop('plant', 'bush', (w, s) => free(w)(s)) },
    { row: 'powers', id: 'tree', label: 'Tree seed', cd: 'plant', ...slotDrop('plant', 'tree', (w, s) => free(w)(s) && !s.startsWith('riverbank')) },
    { row: 'powers', id: 'rain', label: 'Rain', cd: 'rain', ...anywhere({ type: 'power', power: 'rain' }) },
    { row: 'powers', id: 'lightning', label: 'Lightning', cd: 'lightning', ...slotDrop('lightning', null, () => true) },
    { row: 'powers', id: 'water', label: 'Water', cd: 'water',
      hint: (pt, { world, hasPond }) => {
        if (!hasPond) return { x: 915, y: 440, r: 60, ok: true, label: 'dig a pond' };
        const s = nearestSlot(world, pt, s => s.startsWith('riverbank'), 200);
        return s ? { ...slotInfo(s), r: 24, ok: true, label: 'bend the river' } : { x: pt.x, y: pt.y, r: 26, ok: false };
      },
      drop: (pt, { world, hasPond }) => {
        if (!hasPond) return { type: 'power', power: 'water' };
        const s = nearestSlot(world, pt, s => s.startsWith('riverbank'), 200);
        return s ? { type: 'power', power: 'water', slot: s } : { error: 'Drop it by the river.' };
      } },
    { row: 'powers', id: 'cold', label: 'Cold snap', cd: 'season', ...anywhere({ type: 'power', power: 'season', variant: 'cold' }) },
    { row: 'powers', id: 'warm', label: 'Warm spell', cd: 'season', ...anywhere({ type: 'power', power: 'season', variant: 'warm' }) },
    { row: 'nudges', id: 'bless', label: 'Bless', cd: 'bless', target: 'wobblin',
      hint: (pt, { rs }) => { const w = nearestWobblin(rs, pt); return w ? { x: w.x, y: w.y - 20, r: 36, ok: true, label: w.name } : { x: pt.x, y: pt.y, r: 20, ok: false, label: 'drop on a Wobblin' }; },
      drop: (pt, { rs, blessMenu }) => { const w = nearestWobblin(rs, pt); if (!w) return { error: 'Drop the blessing on a Wobblin.' }; blessMenu(w.id); return null; } },
    { row: 'nudges', id: 'curio', label: 'Curio', cd: 'curio', target: 'wobblin',
      hint: (pt, { rs }) => {
        const a = nearestWobblin(rs, pt);
        if (!a) return { x: pt.x, y: pt.y, r: 20, ok: false, label: 'drop between two friends' };
        const b = nearestWobblin(rs, { x: a.x, y: a.y - 20 }, 9999, a.id);
        return { x: a.x, y: a.y - 20, r: 36, ok: !!b, label: b ? a.name + ' & ' + b.name : 'needs two Wobblins' };
      },
      drop: (pt, { rs, curioMenu }) => {
        const a = nearestWobblin(rs, pt);
        const b = a && nearestWobblin(rs, { x: a.x, y: a.y - 20 }, 9999, a.id);
        if (!a || !b) return { error: 'Drop the curio between two Wobblins.' };
        curioMenu([a.id, b.id]);
        return null;
      } },
    { row: 'nudges', id: 'gift', label: 'Daily gift', cd: null,
      ...slotDrop('gift', null, (w, s) => free(w)(s)),
      drop: (pt, { world, rs, giftMenu }) => {
        const w = onHead(pt, rs);
        const s = w ? nearestSlot(world, { x: w.x, y: w.y }, free(world), 240) : nearestSlot(world, pt, free(world));
        if (!s) return { error: 'No room there for a gift.' };
        giftMenu(s, w ? w.id : undefined);
        return null;
      } },
    { row: 'nudges', id: 'miracle', label: 'Miracle', cd: 'miracle', cost: 20, ...anywhere({ type: 'nudge', nudge: 'miracle' }) }
  ];
}
