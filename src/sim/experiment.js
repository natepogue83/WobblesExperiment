// experiment.js — the discovery engine. The ONLY module that may add knowledge
// (world.discoveries, wobblin.knows) or emit knowledge events (rule zero).
//
// Per tick: experiments (candidates -> scores -> attempt -> success or
// failure), pondering, then teaching, learning from structures, forgetting.
import { KNOWLEDGE, emit } from './events.js';
import { EXPERIMENT, TEACH } from './constants.js';
import { rngFor, weightedPick } from './rng.js';
import { ADJACENT } from './geometry.js';
import { alive, liveObjects, sortedKeys, r3, clamp } from './util.js';
import { DISCOVERIES, BY_ID, prereqsMet } from './discoveries.js';
import { trait } from './creatures.js';
import { isWet } from './nature.js';
import { applyDiscoveryEffect, embodimentIndex, embodimentsFrom } from './effects.js';
import { keeperRoot } from './causes.js';
import { onExperimentFailed, onExperimentSucceeded, FIRE_DISCOVERIES } from './misfires.js';

// ---------------------------------------------------------------- context
// Built once per tick so every Wobblin scores against the same snapshot.
function makeContext(world) {
  const live = alive(world);
  const objs = liveObjects(world);
  const byZone = {};
  for (const o of objs) (byZone[o.zone] ||= []).push(o);
  const wobZone = {};
  for (const w of live) (wobZone[w.zone] ||= []).push(w);
  const knownByLiving = new Set();
  for (const w of live) for (const d of Object.keys(w.knows)) knownByLiving.add(d);
  const avgFood = live.length ? live.reduce((s, w) => s + w.needs.food, 0) / live.length : 0;
  // Open = nobody living knows it and no structure is holding it.
  const open = DISCOVERIES.filter(d => !knownByLiving.has(d.id) && !(world.discoveries[d.id] && !world.discoveries[d.id].forgotten));
  return { world, live, objs, byZone, wobZone, knownByLiving, avgFood, wet: isWet(world), tokenCache: {}, open };
}

function itemOf(o) {
  if (o.kind === 'curio') return o.state.curio;
  if (o.kind === 'gift') return o.state.giftId === 'flint_stone' ? 'flint' : o.state.giftId;
  return null;
}

function tokenMatches(o, token) {
  if (token === 'kept_fire') return (o.kind === 'fire' && o.state.kept) || o.kind === 'hearth';
  if (token === 'fire') return o.kind === 'fire' || o.kind === 'hearth';
  if (token.startsWith('item:')) return itemOf(o) === token.slice(5);
  return o.kind === token;
}

// Cached per tick: live objects in zone z matching token.
function tokenIndex(ctx, z, token) {
  const zc = ctx.tokenCache[z] ||= {};
  let v = zc[token];
  if (v === undefined) { v = (ctx.byZone[z] || []).filter(o => tokenMatches(o, token)); zc[token] = v; }
  return v;
}

function stoneCount(o) {
  if (o.kind === 'stones') return o.state.count || 1;
  if (o.kind === 'boulder') return 4;
  if (o.kind === 'wall') return 2;
  return 0;
}

function conditionMet(ctx, w, c) {
  const here = ctx.wobZone[w.zone] || [];
  const t = ctx.world.tick;
  switch (c) {
    case 'elder_and_young':
      return here.some(x => x.stage === 'elder') && here.some(x => x.stage === 'baby' || t - x.bornTick < 40);
    case 'surplus': return ctx.avgFood > 0.6;
    case 'witnessed': return !!w.witnessed;
    case 'faith': return w.faith > 0.5;
    case 'clear': return ctx.world.climate.rain === 0;
    case 'injured': return ctx.live.some(x => x.injuries > 0);   // someone in the colony is hurt
  }
  return false;
}

