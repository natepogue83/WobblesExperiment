// lab/view.js — watch the lab world live in 3D. The sim runs in the page; the
// scene is rebuilt from it every step. Click ground to put down what you have
// chosen (a glowing lump, sticks, grass, stones); click a creature to read what
// it believes. Nothing here changes the sim except the Keeper verbs.
import * as THREE from 'three';
import { W, H, DAY, MATERIALS, cellAt, live, isNight } from './world.js';
import { newColony, step, keeperPlace, fireReport, fireStory } from './sim.js';
import { beliefs } from './creature.js';

const q = new URLSearchParams(location.search);
const seed = Number(q.get('seed') || 2);
const world = newColony(seed, 6);
let speedMs = 350, running = true, tool = 'ember';

// ---- scene ------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 60 }); sun.shadow.bias = -0.0008; scene.add(sun);
const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95, ...extra });
const CELL = 1.0;
const X = x => (x - W / 2 + 0.5) * CELL, Z = y => (y - H / 2 + 0.5) * CELL;

// Ground tiles coloured by what they are; wet ones darken, hot ones glow a little.
const tiles = [];
{
  const geo = new THREE.BoxGeometry(CELL, 0.4, CELL);
  for (const c of world.cells) {
    const m = new THREE.Mesh(geo, flat('#8fb35a'));
    m.position.set(X(c.x), -0.2, Z(c.y)); m.receiveShadow = true; m.userData.cell = c; scene.add(m); tiles.push(m);
  }
  const rim = new THREE.Mesh(new THREE.BoxGeometry(W * CELL + 1.2, 1.2, H * CELL + 1.2), flat('#6b4a2e')); rim.position.y = -1.0; scene.add(rim);
}
function tileColor(c) {
  if (c.water) return new THREE.Color('#5c9fcf');
  const base = new THREE.Color(c.stony ? '#a9a398' : c.grass ? '#8fb35a' : '#a6bb6a');
  base.offsetHSL(0, 0, -c.wet * 0.12);
  if (c.heat > 0) base.lerp(new THREE.Color('#ffb060'), c.heat * 0.35);
  if (isNight(world)) base.offsetHSL(0, -0.1, -0.22);
  return base;
}

// ---- things ----------------------------------------------------------------------------
const OBJ_COLOR = { stone: '#9b948a', stick: '#8a5a34', grass: '#c9cf7a', log: '#7a4e2a', berry: '#c9435f', root: '#a07a4a', ember: '#ff9a3c' };
const objMeshes = new Map(), crMeshes = new Map();
function makeObj(o) {
  const g = new THREE.Group();
  let m;
  switch (o.kind) {
    case 'stone': m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), flat(OBJ_COLOR.stone)); m.position.y = 0.16; break;
    case 'stick': m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.7, 5), flat(OBJ_COLOR.stick)); m.rotation.z = Math.PI / 2; m.rotation.y = 0.6; m.position.y = 0.05; break;
    case 'grass': m = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.35, 5), flat(OBJ_COLOR.grass)); m.position.y = 0.17; break;
    case 'log': m = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.9, 7), flat(OBJ_COLOR.log)); m.rotation.z = Math.PI / 2; m.position.y = 0.15; break;
    case 'berry': m = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 5), flat(OBJ_COLOR.berry)); m.position.y = 0.09; break;
    case 'root': m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14, 0), flat(OBJ_COLOR.root)); m.position.y = 0.1; break;
    default: m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), new THREE.MeshStandardMaterial({ color: '#ff9a3c', emissive: '#ff5a1a', emissiveIntensity: 1.2, flatShading: true })); m.position.y = 0.18;
  }
  m.castShadow = true; m.receiveShadow = true; m.name = 'body'; g.add(m);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 6), new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#ff6a1a', emissiveIntensity: 1.6, flatShading: true }));
  flame.position.y = 0.5; flame.name = 'flame'; flame.visible = false; g.add(flame);
  const light = new THREE.PointLight('#ffa047', 0, 4, 2); light.position.y = 0.6; light.name = 'light'; g.add(light);
  g.userData.obj = o;
  return g;
}
const COATS = ['#a3c98c', '#f0cf7c', '#ecaa82', '#e8a3aa', '#c5a9d8', '#9fb7da', '#90c9c1', '#dcbd95'];
function makeCreature(c, i) {
  const g = new THREE.Group();
  const coat = COATS[i % COATS.length];
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 9), new THREE.MeshStandardMaterial({ color: coat, roughness: 0.85 }));
  body.scale.set(1.05, 0.9, 1); body.position.y = 0.28; body.castShadow = true; body.name = 'body'; g.add(body);
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#2a1d14' });
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), eyeMat); e.position.set(sx * 0.11, 0.35, 0.27); g.add(e); }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.12, 4), flat('#5e8f3a')); stem.position.y = 0.6; g.add(stem);
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), flat('#8fd16b')); leaf.scale.set(1.6, 0.5, 0.8); leaf.position.y = 0.66; g.add(leaf);
  const held = new THREE.Group(); held.position.set(0.3, 0.3, 0.2); held.name = 'held'; g.add(held);
  g.userData.creature = c;
  return g;
}

