// scene.js — the painted valley behind everything (render-only, deterministic).
// Returns SVG markup for the sky, mountains, hills, ground, river and weather.
// The light follows the player's real local time of day.
import { VIEW, ZONES, RIVER } from '../sim/geometry.js';
import { rngFor } from '../sim/rng.js';

const W = VIEW.w, H = VIEW.h;

// Palette by time of day. Each: sky top, sky bottom, light tint, far, mid, near.
const TIMES = {
  night: { top: '#121a3a', bot: '#3a4778', tint: 'rgba(24,32,80,0.38)', far: '#3c4a6e', mid: '#355a4a', near: '#3f6a4c', grass: '#4d7a56' },
  dawn: { top: '#f6b48e', bot: '#ffe2b8', tint: 'rgba(255,170,120,0.12)', far: '#a7a3c7', mid: '#7ea66a', near: '#8fbb72', grass: '#a3cc80' },
  day: { top: '#7cc3f0', bot: '#dff3fc', tint: 'rgba(255,255,255,0)', far: '#9db8d2', mid: '#79b066', near: '#8cc472', grass: '#a2d483' },
  dusk: { top: '#e57b6c', bot: '#ffcf8f', tint: 'rgba(255,120,60,0.14)', far: '#9a87b0', mid: '#6f9a5e', near: '#82b068', grass: '#97c27a' }
};

export function timeOfDay(hour) {
  if (hour < 5 || hour >= 21) return 'night';
  if (hour < 7.5) return 'dawn';
  if (hour < 18) return 'day';
  return 'dusk';
}

function sunPos(hour) {
  // 6:00 rises on the left, 20:00 sets on the right.
  const f = Math.max(0, Math.min(1, (hour - 6) / 14));
  return { x: 80 + f * 1040, y: 175 - Math.sin(f * Math.PI) * 125 };
}

// Soft, shaded clouds: a tinted underside, a lit body, a bright top edge.
const CLOUD_TINT = { day: ['#ffffff', '#d7e3f1', '#b9cbe0'], dawn: ['#fff6ee', '#f6cdbd', '#dba596'], dusk: ['#fff0e6', '#eeb1a6', '#c98480'], night: ['#9aa5c8', '#6c789f', '#4c5880'] };
function cloud(r, x, y, s, tod = 'day') {
  const [top, under, shade] = CLOUD_TINT[tod] || CLOUD_TINT.day;
  const n = 3 + Math.floor(r() * 3);
  const puffs = [];
  for (let i = 0; i < n; i++) puffs.push([(i - n / 2 + 0.5) * 26 * s, -r() * 14 * s, (22 + r() * 16) * s, (14 + r() * 8) * s]);
  const body = (dx, dy, k, fill, op) => `<g fill="${fill}" opacity="${op}">${puffs.map(([cx, cy, rx, ry]) => `<ellipse cx="${(cx + dx).toFixed(1)}" cy="${(cy + dy).toFixed(1)}" rx="${(rx * k).toFixed(1)}" ry="${(ry * k).toFixed(1)}"/>`).join('')}<rect x="${(-n * 13 * s + dx).toFixed(1)}" y="${(-6 + dy).toFixed(1)}" width="${(n * 26 * s).toFixed(1)}" height="${(14 * s).toFixed(1)}" rx="${(7 * s).toFixed(1)}"/></g>`;
  const gid = 'cg' + tod;
  return `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)})"><g class="cloud" style="animation-duration:${(90 + r() * 80).toFixed(0)}s;animation-delay:-${(r() * 90).toFixed(0)}s">` +
    `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0.25" stop-color="${top}"/><stop offset="1" stop-color="${under}"/></linearGradient></defs>` +
    body(4 * s, 7 * s, 0.96, shade, 0.35) + body(0, 0, 1, `url(#${gid})`, 0.92) + body(-5 * s, -6 * s, 0.55, top, 0.7) + '</g></g>';
}

