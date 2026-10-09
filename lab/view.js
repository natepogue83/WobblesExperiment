// lab/view.js — watch the lab world live in 3D. The sim runs in the page; the
// scene is brought up to date from it every step. Click ground to put down what
// you have chosen (a glowing lump, sticks, grass, stones); click a creature to
// read what it believes. Nothing here changes the sim except the Keeper verbs.
//
// Kept cheap on purpose: one geometry and material per kind of thing, shared by
// every copy; three flame lights in all, lent to whatever burns; the story and
// the fire report read only the events that arrived since last time.
import * as THREE from 'three';
import { W, H, DAY, MATERIALS, live, isNight, objectsAt, stackHeight, covered } from './world.js';
import { newColony, step, keeperPlace } from './sim.js';
import { beliefs } from './creature.js';
import { rngFor } from '../src/sim/rng.js';
import * as P3 from './props3d.js';

const q = new URLSearchParams(location.search);
const seed = Number(q.get('seed') || 2);
const world = newColony(seed, 6);
let speedMs = 600, running = true, tool = 'ember';

// ---- scene ------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });   // so a frame can be saved as a picture
renderer.setPixelRatio(Math.min(1.5, devicePixelRatio)); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
document.body.append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#d8e9f1'); scene.fog = new THREE.Fog('#d8e9f1', 40, 90);
const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.1, 200);
let yaw = -0.2, pitch = 0.75, dist = 22;
const target = new THREE.Vector3(0, 0, 0);
function placeCamera() { camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * dist, target.y + Math.sin(pitch) * dist, target.z + Math.cos(yaw) * Math.cos(pitch) * dist); camera.lookAt(target); }
placeCamera();
const hemi = new THREE.HemisphereLight('#dff0ff', '#6b7a3a', 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1d6', 2.0); sun.position.set(-12, 20, 10); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 12, bottom: -12, near: 1, far: 60 }); sun.shadow.bias = -0.0008; scene.add(sun);
const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95, ...extra });
const CELL = 1.0;
const X = x => (x - W / 2 + 0.5) * CELL, Z = y => (y - H / 2 + 0.5) * CELL;

// Ground: one smooth, rolling sheet. Hills from layered noise, banks that slope down into
// the river with a sandy lip, the stony corner rising a little, and colours that drift
// between two greens instead of changing per tile. Cells still tint it (wet, warm, covered),
// blended across their corners so nothing shows as a block. Invisible tiles sit on top for picking.
const tiles = [];
const SUB = 6;   // vertices per cell edge
const groundGeo = new THREE.PlaneGeometry(W * CELL, H * CELL, W * SUB, H * SUB);
groundGeo.rotateX(-Math.PI / 2);
const VCOUNT = groundGeo.attributes.position.count;
const groundColors = new Float32Array(VCOUNT * 3);
groundGeo.setAttribute('color', new THREE.BufferAttribute(groundColors, 3));
const vertexCell = new Int32Array(VCOUNT);          // which cell each vertex belongs to
const vertexBlend = [];                               // per vertex: the four nearest cells and their weights
const baseColors = new Float32Array(VCOUNT * 3);     // the ground's own colour, before the cells tint it
const vertexLand = new Float32Array(VCOUNT);         // 1 on land, 0 in the water, sloping between
const targetColors = new Float32Array(VCOUNT * 3);
// Seeded value noise: a lattice of random heights, smoothly interpolated.
const NOISE = (() => { const r = rngFor(seed, 'noise'), n = 64, t = new Float32Array(n * n); for (let i = 0; i < t.length; i++) t[i] = r(); return (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const at = (i, j) => t[((j % n + n) % n) * n + ((i % n + n) % n)];
  return (at(xi, yi) * (1 - sx) + at(xi + 1, yi) * sx) * (1 - sy) + (at(xi, yi + 1) * (1 - sx) + at(xi + 1, yi + 1) * sx) * sy; }; })();
