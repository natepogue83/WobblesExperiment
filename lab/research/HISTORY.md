# How the study changed, and why

The version history behind [REPORT.md](REPORT.md), section 2.

| stage | what happened |
|---|---|
| Pilot (8 seeds) | Suggested the predator selected for *boldness*. |
| v1 pre-registration and run (64 seeds) | No effect on caution. I explained the null as "learning absorbed the pressure", though the registered mechanism prediction had failed. |
| Review 1 | Found that the explanation was not shown, four measurement bugs (the "practitioner" count included creatures that only watched; one attack was re-remembered every tick; "sheltering" counted walking toward shelter; a predator read a stale record), a model anecdote I had copied into the report that was false (a colony I described as having "no births" had seven), and missing reproduction files. |
| v2 | Fixes and a new pre-registration. The run was **stopped unread** so the fixes could be reviewed first. |
| Review 2 | "Redesign first": the learning switch leaked, the decision table could turn a wide null into a claim, the positive control could not establish what it said, and further bugs. |
| v3 | Predator learning separated into its own memory; a gene-only simulation check; decision rules taken from the review; N chosen from a precision run on separate development seeds. |
| Review 3 | "Run after these specific changes": the analysis would certify incomplete data (it gave a confident verdict from one seed), the code freeze missed the random-number module, a cohort boundary was off by one tick, and the memory wipe kept the new memory. |
| v3.1 | Fixed; amended pre-registration; a new seed bank per v3's own rule; run once. |

Everything is preserved: v1's outputs (`results-v1/`, tag `confirmatory-v1`), all three reviews
(`reviews/`), point-by-point responses (`REVIEW-RESPONSE*.md`), and every launch, including the
stopped one (`RUNLOG.md`).

