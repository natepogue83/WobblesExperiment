// test-render.js — renderState is pure; drawSVG gives every living Wobblin and
// live object a stable element id, in the specified layer order.
import assert from 'node:assert/strict';
import { createWorld, stateHash } from '../src/sim/index.js';
import { renderState, drawSVG, LAYERS } from '../src/render/render.js';
import { wobblinSVG, objectSVG } from '../src/render/sprites.js';
import { generousActions, runScript, section, ok } from './lib.js';

// A tiny DOM: enough for drawSVG (createElementNS, attributes, innerHTML).
class El {
  constructor(tag) { this.tag = tag; this.attrs = {}; this.children = []; this.inner = ''; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  appendChild(c) { this.children.push(c); return c; }
  append(...cs) { for (const c of cs) this.children.push(c); }
  replaceChildren() { this.children = []; }
  set innerHTML(s) { this.inner = s; }
  get innerHTML() { return this.inner; }
  get id() { return this.attrs.id; }
  all() { return [this, ...this.children.flatMap(c => c.all())]; }
}
globalThis.document = { createElementNS: (ns, tag) => new El(tag) };

section('Render');
{
  const expected = ['sky', 'hills', 'terrain', 'nature', 'structures', 'wobblins', 'effects', 'halos'];
  assert.deepEqual(LAYERS, expected);
  let checked = 0, kinds = new Set();
  for (const seed of [1, 4, 7, 11, 23]) {
    const w = createWorld(seed);
    runScript(w, 500, generousActions, world => {
      if (world.tick % 25 !== 0) return;
      const before = stateHash(world);
      const rs = renderState(world);
      assert.equal(stateHash(world), before, 'renderState must not change the world');
      JSON.parse(JSON.stringify(rs));
      const svg = new El('svg');
      for (const hour of [3, 12, 19]) {
        drawSVG(svg, rs, { hour, highlight: rs.wobblins.slice(0, 1).map(x => x.id) });
        assert.deepEqual(svg.children.map(c => c.id), expected.map(l => 'layer-' + l), 'layer order');
        const ids = new Set(svg.all().map(e => e.id).filter(Boolean));
        for (const x of world.wobblins.filter(x => x.alive)) assert.ok(ids.has(x.id), 'wobblin ' + x.id + ' has an element');
        for (const o of world.objects.filter(o => !o.state.gone)) { assert.ok(ids.has(o.id), o.kind + ' ' + o.id + ' has an element'); kinds.add(o.kind); }
        assert.ok(ids.has('halo-' + rs.wobblins[0]?.id) || !rs.wobblins.length);
      }
      checked++;
    });
  }
  ok(checked + ' frames: layer order ' + expected.join(' > ') + '; every living Wobblin and live object has an element id');
  ok('object kinds drawn: ' + [...kinds].sort().join(', '));

  // Every object kind has art (no placeholder circles).
  for (const k of ['boulder', 'stones', 'tree', 'bush', 'sprout', 'fire', 'pond', 'reeds', 'clay', 'fish', 'curio', 'gift', 'hearth', 'hut', 'wall', 'garden', 'raft', 'totem', 'temple', 'mural', 'grave', 'ruin', 'scorch', 'snowman']) {
    const svg = objectSVG({ kind: k, state: { curio: 'flint', size: 1, berries: 2 } });
    assert.ok(svg.length > 20 && !svg.includes('#c9a'), k + ' has its own art');
  }
  ok('all 24 object kinds have their own art');

  const w = createWorld(2);
  const a = wobblinSVG(w.wobblins[0]), b = wobblinSVG(w.wobblins[0]);
  assert.equal(a, b);
  assert.notEqual(wobblinSVG(w.wobblins[0]), wobblinSVG(w.wobblins[1]));
  ok('Wobblin sprites are deterministic and differ by seeded look');

  // What happened to them shows on them: paint, river water, rain gear, a knitted hat.
  const base = w.wobblins[0];
  const dressed = wobblinSVG({ ...base, paint: 2, wet: true, rain: 'leaf', hat: true });
  for (const cls of ['class="paint"', 'class="drips"', 'class="leaf-umbrella"', 'class="knit-hat"']) assert.ok(dressed.includes(cls), cls);
  assert.ok(wobblinSVG({ ...base, rain: 'splash' }).includes('class="puddle-splash"'));
  assert.ok(!wobblinSVG(base).includes('knit-hat') && !wobblinSVG(base).includes('drips'));
  const rw = createWorld(2);
  rw.climate.rain = 3; rw.climate.season = 'cold';
  rw.wobblins[0].knows.weaving = { at: 0 };
  const rr = renderState(rw);
  assert.ok(rr.wobblins.every(x => x.rain === 'leaf' || x.rain === 'splash'));
  assert.equal(rr.wobblins.find(x => x.id === rw.wobblins[0].id).hat, true);
  assert.ok(rr.wobblins.filter(x => x.id !== rw.wobblins[0].id).every(x => !x.hat));
  ok('paint, river water, leaf umbrellas, puddle splashes and knitted hats show on the sprite');
}

section('Painted art drops in over the vector art');
{
  const { setPainted, paintedObject, paintedBackdrop } = await import('../src/render/painted.js');
  const w = createWorld(3);
  const vectorHut = objectSVG({ kind: 'hut', state: {} });
  const vectorBody = wobblinSVG(w.wobblins[0]);
  setPainted({
    objects: { hut: { src: 'art/objects/hut.png', w: 80, h: 66, ax: 40, ay: 62, variants: { smoke: 'art/objects/hut-smoke.png' } } },
    wobblins: { any: { src: 'art/wobblins/body-any.png', w: 68, h: 62, ax: 34, ay: 56 } },
    backdrop: { day: 'art/valley-day.png', cold: 'art/valley-cold.png' }
  });
  const hut = objectSVG({ kind: 'hut', state: {} });
  assert.ok(hut.includes('<image class="painted" href="art/objects/hut.png"') && hut.includes('x="-40"') && hut.includes('y="-62"'), 'painted hut');
  assert.ok(objectSVG({ kind: 'hut', state: { smoke: true } }).includes('hut-smoke.png'), 'a variant picks another file');
  assert.equal(paintedObject({ kind: 'tree', state: {} }), null, 'unpainted kinds stay vector');
  assert.ok(objectSVG({ kind: 'tree', state: {} }).includes('<'), 'tree still draws');
  const body = wobblinSVG(w.wobblins[0]);
  assert.ok(body.includes('body-any.png') && body.includes('class="eyes"') && body.includes('class="sprout"'), 'painted body keeps the game-drawn face and sprout');
  assert.ok(!body.includes('class="arm l"'), 'the vector body kit is replaced');
  assert.equal(paintedBackdrop({ tod: 'dusk', season: 'mild', wet: false }), 'art/valley-day.png', 'missing light falls back to day');
  assert.equal(paintedBackdrop({ tod: 'day', season: 'cold', wet: true }), 'art/valley-cold.png');
  setPainted(null);
  assert.equal(objectSVG({ kind: 'hut', state: {} }), vectorHut);
  assert.equal(wobblinSVG(w.wobblins[0]), vectorBody);
  ok('a manifest swaps huts, bodies and the valley for paintings, with variants and fallbacks; no manifest, no change');
}

console.log('\ntest-render: all passed');
