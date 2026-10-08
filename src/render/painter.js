// painter.js — paints the valley like a digital painting, once, onto a canvas.
// Browser only (uses <canvas>); the result is cached per time of day, season
// and wet ground, and shown as an <image> behind everything. Deterministic per
// seed (rngFor), so a colony always has the same valley. The geometry matches
// geometry.js exactly, so objects and Wobblins sit where the painting says.
import { VIEW, ZONES, RIVER } from '../sim/geometry.js';
import { rngFor } from '../sim/rng.js';

const W = VIEW.w, H = VIEW.h;
const SCALE = 2;                       // paint at 2x for crisp screens

// ---- palettes -----------------------------------------------------------------
const PAL = {
  day: {
    skyTop: '#5fb3ec', skyBot: '#d9f1fb', sun: '#fff4c2', haze: 'rgba(214,236,250,0.55)',
    mtnFar: '#a5bfd8', mtnNear: '#8aa9c6', mtnLight: '#d8e6f2', snow: '#f7fbff',
    hillFar: '#87b96d', hillMid: '#6fa95a', ground: '#8fca6b', groundDark: '#5d9a49', groundLight: '#b8e08a',
    tree: ['#2f6b3a', '#3f8546', '#5aa553', '#86c26a'], trunk: '#6b4a30',
    sand: '#e2cf9c', sandDark: '#c3ab78', water: '#3d8dc7', waterLight: '#9ad0f2', waterDark: '#2a6898',
    shadow: 'rgba(30,60,40,0.28)', light: 'rgba(255,248,210,0.35)', grade: null
  },
  dawn: {
    skyTop: '#f1a17f', skyBot: '#ffe1b5', sun: '#ffd9a0', haze: 'rgba(255,214,180,0.5)',
    mtnFar: '#b8a6c4', mtnNear: '#9a8eb3', mtnLight: '#f2cdb8', snow: '#ffeede',
    hillFar: '#8fae78', hillMid: '#77a464', ground: '#93c46e', groundDark: '#5f9450', groundLight: '#c6dc8e',
    tree: ['#355f3c', '#466f44', '#68934f', '#a6b86a'], trunk: '#6b4a30',
    sand: '#ebcf9f', sandDark: '#c9a979', water: '#5a8fc0', waterLight: '#f2c4a8', waterDark: '#3a6694',
    shadow: 'rgba(60,40,60,0.28)', light: 'rgba(255,200,150,0.35)', grade: 'rgba(255,170,120,0.12)'
  },
  dusk: {
    skyTop: '#d6676a', skyBot: '#ffc887', sun: '#ffbf72', haze: 'rgba(255,190,150,0.5)',
    mtnFar: '#a487ad', mtnNear: '#8a6f9c', mtnLight: '#f0b394', snow: '#ffe1d0',
    hillFar: '#7c9b62', hillMid: '#6a9056', ground: '#86b464', groundDark: '#557f45', groundLight: '#c7c779',
    tree: ['#2f4f35', '#41613f', '#5f8549', '#a9a85f'], trunk: '#5c3d28',
    sand: '#e6c08f', sandDark: '#c0966b', water: '#5f7fb8', waterLight: '#ffb98a', waterDark: '#3b558a',
    shadow: 'rgba(60,30,50,0.3)', light: 'rgba(255,170,110,0.35)', grade: 'rgba(255,120,70,0.14)'
  },
  night: {
    skyTop: '#0b1430', skyBot: '#2c3968', sun: '#f4f1dc', haze: 'rgba(60,80,130,0.45)',
    mtnFar: '#323f66', mtnNear: '#29365a', mtnLight: '#4a5a86', snow: '#a9b6d8',
    hillFar: '#2c4a43', hillMid: '#25423a', ground: '#2f5443', groundDark: '#1e3a2f', groundLight: '#46705a',
    tree: ['#132a22', '#1b382c', '#284c3a', '#3c6650'], trunk: '#2b2020',
    sand: '#5f6a74', sandDark: '#454f5a', water: '#1f3760', waterLight: '#5f78b0', waterDark: '#142545',
    shadow: 'rgba(5,10,30,0.4)', light: 'rgba(160,180,255,0.12)', grade: 'rgba(20,30,80,0.25)'
  }
};

function todOf(hour) {
  if (hour < 5 || hour >= 21) return 'night';
  if (hour < 7.5) return 'dawn';
  if (hour < 18) return 'day';
  return 'dusk';
}

