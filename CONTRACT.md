# Wobblins — Integration Contract (v1)

This is the binding spec. Every module builds against THIS document and
`src/sim/geometry.js`. If code and contract disagree, fix one of them in the
same change; never leave them out of step. Modeled on the ISO contract
(`C:\Users\ignit\iso\CONTRACT.md`), which this project reuses patterns from
but never modifies.

## 1. Module boundaries

Plain browser JavaScript as ES modules, no build step, no external libraries.
Node runs the same files for tests (`package.json` has `"type": "module"`).

| Path            | Owns                                              | May import          |
|-----------------|---------------------------------------------------|---------------------|
| `src/sim/`      | All world state and rules. Pure and deterministic. | only `src/sim/`     |
| `src/render/`   | `renderState(world)` (pure), `drawSVG(svg, rs, opts)`, the canvas painter (`painter.js`, browser only, cached image) | `src/sim/` read-only|
| `src/ui/`       | Clock, input, panels, saving to localStorage      | sim, render, ai     |
| `src/ai/`       | Narration (stub in week 1)                        | sim read-only       |
| `tests/`        | Node tests, run with `npm test`                   | anything            |

- `src/sim/` never touches the DOM, `localStorage`, `fetch`, the wall clock,
  or `Math.random`. Render and UI never mutate a world.
- The only way to change a world is `applyAction(world, action)` and
  `tick(world)`. Replay is those two calls in a fixed order, nothing else.

### Public sim API (`src/sim/index.js`)

```js
createWorld(seed /* uint32 */, opts /* { barren?, colonyName?, keeperName? } */) -> world
tick(world) -> world                    // advances world.tick by exactly 1
validateAction(world, action) -> { ok: true } | { ok: false, reason }
applyAction(world, action) -> { ok, reason? }   // invalid = no change, no events
replay(save, nowTick) -> world          // world.tick === nowTick
stateHash(world) -> string              // 16 hex chars, stable across engines
```

## 2. Determinism (hard rule)

1. No `Math.random`, no `Date`, no `performance`, no wall clock in `src/sim/`.
   A test greps for these. Time enters the sim only as the integer tick.
2. All randomness comes from mulberry32 (ported verbatim from ISO) through
   derived sub-streams: `rngFor(seed, "experiment", tick, wobblinId)`. Every
   system draws from its own stream keyed by what it is deciding, so adding a
   system or a roll never shifts unrelated rolls. Never share one stream
   across systems or keep a stream alive across ticks.
3. Iterate creatures and objects sorted by id (`byId`, numeric suffix order:
   `w2` before `w10`). Never iterate object keys in insertion or unknown
   order when the order can affect an outcome; use `sortedKeys`.
4. Stored floats are rounded to 3 decimals (`r3`) whenever written to state.
5. `stateHash(world)` = cyrb53 of a stable stringify (keys sorted). Same
   seed + same action list = same hash, byte for byte, on every engine.
6. `applyAction` validates deterministically from world state alone:
   cooldowns, Devotion, gift once per day, valid targets. An invalid action is
   ignored with no events and no state change, identically on replay.
7. Real time exists only in the UI: `nowTick = floor((now - save.createdAt) /
   TICK_MS)` plus the debug offset. The sky's time of day is render-only and
   never feeds back into the sim.

## 3. Rule zero: player actions never create discoveries

The engine is `src/sim/experiment.js`; failures go to `src/sim/misfires.js`
(misfire table and superstitions); what discoveries and beliefs do afterwards
(songs, rituals, festivals, rebuilding, healing, wishes) is `src/sim/culture.js`.
Neither of those two may add knowledge.
Also: the graph is data in
`src/sim/discoveries.js`; world changes are `src/sim/effects.js` (called only
from experiment.js); cause chains are `src/sim/causes.js` (`keeperRoot`).


- Only `src/sim/experiment.js` (experiments, teaching and rediscovery inside
  it) may add to `world.discoveries` or any `wobblin.knows`.
- Actions only create objects, conditions, or temporary trait modifiers.
- Events of kind `discovery`, `rediscovery`, `taught`,
  `learned_from_structure` and `forgotten` can only be emitted with the
  internal `KNOWLEDGE` emitter tag (`src/sim/events.js`). `emit` throws
  otherwise. Only `experiment.js` may import that tag (a test greps for it).
