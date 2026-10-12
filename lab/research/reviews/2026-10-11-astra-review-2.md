# Wobblins lab v2: independent readiness review

**For Nate Pogue — 11 October 2026**  
**Snapshot identified by `COMMIT.txt`:** `c9266e13752c60ed884a94bbc7a4c7ce46e02b68`

## Verdict at a glance

**Redesign first.** This means a focused redesign of the experiment and its interpretation, not rebuilding the artificial-life world.

Many of the original defects have been genuinely corrected. The complete export runs, all 16 test files pass, and I reproduced both development calibration tables. However, v2 is not ready to spend its confirmatory run on the proposed headline. The learning switch does not cleanly implement its stated boundary; the positive control does not establish the assay's detection limit; the interpretation table still turns inconclusive results into definite conclusions; and several new measurements are wrong or incomplete.

The most important practical point is this: **another null could still leave you unable to distinguish weak pressure, weak measurement, inadequate precision, and learning shielding selection.** A statistically positive interaction could also be given an interpretation stronger than it warrants.

I would fix those problems before launching confirmation. I would keep the Keeper study as the audited v1 appendix for this submission unless there is time to repair the remaining interface and grading issues first.

## What I did, and what I did not do

I read the response, v2 preregistration, calibration table, run log, regression tests, and changed code. I did not rereview the old `REPORT.md`, as requested.

All execution was against an audit copy of the export. I ran:

- The explicitly permitted full suite, `node tests/run-all.js`: **16/16 test files passed; exit code 0**, including `test-lab-audit.js`.
- `CALIBRATE=1`: **80 development runs on seeds 101–116**. Its printed table reproduced the supplied exposure calibration.
- `CALIBRATE=direct`: **64 development runs on seeds 101–116**. Its printed table reproduced the supplied direct-predator calibration.
- `KEEPER=mock`, with **seed 101**, the full 120-day horizon, and no model calls. Its mock/none/scripted/random branches completed with **$0 reported spend**.
- Small deterministic fixtures for the suspected defects, using development seed 101, plus synthetic event/statistical fixtures and an isolated execution of the Keeper loop.

The calibration computations finished and printed their tables, but **both Node processes remained alive afterward**. After ten seconds beyond completed output, my audit wrapper terminated each process. That is a verified lifecycle bug, not a failed numerical reproduction.

I did **not** launch the normal v2 confirmatory harness, inspect new confirmatory results, or call paid models. The permitted test suite itself uses some seeds from 1–64; that is distinct from running the confirmatory experiment, and is a reason to separate test and confirmatory seed lists more carefully going forward. The original export was preserved.

Below, **Verified** means established from the supplied code, executed checks, or reproduced development output. **Inference/recommendation** means my interpretation or proposed change. None of the findings predicts what the unrun confirmatory study will actually show. Source paths are relative to `repo/`.

## 1. Are the original defects fixed, and do the tests establish that?

