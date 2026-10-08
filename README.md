# Wobblins

A tiny, never-resetting world of curious Wobblins. You shape their world; they invent.
The binding spec is [CONTRACT.md](CONTRACT.md). The week-1 brief is
`C:\Users\ignit\Downloads\week1-build-plan.md`.

## Run it

```bash
node server.js
```

Then open http://localhost:8137/ (add `?debug=1` for the time-warp panel, the
experiment overlay, replay verification and save export/import).

## How to play

- **Drag from the tray** onto the valley: stones, a boulder, seeds, rain, lightning, water, seasons, Shake, a blessing, a curio, the daily gift, a miracle. Drop one on a Wobblin's head for a reaction.
- **Pick a Wobblin up** and set it down, or **fling** it (let go while moving). Things it lands on react.
- **Hold it still** in your hand and it dozes off. **Shake it** and it gets rattled.
- **Tap a Wobblin** for its card (stats, skills, what it could work out, its own words). Tap the name to rename it. Keep tapping and it gets cross.
- **Drag small things** (stones, gifts, curios, sprouts, clay) to move them.
- **A golden bubble** means a Wobblin is asking you for something; grant it for belief. **Drop one Wobblin on another** for a hug: close friends pair up sooner, which is how you breed for a trait.
- **Goals** lists milestones; claiming one adds belief, and belief unlocks powers. **Family** shows every generation; **Chronicle** is their story.
- Dev: `?debug=1&fresh=1` starts over, `?debug=1&devload=/_dev_save.json` loads a prepared village (`node tests/_mkdev.mjs <seed> <ticks>` makes one).

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
