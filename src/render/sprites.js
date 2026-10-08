import { objectArt } from './objects.js';
// sprites.js — Wobblin and object SVG generators (pure: data in, SVG string out).
// Wobblins are original soft "mochi" creatures: a wide, squishy body that sags
// a little at the base, a leaf sprout on top whose colour shows their mood,
// big expressive eyes, blush cheeks, stubby arms and feet. Their faces follow
// how they feel. Not egg-shaped roly-poly toys, not yellow jelly people.

function hsl(h, s, l) { return `hsl(${h} ${s}% ${l}%)`; }

const EARS = {
  nubs: c => `<circle cx="-14" cy="-33" r="4.5" fill="${c}"/><circle cx="14" cy="-33" r="4.5" fill="${c}"/>`,
  droopy: c => `<path d="M-16 -30 Q-28 -27 -26 -13 Q-20 -22 -13 -27 Z" fill="${c}"/><path d="M16 -30 Q28 -27 26 -13 Q20 -22 13 -27 Z" fill="${c}"/>`,
  pointy: c => `<path d="M-17 -28 L-15 -46 L-7 -33 Z" fill="${c}"/><path d="M17 -28 L15 -46 L7 -33 Z" fill="${c}"/>`,
  tufts: c => `<path d="M-12 -34 Q-16 -42 -9 -41 Q-8 -46 -4 -39 Z M12 -34 Q16 -42 9 -41 Q8 -46 4 -39 Z" fill="${c}"/>`,
  none: () => ''
};
const TAILS = {
  none: () => '',
  stub: c => `<circle cx="22" cy="-7" r="4.5" fill="${c}"/>`,
  curl: c => `<path d="M20 -8 Q32 -10 30 -19 Q28 -26 22 -21" stroke="${c}" stroke-width="3.2" fill="none" stroke-linecap="round"/>`,
  fluff: c => `<circle cx="23" cy="-9" r="6.5" fill="${c}" opacity="0.95"/><circle cx="28" cy="-14" r="4.5" fill="${c}"/>`
};

function pattern(kind, c) {
  switch (kind) {
    case 'spots': return `<circle cx="-11" cy="-12" r="3.2" fill="${c}"/><circle cx="10" cy="-8" r="2.7" fill="${c}"/><circle cx="13" cy="-17" r="2" fill="${c}"/>`;
    case 'stripes': return `<path d="M-19 -15 Q0 -11 19 -15 M-20 -8 Q0 -4 20 -8" stroke="${c}" stroke-width="2.6" fill="none" opacity="0.8"/>`;
    case 'freckles': return `<g fill="${c}"><circle cx="-13" cy="-15" r="1.1"/><circle cx="-10" cy="-13.5" r="1.1"/><circle cx="10" cy="-13.5" r="1.1"/><circle cx="13" cy="-15" r="1.1"/></g>`;
    case 'patch': return `<ellipse cx="9" cy="-25" rx="8" ry="7" fill="${c}" opacity="0.9"/>`;
    default: return '';
  }
}

// Mood colours for the head sprout.
const SPROUT = { happy: '#6fd35a', love: '#ff7aa2', content: '#9bd06a', meh: '#c3c76a', sad: '#7f9fd0', scared: '#f2a14e', cold: '#a8d8f2', sleep: '#8fb87a' };

// Body: wide and soft, a little squashed at the base.
const BODY = 'M-21 -1 Q-26 -16 -20 -28 Q-12 -40 0 -40 Q12 -40 20 -28 Q26 -16 21 -1 Q11 4 0 4 Q-11 4 -21 -1 Z';

// Body build: each Wobblin is a little rounder, taller or wider (from its look).
const BUILD = [[1, 1], [0.96, 1.05], [1.1, 0.93], [1.05, 0.98]];
function buildOf(look) { return BUILD[Math.floor((look.wobble || 1) * 1000) % BUILD.length]; }

// Brows show temperament at a glance (only on calm faces; strong feelings win).
function brows(temper, face, dark) {
  if (!temper || !['content', 'happy', 'meh'].includes(face)) return '';
  const s = `stroke="${dark}" stroke-width="2" fill="none" stroke-linecap="round"`;
  switch (temper) {
    case 'caution': return `<path d="M-13 -31 Q-9 -33 -5 -35 M13 -31 Q9 -33 5 -35" ${s}/>`;           // worried
    case 'boldness': return `<path d="M-13 -35 L-5 -32 M13 -35 L5 -32" ${s}/>`;                       // determined
    case 'curiosity': return `<path d="M-13 -33 Q-9 -35 -5 -33 M5 -36 Q9 -39 13 -36" ${s}/>`;          // one brow up
    case 'patience': return `<path d="M-13 -33 L-5 -33 M5 -33 L13 -33" ${s} opacity=".7"/>`;           // calm
    default: return '';
  }
}
const CANE = '<g class="cane"><path d="M27 2 L27 -16 Q27 -22 22 -21" stroke="#8a6a44" stroke-width="2.6" fill="none" stroke-linecap="round"/></g>';

