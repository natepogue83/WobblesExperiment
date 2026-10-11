# Pre-registration v2

Committed 2026-10-11, after an independent review of v1
(`reviews/2026-10-11-astra-review.md`) and before any confirmatory run of the v2 code.
v1 (git tag `confirmatory-v1`, outputs in `results-v1/`) stands as it was; it is not rerun or
overwritten. Nothing here is decided by looking at v2 confirmatory data.

## Why a v2

The review found that v1's main causal claim ("learning absorbed the selection pressure") was an
explanation written after the registered prediction failed, and found four measurement defects:

1. The "practitioner" count could include creatures that only watched (`fireReport`).
2. One predator attack was re-remembered as fresh harm on many later ticks.
3. "Resting somewhere closed" counted ticks spent walking toward a resting place.
4. The targeted predator read a stale record of what a creature had done.

It also found that creatures' choice to strike a predator read hidden material properties, that
the isolation control in H1 removed access to the fire as well as observation, that breeding
scanned creatures in a fixed order, that statistics ignored the matched-seed design and treated
relatives as independent, and that the 16-day eligibility rule for the individual analysis was
never registered.

All of these are fixed in the v2 code, each with a regression test in `tests/test-lab-audit.js`.
The fixes change the simulation's dynamics, so v2 is a new experiment, not a corrected v1.

## Development work done before this document (disclosed)

On development seeds **101 to 116 only**, which are never used in the confirmatory run, we
calibrated two predators that are not hypotheses but checks on the method. The full record is
`results/CALIBRATION.md`; a diagnostic is `dev/diagnose-exposure.mjs`.

- **Exposure predator.** At night, takes a creature that rested in the open (no fire, no walls)
  with a fixed chance per tick. Chances 0.005 to 0.03 produced no selection on caution in 16
  seeds. A diagnostic showed why: across the cohort, caution barely changed how much of the night
  a creature spent exposed (cautious 68%, bold 72% at chance 0.02). The trait does not, in this
  world, buy much of the behaviour the predator punishes. Frozen at **0.01** (1 of 16 colonies
  extinct) as a check on the behavioural route.
- **Direct gene predator (assay check).** At night, takes any creature outside fire or walls
  with a chance proportional to (1 - caution / 1.6). No behaviour is involved, so if the selection
  measure cannot see this, it cannot see anything. At 0.002 per night tick it killed about 16 per
  colony with no extinctions, and gave a selection differential 0.014 [-0.013, 0.043] above the
  no-predator colonies in 16 seeds. Frozen at **0.002**. Its 64-seed result tells us the smallest
  selection this assay can detect.

These calibrations already suggest the honest answer to v1's question may be "the assay is too
weak to see selection of plausible size in 120 days", not "learning shields selection". v2 is
designed to tell those apart.

## Measures

- **Selection differential S** (Robertson–Price) for each colony: over the cohort born by day 60,
  including founders and every early death (zero offspring), the offspring-weighted mean caution
  minus the plain mean. A cohort member born by day 60 has had a full 60-day lifespan to breed by
  day 120. Colonies whose cohort has fewer than two members or no births give no S and are
  dropped from contrasts involving them; the number used is always reported.
- **Practitioner**: a creature with at least one `fed_fire` event.
- **Night behaviour**, measured after each night tick from where the creature is and what it
  actually did: exposed (no fire, no walls, and, for the default predator only, fewer than two
  neighbours), rested, rested by fire or in walls, ate, fled.
- **Protective learning off**: a creature stores no memory of what happened when it rested or
  fled, and none of being attacked (its own or seen), and fright-driven preferences after an
  attack are switched off. Food, fire, building and every other learning is unchanged. Innate
  behaviour (flight from a visible predator, attraction to warmth, the caution-weighted pull
  toward closed places at night) is unchanged.

## Hypotheses and predictions

**H1v2 (observation is needed for the practice).** Creature c2 lives in the colony with full
access to the fire and fuel; in the "blocked" arm it learns nothing from watching. Prediction:
the share of colonies in which c2 feeds the fire by day 17 is lower when blocked than when not;
the paired difference (allowed minus blocked) has a 95% interval above zero.

**H2v2 (persistence after founder turnover).** Descriptive with one prediction. We report late
fire-feeding by descendants (v1's measure, renamed "late practice"), whether a fire burned
without any gap from day 3 to day 70, and, for each descendant practitioner, whether it had seen
a fire grow when fed before its own first feed. Prediction: more than half of descendant
practitioners had seen it done first.

**H3v2 (does the predator select for caution, and does protective learning shield it?).**
Conditions: predator {none, default, targeted, exposure, direct} x protective learning {on, off}.

- **H3-assay (gate).** The direct gene predator raises S above no predator, learning on: paired
  difference with a 95% interval above zero. If this fails, the assay cannot detect selection of
  the size a direct, gene-linked kill produces, and every H3 null below is uninformative; we will
  say so as the headline.
- **H3-main.** The default predator's effect on S, learning on: we predict **no detectable
  effect**, and register no direction.
- **H3-shield (primary test of v1's claim).** The interaction: (predator effect on S with
  protective learning off) minus (predator effect on S with it on), paired by seed, default
  predator. The shielding hypothesis predicts it is **above zero**, interval excluding zero. We
  also report it for the targeted, exposure and direct predators.

Interpretation fixed in advance:

| H3-assay | H3-shield (default) | what we will say |
|---|---|---|
| passes | above zero | learned protection reduces selection on caution in this world |
| passes | not above zero | the predator does not select for caution here, with or without protective learning; shielding is not supported |
| fails | anything | the assay cannot see selection of this size in 120 days; neither shielding nor its absence is shown |

**H3-behaviour (descriptive).** Within-colony rank correlations, resampling whole colonies, between
caution and each measured night behaviour, for each predator. This says how much the caution
gene actually changes what a creature does.

**Ablations (descriptive, as in v1, not tests).** Predator present, 50 days: unchanged, no
learning by watching, memory wiped every dawn, no children. Reported with paired differences from
unchanged.

**Keeper study (v1 H4).** Not rerun. Reported as an audited prototype in an appendix, with the
review's findings about its scoring horizon, rain tool, telemetry and a false anecdote.

## Methods

- Seeds 1 to 64, identical across conditions; six founders; population cap 12; 120 days for H3,
  17 for H1, 70 for H2, 50 for ablations.
- Contrasts between conditions: paired bootstrap over seeds, 10,000 resamples, seeded.
- Correlations: Spearman, ranks within colony, cluster bootstrap over colonies (2,000 resamples).
- Results are sorted by experiment, condition and seed before analysis, so intervals do not
  depend on which worker finished first.
- Everything is produced by `node lab/research/run.mjs` at the commit recorded in
  `results/manifest.json`, with the raw per-colony and per-individual rows in `results/raw.json`.

## What would change our minds

If H3-assay fails, we stop claiming anything about selection on caution. If it passes and
H3-shield is above zero, v1's explanation becomes a supported result in this world, which we
would report with the size of the effect. If it passes and H3-shield is not above zero, v1's
explanation is wrong here, and we say that plainly.
