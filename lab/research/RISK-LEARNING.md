# The risk-learning contract (v3)

The v3 intervention is called **risk learning off** (`noRiskLearn`). It replaces v2's
"protective learning off", which the second review found leaked (a failed strike was still
remembered) and also removed ordinary learning about rest. This file says exactly what the
switch removes and what it keeps. Each line points to the test that checks it, in
`tests/test-lab-audit.js`.

## Where predator knowledge lives

In v3, the learned records that carry predator risk into later decisions are in two places (with one more route, credit, noted below):

1. **Risk memory** (`c.risk`): learned night-time danger per kind of place (`fire`, `walls`,
   `roof`, `crowd`, `open`). Written only by `learnRisk`. It changes resting choices at night.
2. **Encounter experience**: entries in the ordinary experience memory whose key starts with
   `dark beast`, that is, what happened when the creature fled from or struck at the predator.

Before v3, attacks were written into the experience memory of whatever the creature was doing
(often a rest key). That mixed predator risk with comfort, and is gone.

## What "risk learning off" removes

| route | own experience | observed in another | test |
|---|---|---|---|
| being attacked by the predator | no risk memory | no risk memory | *Risk learning off: no route...* |
| being mauled after a failed strike | no encounter memory, no risk memory | no encounter memory | same |
| fleeing (including reaching safety) | no encounter memory, no risk memory | observers with risk learning off do not record it (with it on, the ordinary observation loop does) | same |
| striking the predator (driving it off or failing) | no encounter memory | as for fleeing | same |
| credit flowing back from a predator encounter to earlier actions or to things built nearby | none | n/a | (code: `credit` gate in `creatureStep`) |
| fright preferences after an attack (avoiding the attack site, favouring closed places for ten days) | switched off | n/a | (code: the two `!c.noRiskLearn` conditions in `score`) |

## What it keeps

| kept | why | test |
|---|---|---|
| learning how rest felt (rested, cosy, sheltered, snug, cold) | comfort, not predator risk | *...keeps comfort learning about rest* |
| credit from comfort, food and fire outcomes, including to things built | not predator-specific | same |
| all fire, food, tool and building learning | the plan keeps them by design | (unchanged code paths) |
| learning by watching, for everything except predator encounters | needed to separate the two | same |
| **instincts**: fleeing a visible predator, the safe-spot finder, attraction to warmth, the caution-weighted pull toward closed places at night | inherited behaviour, not learning | (unchanged code paths) |

Encounter episodes are still stored in the episode list with risk learning off, but no credit flows from them while the switch is off. With risk learning on, a predator outcome can also credit ordinary memories of earlier actions or of things built nearby; that is part of what the switch removes.

## What this means for the claim

v3 tests whether disabling **these enumerated risk-learning and fright pathways** changes the predator's effect
on selection for caution. Shared fire culture, building and instincts remain available in both
arms. A positive result would be about this intervention, not about "learning" in general.
