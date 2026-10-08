// test-recap.js — "While you were away", built only from the log.
import assert from 'node:assert/strict';
import { createWorld, tick, applyAction } from '../src/sim/index.js';
import { buildRecap, buildRecapInput, keeperCause, recapEvents } from '../src/sim/recap.js';
import { narrateRecap } from '../src/ai/narrate.js';
import { generousActions, runScript, section, ok } from './lib.js';

const isDisc = e => e.kind === 'discovery' || e.kind === 'rediscovery';

section('Recap over many windows');
{
  let windows = 0, keeperLines = 0, salientWindows = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const w = createWorld(seed);
    runScript(w, 400, generousActions);
    const names = new Set(w.wobblins.map(x => x.name));
    for (const [from, len] of [[0, 8], [20, 6], [60, 12], [150, 9], [300, 48], [390, 10]]) {
      const to = from + len;
      const r = buildRecap(w, from, to);
      windows++;
      assert.ok(r.header.startsWith(`You were gone ${len} hours. ${len} days passed in ${w.colonyName}.`));
      assert.ok(r.lines.length >= 1 && r.lines.length <= 7, 'line count ' + r.lines.length);
      const inWindow = new Set(recapEvents(w, from, to).map(e => e.id));
      const salient = recapEvents(w, from, to).filter(e => e.salience >= 2 && !['taught', 'experiment_failed', 'offering'].includes(e.kind));
      if (salient.length >= 3) { salientWindows++; assert.ok(r.lines.length >= 3, 'at least 3 lines when salient events exist'); }

      for (const l of r.lines) {
        assert.ok(l.text.length <= 280);
        // Every line cites events from the window...
        for (const id of l.eventIds) assert.ok(inWindow.has(id), 'cites an event outside the window');
        // ...and names only Wobblins involved in what it cites.
        const cited = l.eventIds.map(id => w.events[id - 1]);
        const allowed = new Set(cited.flatMap(e => e.actors.concat(e.data.owner ? [e.data.owner] : [], e.data.previousInventor ? [e.data.previousInventor] : []))
          .map(id => w.wobblins.find(x => x.id === id)).filter(Boolean).map(x => x.name));
        for (const n of names) {
          if (new RegExp('\\b' + n + '\\b').test(l.text)) assert.ok(allowed.has(n), `"${l.text}" names ${n}, who is not in its events`);
        }
        // A causal "your ..." claim only where keeperRoot finds that link.
        if (/\byour\b/i.test(l.text) && cited.length === 1 && isDisc(cited[0])) {
          assert.ok(keeperCause(w, cited[0]), 'Keeper-cause line without a Keeper root: ' + l.text);
          keeperLines++;
        }
        if (cited.length === 1 && cited[0].kind === 'discovery' && !keeperCause(w, cited[0])) {
          assert.ok(!/\byour\b/i.test(l.text), 'claims a Keeper cause it does not have: ' + l.text);
        }
      }
      // Discoveries lead.
      const BATCH = ['taught', 'offering', 'experiment_failed'];
      const kinds = r.lines.map(l => l.eventIds.length === 1 && !BATCH.includes(w.events[l.eventIds[0] - 1].kind) ? w.events[l.eventIds[0] - 1].kind : 'batch');
      const firstNonDisc = kinds.findIndex(k => k !== 'discovery' && k !== 'rediscovery');
      if (firstNonDisc >= 0) assert.ok(kinds.slice(firstNonDisc).every(k => k !== 'discovery' && k !== 'rediscovery'), 'discoveries first');
      // A Keeper-consequence line appears when any discovery in the window has a root.
      const rooted = recapEvents(w, from, to).filter(e => e.kind === 'discovery' && keeperCause(w, e));
      if (rooted.length) assert.ok(r.lines.some(l => l.eventIds.some(id => rooted.some(e => e.id === id))), 'missing Keeper-consequence line');
      // At most 2 lines per kind.
      const per = {};
      for (const k of kinds) if (k !== 'batch') per[k === 'rediscovery' ? 'discovery' : k] = (per[k === 'rediscovery' ? 'discovery' : k] || 0) + 1;
      // (The cap gives way only to reach 3 single-event lines.)
      const singles = kinds.filter(k => k !== 'batch').length;
      if (singles > 3) for (const k in per) assert.ok(per[k] <= 2, k + ' x' + per[k] + ' seed ' + seed + ' ' + from + ' ' + JSON.stringify(r.lines.map(l => l.text)));
    }
  }
  ok(windows + ' recaps: 1-7 lines (3+ when 3+ salient events, ' + salientWindows + ' windows), only cited, in-window events and their own Wobblins');
  ok('discoveries lead, at most 2 lines per kind, and ' + keeperLines + ' "your ..." lines all have a Keeper root');
}

section('Quiet days and templates');
{
  const w = createWorld(5, { barren: true });
  const r = buildRecap(w, 0, 0);
  assert.deepEqual(r.lines.map(l => l.text), ['A quiet stretch. Everyone ate, napped, and hummed.']);
  assert.ok(r.stats && r.stats.discoveries === 0);
  ok('zero events: the quiet-stretch line, with stats');

  // Same seed and log: identical recap (variants are seeded per event).
  const a = createWorld(9), b = createWorld(9);
  runScript(a, 120, generousActions); runScript(b, 120, generousActions);
  assert.deepEqual(buildRecap(a, 0, 120), buildRecap(b, 0, 120));
  ok('recaps are deterministic');
}

section('Scripted: lightning, then Fire Warmth, told as a Keeper story');
{
  let told = null;
  for (let seed = 1; seed <= 200 && !told; seed++) {
    const w = createWorld(seed, { barren: true });
    applyAction(w, { seq: 1, t: 0, type: 'power', power: 'lightning', slot: 'meadow.2' });
    for (let i = 0; i < 6; i++) tick(w);
    const fw = w.events.find(e => e.kind === 'discovery' && e.target === 'fire_warmth');
    if (!fw || w.events.some(e => e.kind === 'lightning')) continue;
    const r = buildRecap(w, 0, 6);
    const line = r.lines.find(l => l.eventIds.includes(fw.id));
    assert.ok(line, 'fire warmth is in the recap');
    assert.match(line.text, /lightning storm/);
    assert.equal(r.lines[0], line, 'and it leads');
    told = line.text;
  }
  assert.ok(told);
  ok('"' + told + '"');
}

section('AI stub and recap input');
{
  const w = createWorld(12);
  runScript(w, 200, generousActions);
  const input = buildRecapInput(w, 100, 130);
  JSON.parse(JSON.stringify(input));
  const ids = new Set(input.events.map(e => e.id));
  for (const l of input.templateLines) for (const id of l.eventIds) assert.ok(ids.has(id) || l.eventIds.length > 1);
  for (const e of input.events) for (const a of e.actors) assert.ok(input.wobblins.some(x => x.id === a), 'actor profile included');
  const out = await narrateRecap(input);
  assert.equal(out.source, 'template');
  assert.ok(out.lines.length >= 1 && out.lines.length <= 7);
  ok('recapInput is plain JSON with every actor profiled; narrate stub returns the template lines');
}

console.log('\ntest-recap: all passed');
