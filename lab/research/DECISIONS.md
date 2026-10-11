# Decision log

How this project was steered. The code was written by an AI agent (Claude, through
Claude Code); the calls below are Nate's, in the order he made them, with what each one
changed. Drafted from the project thread by the agent; Nate edits and signs off.

| When (UTC) | Nate's call | What it changed |
|---|---|---|
| 2026-10-08 | Build a browser creature game in a week; the reference engine stays untouched. | A deterministic, replayable sim with a 2D renderer and a test suite. |
| 2026-10-08 | "Make it feel like Pocket God or a deeper Thronglets." Direct interaction, clear reactions, personalities that affect and are affected by the world. | Carry, fling, poke, reactions, traits, friendships, chain reactions. |
| 2026-10-08 | "It still feels AI-generated and soulless." | Hand-made storybook skin; the honest finding that code-drawn 2D could not reach professional art. |
| 2026-10-08 | "Does this look professional or like a shitty indie prototype? If you need help, research it." | Answer: prototype. An art brief and a painted-art pipeline; the recommendation to commission an illustrator. |
| 2026-10-09 | "Everything feels big and clunky." / "The flow feels AI and confusing; everything should be interactive, right-click for options." | Scale, HUD and right-click notes. |
| 2026-10-09 | Shared a design conversation: "we are kinda missing the mark, which is my fault, I hadn't fleshed out the idea." The real idea: artificial life, no recipes, creatures that learn from experience, evolution, cumulative culture, the player as an observer who arranges opportunities. | The lab: a recipe-free world with physical rules and learning creatures, built headless first and judged by scenarios. |
| 2026-10-09 | "You are better at 3D art than 2D." Then, on migrating to Godot: accepted the advice to stay on Three.js. | The 3D view of the lab. |
| 2026-10-09 | "I want the Astra one. That's what I was picturing, just describing it very poorly." | The lab became the core; the 2D game was frozen. |
| 2026-10-09 | "It's extremely laggy." / "The lights keep changing and it looks terrible." | Performance fixes and a smooth day; led later to the 18x sim speedup that made 64-seed experiments possible. |
| 2026-10-09 | "Put a little more time into each design so it feels handcrafted." / "Make the ground look better." | Hand-modelled props and a rolling ground. |
| 2026-10-09 | Overnight brief: work without approvals; everything should be pieces that break apart, tools should be invented, buildings, an outside threat and competition "so there is a reason to evolve", an environment as open as possible. | Trees, shards, cutting, joining, walls, the prowler, lean seasons, brawn, fleeing, place-based rest. The pilot that suggested the predator selected for boldness. |
| 2026-10-10 | "How could I turn this into something a frontier lab would want to hire me for?" | The decision to treat the lab as research: hypotheses, controls, honesty about the negative result. |
| 2026-10-11 | "We need this ready for my portfolio before I apply to Anthropic Fellows. With that context, what would you change?" Then: "Create the plan and then execute." | Pre-registration before the confirmatory runs; the 64-seed harness; this log. |

## What the agent got wrong, and who caught it

- The agent built menus and art that read as machine-made; Nate caught it twice.
- The agent built a lab view with a light source per object; Nate caught the lag.
- The agent's pilot (8 seeds) reported that a predator selected for boldness. The
  pre-registered 64-seed run found no effect on caution in either direction. The pilot
  was noise. Pre-registering before the confirmatory run is what kept that honest.

## What Nate decided against

- Migrating to Godot before the sim was settled.
- Leading the portfolio with the game.
