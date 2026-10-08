// painted.js — hand-painted art, when there is some. The game draws everything
// itself in vector; a painter (a person, or a style-locked image model) can
// replace any piece with a PNG and the renderer uses the painting instead.
// The manifest (art/manifest.json) says what exists. Nothing here touches the
// sim, and with no manifest the game looks exactly as before.
//
// Manifest shape (every entry optional):
// {
//   "objects": { "hut": { "src": "art/objects/hut.png", "w": 84, "h": 72, "ax": 42, "ay": 70 },
//                "bush": { "src": "...", "w": 40, "h": 36, "ax": 20, "ay": 34,
//                          "variants": { "bare": "art/objects/bush-bare.png" } } },
//   "wobblins": { "sage": { "src": "art/wobblins/body-sage.png", "w": 60, "h": 56, "ax": 30, "ay": 54 }, ... },
//   "backdrop": { "day": "art/valley-day.png", "dusk": "...", "night": "...", "dawn": "...",
//                 "cold": "art/valley-cold.png", "wet": "art/valley-wet.png" }
// }
// w/h are in the piece's own units (a Wobblin body is about 68 x 62, a hut about 80 x 66;
// the game scales them like it scales its vector art); ax/ay is the anchor, the point in
// the image that sits on the ground spot (feet for a Wobblin).
// Paint at 2x those pixel sizes or more so it stays crisp when zoomed.

let painted = { objects: {}, wobblins: {}, backdrop: {} };

export function setPainted(manifest) {
  painted = { objects: {}, wobblins: {}, backdrop: {}, ...(manifest || {}) };
}
export function paintedArt() { return painted; }
export function hasPaintedArt() {
  return Object.keys(painted.objects).length + Object.keys(painted.wobblins).length + Object.keys(painted.backdrop).length > 0;
}

function image(spec, src) {
  const href = src || spec.src;
  return `<image class="painted" href="${href}" x="${-(spec.ax ?? spec.w / 2)}" y="${-(spec.ay ?? spec.h)}" width="${spec.w}" height="${spec.h}" preserveAspectRatio="xMidYMax meet"/>`;
}

// Painted object, or null to draw it in vector. Variants pick a state, such as
// a bush with no berries or a stacked stone pile.
export function paintedObject(o) {
  const spec = painted.objects[o.kind];
  if (!spec) return null;
  const variant = objectVariant(o);
  const src = variant && spec.variants && spec.variants[variant];
  return image(spec, src);
}
function objectVariant(o) {
  const s = o.state || {};
  if (o.kind === 'bush') return (s.berries || 0) > 0 ? null : 'bare';
  if (o.kind === 'stones') return s.stacked ? 'stacked' : 'pile' + Math.min(4, Math.max(1, s.count || 1));
  if (o.kind === 'pond') return s.frozen ? 'frozen' : null;
  if (o.kind === 'hut') return s.smoke ? 'smoke' : null;
  if (o.kind === 'garden') return s.trampled !== undefined ? 'trampled' : null;
  if (o.kind === 'mural') return s.smudged !== undefined ? 'smudged' : null;
  return null;
}

// Painted body for a coat colour, or null. The game still draws the face,
// sprout, blush and accessories on top, so painted Wobblins stay alive.
export function paintedBody(coatName) {
  const spec = painted.wobblins[coatName] || painted.wobblins.any;
  return spec ? image(spec) : null;
}

// Painted valley for this light and weather, or null to paint it in code.
export function paintedBackdrop({ tod, season, wet }) {
  const b = painted.backdrop;
  if (season === 'cold' && b.cold) return b.cold;
  if (wet && b.wet) return b.wet;
  return b[tod] || b.day || null;
}