function eyes(face, e, lookDx, eyelids) {
  const L = -8.5, R = 8.5, Y = -23;
  switch (face) {
    case 'sleep':
      return `<path d="M${L - 4} ${Y} q4 3 8 0 M${R - 4} ${Y} q4 3 8 0" stroke="#2a2420" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    case 'love': case 'happy':
      return `<path d="M${L - 4.5} ${Y + 1} q4.5 -6 9 0 M${R - 4.5} ${Y + 1} q4.5 -6 9 0" stroke="#2a2420" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  }
  const pr = face === 'scared' ? 0.32 : 0.56;
  const ry = face === 'scared' ? 1.3 : 1.15;
  let lids = '';
  if (face === 'sad') lids = `<path d="M${L - e} ${Y - e * 0.6} L${L + e} ${Y - e * 1.1} L${L + e} ${Y - e * 1.4} L${L - e} ${Y - e * 1.4} Z M${R + e} ${Y - e * 0.6} L${R - e} ${Y - e * 1.1} L${R - e} ${Y - e * 1.4} L${R + e} ${Y - e * 1.4} Z" fill="${eyelids}"/>`;
  if (face === 'cold' || face === 'meh') lids = `<rect x="${L - e - 0.5}" y="${Y - e * ry - 0.5}" width="${2 * e + 1}" height="${e * ry * 0.75}" fill="${eyelids}"/><rect x="${R - e - 0.5}" y="${Y - e * ry - 0.5}" width="${2 * e + 1}" height="${e * ry * 0.75}" fill="${eyelids}"/>`;
  return `<g class="blink">
    <ellipse cx="${L}" cy="${Y}" rx="${e}" ry="${e * ry}" fill="#fff"/>
    <ellipse cx="${R}" cy="${Y}" rx="${e}" ry="${e * ry}" fill="#fff"/>
    <circle cx="${L + 0.6 + lookDx}" cy="${Y + 0.8}" r="${e * pr}" fill="#211b18"/>
    <circle cx="${R + 0.6 + lookDx}" cy="${Y + 0.8}" r="${e * pr}" fill="#211b18"/>
    <circle cx="${L + 1.8 + lookDx}" cy="${Y - 1}" r="${e * 0.2}" fill="#fff"/>
    <circle cx="${R + 1.8 + lookDx}" cy="${Y - 1}" r="${e * 0.2}" fill="#fff"/>
    <circle cx="${L - 0.8 + lookDx}" cy="${Y + 2}" r="${e * 0.1}" fill="#fff" opacity=".8"/>
    <circle cx="${R - 0.8 + lookDx}" cy="${Y + 2}" r="${e * 0.1}" fill="#fff" opacity=".8"/>
    ${lids}
  </g>`;
}

