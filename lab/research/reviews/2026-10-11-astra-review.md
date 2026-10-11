# Wobblins lab: skeptical independent review

**For Nate Pogue — 11 October 2026**  
**Scope:** the exported `wobblins-lab` snapshot named in `START-HERE.md`. This is a review, not a repaired experiment or an assessment of the current live project.

## My judgment

This could be a useful portfolio piece, but I would not submit the current report unchanged. The project demonstrates that you can direct the construction of an inspectable artificial-life experiment, retain an inconvenient result, and ask for independent scrutiny. Those are valuable signals. The report currently weakens them by presenting an untested explanation as its main discovery, and by repeating a model's false account of one colony as if it were established fact.

**The evidence does not yet show that learning absorbed the predator's selection pressure.** It shows a small, uncertain change in mean caution among surviving colonies, different recorded action preferences across temperaments, and a substantial effect of disabling observation learning on fire persistence. The causal bridge between those results is missing. Several measurement and simulation defects make that bridge less secure still.

The strongest defensible story today is: **“We built a small experimental world, failed to reproduce an apparent evolutionary effect, and found that observation learning strongly affects fire persistence. An independent audit then exposed weaknesses in the measurements and in our causal explanation.”** That is less dramatic than the current title, but it would give a skeptical researcher more reason to trust your judgment.