function mountains(r, color) {
  let d = `M0 ${H} L0 205`;
  const caps = [];
  let x = 0;
  while (x < W) {
    const w = 90 + r() * 110, h = 70 + r() * 70;
    const px = x + w / 2, py = 205 - h;
    d += ` L${px.toFixed(0)} ${py.toFixed(0)} L${(x + w).toFixed(0)} ${(205 - r() * 25).toFixed(0)}`;
    if (h > 105) caps.push(`<path d="M${(px - 16).toFixed(0)} ${(py + 20).toFixed(0)} L${px.toFixed(0)} ${py.toFixed(0)} L${(px + 16).toFixed(0)} ${(py + 20).toFixed(0)} L${(px + 6).toFixed(0)} ${(py + 15).toFixed(0)} L${(px - 3).toFixed(0)} ${(py + 22).toFixed(0)} Z" fill="#f4f6fa" opacity="0.9"/>`);
    x += w;
  }
  d += ` L${W} ${H} Z`;
  return `<path d="${d}" fill="url(#mtn)"/><g>${caps.join('')}</g>`;
}

function treeline(r, x0, x1, y, color) {
  const out = [];
  for (let x = x0; x < x1; x += 22 + r() * 18) {
    const h = 34 + r() * 30, w = 16 + r() * 12;
    out.push(`<ellipse cx="${x.toFixed(0)}" cy="${(y - h / 2).toFixed(0)}" rx="${w.toFixed(0)}" ry="${(h / 2).toFixed(0)}" fill="${color}"/>`);
  }
  return out.join('');
}

function tufts(r, n, color) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = 300 + r() * 360;
    if (Math.abs(y - riverY(x)) < 34) continue;
    const s = 0.6 + (y - 300) / 360;
    out.push(`<path d="M${x.toFixed(0)} ${y.toFixed(0)} q-2 ${(-8 * s).toFixed(1)} -5 ${(-11 * s).toFixed(1)} M${x.toFixed(0)} ${y.toFixed(0)} q1 ${(-10 * s).toFixed(1)} 2 ${(-13 * s).toFixed(1)} M${x.toFixed(0)} ${y.toFixed(0)} q3 ${(-7 * s).toFixed(1)} 6 ${(-9 * s).toFixed(1)}"/>`);
  }
  return `<g stroke="${color}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.8">${out.join('')}</g>`;
}

function flowers(r, n) {
  const cols = ['#ffffff', '#ffd6e6', '#ffe58a', '#d9c8ff'];
  const out = [];
  for (let i = 0; i < n; i++) {
    const z = r() < 0.6 ? ZONES.meadow : r() < 0.5 ? ZONES.hill : ZONES.grove;
    const a = r() * Math.PI * 2, d = Math.sqrt(r());
    const x = z.cx + Math.cos(a) * z.rx * d * 0.9, y = z.cy + Math.sin(a) * z.ry * d * 0.9;
    const c = cols[Math.floor(r() * cols.length)];
    out.push(`<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)})"><circle cx="-2" r="1.8" fill="${c}"/><circle cx="2" r="1.8" fill="${c}"/><circle cy="-2" r="1.8" fill="${c}"/><circle r="1" fill="#f2b632"/></g>`);
  }
  return out.join('');
}

export function riverY(x) {
  for (let i = 1; i < RIVER.length; i++) {
    const [x0, y0] = RIVER[i - 1], [x1, y1] = RIVER[i];
    if (x >= x0 && x <= x1) return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
  }
  return RIVER[RIVER.length - 1][1];
}

function riverPath() {
  // A smooth curve through the river points.
  let d = `M${RIVER[0][0]} ${RIVER[0][1]}`;
  for (let i = 1; i < RIVER.length; i++) {
    const [x0, y0] = RIVER[i - 1], [x1, y1] = RIVER[i];
    const mx = (x0 + x1) / 2;
    d += ` C${mx} ${y0} ${mx} ${y1} ${x1} ${y1}`;
  }
  return d;
}

