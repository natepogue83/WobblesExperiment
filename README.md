# Wobblins

**Research first:** [`lab/research/REPORT.md`](lab/research/REPORT.md) is a pre-registered study of a
recipe-free artificial-life world: *when selection pressure doesn't select, because learning
absorbs it*. The pre-registration, the decision log, the one-command harness and the results
are in [`lab/research/`](lab/research/). The simulation itself is [`lab/`](lab/), described below.
The code was written by an AI agent (Claude) under Nate Pogue's direction; the research design
and the decisions are his.

---

A tiny, never-resetting world of curious Wobblins. You shape their world; they invent.
The binding spec is [CONTRACT.md](CONTRACT.md).

## Run it

```bash
node server.js
```

Then open http://localhost:8137/ (add `?debug=1` for the time-warp panel, the
experiment overlay, replay verification and save export/import).

## How to play

- **Tap things.** Trees drop nuts (or seeds), bushes scatter berries, the fire flares, the pond splashes, huts peek, the temple hums.
- **Right-click anything** (press and hold on a phone) for what it is, what it might lead to, and what you can do to it.
- **Drag from the tray** onto the valley: stones, a boulder, seeds, rain, lightning, water, seasons, Shake, a blessing, a curio, the daily gift, a miracle. Drop one on a Wobblin's head for a reaction.
- **Pick a Wobblin up** and set it down, or **fling** it (let go while moving). Things it lands on react: friends, bushes, trees, the fire, hut roofs, the river, murals, the garden, the frozen pond, snowmen. **Catch a flung one in mid-air** to juggle it.
- **Hold it still** in your hand and it dozes off. **Shake it** and it gets rattled.
- **Tap a Wobblin** for its card (stats, skills, what it could work out, its own words). Tap the name to rename it. Keep tapping and it gets cross.
- **Drag small things** (stones, gifts, curios, sprouts, clay) to move them.
- **Hover your hand or a power over them.** The trusting wave hello and the wary cover their heads; with lightning or a boulder overhead, the timid brace and the bold bounce.
- **A golden bubble** means a Wobblin is asking you for something; grant it for belief. **Drop one Wobblin on another** for a hug: close friends pair up sooner, which is how you breed for a trait.
- **Goals** lists milestones and tricks to try; claiming one adds belief, and belief unlocks powers. **Family** shows every generation; **Chronicle** is their story.
- Dev: `?debug=1&fresh=1` starts over, `?debug=1&devload=/_dev_save.json` loads a prepared village (`node tests/_mkdev.mjs <seed> <ticks>` makes one).
- Art: the game draws everything in vector, and swaps in hand-painted PNGs for anything listed in `art/manifest.json` (see `art/manifest.example.json` and `marketing/art-brief.md`). The dev server also accepts `POST /_dev/save?name=x.png` from the page, which saves into `art/_test/`.

## The lab (where the game is going)

`lab/` is an artificial-life simulation with no recipes: materials with hidden properties (weight, hardness, sharpness, how they burn and soak), physical rules that compose (wet and dry, heat and fire, sparks, stacking and cover, walls, cutting and splitting, joining, growth, lean seasons), and creatures that see only what is visible, act with a handful of primitives (pick up, place, taste, strike, climb, watch, beckon, rest, flee), and learn from what happened. A prowler comes some nights from the edge; fire, walls and a crowd keep it off, and a hard enough blow drives it away. Knowledge spreads only by watching; children inherit how they learn and what they are made of, not what they know. The player's verbs are to put things down and make it rain.

- `node lab/run.mjs` runs 8 colonies through the fire-keeping scenario, the spark scenario, the high-fruit scenario and the generations scenario, and prints the results.
- `node lab/run.mjs 2` tells one colony's story and what each creature believes.
- `lab/view.html?seed=2` watches a colony live in 3D (needs the dev server). Click the ground to put things down; click a creature to read its mind.
- `node lab/run-deep.mjs` runs the deeper world: shards, felled trees, joined tools, walls and the prowler over 40 days. `EVOLVE=1 node lab/run-deep.mjs` also runs 120 days with and without the prowler and reports how caution and brawn drifted.
- `tests/test-lab.js` guards the results.

## Test it

```bash
npm test
```

Fourteen test files, about three minutes. The long ones are `test-world.js` (200 seeds
x 2,160 ticks) and `test-discovery.js`.

## Deploy (static, no build step)

The site is just these files. Either:

- **Netlify:** drag the folder onto https://app.netlify.com/drop, or `npx netlify deploy --prod --dir .`
- **Cloudflare Pages:** `npx wrangler pages deploy . --project-name wobblins`

`netlify.toml` and `_headers` keep tests and dev files out of the cache rules and
serve ES modules with the right type. The waitlist link lives in
`src/ui/config.js` (currently `playwobblins.com`, still unconfirmed).

## Layout

- `src/sim/` deterministic simulation (no `Math.random`, no wall clock)
- `src/render/` `renderState` (pure) and the SVG painter + sprites
- `src/ui/` clock, input, panels, saves
- `src/ai/narrate.js` week-2 AI hook (template stub for now)
- `tests/` node tests
