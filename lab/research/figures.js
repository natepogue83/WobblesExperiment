// lab/research/figures.js — small, honest SVG figures for the report. No dependencies.
// Light surface, text in ink tokens, series colours from a validated palette
// (blue #2a78d6, orange #eb6834), thin marks, intervals drawn as lines.
const INK = '#0b0b0b', INK2 = '#52514e', GRID = '#e6e5e1', SURFACE = '#fcfcfb', S1 = '#2a78d6', S2 = '#eb6834';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const font = `font-family="Inter, Segoe UI, Helvetica, Arial, sans-serif"`;

// Means with 95% intervals, one row per condition, a zero line when the range crosses it.
export function dotCI({ title, unit, rows, width = 720 }) {
  const left = 190, right = 40, top = 56, rowH = 44, h = top + rows.length * rowH + 50, plotW = width - left - right;
  const vals = rows.flatMap(r => [r.ci.lo, r.ci.hi]).filter(Number.isFinite);
  let lo = Math.min(0, ...vals), hi = Math.max(0, ...vals); const pad = (hi - lo) * 0.12 || 0.1; lo -= pad; hi += pad;
  const X = v => left + (v - lo) / (hi - lo) * plotW;
  const ticks = niceTicks(lo, hi, 5);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}" ${font} font-size="13">`;
  s += `<rect width="${width}" height="${h}" fill="${SURFACE}"/>`;
  s += `<text x="${left}" y="26" font-size="15" font-weight="600" fill="${INK}">${esc(title)}</text>`;
  s += `<text x="${left}" y="44" fill="${INK2}">${esc(unit)}. Mean and 95% bootstrap interval over seeds.</text>`;
  for (const t of ticks) { s += `<line x1="${X(t)}" x2="${X(t)}" y1="${top}" y2="${h - 40}" stroke="${t === 0 ? INK2 : GRID}" stroke-width="${t === 0 ? 1.5 : 1}"/>`; s += `<text x="${X(t)}" y="${h - 22}" text-anchor="middle" fill="${INK2}">${fmtTick(t)}</text>`; }
  rows.forEach((r, i) => {
    const y = top + i * rowH + rowH / 2;
    s += `<text x="${left - 12}" y="${y + 4}" text-anchor="end" fill="${INK}">${esc(r.label)}</text>`;
    if (!Number.isFinite(r.ci.mean)) { s += `<text x="${left + 8}" y="${y + 4}" fill="${INK2}">no survivors</text>`; return; }
    s += `<line x1="${X(r.ci.lo)}" x2="${X(r.ci.hi)}" y1="${y}" y2="${y}" stroke="${S1}" stroke-width="2" stroke-linecap="round"/>`;
    s += `<circle cx="${X(r.ci.mean)}" cy="${y}" r="5" fill="${S1}" stroke="${SURFACE}" stroke-width="2"/>`;
    s += `<text x="${X(r.ci.hi) + 10}" y="${y + 4}" fill="${INK2}">${r.ci.mean.toFixed(2)}</text>`;
  });
  return s + '</svg>';
}

// Grouped bars for two series over a few categories; values as shares or counts.
export function bars({ title, unit, groups, series, pct = false, width = 720 }) {
  const left = 60, right = 30, top = 70, bottom = 60, h = 320, plotW = width - left - right, plotH = h - top - bottom;
  const max = Math.max(...series.flatMap(s => s.values)) * 1.15 || 1;
  const Y = v => top + plotH - v / max * plotH;
  const gw = plotW / groups.length, bw = Math.min(44, gw / (series.length + 1));
  const colors = [S1, S2];
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${width} ${h}" ${font} font-size="13">`;
  s += `<rect width="${width}" height="${h}" fill="${SURFACE}"/>`;
  s += `<text x="${left}" y="26" font-size="15" font-weight="600" fill="${INK}">${esc(title)}</text>`;
  s += `<text x="${left}" y="44" fill="${INK2}">${esc(unit)}</text>`;
  // legend
  series.forEach((se, i) => { const lx = width - right - 170 + i * 0; const yy = 22 + i * 16; s += `<rect x="${width - right - 150}" y="${yy - 9}" width="10" height="10" rx="2" fill="${colors[i]}"/><text x="${width - right - 134}" y="${yy}" fill="${INK}">${esc(se.name)}</text>`; });
  for (const t of niceTicks(0, max, 4)) { if (t > max) continue; s += `<line x1="${left}" x2="${width - right}" y1="${Y(t)}" y2="${Y(t)}" stroke="${GRID}"/><text x="${left - 8}" y="${Y(t) + 4}" text-anchor="end" fill="${INK2}">${pct ? Math.round(t * 100) + '%' : fmtTick(t)}</text>`; }
  groups.forEach((g, gi) => {
    const cx = left + gi * gw + gw / 2, x0 = cx - (series.length * bw + (series.length - 1) * 2) / 2;
    series.forEach((se, si) => { const v = se.values[gi], x = x0 + si * (bw + 2), y = Y(v); s += `<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(0, top + plotH - y)}" rx="3" fill="${colors[si]}"/>`; s += `<text x="${x + bw / 2}" y="${y - 6}" text-anchor="middle" fill="${INK2}" font-size="12">${pct ? (v * 100).toFixed(1) + '%' : v.toFixed(2)}</text>`; });
    s += `<text x="${cx}" y="${h - bottom + 22}" text-anchor="middle" fill="${INK}">${esc(g)}</text>`;
  });
  s += `<line x1="${left}" x2="${width - right}" y1="${top + plotH}" y2="${top + plotH}" stroke="${INK2}"/>`;
  return s + '</svg>';
}

function niceTicks(lo, hi, n) { const span = hi - lo || 1, raw = span / n, mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(st => span / st <= n + 1) || mag; const out = []; for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) out.push(+t.toFixed(6)); return out; }
function fmtTick(t) { return Math.abs(t) >= 10 ? String(Math.round(t)) : String(+t.toFixed(2)); }