// The static backdrop. key: time + season + wet, so it can be cached.
export function sceneSVG(seed, { hour = 12, season = 'mild', wet = false } = {}) {
  const tod = timeOfDay(hour);
  const P = TIMES[tod];
  const r = rngFor(seed, 'scene');
  const sun = sunPos(hour);
  const cold = season === 'cold';
  const near = cold ? '#a9c2b0' : P.near, mid = cold ? '#97b3a2' : P.mid, grass = cold ? '#bcd3c4' : P.grass;
  const rp = riverPath();
  const parts = [];
  parts.push(`<defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.top}"/><stop offset="1" stop-color="${P.bot}"/></linearGradient>
    <linearGradient id="mtn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.far}"/><stop offset="1" stop-color="${P.bot}" stop-opacity="0.9"/></linearGradient>
    <linearGradient id="hillfar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mid}"/><stop offset="1" stop-color="${near}"/></linearGradient>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${grass}"/><stop offset="0.55" stop-color="${near}"/><stop offset="1" stop-color="${mid}"/></linearGradient>
    <linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tod === 'night' ? '#2e4f7a' : '#5aa3d6'}"/><stop offset="1" stop-color="${tod === 'night' ? '#203a5e' : '#3d7fb6'}"/></linearGradient>
    <radialGradient id="sunglow"><stop offset="0" stop-color="#fff6c8" stop-opacity="0.9"/><stop offset="1" stop-color="#fff6c8" stop-opacity="0"/></radialGradient>
    <radialGradient id="vignette" cx="0.5" cy="0.45" r="0.75"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.28"/></radialGradient>
    <radialGradient id="hollowdip" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#3e6b3e" stop-opacity="0.35"/><stop offset="1" stop-color="#3e6b3e" stop-opacity="0"/></radialGradient>
  </defs>`);
  // Sky, sun or moon, stars, clouds.
  parts.push(`<rect width="${W}" height="${H}" fill="url(#sky)"/>`);
  if (tod === 'night') {
    for (let i = 0; i < 80; i++) parts.push(`<circle class="star" style="animation-delay:-${(r() * 4).toFixed(1)}s" cx="${(r() * W).toFixed(0)}" cy="${(r() * 200).toFixed(0)}" r="${(r() * 1.5 + 0.4).toFixed(1)}" fill="#fff"/>`);
    parts.push(`<circle cx="960" cy="80" r="26" fill="#f4f1dc"/><circle cx="970" cy="72" r="24" fill="${P.top}" opacity="0.85"/>`);
  } else {
    parts.push(`<circle cx="${sun.x.toFixed(0)}" cy="${sun.y.toFixed(0)}" r="90" fill="url(#sunglow)"/><circle cx="${sun.x.toFixed(0)}" cy="${sun.y.toFixed(0)}" r="30" fill="${tod === 'day' ? '#fff3b0' : '#ffd38a'}"/>`);
  }
  for (let i = 0; i < 5; i++) parts.push(cloud(r, r() * W, 40 + r() * 110, 0.7 + r() * 0.6, tod));
  // Far mountains, then rolling hills with a tree line behind the grove.
  parts.push(mountains(r));
  parts.push(`<path d="M0 260 C180 200 330 215 470 245 C620 275 760 205 940 215 C1060 222 1140 240 ${W} 232 L${W} ${H} L0 ${H} Z" fill="url(#hillfar)"/>`);
  parts.push(treeline(r, 700, 1200, 262, tod === 'night' ? '#2c4a3a' : cold ? '#7f9e8c' : '#4f8a52'));
  parts.push(treeline(r, 0, 140, 270, tod === 'night' ? '#2c4a3a' : cold ? '#7f9e8c' : '#5a9659'));
  // The valley floor.
  parts.push(`<path d="M0 300 C200 270 360 290 520 300 C700 312 880 280 1050 290 C1120 294 1170 300 ${W} 298 L${W} ${H} L0 ${H} Z" fill="url(#ground)"/>`);
  // The hill (left, with the shrine) and the hollow below it.
  parts.push(`<path d="M40 340 C80 250 200 222 260 226 C330 230 390 270 430 340 Z" fill="${grass}" opacity="0.9"/><path d="M60 340 C120 290 210 268 250 270 C320 275 370 300 410 340 Z" fill="${near}" opacity="0.35"/>`);
  parts.push(`<path d="M150 250 C190 270 205 300 230 340" stroke="#d9c9a0" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.7"/>`);
  parts.push(`<ellipse cx="${ZONES.hollow.cx}" cy="${ZONES.hollow.cy + 8}" rx="${ZONES.hollow.rx}" ry="${ZONES.hollow.ry * 0.9}" fill="url(#hollowdip)"/>`);
  // Pond site: soft mud until the pond is dug (the pond itself is an object).
  parts.push(`<ellipse cx="915" cy="445" rx="80" ry="26" fill="#9c8a62" opacity="${wet ? 0.45 : 0.25}"/>`);
  // Sandy banks, then the river with moving shimmer.
  parts.push(`<path d="${rp}" stroke="#d9c79d" stroke-width="66" fill="none" stroke-linecap="round" opacity="0.85"/>`);
  parts.push(`<path d="${rp}" stroke="#c8b386" stroke-width="54" fill="none" stroke-linecap="round" opacity="0.6"/>`);
  parts.push(`<path d="${rp}" stroke="url(#water)" stroke-width="40" fill="none" stroke-linecap="round"/>`);
  parts.push(`<path d="${rp}" stroke="#a9d6f2" stroke-width="12" fill="none" stroke-linecap="round" opacity="0.5" transform="translate(0 -7)"/>`);
  parts.push(`<path class="shimmer" d="${rp}" stroke="#ffffff" stroke-width="2.5" fill="none" stroke-dasharray="14 46" opacity="0.7" transform="translate(0 -4)"/>`);
  parts.push(`<path class="shimmer slow" d="${rp}" stroke="#ffffff" stroke-width="2" fill="none" stroke-dasharray="6 70" opacity="0.5" transform="translate(0 8)"/>`);
  for (let i = 0; i < 40; i++) {
    const x = r() * W, side = r() < 0.5 ? -1 : 1;
    parts.push(`<ellipse cx="${x.toFixed(0)}" cy="${(riverY(x) + side * (24 + r() * 8)).toFixed(0)}" rx="${(2 + r() * 3).toFixed(1)}" ry="${(1.5 + r() * 1.5).toFixed(1)}" fill="#a69a80"/>`);
  }
  // Wet ground darkens after rain.
  if (wet) parts.push(`<rect y="290" width="${W}" height="${H - 290}" fill="#4a3a20" opacity="0.08"/>`);
  // Texture: grass tufts and wildflowers.
  parts.push(tufts(r, 170, tod === 'night' ? '#2f5a3c' : cold ? '#8eaa98' : '#5f9a52'));
  if (!cold) parts.push(flowers(r, tod === 'night' ? 30 : 70));
  // Foreground grass for depth.
  let fg = '';
  for (let x = -10; x < W + 20; x += 14 + r() * 10) fg += `<path d="M${x.toFixed(0)} ${H} q4 -${(24 + r() * 26).toFixed(0)} ${(8 + r() * 6).toFixed(0)} -${(30 + r() * 26).toFixed(0)} q-2 ${(20).toFixed(0)} 4 30 Z"/>`;
  parts.push(`<g fill="${tod === 'night' ? '#203f2c' : cold ? '#7d9a88' : '#4e8746'}" opacity="0.9">${fg}</g>`);
  return parts.join('');
}

