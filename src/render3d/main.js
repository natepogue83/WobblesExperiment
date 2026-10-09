// render3d/main.js — a 3D look test: the same valley and the same sim, drawn
// with Three.js as a small stylized low-poly diorama. Soft warm light, long
// shadows, chunky shapes. Nothing here touches the sim.
import * as THREE from 'three';
import { createWorld, tick, replay } from '../sim/index.js';
import { renderState, faceOf } from '../render/render.js';
import { ZONES, RIVER } from '../sim/geometry.js';
import { parseSave } from '../ui/save.js';
import { rngFor } from '../sim/rng.js';

// ---- world <-> scene. The 2D valley is 1200 x 675; z runs into the screen.
const S = 1 / 24;                              // world units per metre
const X = x => (x - 600) * S;
const Z = y => (y - 440) * S;

// Ground height: the hill rises on the left, the hollow dips, the bank slopes to the river.
function groundH(x, y) {
  const hill = 1.6 * Math.exp(-(((x - 230) / 190) ** 2 + ((y - 290) / 95) ** 2));
  const knoll = 0.5 * Math.exp(-(((x - 900) / 170) ** 2 + ((y - 290) / 80) ** 2));
  const hollow = -0.35 * Math.exp(-(((x - 250) / 150) ** 2 + ((y - 470) / 70) ** 2));
  const bank = -0.9 * Math.max(0, Math.min(1, (y - 540) / 70));
  const back = 1.2 * Math.max(0, (260 - y) / 120);
  const edge = Math.max(0, Math.abs(x - 600) - 640) / 60 + Math.max(0, y - 690) / 40 + Math.max(0, 140 - y) / 60;
  return hill + knoll + hollow + bank + back - edge * edge * 1.5;
}
function riverY(x) {
  for (let i = 1; i < RIVER.length; i++) { const [x0, y0] = RIVER[i - 1], [x1, y1] = RIVER[i]; if (x >= x0 && x <= x1) return y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
  return RIVER[RIVER.length - 1][1];
}

// ---- palette: gouache, not plastic.
const P = {
  grass: new THREE.Color('#8fb35a'), grassDark: new THREE.Color('#6f9446'), grassLight: new THREE.Color('#b3cc74'),
  hill: new THREE.Color('#a8bf63'), sand: new THREE.Color('#d9c48f'), water: new THREE.Color('#5c9fcf'),
  trunk: '#8a5a34', leaf: '#5e9344', leaf2: '#7fae55', thatch: '#d6a556', wood: '#9a6a3c', stone: '#9b948a', stoneDark: '#7a746b',
  berry: '#c9435f', fire: '#ff9a3c', sprout: '#8fd16b'
};
const COATS = ['#a3c98c', '#cbd77f', '#f0cf7c', '#ecaa82', '#e8a3aa', '#c5a9d8', '#9fb7da', '#90c9c1', '#dcbd95', '#b9cba5'];

// ---- scene ------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#d8e9f1');
scene.fog = new THREE.Fog('#d8e9f1', 70, 160);

const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 300);
let yaw = -0.15, pitch = 0.5, dist = 34;
const target = new THREE.Vector3(-1, 0.4, -1);
function placeCamera() {
  camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * dist, target.y + Math.sin(pitch) * dist, target.z + Math.cos(yaw) * Math.cos(pitch) * dist);
  camera.lookAt(target);
}
placeCamera();

const hemi = new THREE.HemisphereLight('#dff0ff', '#6b7a3a', 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1d6', 2.2);
sun.position.set(-18, 28, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -40; sun.shadow.camera.right = 40; sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 90;
sun.shadow.bias = -0.0008;
sun.shadow.radius = 4;
scene.add(sun);

const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95, metalness: 0, ...extra });

// Ground: a wide low-poly sheet with vertex colours.
function makeGround() {
  const cols = 120, rows = 70, w = 1500, h = 760;
  const geo = new THREE.PlaneGeometry(w * S, h * S, cols, rows);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, colors = [];
  const r = rngFor(7, 'ground3d');
  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i) / S + 600, wy = pos.getZ(i) / S + 440;
    const jitter = (r() - 0.5) * 0.18;
    const hgt = groundH(wx, wy) + jitter * 0.6;
    pos.setY(i, hgt);
    const nearRiver = Math.abs(wy - riverY(wx));
    let c;
    if (nearRiver < 26) c = P.sand.clone();
    else if (hgt > 1.1) c = P.hill.clone();
    else c = P.grass.clone().lerp(r() < 0.5 ? P.grassDark : P.grassLight, r() * 0.5);
    c.offsetHSL((r() - 0.5) * 0.02, 0, (r() - 0.5) * 0.06);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  m.receiveShadow = true;
  return m;
}
scene.add(makeGround());