// Does the Wobblin's spot satisfy d's stimuli? Returns null, or the
// contributing objects (closest first) and whether any are in the same zone.
export function stimulusMatch(ctx, w, d) {
  const reach = [w.zone, ...ADJACENT[w.zone]];
  const contrib = [];
  const conditions = [];
  let sameZone = false, extra = 0;
  for (const s of d.stimuli) {
    if (s.zone) {
      if (s.near ? !(w.zone === s.zone || ADJACENT[s.zone].includes(w.zone)) : w.zone !== s.zone) return null;
      continue;
    }
    if (s.wobblins) { if ((ctx.wobZone[w.zone] || []).length < s.wobblins) return null; continue; }
    if (s.condition) { if (!conditionMet(ctx, w, s.condition)) return null; conditions.push(s.condition); continue; }
    if (s.stones) {
      let n = 0;
      const used = [];
      for (const z of reach) for (const o of ctx.byZone[z] || []) {
        const c = stoneCount(o);
        if (c) { n += c; used.push(o); if (z === w.zone) sameZone = true; }
      }
      if (n < s.stones) return null;
      contrib.push(...used);
      extra += Math.max(0, used.length - 1);
      continue;
    }
    let found = [];
    for (const token of s.anyOf) {
      if (token === 'river') {
        if (reach.includes('riverbank')) { found.push({ virtual: 'river', zone: 'riverbank' }); if (w.zone === 'riverbank') sameZone = true; }
        continue;
      }
      if (token === 'wet') {
        if (ctx.wet) { found.push({ virtual: 'wet', zone: w.zone }); sameZone = true; conditions.push('wet'); }
        continue;
      }
      for (const z of reach) {
        const hits = tokenIndex(ctx, z, token);
        if (hits.length) { found.push(...hits); if (z === w.zone) sameZone = true; }
      }
    }
    if (!found.length) return null;
    extra += found.length - 1;
    found.sort((a, b) => (a.zone === w.zone ? 0 : 1) - (b.zone === w.zone ? 0 : 1));
    contrib.push(...found);
  }
  return { contrib, sameZone, extra, conditions };
}

function needFactor(w, d) {
  let f = 1;
  for (const k of d.needKeys) {
    const weight = d.drivers.needs[k];
    if (k === 'comfort') f *= 1 + weight * Math.max(0, w.needs.warmth - 0.5) * 2;
    else f *= 1 + 2 * weight * Math.max(0, (0.6 - w.needs[k]) / 0.6);
  }
  return Math.min(3, f);
}

function traitFactor(w, d, tick) {
  let sum = 0, wt = 0;
  for (const k of d.traitKeys) { sum += trait(w, k, tick) * d.drivers.traits[k]; wt += d.drivers.traits[k]; }
  let f = 0.4 + 1.2 * (wt ? sum / wt : 0.5);
  if (d.hobby && d.hobby === w.hobby) f *= 1.5;
  return f;
}

function primaryTrait(w, d, tick) {
  return d.primaryTrait ? trait(w, d.primaryTrait, tick) : 0.5;
}

function eligible(w) { return w.alive && w.injuries < 2; }

// Score every candidate for one Wobblin. Pure: no rolls, no writes.
export function scoreCandidates(ctx, w) {
  const world = ctx.world, t = world.tick;
  const out = [];
  const baby = w.stage === 'baby';
  for (const d of ctx.open) {
    if (w.knows[d.id] || ctx.knownByLiving.has(d.id)) continue;   // spreads by teaching instead
    if (w.tabooUntil > t && FIRE_DISCOVERIES.has(d.id)) continue;  // Fire Taboo
    if (baby && d.tier > 1) continue;
    if (!prereqsMet(d, w.knows)) continue;
    const m = stimulusMatch(ctx, w, d);
    if (!m) continue;
    let stim = (m.sameZone ? 1 : 0.7) + 0.2 * m.extra;
    const fresh = m.contrib.find(o => o.origin && (o.origin.action !== undefined || o.state.byKeeper) && t - o.builtTick <= 24);
    if (fresh) stim *= 1.5;
    if (w.activity === 'inspect' && m.contrib.some(o => o.id && w.seen.includes(o.id))) stim *= 1.5;
    stim = Math.min(2, stim);
    let nudge = 1;
    if (world.miracleUntil > t) nudge *= 2;
    if (m.contrib.some(o => o.kind === 'curio' && o.state.targets.includes(w.id))) nudge *= 1.5;
    else if (ctx.objs.some(o => o.kind === 'curio' && !o.state.pullDone && o.zone === w.zone && o.state.targets.includes(w.id))) nudge *= 1.5;
    if (m.contrib.some(o => o.kind === 'gift')) nudge *= 1.5;
    let social = 1;
    if (d.social) social = 1 + 0.15 * Math.max(0, (ctx.wobZone[w.zone] || []).length - 2);
    let score = EXPERIMENT.base[d.tier] * d.rate * traitFactor(w, d, t) * stim * needFactor(w, d) * nudge * social;
    if (baby) score *= EXPERIMENT.babyRate;
    if (w.stage === 'elder') score *= 0.6;
    if (w.activity === 'rest') score *= 0.5;     // dozing, half awake
    if (score > 0) out.push({ d, score, match: m });
  }
  return out;
}