const noise2 = (x, y) => NOISE(x, y) * 0.65 + NOISE(x * 2.3 + 11, y * 2.3 + 7) * 0.35;
// Distance from a point (in cell units) to the nearest cell of a kind.
function nearest(fx, fz, test) { let best = 9; for (const c of world.cells) if (test(c)) { const dx = Math.max(0, Math.abs(fx - c.x) - 0.5), dz = Math.max(0, Math.abs(fz - c.y) - 0.5); best = Math.min(best, Math.hypot(dx, dz)); } return best; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const G_LIGHT = new THREE.Color('#b4cc72'), G_DARK = new THREE.Color('#86aa58'), G_MOSS = new THREE.Color('#6f9a4e'), SAND = new THREE.Color('#d8c590'), STONY = new THREE.Color('#a39d93'), STONY_DARK = new THREE.Color('#8b857c'), BED = new THREE.Color('#6b7c5a');
{
  const pos = groundGeo.attributes.position, _k = new THREE.Color();
  for (let i = 0; i < VCOUNT; i++) {
    const fx = pos.getX(i) / CELL + W / 2 - 0.5, fz = pos.getZ(i) / CELL + H / 2 - 0.5;   // cell coordinates, centre of cell (x,y) at (x,y)
    const cx = Math.min(W - 1, Math.max(0, Math.round(fx))), cy = Math.min(H - 1, Math.max(0, Math.round(fz)));
    vertexCell[i] = cy * W + cx;
    const x0 = Math.floor(fx), z0 = Math.floor(fz), tx = fx - x0, tz = fz - z0, bl = [];
    for (const [dx, dz, wgt] of [[0, 0, (1 - tx) * (1 - tz)], [1, 0, tx * (1 - tz)], [0, 1, (1 - tx) * tz], [1, 1, tx * tz]]) {
      const xx = Math.min(W - 1, Math.max(0, x0 + dx)), zz = Math.min(H - 1, Math.max(0, z0 + dz));
      if (wgt > 0.001) bl.push([zz * W + xx, wgt]);
    }
    vertexBlend.push(bl);
    const dWater = nearest(fx, fz, c => c.water), dStony = nearest(fx, fz, c => c.stony);
    const land = smooth(0, 0.9, dWater + noise2(fx * 0.9, fz * 0.9) * 0.25 - 0.12);
    const stony = 1 - smooth(0, 1.1, dStony + (noise2(fx * 1.3 + 5, fz * 1.3) - 0.5) * 0.6);
    vertexLand[i] = land;
    const hills = (noise2(fx * 0.35, fz * 0.35) - 0.5) * 0.28 + (noise2(fx * 1.1 + 3, fz * 1.1 + 9) - 0.5) * 0.06;
    let y = hills + stony * 0.14;
    const edge = Math.min(fx + 0.5, W - 0.5 - fx, fz + 0.5, H - 0.5 - fz);
    if (edge < 0.6) y = Math.max(y, -0.02) * smooth(0, 0.6, edge) + 0.0 * (1 - smooth(0, 0.6, edge));   // flat and a little high at the rim
    y = -0.42 * (1 - land) + y * land;
    pos.setY(i, y);
    // colour: grass drifting between two greens with mossy patches, stony where it is stony, sand at the lip, dark bed under water
    const g1 = noise2(fx * 0.5 + 20, fz * 0.5 + 4), g2 = noise2(fx * 1.7 + 40, fz * 1.7 + 2);
    _k.copy(G_DARK).lerp(G_LIGHT, g1).lerp(G_MOSS, Math.max(0, g2 - 0.62) * 1.6);
    _k.lerp(STONY.clone().lerp(STONY_DARK, g2), stony);
    const sandy = smooth(0.08, 0.5, land) * (1 - smooth(0.5, 1.0, land));
    _k.lerp(SAND, sandy * 0.85);
    _k.lerp(BED, 1 - smooth(0, 0.12, land));
    baseColors[i * 3] = _k.r; baseColors[i * 3 + 1] = _k.g; baseColors[i * 3 + 2] = _k.b;
  }
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  ground.receiveShadow = true; scene.add(ground);
  // the water: a glassy sheet lying in the river bed
  const waterGeo = new THREE.PlaneGeometry(W * CELL, H * CELL, 1, 1); waterGeo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({ color: '#4f9bd2', transparent: true, opacity: 0.78, roughness: 0.25, metalness: 0.05 }));
  water.position.y = -0.16; water.receiveShadow = true; scene.add(water);
  const pickGeo = new THREE.PlaneGeometry(CELL, CELL); pickGeo.rotateX(-Math.PI / 2);
  const pickMat = new THREE.MeshBasicMaterial({ visible: false });
  for (const c of world.cells) { const m = new THREE.Mesh(pickGeo, pickMat); m.position.set(X(c.x), 0.02, Z(c.y)); m.userData.cell = c; scene.add(m); tiles.push(m); }
  // the rim: four walls of earth round the board and a slab beneath it, with a darker topsoil
  // band and paler clay below. A frame, not a block, so the river bed stays open.
  const soil = new THREE.Color('#7a5538'), clay = new THREE.Color('#a3886a'), top = new THREE.Color('#6b4a30');
  function earth(w, h, d, x, y, z) {
    const geo = new THREE.BoxGeometry(w, h, d).toNonIndexed(), rp = geo.attributes.position, rc = new Float32Array(rp.count * 3);
    for (let i = 0; i < rp.count; i++) { const yy = rp.getY(i) + y; _k.copy(yy > -0.2 ? top : yy > -0.55 ? soil : clay); rc[i * 3] = _k.r; rc[i * 3 + 1] = _k.g; rc[i * 3 + 2] = _k.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(rc, 3));
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 })); m.position.set(x, y, z); m.receiveShadow = true; m.castShadow = true; scene.add(m);
  }
  const BW = W * CELL, BH = H * CELL, T = 0.7, RH = 1.3, RY = -0.02 - RH / 2;
  earth(BW + 2 * T, RH, T, 0, RY, -BH / 2 - T / 2); earth(BW + 2 * T, RH, T, 0, RY, BH / 2 + T / 2);
  earth(T, RH, BH, -BW / 2 - T / 2, RY, 0); earth(T, RH, BH, BW / 2 + T / 2, RY, 0);
  earth(BW, 0.8, BH, 0, -0.9, 0);
}
const cellTint = world.cells.map(() => ({ dark: 0, warm: 0 }));
const _c = new THREE.Color(), _warm = new THREE.Color('#ffb060');
function paintGround() {
  // Each cell says how much darker (wet, covered) and warmer (heat) it is; vertices blend their four nearest.
  for (let i = 0; i < world.cells.length; i++) { const c = world.cells[i], t = cellTint[i]; t.dark = c.water ? 0 : c.wet * 0.09 + (covered(world, c.x, c.y) ? 0.08 : 0); t.warm = c.heat > 0 ? Math.min(0.4, c.heat * 0.35) : 0; }
  for (let i = 0; i < VCOUNT; i++) {
    let dark = 0, warm = 0;
    for (const [k, wgt] of vertexBlend[i]) { dark += cellTint[k].dark * wgt; warm += cellTint[k].warm * wgt; }
    _c.setRGB(baseColors[i * 3], baseColors[i * 3 + 1], baseColors[i * 3 + 2]);
    if (dark > 0.001) _c.offsetHSL(0, 0.02, -dark * vertexLand[i]);
    if (warm > 0.001) _c.lerp(_warm, warm * vertexLand[i]);
    targetColors[i * 3] = _c.r; targetColors[i * 3 + 1] = _c.g; targetColors[i * 3 + 2] = _c.b;
  }
  if (!groundPainted) { groundColors.set(targetColors); groundGeo.attributes.color.needsUpdate = true; groundPainted = true; }
}
let groundPainted = false;
function easeGround() {
  let moved = false;
  for (let i = 0; i < groundColors.length; i++) { const d = targetColors[i] - groundColors[i]; if (Math.abs(d) > 0.002) { groundColors[i] += d * 0.08; moved = true; } }
  if (moved) groundGeo.attributes.color.needsUpdate = true;
}
// Daylight as a smooth curve over the day: dawn around hour 5, dusk around hour 16.
function daylight() {
  const h = world.tick % DAY;
  const up = Math.min(1, Math.max(0, (h - 4.5) / 2)), down = Math.min(1, Math.max(0, (h - 15) / 2));
  const d = up * (1 - down);
  return d * d * (3 - 2 * d);
}
const SKY_DAY = new THREE.Color('#d8e9f1'), SKY_NIGHT = new THREE.Color('#5a6a8c'), SUN_DAY = new THREE.Color('#fff1d6'), SUN_NIGHT = new THREE.Color('#8fa6d8');
let lightNow = 1;
function easeLight() {
  lightNow += (daylight() - lightNow) * 0.06;
  const d = lightNow;
  sun.intensity = 1.0 + 1.0 * d; hemi.intensity = 0.6 + 0.3 * d;
  sun.color.copy(SUN_NIGHT).lerp(SUN_DAY, d);
  scene.background.copy(SKY_NIGHT).lerp(SKY_DAY, d); scene.fog.color.copy(scene.background);
  renderer.toneMappingExposure = 0.95 + 0.1 * d;
}