// River: a ribbon just below the ground, slightly translucent, drifting.
let riverMat;
function makeRiver() {
  const pts = [];
  for (let x = -150; x <= 1350; x += 30) pts.push(x);
  const geo = new THREE.BufferGeometry();
  const verts = [], idx = [];
  pts.forEach((x, i) => {
    const y = riverY(Math.max(0, Math.min(1200, x))), half = 22;
    verts.push(X(x), -0.78, Z(y - half), X(x), -0.78, Z(y + half));
    if (i) idx.push((i - 1) * 2, (i - 1) * 2 + 1, i * 2, (i - 1) * 2 + 1, i * 2 + 1, i * 2);
  });
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  riverMat = new THREE.MeshStandardMaterial({ color: P.water, roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.92 });
  const m = new THREE.Mesh(geo, riverMat); m.receiveShadow = true;
  return m;
}
scene.add(makeRiver());

// Backdrop: far hills and a few mountains, flat-shaded.
function makeMountains() {
  const g = new THREE.Group();
  const r = rngFor(7, 'mtn3d');
  for (let i = 0; i < 9; i++) {
    const x = -80 + i * 20 + (r() - 0.5) * 6, hgt = 9 + r() * 12, rad = 8 + r() * 5;
    const m = new THREE.Mesh(new THREE.ConeGeometry(rad, hgt, 5 + Math.floor(r() * 3)), flat(i % 2 ? '#8fa6c4' : '#a3b6cf'));
    m.position.set(x, hgt / 2 - 4, -95 - r() * 25); m.rotation.y = r() * Math.PI;
    g.add(m);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.38, hgt * 0.36, 5), flat('#f4f7fb'));
    cap.position.set(x, hgt - hgt * 0.18 - 4, m.position.z); cap.rotation.y = m.rotation.y;
    g.add(cap);
  }
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(5 + r() * 4, 7, 5), flat(i % 2 ? '#86a35e' : '#7a9a57'));
    m.position.set(-56 + i * 10 + (r() - 0.5) * 5, -4.5, -48 - r() * 12); m.scale.y = 0.5;
    g.add(m);
  }
  return g;
}
scene.add(makeMountains());
function makeClouds() {
  const g = new THREE.Group(), r = rngFor(7, 'cloud3d');
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true });
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Group(), x = -50 + r() * 100, z = -40 - r() * 50, y = 16 + r() * 6;
    for (let k = 0; k < 4; k++) { const p = new THREE.Mesh(new THREE.SphereGeometry(2.2 + r() * 2.4, 7, 5), mat); p.position.set(k * 2.6 - 4 + (r() - 0.5), (r() - 0.5) * 1.2, (r() - 0.5) * 2); p.scale.y = 0.6; c.add(p); }
    c.position.set(x, y, z); g.add(c);
  }
  return g;
}
scene.add(makeClouds());
function makeFlowers() {
  const r = rngFor(7, 'flowers3d');
  const geo = new THREE.CircleGeometry(0.09, 6);
  const cols = ['#ffd24a', '#ff8fb8', '#ffffff', '#9fd0ff', '#f2a53a'];
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), 420);
  const d = new THREE.Object3D(), c = new THREE.Color();
  for (let i = 0; i < 420; i++) {
    const x = 60 + r() * 1080, y = 230 + r() * 320;
    if (Math.abs(y - riverY(x)) < 40) { d.position.set(0, -50, 0); } else d.position.set(X(x), groundH(x, y) + 0.06, Z(y));
    d.rotation.set(-Math.PI / 2 + (r() - 0.5) * 0.6, 0, r() * 6.28); d.updateMatrix();
    mesh.setMatrixAt(i, d.matrix); mesh.setColorAt(i, c.set(cols[Math.floor(r() * cols.length)]));
  }
  return mesh;
}
scene.add(makeFlowers());

