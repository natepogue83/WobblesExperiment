// lab/props3d.js — the lab's things, modelled by hand. Every kind has three
// variants so a field of sticks is not sixty copies of one stick, and each
// variant is one merged, vertex-coloured geometry so a whole prop is one draw.
// Nothing here is random: shapes come from the seeded rng, so a stone is the
// same stone every time you open the lab.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rngFor } from '../src/sim/rng.js';

// ---- palette: gouache, not plastic -------------------------------------------------------
export const C = {
  stone: ['#9e978c', '#a8a39b', '#8e8c90'], stoneDark: '#6e6960', lichen: '#b7c27a',
  bark: '#7a4e2a', barkDark: '#5e3a1e', wood: '#c69a62', woodRing: '#a97d4c', woodHeart: '#8a5e36',
  stick: ['#8a5a34', '#9a6a3c', '#75502f'],
  grass: ['#cfd67f', '#bfc96c', '#d9dc8e'], grassDark: '#a9b35a', seed: '#e7d9a0',
  berry: '#c9435f', berryDark: '#a3334b', berryShine: '#f0a0b0', leaf: '#6fa24a', leafDark: '#55843a',
  root: '#b08856', rootDark: '#8a6238',
  coal: '#2e2420', coalEdge: '#4a3a30', emberGlow: '#ff7a2a', emberCore: '#ffd17a',
  flameOuter: '#ff7a1f', flameMid: '#ffb13b', flameInner: '#fff0a8', smoke: '#9a948c',
  bush: ['#5e9344', '#6fa24a', '#7fb35a'], bushLight: '#9ccb6a', trunk: '#6f4a2c',
  sprout: '#8fd16b', sproutDark: '#6ca94f', eyeWhite: '#fff8f0', pupil: '#2a1d14', cheek: '#f0a0a0', foot: '#6d5a4a',
  pebble: '#aaa49a', flower: ['#fff6e0', '#ffd86b', '#f4a7c0', '#c9b6ff'], flowerStem: '#6fa24a'
};
export const COATS = ['#a3c98c', '#cbd77f', '#f0cf7c', '#ecaa82', '#e8a3aa', '#c5a9d8', '#9fb7da', '#90c9c1', '#dcbd95', '#b9cba5'];

// One material for every vertex-coloured prop, and a damp version of it.
export const MAT = {
  vc: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 }),
  vcWet: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6, metalness: 0, color: '#8d8d9e' }),
  vcSmooth: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }),
  glow: new THREE.MeshStandardMaterial({ color: '#ff8a2a', emissive: '#ff5a10', emissiveIntensity: 1.4, flatShading: true, roughness: 0.8 }),
  flameOuter: new THREE.MeshStandardMaterial({ color: C.flameOuter, emissive: '#ff5a10', emissiveIntensity: 1.2, flatShading: true, transparent: true, opacity: 0.9 }),
  flameMid: new THREE.MeshStandardMaterial({ color: C.flameMid, emissive: '#ff9a20', emissiveIntensity: 1.5, flatShading: true }),
  flameInner: new THREE.MeshStandardMaterial({ color: C.flameInner, emissive: '#ffe08a', emissiveIntensity: 1.8, flatShading: true }),
  smoke: new THREE.MeshStandardMaterial({ color: C.smoke, transparent: true, opacity: 0.35, flatShading: true, roughness: 1 }),
  eyeWhite: new THREE.MeshStandardMaterial({ color: C.eyeWhite, roughness: 0.4 }),
  pupil: new THREE.MeshStandardMaterial({ color: C.pupil, roughness: 0.3 }),
  shine: new THREE.MeshBasicMaterial({ color: '#ffffff' })
};

