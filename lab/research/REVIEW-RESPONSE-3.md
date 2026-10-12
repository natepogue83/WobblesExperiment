# Response to the third independent review (2026-10-12, verdict "run after these specific changes")

The review is `reviews/2026-10-12-astra-review-3.md`. All five blocking items and most of the
nice-to-have items are done. The amended plan is version 3.1 of `PREREGISTRATION-v3.md`.

## Blocking

| # | finding | done | test |
|---|---|---|---|
| 1 | The analysis certified incomplete data (one seed gave a confident verdict; a missing arm still "validated") | `validateRows` rejects missing, duplicate and unexpected jobs and missing fields before any check or interval; the analysis stops with an error. A categorical primary conclusion needs every seed defined in all four arms, otherwise "withheld". Checks no longer pass vacuously on empty sets. | `test-lab-analysis.js` *Invalid input is rejected...*; *decision rules* (withheld) |
| 2 | The clean-tree guard missed `src/sim/rng.js`; inputs were not frozen at launch; reanalysis was unbound | Whole tracked tree checked. Input hashes (simulation, RNG, analysis, statistics, figures, the pre-registration and the risk contract) written to `manifest-launch.json` before simulating and re-checked after. The final manifest records the raw-data hash; `ANALYZE=1` refuses mismatched raw data and logs every reanalysis with its input hashes. A run refuses to overwrite earlier output. | harness |
| 3 | Cohort boundary off by one reproductive tick; specificity compared five aggregates | Cohort is born strictly before tick 1440. Specificity compares a SHA-256 digest of the complete final state (events, objects, every creature field and memory), excluding only the switch flag. Development precision rerun with the final code (`results-dev/v3.1/`); the v3 outputs are kept. | precision rerun |
| 4 | The dawn wipe kept risk memory | The wipe clears it. | `test-lab-audit.js` *Dawn wipe clears...* |
| 5 | Interpretation wording and version policy | "Bounded" replaces "equivalence"; the negative-I label says "shifts upward relative to off" and requires the signs; branch order stated; "attenuation" does not mean larger than delta; delta restated as a declared target; the gene regime described as an empirical gate. Per v3's own rule, v3.1 uses a new seed bank, 3001 to 3256. | `test-lab-analysis.js` *decision rules* |

## Nice to have

| finding | done |
|---|---|
| Real-path tests for flight, defence, credit and fright | Partly. The mauling route is tested through the gate and was confirmed on the real path by the review's own probe; flight and defence real-path fixtures are not added before the deadline. Disclosed. |
| Exact fatal-tick increment | Done: exactly one night tick and one direct-eligibility tick added on the fatal step. |
| Forced worker error | Done (`SMOKE=fail`): the run fails and exits by itself. |
| Gene-hazard fixture | Done: a draw of 0.012 takes caution 0.2 and spares caution 0.8, wherever they are. |
| Telemetry and labels | Attacks and non-fatal attacks per arm; "offspring credited to cohort parents" label; the correlation statistic described exactly; zero-night exclusions counted; the mechanism table says it reports learning-on arms; stale comments calling the direct regime behaviour-free corrected; the default chase now calls the shared `vulnerable` definition. |
| Risk contract too absolute | `RISK-LEARNING.md` now says "the enumerated risk-learning and fright pathways", notes credit and stored episodes, and corrects "not observed". |
