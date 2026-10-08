// sprites.js — Wobblin and object SVG generators (pure: data in, SVG string out).
// Wobblins are original soft blobs: a wide, low, pear-ish body that sags a
// little at the bottom, big eyes set high, small stubby feet, seeded ears,
// pattern and tail. Not egg-shaped roly-poly toys, not yellow jelly people.

function hsl(h, s, l) { return `hsl(${h} ${s}% ${l}%)`; }

const EARS = {
  nubs: c => `<circle cx="-11" cy="-30" r="4" fill="${c}"/><circle cx="11" cy="-30" r="4" fill="${c}"/>`,
  droopy: c => `<path d="M-14 -27 Q-24 -24 -22 -12 Q-17 -20 -11 -24 Z" fill="${c}"/><path d="M14 -27 Q24 -24 22 -12 Q17 -20 11 -24 Z" fill="${c}"/>`,
  pointy: c => `<path d="M-14 -26 L-12 -42 L-5 -30 Z" fill="${c}"/><path d="M14 -26 L12 -42 L5 -30 Z" fill="${c}"/>`,
  tufts: c => `<path d="M-6 -33 Q-8 -42 -2 -40 Q0 -44 3 -39 Q8 -42 6 -33 Z" fill="${c}"/>`,
  none: () => ''
};
const TAILS = {
  none: () => '',
  stub: c => `<circle cx="19" cy="-5" r="4" fill="${c}"/>`,
  curl: c => `<path d="M17 -6 Q28 -8 26 -16 Q24 -22 19 -18" stroke="${c}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  fluff: c => `<circle cx="20" cy="-7" r="6" fill="${c}" opacity="0.9"/><circle cx="24" cy="-11" r="4" fill="${c}"/>`
};

function pattern(kind, c) {
  switch (kind) {
    case 'spots': return `<circle cx="-8" cy="-10" r="3" fill="${c}"/><circle cx="7" cy="-6" r="2.5" fill="${c}"/><circle cx="2" cy="-14" r="2" fill="${c}"/>`;
    case 'stripes': return `<path d="M-15 -14 Q0 -11 15 -14 M-16 -8 Q0 -5 16 -8" stroke="${c}" stroke-width="2.5" fill="none"/>`;
    case 'freckles': return `<g fill="${c}"><circle cx="-10" cy="-15" r="1"/><circle cx="-7" cy="-14" r="1"/><circle cx="7" cy="-14" r="1"/><circle cx="10" cy="-15" r="1"/></g>`;
    case 'patch': return `<ellipse cx="7" cy="-18" rx="7" ry="6" fill="${c}"/>`;
    default: return '';
  }
}

// Body path: wide bottom, soft shoulders, slight sag at the base.
const BODY = 'M-18 -2 Q-21 -20 -12 -29 Q0 -36 12 -29 Q21 -20 18 -2 Q10 3 0 2 Q-10 3 -18 -2 Z';

// Returns inner SVG markup for a Wobblin standing at the origin (feet at y=0).
export function wobblinSVG(w, opts = {}) {
  const h = w.look.hue;
  const fill = hsl(h, 52, 64), dark = hsl(h, 42, 44), belly = hsl(h, 50, 78), mark = hsl((h + 30) % 360, 40, 50);
  const e = 3.6 * w.look.eyeSize;
  const eyeY = -20;
  const lookDx = opts.lookDx || 0;
  const elder = w.stage === 'elder';
  return `
    <ellipse cx="0" cy="1" rx="17" ry="4" fill="rgba(0,0,0,0.18)"/>
    <g class="wobble" style="animation-duration:${(2.4 / w.look.wobble).toFixed(2)}s">
      ${TAILS[w.look.tail](dark)}
      ${EARS[w.look.ears](dark)}
      <ellipse cx="-8" cy="0" rx="5" ry="3" fill="${dark}"/><ellipse cx="8" cy="0" rx="5" ry="3" fill="${dark}"/>
      <path d="${BODY}" fill="${fill}" stroke="${dark}" stroke-width="1.5"/>
      <ellipse cx="0" cy="-8" rx="10" ry="7" fill="${belly}" opacity="0.8"/>
      ${pattern(w.look.pattern, mark)}
      <g class="eyes">
        <ellipse cx="-6.5" cy="${eyeY}" rx="${e}" ry="${e * 1.15}" fill="#fff"/>
        <ellipse cx="6.5" cy="${eyeY}" rx="${e}" ry="${e * 1.15}" fill="#fff"/>
        <circle cx="${-6 + lookDx}" cy="${eyeY + 0.6}" r="${e * 0.55}" fill="#1f1d1a"/>
        <circle cx="${7 + lookDx}" cy="${eyeY + 0.6}" r="${e * 0.55}" fill="#1f1d1a"/>
        <circle cx="${-5 + lookDx}" cy="${eyeY - 0.6}" r="${e * 0.18}" fill="#fff"/>
        <circle cx="${8 + lookDx}" cy="${eyeY - 0.6}" r="${e * 0.18}" fill="#fff"/>
      </g>
      ${elder ? `<path d="M-11 ${eyeY - e - 3} q4 -2 8 0 M3 ${eyeY - e - 3} q4 -2 8 0" stroke="#f4f0e6" stroke-width="2" fill="none"/>` : ''}
      <path d="M-3 -11 Q0 -9 3 -11" stroke="${dark}" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    </g>`;
}

export function objectSVG(o) {
  switch (o.kind) {
    case 'stones':
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
    case 'hut':
      return `<path d="M-26 0 V-18 L0 -38 L26 -18 V0 Z" fill="#b48a5a" stroke="#7a5a3a" stroke-width="2"/><path d="M-6 0 V-12 Q0 -17 6 -12 V0 Z" fill="#4a3424"/>`;
    default:
      return `<circle cx="0" cy="-8" r="10" fill="#c9a" stroke="#866" stroke-width="2"/>`;
  }
}