// ---- things ------------------------------------------------------------------------
function shadowed(mesh) { mesh.castShadow = true; mesh.receiveShadow = true; return mesh; }
function tree(seed) {
  const r = rngFor(seed, 'tree3d'), g = new THREE.Group();
  const trunk = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.1, 6), flat(P.trunk))); trunk.position.y = 0.55; g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const s = 0.9 - i * 0.18;
    const leaf = shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), flat(i % 2 ? P.leaf2 : P.leaf)));
    leaf.position.set((r() - 0.5) * 0.3, 1.3 + i * 0.55, (r() - 0.5) * 0.3); leaf.rotation.set(r(), r(), r());
    g.add(leaf);
  }
  return g;
}
function bush(berries) {
  const g = new THREE.Group();
  for (const [x, z, s] of [[0, 0, 0.5], [-0.35, 0.1, 0.36], [0.33, -0.08, 0.38]]) {
    const m = shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), flat(P.leaf))); m.position.set(x, s * 0.9, z); g.add(m);
  }
  for (let i = 0; i < Math.min(5, berries); i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), flat(P.berry)); b.position.set(-0.3 + i * 0.15, 0.6 + (i % 2) * 0.2, 0.35); g.add(b);
  }
  return g;
}
function hut() {
  const g = new THREE.Group();
  const wall = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.9, 10), flat(P.wood))); wall.position.y = 0.45; g.add(wall);
  const roof = shadowed(new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.3, 10), flat(P.thatch))); roof.position.y = 1.5; g.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.1), new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#ff9a3c', emissiveIntensity: 0.7 })); door.position.set(0, 0.32, 1.0); g.add(door);
  return g;
}
function rock(size, dark = false) { const m = shadowed(new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), flat(dark ? P.stoneDark : P.stone))); m.position.y = size * 0.7; m.scale.y = 0.75; return m; }
function stones(count) {
  const g = new THREE.Group();
  for (let i = 0; i < Math.max(1, Math.min(4, count)); i++) { const s = rock(0.22 - i * 0.03, i % 2 === 1); s.position.set((i % 2 ? 0.2 : -0.15) * (i > 1 ? -1 : 1), s.position.y + i * 0.22, (i > 1 ? 0.15 : -0.1)); g.add(s); }
  return g;
}
function fire() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) { const log = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.7, 5), flat(P.trunk))); log.rotation.z = Math.PI / 2; log.rotation.y = i * 1.05; log.position.y = 0.08; g.add(log); }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 6), new THREE.MeshStandardMaterial({ color: P.fire, emissive: '#ff6a1a', emissiveIntensity: 1.6, flatShading: true })); flame.position.y = 0.45; flame.name = 'flame'; g.add(flame);
  const light = new THREE.PointLight('#ffa047', 2.4, 7, 2); light.position.y = 0.8; g.add(light);
  return g;
}
function temple() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) { const slab = shadowed(new THREE.Mesh(new THREE.BoxGeometry(2.2 - i * 0.5, 0.35, 1.6 - i * 0.35), flat(i % 2 ? P.stone : P.stoneDark))); slab.position.y = 0.18 + i * 0.35; g.add(slab); }
  for (const x of [-0.6, 0.6]) { const post = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.4, 6), flat(P.wood))); post.position.set(x, 1.6, 0); g.add(post); }
  const roof = shadowed(new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.7, 4), flat(P.leaf))); roof.position.y = 2.5; roof.rotation.y = Math.PI / 4; g.add(roof);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 12), new THREE.MeshStandardMaterial({ color: '#f2c14e', emissive: '#f2a53a', emissiveIntensity: 0.5 })); disc.rotation.x = Math.PI / 2; disc.position.set(0, 2.1, 0.75); g.add(disc);
  return g;
}
function mural() {
  const g = new THREE.Group();
  const slab = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.2, 0.25), flat(P.stone))); slab.position.y = 0.6; g.add(slab);
  const paint = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.9), flat('#efe3c8')); paint.position.set(0, 0.62, 0.13); g.add(paint);
  for (const [x, y, c] of [[-0.25, 0.4, '#c9563c'], [0.22, 0.75, '#4a8ac9'], [0.2, 0.35, '#5aa86b']]) { const h = new THREE.Mesh(new THREE.CircleGeometry(0.12, 8), flat(c)); h.position.set(x, y, 0.14); g.add(h); }
  return g;
}
function pond() {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.9, 0.08, 18), flat(P.sand)); rim.position.y = 0.0; g.add(rim);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.06, 18), new THREE.MeshStandardMaterial({ color: P.water, roughness: 0.2, transparent: true, opacity: 0.9 })); water.position.y = 0.06; g.add(water);
  return g;
}
function generic(kind) {
  switch (kind) {
    case 'reeds': { const g = new THREE.Group(); for (let i = 0; i < 7; i++) { const r = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.1 + (i % 3) * 0.2, 4), flat(P.leaf2))); r.position.set((i - 3) * 0.14, 0.6, (i % 2) * 0.12); r.rotation.z = (i - 3) * 0.06; g.add(r); } return g; }
    case 'clay': { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.12, 9), flat('#b9865c')); m.position.y = 0.06; m.receiveShadow = true; return m; }
    case 'garden': { const g = new THREE.Group(); const bed = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.16, 1.0), flat('#6e4a2c')); bed.position.y = 0.08; bed.receiveShadow = true; g.add(bed); for (let i = 0; i < 6; i++) { const s = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 5), flat(P.leaf2))); s.position.set(-0.65 + (i % 3) * 0.65, 0.3, i < 3 ? -0.25 : 0.25); g.add(s); } return g; }
    case 'wall': { const g = new THREE.Group(); for (let i = 0; i < 5; i++) { const r = rock(0.26, i % 2 === 0); r.position.set(-0.8 + i * 0.4, r.position.y, 0); g.add(r); } return g; }
    case 'hearth': { const g = fire(); const ring = new THREE.Group(); for (let i = 0; i < 7; i++) { const r = rock(0.14); r.position.set(Math.cos(i / 7 * 6.28) * 0.55, r.position.y, Math.sin(i / 7 * 6.28) * 0.55); ring.add(r); } g.add(ring); return g; }
    case 'totem': { const g = new THREE.Group(); const post = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 2.2, 7), flat(P.wood))); post.position.y = 1.1; g.add(post); const top = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.5, 4), flat('#f2b632'))); top.position.y = 2.45; g.add(top); return g; }
    case 'raft': { const g = new THREE.Group(); for (let i = 0; i < 4; i++) { const log = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.2, 5), flat(P.wood))); log.rotation.x = Math.PI / 2; log.position.set(-0.3 + i * 0.2, 0.1, 0); g.add(log); } return g; }
    case 'grave': { const m = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.45, 0.1), flat(P.stoneDark))); m.position.y = 0.22; return m; }
    case 'gift': { const m = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), flat('#e0864a'))); m.position.y = 0.15; return m; }
    case 'curio': { const m = shadowed(new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), new THREE.MeshStandardMaterial({ color: '#b9a0f0', emissive: '#7a5ab6', emissiveIntensity: 0.3, flatShading: true }))); m.position.y = 0.3; return m; }
    case 'sprout': { const m = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 5), flat(P.sprout))); m.position.y = 0.2; return m; }
    case 'snowman': { const g = new THREE.Group(); [[0.45, 0.45], [0.32, 1.1]].forEach(([s, y]) => { const b = shadowed(new THREE.Mesh(new THREE.SphereGeometry(s, 8, 6), flat('#f7fbff'))); b.position.y = y; g.add(b); }); return g; }
    case 'fish': { const m = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 5), flat('#9cc0d6')); m.rotation.z = Math.PI / 2; m.position.y = -0.6; return m; }
    case 'ruin': return stones(3);
    case 'scorch': { const m = new THREE.Mesh(new THREE.CircleGeometry(0.9, 10), flat('#3a2a20')); m.rotation.x = -Math.PI / 2; m.position.y = 0.02; return m; }
    default: return rock(0.3);
  }
}
function objectMesh(o) {
  switch (o.kind) {
    case 'tree': return tree(Number(o.id.slice(1)) || 1);
    case 'bush': return bush(o.state.berries || 0);
    case 'hut': return hut();
    case 'boulder': return rock(0.9, true);
    case 'stones': return stones(o.state.count || 1);
    case 'fire': return fire();
    case 'temple': return temple();
    case 'mural': return mural();
    case 'pond': return pond();
    default: return generic(o.kind);
  }
}