- Every `discovery` / `rediscovery` event carries `data.source` of
  `"experiment"` or `"rediscovery"`.
- The player never crafts or combines anything. No recipes are ever shown.

## 4. Ids

| Thing     | Format                 | Allocated from     |
|-----------|------------------------|--------------------|
| Wobblin   | `"w1"`, `"w2"`, ...    | `world.nextIds.w`  |
| Object    | `"o1"`, `"o2"`, ...    | `world.nextIds.o`  |
| Event     | integer `1, 2, ...`    | `world.nextIds.e`  |
| Action    | integer `seq`, from 1  | the save's list    |
| Zone      | `"meadow"` etc.        | `geometry.js`      |
| Slot      | `"meadow.2"` (1-based) | `geometry.js`      |
| Discovery | `"fire_warmth"` etc.   | `discoveries.js`   |

Ids are never reused, even after death or destruction.

## 5. State schema (world, version 2)

```js
world = {
  version: 2, seed, tick, colonyName, keeperName,
  climate: { season: "mild"|"cold"|"warm", tempMod, until: tick|null, drought,
             rain: ticksLeft, wetUntil: tick, cold: bool /* tonight */, drift /* seasonal */,
             rainEvent: eventId /* cause of the current rain */ },
  wobblins: [ wobblin ],          // dead ones stay, alive:false
  objects:  [ object ],           // destroyed ones stay, hp 0, state.gone:true
  discoveries: { [id]: { inventor, tick, causes, forgotten, orphanSince, event, forgottenTick? } },
                                  // orphanSince: tick the last knower died (a structure may still hold it)
  devotion: 0,
  offerings: 0,                   // waiting at the shrine, collected by action
  cooldowns: { stone, plant, rain, lightning, water, season, bless, curio, miracle },
                                  // each value = first tick the power is usable
  seasonUses: 0,                  // Season is free the first time
  giftsByDay: { [dayIndex]: giftId },
  pondering: { [wobblinId]: { [discoveryId]: sinceTick } },
  pondered: { [discoveryId]: tick },  // the pondering hint is shown once per discovery
  seedPod: null | { at: tick },   // set when the valley empties; hatches 2 Wobblins
  rainUses: [tick],               // recent Keeper rains; 3 within 6 ticks = flood
  miracleUntil, riverBend: slot|null, lastKeeperTick,
  noticed: { [objectKind]: tick },// first tick a Wobblin was near a material (unlocks curios)
  wishes: [ { id, by, want: "rain"|"stones_on_hill"|"warmth", t, until, event, done: null|"granted"|"expired" } ],
  lastFestival: tick|null, lastSong: tick|null, lastKeeperEvent: eventId|null
  events: [ event ],              // append-only
  nextIds: { w, o, e }
}

wobblin = {
  id, name, look: { hue, pattern, ears, eyeSize, tail, wobble },
  traits: { curiosity, boldness, sociability, patience, playfulness, piety, caution }, // 0..1
                                  // caution comes from rngFor(seed, 'caution', n) so older seeds keep their other traits
  skills: { foraging, building, crafting, social, explore }, // XP; level = levelOf(xp). Card shows crafting as Tinkering, social as Storytelling, explore as Exploring
  bonds: { [wobblinId]: -1..1 },  // friends at >= 0.5, rivals at <= -0.4 (interactions.js)
  flowerUntil?, zappedUntil?,     // cosmetic: flower crown, frizz (render only reads them)
  heldUntil?,                     // set down or knocked over: stays in this zone until then
  hobby, bornTick, stage: "baby"|"adult"|"elder", lifespan,
  activity: "forage"|"warm"|"rest"|"inspect"|"hobby"|"play", seen: [objectId] /* last 8 inspected */,
  hungry, freezing /* consecutive ticks at 0 food / 0 warmth */, lastBirth,
  needs: { food, warmth, rest, mood, safety },            // 0..1
  zone, knows: { [discoveryId]: { since, from: "self"|wobblinId } },
  temp: { [trait]: { add, until } },
  partnerId, parents: [], faith, beliefs: [], memories: [eventId],
  injuries, alive, deathTick, deathCause,
  witnessed /* saw a blessing or miracle */, tabooUntil? /* Fire Taboo */, luckyCharm? /* object id */
}

object = { id, kind, zone, slot, hp, builtTick, by: [wobblinId],
           origin: { action: seq } | { event: id } | { natural: true },
           state: {} }
```