// ---- things ----------------------------------------------------------------------------
// Everything is modelled in props3d.js. A thing's variant and the way it lies come from its
// id, so the same world always looks the same.
const STEP = 0.32;   // how tall one unit of stacked footing is
const objMeshes = new Map(), crMeshes = new Map();
const hashOf = id => { let h = 2166136261; for (const ch of id) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
function makeBody(kind, h) { return P3.body(kind, h % 3, seed); }
function makeObj(o) {
  const g = new THREE.Group();
  const h = hashOf(o.id);
  const body = makeBody(o.kind, h); g.add(body);
  const fire = P3.flames(); fire.visible = false; g.add(fire);
  g.userData = { obj: o, kind: o.kind, body, fire, h };
  return g;
}
function setWet(body, wet) { body.traverse(m => { if (m.userData.tintable) m.material = wet ? P3.MAT.vcWet : P3.MAT.vc; }); }
// Three flame lights for the whole board, lent to whatever burns.
const flameLights = [0, 1, 2].map(() => { const l = new THREE.PointLight('#ffa047', 0, 4.5, 2); l.visible = false; scene.add(l); return l; });
function makeCreature(c, i) {
  const g = P3.wobblin(i, seed);
  g.userData = { creature: c, body: g.getObjectByName('body'), held: g.getObjectByName('held'), eyes: [g.getObjectByName('eyeL'), g.getObjectByName('eyeR')], heldKind: null };
  return g;
}
// Pebbles and wildflowers on the grass.
{ const d = P3.dressing(world.cells, X, Z, seed, c => !c.water && !c.stony); if (d) scene.add(d); }

function sync() {
  paintGround();
  const seen = new Set();
  let lightsUsed = 0;
  // Group what lies where once, instead of filtering every object for every object.
  const byCell = new Map();
  for (const o of world.objects) if (!o.gone && !o.held) { const k = o.y * W + o.x; let a = byCell.get(k); if (!a) byCell.set(k, a = []); a.push(o); }
  for (const o of live(world)) {
    seen.add(o.id);
    let g = objMeshes.get(o.id);
    if (!g) { g = makeObj(o); scene.add(g); objMeshes.set(o.id, g); }
    const u = g.userData;
    if (u.kind !== o.kind) { g.remove(u.body); u.body = makeBody(o.kind, u.h); g.add(u.body); u.kind = o.kind; }
    g.visible = !o.held;
    if (o.held) continue;
    const h = u.h;
    g.position.set(X(o.x) + ((h % 100) / 100 - 0.5) * 0.5, 0, Z(o.y) + (((h >> 7) % 100) / 100 - 0.5) * 0.5);
    const b = u.body;
    setWet(b, o.wet > 0.45 && o.kind !== 'ember');
    // Footing stacks up; the thing on top of a stack sits higher.
    const all = byCell.get(o.y * W + o.x) || [];
    const here = all.filter(q => MATERIALS[q.kind].hard >= 0.6 && !MATERIALS[q.kind].fixed && !q.burning);
    const idx = here.indexOf(o);
    let lift = 0;
    if (idx > 0) { for (let i = 0; i < idx; i++) lift += (MATERIALS[here[i].kind].weight >= 3 ? 1 : 0.5) * STEP; }
    else if (idx < 0 && here.length) lift = stackHeight(world, o.x, o.y) * STEP;   // soft things lie on top of the footing
    g.position.y = lift;
    // things lie at their own angle; a log on a stack lies square across it
    if (!MATERIALS[o.kind].fixed) b.rotation.y = idx > 0 && o.kind === 'log' ? 0.2 : ((h >> 3) % 628) / 100;
    if (o.kind === 'tallbush') b.userData.fruit.forEach((f, i) => { f.visible = i < (o.fruit || 0); });
    const burning = o.burning > 0;
    u.fire.visible = burning;
    if (o.kind === 'ember') { const core = b.getObjectByName('core'); if (core) core.visible = burning || o.fuel > 0; }
    if (burning && lightsUsed < flameLights.length) { const l = flameLights[lightsUsed++]; l.visible = true; l.intensity = 2; l.position.set(g.position.x, lift + 0.7, g.position.z); }
  }
  for (let i = lightsUsed; i < flameLights.length; i++) { flameLights[i].visible = false; flameLights[i].intensity = 0; }
  for (const [id, g] of objMeshes) if (!seen.has(id)) { scene.remove(g); objMeshes.delete(id); }
  world.creatures.forEach((c, i) => {
    let g = crMeshes.get(c.id);
    if (!g) { g = makeCreature(c, i); scene.add(g); crMeshes.set(c.id, g); }
    const u = g.userData;
    u.tx = X(c.x); u.tz = Z(c.y); u.ty = stackHeight(world, c.x, c.y) * STEP;
    g.visible = c.alive;
    const kind = c.carrying ? c.carrying.kind : null;
    if (kind !== u.heldKind) { u.held.clear(); if (kind) { const m = makeBody(kind, hashOf(c.carrying.id)); m.scale.setScalar(0.7); m.position.set(0, 0, 0); m.traverse(x => { x.castShadow = false; }); u.held.add(m); } u.heldKind = kind; }
  });
}

// ---- story and fire report, read incrementally from the log ----------------------------------
const log = { read: 0, feeds: 0, byWho: {}, first: null, lines: [], seenFeed: new Set(), saw: new Map(), lumpSeen: false };
function readLog() {
  const ev = world.events;
  for (; log.read < ev.length; log.read++) {
    const e = ev[log.read], day = Math.floor(e.t / DAY) + 1;
    if (e.kind === 'saw' && e.outcome === 'fire_grew' && !log.saw.has(e.who)) log.saw.set(e.who, e.whom);
    if (e.kind === 'keeper_placed' && e.material === 'ember' && !log.lumpSeen) { log.lumpSeen = true; log.lines.push(`Day ${day}: a glowing lump appeared.`); }
    if (e.kind === 'fed_fire' && e.who) {
      log.feeds++; log.byWho[e.who] = (log.byWho[e.who] || 0) + 1; if (!log.first) log.first = e.who;
      if (!log.seenFeed.has(e.who)) { log.seenFeed.add(e.who); const saw = log.saw.get(e.who); log.lines.push(`Day ${day}: ${e.who} put a ${e.material} on the glow and it grew` + (saw ? `, after watching ${saw} do it.` : '. First to do it.')); }
    }
    if (e.kind === 'fire_out') log.lines.push(`Day ${day}: the glow went out.`);
    if (e.kind === 'died') log.lines.push(`Day ${day}: ${e.who} died of ${e.cause}.`);
    if (e.kind === 'born') log.lines.push(`Day ${day}: ${e.who} was born.`);
  }
}

// ---- hud ---------------------------------------------------------------------------------
const hud = document.getElementById('hud'), lines = document.getElementById('lines'), who = document.getElementById('who');
let shownLines = 0, selected = null;
function drawHud() {
  readLog();
  const source = world.objects.find(o => !o.gone && o.burning > 0 && o.fuel > 0);
  const living = world.creatures.reduce((n, c) => n + (c.alive ? 1 : 0), 0);
  hud.innerHTML = `<b>Wobblins lab · seed ${seed}</b>Day ${Math.floor(world.tick / DAY) + 1}, ${isNight(world) ? 'night' : 'day'}${world.weather.rain ? ', raining' : ''} · ${living} alive, ${world.creatures.length - living} gone<br>` +
    (source ? `Fire burning, fuel ${source.fuel}, fed ${log.feeds} times` : log.feeds ? `No fire now; it was fed ${log.feeds} times` : 'No fire') +
    `<br><span class="muted">Click the ground to put down:</span><br>` +
    ['ember', 'stick', 'grass', 'stone', 'log', 'berry'].map(k => `<button data-tool="${k}" class="${tool === k ? 'on' : ''}">${k === 'ember' ? 'glowing lump' : k}</button>`).join('') +
    `<br><button data-act="rain">Rain</button><button data-act="pause">${running ? 'Pause' : 'Run'}</button><button data-act="fast">${speedMs < 200 ? 'Slow' : 'Fast'}</button>`;
  if (log.lines.length !== shownLines) { lines.innerHTML = log.lines.slice(-60).map(l => `<p>${l}</p>`).join(''); shownLines = log.lines.length; lines.scrollTop = lines.scrollHeight; }
  if (selected) {
    const c = selected, n = c.needs;
    const top = beliefs(c, 5).map(b => `<li>${b.key.replace(/\|/g, ' ').replace('>', ' → ')} <small>(${Object.entries(b.outcomes).map(([k, v]) => k + ' ' + v.toFixed(1)).join(', ')}${b.seen ? ', ' + b.seen + ' seen' : ''})</small></li>`).join('');
    who.style.display = 'block';
    who.innerHTML = `<b>${c.id}</b> ${c.alive ? '' : '(dead)'} <small>curiosity ${c.genome.curiosity.toFixed(2)}, patience ${c.genome.patience.toFixed(2)}, sociability ${c.genome.sociability.toFixed(2)}</small><br>` +
      `food ${(n.energy * 10).toFixed(0)} · warmth ${(n.warmth * 10).toFixed(0)} · rest ${(n.rest * 10).toFixed(0)} · company ${(n.social * 10).toFixed(0)}` +
      (c.plan ? `<br>Doing: ${c.plan.action}${c.plan.target && c.plan.target.kind ? ' with a ' + MATERIALS[c.plan.target.kind].look : ''}` : '') +
      (c.carrying ? `<br>Carrying a ${MATERIALS[c.carrying.kind].look}` : '') +
      `<br><span class="muted">Believes (from its own life):</span><ul style="margin:2px 0 0 16px;padding:0">${top || '<li>nothing yet</li>'}</ul>`;
  }
}
hud.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.tool) tool = b.dataset.tool;
  if (b.dataset.act === 'rain') { world.weather.rain = 1; for (const c of world.cells) c.wet = 1; for (const o of live(world)) if (!o.held) o.wet = Math.min(1, o.wet + 0.6); }
  if (b.dataset.act === 'pause') running = !running;
  if (b.dataset.act === 'fast') speedMs = speedMs < 200 ? 600 : 80;
  drawHud();
});