// ---- helpers ------------------------------------------------------------------------------------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _col = new THREE.Color();
// Paint a geometry one colour (or by a function of the vertex position) and place it.
function part(geo, color, { pos = [0, 0, 0], rot = [0, 0, 0], scale = 1 } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  const n = g.attributes.position.count, colors = new Float32Array(n * 3), pa = g.attributes.position;
  for (let i = 0; i < n; i++) {
    const c = typeof color === 'function' ? color(pa.getX(i), pa.getY(i), pa.getZ(i), _col) : _col.set(color);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
  _e.set(rot[0], rot[1], rot[2]); _q.setFromEuler(_e); _s.set(...(Array.isArray(scale) ? scale : [scale, scale, scale])); _p.set(...pos);
  _m.compose(_p, _q, _s); g.applyMatrix4(_m);
  return g;
}
// Parts keep the normals they were built with, so a smooth sphere stays smooth and a lump stays faceted.
function merged(parts) { const g = mergeGeometries(parts, false); for (const p of parts) p.dispose(); return g; }
// A lumpy rock-ish shape: an icosahedron with every vertex pushed in or out a little.
export function lump(radius, r, bump = 0.25, detail = 1, squash = [1, 1, 1]) {
  let g = new THREE.IcosahedronGeometry(radius, detail);
  g = mergeVertices(g);
  const pa = g.attributes.position;
  for (let i = 0; i < pa.count; i++) { const k = 1 + (r() - 0.5) * 2 * bump; pa.setXYZ(i, pa.getX(i) * k * squash[0], pa.getY(i) * k * squash[1], pa.getZ(i) * k * squash[2]); }
  g.computeVertexNormals();
  return g;
}
// A bent twig along a few points.
function twig(points, radius, segs = 8, sides = 5) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, segs, radius, sides, false);
}
function shade(hex, dl) { return new THREE.Color(hex).offsetHSL(0, 0, dl); }
function shadeBy(hex, fn) { const base = new THREE.Color(hex); return (x, y, z, out) => { out.copy(base); const d = fn(x, y, z); return out.offsetHSL(0, 0, d); }; }