// ---- Wobblins: soft squashed blobs with a sprout and ink-dot eyes.
const eyeMat = new THREE.MeshStandardMaterial({ color: '#2a1d14', roughness: 0.4 });
const glintMat = new THREE.MeshBasicMaterial({ color: '#fffaf0' });
function wobblinMesh(w) {
  const coat = COATS[Math.floor((((w.look.hue || 0) % 360) + 360) % 360 / 36) % COATS.length];
  const g = new THREE.Group();
  const body = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 10), new THREE.MeshStandardMaterial({ color: coat, roughness: 0.85 })));
  body.scale.set(1.05, 0.92, 1); body.position.y = 0.58; body.name = 'body'; g.add(body);
  for (const sx of [-1, 1]) {
    const foot = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), flat(new THREE.Color(coat).offsetHSL(0, 0, -0.18)))); foot.scale.y = 0.5; foot.position.set(sx * 0.28, 0.08, 0.2); g.add(foot);
    const arm = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), flat(new THREE.Color(coat).offsetHSL(0, 0, -0.1)))); arm.scale.y = 1.5; arm.position.set(sx * 0.62, 0.5, 0.1); g.add(arm);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), eyeMat); eye.scale.set(0.8, 1.1, 0.6); eye.position.set(sx * 0.22, 0.72, 0.56); g.add(eye);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), glintMat); glint.position.set(sx * 0.22 + 0.025, 0.76, 0.615); g.add(glint);
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.08, 8), new THREE.MeshBasicMaterial({ color: '#e88a8f', transparent: true, opacity: 0.55 })); blush.position.set(sx * 0.38, 0.55, 0.52); blush.rotation.y = sx * 0.6; g.add(blush);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 6, 10, Math.PI), eyeMat); mouth.rotation.z = Math.PI; mouth.position.set(0, 0.5, 0.6); g.add(mouth);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.22, 5), flat('#5e8f3a')); stem.position.y = 1.22; g.add(stem);
  for (const sx of [-1, 1]) { const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.11, 7, 5), flat(P.sprout)); leaf.scale.set(1.5, 0.5, 0.8); leaf.position.set(sx * 0.13, 1.33, 0); leaf.rotation.z = sx * 0.5; g.add(leaf); }
  const scale = w.stage === 'baby' ? 0.62 : w.stage === 'elder' ? 0.95 : 1;
  g.scale.setScalar(scale);
  return g;
}