// ---- picking: click ground to place, click a creature to inspect --------------------------------
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
let down = null;
renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, moved: false }; });
window.addEventListener('pointermove', e => { if (!down) return; const dx = e.clientX - down.x, dy = e.clientY - down.y; if (Math.hypot(dx, dy) > 4) down.moved = true; if (down.moved) { yaw -= dx * 0.005; pitch = Math.max(0.3, Math.min(1.3, pitch + dy * 0.004)); placeCamera(); down.x = e.clientX; down.y = e.clientY; } });
window.addEventListener('pointerup', e => {
  if (!down) return; const wasClick = !down.moved; down = null; if (!wasClick) return;
  mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(mouse, camera);
  const hitC = ray.intersectObjects([...crMeshes.values()].filter(g => g.visible), true)[0];
  if (hitC) { let g = hitC.object; while (g && !g.userData.creature) g = g.parent; selected = g.userData.creature; drawHud(); return; }
  const hitT = ray.intersectObjects(tiles)[0];
  if (hitT) { const c = hitT.object.userData.cell; if (!c.water) { keeperPlace(world, tool, c.x, c.y, tool === 'ember' ? { fuel: 120 } : {}); sync(); drawHud(); } }
});
renderer.domElement.addEventListener('wheel', e => { dist = Math.max(8, Math.min(50, dist * (1 + e.deltaY * 0.001))); placeCamera(); e.preventDefault(); }, { passive: false });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ---- loop ----------------------------------------------------------------------------------------
let last = 0;
function frame(t) {
  if (running && t - last > speedMs) { step(world); sync(); drawHud(); last = t; }
  const s = t / 1000;
  for (const g of crMeshes.values()) {
    if (!g.visible) continue;
    const u = g.userData;
    g.position.x += (u.tx - g.position.x) * 0.15; g.position.z += (u.tz - g.position.z) * 0.15; g.position.y += ((u.ty || 0) - g.position.y) * 0.2;
    const k = 1 + Math.sin(s * 3 + g.position.x) * 0.04; u.body.scale.set(1 / k, k, 1 / k);
    // eyes glance toward where the creature is heading, and blink now and then
    const blink = ((s * 0.7 + g.position.x * 0.37) % 1) < 0.06 ? 0.15 : 1; for (const e of u.eyes) { e.scale.y = blink; e.position.y = 0.38 - (1 - blink) * 0.02; }
    if (Math.abs(u.tx - g.position.x) + Math.abs(u.tz - g.position.z) > 0.02) g.lookAt(u.tx, g.position.y, u.tz);
  }
  for (const g of objMeshes.values()) if (g.userData.fire.visible) P3.animateFlames(g.userData.fire, s + g.userData.h % 7);
  for (const l of flameLights) if (l.visible) l.intensity = 1.8 + Math.sin(s * 11 + l.position.x) * 0.3;
  easeLight(); easeGround();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
sync(); drawHud(); requestAnimationFrame(frame);
window.__lab = { world, scene, renderer, camera, sync, drawHud, easeLight, easeGround };