// ---- the things -------------------------------------------------------------------------------------
// Each builder returns { geo } for a single merged vertex-coloured mesh, or a Group when it
// needs more than one material (embers, bushes with fruit).
export function stone(v, seed = 11) {
  const r = rngFor(seed, 'stone', v);
  const base = C.stone[v % 3];
  const parts = [part(lump(0.2, r, 0.22, 1, [1.1, 0.72, 1]), shadeBy(base, (x, y) => y * 0.35 - 0.02), { pos: [0, 0.13, 0], rot: [0, r() * 6, 0] })];
  if (v === 1) parts.push(part(lump(0.09, r, 0.3, 0, [1, 0.6, 1]), shade(C.stoneDark, 0.02), { pos: [0.17, 0.05, 0.1] }));   // a chip beside it
  if (v === 2) parts.push(part(new THREE.CircleGeometry(0.07, 6), C.lichen, { pos: [0.05, 0.255, -0.03], rot: [-Math.PI / 2 + 0.25, 0, 0.3] }));   // a lichen patch
  return { geo: merged(parts) };
}
export function stick(v, seed = 11) {
  const r = rngFor(seed, 'stick', v);
  const base = C.stick[v % 3];
  const pts = [[-0.36, 0.04, 0], [-0.14, 0.05 + (r() - 0.5) * 0.04, (r() - 0.5) * 0.08], [0.1, 0.045, (r() - 0.5) * 0.08], [0.36, 0.04, (r() - 0.5) * 0.04]];
  const parts = [part(twig(pts, 0.035), shadeBy(base, (x, y) => (y - 0.04) * 1.5), {})];
  // a side twig, and a knot
  const k = pts[1 + (v % 2)];
  parts.push(part(twig([[k[0], k[1], k[2]], [k[0] + 0.1, k[1] + 0.08, k[2] + 0.06], [k[0] + 0.16, k[1] + 0.17, k[2] + 0.09]], 0.018, 4, 4), shade(base, -0.05), {}));
  parts.push(part(lump(0.045, r, 0.2, 0), shade(base, -0.08), { pos: [pts[2][0], pts[2][1], pts[2][2]] }));
  if (v === 2) parts.push(part(new THREE.CircleGeometry(0.035, 5), shade(C.wood, 0.05), { pos: [0.38, 0.04, pts[3][2]], rot: [0, Math.PI / 2, 0] }));   // a snapped end
  return { geo: merged(parts) };
}
export function grass(v, seed = 11) {
  const r = rngFor(seed, 'grass', v);
  const parts = [];
  const blades = 6 + v;
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2 + r() * 0.6, lean = 0.25 + r() * 0.35, h = 0.22 + r() * 0.16;
    const col = i % 3 === 0 ? C.grassDark : C.grass[v % 3];
    parts.push(part(new THREE.ConeGeometry(0.022, h, 3), shadeBy(col, (x, y) => y * 0.5), { pos: [Math.cos(a) * 0.05, h / 2 - 0.01, Math.sin(a) * 0.05], rot: [Math.cos(a) * lean, a, -Math.sin(a) * lean] }));
    if (i % 4 === 1) parts.push(part(new THREE.SphereGeometry(0.02, 5, 4), C.seed, { pos: [Math.cos(a) * 0.05 + Math.sin(a) * lean * h * 0.6, h * 0.9, Math.sin(a) * 0.05 + Math.cos(a) * lean * h * 0.6], scale: [1, 1.8, 1] }));
  }
  return { geo: merged(parts) };
}
export function log(v, seed = 11) {
  const r = rngFor(seed, 'log', v);
  const len = 0.9 + v * 0.08, rad = 0.14;
  let body = mergeVertices(new THREE.CylinderGeometry(rad, rad * 1.05, len, 9, 3, true));
  const pa = body.attributes.position;
  for (let i = 0; i < pa.count; i++) { const k = 1 + (r() - 0.5) * 0.12; pa.setX(i, pa.getX(i) * k); pa.setZ(i, pa.getZ(i) * k); }
  body.computeVertexNormals();
  const parts = [part(body, shadeBy(C.bark, (x, y, z) => (z > 0 ? 0.04 : -0.04) + (r() - 0.5) * 0.04), { rot: [0, 0, Math.PI / 2], pos: [0, rad, 0] })];
  // cut ends: pale wood, a ring, a heart
  for (const sx of [-1, 1]) {
    const x = sx * len / 2, rotY = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
    parts.push(part(new THREE.CircleGeometry(rad * 1.0, 9), C.wood, { pos: [x, rad, 0], rot: [0, rotY, 0] }));
    parts.push(part(new THREE.RingGeometry(rad * 0.45, rad * 0.6, 9), C.woodRing, { pos: [x + sx * 0.003, rad, 0], rot: [0, rotY, 0] }));
    parts.push(part(new THREE.CircleGeometry(rad * 0.18, 7), C.woodHeart, { pos: [x + sx * 0.005, rad, 0], rot: [0, rotY, 0] }));
  }
  // a branch stub and a bark knot
  parts.push(part(new THREE.CylinderGeometry(0.035, 0.05, 0.16, 5), C.barkDark, { pos: [len * (0.1 + v * 0.1), rad + 0.14, 0.02], rot: [0, 0, 0.3] }));
  parts.push(part(lump(0.05, r, 0.2, 0, [1, 0.6, 1]), C.barkDark, { pos: [-len * 0.25, rad * 0.9, rad * 0.95], rot: [Math.PI / 2, 0, 0] }));
  return { geo: merged(parts) };
}
export function berry(v, seed = 11) {
  const r = rngFor(seed, 'berry', v);
  const parts = [];
  const n = 2 + (v % 2);
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 0.1 + (r() - 0.5) * 0.03, z = (r() - 0.5) * 0.08, s = 0.07 + r() * 0.025;
    parts.push(part(new THREE.SphereGeometry(s, 8, 6), shadeBy(C.berry, (px, py) => py * 1.2), { pos: [x, s, z] }));
    parts.push(part(new THREE.SphereGeometry(s * 0.3, 5, 4), C.berryShine, { pos: [x - s * 0.4, s * 1.55, z + s * 0.45], scale: [1, 0.6, 1] }));
  }
  // a stalk and a leaf
  parts.push(part(twig([[-0.05, 0.08, 0], [0.02, 0.14, 0.02], [0.1, 0.17, 0.0]], 0.012, 4, 4), C.leafDark, {}));
  parts.push(part(new THREE.CircleGeometry(0.07, 5), shadeBy(C.leaf, (x) => x * 0.6), { pos: [0.12, 0.17, 0.0], rot: [-Math.PI / 2 + 0.5, 0.3, 0], scale: [1.6, 1, 1] }));
  return { geo: merged(parts) };
}
export function root(v, seed = 11) {
  const r = rngFor(seed, 'root', v);
  const parts = [part(lump(0.12, r, 0.3, 1, [1.3, 0.8, 1]), shadeBy(C.root, (x, y) => y * 0.6), { pos: [0, 0.1, 0], rot: [0, v, 0] })];
  parts.push(part(lump(0.08, r, 0.3, 0), shade(C.root, -0.04), { pos: [0.14, 0.08, 0.06] }));
  for (let i = 0; i < 3 + v; i++) {
    const a = r() * Math.PI * 2;
    parts.push(part(twig([[Math.cos(a) * 0.08, 0.06, Math.sin(a) * 0.08], [Math.cos(a) * 0.18, 0.03, Math.sin(a) * 0.18], [Math.cos(a) * 0.26 + (r() - 0.5) * 0.08, 0.005, Math.sin(a) * 0.26]], 0.014, 5, 4), C.rootDark, {}));
  }
  return { geo: merged(parts) };
}
// Embers: a dark lumpy coal with a glowing core showing through the cracks.
export function ember(v, seed = 11) {
  const r = rngFor(seed, 'ember', v);
  const g = new THREE.Group();
  const coal = new THREE.Mesh(merged([part(lump(0.2, r, 0.35, 1, [1.15, 0.7, 1]), shadeBy(C.coal, (x, y) => y * 0.4 + (r() < 0.3 ? 0.1 : 0)), { pos: [0, 0.12, 0] })]), MAT.vc);
  coal.castShadow = true; coal.receiveShadow = true; g.add(coal);
  const core = new THREE.Mesh(lump(0.15, r, 0.2, 1, [1.1, 0.6, 1]), MAT.glow); core.position.y = 0.12; core.name = 'core'; g.add(core);
  return g;
}
// A tall bush: leaning trunk, a canopy of several lumps, lighter on top, fruit hung around it.
export function tallbush(v, seed = 11) {
  const r = rngFor(seed, 'tallbush', v);
  const g = new THREE.Group();
  const lean = (r() - 0.5) * 0.25;
  const parts = [part(twig([[0, 0, 0], [lean * 0.4, 0.35, 0], [lean, 0.75, 0]], 0.07, 6, 6), shadeBy(C.trunk, (x, y) => y * 0.15), {})];
  parts.push(part(twig([[lean * 0.5, 0.45, 0], [lean * 0.5 + 0.2, 0.62, 0.1], [lean * 0.5 + 0.32, 0.78, 0.18]], 0.03, 4, 5), C.trunk, {}));
  const blobs = [[0, 1.0, 0, 0.42], [-0.32, 0.86, 0.1, 0.3], [0.3, 0.9, -0.12, 0.32], [0.02, 1.3, 0.06, 0.3], [-0.1, 0.95, -0.3, 0.26], [0.12, 0.92, 0.3, 0.27]];
  for (const [x, y, z, s] of blobs) parts.push(part(lump(s, r, 0.12, 1), shadeBy(C.bush[v % 3], (px, py) => py * 0.5 - 0.05), { pos: [x + lean, y, z] }));
  parts.push(part(lump(0.18, r, 0.1, 0), C.bushLight, { pos: [lean + 0.05, 1.5, 0.02] }));
  const body = new THREE.Mesh(merged(parts), MAT.vc); body.castShadow = true; body.receiveShadow = true; g.add(body);
  g.userData.fruit = [];
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05 + r() * 0.3, rad = 0.4 + r() * 0.08;
    const f = new THREE.Mesh(merged([part(new THREE.SphereGeometry(0.065, 8, 6), shadeBy(C.berry, (x, y) => y * 1.2), {}), part(new THREE.SphereGeometry(0.02, 5, 4), C.berryShine, { pos: [-0.025, 0.035, 0.03] })]), MAT.vc);
    f.position.set(lean + Math.cos(a) * rad, 0.9 + (i % 3) * 0.2, Math.sin(a) * rad); g.add(f); g.userData.fruit.push(f);
  }
  return g;
}
// A standing tree: a leaning trunk flaring at the root, a canopy of several lumps, a paler crown.
// The notch (a pale wedge) shows once someone has cut into it.
export function tree(v, seed = 11) {
  const r = rngFor(seed, 'tree', v);
  const g = new THREE.Group();
  const lean = (r() - 0.5) * 0.3, h = 1.6 + v * 0.15;
  const parts = [part(twig([[0, -0.05, 0], [lean * 0.3, h * 0.45, 0], [lean, h, 0]], 0.13, 8, 7), shadeBy(C.bark, (x, y) => y * 0.1 - 0.02), {})];
  for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.4; parts.push(part(twig([[Math.cos(a) * 0.08, 0.02, Math.sin(a) * 0.08], [Math.cos(a) * 0.22, -0.02, Math.sin(a) * 0.22], [Math.cos(a) * 0.3, -0.06, Math.sin(a) * 0.3]], 0.06, 4, 5), C.barkDark, {})); }   // root flare
  parts.push(part(twig([[lean * 0.6, h * 0.6, 0], [lean * 0.6 + 0.3, h * 0.72, 0.15], [lean * 0.6 + 0.5, h * 0.8, 0.25]], 0.05, 4, 5), C.bark, {}));
  const blobs = [[0, h + 0.3, 0, 0.62], [-0.45, h + 0.1, 0.15, 0.42], [0.42, h + 0.15, -0.18, 0.45], [0.05, h + 0.75, 0.05, 0.42], [-0.15, h + 0.2, -0.45, 0.38], [0.2, h + 0.15, 0.45, 0.38]];
  for (const [x, y, z, s] of blobs) parts.push(part(lump(s, r, 0.12, 1), shadeBy(C.bush[(v + 1) % 3], (px, py) => py * 0.4 - 0.04), { pos: [x + lean, y, z] }));
  parts.push(part(lump(0.26, r, 0.1, 0), C.bushLight, { pos: [lean + 0.08, h + 1.05, 0.04] }));
  const body = new THREE.Mesh(merged(parts), MAT.vc); body.castShadow = true; body.receiveShadow = true; g.add(body);
  const notch = new THREE.Mesh(merged([part(new THREE.CylinderGeometry(0.0, 0.14, 0.16, 3), shadeBy(C.wood, (x, y) => y * 0.3), { pos: [lean * 0.2 + 0.1, 0.45, 0.03], rot: [0, 0, -Math.PI / 2] })]), MAT.vc);
  notch.name = 'notch'; notch.visible = false; g.add(notch);
  return g;
}
export function sapling(v, seed = 11) {
  const r = rngFor(seed, 'sapling', v);
  const parts = [part(twig([[0, 0, 0], [0.02, 0.3, 0.01], [(r() - 0.5) * 0.1, 0.6, 0]], 0.025, 5, 5), C.trunk, {})];
  for (let i = 0; i < 3; i++) { const a = i * 2.1 + r(); parts.push(part(new THREE.SphereGeometry(0.1, 7, 5), shadeBy(C.bush[v % 3], (x) => x * 0.5), { pos: [Math.cos(a) * 0.1, 0.4 + i * 0.1, Math.sin(a) * 0.1], rot: [0, a, 0.4], scale: [1.6, 0.45, 0.9] })); }
  return { geo: merged(parts) };
}
// A sharp shard: a flat, pointed flake of stone with a paler fresh edge.
export function shard(v, seed = 11) {
  const r = rngFor(seed, 'shard', v);
  const parts = [part(new THREE.ConeGeometry(0.11, 0.3, 3), shadeBy(C.stone[2], (x, y, z) => y * 0.6 + (Math.abs(z) < 0.02 ? 0.1 : 0)), { pos: [0, 0.03, 0], rot: [Math.PI / 2 + 0.2, r() * 6, 0], scale: [1, 1, 0.35] })];
  return { geo: merged(parts) };
}
// A shard on a stick: the stick, the shard wedged at one end, a wrap of pale fibre where it sits.
export function axe(v, seed = 11) {
  const r = rngFor(seed, 'axe', v);
  const parts = [part(twig([[-0.3, 0.04, 0], [-0.05, 0.05, 0.02], [0.3, 0.045, 0]], 0.035, 8, 5), shadeBy(C.stick[v % 3], (x, y) => (y - 0.04) * 1.5), {})];
  parts.push(part(new THREE.ConeGeometry(0.1, 0.26, 3), shadeBy(C.stone[2], (x, y) => y * 0.6), { pos: [0.28, 0.14, 0], rot: [0, 0, -0.3], scale: [1, 1, 0.35] }));
  parts.push(part(new THREE.TorusGeometry(0.05, 0.016, 5, 8), C.seed, { pos: [0.27, 0.05, 0], rot: [0, Math.PI / 2 + 0.3, 0] }));
  parts.push(part(new THREE.TorusGeometry(0.05, 0.014, 5, 8), shade(C.seed, -0.08), { pos: [0.23, 0.05, 0], rot: [0, Math.PI / 2 + 0.3, 0] }));
  return { geo: merged(parts) };
}
// The prowler: low, long and dark, with a narrow head, pricked ears, a ragged tail and two pale eyes.
export function prowler(seed = 11) {
  const r = rngFor(seed, 'prowler');
  const g = new THREE.Group();
  const dark = '#2a2328', darker = '#1b171b';
  const parts = [part(lump(0.26, r, 0.12, 1, [1.9, 0.9, 0.95]), shadeBy(dark, (x, y) => y * 0.35), { pos: [0, 0.42, 0] })];
  parts.push(part(lump(0.16, r, 0.15, 1, [1.4, 0.9, 0.9]), shadeBy(dark, (x, y) => y * 0.3), { pos: [0.55, 0.5, 0] }));   // head
  parts.push(part(new THREE.ConeGeometry(0.05, 0.3, 4), darker, { pos: [0.78, 0.46, 0], rot: [0, 0, -Math.PI / 2] }));   // muzzle
  for (const sz of [-1, 1]) parts.push(part(new THREE.ConeGeometry(0.045, 0.16, 4), darker, { pos: [0.5, 0.68, sz * 0.09], rot: [sz * 0.3, 0, -0.2] }));   // ears
  for (const [x, z] of [[0.35, 0.14], [0.35, -0.14], [-0.35, 0.15], [-0.35, -0.15]]) parts.push(part(new THREE.CylinderGeometry(0.035, 0.03, 0.42, 5), darker, { pos: [x, 0.21, z], rot: [0, 0, x > 0 ? 0.15 : -0.15] }));   // legs
  parts.push(part(twig([[-0.5, 0.45, 0], [-0.75, 0.55, 0.05], [-0.95, 0.5, 0.1]], 0.035, 5, 4), darker, {}));   // tail
  const body = new THREE.Mesh(merged(parts), MAT.vc); body.castShadow = true; g.add(body);
  for (const sz of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), new THREE.MeshBasicMaterial({ color: '#f3e58a' })); e.position.set(0.66, 0.55, sz * 0.07); g.add(e); }
  return g;
}