The valley tidies itself (`nature.js` `tidyStep`, constants `TIDY`): curios (after
their pull) and gifts older than 48 ticks are taken home as keepsakes (`keepsake`
event, maybe a `luckyCharm`); stone piles beyond the newest 3 go after 72 ticks
(cairns after 144); scorch marks fade after 48 and ruins after 240.

Object state flags added overnight: `pond.state.frozen` (cold season), `fish.state.stunned`
(lightning in water), `scorch.state.wrecked` (a Wobblin flung through the roof),
`stones.state.stacked` (a cairn).

Object kinds: boulder, stones, tree, bush, sprout, fire, pond, reeds, clay,
fish, curio, gift, hearth, hut, wall, garden, raft, totem, temple, mural,
grave, ruin, scorch. Graves have `slot: null` and line up in
`GEO.GRAVEYARD`; a boulder also has `slots: [a, b]`. Zone features that are not objects: `river`
(riverbank), `shrine` (hill).

## 6. Event schema

```js
event = { id, t, kind, actors: [wobblinId] /* inventor first */,
          target: discoveryId | objectId | wobblinId | null,
          data: { ... }, salience: 1..5,
          causes: [ { action: seq } | { event: id } | { object: id } |
                    { condition: name, action?: seq, event?: id } ] }
```

Kinds (week 1): Keeper `colony_founded keeper_power keeper_nudge keeper_gift
offerings_collected`; Discovery `experiment_failed misfire discovery
rediscovery taught learned_from_structure pondering forgotten superstition`;
World `lightning built burned ruin fire_started fire_out flood pond_formed tree_grown
prowler lost rain cold_snap`; Life `paired birth grew_up became_elder injured healed
death seed_pod_hatched stranger_arrived`; Faith `offering wish wish_granted
wish_expired faith_shift festival ritual mural_painted`; Growth `level_up`;
Social `friends rivals interaction keepsake goal_reached` (`data.what` names it: hug, bonk, bowled_over,
bush_squashed, snack, stuck_in_tree, fire_walk, singed, caught_fish, scared_fish,
through_the_roof, made_a_cairn, treasure, king_of_the_hill, remembers, boulder_split,
fish_stunned, squabble, pond_froze, pond_thawed, skating, slipped, ice_cracked, quake,
bonked, bonk_idea, squashed, flower_crown, zapped, gift_caught).

Events are append-only and are the single source of truth for the recap,
Chronicle, murals and the week-2 AI.

## 7. Action schema (the save's `actions` list)

```js
{ seq, t, type: "power", power: "stone"|"plant"|"rain"|"lightning"|"water"|"season"|"quake",
  slot?, zone?, variant? }        // stone: "stones"|"boulder"; plant: "tree"|"bush";
                                  // season: "cold"|"warm"
{ seq, t, type: "nudge", nudge: "bless"|"curio"|"miracle"|"carry",
  target?, trait?, curio?, targets?, zone?,     // carry: pick a Wobblin up, set it down in zone
  thrown?, splash?, onto? }                    // (no cooldown; it stays put 3 ticks; never adds knowledge)
                                             // thrown: flung, not placed; splash: landed in water
                                             // onto: the Wobblin or object it landed on (must exist,
                                             // be alive / not gone, and not be itself) -> landOnto()
{ seq, t, type: "gift", day, giftId, slot?, onto? }   // slot: where it was dropped (else first free meadow slot)
{ seq, t, type: "collect_offerings" }
{ seq, t, type: "claim", goal }               // claim a reached milestone (goals.js): adds belief, nobody reacts
```

- `onto` on stone, plant, lightning and gift: the living Wobblin it was dropped on
  (`powerOnto`: bonk, squash, flower crown, zap, caught gift). The object itself still
  lands in `slot`. Stones dropped on a pile of fewer than 4 top it up (`state.count`).
- `quake` (Shake the Valley, cooldown 16, unlocks at belief 26): berries fall, cairns
  topple, a wall may fall to a ruin, seeds sprout, fish leap, timid Wobblins are shaken.
- Actions apply at tick `t`, in `seq` order, BEFORE that tick's `tick()` runs.
- Timed state (`until`, `readyAt`) means: by the time `world.tick === until`
  the effect is over. A 24-tick season placed at t covers ticks t..t+23.