export function pAttemptOf(cands) {
  let q = 1;
  for (const c of cands) q *= 1 - Math.min(0.9, c.score);
  return Math.min(EXPERIMENT.pAttemptCap, 1 - q);
}

// Debug overlay: per-Wobblin top candidates and probabilities. Pure.
export function experimentPreview(world) {
  const ctx = makeContext(world);
  return ctx.live.map(w => {
    const cands = eligible(w) ? scoreCandidates(ctx, w) : [];
    return {
      id: w.id, name: w.name, zone: w.zone, activity: w.activity,
      pAttempt: r3(pAttemptOf(cands)),
      top: cands.sort((a, b) => b.score - a.score).slice(0, 3)
        .map(c => ({ id: c.d.id, score: r3(c.score), pSuccess: r3(EXPERIMENT.successBase[c.d.tier] * (0.5 + 0.5 * primaryTrait(w, c.d, world.tick))) }))
    };
  });
}

// ---------------------------------------------------------------- causes
function lastEvent(world, pred) {
  for (let i = world.events.length - 1; i >= 0; i--) if (pred(world.events[i])) return world.events[i];
  return null;
}

function buildCauses(world, w, d, match) {
  const causes = [];
  const seen = new Set();
  const add = c => { const k = JSON.stringify(c); if (!seen.has(k)) { seen.add(k); causes.push(c); } };
  // In stimulus order: the first requirement (the defining one) leads.
  const objs = match.contrib.filter(o => o.id);
  for (const o of objs.slice(0, 3)) add({ object: o.id });
  for (const o of objs.slice(0, 3)) if (!o.origin.natural) add({ ...o.origin });
  const t = world.tick;
  for (const k of sortedKeys(w.temp)) {
    const b = lastEvent(world, e => e.kind === 'keeper_nudge' && e.data.nudge === 'bless' && e.target === w.id && e.data.trait === k);
    if (b) add({ event: b.id });
  }
  if (world.miracleUntil > t) {
    const m = lastEvent(world, e => e.kind === 'keeper_nudge' && e.data.nudge === 'miracle');
    if (m) add({ event: m.id });
  }
  if (match.conditions.includes('wet') && world.climate.rainEvent) add({ condition: 'wet', event: world.climate.rainEvent });
  if (d.drivers.needs.warmth && w.needs.warmth < 0.5) {
    if (world.climate.season === 'cold') {
      const s = lastEvent(world, e => e.kind === 'keeper_power' && e.data.power === 'season' && e.data.variant === 'cold');
      add(s ? { condition: 'cold_snap', event: s.id } : { condition: 'cold' });
    } else add({ condition: 'cold' });
  }
  if (d.drivers.needs.food && w.needs.food < 0.4) add({ condition: 'hunger' });
  return causes;
}

// The single place a discovery is written.
export function recordDiscovery(world, wobblin, discoveryId, causes, source) {
  const prev = world.discoveries[discoveryId];
  const kind = prev && prev.forgotten ? 'rediscovery' : 'discovery';
  world.discoveries[discoveryId] = { inventor: wobblin.id, tick: world.tick, causes, forgotten: false, orphanSince: null };
  wobblin.knows[discoveryId] = { since: world.tick, from: 'self' };
  const ev = emit(world, {
    kind,
    actors: [wobblin.id],
    target: discoveryId,
    data: { source: kind === 'rediscovery' ? 'rediscovery' : source, zone: wobblin.zone,
      ...(prev && prev.forgotten ? { previousInventor: prev.inventor } : {}) },
    salience: 5,
    causes
  }, KNOWLEDGE);
  world.discoveries[discoveryId].event = ev.id;
  return ev;
}

function learn(world, w, d, from) {
  w.knows[d] = { since: world.tick, from };
}

