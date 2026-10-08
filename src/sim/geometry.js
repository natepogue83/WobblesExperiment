// geometry.js — fixed world geometry. Single source of truth for coordinates.
// Zones and slots NEVER move at runtime; a returning Keeper must instantly
// recognize the same valley. Shared by sim (zones, adjacency, slots) and
// render (coordinates).

export const VIEW = { w: 1200, h: 675, horizonY: 210 };

// Each zone: center, rough ellipse for rendering and placement, fixed slots,
// and features (things that are always there and are not objects).
export const ZONES = {
  hill: {
    name: 'the hill', cx: 230, cy: 290, rx: 170, ry: 70,
    features: ['shrine'], shrine: { x: 230, y: 250 },
    slots: [[170, 280], [235, 300], [300, 285], [205, 320], [270, 325], [345, 305], [120, 318]]
  },
  grove: {
    name: 'the grove', cx: 900, cy: 300, rx: 190, ry: 70,
    features: [],
    slots: [[790, 300], [860, 280], [930, 305], [1000, 285], [880, 335], [960, 340], [1070, 320]]
  },
  meadow: {
    name: 'the meadow', cx: 600, cy: 405, rx: 210, ry: 70,
    features: [],
    slots: [[480, 395], [560, 380], [640, 395], [720, 410], [530, 440], [660, 445], [420, 432], [595, 472], [780, 430], [470, 470]]
  },
  hollow: {
    name: 'the hollow', cx: 250, cy: 470, rx: 170, ry: 70,
    features: [],
    slots: [[160, 460], [230, 445], [300, 465], [195, 505], [275, 510], [110, 490], [350, 495]]
  },
  pondsite: {
    name: 'the pond site', cx: 930, cy: 450, rx: 130, ry: 55,
    features: [],
    slots: [[880, 445], [950, 430], [990, 470], [905, 485], [1060, 430], [1050, 495]]
  },
  riverbank: {
    name: 'the riverbank', cx: 600, cy: 540, rx: 420, ry: 40,
    features: ['river'],
    slots: [[330, 548], [470, 540], [610, 555], [750, 545], [890, 556], [1010, 548], [190, 556], [400, 552]]
  }
};

// Sorted, so iterating zones is always in the same order.
export const ZONE_IDS = Object.keys(ZONES).sort();

export const ADJACENT = {
  hill: ['grove', 'hollow', 'meadow'],
  grove: ['hill', 'meadow', 'riverbank'],
  meadow: ['grove', 'hill', 'hollow', 'pondsite', 'riverbank'],
  hollow: ['hill', 'meadow'],
  pondsite: ['meadow', 'riverbank'],
  riverbank: ['grove', 'meadow', 'pondsite']
};

// Graves are not slotted; they line up in rows on the far side of the hill.
export const GRAVEYARD = { x: 70, y: 250, dx: 16, dy: 14, perRow: 6 };

// River polyline for the renderer (south edge, west to east).
export const RIVER = [[0, 600], [250, 590], [520, 610], [800, 588], [1050, 605], [1200, 595]];

// "meadow.2" -> { zone: "meadow", index: 1, x, y }. 1-based in ids.
export function slotInfo(slotId) {
  if (typeof slotId !== 'string') return null;
  const dot = slotId.indexOf('.');
  if (dot < 0) return null;
  const zone = slotId.slice(0, dot);
  const n = Number(slotId.slice(dot + 1));
  const z = ZONES[zone];
  if (!z || !Number.isInteger(n) || n < 1 || n > z.slots.length) return null;
  const [x, y] = z.slots[n - 1];
  return { zone, index: n - 1, x, y };
}

export function slotIds(zone) {
  return ZONES[zone].slots.map((_, i) => zone + '.' + (i + 1));
}

export const ALL_SLOTS = ZONE_IDS.flatMap(slotIds);

export function isAdjacent(a, b) { return a === b || ADJACENT[a].includes(b); }
