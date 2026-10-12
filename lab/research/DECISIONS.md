# Decision log

This is how I steered the project. Claude (through Claude Code) wrote the code; the calls
below are mine, in the order I made them, with what each one changed. Claude drafted this
from our project thread and I've edited it. Quotes are what I actually said at the time,
typos cleaned up.

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
| 2026-10-11 | Had a separate AI system (Astra) review the work as a skeptical Fellows reviewer. | Review 1: the headline was retracted; four bugs and a false anecdote were found. |
| 2026-10-11 | "Just fix it and I'll have Astra review before another run." | The v2 run, already started, was stopped unread so the fixes could be reviewed first. |
| 2026-10-12 | Sent v2 and then v3 back to Astra before any confirmatory run. | Review 2 ("redesign first") and review 3 ("run after these changes") reshaped the design; the confirmatory run used a fresh seed bank. |
| 2026-10-12 | Accepted the result as registered: effect modification, not the story the project started with. | The report leads with the actual finding and the record of what went wrong. |

## What the agent got wrong, and who caught it

- The agent built menus and art that read as machine-made; Nate caught it twice.
- The agent built a lab view with a light source per object; Nate caught the lag.
- The agent wrote v1's headline ("learning absorbed the pressure") after the registered prediction failed, and copied a model's false account of a colony into the report. Astra caught both.
- The agent's measurements had bugs it had not tested for; Astra found them in three rounds.
- The agent overstated progress twice in status documents ("every fix has a test", "ran v2"); Astra caught both.

## What Nate decided against

- Migrating to Godot before the sim was settled.
- Leading the portfolio with the game.
