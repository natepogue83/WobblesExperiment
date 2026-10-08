// objects.js — painterly SVG art for everything in the valley.
// Shared gradients live in ART_DEFS (added once per frame by drawSVG). Each
// object varies a little by its id so no two trees or rocks are identical.

const G = id => `url(#a-${id})`;

export const ART_DEFS = `<defs>
  <radialGradient id="a-rock" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#d4cfc3"/><stop offset="0.55" stop-color="#9b958a"/><stop offset="1" stop-color="#5e594f"/></radialGradient>
  <radialGradient id="a-rock2" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#c6bfb0"/><stop offset="0.6" stop-color="#8a8376"/><stop offset="1" stop-color="#524c43"/></radialGradient>
  <radialGradient id="a-leaf" cx="0.35" cy="0.3" r="0.85"><stop offset="0" stop-color="#9ad874"/><stop offset="0.5" stop-color="#5aa24b"/><stop offset="1" stop-color="#2e6a33"/></radialGradient>
  <radialGradient id="a-leaf2" cx="0.35" cy="0.3" r="0.85"><stop offset="0" stop-color="#b6e58c"/><stop offset="0.55" stop-color="#6fb556"/><stop offset="1" stop-color="#3b7d3c"/></radialGradient>
  <radialGradient id="a-leafdark" cx="0.4" cy="0.35" r="0.8"><stop offset="0" stop-color="#4c8c45"/><stop offset="1" stop-color="#1f4a28"/></radialGradient>
  <linearGradient id="a-trunk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9a7148"/><stop offset="0.6" stop-color="#6e4c2e"/><stop offset="1" stop-color="#4a321e"/></linearGradient>
  <linearGradient id="a-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c79a62"/><stop offset="1" stop-color="#7d5732"/></linearGradient>
  <linearGradient id="a-thatch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0cd7c"/><stop offset="0.6" stop-color="#c9973f"/><stop offset="1" stop-color="#8f652a"/></linearGradient>
  <radialGradient id="a-water" cx="0.45" cy="0.35" r="0.8"><stop offset="0" stop-color="#a9dcf6"/><stop offset="0.5" stop-color="#4b9ad2"/><stop offset="1" stop-color="#2a6595"/></radialGradient>
  <radialGradient id="a-flame" cx="0.5" cy="0.8" r="0.8"><stop offset="0" stop-color="#fff7c0"/><stop offset="0.35" stop-color="#ffc24a"/><stop offset="0.8" stop-color="#f06a24"/><stop offset="1" stop-color="#c8361a"/></radialGradient>
  <radialGradient id="a-ember" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.95"/><stop offset="1" stop-color="#ff7a2a" stop-opacity="0"/></radialGradient>
  <linearGradient id="a-marble" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fbf5e6"/><stop offset="0.5" stop-color="#e6dcc4"/><stop offset="1" stop-color="#b9ad92"/></linearGradient>
  <radialGradient id="a-gold" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#fff6c4"/><stop offset="0.5" stop-color="#f3bf3c"/><stop offset="1" stop-color="#a8721a"/></radialGradient>
  <linearGradient id="a-soil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8d6844"/><stop offset="1" stop-color="#5b3f26"/></linearGradient>
  <radialGradient id="a-shadow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#16200f" stop-opacity="0.38"/><stop offset="1" stop-color="#16200f" stop-opacity="0"/></radialGradient>
  <radialGradient id="a-clay" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#e2a07a"/><stop offset="0.6" stop-color="#b86f4c"/><stop offset="1" stop-color="#7d4430"/></radialGradient>
  <radialGradient id="a-doorglow" cx="0.5" cy="0.7" r="0.7"><stop offset="0" stop-color="#ffd27a"/><stop offset="1" stop-color="#7a4a20"/></radialGradient>
</defs>`;

