// render3d/main.js — a 3D look test: the same valley and the same sim, drawn
// with Three.js as a small stylized low-poly diorama. Soft warm light, long
// shadows, chunky shapes. Nothing here touches the sim.
import * as THREE from 'three';
import { createWorld, tick, replay } from '../sim/index.js';
import { renderState, faceOf } from '../render/render.js';
import { ZONES, RIVER } from '../sim/geometry.js';
import { parseSave } from '../ui/save.js';
import { rngFor } from '../sim/rng.js';
import { P, COATS, flat, shadowed, objectMesh } from './props.js';

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
