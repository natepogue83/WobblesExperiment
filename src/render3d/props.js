// render3d/props.js — the low-poly props: trees, huts, rocks, fire, temple...
// Shared by the valley look test and the lab view. Pure builders: call, get a Mesh or Group.
import * as THREE from 'three';

// ---- palette: gouache, not plastic.
export const P = {
  grass: new THREE.Color('#8fb35a'), grassDark: new THREE.Color('#6f9446'), grassLight: new THREE.Color('#b3cc74'),
  hill: new THREE.Color('#a8bf63'), sand: new THREE.Color('#d9c48f'), water: new THREE.Color('#5c9fcf'),
  trunk: '#8a5a34', leaf: '#5e9344', leaf2: '#7fae55', thatch: '#d6a556', wood: '#9a6a3c', stone: '#9b948a', stoneDark: '#7a746b',
  berry: '#c9435f', fire: '#ff9a3c', sprout: '#8fd16b'
};
export const COATS = ['#a3c98c', '#cbd77f', '#f0cf7c', '#ecaa82', '#e8a3aa', '#c5a9d8', '#9fb7da', '#90c9c1', '#dcbd95', '#b9cba5'];


export const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95, metalness: 0, ...extra });

// ---- things ------------------------------------------------------------------------
export function shadowed(mesh) { mesh.castShadow = true; mesh.receiveShadow = true; return mesh; }
export function tree(seed) {
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
export function bush(berries) {
  const g = new THREE.Group();
  for (const [x, z, s] of [[0, 0, 0.5], [-0.35, 0.1, 0.36], [0.33, -0.08, 0.38]]) {
    const m = shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), flat(P.leaf))); m.position.set(x, s * 0.9, z); g.add(m);
  }
  for (let i = 0; i < Math.min(5, berries); i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), flat(P.berry)); b.position.set(-0.3 + i * 0.15, 0.6 + (i % 2) * 0.2, 0.35); g.add(b);
  }
  return g;
}
export function hut() {
  const g = new THREE.Group();
  const wall = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.9, 10), flat(P.wood))); wall.position.y = 0.45; g.add(wall);
  const roof = shadowed(new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.3, 10), flat(P.thatch))); roof.position.y = 1.5; g.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.1), new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#ff9a3c', emissiveIntensity: 0.7 })); door.position.set(0, 0.32, 1.0); g.add(door);
  return g;
}
export function rock(size, dark = false) { const m = shadowed(new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), flat(dark ? P.stoneDark : P.stone))); m.position.y = size * 0.7; m.scale.y = 0.75; return m; }
export function stones(count) {
  const g = new THREE.Group();
  for (let i = 0; i < Math.max(1, Math.min(4, count)); i++) { const s = rock(0.22 - i * 0.03, i % 2 === 1); s.position.set((i % 2 ? 0.2 : -0.15) * (i > 1 ? -1 : 1), s.position.y + i * 0.22, (i > 1 ? 0.15 : -0.1)); g.add(s); }
  return g;
}
export function fire() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) { const log = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.7, 5), flat(P.trunk))); log.rotation.z = Math.PI / 2; log.rotation.y = i * 1.05; log.position.y = 0.08; g.add(log); }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.7, 6), new THREE.MeshStandardMaterial({ color: P.fire, emissive: '#ff6a1a', emissiveIntensity: 1.6, flatShading: true })); flame.position.y = 0.45; flame.name = 'flame'; g.add(flame);
  const light = new THREE.PointLight('#ffa047', 2.4, 7, 2); light.position.y = 0.8; g.add(light);
  return g;
}
export function temple() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) { const slab = shadowed(new THREE.Mesh(new THREE.BoxGeometry(2.2 - i * 0.5, 0.35, 1.6 - i * 0.35), flat(i % 2 ? P.stone : P.stoneDark))); slab.position.y = 0.18 + i * 0.35; g.add(slab); }
  for (const x of [-0.6, 0.6]) { const post = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.4, 6), flat(P.wood))); post.position.set(x, 1.6, 0); g.add(post); }
  const roof = shadowed(new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.7, 4), flat(P.leaf))); roof.position.y = 2.5; roof.rotation.y = Math.PI / 4; g.add(roof);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 12), new THREE.MeshStandardMaterial({ color: '#f2c14e', emissive: '#f2a53a', emissiveIntensity: 0.5 })); disc.rotation.x = Math.PI / 2; disc.position.set(0, 2.1, 0.75); g.add(disc);
  return g;
}
export function mural() {
  const g = new THREE.Group();
  const slab = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.2, 0.25), flat(P.stone))); slab.position.y = 0.6; g.add(slab);
  const paint = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.9), flat('#efe3c8')); paint.position.set(0, 0.62, 0.13); g.add(paint);
  for (const [x, y, c] of [[-0.25, 0.4, '#c9563c'], [0.22, 0.75, '#4a8ac9'], [0.2, 0.35, '#5aa86b']]) { const h = new THREE.Mesh(new THREE.CircleGeometry(0.12, 8), flat(c)); h.position.set(x, y, 0.14); g.add(h); }
  return g;
}
export function pond() {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.9, 0.08, 18), flat(P.sand)); rim.position.y = 0.0; g.add(rim);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.06, 18), new THREE.MeshStandardMaterial({ color: P.water, roughness: 0.2, transparent: true, opacity: 0.9 })); water.position.y = 0.06; g.add(water);
  return g;
}
export function generic(kind) {
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
export function objectMesh(o) {
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

