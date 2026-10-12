# Pre-registration, version 3.1

Version 3 was written 2026-10-12 after the second independent review. **Version 3.1** amends it
after the third review (`reviews/2026-10-12-astra-review-3.md`, verdict "run after these specific
changes"), before any confirmatory run. The file name is kept because the harness hashes it as an
input; the version that governs the run is the one recorded in the run's manifest.

v1 stands as it was (tag `confirmatory-v1`, outputs in `results-v1/`). v2 was stopped unread
(`RUNLOG.md`). v3's confirmation bank (2001 to 2256) was registered but never accessed.

## Amendments in 3.1 (what changed from 3, and why)

1. **Input validation.** The analysis now refuses to run unless the rows are exactly the expected
   jobs, each once, with required fields. Missing jobs are invalid input, never undefined biology.
   (The review showed the v3 analysis certifying a one-seed input.)
2. **Usable-seed rule.** A categorical primary conclusion requires every seed to have a defined S in
   all four primary arms. Otherwise the conclusion is "withheld" and only conditional estimates,
   missingness and all-colony outcomes are reported.
3. **Freeze.** The clean-tree check covers the whole tracked repository. Every input file,
   including `src/sim/rng.js`, this document and `RISK-LEARNING.md`, is hashed at launch and
   checked again at completion; reanalysis is bound to the raw-data hash and logged.
4. **Cohort boundary.** The cohort is creatures born **strictly before** tick 1440. (A creature born
   at tick 1440 can still breed at tick 2879, the last processed tick.)
5. **Specificity check.** Compares a digest of the complete final state of each no-predator colony
   with risk learning on and off, not five summary numbers.
6. **Dawn wipe.** Now clears risk memory too, so the wipe ablation removes it.
7. **Wording.** "Equivalence" becomes "bounded"; the negative-interaction label no longer claims
   that risk learning "strengthens" the predator effect; branch order is stated; the gene regime is
   described as an empirical check; delta's justification is restated as a declared choice.
8. **Seed bank.** v3's own rule says an amendment after commitment takes a new seed bank. So 3.1
   confirms on **seeds 3001 to 3256**. The 2001 to 2256 bank stays unused.

## The question

Does a predator change selection on the inherited caution trait, and does **predator-risk
learning**, as defined in `RISK-LEARNING.md`, change that effect?

This tests one software intervention in one simulated world: switching off the enumerated
risk-learning and fright pathways. Shared fire culture, building, comfort learning, instincts and
the physical consequences of injury remain in both arms. A result either way says nothing about
"learning" in general.

## Design

**Arms, 120 days each:**

| arm | predator | risk learning |
|---|---|---|
| none-on | none | on |
| none-off | none | off |
| default-on | the default prowler | on |
| default-off | the default prowler | off |
| gene-on | gene-only regime (simulation check) | on |
| direct-on | direct predator (stress test) | on |

The gene-only and direct regimes have no prowler, so risk learning never occurs in them; their on
and off arms were identical in every saved field on all 64 development seeds, so only "on" is run.

**Seeds.** 3001 to 3256 (N = 256). Development 1001 to 1064; v2 calibration 101 to 116; v1 and v2
1 to 64; regression tests 1 to 7; v3's unused bank 2001 to 2256. The list is fixed in code
(`FROZEN.confirmSeeds`); a confirmatory run refuses overrides, a dirty tree, and existing output.

**Measure.** For each colony, S is the Robertson–Price selection differential on caution over the
cohort born before tick 1440 (day 60): offspring-weighted mean caution minus plain mean, early
deaths counted with their actual offspring. Each cohort member's whole lifespan (old age at more
than 1440 ticks) ends within the run, which processes ticks 0 to 2879. S is undefined (not zero)
when the cohort has fewer than two members or no births.

**Contrasts.** E_on = S(default-on) − S(none-on); E_off = S(default-off) − S(none-off);
I = E_off − E_on. All three on the common set of seeds where all four arms have a defined S,
paired by seed, 95% percentile bootstrap over seeds, 10,000 seeded resamples.

## Method checks (validation)

| check | pass rule | test or evidence |
|---|---|---|
| risk learning off removes risk memory | every creature in every none-off and default-off colony ends with zero risk memory and no `dark beast` experience | `test-lab-audit.js` *Risk learning off...* |
| risk learning on learns risk | at least 90% of default-on colonies have some risk memory | development |
| comfort learning about rest is kept | every default colony in both arms has rest memories | *...keeps comfort learning about rest* |
| the switch is specific | the complete final-state digest of none-on equals none-off in every seed | development (`results-dev/v3.1/`) |
| full horizon | every H3 colony scored at tick 2880 | harness |
| simulation check | S(gene-on) − S(none-on): 95% interval above zero | development |

**Validated** means every check passes. The specificity check is a negative control for effects
of the switch when there are no predator encounters; the pathway tests cover what it does when
there are. The simulation check is an empirical gate: passing means this gene-linked regime gave a
resolvable positive reproductive signal at N = 256; failing means the gate failed, and does not
license retuning and retrying. It is not a measure of the method's detection limit.

