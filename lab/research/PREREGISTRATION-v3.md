# Pre-registration v3

Written 2026-10-12, after the second independent review (`reviews/2026-10-11-astra-review-2.md`,
verdict "redesign first"), and before any v3 confirmatory run. It supersedes
`PREREGISTRATION-v2.md`, whose run was stopped unread (`RUNLOG.md`). v1 stands as it was (tag
`confirmatory-v1`, outputs in `results-v1/`).

Correction to v2: v2 said every fix had a regression test in `tests/test-lab-audit.js`. That was
not true; several had none. In v3 every item below names its test.

## The question, narrowed

Does a predator change selection on the inherited caution trait, and does **predator-risk
learning** (defined exactly in `RISK-LEARNING.md`) change that effect?

This is a question about one software intervention in one simulated world. A result either way
says nothing about "learning" in general, and nothing about shared fire culture, building or
instinct, which stay available in both arms.

## Design

**Arms (H3), 120 days each:**

| arm | predator | risk learning |
|---|---|---|
| none-on | none | on |
| none-off | none | off |
| default-on | the default prowler | on |
| default-off | the default prowler | off |
| gene-on | gene-only regime (simulation check) | on |
| direct-on | direct predator (stress test) | on |

The gene-only and direct regimes have no prowler, so no risk learning ever happens in them and
their "on" and "off" arms are identical. This was verified on all 64 development seeds, so only
"on" is run.

**Seeds.** Confirmation uses seeds **2001 to 2256** (N = 256), which nothing else has used.
Development used 1001 to 1064; the v2 calibration used 101 to 116; v1 and the stopped v2 used 1
to 64; regression tests use 1 to 7. The banks do not overlap. The seed list is fixed in code
(`FROZEN.confirmSeeds`), and a confirmatory run refuses any environment override.

**Measure.** For each colony, S is the Robertson–Price selection differential on caution over the
cohort born at or before day 60 (tick 1440): offspring-weighted mean caution minus plain mean,
early deaths counted with their actual offspring (often zero). Every cohort member has a full
60-day lifespan before the end at tick 2880. S is undefined (not zero) for a colony whose cohort
has fewer than two members or no births.

**Contrasts.** E_on = S(default-on) − S(none-on). E_off = S(default-off) − S(none-off).
I = E_off − E_on. All three are computed on the **common set of seeds** where all four arms
have a defined S, paired by seed, with a 95% percentile bootstrap over seeds (10,000 resamples,
seeded). The number of seeds used and dropped is reported.

## Method checks (validation), with pass rules fixed now

| check | rule | test |
|---|---|---|
| risk learning off removes risk memory | every creature in every none-off and default-off colony ends with zero risk memory and no `dark beast` experience | `test-lab-audit.js`: *Risk learning off: no route...* |
| risk learning on learns risk | at least 90% of default-on colonies have some risk memory | development: 63/64 |
| comfort learning about rest is kept | every default colony, in both arms, has rest memories | *...keeps comfort learning about rest* |
| the switch is specific to predator risk | none-on and none-off identical in every seed | development: 64/64 identical |
| full horizon | every H3 colony scored at tick 2880 | harness |
| simulation check | S(gene-on) − S(none-on) has a 95% interval above zero | development: 0.015 [0.000, 0.030] |

**Validated** means every check passes. The simulation check is not a measure of "the smallest
effect the method can detect"; it shows only that a deliberately strong, behaviour-free,
gene-linked mortality produces a selection signal this analysis can resolve at N = 256.

## The effect size worth resolving

**delta = 0.01** in units of S. On development seeds the gene-only regime, which kills about 17
creatures per colony with a hazard tied directly to the caution gene, produced an S difference of
about 0.015. delta is two-thirds of that: an attenuation of the predator's effect smaller than
two-thirds of the strongest gene-linked pressure we built is, in this world, too small to matter
for the question. It is about 6% of the founders' spread in caution (SD 0.174).

## Sample size

On development seeds the per-seed SD of I was 0.051 (`results-dev/PRECISION.md`). With N = 256
the standard error of I is about 0.0032, so a 95% interval has a half-width of about 0.006, which
is narrow enough for an interval to sit inside ±0.01 when the true I is zero, and gives roughly
85% power to detect I = 0.01. The per-seed SD of the gene check was 0.062, giving a standard error
of about 0.004 at N = 256. These are planning figures from 64 development seeds and may be
optimistic.