function mouth(face, dark) {
  const Y = -13;
  switch (face) {
    case 'love': case 'happy': return `<path d="M-6 ${Y - 1} Q0 ${Y + 7} 6 ${Y - 1} Z" fill="#7a2f35"/><path d="M-3 ${Y + 2.5} Q0 ${Y + 5} 3 ${Y + 2.5}" fill="#ff8f9c"/>`;
    case 'content': return `<path d="M-4.5 ${Y} Q0 ${Y + 4} 4.5 ${Y}" stroke="${dark}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
    case 'meh': return `<path d="M-3.5 ${Y + 1} L3.5 ${Y + 1}" stroke="${dark}" stroke-width="1.8" stroke-linecap="round"/>`;
    case 'sad': return `<path d="M-4.5 ${Y + 3} Q0 ${Y - 1} 4.5 ${Y + 3}" stroke="${dark}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
    case 'scared': return `<ellipse cx="0" cy="${Y + 1.5}" rx="2.6" ry="3.4" fill="#5a2a2e"/>`;
    case 'cold': return `<path d="M-5 ${Y + 1} l2.5 -1.5 2.5 1.5 2.5 -1.5 2.5 1.5" stroke="${dark}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
    case 'sleep': return `<ellipse cx="0" cy="${Y + 1}" rx="1.6" ry="1.2" fill="${dark}"/>`;
  }
  return '';
}

const daisy = (x, y, c, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">${[0, 72, 144, 216, 288].map(a => `<ellipse cx="0" cy="-3.4" rx="2" ry="3.2" fill="${c}" transform="rotate(${a})"/>`).join('')}<circle r="1.9" fill="#ffcf3a"/></g>`;
const FLOWER_CROWN = `<g class="crown"><path d="M-17 -33 Q0 -44 17 -33" stroke="#5e8f3a" stroke-width="2" fill="none"/>${daisy(-14, -35, '#fff')}${daisy(-5, -39.5, '#ffb3c7', 1.1)}${daisy(5, -39.5, '#fff', 1.05)}${daisy(14, -35, '#c9b3ff')}</g>`;
const BUTTERFLY_FRIEND = '<g class="crown-fly"><g class="wings"><path d="M0 0 Q-5 -6 -7 -1 Q-6 2 0 0 Z" fill="#ffb3d1"/><path d="M0 0 Q5 -6 7 -1 Q6 2 0 0 Z" fill="#ffd27a"/></g></g>';
// Keepsakes worn on the body: a feather by the sprout, a shell or stone pendant,
// a scarf, a flower behind the ear, a little pouch, a glowing jar.
function charmSVG(kind) {
  const pendant = (fill, glow) => `<path d="M-9 -9 Q0 -3 9 -9" stroke="#7a5a3a" stroke-width="1.2" fill="none"/>${glow ? `<circle cx="0" cy="-4" r="5" fill="${glow}" opacity=".35"/>` : ''}<ellipse cx="0" cy="-4.5" rx="2.6" ry="3.2" fill="${fill}" stroke="#5a4632" stroke-width=".6"/>`;
  switch (kind) {
    case 'feather': case 'feather_crown': return '<path d="M6 -40 Q16 -56 20 -60 Q18 -50 8 -40 Z" fill="#f4f0e8" stroke="#b9ae9a" stroke-width=".8"/><path d="M7 -41 L18 -57" stroke="#b9ae9a" stroke-width=".7"/>';
    case 'shiny_shell': return pendant('#ffd6c9') + '<path d="M-2 -6 L0 -2 L2 -6" stroke="#e8a08f" stroke-width=".6" fill="none"/>';
    case 'moon_stone': return pendant('#dfe9ff', '#bcd2ff');
    case 'flint': case 'flint_stone': return pendant('#6f6a64');
    case 'bell_flower': return '<g transform="translate(-17 -33)"><path d="M0 0 Q-3 6 0 8 Q3 6 0 0 Z" fill="#9a7ad6"/><path d="M-3 7 Q0 10 3 7" stroke="#7a5ab6" stroke-width="1" fill="none"/><path d="M0 0 Q2 -4 5 -5" stroke="#5e8f3a" stroke-width="1.2" fill="none"/></g>';
    case 'warm_pelt': return '<path d="M-17 -12 Q0 -4 17 -12 L17 -8 Q0 0 -17 -8 Z" fill="#c4553e"/><path d="M10 -8 L13 2 L8 2 Z" fill="#c4553e"/><path d="M-14 -10 h4 M-4 -7 h4 M6 -8 h4" stroke="#f2d0a0" stroke-width="1.2"/>';
    case 'seed_pouch': return '<g transform="translate(-19 -6)"><path d="M0 -4 Q-5 0 -3 5 Q0 7 3 5 Q5 0 0 -4 Z" fill="#a7814f"/><path d="M-2 -3 L2 -3" stroke="#6b4a2a" stroke-width="1"/></g>';
    case 'firefly_jar': return '<g transform="translate(20 -6)"><circle cx="0" cy="0" r="6" fill="#ffe36b" opacity=".35"/><rect x="-3" y="-4" width="6" height="7" rx="2" fill="#e8f4ff" opacity=".8" stroke="#9fb0c6" stroke-width=".6"/><circle class="glowbug" cx="0" cy="-0.5" r="1.4" fill="#fff27a"/></g>';
    default: return '';
  }
}
const ZAP_FRIZZ = `<g class="zap"><path d="M-26 -30 l-8 -2 l5 -3 l-8 -5 M-22 -38 l-6 -6 l5 -1 l-5 -7 M-9 -42 l-2 -8 l4 1 l-1 -8 M9 -42 l2 -8 l-4 1 l1 -8 M22 -38 l6 -6 l-5 -1 l5 -7 M26 -30 l8 -2 l-5 -3 l8 -5" stroke="#3a2e28" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/><path class="bolt-mini" d="M4 -74 L-3 -62 L2 -62 L-2 -52 L8 -66 L3 -66 Z" fill="#ffe36b" stroke="#c9a23a" stroke-width="1"/><path d="M-20 -26 l-6 -3 l4 -2 l-6 -4 M-15 -36 l-4 -6 l4 0 l-3 -6 M0 -41 l0 -7 l3 2 l1 -7 M15 -36 l4 -6 l-4 0 l3 -6 M20 -26 l6 -3 l-4 -2 l6 -4" stroke="#3a2e28" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="0" cy="-20" rx="20" ry="18" fill="#3a2e28" opacity=".22"/><path class="spark" d="M-24 -44 l4 4 M26 -40 l-4 5 M-28 -16 l5 1 M29 -12 l-5 1" stroke="#ffe36b" stroke-width="2.2" stroke-linecap="round"/></g>`;

// Returns inner SVG markup for a Wobblin standing at the origin (feet at y=0).
export function wobblinSVG(w, opts = {}) {
  const h = w.look.hue;
  const face = w.face || 'content';
  const fill = hsl(h, 55, 66), dark = hsl(h, 40, 40), shade = hsl(h, 45, 52), light = hsl(h, 70, 84), belly = hsl(h, 55, 80), mark = hsl((h + 35) % 360, 45, 52);
  const e = 4.4 * w.look.eyeSize;
  const lookDx = opts.lookDx || 0;
  const elder = w.stage === 'elder';
  const cheeks = face === 'cold' ? '#bfe3ff' : w.temper === 'sociability' ? '#ff7f9b' : '#ff9fb2';
  const blinkDelay = ((w.id ? Number(String(w.id).slice(1)) : 1) * 1.37 % 4).toFixed(2);
  const gid = 'wb' + h;
  return `<g class="flip">
    <defs><radialGradient id="${gid}" cx="0.36" cy="0.22" r="0.85"><stop offset="0" stop-color="${hsl(h, 75, 86)}"/><stop offset="0.5" stop-color="${fill}"/><stop offset="1" stop-color="${hsl(h, 45, 44)}"/></radialGradient>
      <radialGradient id="${gid}b" cx="0.5" cy="0.3" r="0.7"><stop offset="0" stop-color="${hsl(h, 70, 90)}"/><stop offset="1" stop-color="${belly}" stop-opacity="0"/></radialGradient></defs>
    <ellipse class="shadow" cx="0" cy="2" rx="22" ry="5" fill="url(#a-shadow)"/>
    <g class="wobble face-${face}" style="animation-duration:${(2.4 / w.look.wobble).toFixed(2)}s;--blink:${blinkDelay}s"><g class="build" transform="scale(${buildOf(w.look).join(' ')})">
      ${TAILS[w.look.tail](shade)}
      ${EARS[w.look.ears](shade)}
      <g class="feet"><ellipse class="foot l" cx="-10" cy="1" rx="6.5" ry="3.6" fill="${dark}"/><ellipse class="foot r" cx="10" cy="1" rx="6.5" ry="3.6" fill="${dark}"/></g>
      <ellipse class="arm l" cx="-22" cy="-13" rx="4.2" ry="6.5" fill="${shade}" transform="rotate(25 -22 -13)"/>
      <ellipse class="arm r" cx="22" cy="-13" rx="4.2" ry="6.5" fill="${shade}" transform="rotate(-25 22 -13)"/>
      <path d="${BODY}" fill="url(#${gid})" stroke="${dark}" stroke-width="1.2" stroke-opacity="0.8"/>
      <ellipse cx="0" cy="-9" rx="13" ry="9" fill="url(#${gid}b)"/>
      <path d="M-17 -27 Q-9 -38 3 -38" stroke="#fff" stroke-opacity="0.55" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <ellipse cx="-9" cy="-31" rx="5" ry="2.6" fill="#fff" opacity="0.55" transform="rotate(-22 -9 -31)"/>
      <path d="M14 -4 Q20 -12 20 -22" stroke="${hsl(h, 55, 80)}" stroke-opacity="0.5" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      ${pattern(w.look.pattern, mark)}
      <g class="sprout"><path d="M0 -40 Q-1 -46 1 -50" stroke="#5e8f3a" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M1 -49 Q-9 -56 -11 -48 Q-5 -45 1 -49 Z" fill="${SPROUT[face] || SPROUT.content}"/><path d="M1 -49 Q9 -58 12 -50 Q6 -46 1 -49 Z" fill="${SPROUT[face] || SPROUT.content}" opacity="0.85"/></g>
      <ellipse cx="-14" cy="-15" rx="4" ry="2.4" fill="${cheeks}" opacity="0.7"/><ellipse cx="14" cy="-15" rx="4" ry="2.4" fill="${cheeks}" opacity="0.7"/>
      <g class="eyes">${eyes(face, e, lookDx, fill)}</g>
      ${brows(w.temper, face, dark)}
      ${elder ? `<path d="M-14 ${-23 - e * 1.4} q5 -3 10 0 M4 ${-23 - e * 1.4} q5 -3 10 0" stroke="#f4f0e6" stroke-width="2.4" fill="none" stroke-linecap="round"/>` : ''}
      ${mouth(face, dark)}
      ${w.charm ? charmSVG(w.charm) : ''}
      ${w.flower ? FLOWER_CROWN + BUTTERFLY_FRIEND : ''}
      ${w.zapped ? ZAP_FRIZZ : ''}
      ${elder ? CANE : ''}
      ${carriedSVG(w.carry || [])}
    </g></g></g>`;
}

// A mural shows the Keeper act it remembers (a real event from the log).
function muralIcon(kind) {
  const ink = '#7a3b2c';
  switch (kind) {
    case 'lightning': return `<path d="M2 -30 L-6 -16 L0 -16 L-4 -4" stroke="${ink}" stroke-width="2.5" fill="none"/>`;
    case 'rain': return `<g stroke="#3b5f8a" stroke-width="2"><path d="M-10 -26 l-3 8"/><path d="M0 -28 l-3 8"/><path d="M10 -26 l-3 8"/></g>`;
    case 'stone': return `<ellipse cx="0" cy="-14" rx="9" ry="6" fill="none" stroke="${ink}" stroke-width="2.5"/>`;
    case 'plant': return `<path d="M0 -4 L0 -22 M0 -14 q-7 -4 -9 -10 M0 -16 q7 -4 9 -10" stroke="#3f6b2f" stroke-width="2.5" fill="none"/>`;
    case 'miracle': return `<path d="M-14 -6 A14 14 0 0 1 14 -6" stroke="#c9563c" stroke-width="3" fill="none"/><path d="M-10 -6 A10 10 0 0 1 10 -6" stroke="#4a8ac9" stroke-width="3" fill="none"/>`;
    default: return `<circle cx="0" cy="-16" r="6" fill="none" stroke="${ink}" stroke-width="2.5"/><circle cx="0" cy="-16" r="1.5" fill="${ink}"/>`;
  }
}

// Little items a Wobblin carries once it knows how: knowledge is visible.
export function carriedSVG(carry) {
  let s = '';
  if (carry.includes('torch')) s += `<g transform="translate(22 -16)"><rect x="-1.5" y="0" width="3" height="12" fill="#7a5a3a"/><path class="flame" d="M-4 1 Q-4 -7 0 -10 Q4 -6 4 1 Z" fill="#f08a2c"/></g>`;
  if (carry.includes('tool')) s += `<path d="M-28 -10 L-21 -18 L-18 -12 Z" fill="#5c6670" stroke="#363d44"/>`;
  if (carry.includes('basket')) s += `<g transform="translate(-26 -4)"><path d="M-6 -8 L6 -8 L4 0 L-4 0 Z" fill="#c7a25a" stroke="#8a6a2e"/><path d="M-5 -5 L5 -5" stroke="#8a6a2e"/></g>`;
  return s;
}

export function objectSVG(o) {
  const art = objectArt(o, muralIcon);
  if (art) return art;
  switch (o.kind) {
    case 'stones':
      if (o.state.stacked) return '<g fill="#9a9488" stroke="#6f695e"><ellipse cx="0" cy="-3" rx="11" ry="5"/><ellipse cx="0" cy="-11" rx="8" ry="4"/><ellipse cx="0" cy="-18" rx="5.5" ry="3"/><ellipse cx="0" cy="-23" rx="3" ry="2"/></g>';
      return `<ellipse cx="-8" cy="0" rx="10" ry="7" fill="#9a9488"/><ellipse cx="7" cy="2" rx="8" ry="6" fill="#827c71"/><ellipse cx="0" cy="-7" rx="7" ry="5" fill="#b0a99c"/>`;
    case 'boulder':
      return `<path d="M-46 8 Q-50 -30 -10 -38 Q30 -44 46 -10 Q54 8 40 12 Z" fill="#8a8478"/><path d="M-30 -18 Q-10 -32 16 -28" stroke="#a49e92" stroke-width="4" fill="none"/>`;
    case 'bush': {
      const n = o.state.berries || 0;
      const berries = [[-8, -10], [6, -16], [12, -4]].slice(0, n).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#c4365a"/>`).join('');
      return `<circle cx="-10" cy="-6" r="14" fill="#4f8a4a"/><circle cx="10" cy="-8" r="15" fill="#5c9a52"/><circle cx="0" cy="-18" r="13" fill="#66a85b"/>${berries}`;
    }
    case 'tree': {
      const s = o.state.size || 1;
      return `<rect x="-4" y="${-30 * s}" width="8" height="${30 * s}" fill="#7a5a3a"/><circle cx="0" cy="${-40 * s}" r="${24 * s}" fill="#3f7a45"/><circle cx="${-14 * s}" cy="${-30 * s}" r="${14 * s}" fill="#4a8a4c"/><circle cx="${12 * s}" cy="${-34 * s}" r="${12 * s}" fill="#468548"/>`;
    }
    case 'sprout':
      return `<path d="M0 0 L0 -14" stroke="#5a9a4a" stroke-width="3"/><ellipse cx="-6" cy="-14" rx="6" ry="3" fill="#6db35a"/><ellipse cx="6" cy="-16" rx="6" ry="3" fill="#6db35a"/>`;
    case 'fire':
      return `<ellipse cx="0" cy="0" rx="18" ry="5" fill="#3b2a1e"/><path class="flame" d="M-12 0 Q-14 -20 -4 -30 Q-2 -18 4 -24 Q14 -14 12 0 Z" fill="#f08a2c"/><path class="flame" d="M-6 0 Q-6 -12 0 -18 Q6 -10 6 0 Z" fill="#ffd25a"/>`;
    case 'grave':
      return `<path d="M-7 0 V-14 Q0 -21 7 -14 V0 Z" fill="#a8a294" stroke="#7d776b"/>`;
    case 'gift':
      return `<circle cx="0" cy="-8" r="9" fill="#f3d36b" stroke="#c79a2e" stroke-width="2"/><circle cx="-3" cy="-11" r="2.5" fill="#fff7d0"/>`;
    case 'pond':
      return `<ellipse cx="0" cy="0" rx="62" ry="22" fill="#6aa7cf" stroke="#7d6a4a" stroke-width="3"/><ellipse cx="-10" cy="-4" rx="30" ry="8" fill="#8cc3e8" opacity="0.7"/>`;
    case 'reeds':
      return `<g stroke="#6f8f3a" stroke-width="3" stroke-linecap="round"><path d="M-8 0 Q-10 -18 -12 -30"/><path d="M0 0 L0 -34"/><path d="M8 0 Q10 -16 13 -28"/></g><ellipse cx="0" cy="-34" rx="2.5" ry="6" fill="#7a5a3a"/><ellipse cx="13" cy="-28" rx="2.5" ry="6" fill="#7a5a3a"/>`;
    case 'clay':
      return `<ellipse cx="0" cy="-2" rx="16" ry="6" fill="#b86f4c"/><ellipse cx="-4" cy="-4" rx="6" ry="2" fill="#d58b63"/><circle cx="7" cy="-4" r="1.5" fill="#fff4d0"/>`;
    case 'fish':
      return `<g class="fishy"><path d="M-10 -4 Q0 -12 10 -4 Q0 4 -10 -4 Z M10 -4 L16 -9 L16 1 Z" fill="#e8a74a"/></g>`;
    case 'curio': {
      const c = o.state.curio;
      if (c === 'hollow_log') return `<rect x="-20" y="-14" width="40" height="14" rx="7" fill="#8a6440"/><ellipse cx="20" cy="-7" rx="4" ry="7" fill="#3d2a18"/>`;
      if (c === 'flint') return `<path d="M-8 0 L-2 -16 L9 -6 L6 0 Z" fill="#4c5560" stroke="#2d333a"/>`;
      if (c === 'feather') return `<path d="M-12 0 Q0 -30 12 -26 Q4 -10 -12 0 Z" fill="#e6e0f2" stroke="#9a8fb8"/>`;
      if (c === 'reed_bundle') return `<g stroke="#8a9a4a" stroke-width="3"><path d="M-10 0 L8 -22"/><path d="M-6 0 L12 -20"/><path d="M-2 0 L14 -16"/></g><path d="M-2 -10 L6 -6" stroke="#5a4020" stroke-width="3"/>`;
      return `<ellipse cx="0" cy="-6" rx="10" ry="8" fill="#b86f4c"/>`;
    }
    case 'wall':
      return `<g fill="#9d978b" stroke="#6f695e" stroke-width="1.5"><rect x="-34" y="-12" width="16" height="12" rx="3"/><rect x="-17" y="-12" width="16" height="12" rx="3"/><rect x="0" y="-12" width="16" height="12" rx="3"/><rect x="17" y="-12" width="16" height="12" rx="3"/><rect x="-26" y="-23" width="16" height="11" rx="3"/><rect x="-9" y="-23" width="16" height="11" rx="3"/><rect x="8" y="-23" width="16" height="11" rx="3"/></g>`;
    case 'hearth':
      return `<g fill="#8f897d" stroke="#615b51"><ellipse cx="-16" cy="-3" rx="7" ry="5"/><ellipse cx="16" cy="-3" rx="7" ry="5"/><ellipse cx="-8" cy="2" rx="7" ry="5"/><ellipse cx="8" cy="2" rx="7" ry="5"/></g><path class="flame" d="M-9 -2 Q-10 -22 -2 -30 Q0 -18 5 -24 Q12 -12 9 -2 Z" fill="#f08a2c"/><path class="flame" d="M-4 -2 Q-4 -12 1 -17 Q5 -10 4 -2 Z" fill="#ffd25a"/>${o.state.pots ? '<path d="M18 -14 Q26 -14 26 -6 Q26 0 20 0 Q14 0 14 -6 Q14 -14 18 -14 Z" fill="#b86f4c"/>' : ''}`;
    case 'garden':
      return `<rect x="-34" y="-10" width="68" height="16" rx="4" fill="#7a5a3a"/><g fill="#6db35a">${[-26, -13, 0, 13, 26].map(x => `<path d="M${x} -6 q-5 -8 0 -12 q5 4 0 12 Z"/>`).join('')}</g>`;
    case 'raft':
      return `<g fill="#a07a4a" stroke="#6a4f2e">${[-18, -9, 0, 9].map(x => `<rect x="${x}" y="-6" width="8" height="10" rx="2"/>`).join('')}</g><path d="M0 -6 L0 -26 L12 -14 Z" fill="#e6dcc0"/>`;
    case 'totem':
      return `<rect x="-7" y="-50" width="14" height="50" rx="3" fill="#8a6440" stroke="#5a3f24"/><circle cx="-3" cy="-40" r="2" fill="#222"/><circle cx="3" cy="-40" r="2" fill="#222"/><path d="M-4 -33 Q0 -30 4 -33" stroke="#222" fill="none"/><path d="M-14 -24 L14 -24" stroke="#5a3f24" stroke-width="4"/>`;
    case 'temple':
      return `<path d="M-46 0 L-46 -10 L46 -10 L46 0 Z" fill="#b3ab9b"/><g fill="#cfc6b3" stroke="#8f8672">${[-36, -18, 0, 18, 36].map(x => `<rect x="${x - 4}" y="-40" width="8" height="30"/>`).join('')}</g><path d="M-52 -40 L0 -64 L52 -40 Z" fill="#d9cfb8" stroke="#8f8672"/><circle cx="0" cy="-48" r="5" fill="#f3d36b"/>`;
    case 'mural':
      return `<path d="M-30 0 Q-34 -26 -10 -32 Q16 -36 30 -20 Q36 -4 26 0 Z" fill="#a49e92"/>${muralIcon(o.state.depictsKind)}`;
    case 'ruin':
      return `<g fill="#8a857b" opacity="0.85"><rect x="-22" y="-8" width="12" height="8" rx="2"/><rect x="-6" y="-14" width="10" height="14" rx="2" transform="rotate(12)"/><rect x="10" y="-6" width="12" height="6" rx="2"/></g><path d="M-26 0 Q0 -4 26 0" stroke="#6d8f4a" stroke-width="3" fill="none"/>`;
    case 'scorch':
      return `<ellipse cx="0" cy="-2" rx="30" ry="9" fill="#3b2f27" opacity="0.8"/><path d="M-14 -4 L-10 -16 M2 -4 L4 -20 M14 -4 L10 -14" stroke="#2a211b" stroke-width="3"/>`;
    case 'hut':
      return `<path d="M-26 0 V-18 L0 -38 L26 -18 V0 Z" fill="#b48a5a" stroke="#7a5a3a" stroke-width="2"/><path d="M-6 0 V-12 Q0 -17 6 -12 V0 Z" fill="#4a3424"/>`;
    default:
      return `<circle cx="0" cy="-8" r="10" fill="#c9a" stroke="#866" stroke-width="2"/>`;
  }
}

// Little item icons (used in wants and pondering: "something's missing").
export const ITEM_ICONS = {
  berry: '<circle cx="-2" cy="1" r="3.4" fill="#d23c5e"/><circle cx="3" cy="2" r="3" fill="#b8304f"/><path d="M0 -2 q2 -5 6 -4" stroke="#4f8a3a" stroke-width="1.6" fill="none"/>',
  cold: '<g stroke="#5aa8e0" stroke-width="2" stroke-linecap="round"><path d="M0 -6 L0 6"/><path d="M-5.2 -3 L5.2 3"/><path d="M-5.2 3 L5.2 -3"/></g>',
  tired: '<path d="M-4 -4 h6 l-6 7 h6" stroke="#6b6fb0" stroke-width="1.8" fill="none" stroke-linejoin="round"/>',
  scared: '<path d="M-1.4 -6 h2.8 l-0.8 7 h-1.2 Z" fill="#e8463c"/><circle cy="4" r="1.5" fill="#e8463c"/>',
  sad: '<path d="M-6 0 Q-7 -6 -1 -6 Q2 -9 5 -5 Q8 -5 7 0 Z" fill="#8a93a8"/><path d="M-3 3 l-1 3 M1 3 l-1 3 M5 3 l-1 3" stroke="#6aa7d8" stroke-width="1.4" stroke-linecap="round"/>',
  fire: '<path d="M-5 5 Q-6 -3 -1 -7 Q0 -2 2 -4 Q6 0 5 5 Z" fill="#f08a2c"/><path d="M-2 5 Q-2 0 0 -2 Q3 1 2 5 Z" fill="#ffd25a"/>',
  stones: '<ellipse cx="-2" cy="2" rx="4" ry="3" fill="#9a9488"/><ellipse cx="3" cy="-1" rx="3" ry="2.4" fill="#b0a99c"/>',
  tree: '<rect x="-1" y="0" width="2" height="6" fill="#7a5a3a"/><circle cy="-2" r="5" fill="#3f7a45"/>',
  water: '<path d="M0 -6 Q5 0 4 3 Q3 6 0 6 Q-3 6 -4 3 Q-5 0 0 -6 Z" fill="#5aa3d6"/>',
  rain: '<path d="M-6 0 Q-7 -6 -1 -6 Q2 -9 5 -5 Q8 -5 7 0 Z" fill="#cfd8e6"/><path d="M-3 3 l-1 3 M1 3 l-1 3 M5 3 l-1 3" stroke="#5aa3d6" stroke-width="1.4" stroke-linecap="round"/>',
  friend: '<circle cx="-3" cy="-1" r="3" fill="#f2b04a"/><circle cx="3" cy="-1" r="3" fill="#7ac0e8"/><path d="M-6 5 Q0 1 6 5" stroke="#555" stroke-width="1.4" fill="none"/>',
  gift: '<rect x="-5" y="-3" width="10" height="8" rx="1.5" fill="#e0864a"/><path d="M0 -3 V5 M-5 0 H5" stroke="#ffe28a" stroke-width="1.6"/>',
  flower: '<g fill="#ff9fb2"><circle cx="0" cy="-4" r="2.6"/><circle cx="3.8" cy="-1.2" r="2.6"/><circle cx="2.4" cy="3.2" r="2.6"/><circle cx="-2.4" cy="3.2" r="2.6"/><circle cx="-3.8" cy="-1.2" r="2.6"/></g><circle r="2" fill="#ffd24a"/>',
  idea: '<path d="M0 -7 Q5 -7 5 -2 Q5 1 2 3 V5 H-2 V3 Q-5 1 -5 -2 Q-5 -7 0 -7 Z" fill="#ffe36b" stroke="#c9a23a"/>'
};

// Thought bubbles (icons, no emoji). Sized for the new body (top of sprout ~ -56).
function bubble(inner, cls = '') {
  return `<g class="bubble ${cls}" transform="translate(18 -70)"><circle cx="-12" cy="16" r="2.4" fill="#fff" opacity=".9"/><circle cx="-7" cy="10" r="3.4" fill="#fff" opacity=".9"/><circle cx="0" cy="0" r="11.5" fill="#fff" opacity=".96" stroke="#c9c2b0"/>${inner}</g>`;
}

export function bubbleSVG(kind) {
  switch (kind) {
    case 'spark': return bubble('<path d="M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2 Z" fill="#f2b632"/>', 'pop');
    case 'question': return bubble('<path d="M-3 -3 Q-3 -7 0 -7 Q4 -7 4 -3 Q4 0 0 1 L0 3" stroke="#555" stroke-width="2" fill="none"/><circle cx="0" cy="6" r="1.3" fill="#555"/>');
    case 'smoke': return bubble('<g fill="#9a9a9a"><circle cx="-3" cy="1" r="4"/><circle cx="3" cy="-2" r="4"/><circle cx="1" cy="3" r="3"/></g>');
    case 'ponder': return bubble('<g fill="#777"><circle cx="-4" cy="0" r="1.6"/><circle cx="0" cy="0" r="1.6"/><circle cx="4" cy="0" r="1.6"/></g>');
    case 'heart': return bubble('<path d="M0 5 L-6 -1 Q-7 -6 -3 -6 Q0 -6 0 -3 Q0 -6 3 -6 Q7 -6 6 -1 Z" fill="#d8566a"/>');
    case 'levelup': return bubble('<path d="M0 -8 l2.4 5 5.4 .8 -3.9 3.8 .9 5.4 -4.8 -2.6 -4.8 2.6 .9 -5.4 -3.9 -3.8 5.4 -.8 Z" fill="#ffd24a" stroke="#c9a23a"/><path d="M0 3 v-5 m-2.5 2.5 l2.5 -2.5 2.5 2.5" stroke="#8a5a10" stroke-width="1.4" fill="none"/>', 'pop');
  }
  return '';
}

// What a Wobblin wants right now, shown as a small persistent bubble.
// A Wobblin asking the Keeper for something: a golden bubble that bobs.
const ASK_ICON = { berries: 'berry', stones: 'stones', rain: 'rain', company: 'friend', flowers: 'flower' };
export function askSVG(want) {
  const icon = ITEM_ICONS[ASK_ICON[want]] || ITEM_ICONS.idea;
  return `<g class="ask ask-${want}" transform="translate(18 -72)"><circle cx="-12" cy="16" r="2.6" fill="#ffe9a8"/><circle cx="-7" cy="10" r="3.6" fill="#ffe9a8"/><circle r="13" fill="#fff7d6" stroke="#f0b93a" stroke-width="2"/><g transform="translate(0 .5) scale(1.15)">${icon}</g><circle cx="10" cy="-10" r="5.5" fill="#f0b93a"/><path d="M8.2 -12 q1.8 -2.6 3.6 0 q0 1.6 -1.8 2.2 v1" stroke="#fff" stroke-width="1.3" fill="none" stroke-linecap="round"/><circle cx="10" cy="-6.6" r=".7" fill="#fff"/></g>`;
}

export function wantSVG(want) {
  if (!want) return '';
  const icon = ITEM_ICONS[want.item || want.kind] || ITEM_ICONS.idea;
  const extra = want.kind === 'idea' ? '<circle cx="9" cy="-9" r="5" fill="#ffe36b" stroke="#c9a23a" stroke-width="1"/><path d="M9 -12 v4 M9 -6.5 v.5" stroke="#8a6a1a" stroke-width="1.4" stroke-linecap="round"/>' : '';
  return `<g class="want want-${want.kind}">${bubble(icon + extra)}</g>`;
}

// Dizzy stars orbiting the head: for anything they did not enjoy.
const STARS = `<g class="dizzy-stars" transform="translate(0 -54)"><g class="orbit"><path d="M12 0 l2 4 4 1 -3 3 1 4 -4 -2 -4 2 1 -4 -3 -3 4 -1 Z"/><path d="M-13 2 l1.6 3.2 3.2 .8 -2.4 2.4 .8 3.2 -3.2 -1.6 -3.2 1.6 .8 -3.2 -2.4 -2.4 3.2 -.8 Z"/><path d="M0 -8 l1.2 2.4 2.4 .6 -1.8 1.8 .6 2.4 -2.4 -1.2 -2.4 1.2 .6 -2.4 -1.8 -1.8 2.4 -.6 Z"/></g></g>`;

// Reactions to a Keeper act: hearts and sparkles when they love it, ? when
// unsure; ! or X eyes plus dizzy stars when they do not like it.
const HEART = (x, y, s, c = '#e8506a') => `<g transform="translate(${x} ${y}) scale(${s})"><path class="h" d="M0 6 L-7 -1 Q-9 -7 -4 -8 Q-1 -8 0 -4 Q1 -8 4 -8 Q9 -7 7 -1 Z" fill="${c}" stroke="#fff" stroke-width="1.2"/></g>`;
export function emoteSVG(kind) {
  switch (kind) {
    case 'love': return `<g class="emote em-love">${HEART(-14, -60, 1.5)}${HEART(12, -70, 1.1, '#f27a8e')}${HEART(0, -84, 0.85, '#ff9fb0')}</g>`;
    case 'like': return `<g class="emote em-like">${HEART(0, -64, 0.95, '#f27a8e')}<path d="M16 -58 l2 4 4 1 -3 3 1 4 -4 -2 -4 2 1 -4 -3 -3 4 -1 Z" fill="#ffe36b"/></g>`;
    case 'curious': return `<g class="emote em-curious">${bubble('<path d="M-3 -3 Q-3 -7 0 -7 Q4 -7 4 -3 Q4 0 0 1 L0 3" stroke="#555" stroke-width="2" fill="none"/><circle cx="0" cy="6" r="1.3" fill="#555"/>')}</g>`;
    case 'scared': return `<g class="emote em-scared"><path d="M12 -86 L21 -86 L18 -64 L15 -64 Z" fill="#e8463c" stroke="#fff" stroke-width="1.2"/><circle cx="16.5" cy="-58" r="2.8" fill="#e8463c" stroke="#fff" stroke-width="1"/><path d="M-26 -34 q-4 -3 -6 0 M-28 -25 q-4 -2 -5 1" stroke="#9fd0f0" stroke-width="1.6" fill="none"/>${STARS}</g>`;
    case 'upset': return `<g class="emote em-upset"><g stroke="#3a2f2a" stroke-width="2.6" stroke-linecap="round"><path d="M-12 -27 L-5 -20 M-5 -27 L-12 -20"/><path d="M5 -27 L12 -20 M12 -27 L5 -20"/></g>${STARS}</g>`;
  }
  return '';
}