| First-review finding | v2 status | What the tests establish or miss |
|---|---|---|
| Observers could count as independent practitioners | **Fixed.** `fireReport` uses actual `fed_fire` events and distinct actor IDs. | Test A checks observer-only exclusion and inclusion after a feed event. Good targeted test. Add repeated feeds and feeds by subsequently dead individuals to lock down lifetime/current labels. |
| One attack was repeatedly remembered | **Fixed for the original nonfatal-attack path.** A processed timestamp prevents repetition. | Test B passes. It checks the victim's count and limits total witness events. It should assert each witness's identity/count, a second distinct attack, and retaliation/fatal-attack paths. |
| Travel toward shelter counted as sheltering | **Fixed for the original error.** Completed action and current location are now separate. | Test C passes. It does not test actual safe-place categories, the direct-predator crowd mismatch, or fatal exposure ticks. |
| Targeted predator used an indefinitely stale resting action and a different radius | **Substantially fixed.** `lastAction` updates on movement; radius is seven for both. | Test D only checks that a wander step changes the field. It never exercises a predator. The predator reads the **previous tick's** completed action, not “what was done this tick” as the response says. That ordering can be valid if explicitly documented and tested. |
| Strike choice read hidden weight/hardness/sharpness | **Fixed for that decision score.** It now uses visible size, experience, brawn, and caution. | No corresponding test in the named audit file. Add a test changing hidden properties while keeping perceived features fixed, and distinguish action choice from physical consequences. |
| H1 isolation removed physical access | **Fixed as a manipulation.** c2 remains in the colony; `noObserve` blocks observation updates. | No dedicated regression test of both observation routes or unchanged access. The title “observation is needed” is still stronger than a probability difference can establish. |
| H2 implied a demonstrated transmission lineage | **Partly addressed.** “Late practice” is a better label; gap tracking is useful. | The new “saw feeding first” measure confuses ignition with feeding and loses within-tick order. No test covers it. It still does not demonstrate causal transmission. |
| Breeding used fixed scan order | **Fixed for that ordering bias.** A seeded shuffle is now used. | No dedicated audit test. Removing the old ID constraint also lets a pair get a second chance with reversed roles in a tick; disclose this additional change to breeding dynamics. |
| Daily wipe retained fright-location memory | **Fixed for `attackedAt`; bonds intentionally remain.** | No dedicated audit test. Name it an outcome-memory/fright wipe, not deletion of all learned social state. |
| Condition comparisons ignored matching | **Fixed for the ordinary paired contrasts.** Conditions are aligned by seed and finite pairs retained. | No audit test. The four-arm interaction has a missing-value bug after JSON reload; see below. |
| Correlations resampled individual relatives | **Improved substantially.** Whole colonies are resampled; within-colony ranks are constructed. | No audit test. Constant inputs return a misleading zero correlation; the 16-day filter also remains in the descriptive mechanism analysis without appearing in the preregistration. |
| Fitness excluded early deaths and mixed follow-up lengths | **Improved for primary S.** A birth cohort and actual offspring totals replace the old adult-survivor filter. | No audit test. S still conditions on having nonzero total reproduction, and the extra viability endpoint is mislabeled. |
| Extinct colonies disappeared from final-genome comparisons | **Disclosed, not eliminated.** Those secondary comparisons remain conditional. | Reporting exclusions is good. It does not remove selection bias. Primary S can also be undefined in zero-reproduction colonies. |
| Worker completion order affected analysis | **Fixed in ordering.** Results are sorted. | No reproducibility regression test. Separately, worker cleanup is defective. |
| Export could not run | **Fixed for execution.** Dependencies needed for free simulations/tests are present. | This is a runnable source export, not a Git checkout. `COMMIT.txt` supplies a claimed identity; I could not authenticate its history/tags from this folder. |
| Keeper scores extended beyond 120 days | **Fixed on the complete-run path.** The final advance is clipped to tick 2880. | No supplied horizon test. My execution of the unchanged loop with stand-in simulation/IO confirmed 40 decisions and tick 2880. It also confirmed that capped partial runs lack an explicit completion field. |
| Keeper rain was overwritten immediately | **Fixed.** `forcedUntil` creates a four-tick spell. | The supplied test checks only the first tick. My fixture confirmed four rainy ticks, wetting of an object, and expiry on the fifth tick. |
| Keeper telemetry was misleading/incomplete | **Partly fixed.** All fire coordinates/fuel and living practitioner counts are now exposed; the false “never a fire” statement is removed. | Food coordinates, ages, individual needs, ambiguous `joined`, and false structural stacking language remain. No observation-contract test covers them. |
| False Opus anecdote, causal overclaims, authorship and prose issues | **Accepted in the response, with rewriting pending.** | These require an editorial/evidence check after the rewrite. A test suite cannot establish them. I have not treated the still-old report as a completed revision. |

The preregistration's assertion that **each fix has a regression test in `test-lab-audit.js` is false**. That file has six sections: A, B, C, D, rain, and an exposure-predator mortality smoke test. It contains no dedicated tests of the learning ablation, paired/cluster statistics, H1 blocking, H2 provenance, breeding shuffle, daily wipe, or Keeper horizon.

Passing the existing tests is useful evidence of specific repairs. It is not evidence that the full scientific specification is implemented.

Sources: `tests/test-lab-audit.js:9–78`; `lab/sim.js:17–37, 61–71`; `lab/creature.js:32–42, 162–180, 199–217, 239–245`; `lab/research/run.mjs:29–69, 172–185`.

## 2. Problems that need attention before confirmation

### A. “Protective learning off” still learns from being mauled

**Practical consequence:** the treatment is not doing everything its preregistered description promises.

**Verified:** `remember` blocks rest/flee keys and the outcome named `attacked`. A failed strike against the predator produces **`mauled`**, which is not blocked. The negative experience enters both the victim's and an observer's memory even when both have `noProtLearn=true`.

