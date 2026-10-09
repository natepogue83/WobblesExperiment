# Overnight 2 (2026-10-09, night): the deeper world

Nate's brief before sleeping: work on things that need no approval; make the world
much deeper. Everything should be pieces that break apart (wood, trees), tools should
get invented, buildings and homes should be possible, there should be an outside
threat and competition so there is a reason to evolve, and the environment should be
as interactive and open as possible. Mimic reality as best we can.

Everything below is in `lab/` and committed. The 2D game is untouched.

## What the world can do now

- **Trees** stand in the meadow and grow from saplings over about twelve days.
- **Shards**: striking stone on stone throws sparks (as before) or now and then breaks
  off a sharp shard.
- **Cutting**: a sharp thing notches a tree; six points of cutting fell it into two
  logs and three sticks. A sharp thing splits a log into sticks.
- **Joining**: a shard struck against a stick can wedge into it and stay. The carrier now
  holds a shard on a stick, which cuts faster (sharp and long).
- **Walls**: a cell closed on three of four sides by stacks, standing trees or water is
  walled. Nothing big gets in, and it is a little warmer. A trunk across a stack of two
  is still a roof.
- **The prowler**: on about one night in four, something comes out of the dark at the
  edge. It hunts a creature alone in the open. Fire, walls and a crowd of three keep it
  off. A hard enough blow (a stone, a shard, an axe, brawn) drives it away; a soft one
  gets the striker mauled. A creature already weak, or mauled twice in two days, dies.
  The prowler never learns; it is weather with teeth.
- **Lean seasons**: every thirty days the meadow goes lean for six. Berries barely regrow
  and tall bushes fruit slowly. Hunger deaths cluster there; populations answer to food.
- **The meadow no longer clogs**: without a fire to burn them, tufts used to pile up
  and stop berries regrowing, which starved whole colonies. Fixed.

## What the creatures can do now

- A new inherited trait, **brawn**: harder blows, heavier loads, a little more hunger.
- **Flee** toward the nearest safe spot (fire, walls, a crowd) when a beast is in sight.
- **Rest at a kind of place**: by a fire, under a roof, inside walls, or in the open.
  Each is its own memory, so "sleeping inside walls" can be learned to be good.
- **Build beside yourself**: a carried thing can go on the cell next to you. That is how
  a wall goes up around a sleeping place. Snug nights credit what was built within reach.
- **Remember being attacked** against what they were doing and where; the careful
  avoid that place for days, and others within sight pick up a weaker version.

## Numbers (8 colonies, `node lab/run-deep.mjs`, 40 days)

- shards struck 13, trees felled 2, tools joined 3, logs split 4
- the beast came 64 times, attacked 9 times, was driven off 3 times
- walls built in 6 colonies, roofs in 4, 4 or more alive at the end in 8 of 8

The chains are real but still rare: tools appear in about a third of colonies in 40
days. Fire-keeping, high fruit, cover and generations all still pass (15/15 tests).

## Evolution (`EVOLVE=1 node lab/run-deep.mjs`, 120 days, with and without the beast)

Final run: 7 of 8 colonies with the beast were still alive at day 120 (5 killed by it in all);
caution rose in 1 of 8 with the beast and 5 of 8 without, and in several beast colonies it fell.
So far the beast selects for boldness, not caution: the careful spend their nights fleeing and
sheltering and forage less, so they have fewer children. That is a real result, not a bug, but
it is not the pressure Nate had in mind yet. Honest reading: the first settings emptied five of
eight colonies, not by killing but by draining them (lost nights and lost energy stopped
births). Softened twice. A clear selection signal on caution is not there yet; it needs
longer runs, larger populations, or a threat that singles out the careless more sharply.

## For the 3D view

Trees (with a pale notch once cut), saplings, shards, shards on sticks, the prowler
(low, dark, pale eyes), story lines for each new event, "lean time" in the HUD, and
tree and shard tools for the Keeper. Earlier in the evening: the lag fix, smooth
day/night, hand-modelled props and a rolling ground.

## Ideas not done

- Mud and clay by the river (shaped, fire-hardened), cordage from tufts, a second
  kind of beast, seeds that can be planted on purpose, trading between creatures.
- A teaching action stronger than beckoning.
- Showing a hurt creature in the view.
