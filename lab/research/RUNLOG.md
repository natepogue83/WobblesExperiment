# Run log

Every confirmatory launch, in order, including ones that were stopped.

| when (local, UTC-5) | commit | what | outcome |
|---|---|---|---|
| 2026-10-11 03:50 | `920d302` | v1 confirmatory run, N = 64 (512 runs) | completed; outputs in `results-v1/` (tag `confirmatory-v1`) |
| 2026-10-11 04:00 | `920d302`+ | v1 rerun with the added ablation baseline (576 runs) | completed; superseded the 03:50 tables, which are kept as `results-v1/first-64-seed-run.log` |
| 2026-10-11 13:53 | `3cfd866` (tag `preregistration-v2`) | v2 confirmatory run, N = 64 (1,088 runs) | **stopped at about 270 of 1,088 runs at Nate's request, so the v2 fixes could be independently reviewed first. The harness writes nothing until every run finishes; no v2 results were written or seen.** |
| 2026-10-11 about 22:39 | `7132241` | v3 development precision run, seeds 1001-1064 (512 runs), not confirmatory | completed; `results-dev/PRECISION.md` |
| 2026-10-11 about 22:48 | `7132241`+ | dry run of the v3 analysis on the development data | completed; `results-dev/dry-analysis/` |