My fixture forced a weak strike. The victim stored a `mauled` outcome with weight 1; its watching neighbor stored the same outcome with weight 0.45. Both had protective learning switched off. The retaliation branch also marks the attack processed immediately, so the ordinary `attacked` path does not repair this mismatch on the next tick.

**Change:** define protective outcomes explicitly, including retaliation, and test every path for own and observed experiences. Do not rely on one outcome string while another equivalent event bypasses it. Also decide whether learning successful defense (`drove_off`) belongs to the intervention.

Sources: `lab/creature.js:36–42, 322–328, 378–399`.

### B. The switch removes only some learning about protection, and also removes learning about rest itself

**Practical consequence:** even a correctly implemented switch needs a narrower name and a narrower claim.

**Verified:** with `noProtLearn=true`, a cozy rest still enters `episodes`, and its reward can reinforce a previous building action through `paid_off` or a preceding action through `led_on`. In my fixture the rest expectation was blocked, but a previous placement acquired positive `paid_off` credit, and the cozy-rest episode remained stored.

Some of this is explicitly intended: the plan says fire and building learning stay unchanged. That is a legitimate choice. It means v2 tests the contribution of selected rest/flee/attack expectations and fright preferences **while other learned protective routes remain available**. It cannot decide whether all learning, or shared fire culture, shields the genome.

Conversely, blocking every rest expectation also removes learned evaluations of ordinary daytime resting and comfort, not just predator protection. That can alter energy allocation, social opportunities, and reproduction. The no-predator arm helps identify the interaction of this whole intervention with predation, but does not make the intervention specific to safety knowledge.

**Recommendation:** either narrow the hypothesis to this exact memory intervention, or redesign the state representation so predator-risk expectations can be removed without removing nonpredator rest/comfort expectations. List retained routes, blocked routes, episodes, credit propagation, learned combat, fire, buildings, and social transfer in a testable contract. A broad “learning shielding selection” conclusion would require broader and more discriminating comparisons.

Sources: `lab/creature.js:36–42, 158–180, 378–399`; `PREREGISTRATION-v2.md:61–65`.

### C. Direct-predator exposure is measured incorrectly

**Practical consequence:** the study can report a creature as safe from a predator that can kill it in that exact situation.

**Verified:** the direct predator ignores crowds; only fire and walls prevent its gene-dependent kill. But `protectedAt` and the night bookkeeping exclude crowd protection only for `targeted` and `exposure`, forgetting `direct`.

In a fixture with three creatures together on open ground, all three recorded zero exposed ticks and `protectedAt` returned true. The direct-predator kill predicate could nevertheless kill all three. This does not itself invalidate the recorded death totals or S; it invalidates the exposure interpretation and related mechanism comparisons for that condition.

**Change:** derive measurement and simulation eligibility from an explicitly shared definition of each predator's protection rules, with per-mode fixtures. For the no-predator arm, specify which counterfactual exposure definition is reported; there is no single universal “safe” category across these predators.

Sources: `lab/world.js:191–223`; `lab/sim.js:24–33`.

### D. Exposure measurements miss fatal ticks, and the calibration diagnostic measures the wrong opportunity

**Practical consequence:** the diagnostic does not establish that caution scarcely changes the behavior the exposure predator punishes.

**Verified:** predators act during `worldStep`, before the creatures act and before night bookkeeping. Bookkeeping skips dead creatures. In a forced fatal-exposure fixture, there was one predator death but zero recorded night ticks, exposure ticks, or attacked ticks for the victim.

Measuring post-action positions of survivors is coherent as a descriptive convention, but it is not an at-risk exposure denominator. The discrepancy is treatment-dependent because the treatment can remove the very observation you need.

Moreover, `dev/diagnose-exposure.mjs` compares **all unprotected night ticks**, while the exposure predator kills creatures whose **previous completed action was resting** and whose current location is unprotected. A small difference in all-night exposure need not imply a small difference in exposed rest. The published 68% versus 72% comparison is therefore not a demonstrated explanation for the weak selection result.

**Change:** log each living creature's eligibility immediately before the predator draw, including the victim on a lethal tick. Separately record the previous action, protection state, actual completed actions, and post-action location. Analyze the joint state the predator targets. Preserve the existing post-action counters if useful, with accurate names.