## Decision rules (primary: the default predator)

Applied mechanically by `decide()` in `analyze.js` and tested on invented cases in
`test-lab-analysis.js`.

| evidence | what we will conclude |
|---|---|
| any method check fails | **unvalidated**: report the estimates and limitations only; no claim about attenuation |
| I clearly positive (interval above zero) **and** E_off clearly positive | **attenuation**: risk learning, as defined, attenuates a positive predator-related advantage of caution; we state the size and the scope of the intervention |
| I clearly positive, E_off not clearly positive | **effect modification**: the intended shielding of a positive advantage is not established |
| I clearly negative | **opposite direction**: risk learning strengthens the predator's effect on caution |
| I's interval entirely inside (−0.01, +0.01) | **equivalence**: any attenuation is smaller than 0.01 in this setting; this does not mean either predator effect is zero |
| anything else | **inconclusive**: the interval includes zero and effects of meaningful size |

E_on and E_off are always reported alongside I. A significant result on a secondary contrast
cannot replace the primary.

## Secondary and descriptive (not tests)

- **Gene-only and direct regimes**: E_on only.
- **All-colony outcomes** per arm: extinctions, births, cohort births, predator and hunger
  deaths, mean caution of the living at day 120 (survivor-conditioned, labelled as such), and
  the count of undefined S.
- **Caution and vulnerability**: within-colony rank correlation, resampling whole colonies (2,000
  resamples), between caution and the share of night ticks a cohort member was takeable under each
  predator's rule, logged before each predator draw (so a creature taken on a tick is counted).
  Every cohort member is included; there is no age filter. Degenerate resamples are dropped and
  counted.
- **H1 (does feeding the fire depend on watching?)**: share of colonies in which c2 fed the fire
  by day 17 with watching allowed versus blocked (c2 keeps full access), paired difference.
  Prediction: allowed minus blocked is above zero. This is a difference in probability, not proof
  that watching is necessary.
- **H2 (persistence after the founders die, 70 days)**: late practice (founders all dead, a fire
  burning, fed by a descendant in the last four days); whether a fire burned with no gap; and, per
  colony with at least one descendant practitioner, the share who **observed an actual feed**
  before their own first feed, in event order. Colonies with no descendant practitioner are
  excluded from that share and counted. Aggregation is the mean over colonies, with a bootstrap
  over colonies. "More than half" means the interval is above 0.5. Observing first is evidence of
  an opportunity to learn, not proof that observation caused it.
- **Ablations (predator present, 50 days)**: unchanged, no learning by watching, memory wiped
  every dawn (outcome memory and fright location; bonds kept), no children. Paired differences
  from unchanged.

## Development observations, disclosed

On development seeds 1001 to 1064 (`results-dev/`), and in a dry run of this exact analysis on
those seeds (`results-dev/dry-analysis/`):

- the default predator killed 3 creatures across 64 colonies with risk learning on, and 10 with
  it off; it mostly mauls rather than kills, so it may exert little selection at all;
- all method checks passed, the gene check only just (lower bound 0.000);
- the dry-run decision was "equivalence" at delta 0.02. delta was then set to 0.01 for the reason
  above, before any confirmatory run. We record this so a reader can judge whether it moved the
  goalposts.

## Execution

- `node lab/research/run.mjs`, at a committed, clean tree. The manifest records the commit,
  whether the tree was dirty, source hashes, the seed list, the frozen settings, node version,
  the number of runs expected and completed, and that the run was fresh rather than merged.
- A run is invalid if any job fails, if the tree is dirty, or if completed runs are fewer than
  expected. An invalid run is logged in `RUNLOG.md` and repeated from scratch at the same commit;
  it is never merged with another.
- A bug found after this document is committed is handled as a written amendment with a new
  version number and a new seed bank. Results from incompatible code versions are never pooled.

## What would change our minds

If validation fails, we claim nothing about attenuation. If the primary result is equivalence,
we say risk learning does not detectably attenuate the default predator's effect in this world,
and we report E_on to say whether there was much of an effect to attenuate. If it is attenuation,
we report it with its size and scope. If it is inconclusive, we say so as the headline.