## delta

**delta = 0.01**, in units of S (caution units of the offspring-weighted mean), declared as the
absolute interaction size this study is designed to resolve. For scale only: it is about 6% of the
founders' SD of caution (0.174), and about two-thirds of the S difference the gene-only regime
produced on development seeds. Smaller interactions remain possible and may matter under other
questions or over longer runs. delta was 0.02 in a development dry run and was set to 0.01 before
any confirmatory data; that makes a "bounded" result harder, not easier.

## Planning figures

From the 64 development seeds (rerun with the final code in `results-dev/v3.1/PRECISION.md`), the
per-seed SD of I was about 0.05, giving a standard error near 0.003 at N = 256. Under a normal
approximation that is roughly 88% power to detect I = 0.01, about 35% for I = 0.005, and about a
77% chance that the interval falls inside ±0.01 when the true I is zero. These are planning
calculations from 64 seeds, not measured operating characteristics of the whole decision table.
An inconclusive result is an accepted possible outcome.

## Decision rules (primary: the default predator)

Applied mechanically by `decide()` in `analyze.js`, tested on invented cases in
`test-lab-analysis.js`. Checked **in this order**; the first that applies is the conclusion.

| order | evidence | conclusion |
|---|---|---|
| 1 | any method check fails | **unvalidated**: estimates and limitations only |
| 2 | fewer than all 256 seeds have S in all four arms | **withheld**: conditional estimates only |
| 3 | I's interval above zero **and** E_off's interval above zero | **attenuation**: risk learning, as defined, reduces a positive predator-related selection differential on caution; I's size is always reported, and "attenuation" does not mean larger than delta |
| 4 | I's interval above zero, E_off's not | **effect modification**: shielding of a positive advantage is not established |
| 5 | I's interval below zero | **opposite direction**: risk learning shifts the predator-related selection differential upward relative to risk learning off; the signs of E_on and E_off are reported before any stronger wording |
| 6 | I's interval entirely inside (−0.01, +0.01) | **bounded**: the mean interaction lies within ±0.01 at the 95% level; this does not mean either predator effect is zero, nor rule out a large proportional change in a small E_off |
| 7 | anything else | **inconclusive** |

E_on and E_off are always reported with I. No secondary result can replace the primary.

## Secondary and descriptive (not tests)

- Gene-only and direct regimes: E_on only.
- All-colony outcomes per arm: extinctions, births, offspring credited to cohort parents (a child
  of two cohort parents counts twice), predator attacks and non-fatal attacks, predator and hunger
  deaths, mean caution of the living at day 120 (survivors only), undefined S.
- Caution and vulnerability, learning-on arms: caution and the share of night ticks takeable under
  each rule (logged before each draw, fatal ticks included) are ranked within colony, scaled, pooled
  and correlated (Spearman); interval by resampling colonies (2,000). Cohort members with no night
  ticks are excluded and counted; degenerate resamples are dropped and counted.
- H1: share of colonies in which c2 fed the fire by day 17, watching allowed versus blocked (c2
  keeps full access); paired difference; predicted above zero.
- H2 (70 days): late practice; a fire with no gap; per colony with a descendant practitioner, the
  share who observed an actual feed before their own first, in event order; mean over colonies,
  bootstrap over colonies; "more than half" means the interval is above 0.5; colonies without a
  descendant practitioner are excluded and counted. Observing first is opportunity, not cause.
- Ablations (predator present, 50 days): unchanged, no learning by watching, memory wiped every
  dawn (outcome memory, fright location and risk memory; bonds kept), no children.

## Development observations, disclosed

From development seeds 1001 to 1064 (`results-dev/`, and the final-code rerun in
`results-dev/v3.1/`): the default predator kills very few creatures (3 in 64 colonies with risk
learning on, 10 off, in the v3 run) and mostly mauls; non-fatal attacks were in the hundreds. The
v3 dry run at delta 0.02 decided "equivalence"; rerun at delta 0.01 the same data are
"inconclusive" (I = 0.001 [−0.011, 0.014]). Both are preserved and labelled.

## Execution

- `node lab/research/run.mjs` at a committed tree with no tracked changes. It writes
  `manifest-launch.json` with input hashes before simulating, verifies the hashes after, refuses to
  overwrite earlier output, writes `raw.json` and a manifest with its hash, then analyses.
- A run is invalid if any job fails, inputs change, or fewer runs complete than expected. An invalid
  run is logged in `RUNLOG.md` and repeated from scratch at the same commit; runs are never merged.
- A bug found after this version is committed is handled as a new written version with a new seed
  bank. Results from incompatible versions are never pooled.

## How we will report each outcome

Unvalidated or withheld: say so as the headline, with estimates. Bounded: report the bound, with
E_on and E_off to show how much predator effect there was to change. Attenuation: report its size
and the scope of the intervention. Effect modification or opposite direction: report I with the
signs of E_on and E_off. Inconclusive: say so as the headline.