Sources: `lab/sim.js:17–35`; `lab/world.js:217–223`; `lab/research/dev/diagnose-exposure.mjs:4–13`.

### E. H2 can count seeing a fire ignited as seeing a fire fed

**Practical consequence:** the new transmission evidence can be positive without the specified demonstration ever occurring.

**Verified:** H2 accepts any earlier `saw` event with outcome `fire_grew`. Both feeding and ignition from stone-struck sparks produce that outcome. My fixture generated a real observed ignition with a `strike` key, zero feeding events, and a record that the H2 predicate would accept as “saw feeding first” before a later first feed.

The timestamp comparison also uses strict `<`. An observer can see an earlier creature feed and then feed during the same tick; that genuine order would be lost.

**Change:** record the observed action/event type, demonstrator, and monotonic event sequence ID. Require observation of an actual feed before the practitioner's first feed in event order. Even then, temporal precedence is evidence of opportunity to learn, not proof that observation caused acquisition. Call the measure “observed a feed before first feeding.”

Sources: `lab/research/run.mjs:44–51`; `lab/creature.js:333–338, 395–399`.

### F. JSON reload can turn missing interaction data into real-looking numbers

**Practical consequence:** a later partial rerun can change an analysis simply because missing values passed through a file.

**Verified:** undefined S is represented as `NaN` in memory, serialized as `null` in `raw.json`. Ordinary paired contrasts reject nonfinite values. The four-arm interaction instead subtracts its inputs first and only then checks finiteness. JavaScript turns `null` into zero in subtraction.

An isolated fixture gave an invalid interaction before serialization, but **−0.2 after the missing value became `null`**. This matters when `ONLY=h1` or another partial run reloads previous H3 rows and regenerates the full analysis. It is not a claim that the first fresh full v2 run has already suffered this defect.

**Change:** require all four operands to be finite before subtraction. Test fresh data and JSON round trips, missingness in each arm, unequal seed sets, and identical results after save/reload. Ideally, separate simulation and analysis entry points so reanalysis does not require running another experiment.

Sources: `lab/research/run.mjs:121–126, 172–175`; `lab/research/stats.js:45–53`.

### G. Two analysis labels still promise more than the implementation

**Verified:** `S_caution_viability` uses survival to **16 days**, while breeding can begin at **8 days**. Calling it “survival to breeding age” is wrong. Either use the actual age of reproductive eligibility or explicitly preregister survival to 16 days as a separate endpoint.

The descriptive mechanism table still filters to individuals who lived 16+ days, including its offspring association. That filter is visible in the code/table title but absent from the v2 preregistration. This does **not** undo the improvement to primary S, which includes the specified full birth cohort; it is a remaining discrepancy in the descriptive analysis.

The correlation function also returns `0 [0,0]` when a synthetic group's traits and outcomes are constant. Correlation in that case is undefined, not perfectly measured absence of association. Return unavailable and define how degenerate bootstrap samples are handled. The within-colony-rank/pooled-rerank estimator should be named and tested precisely, including ties and unequal colony sizes.

Sources: `lab/creature.js:206–208`; `lab/research/run.mjs:64–67, 180–185`; `lab/research/stats.js:58–70`.

### H. The last worker prevents clean completion

**Verified:** on the last result, `runAll` resolves without invoking the branch that terminates that worker. Workers terminated earlier are cleaned up, but the last one remains waiting for another message. Both permitted calibrations exhibited this exact behavior after printing complete results.

**Change:** terminate and await all workers on success and on error, preferably in a guaranteed cleanup block. Add a tiny harness integration test that asserts a successful exit and complete output. This also matters for run provenance: “process still running” should not be ambiguous between ongoing computation and finished results.

Source: `lab/research/run.mjs:75–88`.

## 3. Does the factorial design answer the missing question?

### The interaction is the right starting point

Define:

- **E_on:** default-predator S minus no-predator S, with the specified learning pathways enabled.
- **E_off:** the same contrast with those pathways disabled.
- **I = E_off − E_on.**