// Stable small variation per object id.
function vr(id, k = 0) {
  let h = 2166136261 ^ k;
  for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

const shadow = (rx, ry = rx * 0.28, y = 2) => `<ellipse cx="0" cy="${y}" rx="${rx}" ry="${ry}" fill="${G('shadow')}"/>`;

function rock(x, y, w, h, fill = G('rock'), tilt = 0) {
  return `<g transform="translate(${x} ${y}) rotate(${tilt})"><path d="M${-w} 0 Q${-w * 1.05} ${-h * 0.8} ${-w * 0.25} ${-h} Q${w * 0.7} ${-h * 1.05} ${w} ${-h * 0.25} Q${w * 1.05} ${h * 0.15} ${w * 0.6} ${h * 0.25} Q0 ${h * 0.35} ${-w} 0 Z" fill="${fill}"/><path d="M${-w * 0.55} ${-h * 0.72} Q${-w * 0.1} ${-h * 0.95} ${w * 0.35} ${-h * 0.8}" stroke="#fff" stroke-opacity="0.35" stroke-width="${Math.max(1, h * 0.12)}" fill="none" stroke-linecap="round"/></g>`;
}

function canopy(s, id, light = G('leaf')) {
  // Three layers: deep shade, body, and sunlit clumps on the upper left.
  const parts = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + vr(id, i) * 0.6, d = 0.55 + vr(id, i + 9) * 0.35;
    parts.push(`<circle cx="${(Math.cos(a) * 20 * d * s).toFixed(1)}" cy="${(-44 * s + Math.sin(a) * 14 * d * s).toFixed(1)}" r="${((13 + vr(id, i + 20) * 6) * s).toFixed(1)}" fill="${G('leafdark')}"/>`);
  }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.4, d = 0.45 + vr(id, i + 30) * 0.3;
    parts.push(`<circle cx="${(Math.cos(a) * 17 * d * s - 2 * s).toFixed(1)}" cy="${(-48 * s + Math.sin(a) * 11 * d * s).toFixed(1)}" r="${((11 + vr(id, i + 40) * 5) * s).toFixed(1)}" fill="${light}"/>`);
  }
  for (let i = 0; i < 4; i++) {
    parts.push(`<circle cx="${((-12 + i * 5 + vr(id, i + 50) * 4) * s).toFixed(1)}" cy="${((-58 + i * 2 + vr(id, i + 60) * 4) * s).toFixed(1)}" r="${((4 + vr(id, i + 70) * 3) * s).toFixed(1)}" fill="#c6ef98" opacity="0.55"/>`);
  }
  return parts.join('');
}

function flames(scale = 1) {
  const s = scale;
  return `<g class="fire-anim">
    <ellipse cx="0" cy="-6" rx="${26 * s}" ry="${18 * s}" fill="${G('ember')}" class="ember-glow"/>
    <path class="flame f1" d="M${-13 * s} 0 Q${-17 * s} ${-22 * s} ${-5 * s} ${-36 * s} Q${-3 * s} ${-22 * s} ${4 * s} ${-28 * s} Q${16 * s} ${-14 * s} ${13 * s} 0 Z" fill="${G('flame')}"/>
    <path class="flame f2" d="M${-8 * s} 0 Q${-9 * s} ${-15 * s} ${-1 * s} ${-24 * s} Q${2 * s} ${-14 * s} ${6 * s} ${-18 * s} Q${10 * s} ${-8 * s} ${8 * s} 0 Z" fill="#ffd25a"/>
    <path class="flame f3" d="M${-4 * s} 0 Q${-4 * s} ${-8 * s} ${0} ${-13 * s} Q${4 * s} ${-7 * s} ${4 * s} 0 Z" fill="#fff6c8"/>
    <circle class="spark s1" cx="${-4 * s}" cy="${-30 * s}" r="1.4" fill="#ffd27a"/><circle class="spark s2" cx="${5 * s}" cy="${-26 * s}" r="1.1" fill="#ffb35a"/><circle class="spark s3" cx="${1 * s}" cy="${-34 * s}" r="1" fill="#fff2b0"/>
  </g>`;
}

const logs = s => `<g><rect x="${-18 * s}" y="${-5 * s}" width="${36 * s}" height="${7 * s}" rx="${3.5 * s}" fill="${G('wood')}" transform="rotate(-14)"/><rect x="${-18 * s}" y="${-5 * s}" width="${36 * s}" height="${7 * s}" rx="${3.5 * s}" fill="${G('wood')}" transform="rotate(14)"/><circle cx="${-16 * s}" cy="${2 * s}" r="${3 * s}" fill="#e7c58e"/><circle cx="${16 * s}" cy="${2 * s}" r="${3 * s}" fill="#e7c58e"/></g>`;