// ---------------------------------------------------------------- experiments
export function experimentStep(world) {
  const ctx = makeContext(world);
  const t = world.tick;
  const order = ctx.live.filter(eligible)
    .map(w => ({ w, k: rngFor(world.seed, 'exp-order', t, w.id)() }))
    .sort((a, b) => a.k - b.k).map(x => x.w);
  let attempts = 0;
  for (const w of order) {
    const cands = scoreCandidates(ctx, w);
    if (t % 2 === 0) ponder(world, ctx, w, cands);
    if (!cands.length || attempts >= EXPERIMENT.colonyCapPerTick) continue;
    const r = rngFor(world.seed, 'experiment', t, w.id);
    if (r() >= pAttemptOf(cands)) continue;
    attempts++;
    const c = weightedPick(r, cands, x => x.score);
    const pSuccess = EXPERIMENT.successBase[c.d.tier] * (0.5 + 0.5 * primaryTrait(w, c.d, t)) * (w.luckyCharm ? 1.1 : 1);
    if (r() < pSuccess) {
      const causes = buildCauses(world, w, c.d, c.match);
      const ev = recordDiscovery(world, w, c.d.id, causes, 'experiment');
      ctx.knownByLiving.add(c.d.id);
      applyDiscoveryEffect(world, c.d, w, ev);
      // They credit the Keeper when a Keeper act led to it.
      if (keeperRoot(world, ev)) w.faith = r3(clamp(w.faith + 0.1, -1, 1));
      if (world.pondering[w.id]) delete world.pondering[w.id][c.d.id];
      onExperimentSucceeded(world, w, c.d, r);
    } else {
      onExperimentFailed(world, w, c.d, c.match, r);
    }
  }
}

// Prereqs met, a need or hobby pushing, but a stimulus missing for 12+ ticks.
function ponder(world, ctx, w, cands) {
  if (w.stage === 'baby') return;
  const t = world.tick;
  const have = new Set(cands.map(c => c.d.id));
  const mine = world.pondering[w.id] ||= {};
  const openIds = ctx.openIds ||= new Set(ctx.open.map(d => d.id));
  for (const k of Object.keys(mine)) if (!openIds.has(k) || world.pondered[k] !== undefined) delete mine[k];
  for (const d of ctx.open) {
    if (world.pondered[d.id] !== undefined) continue;
    if (have.has(d.id) || w.knows[d.id] || ctx.knownByLiving.has(d.id) || !prereqsMet(d, w.knows)) {
      delete mine[d.id];
      continue;
    }
    const rec = world.discoveries[d.id];
    if (rec && !rec.forgotten) continue;
    const pushed = needFactor(w, d) >= 1.5 || (d.hobby && d.hobby === w.hobby) || trait(w, Object.keys(d.drivers.traits)[0], t) > 0.75;
    if (!pushed) { delete mine[d.id]; continue; }
    if (mine[d.id] === undefined) mine[d.id] = t;
    if (t - mine[d.id] >= EXPERIMENT.ponderAfter && !world.pondered[d.id]) {
      world.pondered[d.id] = t;
      const missing = d.stimuli.filter(s => s.anyOf).map(s => s.anyOf[0]);
      emit(world, { kind: 'pondering', actors: [w.id], target: d.id, data: { missing, zone: w.zone }, salience: 3 });
      return;   // one at a time
    }
  }
  if (!Object.keys(mine).length) delete world.pondering[w.id];
}

// ---------------------------------------------------------------- teaching
const STRUCTURE_LEARN = 0.03;
const STRUCTURE_GRACE = 36;   // ticks a structure keeps knowledge alive with no knower