// Light over everything (tint, vignette, fireflies at night, frost in a cold snap).
export function lightSVG(seed, { hour = 12, season = 'mild', painted = false } = {}) {
  const tod = timeOfDay(hour);
  const P = TIMES[tod];
  const r = rngFor(seed, 'light');
  // The painting already carries its own colour grade and vignette.
  let s = painted ? `<rect width="${W}" height="${H}" fill="${tod === 'night' ? 'rgba(20,30,80,0.18)' : 'rgba(0,0,0,0)'}" pointer-events="none"/>` : `<rect width="${W}" height="${H}" fill="${P.tint}" pointer-events="none"/>`;
  if (tod === 'night') {
    for (let i = 0; i < 18; i++) s += `<circle class="firefly" style="animation-delay:-${(r() * 6).toFixed(1)}s" cx="${(r() * W).toFixed(0)}" cy="${(300 + r() * 300).toFixed(0)}" r="2.2" fill="#fff59a"/>`;
  }
  if (season === 'cold') {
    s += `<rect width="${W}" height="${H}" fill="#dceeff" opacity="0.18" pointer-events="none"/>`;
    for (let i = 0; i < 60; i++) s += `<circle class="snow" style="animation-delay:-${(r() * 8).toFixed(1)}s;animation-duration:${(6 + r() * 6).toFixed(1)}s" cx="${(r() * W).toFixed(0)}" cy="-10" r="${(1.5 + r() * 2).toFixed(1)}" fill="#fff"/>`;
  }
  if (!painted) s += `<rect width="${W}" height="${H}" fill="url(#vignette)" pointer-events="none"/>`;
  return s;
}

