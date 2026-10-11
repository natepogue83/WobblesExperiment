# Pre-registration

Committed 2026-10-11, before the confirmatory runs. Pilot runs (8 seeds, 40 and 120
days, see `marketing/overnight/OVERNIGHT-2.md`) informed the hypotheses below; those
pilot numbers are not reused as evidence.

## The system

A deterministic grid world (`lab/`): materials with hidden properties, physical rules
that compose (wet and dry, heat and fire, sparks, stacking, cover, walls, cutting,
joining, growth, lean seasons), and creatures that see only visible features, act with
a few primitives, learn per-creature outcome expectations from their own actions (and
more weakly from watching others), breed with inherited and mutated genomes, and die of
hunger, old age or a predator. Nothing in a creature's brain reads a hidden property.
All randomness goes through a seeded generator; a seed fully determines a run.

The genome holds: curiosity, patience, sociability, learnRate, caution, brawn.
Caution raises the weight of past harm, the pull toward closed places at night, and the
urge to flee a predator. Brawn raises strike power and carrying capacity and costs food.

## Hypotheses and predictions

**H1 (social transmission).** Fire-feeding (placing dry fuel on a glowing source) is
learned from experience and spreads by observation. *Prediction:* with a glowing lump
placed on day 3, by day 17 the practice has at least two independent practitioners in
more than half of colonies; a creature held out of sight for the whole period never
acquires it (0 of N).

**H2 (culture outlives individuals).** *Prediction:* over 70 days, in more than half of
colonies the fire is still fed in the last four days by creatures born after the lump
appeared, after every founder has died.

**H3 (a predator does not select for caution).** A predator that hunts creatures alone
in the open at night, repelled by fire, walls and crowds, is added to select for
caution. *Prediction (from the pilot, now confirmatory):* mean caution among the living
at day 120 is **not higher** with the predator than without; the 95% bootstrap CI of the
difference (predator minus control) excludes positive values greater than 0.03.

**H3a (mechanism).** *Prediction:* within predator colonies, an individual's caution is
negatively correlated with its number of offspring (Spearman rho < 0, CI excluding 0),
and cautious individuals spend a larger share of night ticks fleeing or resting in
closed places and a smaller share eating.

**H3b (a pressure that lands).** A variant predator that ignores crowds and attacks
only creatures resting in the open at night (so that the thing caution buys is exactly
what is punished) is predicted to make mean caution rise relative to control
(difference > 0.03, CI excluding 0). If it does not, we report that too.

**H4 (optional, LLM as Keeper).** Exploratory, no prediction registered.

## Methods

- N = 64 seeds per condition (seeds 1..64), identical across conditions.
- Colonies start with 6 founders; popCap 12; 120 days for H3 family, 17 days for H1,
  70 days for H2.
- Conditions for H3: control (no predator), predator (default), targeted predator (H3b).
- Metrics: mean genome values among the living at the end; births; deaths by cause;
  per-individual offspring counts and night-time activity shares.
- Uncertainty: 95% bootstrap CIs over seeds (10,000 resamples). Correlations: Spearman
  with bootstrap CI.
- Ablations (reported, not pre-registered as tests): no observation learning, memory
  wiped daily, no breeding.
- Everything is produced by `node lab/research/run.mjs` into `lab/research/results/`.

## Known confounds, fixed before running

- "Safe nights" in the pilot counted a crowd of two as safe, inflating the baseline;
  the report measures place kinds (fire, roof, walls, open) directly.
- The pilot's "memory wipe" test wiped one creature once; H1's isolation test is the
  cleaner transmission test and is the one registered here.

## What would change our minds

If H3 fails (caution rises with the default predator at scale), the headline becomes
"the pilot was noise", and we say so. If H3b fails, the headline becomes "we could not
find a pressure that lands", which is also a result.