export function teachingStep(world) {
  const t = world.tick;
  const live = alive(world);
  const loreMult = w => (w.knows.lore ? 2 : 1);
  const nearDeath = w => w.knows.lore && (w.lifespan - (t - w.bornTick)) < 0.1 * w.lifespan;
  const knownSorted = new Map(live.map(w => [w, Object.keys(w.knows).sort()]));
  const zoneKnows = new Map();
  for (const w of live) { if (!zoneKnows.has(w.zone)) zoneKnows.set(w.zone, new Set()); for (const d of knownSorted.get(w)) zoneKnows.get(w.zone).add(d); }
  const embodied = new Map();
  const objs = liveObjects(world);
  const eIdx = embodimentIndex(objs);
  for (const d of DISCOVERIES) if (d.embodiedBy.length && world.discoveries[d.id]) embodied.set(d.id, embodimentsFrom(eIdx, d));
  const embodiedZones = new Set([...embodied.values()].flat().map(o => o.zone));
  for (const L of live) {
    let learned = false;
    const r = rngFor(world.seed, 'teach', t, L.id);   // one stream per learner per tick
    // Nothing to learn here? Skip the pairwise loop (the common case late on).
    const zk = zoneKnows.get(L.zone);
    let missing = false;
    for (const d of zk) if (!L.knows[d]) { missing = true; break; }
    const teachers = missing ? live.filter(K => K !== L && K.zone === L.zone) : [];
    for (const K of teachers) {
      for (const d of knownSorted.get(K)) {
        if (L.knows[d] || !BY_ID[d]) continue;
        const tier = BY_ID[d].tier;
        if (L.stage === 'baby' && tier > 2) continue;
        let p = TEACH.base[tier] * (0.5 + K.traits.sociability) * (0.5 + L.traits.curiosity) * loreMult(K);
        if (L.parents.includes(K.id)) p *= 2;
        if (nearDeath(K)) p *= 4;
        if (K.stage === 'elder') p *= 1.3;
        if (r() < p) {
          learn(world, L, d, K.id);
          emit(world, { kind: 'taught', actors: [K.id, L.id], target: d, data: { zone: L.zone }, salience: 1 }, KNOWLEDGE);
          learned = true;
          break;
        }
      }
      if (learned) break;
    }
    // Watching a structure in use: a small chance to pick up what it embodies.
    if (!learned && L.stage !== 'baby' && embodiedZones.has(L.zone)) {
      for (const d of DISCOVERIES) {
        if (L.knows[d.id] || !d.embodiedBy.length) continue;
        const rec = world.discoveries[d.id];
        if (!rec) continue;
        if (!prereqsMet(d, L.knows)) continue;
        const here = (embodied.get(d.id) || []).filter(o => o.zone === L.zone);
        if (!here.length) continue;
        if (r() < STRUCTURE_LEARN * (rec.orphanSince !== null && rec.orphanSince !== undefined ? 2 : 1)) {
          learn(world, L, d.id, 'structure');
          rec.orphanSince = null;
          if (rec.forgotten) rec.forgotten = false;
          emit(world, { kind: 'learned_from_structure', actors: [L.id], target: d.id, data: { object: here[0].id }, salience: 3,
            causes: [{ object: here[0].id }] }, KNOWLEDGE);
          break;
        }
      }
    }
  }
  forgettingStep(world, live);
}

// When the last living knower is gone, a discovery is forgotten, unless a
// structure embodies it and someone learns from it within 24 ticks.
function forgettingStep(world, live) {
  const t = world.tick;
  const objs = liveObjects(world);
  const eIdx = embodimentIndex(objs);
  const known = new Set();
  for (const w of live) for (const d of Object.keys(w.knows)) known.add(d);
  for (const id of sortedKeys(world.discoveries)) {
    const rec = world.discoveries[id];
    if (rec.forgotten) continue;
    if (known.has(id)) { rec.orphanSince = null; continue; }
    const d = BY_ID[id];
    const holders = embodimentsFrom(eIdx, d);
    if (rec.orphanSince === null || rec.orphanSince === undefined) rec.orphanSince = t;
    // An empty valley has nobody to learn from it yet: the clock waits.
    else if (!live.length && holders.length) rec.orphanSince++;
    if (holders.length && t - rec.orphanSince < STRUCTURE_GRACE) continue;
    rec.forgotten = true;
    rec.forgottenTick = t;
    const lastKnower = world.wobblins.filter(w => !w.alive && w.knows[id]).sort((a, b) => b.deathTick - a.deathTick)[0];
    emit(world, { kind: 'forgotten', actors: lastKnower ? [lastKnower.id] : [], target: id,
      data: { structures: holders.map(o => o.id) }, salience: 4,
      causes: lastKnower ? [{ event: deathEventOf(world, lastKnower.id) }].filter(c => c.event) : [] }, KNOWLEDGE);
    for (const o of holders) {
      if (o.kind === 'fire') { o.state.kept = false; o.state.until = t + 2; }
      else o.state.decayFrom = t;
    }
  }
  // Decaying structures become ruins after a while.
  for (const o of objs) {
    if (o.state.decayFrom !== undefined && o.kind !== 'ruin' && t - o.state.decayFrom >= 12) {
      const was = o.kind;
      o.kind = 'ruin';
      o.state.ruinOf = was;
      emit(world, { kind: 'ruin', target: o.id, data: { was, zone: o.zone }, salience: 3, causes: [{ object: o.id }] });
    }
  }
}

function deathEventOf(world, id) {
  const e = world.events.find(x => x.kind === 'death' && x.actors[0] === id);
  return e ? e.id : undefined;
}