// The moving parts drawn over the painted valley: drifting clouds, river
// shimmer and a few twinkling stars. (The painting itself is painter.js.)
export function sceneOverlaySVG(seed, { hour = 12 } = {}) {
  const tod = timeOfDay(hour);
  const r = rngFor(seed, 'overlay');
  const parts = [];
  if (tod === 'night') {
    for (let i = 0; i < 30; i++) parts.push(`<circle class="star" style="animation-delay:-${(r() * 4).toFixed(1)}s" cx="${(r() * W).toFixed(0)}" cy="${(r() * 200).toFixed(0)}" r="${(r() * 1.3 + 0.6).toFixed(1)}" fill="#fff"/>`);
  }
  for (let i = 0; i < 5; i++) parts.push(cloud(r, r() * W, 40 + r() * 110, 0.7 + r() * 0.6, tod));
  const rp = riverPath();
  parts.push(`<path class="shimmer" d="${rp}" stroke="#ffffff" stroke-width="2.5" fill="none" stroke-dasharray="14 46" opacity="0.6" transform="translate(0 -4)"/>`);
  parts.push(`<path class="shimmer slow" d="${rp}" stroke="#ffffff" stroke-width="2" fill="none" stroke-dasharray="6 70" opacity="0.45" transform="translate(0 8)"/>`);
  return parts.join('');
}

// Ambient life: butterflies and pollen by day, birds overhead, leaves
// drifting down from the grove. CSS-animated, never touches the sim.
export function ambientSVG(seed, { hour = 12, season = 'mild', rain = false } = {}) {
  const tod = timeOfDay(hour);
  if (tod === 'night') return '';
  const r = rngFor(seed, 'ambient');
  const parts = [];
  const mote = tod === 'day' ? '#fffbe0' : '#ffd79a';
  for (let i = 0; i < 26; i++) {
    parts.push(`<circle class="mote" style="animation-delay:-${(r() * 9).toFixed(1)}s;animation-duration:${(7 + r() * 6).toFixed(1)}s" cx="${(r() * W).toFixed(0)}" cy="${(300 + r() * 280).toFixed(0)}" r="${(1 + r() * 1.4).toFixed(1)}" fill="${mote}"/>`);
  }
  if (!rain && season !== 'cold') {
    const cols = ['#ffd24a', '#ff8fb8', '#9fd0ff', '#ffffff'];
    for (let i = 0; i < 4; i++) {
      const x = 200 + r() * 800, y = 330 + r() * 160, c = cols[i % cols.length];
      parts.push(`<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)})"><g class="butterfly b${i % 3}" style="animation-delay:-${(r() * 12).toFixed(1)}s"><g class="wings"><path d="M0 0 Q-7 -8 -9 -2 Q-8 3 0 0 Z" fill="${c}"/><path d="M0 0 Q7 -8 9 -2 Q8 3 0 0 Z" fill="${c}"/></g><rect x="-0.6" y="-3" width="1.2" height="5" rx="0.6" fill="#3a2a20"/></g></g>`);
    }
  }
  for (let i = 0; i < 3; i++) {
    parts.push(`<g transform="translate(0 ${(60 + r() * 90).toFixed(0)})"><g class="bird" style="animation-delay:-${(r() * 40).toFixed(1)}s;animation-duration:${(34 + r() * 20).toFixed(0)}s"><path class="flap" d="M-7 0 Q-3 -4 0 0 Q3 -4 7 0" stroke="#3a3a48" stroke-width="1.6" fill="none" stroke-linecap="round"/></g></g>`);
  }
  if (season !== 'cold') {
    for (let i = 0; i < 6; i++) {
      const x = 760 + r() * 400;
      parts.push(`<g transform="translate(${x.toFixed(0)} ${(250 + r() * 30).toFixed(0)})"><path class="leaf" style="animation-delay:-${(r() * 10).toFixed(1)}s;animation-duration:${(8 + r() * 5).toFixed(1)}s" d="M0 0 Q3 -3 6 0 Q3 3 0 0 Z" fill="${r() < 0.5 ? '#7fb64e' : '#c9a23a'}"/></g>`);
    }
  }
  return parts.join('');
}