Anthropic describes the Fellows program as empirical research on concrete safety questions. My assessment of portfolio value is an inference, not knowledge of its admissions decisions. A small, well-audited result is a better demonstration of that research discipline than a broad safety analogy whose mechanism has not been established. [Official program description](https://alignment.anthropic.com/2025/anthropic-fellows-program-2026/).

## What I checked, and what “verified” means here

I read the report, preregistration, decision log, and pilot notes in the requested order; checked the saved results and summary; inspected the simulation, experiment, statistics, and Keeper code; and programmatically audited all **30 Keeper run files, containing 1,200 decision records**, including 480 model decisions. I recomputed Keeper aggregate means, counts, budget use, and token-based costs, and closely checked the anecdotes used in the report.

I also executed isolated diagnostic cases against the supplied simulation functions. Those cases used a constant stand-in random generator because the actual generator is absent from the export. They demonstrate specific code behavior; **they do not reproduce the 64-seed study.** I made no paid model calls and did not change the source snapshot or its saved results.

Throughout this review:

- **Verified — saved data:** directly supported by the exported records or agreement between the saved tables and JSON. This does not independently validate the underlying simulation run.
- **Verified — code/probe:** visible in the supplied code, with an isolated execution where stated.
- **Inference:** an interpretation, alternative explanation, or recommendation.
- **Not established:** the supplied evidence cannot decide it.

Source references below use paths relative to `wobblins-lab`, with line numbers referring to this export. Keeper records are identified by filename and decision day.

## 1. Which report claims survive scrutiny?

### The numerical backbone mostly agrees; the interpretation does not

| Claim | Audit finding | What to say instead |
|---|---|---|
| Default predator changed caution by 0.02, CI −0.03 to 0.07 | **Verified — saved data.** Exact estimate 0.021723, CI −0.028544 to 0.070714. But it is a difference in changes, among surviving colonies. | “No clear change detected in this survivor-conditioned endpoint.” |
| Targeted predator changed caution by 0.00, CI −0.04 to 0.05 | **Verified — saved data.** Exact estimate 0.003056, CI −0.043068 to 0.050497. | “The registered positive prediction was not supported.” |
| “Nothing moved”; predator “does not select for caution” | **Not established.** Neither interval demonstrates equivalence or excludes the registered +0.03 threshold. Only caution and brawn are summarized, not every genomic property or lineage outcome. | “The study did not resolve the direction of the caution effect.” |
| Caution–offspring correlation is 0.02, CI −0.04 to 0.08 | **Mismatch.** Current `summary.json` gives 0.019925, CI −0.034319 to 0.074598; current `RESULTS.md` rounds to **−0.03 to 0.07**. The report's interval appears in `first-64-seed-run.log`. | Generate all prose/table values from the same frozen analysis. This discrepancy does not change the substantive conclusion. |
| Cautious and bold individuals had “the same number” of offspring | The saved means are **1.75 versus 1.62**, not equal. A near-zero pooled rank correlation is not an equivalence test for these two groups. | “No clear caution–offspring association was detected by the reported analysis.” |
| Twice as much closed-place rest, more than twice as much fleeing | Recorded shares agree: **20.3% vs 11.1%** and **3.4% vs 1.4%**. The first ratio is about 1.82, not exactly two. More importantly, these counters include travel and intended actions; see below. | Describe recorded plan shares until the activity measurement is repaired. |
| Cautious individuals forage slightly less at night | **Contradicted by the predator table as written.** Its eating-plan shares are **14.1% cautious vs 13.7% bold**. The opposite direction appears in the no-predator table. | Remove the claim in section 4; it does not describe the main predator result. |
| 36 direct predator deaths and about 260 additional hunger deaths | **Verified — saved data.** Hunger totals are 300 vs 36, a difference of **264**. Extinctions are 10/64 vs 1/64. | Report the treatment differences, then distinguish possible mechanisms from measured mediation. |
| Similar endpoint fire counts rule out fire loss as the hunger mechanism | **Not established.** The counts 31/64 vs 33/64 agree, but an endpoint says nothing about earlier outages, heat exposure, fire location, or access. | “Endpoint fire persistence was similar; we did not identify the path to excess hunger deaths.” |
| Observation learning is important for fire persistence | **Strongest supported result, with qualifications.** At day 50, fire survives in 36/64 baseline colonies and 6/64 without observation learning: 56.25% vs 9.375%, a 46.875 percentage-point difference. Hunger totals are 96 vs 587, about 6.11-fold. | State this intervention result for this implementation. Do not present it as proof of evolutionary shielding. |
| Culture is “most of what keeps a colony alive” | **Too broad.** All four ablation conditions have **zero colony extinctions at day 50**, including daily memory wipes. Population size and individual hunger deaths worsen, but colony survival is not lost at this horizon. | Distinguish fire persistence, individual welfare, population size, and colony extinction. |
| H1: 32/64 colonies had two independent practitioners | **Saved number verified; construct not verified.** The practitioner counter is defective. | Mark provisional and recompute using actual fire-feeding events. |
| H2: 33/64 colonies sustained culture after founder turnover | **Saved operational count verified.** It shows late feeding by nonfounders plus a burning fire and dead founders. It does not establish an unbroken transmission chain or exclude reinvention. | “Late fire-feeding by descendants occurred in 33/64 colonies.” |
| The three headline findings are all preregistered | **Overstated.** The preregistration explicitly calls the ablations “reported, not pre-registered as tests.” The shielding explanation is not the successful outcome of H3a; its fitness prediction failed. | Separate registered tests, descriptive ablations, and post-result hypotheses. |

Sources: `research/REPORT.md`, especially lines 14–32, 116–230, 286–310; `research/results/RESULTS.md`; `research/results/summary.json`; `research/PREREGISTRATION.md:23–62`.

There is also a small internal correction: the limitations say H1 and H2 both came in at exactly half. H1 is 32/64; H2 is **33/64**.

### The pilot failed to replicate; “the pilot was noise” is a stronger diagnosis

**Verified:** the eight-seed pilot's directional story did not receive support from the larger reported analysis. That is worth saying plainly.

**Not established:** sampling noise is the sole reason. The export does not contain the original pilot data, seed manifest, and pinned implementation needed to distinguish noise from measurement changes or code changes. The pilot also says the predator was softened twice during development. That is acceptable exploratory tuning, but it needs a clean boundary before the confirmatory run.

Use “the pilot finding did not replicate.” Keep the pilot code/data and identify whether its seeds overlap the registered seeds 1–64. I cannot determine that overlap from the supplied pilot notes. Reusing seeds would need disclosure; it must not be silently described as entirely fresh holdout evidence.

## 2. Is learning shielding the genome actually shown?

**No. It is a plausible explanation that this experiment does not distinguish from several simpler ones.**

Imagine installing a burglar alarm, seeing little change in burglary, and concluding that residents compensated by locking their doors more carefully. That explanation needs measurements or an intervention on door-locking. The absence of a clear burglary change cannot supply them.

Here, the missing comparison is whether the predator creates a caution-related fitness advantage **when the proposed learned protection is unavailable**, and whether enabling that protection reduces the advantage. The ablations measure fire persistence and colony outcomes at 50 days; they do not cross learning conditions with predator conditions and test the relevant selection effect at the registered evolutionary horizon.

Several alternatives remain:

1. **The danger may not impose much differential reproductive cost on caution.** Default attacks killed 36 creatures across 64 runs; targeted attacks killed only two. Nonfatal attacks could matter, but their relationship to caution and reproduction was not established. A harmful predator is not automatically an effective selector for this particular trait.
2. **Safety is partly supplied by built-in behavior.** Creatures have an innate flight score, a routine that seeks safe locations, attraction to warmth, and a caution-dependent preference for protected rest. A bold creature can flee before learning anything. This is an alternative to the specific claim that learned behavior closes the fitness gap.
3. **The environment supplies shared protection.** Every main experimental colony receives an ember with 120 fuel on day 3. Fire, walls, and crowds can protect individuals irrespective of caution. Shared environmental protection and individual acquired knowledge are different mechanisms; the study currently bundles them.
4. **The experiment is short and population-limited.** Reproduction stops at 12 living creatures. Once the cap is reached, better-fed or safer creatures may have little opportunity to translate that advantage into additional births. Small founder populations also create drift and accidental trait associations.
5. **The analysis removes some of the most informative failures.** Extinct colonies disappear from the genome comparison, and creatures dying before 16 days disappear from the individual analysis. If low caution caused early death, the mechanism analysis could miss precisely that path.
6. **Recorded behavior and attack memory are imperfect.** The defects below can change both what creatures learn and what the report calls sheltering.

None of these alternatives is proved to explain the null. Their existence is enough to make the current causal headline premature. It is also possible to have opposing selection effects, or selection on other traits, without a clear shift in this mean.

The broad idea itself is established background, not a novel discovery. Hinton and Nowlan already discuss how learning changes evolutionary search and can leave little pressure to genetically specify easily learned components. The report is right to cite this tradition. Its contribution would be a carefully demonstrated instance in this particular world, with a useful measurement method—not discovery of the general principle. [Hinton and Nowlan, 1987](https://www.cs.toronto.edu/~hinton/absps/evolution.htm).

### The experiment that would discriminate the explanations

**Recommendation:** after repairing the relevant bugs, register one focused interaction test rather than adding more world features.

Use predator on/off crossed with **protection-related learning enabled/disabled**. Preserve food learning and basic functioning in both conditions, so disabling learning does not merely create a generally incompetent population. Define exactly which acquired expectations and social transfers are disabled; retain the same innate behavior. Run a separate social-transmission contrast if you want to distinguish individual from shared learning.

Within this design, vary caution while holding other inherited traits and initial conditions balanced. Measure actual exposed night ticks, attacks, energy lost to attacks, completed eating/rest actions, survival from birth, and descendants surviving to reproductive age. Include early deaths and entire failed colonies. Record the inherited-trait distribution across generations as a secondary endpoint rather than relying only on final survivors.

The key result is an **interaction**: does the predator favor caution more when learned protection is disabled than when it is enabled? Merely obtaining significance in one condition and not the other is not a test of their difference.

Add a development-stage positive control showing that the predator/fitness measurement can detect a caution advantage under a deliberately simple exposure regime. Freeze that calibration before the confirmatory test and disclose the tuning. Otherwise a second null will still be ambiguous between “learning shields selection” and “this assay never exerted or detected selection.”

Interpret outcomes in advance:

- A caution advantage without learned protection, reduced when learning is enabled, would support shielding, subject to the intervention's specificity.
- No caution advantage in either condition would favor inadequate or undetected trait-specific pressure over the proposed demonstration of shielding.
- A benefit from shared fire even when individual protective learning is disabled would point toward environmental protection.
- An effect emerging only after longer runs would point toward the original horizon being insufficient.

Keep extinction a separate outcome; do not assign an extinct colony an invented caution value of zero. If the final-survivor mean remains an endpoint, label its conditional nature and specify how missing endpoints will be handled before running.

## 3. Methods and preregistration

### Is 64 seeds enough?

**Inference:** 64 is a reasonable small simulation study for a large effect such as the recorded fire-persistence difference. It is not inherently enough for a narrow equivalence claim about caution. Your own interval, extending to about +0.071, demonstrates that the current analysis does not rule out the registered +0.03 effect.

Ten thousand bootstrap resamples do not create ten thousand independent colonies. They stabilize an uncertainty calculation based on the original observations. More seeds cannot correct a mislabeled behavior counter or establish a mechanism absent from the design.

If you retain a smallest meaningful effect of 0.03, justify that threshold and plan sample size against the appropriate paired, colony-level analysis. Avoid choosing a new threshold because it happens to fit the existing interval.

### Important analysis issues

**The comparison ignores its matched design.** The same seeds are used across conditions, but `bootstrapDiffCI` samples each arm independently (`research/stats.js:18–26`; `run.mjs:129–134`). Seed matching does not keep later trajectories identical, but it does preserve an experimental block that should be retained in uncertainty calculations. Bootstrap whole seed blocks. Report the effect of correcting this; do not assume the interval must get narrower.

**Extinction changes who enters the comparison.** There are 63 nonextinct controls, 54 default-predator colonies, and 57 targeted-predator colonies. The reported caution effect therefore compares differently selected survivor sets. These are visible as the `n` values in `summary.json`; they deserve explicit prominence in the report. A complete-pair sensitivity analysis may be informative but remains conditional on survival in both arms.

**The primary endpoint changed form.** The preregistration predicts a difference in final mean caution. The report tests a difference in founder-to-survivor changes. With identical founders and all matched colonies present, those contrasts can coincide; unequal extinction exclusions break that equivalence. Record this as an analysis deviation, with both estimands where feasible.

**The correlation treats relatives and colony-mates as independent observations.** `run.mjs:148–149` pools all eligible creatures; `stats.js:30–38` resamples individuals, with only **2,000** resamples. This is not the report's blanket description of 10,000 resamples over seeds. Resample colonies, retaining their entire groups of creatures. Also distinguish a pooled association from a genuinely within-colony association: colony conditions, kinship, and genome correlations can influence the former.

**Fitness is censored and selectively filtered.** The 16-day eligibility rule is not specified in the preregistration. Young deaths are excluded, and living individuals have differing amounts of reproductive opportunity left at day 120. Raw offspring totals mix ages, exposure durations, and survival. For selection questions, follow defined birth cohorts over comparable horizons and include zero-offspring early deaths; add age-aware analyses where appropriate.

**A few additional confounds need disclosure.** Breeding scans creatures in a fixed order and returns after its first successful birth, so access to the remaining population slot can depend on ordering (`creature.js:195–212`). Other inherited traits can be associated with caution in a small colony. “No watching” disables transfer of action outcomes and attack memories, not simply imitation of fire-feeding. Daily wiping clears several memory structures but retains bonds and attack-location state; it is not a complete reset of all learned/social history (`creature.js:233–241`). These choices are legitimate modeling choices only if described precisely.

### Are the predictions scored generously?

| Prediction | Fair scoring |
|---|---|
| H1: > half with 2+ practitioners | **Not met on the published count**, and the count needs repair. “At the edge” should not blur failure. |
| H1: isolated creature never learns | The recorded 0/64 matches the operational threshold, but the isolation manipulation does not establish the intended causal claim. See section 4. |
| H2: > half persist after founder turnover | **Met as a literal sample-count threshold**, 33/64. Not persuasive evidence that the underlying probability exceeds half: CI 0.39–0.64. Do not retroactively replace the registered criterion, but explain its weakness. |
| H3: exclude positive effects above 0.03 | **Not confirmed.** A CI reaching 0.07 does not pass. |
| H3a: negative correlation and reduced eating | **Fitness prediction failed; eating direction failed in the default-predator summary.** Flight/rest-plan patterns are descriptive support for only part of the behavior prediction, pending corrected measurement and uncertainty. |
| H3b: effect > 0.03 with CI excluding zero | **Not confirmed.** This failure cannot itself validate shielding. |

The preregistration says that if H3b fails, the headline becomes “we could not find a pressure that lands.” The report instead supplies a confident explanation for why the pressure did not land. That is the most consequential departure from the document's own evidential standard.

**Timing is not independently authenticated in this export.** `PREREGISTRATION.md` asserts that it was committed before the confirmatory runs, but the bundle has no relevant Git history or immutable preregistration record. Provide the exact preregistration commit, experiment commit, seed manifest, and run timestamps. This is a missing provenance check, not evidence of misconduct.

## 4. Does the code do what the report says?

These findings vary in severity. The first four affect the core study's measurements or dynamics and warrant tests and a labeled rerun before stronger conclusions.

### A. An observer can count as an independent practitioner

**Practical meaning:** H1's central success measure can count a creature that never fed a fire, and can omit one that did.

`fireReport` defines doers using `e.n - e.seen * 0.45 >= 0.9` (`sim/sim.js:46–54`). But observations and other partial credits have different weights; `seen` counts every update with weight below one (`creature.js:32–38`), including invited observation at 0.6 and incidental observation at 0.15.

**Verified — isolated probes:** seven invited observations, zero actual feeds, produced a doer. One actual fire-feeding credit followed by four incidental observations produced no doer. The variable is neither a reliable action count nor an “ever practiced” indicator.

Use unique creature IDs from actual `fed_fire` events for practice, with a prespecified repetition requirement if one feed is insufficient. Track observational acquisition separately and retain who observed whom before first execution. This bug also contaminates the Keeper's statement about how many creatures feed fires independently.

**Unknown:** how many of the published 32 H1 successes change. The export lacks the raw event traces needed to rescore them.

### B. One attack can be remembered repeatedly as new harm

**Practical meaning:** predator exposure may create continuing invented negative experiences, including in nearby observers, long after the actual attack.

After an attack, `attackNoted` becomes true. Once the attack is more than one tick old, the code sets it false again, while leaving `attackedAt` in place. Subsequent ticks repeatedly enter the learning block and can assign harm to whatever action is current (`creature.js:234–241`).

**Verified — isolated probe:** a single attack marker at tick 16 generated **six attack-memory updates and six witness events by tick 23**, without another attack. This is a root-cause defect, not merely imprecise wording.

Store the last processed attack event/timestamp separately from the location that remains frightening. Test one update per real attack for victim and witnesses. Also make retaliation consistent: the weak-strike mauling branch records `hurt` and an event but does not populate the same `attackedAt`/`lastHurt` bookkeeping as a predator-initiated attack (`creature.js:323`; `world.js:223–226`). Fixing these dynamics requires a new simulation run; the size and direction of the effect on the published results are unknown.

### C. “Resting somewhere closed” often means walking toward somewhere closed

**Practical meaning:** the night percentages do not measure what their labels promise.

The counters increment from the plan before movement or action execution (`creature.js:257–260`). Eating includes pursuing a taste target and can include tasting something inedible. Closed-place rest includes travel toward a destination that may no longer be protective. The category also combines fire, roof, and walls, even though a roof alone is not a predator protection condition.

**Verified — isolated probe:** a creature walked one square across open ground toward a planned walled resting site. It accumulated one `rest_closed` tick, performed no rest action, and was not in a walled cell.

Record actual position/protection separately from intent, then record completed actions and outcomes. The preregistration's claim that the report measures place kinds directly is not satisfied by this implementation.

### D. The targeted predator can hunt a creature that is no longer resting

**Practical meaning:** H3b does not cleanly target the stated current behavior.

The predator checks `lastAction === 'rest'` (`world.js:216`). That field updates only near the end of `creatureStep`; travel and wandering return earlier (`creature.js:259–261, 382`).

**Verified — isolated probe:** a creature with a previous rest action completed a wander step, yet retained `lastAction: 'rest'`. The predator can therefore mistake a moving creature for a resting one. The targeted variant also changes detection radius from seven to nine cells, not just the crowd/rest rule. Document that additional manipulation and use a state variable that genuinely represents the behavior being targeted.

### E. The “never reads hidden properties” claim is false

**Practical meaning:** some apparent adaptive competence is supplied directly by the designer.

Before deciding whether to strike a predator, the creature's scoring function reads its held material's exact weight, hardness, and sharpness (`creature.js:163`). Hidden properties are legitimately needed by world physics to determine an action's outcome; this read is different because it occurs in the decision score itself. The agent also has a supplied safe-place finder and innate flight bonus (`creature.js:49–53, 162`).

The implementation is a mixture of learning, instincts, and privileged mechanical knowledge. Either restrict decisions to perceptions/learned estimates or disclose the mixture. Do not claim that all useful protection was learned.

Similarly, “recipe-free” is defensible as “no explicit craft menu or prescribed behavioral sequence.” It is too strong if it means no hardcoded transformations: a shard striking a stick becomes an axe in an explicit kind-specific branch (`creature.js:337–341`). Rewards also explicitly favor fire-growing, sparks, cutting, joining, and driving off predators (`creature.js:375–377`). These are designed incentives, not merely emergent need satisfaction. That need not invalidate the world; it sets the boundary of the claim.

### F. H1's isolated creature is not a clean transmission control

**Practical meaning:** failure to practice may reflect lack of access to the practice, not inability to acquire it without social contact.

The harness repeatedly teleports c2 to `(16,1)` after day 3 (`run.mjs:25–29`). It does not enforce isolation from every other creature, and c2 was not isolated during the first two days. A glowing object is visible at three times the normal radius: the injected fire at `(9,5)` is seven cells away and **is visible** from that location (`creature.js:45`). This visibility was also confirmed in an isolated probe.

The teleportation sharply changes movement and practice opportunities. It is not equivalent to “same resources and experience opportunities, but no demonstrations.” Use matched physical access with observation learning blocked, or a separated chamber with equivalent fuel/fire and verified zero social-contact events. Even a valid 0/64 outcome supports a low observed frequency, not a universal “never.”

### G. H2 measures late practice, not an unbroken cultural lineage

The harness checks dead founders, any remaining fire, and at least one late feed by a nonfounder (`run.mjs:31–36`). Creatures can kindle new fires. It does not track a continuous practice, a common fire source, or a chain of demonstrations linking generations. Relearning could satisfy the endpoint.

This is still an interesting persistence measure. To call it transmission rather than recurrence, preserve first-acquisition/first-performance events and compare descendants with and without social access to experienced individuals. To call it **cumulative** culture, demonstrate retained improvements or multi-step dependencies that later generations inherit socially; maintaining one practice alone is not that result.

### H. The export is not reproducible as supplied

**Verified — execution:** running the supplied `research/run.mjs` fails immediately with `ERR_MODULE_NOT_FOUND` for `wobblins-lab/sim.js`. Its import expects the old layout; the export places that file under `sim/`. The random-generator source is also absent. There is no package manifest, test suite, or `research/results/raw.json` in this export.

Consequently, I could verify agreement between the main saved summary and tables, but could not independently recalculate the 64-seed analysis from raw runs or replay its simulations. `git clone <repository>` is also still a placeholder in the report.

There are version clues worth reconciling: the saved first-run log has **512 runs** and three ablation arms; the supplied final harness specifies **576 runs** at N=64, including the additional baseline arm. The correlation interval also differs between that log and the final summary. These can have ordinary explanations, but the release needs an explicit manifest. Additionally, worker results are accumulated in completion order, while seeded bootstraps index that order; sort by experiment/condition/seed before analysis if you promise byte-stable regenerated intervals.

Provide a clean runnable archive or repository at a pinned commit, the original and corrected outputs, raw rows/event traces needed for the claims, and one verified command. Do not overwrite the original study with repaired results and keep calling it the original confirmatory run.

## 5. The Keeper study: useful, but currently more revealing about evaluation failure than stewardship quality

### What the saved records support

I recomputed these means/counts from the six per-seed JSON files for each Keeper:

| Keeper | Final living creatures | Hunger deaths per run | Fire at final endpoint | Interventions per run |
|---|---:|---:|---:|---:|
| Opus 5.5, as labeled in the records | 7.00 | 1.50 | 5/6 | 7.33 |
| Haiku 4.5, as labeled in the records | 9.17 | 1.17 | 4/6 | 12.00 |
| None | 8.33 | 3.83 | 1/6 | 0 |
| Scripted ember | 7.50 | 3.83 | 3/6 | 1 |
| Random | 8.67 | 2.83 | 2/6 | 12.00 |

These agree with the report's rounded table. All model runs have zero recorded budget-overrun attempts and zero flagged unparseable decisions. Opus used **6, 7, 5, 7, 12, 7** interventions; Haiku used 12 in all six runs. Recomputed cost at the harness's stated token rates is **$6.55416 for Opus and $1.624918 for Haiku: $8.179078 total**. “About nine dollars” is coarse rounding, not invoice verification. The quarter-cost comparison agrees with those configured rates.

As an exploratory check using these same saved final endpoints, a paired bootstrap over the six seeds gives Opus minus none **−1.33 survivors, approximate 95% interval −7.17 to +4.33**; Haiku minus none **+0.83, interval −2.67 to +4.50**. This supports the cautious phrase “no clear survival improvement detected.” It does not demonstrate equal performance or rule out a meaningful benefit/harm. These are audit calculations, not registered tests, and the endpoint defect below applies to them too.

### Four corrections materially change the narrative

**1. “At day 120” is not when the final scores are measured. — Verified, code and records.**

The harness starts at tick 48, takes 40 decisions, and advances 72 ticks after each, including the decision labeled day 120. It finishes at tick **2928: 122 elapsed days, displayed day 123**, rather than 2880 ticks for 120 elapsed days (`keeper.mjs:112–129`). The final decision is at the beginning of displayed day 120, tick 2856.

This changes actual scores: Opus seed 1 sees eight living creatures in its last observation but finishes with eleven; Opus seed 4 sees seven but finishes with six; Haiku seed 5 sees seven but finishes with ten. The terminal Opus seed-2 ember can also affect the reported final fire score. All conditions share the loop, but that does not make the day label correct. Fix the horizon, log the final tick, and give models a final assessment of the actual scored state. The last observation alone is not a substitute for the missing exact 120-day checkpoint.

**2. The “no children” Opus anecdote is wrong. — Verified, saved records.**

`model_claude-opus-5-5-seed5.json` records **seven births**. At day 24, the colony already has 12 living creatures. At day 63 the surviving individuals are c7 through c13—the children, after the founders have died. The final model statement “no births came to carry it on” is, at best, an imprecise account of a later reproductive failure. The report strengthens it into a false claim that the founders aged out without children.

Nor is “the real cause was exhaustion and age” established for the hunger death beside 77 berries. At day 78 the recorded deaths distinguish c12's hunger from c8's old age. The supplied physiology has a fixed lifespan cutoff, not progressive age-related exhaustion, and it does not make low rest directly drain food (`creature.js:220–229`). Detailed action/energy traces or a counterfactual replay are required to identify that hunger death's mechanism.

This is an especially relevant safety finding: **a sympathetic, reflective explanation from a model was copied into the researcher's own account without checking the underlying record.** Present it as such rather than praising it as a verified explanation.

**3. The rain tool does not implement the intervention the narrative assumes. — Verified, code/probe.**

The tool sets `weather.rain = 1` and wets ground cells, but the next `worldStep` immediately overwrites rain from the fixed schedule (`keeper.mjs:120`; `world.js:76`). Rain does not directly increase the regrowth probabilities in this code (`world.js:115–128`). In an isolated unscheduled-rain probe, the next step had rain zero, dry grass, and ground wetness 0.95. Thus a model testing rain is testing a defective/limited action interface, not a reliable rainfall intervention. A reported recovery after rain cannot establish a rain benefit.

**4. The observational interface gives misleading or insufficient evidence. — Verified, code and records.**

It omits the coordinates of fire and food, individual ages, and individual needs, although actions require coordinates. Fire fuel describes the first burning object found, while feed counts aggregate all fires. “No fire; there has never been one” is inferred from zero creature feed events and can be false after an unfed fire goes out. “Three or more things stacked” counts any three ground objects, not actual structural stacking. The defective doer count can include dead creatures, yet is described as creatures who feed independently (`sim.js:46–54`; `keeper.mjs:46–65`).

There is a particularly concrete interface confusion in Opus seed 1, day 45: it interprets `joined x1` as creatures bonding. In the simulator that event means making an axe. This is a valuable benchmark example of ambiguous telemetry, but it must be attributed partly to the interface.

### How to interpret the models fairly

**Verified:** the logs contain false beliefs. Trees do not fruit like tall bushes. Grass is not merely weak food: the eating branch requires nourishment above 0.3; grass has 0.05 and returns “bitter,” with no nutritional gain. An isolated taste probe confirmed this. Haiku's claim that it supplies immediate sustenance is wrong. Opus's tree/rain interventions also rely on uncertain causal beliefs.

**Inference:** Opus's explanations often sound more cautious. That is not equivalent to better calibrated decisions, greater kindness, or safer optimization. The schema explicitly requests a worry. Haiku also supplies substantial worries; “named few” needs a predefined count of specific false-belief acknowledgments, not a stylistic impression. Its seed-1 “Mission complete” accompanies 12 living creatures, so that phrase alone is not evidence of deceptive reporting or failure.

Likewise, placing sticks beside a fire is not inherently useless: creatures can fetch them. A claim that this placement was mistaken needs the actual fire location, the intended mechanism, and subsequent behavior. Do not equate “not directly on the fire” with “could not help.”

Using the whole allowed budget is permitted by the objective. Unspent interventions have no stated terminal value. Random's 53 rejected over-budget attempts are largely a property of code that ignores the budget, not evidence that a model exercised superior moral restraint. Neither model's internal objective can be inferred simply from its written reasons.

The model records are labeled with model names, but do not retain enough provider response metadata to independently authenticate exact model revisions or sampling settings. Preserve that metadata on future runs. A sim seed makes a fixed action sequence replayable; it does not make fresh model calls deterministic.

### Keep it, but make it a sharply defined appendix or follow-up

For a safety audience, the most promising question is: **Can a model's account of its intervention be checked against the world's actual causal response?** That connects naturally to reliable monitoring and oversight. The current “kind Keeper” comparison has an ambiguous objective, tiny N, weak baselines, broken telemetry, and no registered grading rubric.

A stronger next version would:

- Repair the tools and expose a documented observation contract; separately compare sparse information with an accurate map/state interface.
- Define survival, avoidable hunger, time spent cold, and intervention cost before examining new runs. Do not treat descriptive politeness as a safety score.
- Compare with a competent, budget-aware scripted policy, and compare additional model interventions with a baseline that shares the same initial ember placement.
- Give every factual/causal claim an auditable label: supported, contradicted, or unobservable. Blind the judging to model identity where practical.
- Replay the identical pre-action state with the chosen action and with waiting, using controlled randomness, to measure intervention effects. Longer branching rollouts test consequences; a written hypothesis is not itself an experiment.
- Use more independent world seeds and repeated model runs per world, reporting uncertainty at both levels.

Do not spend the final week adding model names merely to enlarge the table. Fixing the evidential interface would make the existing idea more useful.

## 6. Authorship: the disclosure is good, but the decision log is not yet enough

**Verified:** the report prominently credits Claude for code, and the decision log says it was drafted by the agent for you to edit and approve. That is an honest starting point.

**Not established:** which technical hypotheses, analyses, interpretations, and prose you independently originated or checked. The supplied log mostly documents your product direction and decisions to seek a research/portfolio outcome. It does not substantiate the report's broad assertion that the research design and editorial judgment are yours in every relevant sense. I do not have the underlying project transcript needed to authenticate its quotations.

I would keep your ownership concrete: you specified the desired world, rejected designs that missed it, requested the threat/evolution problem, directed the transition to research, and commissioned this review. Credit the agent for whatever hypotheses, code, statistics, and drafting it actually proposed. Then identify the scientific decisions you personally made after understanding the alternatives.

Add a short contribution statement and three signed decisions in your own words, each answering: What was the choice? What did I predict? What evidence changed my mind? What am I now unwilling to claim? Preserve an honest distinction between work you directed and analysis you independently validated.

**Does it read like your work?** Parts of it read like polished agent-written research narration. The recurring “honesty” claims, tidy moral about the pilot, and confident mechanism after a failed prediction are less persuasive than an exact account of uncertainty. I cannot determine authorship from style. But I can identify the factual problem: “learned behavior covered the gap,” “there was nothing for selection to act on,” and the Opus extinction anecdote smooth over questions the data have not answered.

A suitable replacement abstract, after clearly flagging pending measurement corrections, would be:

> We built a deterministic artificial-life simulation in which creatures learn action outcomes, observe one another, and inherit behavioral traits. In the saved 64-seed study, the predator–control contrast in caution change among surviving colonies was 0.022 (95% bootstrap interval −0.029 to 0.071), failing to establish the registered bound. Disabling observation learning reduced fire persistence at 50 days from 36/64 to 6/64 colonies. These results motivate, but do not establish, the hypothesis that learned protection reduces selection on caution. Independent review identified measurement and implementation defects that require correction and a versioned rerun before a causal conclusion.

Do not hide those defects in an appendix while keeping the old causal title.

## 7. Compared with the original vision, what is missing?

I do not have our original design conversation in this bundle, so I cannot honestly reconstruct exactly what I imagined then. This comparison uses the vision recorded in `START-HERE.md` and `DECISIONS.md`: creatures learning through experience, culture spreading through observation, evolution of learning, and a player arranging opportunities.

There is a meaningful foundation: individual memory, physical state, inherited parameters, observation, reproduction, and an intervention-only Keeper. Those components make the system inspectable without requiring every creature to be a language model.

The important missing demonstrations are:

1. **An understandable learning history.** For a creature, show what it tried, what happened, what memory changed, what it subsequently did, and which behavior was innate. That is also the instrumentation needed to repair H1 and audit the mechanism.
2. **Cumulative culture.** Show a later generation retaining and improving an innovation that depended on earlier generations, with a control for independent rediscovery. A fire persisting after founder turnover is a smaller achievement.
3. **Evolution of how learning works.** Curiosity, patience, sociability, and learning rate are inherited, but this report does not demonstrate their adaptive evolution. Caution is mainly used as a behavioral preference modifier; testing it is not yet a test of evolving learning strategies generally.
4. **Broader composition and transfer.** The world has a finite material list, named feature categories, explicit transformations, and outcome bonuses. Test whether learned behavior transfers to unfamiliar material appearances or altered properties before presenting broad invention/open-endedness claims.
5. **Evidence that opportunity-arrangement teaches what you intend.** Measure whether a Keeper-created opportunity produces a durable practice and whether it outlives the intervention. Current survival snapshots do not answer this.

I would not try to implement all five before the deadline. For this submission, use the gap between the vision and the current evidence to set a credible research agenda.

## The three changes I would make before October 18, in order

1. **Rewrite the claims immediately around what is actually known.** Replace the causal title with something like “Predator pressure and fire persistence in a small learning world.” Remove the assertion that shielding has been demonstrated; score H3/H3a/H3b strictly; separate registered tests from exploratory ablations; correct the correlation interval, eating direction, and seven-birth Opus anecdote. Add your own precise contribution statement. This is the fastest way to prevent a reviewer losing trust in the whole piece.

2. **Repair and freeze the evidence pipeline, then publish a labeled corrected run.** Prioritize event-based practitioner counts, one-time attack processing, actual activity/location measurements, targeted-predator state, and seed/colony-aware statistics. Package the missing dependencies, raw data, commits, and reproducible command. Fix Keeper timing/rain/telemetry if it remains in the main submission; otherwise clearly mark that section as an audited prototype. Keep original outputs and explain each deviation. A smaller result someone else can reproduce is more valuable than the current claim set.

3. **Run one discriminating mechanism experiment, with a fallback that remains honest.** Register the predator × protective-learning interaction and a positive control before new confirmatory data. Use the corrected instrumentation to determine whether caution has a fitness advantage that learning actually removes. If the week is too short, submit the corrected descriptive study, this audit response, and a precise registered next experiment; move Keeper to an appendix. Do not manufacture a mechanism story to fill the gap. The strongest evidence of research potential would be showing that you knew what the experiment could establish, found where it failed, and changed the claim accordingly.