// ---- build from the sim ----------------------------------------------------------------
async function loadWorld() {
  const q = new URLSearchParams(location.search);
  if (q.get('devload')) {
    try { const save = parseSave(await (await fetch(q.get('devload'))).text()); return replay(save, save.lastSeenTick || 300); } catch { /* fall through */ }
  }
  const w = createWorld(Number(q.get('seed') || 14));
  for (let i = 0; i < Number(q.get('ticks') || 120); i++) tick(w);
  return w;
}
const world = await loadWorld();
const rs = renderState(world);
const OBJ = 1.6, WOB = 1.45;   // things read better a little larger than true scale
const things = new THREE.Group(); scene.add(things);
for (const o of rs.objects) {
  const m = objectMesh(o);
  const y = o.kind === 'pond' ? groundH(o.x, o.y) - 0.05 : groundH(o.x, o.y);
  m.position.set(X(o.x), y, Z(o.y));
  m.rotation.y = (Number(o.id.slice(1)) % 7) * 0.9;
  m.scale.multiplyScalar(OBJ);
  things.add(m);
}
const wobs = [];
for (const w of rs.wobblins) {
  const m = wobblinMesh(w);
  const r = rngFor(world.seed, 'w3d', w.id);
  const x = w.x + (r() - 0.5) * 20, y = w.y + (r() - 0.5) * 12;
  m.position.set(X(x), groundH(x, y), Z(y));
  m.rotation.y = (r() - 0.5) * 1.4;
  m.scale.multiplyScalar(WOB);
  m.userData = { phase: r() * 6.28, face: faceOf(world.wobblins.find(q => q.id === w.id)) };
  things.add(m); wobs.push(m);
}

// ---- controls + loop -----------------------------------------------------------------------
let drag = null;
renderer.domElement.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; });
window.addEventListener('pointermove', e => { if (!drag) return; yaw -= (e.clientX - drag.x) * 0.005; pitch = Math.max(0.25, Math.min(1.2, pitch + (e.clientY - drag.y) * 0.004)); drag = { x: e.clientX, y: e.clientY }; placeCamera(); });
window.addEventListener('pointerup', () => { drag = null; });
renderer.domElement.addEventListener('wheel', e => { dist = Math.max(14, Math.min(80, dist * (1 + e.deltaY * 0.001))); placeCamera(); e.preventDefault(); }, { passive: false });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

function frame(t) {
  const s = t / 1000;
  for (const m of wobs) { const k = 1 + Math.sin(s * 2.2 + m.userData.phase) * 0.035; const body = m.getObjectByName('body'); if (body) body.scale.set(1.05 / k, 0.92 * k, 1 / k); }
  things.traverse(o => { if (o.name === 'flame') { o.scale.set(1 + Math.sin(s * 9) * 0.12, 1 + Math.sin(s * 13) * 0.18, 1); o.rotation.y = s * 2; } });
  if (riverMat) riverMat.color.copy(P.water).offsetHSL(0, 0, Math.sin(s * 1.3) * 0.02);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__scene = { scene, camera, renderer, world };