- Curios unlock per material: hollow_log (tree), flint (stones/boulder),
  feather (gift/bush), reed_bundle (reeds), clay_lump (clay).
- `replay(save, nowTick)`: start from `createWorld(save.seed, save)`; for
  `t = 0..nowTick`, apply actions with that `t` in seq order, then call
  `tick()` if `t < nowTick`. Result has `world.tick === nowTick`.
- Live play must equal replay: the UI applies an action to the live world at
  the current tick and appends it to the save with that same `t`.

## 8. Save (`localStorage["wobblins.save.v1"]`)

```js
{ v: 1, seed, createdAt /* ms, UI only */, colonyName, keeperName,
  actions: [ action ], lastSeenTick }
```

Seed comes from `crypto.getRandomValues` in the UI only. Target under 20 KB
after 500 actions, so on disk (localStorage and the base64 export string) the
action list is packed by `src/ui/save.js` into tuples under key `a`:
`[code, dt, ...fields]`, seq implied by position, t as a delta. Any action
that does not fit a tuple is stored as its full object. In memory a save
always holds full action objects.

## 9. Clock (two speeds)

While the page is open a colony day (tick) passes every `WATCH_TICK_MS` (60 s);
while away, every `TICK_MS` (1 h). The save keeps `clock: { anchorMs, anchorTick,
mode: "watch"|"away", beatMs }` (`src/ui/clock.js`); a heartbeat means a crashed
tab is never counted as watched. Saves without `clock` use createdAt at the away
rate. The sim only ever sees the integer tick.

## 9a. Belief unlocks powers

New games are created with `save.progression = true`: the world starts with
`unlocked = [carry, stone, plant, gift]`, and lifetime `world.belief` (from
reactions, Keeper-rooted discoveries and collected offerings, `src/sim/belief.js`)
unlocks rain 3, bless 6, lightning 10, water 16, curio 22, quake 26, season 30, miracle 40,
each with a `power_unlocked` event. Locked actions are rejected (`locked_power`).
Worlds without progression (old saves, tests) have every power.

## 9c. Ages and milestones

`src/sim/goals.js`: `progressOf(world)` reads discoveries and the event log once
(discovery count, highest tier, friendships, births, grandchildren, festivals, and
the largest the colony ever was). The age is named by the highest tier reached
(The First Days, Pebble, Ember, Village, Age of Wonders). Fifteen goals each have
a belief reward; a reached goal is claimed with a `claim` action, which emits
`goal_reached` and calls `addBelief`. `world.goalsClaimed` lists claimed ids.

## 9b. Old clock text

`TICK_MS = 3_600_000` (1 tick = 1 real hour = 1 colony day). `?debug=1`
shows a time-warp panel (+1h, +12h, +3d) that adds to a stored offset; the
offset only changes `nowTick` in the UI.

## 10. Grounding rule for AI text (week 2, binding now)

- AI text may mention only Wobblins, objects, discoveries, beliefs and events
  present in its `recapInput`. No invented events, outcomes, numbers or
  characters.
- A causal claim ("after your lightning storm") is allowed only where the
  input contains that cause link.
- Tone and feeling are fine; new facts are not.
- Output is JSON lines, each listing its `eventIds`. A validator rejects lines
  that name unknown entities, claim unlisted causes, cite no valid event, or
  fail the content filter; rejected lines fall back to the template.
- At most 7 lines, at most 280 characters each. Topics stay inside the
  colony; never the player's real life or health.
- No free-form chat with Wobblins, ever.

## 11. Naming and look

- Always "Wobblins" (one is a "Wobblin"). Never the name "Thronglets" or that
  game's creature look.
- Creatures are original soft blobs: not egg-shaped roly-poly toys, not
  yellow jelly people.

## 12. Tuning deviations from the build plan

- Pairing: the plan says both adults need sociability > 0.4. With only 3
  founders that left a third of seeds unable to ever pair, so the rule is each
  > 0.25 and the pair's average > 0.4 (blessings count). Each intact hut
  houses one pair.
- Saves are packed on disk (section 8) to meet the 20 KB target.
- Hut: the plan says "in the hollow"; the Wobblin may be in the hollow or next
  to it, and bushes count as building material. Otherwise first-generation
  Huts were too rare and colonies cycled through seed pods forever.
