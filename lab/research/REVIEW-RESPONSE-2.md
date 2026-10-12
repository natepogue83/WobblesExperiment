# Response to the second independent review (2026-10-11, verdict "redesign first")

The review is `reviews/2026-10-11-astra-review-2.md`. We accepted the verdict. This lists each
point and what changed. The new plan is `PREREGISTRATION-v3.md`; the learning switch is defined
in `RISK-LEARNING.md`. No confirmatory run has been made since the review.

## Section 2: problems to fix before confirmation

| | finding | response | test |
|---|---|---|---|
| A | "Protective learning off" still learned from being mauled | **Fixed by redesign.** All predator knowledge now lives in a separate risk memory or in `dark beast` experience keys; the switch removes both, for own and observed experience, including the mauling route. | `test-lab-audit.js` *Risk learning off: no route...* |
| B | The switch removed some protective learning and also all learning about rest | **Fixed.** Rest comfort learning stays in both arms; only predator risk is removed. The claim is narrowed to this intervention. A new check confirms the switch changes nothing at all when there is no predator: on 64 development seeds, no-predator colonies were identical with it on and off. | *...keeps comfort learning about rest*; precision run |
| C | Direct-predator exposure was measured as if crowds protected | **Fixed.** One function, `vulnerable(world, k, mode)`, defines who each predator can take; the predators and the measurements both use it. | *Each predator rule is one definition...* |
| D | Exposure missed fatal ticks; the calibration diagnostic measured the wrong opportunity | **Fixed.** Eligibility under every predator's rule is logged for every living creature before each draw, so the victim's last tick counts. The v2 diagnostic's 68% versus 72% figure is withdrawn as an explanation. | *Eligibility is logged before the attack...* |
| E | H2 counted seeing an ignition as seeing a feed, and lost same-tick order | **Fixed.** Requires an observed feed (a `>place` key) before the first feed, in event order. Renamed "observed a feed before first feeding"; described as opportunity, not cause. | `test-lab-analysis.js` *H2 provenance...* |
| F | JSON reload could turn a missing interaction value into zero | **Fixed.** The interaction requires all four operands finite before subtracting; E_on, E_off and I share one seed set. Analysis is now a separate module and can be rerun without simulating. | *Paired contrasts and the four-arm interaction* |
| G | Mislabelled viability endpoint; unregistered 16-day filter; constant inputs gave a correlation of 0 | **Fixed.** Viability is survival to 8 days (breeding age). The mechanism analysis has no age filter. Constant inputs give an undefined correlation; degenerate resamples are dropped and counted. | *Cluster correlation...* |
| H | The last worker never exited | **Fixed.** Every worker is terminated on success and on failure. | *The harness exits cleanly* |

## Section 3: the design and its inference rules

| finding | response |
|---|---|
| The decision table could turn a wide null into "no shielding" | **Replaced** with the review's rules: attenuation needs I and E_off both clearly positive; a wide interval is inconclusive; equivalence needs the whole interval inside a registered bound; failed validation overrides everything. `decide()` implements them and is tested on the review's own invented examples. |
| "No detectable effect" is not a prediction | **Dropped.** E_on is reported, not tested. |
| S conditions on reproduction; report it | Undefined S per arm and the common seed count are reported; all-colony outcomes (extinction, births, deaths) are reported alongside. |

## Section 4: the method checks and sample size

| finding | response |
|---|---|
| The direct predator is a stress test, not a known-effect calibration, and "no behaviour is involved" was false | **Accepted.** Added a gene-only regime: a daily hazard tied to the caution gene, applied anywhere, with no behaviour or place involved. It is the simulation check; the direct predator is kept only as a secondary stress test. Its description is corrected. |
| Synthetic known-answer tests of the analysis | **Added** (`test-lab-analysis.js`). |
| Choose N from the variability of the real contrast | **Done.** A precision run on development seeds 1001 to 1064 gave a per-seed SD of 0.051 for I and 0.062 for the gene check. With delta = 0.01, N = 256. |
| Seeds must not overlap, and N must not run into development seeds | **Fixed.** Explicit banks; confirmation is 2001 to 2256. |

## Section 5: tightening the pre-registration

All ten points are addressed in `PREREGISTRATION-v3.md`: the exact intervention and manipulation
checks with pass rules (1); the new decision table (2); delta and the sample-size reasoning (3);
seed banks (4); missing-data rules and common seed set (5); every analysis population, with exact
tick endpoints (6); H2's event rule, aggregation and the meaning of "more than half" (7); one
primary contrast, others secondary (8); a manifest with commit, dirty flag and source hashes, and
a confirmatory run that refuses overrides and a dirty tree (9); invalid-run and amendment rules
(10).

One development observation matters for how to read the coming result, and is disclosed in the
pre-registration: on development seeds the default predator killed only 3 creatures in 64
colonies. It mostly mauls. It may exert little selection at all, in which case an "equivalence"
result says only that there was little to attenuate. E_on is reported so the reader can see this.

## Section 6: the Keeper study

**Accepted: it stays an audited v1 appendix for this submission.** The fixes already made (day-120
scoring, real rain, fire positions) remain, but the remaining interface and grading work in the
review is not done, so no paid rerun.

## Corrections to our own documents

`REVIEW-RESPONSE.md` said v2 had been run and described pending report edits as done. Both are
corrected in place with dated notes. `PREREGISTRATION-v2.md` said every fix had a regression test;
the correction is recorded at the top of `PREREGISTRATION-v3.md`.