**Verified:** the fresh-data harness computes that four-arm contrast, paired by seed. This is the right form for asking whether this intervention changes the predator's effect on S. It is a major improvement over explaining v1's null after the fact. Testing the contrast itself also avoids comparing significance labels across separate conditions. [Gelman and Stern, 2006](https://sites.stat.columbia.edu/gelman/surveys.course/GelmanStern2006.pdf).

**Inference:** a causal interpretation applies to the implemented software intervention. It does not automatically identify the informal mechanism “learned protection,” especially when the intervention also changes general rest learning and retains other protective routes.

### The current decision table is logically wrong

Two invented examples show why, without using any confirmatory data:

| E_off | E_on | I | Why the registered interpretation would mislead |
|---:|---:|---:|---|
| +0.04 | +0.04 | 0 | Both conditions could strongly favor caution. A zero interaction does not imply “the predator does not select for caution with or without learning.” |
| 0 | −0.04 | +0.04 | A positive interaction exists, but the predator has not been shown to favor caution when learning is off. This is not the intended demonstration that learning absorbs a positive caution advantage. |

An interaction interval crossing zero also does not establish absence of shielding. It may simply be wide. The final sentence that declares v1's explanation “wrong here” whenever the interaction is not positive repeats v1's central inferential problem.

Replace the decision table with rules such as these, frozen before data:

| Evidence | Permitted conclusion |
|---|---|
| Validated measurement/control; E_off clearly positive; I clearly positive; mechanism checks fit the proposed pathway | Evidence that enabling the specified learning pathways attenuates a positive predator-related caution advantage. State the scope of the intervention. |
| I clearly positive, but E_off is not clearly positive | Evidence of effect modification; the intended positive-advantage shielding mechanism is not established. |
| I's interval crosses zero and includes meaningful effects | Inconclusive about attenuation, regardless of the assay gate. |
| I's entire interval lies inside a justified, preregistered negligible-effect interval | Evidence against attenuation larger than that bound in this setting. Do not infer that each predator effect is zero. |
| I clearly negative | Evidence in the opposite direction for the specified intervention; examine the arm effects and mechanism. |
| Validation fails | Treat the mechanism interpretation as unvalidated; report estimates and limitations rather than asserting a detection limit has been identified. |

“No detectable effect” is not a useful biological prediction by itself: detectability changes with sample size. Make H3-main descriptive, or formulate a justified equivalence hypothesis in units of **S**. The old 0.03 threshold for a final-genome contrast cannot automatically be reused for this different endpoint.

### S is a useful statistic, not a complete assay of evolution

**Verified:** the implemented statistic is the offspring-weighted mean trait minus the unweighted cohort mean. A known-answer fixture with traits 0.2 and 0.8, and offspring counts 0 and 2, gives **S = 0.3**, as it should.

**Inference:** this is a useful measure of association between caution and reproductive contribution within the chosen cohort. It is not itself the realized change in the population's gene distribution, nor proof that caution caused an individual's higher reproductive success. This cohort mixes founders and descendants, other traits co-vary, and the reproductive opportunities arise in an interacting, capped population.

Early deaths now contribute their actual offspring counts—zero when they had none—which is an improvement. But colonies with no cohort reproduction have no normalized S and are excluded. The interaction therefore conditions on S being defined in all four arms. Report that conditioning, reproduce/exclude counts per arm, and the four-way common seed set. Do not silently turn total reproductive failure into S=0.

Alongside S, predefine all-colony outcomes such as extinction, total reproductive output, and cohort survival. Retain final trait distributions as secondary outcomes, properly labeled. For a stronger causal claim about the caution gene, use a controlled comparison that varies caution while balancing other traits and initial conditions, rather than interpreting within-colony correlation as causal gene influence.

## 4. Is the direct gene predator a valid assay check? Is 64 × 120 enough?

### It is an end-to-end stress test, not a known-effect sensitivity calibration

**Verified:** its kill probability depends explicitly on caution. That makes it a useful engineered perturbation. But the statement **“no behaviour is involved” is false**: fire and walls determine whether the kill probability is applied at all. Movement, learning, building, shared fire, and reproduction still influence who is exposed and whether an avoided death becomes another offspring.

The direct predator therefore combines a known *conditional mortality rule* with an unknown *colony-level reproductive effect*. The latter is exactly what you are trying to measure. Its failure could indicate weak realized selection, demographic compensation, limited precision, or other features of the system. It cannot establish that the measurement “cannot see anything.”

Likewise, one positive or null result at 64 seeds does not identify the **smallest selection the assay can detect**. That requires specifying effect sizes and examining the procedure's sensitivity across repeated data sets or an appropriate development-based power/precision analysis.

Use two separate checks:

1. **Analysis check:** synthetic data with known selection differentials, interactions, missingness, and cluster dependence. Verify arithmetic, confidence-interval behavior, and the intended decision rules.
2. **Simulation check:** a deliberately simplified, controlled gene-dependent survival/reproduction regime with a prespecified expected effect and adequate sensitivity. Hold exposure opportunities and other traits controlled; document how survival becomes reproductive opportunity. Then separately use the current direct predator as a full-ecology stress test.

Do not tune the control until one favorable p-value appears. Validate a fixed effect range and decision procedure on development data, then freeze them.

### What the development interval suggests about N

I reproduced the supplied direct-predator result at 0.002: **paired S difference about 0.014, interval −0.013 to 0.043, with 259 direct deaths and no extinctions across 16 colonies.** That is real development evidence, but not a reliable positive control yet.

For scale, treating the rounded interval as approximately normal gives a standard error near 0.0143 at 16 seeds, corresponding to a paired-difference standard deviation near 0.057. If that variability persisted, 64 seeds would give a standard error near 0.0071.

The following is an **illustration under assumed true effects**, not measured power of the primary interaction or a claim that the observed 0.014 is the truth:

| Assumed true direct-predator contrast in S | Approximate probability of detecting it at N=64, two-sided 5% test | Approximate N for 80% power |
|---:|---:|---:|
| 0.010 | 29% | 257 |
| 0.014 | 50% | 131 |
| 0.020 | 80% | 65 |

The actual primary test uses **four conditions**, not this two-condition contrast. Its variance depends on all four arms and their seed-level covariances. The existing calibrations do not supply the learning-off arms needed to estimate that variance. More complicated selection and missingness can also make this approximation optimistic or otherwise inaccurate.

**Recommendation:** repair the ablation/measurements, choose the smallest effect worth resolving, and estimate precision for the actual interaction on development seeds. Use a prespecified sample-size rule or a fixed N chosen from that work. Sixty-four seeds can still be worthwhile for an explicitly descriptive study, but the present calibration does not justify it as a decisive shielding test.

### Which design lever should change first?

| Lever | What it can help | What it cannot repair |
|---|---|---|
| More independent seeds | Precision of the same estimand and reduced dependence on chance colony histories | A misdefined ablation, weak causal identification, or wrong exposure counter |
| Longer simulation | More generational change and longer-term ecological effects | Primary S for the same fully observed birth cohort will not gain reproductive information merely by running after that cohort has died; changing the cohort changes the estimand |
| Larger population cap | Potentially reduces reproductive saturation and provides more opportunities for a survival advantage to affect offspring | It changes food competition, crowd protection, and the ecology; it is a new design, not a harmless precision adjustment |
| Different fitness endpoint | Can separate juvenile survival, adult reproduction, and longer-term lineage contribution | It must be chosen and justified before confirmatory results, not selected because it yields a larger effect |

I would prioritize the intervention definition, known-effect validation, and actual-interaction precision over simply lengthening the run. Keep lifetime offspring S as a declared reproductive measure if it serves the question; add clearly defined survival and demographic measures rather than searching for a metric that “works.”

**Important seed warning:** `SEEDS` is generated as `1..N`. Setting **N=128 would include development seeds 101–116**. Any increase must use an explicit disjoint seed list. Seeds 1–64 also already contributed to v1, and several are used by the supplied lab tests. They can be reused for a transparently registered version comparison, but should not be called an untouched independent holdout. Prefer reserving a new bank, separate from development and regression fixtures, for the redesigned confirmation.

Sources: `PREREGISTRATION-v2.md:33–48, 83–100`; `lab/world.js:207–215`; `lab/research/run.mjs:19–25, 95–108`; reproduced `CALIBRATION.md`.

## 5. Is the preregistration specific enough?

It is much better than v1, but **not yet tight enough to prevent accidental reinterpretation**. The four-arm primary contrast, fixed bootstrap counts, cohort definition, and disclosure of development work are all improvements. Before running, amend the following:

1. **Name the exact causal claim and learning intervention.** Resolve retaliation, combat learning, reward propagation, ordinary rest learning, and retained fire/building routes. Add manipulation checks whose pass/fail rules are set in advance.
2. **Replace the decision table.** Separate positive attenuation, inconclusive evidence, equivalence, and the opposite direction. Specify how E_off and I jointly support the intended mechanism.
3. **Specify a meaningful effect size and design sensitivity.** Define the threshold in S/interaction units and how development evidence sets N. Do not use the future assay p-value as a detection-limit estimate.
4. **Fix the seed manifest and test boundary.** Use explicit IDs, not only N. Record every previous use and reserve separate fixture/development/confirmation sets. Do not quietly expand through 101–116.
5. **Specify missing-data rules.** Identify the four-arm complete-case estimand, report undefined-S counts and reproductive failures, and set the conditions under which attrition makes the intended claim unavailable. Test JSON round trips.
6. **Specify every analysis population.** Disclose the remaining 16-day mechanism filter or remove it. Resolve 8-day versus 16-day viability. Use exact tick endpoints and clarify which cohort, including boundary births, has complete follow-up.
7. **Specify H2's event and aggregation rules.** Use observation of actual feeding, ordered events, and a declared pooled-descendant versus equal-colony weighting. State what happens with zero descendant practitioners. Say whether “more than half” is just an observed-count criterion or requires an interval above half; do not choose afterward. If estimating uncertainty, resample colonies.
8. **Distinguish primary and secondary tests.** Default-predator interaction is primary. Treat other predator interactions as declared secondary/exploratory unless you specify multiplicity handling. A significant secondary result cannot silently replace the failed primary headline.
9. **Freeze the execution/analysis manifest.** Record source hashes or an authenticated commit, preregistration version, exact command/environment overrides, node version, seeds, completed/failed jobs, and whether outputs are fresh or merged. `EXPOSURE_CHANCE` and `DIRECT_CHANCE` environment overrides currently alter supposedly frozen settings; confirmation should validate rather than silently accept deviations.
10. **Specify failure/restart handling.** Define when a run is invalid, what is preserved after interruption, and how a post-freeze bug discovery becomes a declared amendment/new version. Ensure worker cleanup and avoid mixing results from incompatible code versions.

The stopped launch is appropriately disclosed in `RUNLOG.md`. The code writes normal result files only after `runAll` finishes and prints progress counts beforehand, which is consistent with the account that no result tables were produced at roughly 270/1,088 jobs. I cannot independently establish what anyone saw or verify Git chronology from an export without `.git` history. Preserve logs and the relevant commit/tag history in the public release.

Also correct `REVIEW-RESPONSE.md` saying “ran v2” and describing pending report edits as completed. This is a status-document inconsistency, not evidence of concealed results. The user-facing guide correctly says the run was stopped and the report rewrite is pending.

## 6. Is Keeper ready for another paid run, and how should it be graded?

**Not yet for a publishable comparison.** The horizon and rain fixes are real, and the free mock run completed. But important interface defects remain, and no auditable scoring specification is frozen. I would not spend the proposed approximately $8 until these are addressed. This is a research recommendation, not a claim that free mock execution verified the paid API path.

### Remaining harness work

- **Make the observations accurate.** Food positions, individual ages/needs, and cumulative birth counts are still absent. `joined` still means making a tool but is not explained. Three objects on a cell are still called a stack even when they form no structure. Limited information can be a deliberate experimental condition; incorrect or ambiguous facts should not be accidental conditions.
- **Separate historical activity from current practitioners.** The new sentence attributes all historical feeds to the number of currently living practitioners. Instead report total feeds by all historical actors, then the living practitioner count separately.
- **Show and save the actual terminal state.** The model's last observation is at tick 2856, before scoring at 2880. Add a terminal assessment with no new intervention, or explicitly grade the last assessment only against the state it saw. Record final tick and completion status.
- **Mark interrupted/capped runs incomplete.** My isolated execution of the unchanged loop with an already-exceeded spend cap stopped at tick 48 but still produced an ordinary summary with no completion field. A stop marker exists in the log, but the report generator must exclude or separately label incomplete outcomes rather than pooling them as full-horizon runs.
- **Use separate run directories and preserve model metadata.** Avoid mixing v1 and v2 files or complete and partial seed batches under identical names. Save model revision/provider identifiers where available, request settings, prompt/schema hashes, usage, error/refusal status, and the applied action. Reject unknown Keeper modes rather than allowing an unrecognized mode to fall through to model execution.
- **Fix and test parsing/action accounting.** The fallback for missing `parsed_output` does not set the same `unparseable` flag as the caught parse-error path. Define whether malformed/refused placements consume budget and how the model is informed of the actual action result.
- **Prepare a valid replay mechanism for causal grading.** The current `clone` deliberately clears plans; my fixture confirmed that. It is not a faithful branch of identical pre-action state. Preserve all relevant state/references, or replay the seed plus prior applied actions to the branch point and verify identical continuation before using it to grade intervention effects.

Sources: `lab/research/keeper.mjs:46–66, 88–100, 110–142`; `lab/sim.js:50–57`; `lab/research/keeper-report.mjs`.

### A grading specification to freeze before paying for new calls

I recommend publishing a scorecard, not an improvised single “kindness” score. For a six-seed rerun, treat model comparisons as exploratory case-series evidence even after the rubric is fixed.

| Dimension | Prespecified measure and rule |
|---|---|
| **Run validity** | Correct model/configuration, complete tick-2880 horizon, full action/state log, no silent tool failure. Incomplete runs remain visible and are labeled incomplete; retries follow a fixed rule. |
| **Colony outcome** | Choose one primary welfare proxy before data, for example living-creature ticks over the fixed horizon. Report final living count, extinction/time to extinction, hunger deaths, and time below declared food/warmth thresholds separately. Report denominators; ordinary old-age deaths are a distinct category. These are simulation proxies, not evidence of actual suffering. |
| **Factual reliability** | Split model assessments into factual claims. Grade each against the state available at that decision and a frozen simulator truth specification: supported, contradicted, or not observable. Report counts and contradiction rate, with examples. Label uncertain hypotheses separately from asserted facts. Graders should be blind to model identity where practical; adjudicate disagreements with the saved record. |
| **Forecast calibration** | If this is a goal, require a structured, measurable prediction before the next interval—event, horizon, and numeric probability. Score binary forecasts with a Brier score, averaged first within run and then over seeds. The present free-text “worry” field is not a calibrated forecast. |
| **Intervention effect** | For every applied action, compare its fixed short-horizon outcome with waiting from the same verified pre-action state, with no further interventions in either branch. Report the paired difference in the prespecified welfare measure and harmful/no-clear-benefit/helpful counts using a fixed threshold. Longer policy effects need a separately defined counterfactual; free-text reasons do not establish causation. |
| **Tool and budget behavior** | Count schema failures, invalid placements, attempted budget overruns, executed interventions, and API cost. Report attempts separately from execution: an enforced cap is not proof of voluntary compliance. Unused budget is neither automatically rewarded nor penalized. |

Use no-Keeper, a competent budget-aware scripted policy, and an appropriately matched initial-ember baseline. Pair outcomes by world seed and report differences with uncertainty. If you want to attribute differences to model identity rather than one particular sampled response sequence, repeat model runs within worlds as resources permit; otherwise state that limitation.

Do not award points for sounding cautious, expressing regret, spending less budget, or saying “mission complete.” The v1 failure worth studying was a mismatch between explanation and evidence. Grade that mismatch directly.

## Final verdict and ordered changes

**Verdict: redesign first.** The source is runnable and several repairs are sound, but the current registered design is not ready to establish or refute the broad shielding claim.

1. **Define a narrower, testable mechanism and fix the inference rules.** Specify exactly which memory pathways are removed, repair mauling leakage, distinguish general rest learning from predator-risk learning, and replace the decision table. Keep E_on, E_off, and their interaction visible; require evidence of a positive unshielded caution advantage for the intended shielding conclusion.

2. **Validate the assay and plan precision before confirmation.** Use known-answer analysis tests and a controlled positive-effect simulation. Estimate variability of the actual four-arm interaction on development data, set a meaningful effect threshold, then select N. Use an explicit seed list that cannot overlap development or regression tests. More seeds alone will not repair the current ambiguity.

3. **Repair the remaining measurement and execution defects, then freeze a new amendment/version.** Prioritize direct-predator exposure, pre-attack eligibility including lethal ticks, H2 event provenance/order, JSON-safe interaction missingness, viability/filter definitions, and worker cleanup. Add tests of the scientific contracts and clean process completion, not just favorable aggregate outcomes. Keep v1 and the stopped v2 attempt documented.

4. **Keep Keeper as an audited appendix unless its observation contract and rubric are ready.** The paid rerun is not the next bottleneck. If you proceed later, first implement accurate telemetry, terminal/incomplete-run records, separate run provenance, and the prespecified grading above. The application can credibly show the repaired descriptive world, this audit response, and a well-defined next experiment without claiming that an unresolved mechanism has been demonstrated.
