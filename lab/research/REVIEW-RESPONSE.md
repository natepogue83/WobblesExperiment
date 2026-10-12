# Response to the independent review of 2026-10-11

The review is `reviews/2026-10-11-astra-review.md`. It was written by Astra, a separate AI
system, working only from an exported snapshot, with no paid model calls. This document lists
what it found and what we did about each point. "We" is Nate Pogue and the AI agent (Claude)
that writes the code under his direction.

The short version: the review was right about the main claim, and right about every bug it
reported. We kept v1 exactly as it was (git tag `confirmatory-v1`, outputs in `results-v1/`),
fixed the code and wrote a new pre-registration before any new confirmatory data. ~~and ran v2~~ [Corrected 2026-10-12: v2 was started and then stopped, unread, so the fixes could be reviewed first; see RUNLOG.md. The second review then found further problems, answered in REVIEW-RESPONSE-2.md.]

## The main claim

| Review finding | Response |
|---|---|
| "Learning absorbed the pressure" was not shown; it was an explanation offered after H3a's fitness prediction failed, which the pre-registration said would mean "we could not find a pressure that lands". | **Accepted in full.** Removed as a finding. v2 registers the test that could show it: predator x protective-learning interaction, gated by an assay check that has to pass first (`PREREGISTRATION-v2.md`). |
| "Nothing moved" overstates a null; the interval does not exclude the registered +0.03. | **Accepted.** v2 reports "no detectable effect" with the interval, and the assay check tells the reader the smallest selection the method can see. |
| "The pilot was noise" is a stronger diagnosis than the evidence allows; code changed between pilot and confirmation. | **Accepted.** Now "the pilot finding did not replicate". The pilot used seeds 1 to 8, which are among the confirmatory seeds 1 to 64; that overlap is now disclosed. |
| Ablations were described as pre-registered findings. | **Accepted.** They were registered as descriptive. Now labelled that way. |

## Bugs and measurement defects

| Finding | Response | Where |
|---|---|---|
| A. An observer can count as an independent practitioner. | **Fixed.** Practitioners are creatures with a `fed_fire` event. | `sim.js` `fireReport`; test A |
| B. One attack is remembered as new harm on many later ticks. | **Fixed.** Each attack is processed once, for the victim and each witness. The soft-strike mauling now records an attack like any other. | `creature.js`; test B |
| C. "Resting somewhere closed" counted walking toward it. | **Fixed.** Night behaviour is measured after each tick from position and completed action. | `sim.js` `step`; test C |
| D. The targeted predator read a stale action and had a larger radius. | **Fixed.** It reads what was done this tick; same radius as default. | `world.js`; test D |
| E. The strike decision read hidden material properties. | **Fixed.** Judged from visible size and experience. Other instincts (flight from a visible predator, a safe-spot finder, warmth attraction) are kept and now disclosed as instincts. | `creature.js` |
| "Recipe-free" is too strong: the shard-and-stick join is a coded transformation, and some outcomes carry designed bonuses. | **Accepted.** The rewritten report will say "no craft menu or prescribed sequence", and list the designed incentives. [Pending: the report has not been rewritten yet.] | REPORT section 1 |
| F. H1's isolated creature was teleported away from the fire, so it lost access as well as observation, and the fire was still visible. | **Fixed.** v2 keeps c2 in the colony with full access and blocks only observation learning. | `run.mjs` H1 |
| G. H2 measures late practice, not an unbroken lineage. | **Accepted.** Renamed "late practice"; v2 adds whether the fire burned without a gap and whether each descendant had seen a feed before its own first. | `run.mjs` H2 |
| Breeding scanned creatures in fixed order. | **Fixed.** Seeded random order. | `creature.js` |
| Daily wipe kept the fright memory. | **Fixed.** Bonds are kept (they are social, not outcome memory), and that is disclosed. | `creature.js` |

## Statistics

| Finding | Response |
|---|---|
| Differences sampled each arm independently, ignoring matched seeds. | **Fixed.** Paired bootstrap over seeds. |
| The correlation treated colony-mates as independent and used 2,000 resamples. | **Fixed.** Cluster bootstrap over colonies, ranks within colony. Still 2,000 resamples for correlations, now stated. |
| Fitness was censored and filtered at 16 days, unregistered. | **Fixed.** Selection differentials over a cohort born by day 60, early deaths included. |
| Survivor-conditioned endpoint; extinct colonies drop out unequally. | **Accepted.** Extinctions reported per arm; contrasts report how many seeds they use. |
| Results depended on worker completion order. | **Fixed.** Sorted before analysis. |
| The correlation interval in the report did not match the final summary. | **Accepted.** v2 prose is written from the v2 summary only. |

## Reproducibility

| Finding | Response |
|---|---|
| The export did not run: wrong layout, missing random-number module, no raw data. | The export was a partial copy we made for the review; the repository itself runs. We will publish the repository at a pinned commit with `results/raw.json` and `results/manifest.json`. |
| Pre-registration timing could not be authenticated. | v1 pre-registration is commit `22e3457`, before the first results commit `28fe53f`; v2 is tagged `preregistration-v2`. In the public repository these are checkable. |

## The Keeper study

| Finding | Response |
|---|---|
| Final scores were taken at day 123, not day 120. | **Accepted.** Disclosed; the harness is fixed for any future run. |
| The Opus "no children" anecdote is false: that colony had seven births. | **Accepted, and the most important error in v1.** We copied the model's account into the report without checking it against the record. That is exactly the failure a safety reader should worry about, and the rewritten report will describe it as such. [Pending.] |
| The rain tool was overwritten by the schedule on the next tick. | **Fixed** in the code. The v1 runs used the broken tool, which is disclosed. |
| The observation interface omitted fire and food coordinates and mislabelled several things ("joined" read as bonding). | **Accepted.** Disclosed as interface defects that shaped the models' false beliefs. |
| Haiku "named few" worries is a stylistic impression; using the full budget is permitted. | **Accepted.** Removed. |
| Make it an appendix or fix it. | **Done:** an audited-prototype appendix. No rerun before the deadline. |

## Authorship

| Finding | Response |
|---|---|
| The decision log documents product direction, not which scientific decisions Nate made. | **Accepted.** Nate is adding a contribution statement and three decisions in his own words. |
| Parts read like polished agent narration; repeated claims of honesty. | **Accepted.** The rewrite will cut them. [Pending.] |