- Resting Wobblins can still experiment at half rate (dozing ideas).
- Huts grow with the colony: a Wobblin who knows Hut and is in the hollow may
  build another (one per pair, +1). A colony under 6 with a Hut sometimes
  takes in a stranger from the road (siblings never pair).
- A structure holds its knowledge for 36 ticks after the last knower dies
  (the plan says 24), so a seed pod (24 ticks) can still learn from it.
- Lightning on empty dry ground starts a small grass fire (4 ticks), so
  Lightning alone can lead to Fire Warmth in the barren valley.
- Base rates are tuned up from the plan for tiers 2-4 (see constants.js).
- Big structures appear at once when discovered (no multi-tick build jobs
  yet). A temple is built on a hill boulder when there is one ("the temple
  stands on the boulder you dropped": the built event cites it).
- Herb Healing counts an injured Wobblin anywhere in the colony; Fire
  Carrying takes sticks from trees, bushes or reeds.
- Ongoing works (culture.js): Wobblins keep stacking stones, planting in the
  grove, painting new murals of new Keeper acts, adding gardens and pots, so a
  few hours away still shows change. Nothing new is ever built in the hollow
  except huts (murals there starved colonies of hut space).
- Misfire weights: nothing 40, funny 35 (plan: 55/20), for more story per absence.
- Pondering is checked every other tick.
- Teaching rolls use one stream per learner per tick: rngFor(seed, "teach", t, id).

## 12a. Growth, temperament and bonds

- Skills (`growth.js`): doing things earns XP (foraging while foraging and snacking,
  explore while inspecting, crafting on every experiment, building on discoveries
  that build things and on cairns, social when teaching, hobbies feed their own skill). Levels 0..10 give small bonuses (foraging food,
  experiment odds, teaching odds) and emit `level_up`. Traits drift slowly with
  what happens to a Wobblin (`shapeTrait`): injuries raise caution, successes raise
  boldness, and so on.
- Temperament gates (`discoveries.js` `TEMPERAMENT`): some discoveries need a
  minimum trait in the inventor (e.g. huts and walls need caution, the totem
  and temple need piety, fire needs boldness, stone stacking a little patience).
  `temperamentHints` lists what a Wobblin could work out if it had more of a trait;
  the card shows these. Blessings (all 7 traits) and breeding are how a player
  gets there: children inherit a blend of both parents' traits plus mutation.
- Inheritance (`life.js`): each trait leans toward one parent (lean 0.15..0.85) with
  +-0.04 noise and an 8% surprise of +-0.25. The birth event records `pa`, `pb`, `mid`,
  `born` and `from` (which parent each trait came from, "both" or "surprise").
- Bonds (`interactions.js`): time in the same zone builds friendship (more for
  sociable pairs); clashing temperaments and hungry foragers grate. Friends
  gravitate together; rivals squabble.
- Interactions: `landOnto` (Keeper drop or fling onto something),
  `lightningOnto` (boulders split into stones, huts burn), `lightningInWater`
  (stunned fish), `iceStep` (the pond freezes in a cold season). None adds knowledge.

## 12b. Reactions

Every valid Keeper act records how each witness felt about it on the act's
event: `data.reactions = { [wobblinId]: "love"|"like"|"curious"|"scared"|"upset" }`
(`src/sim/reactions.js`, deterministic from traits, needs and beliefs plus
`rngFor(seed, "react", tick, seq)`). It nudges mood and faith slightly. The UI shows
it for 4 seconds: hearts, sparkle, ?, ! or X eyes, with matching body language.

## 13. Recap

`src/sim/recap.js` `buildRecap(world, from, to)` reads only the event log.
The window is ticks from..to-1 (the Keeper saw the world at `from`; their own
actions are not news). Discoveries lead, at most 2 lines per kind (the cap
gives way only to reach 3 lines), teaching / offerings batched, and a
Keeper-consequence line whenever `keeperRoot` finds one. Roots older than 30
ticks are told as "long ago". `buildRecapInput` is the week-2 AI input.

## 14. Testing

`npm test` runs every `tests/test-*.js` with plain node and `assert`.
Day 1 tests: determinism (2,160 ticks, same hash), purity (grep), replay
equivalence (live incremental == fresh replay, hash for hash), action
validation basics, and the knowledge-emitter guard.