function sync() {
  for (const [i, c] of world.cells.entries()) tiles[i].material.color.copy(tileColor(c));
  const seen = new Set();
  for (const o of live(world)) {
    seen.add(o.id);
    let g = objMeshes.get(o.id);
    if (!g) { g = makeObj(o); scene.add(g); objMeshes.set(o.id, g); }
    const body = g.getObjectByName('body');
    if (g.userData.kind !== o.kind) { g.userData.kind = o.kind; const n = makeObj(o); g.remove(body); n.getObjectByName('body').name = 'body'; g.add(n.getObjectByName('body')); }
    g.visible = !o.held;
    const jitter = ((parseInt(o.id.slice(1)) * 7919) % 100) / 100 - 0.5;
    g.position.set(X(o.x) + jitter * 0.5, 0, Z(o.y) + ((parseInt(o.id.slice(1)) * 104729) % 100 / 100 - 0.5) * 0.5);
    const b = g.getObjectByName('body'); if (b && b.material.color) { b.material.color.set(OBJ_COLOR[o.kind] || '#999'); if (o.wet > 0.35) b.material.color.offsetHSL(0, 0, -0.18); }
    g.getObjectByName('flame').visible = o.burning > 0;
    g.getObjectByName('light').intensity = o.burning > 0 ? 2 : 0;
  }
  for (const [id, g] of objMeshes) if (!seen.has(id)) { scene.remove(g); objMeshes.delete(id); }
  world.creatures.forEach((c, i) => {
    let g = crMeshes.get(c.id);
    if (!g) { g = makeCreature(c, i); scene.add(g); crMeshes.set(c.id, g); }
    g.userData.tx = X(c.x); g.userData.tz = Z(c.y);
    g.visible = c.alive;
    const held = g.getObjectByName('held'); held.clear();
    if (c.carrying) { const m = makeObj(c.carrying).getObjectByName('body'); m.scale.setScalar(0.7); m.position.set(0, 0, 0); held.add(m); }
  });
  sun.intensity = isNight(world) ? 0.5 : 2.0; hemi.intensity = isNight(world) ? 0.35 : 0.9;
  scene.background.set(isNight(world) ? '#2b3550' : '#d8e9f1'); scene.fog.color.copy(scene.background);
}

// ---- hud ---------------------------------------------------------------------------------
const hud = document.getElementById('hud'), lines = document.getElementById('lines'), who = document.getElementById('who');
let shownLines = 0, selected = null;
function drawHud() {
  const rep = fireReport(world);
  hud.innerHTML = `<b>Wobblins lab · seed ${seed}</b>Day ${Math.floor(world.tick / DAY) + 1}, ${isNight(world) ? 'night' : 'day'}${world.weather.rain ? ', raining' : ''} · ${rep.living}/6 alive<br>` +
    (rep.alive ? `Fire burning, fuel ${rep.fuel}, fed ${rep.feeds} times` : rep.feeds ? `No fire now; it was fed ${rep.feeds} times` : 'No fire') +
    `<br><span class="muted">Click the ground to put down:</span><br>` +
    ['ember', 'stick', 'grass', 'stone', 'berry'].map(k => `<button data-tool="${k}" class="${tool === k ? 'on' : ''}">${k === 'ember' ? 'glowing lump' : k}</button>`).join('') +
    `<br><button data-act="rain">Rain</button><button data-act="pause">${running ? 'Pause' : 'Run'}</button><button data-act="fast">${speedMs < 200 ? 'Slow' : 'Fast'}</button>`;
  const story = fireStory(world);
  if (story.length !== shownLines) { lines.innerHTML = story.map(l => `<p>${l}</p>`).join(''); shownLines = story.length; lines.scrollTop = lines.scrollHeight; }
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
  if (b.dataset.act === 'fast') speedMs = speedMs < 200 ? 350 : 80;
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
  const hitC = ray.intersectObjects([...crMeshes.values()], true)[0];
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
    g.position.x += (g.userData.tx - g.position.x) * 0.15; g.position.z += (g.userData.tz - g.position.z) * 0.15;
    const b = g.getObjectByName('body'); const k = 1 + Math.sin(s * 3 + g.position.x) * 0.04; b.scale.set(1.05 / k, 0.9 * k, 1 / k);
    const moving = Math.abs(g.userData.tx - g.position.x) + Math.abs(g.userData.tz - g.position.z) > 0.02;
    if (moving) g.lookAt(g.userData.tx, g.position.y, g.userData.tz);
  }
  for (const g of objMeshes.values()) { const f = g.getObjectByName('flame'); if (f.visible) { f.scale.set(1 + Math.sin(s * 9) * 0.12, 1 + Math.sin(s * 13) * 0.2, 1); f.rotation.y = s * 2; } }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
sync(); drawHud(); requestAnimationFrame(frame);
window.__lab = { world, scene };