// The fire that sits on a burning ember: three nested flames and a few puffs of smoke.
export function flames() {
  const g = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.62, 7), MAT.flameOuter); outer.position.y = 0.48; outer.name = 'outer'; g.add(outer);
  const mid = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.46, 6), MAT.flameMid); mid.position.y = 0.44; mid.name = 'mid'; g.add(mid);
  const inner = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 5), MAT.flameInner); inner.position.y = 0.4; inner.name = 'inner'; g.add(inner);
  g.userData.smoke = [];
  for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), MAT.smoke); s.userData.phase = i / 4; g.add(s); g.userData.smoke.push(s); }
  return g;
}
export function animateFlames(g, s) {
  const o = g.getObjectByName('outer'), m = g.getObjectByName('mid'), i = g.getObjectByName('inner');
  o.scale.set(1 + Math.sin(s * 9) * 0.1, 1 + Math.sin(s * 13) * 0.18, 1 + Math.cos(s * 7) * 0.1); o.rotation.y = s * 1.5;
  m.scale.set(1 + Math.sin(s * 11 + 1) * 0.12, 1 + Math.sin(s * 17 + 2) * 0.22, 1); m.rotation.y = -s * 2.2;
  i.scale.set(1, 1 + Math.sin(s * 23) * 0.3, 1); i.position.x = Math.sin(s * 15) * 0.02;
  for (const p of g.userData.smoke) {
    const t = (s * 0.35 + p.userData.phase) % 1;
    p.position.set(Math.sin(t * 6 + p.userData.phase * 9) * 0.12 * t, 0.75 + t * 1.1, Math.cos(t * 5) * 0.1 * t);
    const k = 0.6 + t * 1.6; p.scale.set(k, k, k); p.material = MAT.smoke; p.visible = t < 0.95;
  }
}

