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

## Test it

```bash
npm test
```

Ten test files, about two minutes. The long ones are `test-world.js` (200 seeds
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