function frost(pal) {
  // A cold snap: pale, blue-shifted greens with snow on the ground.
  return { ...pal, ground: '#c9dcd2', groundDark: '#9fb8ae', groundLight: '#eef6f2', hillFar: '#b4c9c0', hillMid: '#a3bbb1',
    tree: ['#4d6b62', '#5f7d72', '#86a097', '#d8e6e2'], water: '#7fa9c9', waterLight: '#dff0fb' };
}

// ---- helpers -------------------------------------------------------------------
function riverY(x) {
  for (let i = 1; i < RIVER.length; i++) {
    const [x0, y0] = RIVER[i - 1], [x1, y1] = RIVER[i];
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0), s = t * t * (3 - 2 * t);       // smooth like the SVG curve
      return y0 + (y1 - y0) * s;
    }
  }
  return RIVER[RIVER.length - 1][1];
}

function mix(a, b, t) {
  const pa = parseHex(a), pb = parseHex(b);
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
function parseHex(h) {
  if (h.startsWith('rgb')) return h.match(/\d+/g).slice(0, 3).map(Number);
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function jitter(hex, r, amt) {
  const p = parseHex(hex).map(v => Math.max(0, Math.min(255, Math.round(v + (r() - 0.5) * amt))));
  return `rgb(${p[0]},${p[1]},${p[2]})`;
}

function blob(ctx, x, y, rx, ry, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function softBlob(ctx, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

// A mountain range: a jagged ridgeline (tent-shaped peaks plus fractal
// noise), a top-lit gradient, sunlit faces, gully strokes, snowcaps and haze.
function paintRange(ctx, r, base, hMin, hMax, col, P, sunX, snowFrac) {
  const peaks = [];
  for (let x = -60; x < W + 120; ) { const w = 150 + r() * 190; peaks.push({ px: x + w * 0.5, w, h: hMin + r() * (hMax - hMin) }); x += w * (0.45 + r() * 0.35); }
  const ph = [r() * 9, r() * 9, r() * 9];
  const heightAt = x => {
    let y = 0;
    for (const p of peaks) y = Math.max(y, p.h * Math.pow(Math.max(0, 1 - Math.abs(x - p.px) / (p.w * 0.5)), 0.85));
    const n = Math.sin(x * 0.045 + ph[0]) * 4 + Math.sin(x * 0.11 + ph[1]) * 2.2 + Math.sin(x * 0.27 + ph[2]) * 1.1;
    return Math.max(0, y + n * (0.4 + y / hMax));
  };
  const pts = [];
  for (let x = -40; x <= W + 40; x += 4) pts.push([x, base - heightAt(x)]);
  const outline = () => { ctx.beginPath(); ctx.moveTo(-40, H); for (const [x, y] of pts) ctx.lineTo(x, y); ctx.lineTo(W + 40, H); ctx.closePath(); };
  // Body: lighter up top, sinking into haze.
  const top = base - hMax - 10;
  let g = ctx.createLinearGradient(0, top, 0, base + 20);
  g.addColorStop(0, mix(col, P.mtnLight, 0.25)); g.addColorStop(0.6, col); g.addColorStop(1, mix(col, P.skyBot, 0.35));
  ctx.fillStyle = g; outline(); ctx.fill();
  ctx.save(); outline(); ctx.clip();
  for (const p of peaks) {
    const py = base - heightAt(p.px), side = sunX > p.px ? 1 : -1;
    // Sunlit face: from the peak down the sun-side slope.
    ctx.globalAlpha = 0.38; ctx.fillStyle = P.mtnLight;
    ctx.beginPath(); ctx.moveTo(p.px, py);
    for (let k = 1; k <= 10; k++) { const x = p.px + side * p.w * 0.5 * (k / 10); ctx.lineTo(x, base - heightAt(x) + 2); }
    ctx.lineTo(p.px + side * p.w * 0.16, base + 10); ctx.lineTo(p.px + side * 4, base + 10); ctx.closePath(); ctx.fill();
    // Shadowed face, softly.
    ctx.globalAlpha = 0.16; ctx.fillStyle = mix(col, '#1a2238', 0.5);
    ctx.beginPath(); ctx.moveTo(p.px, py);
    for (let k = 1; k <= 10; k++) { const x = p.px - side * p.w * 0.5 * (k / 10); ctx.lineTo(x, base - heightAt(x) + 2); }
    ctx.lineTo(p.px - side * p.w * 0.1, base + 10); ctx.closePath(); ctx.fill();
    // Gullies: thin strokes running down from the ridge.
    ctx.globalAlpha = 0.22; ctx.strokeStyle = mix(col, '#1a2238', 0.35); ctx.lineWidth = 1.4;
    for (let k = 0; k < 5; k++) {
      const x0 = p.px + (r() - 0.5) * p.w * 0.55, y0 = base - heightAt(x0) + 4;
      ctx.beginPath(); ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x0 + (r() - 0.5) * 18, y0 + 20 + r() * 20, x0 + (r() - 0.5) * 30, y0 + 40 + r() * 40); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Snow on the tall ones: follows the ridge, ragged at the bottom.
    if (p.h > hMax * (1 - snowFrac)) {
      const depth = 16 + (p.h - hMax * (1 - snowFrac)) * 0.35;
      ctx.fillStyle = P.snow; ctx.globalAlpha = 0.95;
      ctx.beginPath();
      const xs = []; for (let x = p.px - p.w * 0.22; x <= p.px + p.w * 0.22; x += 4) xs.push(x);
      ctx.moveTo(xs[0], base - heightAt(xs[0]));
      for (const x of xs) ctx.lineTo(x, base - heightAt(x) - 1);
      for (let i = xs.length - 1; i >= 0; i--) {
        const x = xs[i], edge = 1 - Math.abs(x - p.px) / (p.w * 0.22);
        ctx.lineTo(x, base - heightAt(x) + depth * edge * (0.55 + 0.45 * Math.abs(Math.sin(x * 0.35 + ph[0]))));
      }
      ctx.closePath(); ctx.fill();
      // A shadow tint on the snow's far side.
      ctx.globalAlpha = 0.18; ctx.fillStyle = '#7f93b8';
      ctx.beginPath(); ctx.moveTo(p.px, base - heightAt(p.px));
      for (let k = 0; k <= 8; k++) { const x = p.px - side * p.w * 0.22 * (k / 8); ctx.lineTo(x, base - heightAt(x) + depth * (1 - k / 8) * 0.8); }
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
  // Haze settling at the foot of the range.
  g = ctx.createLinearGradient(0, base - 120, 0, base + 30);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, P.haze);
  ctx.fillStyle = g; ctx.fillRect(0, base - 120, W, 160);
}

// A painterly ridge: fill below a wobbly line, with brush texture on top.
function ridge(ctx, r, y0, amp, freq, fill, opts = {}) {
  const pts = [];
  let phase = r() * 10;
  for (let x = -20; x <= W + 20; x += 8) {
    const y = y0 + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.7 + phase * 2) * amp * 0.35 + (opts.bump ? opts.bump(x) : 0);
    pts.push([x, y]);
  }
  ctx.beginPath();
  ctx.moveTo(-20, H + 20);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.lineTo(W + 20, H + 20);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  return pts;
}

function grassStroke(ctx, x, y, len, lean, width, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + lean * 0.4, y - len * 0.6, x + lean, y - len);
  ctx.stroke();
}

function paintTree(ctx, r, x, y, h, P, sunX) {
  const trunkH = h * 0.38, w = h * 0.42;
  // Trunk.
  ctx.fillStyle = P.trunk;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.09, y);
  ctx.quadraticCurveTo(x - w * 0.05, y - trunkH * 0.6, x - w * 0.03, y - trunkH);
  ctx.lineTo(x + w * 0.03, y - trunkH);
  ctx.quadraticCurveTo(x + w * 0.05, y - trunkH * 0.6, x + w * 0.09, y);
  ctx.fill();
  // Canopy: dark core, mid tones, then sunlit clusters toward the sun.
  const cx = x, cy = y - trunkH - h * 0.28;
  const toSun = Math.sign(sunX - x) || -1;
  const n = 14 + Math.floor(r() * 8);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r());
    blob(ctx, cx + Math.cos(a) * w * 0.55 * d, cy + Math.sin(a) * h * 0.3 * d, w * (0.22 + r() * 0.12), h * (0.16 + r() * 0.08), jitter(P.tree[0], r, 14));
  }
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.8;
    blob(ctx, cx + Math.cos(a) * w * 0.5 * d + toSun * w * 0.06, cy + Math.sin(a) * h * 0.26 * d - h * 0.05, w * (0.18 + r() * 0.1), h * (0.12 + r() * 0.07), jitter(P.tree[1], r, 16));
  }
  for (let i = 0; i < n * 0.7; i++) {
    const a = -Math.PI / 2 + toSun * (0.2 + r() * 1.1), d = 0.4 + r() * 0.5;
    blob(ctx, cx + Math.cos(a) * w * 0.5 * d, cy + Math.sin(a) * h * 0.28 * d, w * (0.1 + r() * 0.08), h * (0.07 + r() * 0.05), jitter(P.tree[2], r, 18));
  }
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + toSun * (0.3 + r() * 0.8), d = 0.6 + r() * 0.35;
    blob(ctx, cx + Math.cos(a) * w * 0.5 * d, cy + Math.sin(a) * h * 0.28 * d, w * 0.06, h * 0.04, P.tree[3], 0.8);
  }
}