// ---- a Wobblin -------------------------------------------------------------------------------------------
// Round, a little pear-shaped, paler belly, two big eyes with a shine, pink cheeks, two small feet,
// and a sprout with two leaves on top.
export function wobblin(coat, seed = 11) {
  const r = rngFor(seed, 'wobblin', coat);
  const g = new THREE.Group();
  const coatHex = COATS[coat % COATS.length];
  const bodyGeo = mergeVertices(new THREE.SphereGeometry(0.3, 14, 11));
  const pa = bodyGeo.attributes.position;
  for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); const k = 1 + (0.3 - y) * 0.25; pa.setX(i, pa.getX(i) * k); pa.setZ(i, pa.getZ(i) * k); pa.setY(i, y * 0.95); }   // pear
  bodyGeo.computeVertexNormals();
  const belly = new THREE.Color(coatHex).offsetHSL(0, -0.05, 0.12);
  const parts = [part(bodyGeo, (x, y, z, out) => { const f = Math.max(0, Math.min(1, (z - 0.08) * 3 - Math.max(0, y) * 2)); return out.set(coatHex).lerp(belly, f); }, { pos: [0, 0.3, 0] })];
  for (const sx of [-1, 1]) parts.push(part(new THREE.SphereGeometry(0.075, 7, 5), C.foot, { pos: [sx * 0.13, 0.04, 0.08], scale: [1.1, 0.5, 1.4] }));
  for (const sx of [-1, 1]) parts.push(part(new THREE.CircleGeometry(0.055, 8), C.cheek, { pos: [sx * 0.25, 0.29, 0.245], rot: [0, sx * 0.8, 0] }));
  // sprout
  parts.push(part(twig([[0, 0.56, 0], [0.01, 0.64, -0.01], [0.03, 0.71, 0]], 0.014, 4, 4), C.sproutDark, {}));
  for (const sx of [-1, 1]) parts.push(part(new THREE.SphereGeometry(0.055, 7, 5), shadeBy(C.sprout, (x) => x * 0.6), { pos: [sx * 0.07, 0.72, 0], rot: [0, 0, -sx * 0.5], scale: [1.5, 0.45, 0.8] }));
  // mouth: a tiny dark curve
  parts.push(part(new THREE.TorusGeometry(0.03, 0.007, 4, 8, Math.PI), C.pupil, { pos: [0, 0.255, 0.325], rot: [0, 0, Math.PI] }));
  const body = new THREE.Mesh(merged(parts), MAT.vcSmooth); body.castShadow = true; body.receiveShadow = true; body.name = 'body'; g.add(body);
  // eyes: white, pupil, shine (separate so they can glance about later)
  for (const sx of [-1, 1]) {
    const eye = new THREE.Group(); eye.position.set(sx * 0.1, 0.38, 0.288); eye.rotation.y = sx * 0.3; eye.name = sx < 0 ? 'eyeL' : 'eyeR';
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), MAT.eyeWhite); white.scale.set(1, 1.15, 0.7); eye.add(white);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.033, 8, 6), MAT.pupil); pupil.position.set(0, -0.005, 0.038); pupil.name = 'pupil'; eye.add(pupil);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.012, 5, 4), MAT.shine); shine.position.set(0.013, 0.015, 0.068); eye.add(shine);
    g.add(eye);
  }
  const held = new THREE.Group(); held.position.set(0.26, 0.26, 0.2); held.name = 'held'; g.add(held);
  return g;
}

