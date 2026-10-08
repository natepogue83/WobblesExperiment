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
}

console.log('\ntest-render: all passed');