function paintRock(ctx, r, x, y, s, P) {
  blob(ctx, x + s * 0.2, y + s * 0.25, s * 1.1, s * 0.35, P.shadow, 0.6);
  ctx.fillStyle = jitter('#8e8a80', r, 20);
  ctx.beginPath();
  ctx.moveTo(x - s, y);
  ctx.quadraticCurveTo(x - s * 0.9, y - s * 0.9, x - s * 0.1, y - s);
  ctx.quadraticCurveTo(x + s * 0.9, y - s * 0.8, x + s, y);
  ctx.closePath();
  ctx.fill();
  blob(ctx, x - s * 0.35, y - s * 0.6, s * 0.35, s * 0.18, 'rgba(255,255,255,0.35)');
}

// ---- the painting ----------------------------------------------------------------
export function paintValley(canvas, seed, { hour = 12, season = 'mild', wet = false } = {}) {
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.lineCap = 'round';
  const tod = todOf(hour);
  let P = PAL[tod];
  if (season === 'cold') P = frost(P);
  const r = rngFor(seed, 'paint');
  const f = Math.max(0, Math.min(1, (hour - 6) / 14));
  const sun = { x: 80 + f * 1040, y: 175 - Math.sin(f * Math.PI) * 125 };
  const sunX = tod === 'night' ? 960 : sun.x;

  // Sky.
  let g = ctx.createLinearGradient(0, 0, 0, 300);
  g.addColorStop(0, P.skyTop); g.addColorStop(1, P.skyBot);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (tod === 'night') {
    for (let i = 0; i < 160; i++) blob(ctx, r() * W, r() * 230, r() * 1.2 + 0.3, r() * 1.2 + 0.3, '#ffffff', 0.4 + r() * 0.6);
    softBlob(ctx, 960, 80, 120, 'rgba(220,230,255,0.35)', 1);
    blob(ctx, 960, 80, 24, 24, '#f4f1dc');
    blob(ctx, 968, 74, 21, 21, P.skyTop, 0.75);
  } else {
    softBlob(ctx, sun.x, sun.y, 260, P.sun, 0.55);
    softBlob(ctx, sun.x, sun.y, 90, '#ffffff', 0.6);
    blob(ctx, sun.x, sun.y, 26, 26, '#fffbe6');
  }
  // Wispy high clouds painted into the sky (the drifting ones are animated on top).
  for (let i = 0; i < 7; i++) {
    const cx = r() * W, cy = 40 + r() * 120, len = 120 + r() * 200;
    for (let k = 0; k < 18; k++) blob(ctx, cx + (k / 18 - 0.5) * len, cy + Math.sin(k) * 4, 26 + r() * 22, 6 + r() * 6, tod === 'night' ? '#6a75a0' : '#ffffff', 0.08);
  }

  // Far mountains with haze: jagged ridges, sunlit faces, snow and gullies.
  const rm = rngFor(seed, 'mountains');
  paintRange(ctx, rm, 222, 70, 165, P.mtnFar, P, sunX, 0.55);
  paintRange(ctx, rm, 242, 55, 120, P.mtnNear, P, sunX, 0.25);

  // Rolling far hills and a dense forest behind the grove.
  ridge(ctx, r, 252, 14, 0.006, P.hillFar);
  for (let x = 680; x < W + 40; x += 18 + r() * 14) paintTree(ctx, r, x, 262 + r() * 10, 50 + r() * 34, { ...P, tree: P.tree.map(c => mix(c, P.hillFar, 0.35)) }, sunX);
  for (let x = -20; x < 150; x += 20 + r() * 14) paintTree(ctx, r, x, 270 + r() * 8, 44 + r() * 30, { ...P, tree: P.tree.map(c => mix(c, P.hillFar, 0.35)) }, sunX);
  ridge(ctx, r, 285, 10, 0.008, P.hillMid);

  // The valley floor: a big gradient with soft colour patches for life.
  g = ctx.createLinearGradient(0, 280, 0, H);
  g.addColorStop(0, P.groundLight); g.addColorStop(0.35, P.ground); g.addColorStop(1, P.groundDark);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(0, 300);
  ctx.bezierCurveTo(200, 270, 360, 290, 520, 300); ctx.bezierCurveTo(700, 312, 880, 280, 1050, 290);
  ctx.bezierCurveTo(1120, 294, 1170, 300, W, 298); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  for (let i = 0; i < 90; i++) {
    const x = r() * W, y = 300 + r() * 360;
    softBlob(ctx, x, y, 40 + r() * 90, r() < 0.5 ? P.groundLight : P.groundDark, 0.18);
  }
  // Sun-dappled light pools.
  if (tod !== 'night') for (let i = 0; i < 14; i++) softBlob(ctx, r() * W, 320 + r() * 240, 60 + r() * 80, P.light, 0.5);

  // The hill (left), with a worn path up to the shrine.
  const hz = ZONES.hill;
  const hillPath = () => { ctx.beginPath(); ctx.moveTo(30, 345); ctx.bezierCurveTo(70, 250, 190, 220, 255, 224); ctx.bezierCurveTo(330, 228, 395, 270, 440, 345); ctx.closePath(); };
  g = ctx.createLinearGradient(0, 222, 0, 345);
  g.addColorStop(0, mix(P.groundLight, P.ground, 0.3)); g.addColorStop(0.5, P.ground); g.addColorStop(1, mix(P.ground, P.groundDark, 0.6));
  ctx.fillStyle = g; hillPath(); ctx.fill();
  // Light on the sun side of the hill, shade on the other.
  ctx.save(); hillPath(); ctx.clip();
  softBlob(ctx, sunX < 240 ? 150 : 330, 250, 170, P.light, 0.9);
  softBlob(ctx, sunX < 240 ? 380 : 70, 320, 160, P.shadow, 0.7);
  for (let i = 0; i < 700; i++) { const x = 30 + r() * 410, y = 225 + r() * 120; grassStroke(ctx, x, y, 3 + r() * 5, (r() - 0.5) * 4, 0.8, jitter(r() < 0.5 ? P.groundDark : P.groundLight, r, 30)); }
  ctx.restore();
  ctx.strokeStyle = P.groundLight; ctx.globalAlpha = 0.6; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(70, 268); ctx.bezierCurveTo(140, 232, 200, 222, 255, 225); ctx.bezierCurveTo(310, 228, 350, 245, 380, 268); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.strokeStyle = mix(P.sand, P.ground, 0.25); ctx.lineWidth = 8; ctx.globalAlpha = 0.75;
  ctx.beginPath(); ctx.moveTo(150, 252); ctx.bezierCurveTo(185, 272, 200, 300, 236, 344); ctx.stroke(); ctx.globalAlpha = 1;
  for (let i = 0; i < 30; i++) { const t = r(); blob(ctx, 150 + t * 86 + (r() - 0.5) * 10, 252 + t * 92, 1.5 + r() * 1.5, 1 + r(), P.sandDark, 0.7); }

  // The hollow: a sheltered dip.
  softBlob(ctx, ZONES.hollow.cx, ZONES.hollow.cy + 12, 180, P.shadow, 0.6);
  // Pond site: soft mud (darker after rain).
  softBlob(ctx, 915, 448, 110, wet ? '#6e5a3a' : '#9c8a62', wet ? 0.55 : 0.4);

  // Scattered rocks.
  for (let i = 0; i < 9; i++) {
    const x = r() * W, y = 320 + r() * 300;
    if (Math.abs(y - riverY(x)) < 45) continue;
    paintRock(ctx, r, x, y, 4 + r() * 6, P);
  }

  // River: sandy banks, deep water, sky reflections, foam at the edges.
  const band = (offset, width, color, alpha = 1) => {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.globalAlpha = alpha;
    ctx.beginPath();
    for (let x = -10; x <= W + 10; x += 6) { const y = riverY(x) + offset; x === -10 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke(); ctx.globalAlpha = 1;
  };
  band(0, 74, P.sandDark, 0.9);
  band(-2, 64, P.sand);
  band(0, 46, P.waterDark);
  band(-2, 38, P.water);
  band(-8, 12, P.waterLight, 0.55);
  band(-14, 3, '#ffffff', 0.35);
  band(18, 2.5, '#ffffff', 0.3);
  for (let i = 0; i < 70; i++) {
    const x = r() * W, side = r() < 0.5 ? -1 : 1;
    blob(ctx, x, riverY(x) + side * (26 + r() * 8), 1.5 + r() * 2.5, 1 + r() * 1.4, jitter('#9b8f76', r, 30));
  }
  for (let i = 0; i < 40; i++) {
    const x = r() * W;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x, riverY(x) - 6 + r() * 12); ctx.lineTo(x + 10 + r() * 16, riverY(x) - 6 + r() * 12); ctx.stroke();
  }

  // Grass: thousands of strokes, longer and darker toward the front.
  const greens = [P.groundDark, P.ground, P.groundLight];
  for (let i = 0; i < 5200; i++) {
    const x = r() * W, y = 295 + Math.pow(r(), 0.8) * 380;
    if (Math.abs(y - riverY(x)) < 36) continue;
    const depth = (y - 295) / 380;
    const len = 3 + depth * 9 + r() * 4;
    grassStroke(ctx, x, y, len, (r() - 0.5) * 6, 0.6 + depth * 1.1, jitter(greens[Math.floor(r() * 3)], r, 26));
  }
  // Wildflowers (not in a cold snap).
  if (season !== 'cold') {
    const cols = tod === 'night' ? ['#8a90b8', '#a29ac8'] : ['#ffffff', '#ffd2e3', '#ffe27a', '#d6c4ff', '#ff9f8a'];
    for (let i = 0; i < 220; i++) {
      const z = r() < 0.55 ? ZONES.meadow : r() < 0.5 ? ZONES.hill : ZONES.grove;
      const a = r() * Math.PI * 2, d = Math.sqrt(r());
      const x = z.cx + Math.cos(a) * z.rx * d, y = z.cy + Math.sin(a) * z.ry * d;
      const c = cols[Math.floor(r() * cols.length)];
      for (let k = 0; k < 4; k++) blob(ctx, x + Math.cos(k * 1.57) * 1.8, y + Math.sin(k * 1.57) * 1.4, 1.7, 1.4, c);
      blob(ctx, x, y, 0.9, 0.9, '#f2b632');
    }
  } else {
    for (let i = 0; i < 160; i++) softBlob(ctx, r() * W, 300 + r() * 370, 20 + r() * 40, '#ffffff', 0.35);
  }
  if (wet) { ctx.fillStyle = 'rgba(60,45,20,0.10)'; ctx.fillRect(0, 290, W, H); }

  // Foreground: tall blades and leaves framing the bottom edge.
  for (let x = -10; x < W + 20; x += 5 + r() * 6) {
    const len = 26 + r() * 46;
    grassStroke(ctx, x, H + 4, len, (r() - 0.5) * 30, 3 + r() * 3, jitter(P.groundDark, r, 20));
  }
  for (let i = 0; i < 6; i++) {
    const x = r() < 0.5 ? r() * 160 : W - r() * 160;
    ctx.fillStyle = jitter(P.tree[1], r, 16);
    ctx.beginPath(); ctx.ellipse(x, H - 10, 34 + r() * 20, 12, (r() - 0.5) * 1.4, 0, Math.PI * 2); ctx.fill();
  }

  // Colour grade and a gentle vignette.
  if (P.grade) { ctx.fillStyle = P.grade; ctx.fillRect(0, 0, W, H); }
  g = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.45, W / 2, H * 0.45, H * 1.05);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(10,20,10,0.35)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // Fine grain so it reads as paint, not flat vector.
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.035)';
    ctx.fillRect(r() * W, r() * H, 1.4, 1.4);
  }
  return canvas;
}

// Paint (or reuse) the valley; resolves to an object URL usable as <image href>.
const cache = new Map();
export function valleyImage(seed, opts) {
  const key = [seed, todOf(opts.hour), Math.round(opts.hour * 2), opts.season, !!opts.wet].join('|');
  if (cache.has(key)) return cache.get(key);
  const p = new Promise(resolve => setTimeout(() => {
    const c = document.createElement('canvas');
    paintValley(c, seed, opts);
    if (c.toBlob) c.toBlob(b => resolve(b ? URL.createObjectURL(b) : c.toDataURL('image/jpeg', 0.9)), 'image/jpeg', 0.92);
    else resolve(c.toDataURL('image/jpeg', 0.9));
  }, 0));
  cache.set(key, p);
  if (cache.size > 6) cache.delete(cache.keys().next().value);
  return p;
}