// A painted handprint (murals).
function hand(x, y, c, rot = 0, s = 1) {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" fill="${c}" opacity=".85"><ellipse cx="0" cy="0" rx="3.6" ry="3.2"/>` +
    [[-3.2, -4.4, -18], [-1.1, -5.6, -6], [1.2, -5.6, 6], [3.2, -4.6, 18], [4.4, -0.6, 60]].map(([fx, fy, r]) => `<ellipse cx="${fx}" cy="${fy}" rx="0.9" ry="2.1" transform="rotate(${r} ${fx} ${fy})"/>`).join('') + '</g>';
}

export function objectArt(o, muralIcon = () => '') {
  const art = objectArtInner(o, muralIcon);
  return art && o.state && o.state.charged ? `<g class="charged"><ellipse cx="0" cy="-30" rx="34" ry="44" fill="#fff3a0" opacity=".25"/>${art}<path class="spark" d="M-18 -60 l4 6 M20 -54 l-5 5 M-24 -20 l6 1 M24 -26 l-6 2" stroke="#ffe36b" stroke-width="2.4" stroke-linecap="round"/></g>` : art;
}
function objectArtInner(o, muralIcon) {
  const id = o.id || 'x';
  switch (o.kind) {
    case 'tree': {
      const s = (o.state.size || 1) * (0.9 + vr(id) * 0.25);
      return shadow(30 * s, 8 * s) +
        `<path d="M${-6 * s} 0 Q${-4 * s} ${-18 * s} ${-3 * s} ${-34 * s} L${3 * s} ${-34 * s} Q${4 * s} ${-18 * s} ${6 * s} 0 Q${10 * s} 2 ${12 * s} 3 L${-12 * s} 3 Q${-10 * s} 2 ${-6 * s} 0 Z" fill="${G('trunk')}"/>` +
        `<path d="M${-1 * s} ${-26 * s} q${-8 * s} ${-6 * s} ${-12 * s} ${-12 * s} M${1 * s} ${-30 * s} q${8 * s} ${-5 * s} ${12 * s} ${-10 * s}" stroke="#5a3f26" stroke-width="${2.2 * s}" fill="none" stroke-linecap="round"/>` +
        canopy(s, id);
    }
    case 'bush': {
      const n = o.state.berries || 0;
      const berry = (x, y) => `<circle cx="${x}" cy="${y}" r="3.4" fill="#c8304f"/><circle cx="${x - 1}" cy="${y - 1.2}" r="1.1" fill="#ffb3c2"/>`;
      const spots = [[-10, -12], [6, -20], [13, -8], [-2, -6], [-14, -4]];
      return shadow(24, 6) +
        `<circle cx="-12" cy="-8" r="13" fill="${G('leafdark')}"/><circle cx="12" cy="-9" r="13" fill="${G('leafdark')}"/>` +
        `<circle cx="-8" cy="-12" r="12" fill="${G('leaf')}"/><circle cx="9" cy="-14" r="12" fill="${G('leaf')}"/><circle cx="0" cy="-21" r="11" fill="${G('leaf2')}"/>` +
        `<circle cx="-6" cy="-24" r="4" fill="#c6ef98" opacity="0.5"/>` +
        spots.slice(0, Math.min(5, n + 1)).slice(0, n).map(([x, y]) => berry(x, y)).join('');
    }
    case 'sprout':
      return shadow(10, 3) + `<ellipse cx="0" cy="1" rx="10" ry="4" fill="${G('soil')}"/>` +
        `<path d="M0 0 Q-1 -8 0 -15" stroke="#4f8f3c" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
        `<path d="M0 -14 Q-12 -20 -13 -11 Q-6 -9 0 -14 Z" fill="${G('leaf2')}"/><path d="M0 -15 Q11 -23 13 -13 Q6 -10 0 -15 Z" fill="${G('leaf')}"/>`;
    case 'stones':
      if (o.state.stacked) {
        return shadow(16, 4) + rock(0, 0, 13, 9, G('rock2')) + rock(1, -8, 10, 7, G('rock'), -4) + rock(-1, -15, 7.5, 5.5, G('rock2'), 6) + rock(0, -20.5, 4.5, 3.5, G('rock'));
      }
      {
        // A bigger pile for every handful added (up to 4).
        const n = Math.min(4, o.state.count || 1);
        let pile = shadow(22 + (n - 1) * 5, 6) + rock(-9, 1, 11, 8, G('rock2'), -6) + rock(9, 3, 9, 7, G('rock'), 8) + rock(0, -5, 8, 6, G('rock'), 2);
        if (n >= 2) pile += rock(-19, 4, 8, 6, G('rock'), 10) + rock(18, 5, 7, 5.5, G('rock2'), -8);
        if (n >= 3) pile += rock(-5, -11, 7, 5, G('rock2'), -4) + rock(6, -9, 6.5, 5, G('rock'), 6);
        if (n >= 4) pile += rock(0, -16, 5.5, 4.2, G('rock'), 0) + rock(-26, 6, 6, 4.5, G('rock2'), 4);
        return pile + `<ellipse cx="-12" cy="-6" rx="4" ry="1.6" fill="#6f9a4a" opacity="0.7"/>`;
      }
    case 'boulder':
      return shadow(56, 12, 6) +
        `<path d="M-50 6 Q-56 -24 -26 -40 Q4 -52 32 -40 Q56 -26 52 0 Q48 12 22 12 Q-30 14 -50 6 Z" fill="${G('rock')}"/>` +
        `<path d="M-44 0 Q-40 -10 -24 -8 Q-10 -6 -4 4" fill="#6e685e" opacity="0.35"/>` +
        `<path d="M-6 -36 L0 -22 L-8 -12 M12 -30 L20 -16" stroke="#5c564c" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.7"/>` +
        `<path d="M-30 -32 Q-6 -46 22 -38" stroke="#fff" stroke-opacity="0.35" stroke-width="5" fill="none" stroke-linecap="round"/>` +
        `<path d="M-26 -38 Q-12 -46 2 -44 Q-6 -38 -26 -38 Z" fill="#7aa553" opacity="0.8"/>`;
    case 'fire':
      return shadow(20, 6) + `<ellipse cx="0" cy="1" rx="18" ry="5" fill="#3b2a1e"/>` + logs(1) + flames(1);
    case 'hearth':
      return shadow(32, 8, 4) +
        [[-20, 0], [-11, 5], [0, 7], [11, 5], [20, 0], [14, -5], [-14, -5]].map(([x, y], i) => rock(x, y, 7, 6, i % 2 ? G('rock') : G('rock2'))).join('') +
        logs(0.8) + flames(1.05) +
        (o.state.pots ? `<g transform="translate(26 -4)"><path d="M-6 -10 Q-9 -10 -9 -4 Q-9 2 0 2 Q9 2 9 -4 Q9 -10 6 -10 Z" fill="${G('clay')}"/><rect x="-6" y="-12" width="12" height="3" rx="1.5" fill="#7d4430"/></g>` : '');
    case 'pond':
      return `<ellipse cx="0" cy="3" rx="70" ry="25" fill="#c8b386"/><ellipse cx="0" cy="1" rx="64" ry="21" fill="#7d6a4a" opacity="0.6"/>` +
        (o.state.frozen ? `<ellipse cx="0" cy="0" rx="60" ry="19" fill="#d8eef8"/><path d="M-30 -4 L-10 2 M6 -8 L22 4 M-40 6 L-24 0" stroke="#fff" stroke-width="1.6" opacity=".8"/>` : `<ellipse cx="0" cy="0" rx="60" ry="19" fill="${G('water')}"/>`) +
        `<ellipse cx="-14" cy="-5" rx="28" ry="5" fill="#d8f0ff" opacity="0.45"/>` +
        `<ellipse class="ripple" cx="16" cy="3" rx="8" ry="2.5" fill="none" stroke="#e8f6ff" stroke-width="1.4"/>` +
        `<g><ellipse cx="34" cy="4" rx="9" ry="3.5" fill="#4f9a45"/><path d="M34 4 L43 2" stroke="${'#3b7d3c'}" stroke-width="1"/><circle cx="31" cy="1" r="2.6" fill="#ffd6e6"/><circle cx="31" cy="1" r="1" fill="#f2b632"/></g>` +
        `<ellipse cx="-38" cy="6" rx="7" ry="2.8" fill="#5aa553"/>`;
    case 'reeds':
      return shadow(14, 4) + `<g stroke-linecap="round">` +
        [[-10, -28, -12], [-4, -36, -5], [2, -40, 1], [8, -32, 10], [13, -26, 15]].map(([x, h, tx], i) =>
          `<path d="M${x} 0 Q${x} ${h / 2} ${tx} ${h}" stroke="${i % 2 ? '#7aa04a' : '#5d8a3a'}" stroke-width="2.6" fill="none"/>`).join('') +
        `</g><ellipse cx="-5" cy="-37" rx="2.6" ry="6.5" fill="#7a5530"/><ellipse cx="1" cy="-41" rx="2.6" ry="6.5" fill="#6a4628"/><ellipse cx="10" cy="-33" rx="2.4" ry="6" fill="#7a5530"/>`;
    case 'clay':
      return shadow(18, 5) + `<path d="M-17 0 Q-16 -9 -4 -10 Q8 -12 16 -4 Q18 2 8 2 Q-8 3 -17 0 Z" fill="${G('clay')}"/><path d="M-8 -7 Q0 -10 8 -6" stroke="#ffe2cc" stroke-width="2" fill="none" opacity="0.6" stroke-linecap="round"/><circle cx="9" cy="-5" r="1.5" fill="#fff4d0"/>`;
    case 'fish':
      return `<g class="fishjump"><path d="M-11 -4 Q0 -13 11 -4 Q0 5 -11 -4 Z" fill="#f0a64a"/><path d="M11 -4 L18 -10 L18 2 Z" fill="#e08a30"/><circle cx="-5" cy="-5" r="1.4" fill="#2a1a10"/><path d="M-2 -8 Q2 -10 6 -8" stroke="#ffd79a" stroke-width="1.2" fill="none"/></g><ellipse class="ripple" cx="0" cy="2" rx="10" ry="3" fill="none" stroke="#e8f6ff" stroke-width="1.4"/>`;
    case 'gift': {
      const hue = Math.floor(vr(o.state.giftId || id) * 360);
      return shadow(14, 4) + `<g class="gift-bob"><rect x="-11" y="-20" width="22" height="18" rx="3" fill="hsl(${hue} 65% 58%)"/><rect x="-12" y="-24" width="24" height="6" rx="2" fill="hsl(${hue} 70% 68%)"/>` +
        `<rect x="-2" y="-24" width="4" height="22" fill="#ffe28a"/><path d="M0 -24 Q-10 -34 -9 -26 Q-6 -22 0 -24 Q6 -22 9 -26 Q10 -34 0 -24 Z" fill="#ffe28a"/>` +
        `<path class="twinkle" d="M14 -30 l1.5 3 3 1 -3 1 -1.5 3 -1.5 -3 -3 -1 3 -1 Z" fill="#fff"/></g>`;
    }
    case 'curio': {
      const c = o.state.curio;
      if (c === 'hollow_log') return shadow(24, 5) + `<rect x="-22" y="-16" width="44" height="16" rx="8" fill="${G('wood')}"/><ellipse cx="22" cy="-8" rx="5" ry="8" fill="#3d2a18"/><ellipse cx="22" cy="-8" rx="3" ry="5.5" fill="#1d140b"/><path d="M-14 -12 h20 M-12 -6 h24" stroke="#6b4a2a" stroke-width="1.4" opacity="0.6"/>`;
      if (c === 'flint') return shadow(10, 3) + `<path d="M-9 0 L-3 -18 L10 -7 L7 0 Z" fill="#4c5560"/><path d="M-3 -18 L1 -8 L10 -7" fill="#7a8794" opacity="0.7"/>`;
      if (c === 'feather') return shadow(10, 3) + `<path d="M-13 0 Q-2 -34 14 -30 Q6 -12 -13 0 Z" fill="#efe9fb"/><path d="M-13 0 Q2 -16 12 -28" stroke="#9a8fb8" stroke-width="1.2" fill="none"/><path d="M8 -26 Q12 -24 13 -20" stroke="#c9a8ff" stroke-width="2" fill="none"/>`;
      if (c === 'reed_bundle') return shadow(14, 4) + `<g stroke="#8a9a4a" stroke-width="3" stroke-linecap="round"><path d="M-12 0 L8 -24"/><path d="M-8 0 L12 -22"/><path d="M-4 0 L15 -18"/></g><path d="M-2 -12 L7 -6" stroke="#5a4020" stroke-width="3.5" stroke-linecap="round"/>`;
      return shadow(12, 4) + `<ellipse cx="0" cy="-7" rx="11" ry="8.5" fill="${G('clay')}"/>`;
    }
    case 'wall':
      return shadow(40, 7, 3) + [[-30, 0, 9, 7], [-14, 1, 9, 8], [2, 0, 9, 7], [18, 1, 9, 8], [33, 0, 7, 6], [-22, -11, 9, 6], [-6, -12, 9, 7], [10, -11, 9, 6], [26, -10, 7, 5], [-13, -21, 8, 5], [3, -22, 8, 5], [18, -20, 7, 5]]
        .map(([x, y, w, h], i) => rock(x, y, w, h, i % 3 ? G('rock') : G('rock2'), (i * 37 % 13) - 6)).join('') +
        `<path d="M-24 -26 q4 -3 8 0" stroke="#7aa553" stroke-width="2.5" fill="none" opacity="0.8"/>`;
    case 'garden':
      return `<path d="M-38 6 L-32 -12 L32 -12 L38 6 Z" fill="${G('soil')}"/>` +
        [-8, -2, 4].map(y => `<path d="M-33 ${y} Q0 ${y - 2} 33 ${y}" stroke="#4a321e" stroke-width="1.6" fill="none" opacity="0.6"/>`).join('') +
        [-26, -13, 0, 13, 26].map((x, i) => `<g transform="translate(${x} ${-6 + (i % 2) * 6})"><path d="M0 0 Q-7 -9 -1 -14 Q0 -7 0 0 Z" fill="${G('leaf2')}"/><path d="M0 0 Q7 -8 2 -14 Q1 -7 0 0 Z" fill="${G('leaf')}"/>${i % 2 ? '<circle cx="0" cy="1" r="2.6" fill="#f08a2c"/>' : ''}</g>`).join('');
    case 'raft':
      return shadow(30, 6) + `<g>` + [-20, -10, 0, 10].map(x => `<rect x="${x}" y="-7" width="9" height="12" rx="4" fill="${G('wood')}"/>`).join('') +
        `<path d="M-22 -3 h42 M-22 2 h42" stroke="#5a3f24" stroke-width="1.3"/></g><path d="M1 -7 L1 -38" stroke="#6b4a2a" stroke-width="2.4"/><path d="M2 -36 Q18 -26 14 -12 L2 -12 Z" fill="#f2ead6" stroke="#c9bfa4"/>`;
    case 'totem':
      return shadow(16, 4) + `<rect x="-8" y="-62" width="16" height="62" rx="4" fill="${G('wood')}"/>` +
        `<path d="M-22 -40 Q-14 -50 -8 -44 L-8 -36 Z M22 -40 Q14 -50 8 -44 L8 -36 Z" fill="#c45a3a"/>` +
        `<g fill="#2a1a10"><circle cx="-3.5" cy="-52" r="2.2"/><circle cx="3.5" cy="-52" r="2.2"/><circle cx="-3" cy="-22" r="2"/><circle cx="3" cy="-22" r="2"/></g>` +
        `<path d="M-4 -46 Q0 -43 4 -46" stroke="#2a1a10" stroke-width="1.6" fill="none"/><rect x="-8" y="-33" width="16" height="4" fill="#3f86c4"/><path d="M-5 -15 h10" stroke="#2a1a10" stroke-width="1.6"/>` +
        `<path d="M-6 -62 L0 -72 L6 -62 Z" fill="#f2b632"/>`;
    case 'temple':
      return shadow(64, 12, 4) +
        `<path d="M-60 4 L-56 -6 L56 -6 L60 4 Z" fill="#b8ad95"/><path d="M-52 -6 L-50 -14 L50 -14 L52 -6 Z" fill="#cfc4ab"/>` +
        [-38, -19, 0, 19, 38].map(x => `<rect x="${x - 5}" y="-50" width="10" height="36" fill="${G('marble')}"/><rect x="${x - 7}" y="-52" width="14" height="4" fill="#e9dfc8"/>`).join('') +
        `<path d="M-58 -52 L0 -80 L58 -52 Z" fill="#efe5cf" stroke="#b9ad92" stroke-width="1.5"/><path d="M-40 -55 L0 -73 L40 -55 Z" fill="#e2d6bb"/>` +
        `<circle class="orb" cx="0" cy="-62" r="6" fill="${G('gold')}"/>` +
        `<path d="M-58 -52 L-58 -64 L-48 -60 L-58 -58" fill="#c45a3a"/><path d="M58 -52 L58 -64 L48 -60 L58 -58" fill="#3f86c4"/>`;
    case 'mural':
      return shadow(28, 6) +
        `<path d="M-26 2 L-28 -36 Q-27 -46 -16 -47 L18 -48 Q28 -47 28 -37 L27 2 Z" fill="${G('rock')}"/>` +
        `<path d="M-22 -4 L-23 -36 Q-22 -42 -14 -42 L16 -43 Q23 -42 23 -36 L22 -4 Z" fill="#efe3c8" opacity="0.85"/>` +
        `<circle cx="15" cy="-34" r="4.5" fill="#f2b13a" opacity=".9"/><path d="M15 -41 v-3 M21 -34 h3 M9 -34 h-3 M19 -39 l2 -2" stroke="#f2b13a" stroke-width="1.4"/>` +
        hand(-15, -12, '#c9563c') + hand(17, -10, '#4a8ac9', -12) + hand(-8, -36, '#5aa86b', 14, 0.7) +
        `<path d="M-22 -8 q4 3 8 0 q4 -3 8 0" stroke="#c9563c" stroke-width="1.4" fill="none" opacity=".7"/>` +
        `<g transform="translate(0 4) scale(.9)">${muralIcon(o.state.depictsKind)}</g>`;
    case 'grave':
      return shadow(10, 3) + `<path d="M-7 0 V-13 Q0 -21 7 -13 V0 Z" fill="${G('rock')}"/><path d="M-2 -11 h4 M0 -13 v6" stroke="#6e685e" stroke-width="1.2"/><circle cx="-8" cy="0" r="1.8" fill="#ffd6e6"/><circle cx="8" cy="-1" r="1.6" fill="#fff"/>`;
    case 'ruin':
      return shadow(28, 6) + rock(-16, 0, 9, 6, G('rock2'), -10) + rock(2, -2, 7, 9, G('rock'), 16) + rock(16, 1, 8, 5, G('rock2'), 4) +
        `<path d="M-26 1 Q0 -5 26 1" stroke="#6d9a4a" stroke-width="3" fill="none"/><path d="M4 -10 q3 -6 7 -4" stroke="#6d9a4a" stroke-width="2" fill="none"/>`;
    case 'scorch':
      return `<ellipse cx="0" cy="-1" rx="32" ry="10" fill="#2f251e" opacity="0.85"/><ellipse cx="-6" cy="-3" rx="14" ry="4" fill="#4a3a2e" opacity="0.6"/>` +
        `<path d="M-14 -4 L-11 -16 M2 -4 L4 -20 M14 -4 L11 -14" stroke="#1d1611" stroke-width="3" stroke-linecap="round"/>` +
        `<path class="smoke" d="M0 -18 q-6 -8 0 -14 q6 -6 0 -14" stroke="#8a8580" stroke-width="3" fill="none" opacity="0.5" stroke-linecap="round"/>`;
    case 'hut':
      return shadow(36, 9, 3) +
        `<path d="M-28 0 V-14 Q-28 -18 -24 -18 H24 Q28 -18 28 -14 V0 Z" fill="${G('wood')}"/>` +
        `<path d="M-34 -14 Q-30 -46 0 -50 Q30 -46 34 -14 Q0 -8 -34 -14 Z" fill="${G('thatch')}"/>` +
        [-26, -16, -6, 4, 14, 24].map(x => `<path d="M${x} -16 Q${x + 2} -32 ${x * 0.3} -46" stroke="#a87a34" stroke-width="1.4" fill="none" opacity="0.6"/>`).join('') +
        `<path d="M-30 -20 Q0 -14 30 -20" stroke="#8f652a" stroke-width="2.2" fill="none"/>` +
        `<path d="M-7 0 V-11 Q0 -17 7 -11 V0 Z" fill="${G('doorglow')}"/>` +
        `<path d="M-2 -50 Q0 -56 2 -50" stroke="#8f652a" stroke-width="3" fill="none"/>` +
        (o.state.smoke ? `<g class="chimney"><path class="smoke" d="M14 -44 q-5 -8 0 -14 q5 -6 0 -14" stroke="#d8d4cc" stroke-width="3.4" fill="none" opacity="0.6" stroke-linecap="round"/></g>` : '');
  }
  return null;
}