// ---- ground dressing: pebbles and wildflowers scattered on the grass, one mesh ----------------------------
export function dressing(cells, X, Z, seed, isGrass) {
  const r = rngFor(seed, 'dressing');
  const parts = [];
  for (const c of cells) {
    if (!isGrass(c)) continue;
    if (r() < 0.22) parts.push(part(lump(0.04 + r() * 0.03, r, 0.25, 0, [1.2, 0.6, 1]), shade(C.pebble, (r() - 0.5) * 0.1), { pos: [X(c.x) + (r() - 0.5) * 0.8, 0.02, Z(c.y) + (r() - 0.5) * 0.8], rot: [0, r() * 6, 0] }));
    if (r() < 0.14) {
      const x = X(c.x) + (r() - 0.5) * 0.8, z = Z(c.y) + (r() - 0.5) * 0.8, h = 0.12 + r() * 0.08, col = C.flower[Math.floor(r() * 4)];
      parts.push(part(new THREE.CylinderGeometry(0.008, 0.01, h, 4), C.flowerStem, { pos: [x, h / 2, z] }));
      for (let i = 0; i < 5; i++) { const a = i * 1.257; parts.push(part(new THREE.SphereGeometry(0.022, 5, 4), col, { pos: [x + Math.cos(a) * 0.028, h, z + Math.sin(a) * 0.028], scale: [1, 0.5, 1] })); }
      parts.push(part(new THREE.SphereGeometry(0.016, 5, 4), C.seed, { pos: [x, h + 0.01, z] }));
    }
  }
  if (!parts.length) return null;
  const m = new THREE.Mesh(merged(parts), MAT.vc); m.castShadow = false; m.receiveShadow = true; return m;
}

// ---- lookup: a body for a kind and variant, cached so copies share geometry -----------------------------
const cache = new Map();
export function body(kind, v, seed = 11) {
  const key = kind + '#' + v;
  let made = cache.get(key);
  if (!made) {
    const b = { stone, stick, grass, log, berry, root, sapling, shard, axe }[kind];
    made = b ? b(v, seed) : null;
    cache.set(key, made || false);
  }
  if (made) { const m = new THREE.Mesh(made.geo, MAT.vc); m.castShadow = kind !== 'grass' && kind !== 'berry'; m.receiveShadow = true; m.userData.tintable = true; return m; }
  if (kind === 'ember') return ember(v, seed);
  if (kind === 'tallbush') return tallbush(v, seed);
  if (kind === 'tree') return tree(v, seed);
  return new THREE.Mesh(lump(0.2, rngFor(seed, kind, v)), MAT.vc);
}
