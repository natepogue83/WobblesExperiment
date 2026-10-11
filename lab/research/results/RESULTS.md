# Results (N = 64 seeds per condition)

Generated 2026-10-11 by `node lab/research/run.mjs`. Intervals are 95% bootstrap CIs over seeds.

## H1: social transmission

| measure | result |
|---|---|
| colonies where the practice had 2+ practitioners by day 17 | 32/64 (0.50 [0.38, 0.63]) |
| colonies where the fire was still burning at day 17 | 28/64 |
| isolated creatures that acquired the practice | 0/64 |

## H2: culture outlives its founders (70 days)

| measure | result |
|---|---|
| colonies where every founder had died by day 70 | 64/64 |
| ...and the fire was still fed in the last four days by creatures born after the lump appeared | 33/64 (0.52 [0.39, 0.64]) |

## H3: does the predator select for caution? (120 days)

| | no predator | predator | targeted predator |
|---|---|---|---|
| change in mean caution, founders to survivors | -0.00 [-0.04, 0.03] | 0.02 [-0.02, 0.05] | -0.00 [-0.03, 0.03] |
| change in mean brawn | -0.01 [-0.03, 0.02] | 0.00 [-0.02, 0.03] | 0.01 [-0.02, 0.03] |
| births per colony | 16.77 [15.95, 17.48] | 16.53 [15.30, 17.73] | 15.73 [14.58, 16.81] |
| colonies extinct by day 120 | 1/64 | 10/64 | 7/64 |
| killed by the predator (all colonies) | 0 | 36 | 2 |
| hunger deaths (all colonies) | 36 | 300 | 54 |
| predator attacks / driven off | 0 / 0 | 450 / 183 | 97 / 265 |
| shards struck / trees felled / tools joined | 527 / 316 / 325 | 503 / 326 / 261 | 713 / 455 / 441 |

Difference in caution change, predator minus control: **0.02 [-0.03, 0.07]**. Targeted predator minus control: **0.00 [-0.04, 0.05]**.

### H3a mechanism, predator colonies (1225 individuals who lived 16+ days)

Spearman rho, caution vs offspring: **0.02 [-0.04, 0.08]**.

| | cautious (≥0.6, n=425) | bold (<0.4, n=411) |
|---|---|---|
| offspring per individual | 1.75 | 1.62 |
| share of night ticks fleeing | 3.4% | 1.4% |
| share of night ticks resting somewhere closed | 20.3% | 11.1% |
| share of night ticks eating | 14.1% | 13.7% |

### H3a mechanism, targeted predator colonies (1296 individuals who lived 16+ days)

Spearman rho, caution vs offspring: **0.01 [-0.04, 0.07]**.

| | cautious (≥0.6, n=403) | bold (<0.4, n=467) |
|---|---|---|
| offspring per individual | 1.55 | 1.54 |
| share of night ticks fleeing | 3.8% | 1.9% |
| share of night ticks resting somewhere closed | 26.4% | 15.2% |
| share of night ticks eating | 16.3% | 16.5% |

### H3a mechanism, no predator colonies (1350 individuals who lived 16+ days)

Spearman rho, caution vs offspring: **-0.01 [-0.06, 0.05]**.

| | cautious (≥0.6, n=449) | bold (<0.4, n=469) |
|---|---|---|
| offspring per individual | 1.60 | 1.61 |
| share of night ticks fleeing | 0.0% | 0.0% |
| share of night ticks resting somewhere closed | 29.6% | 16.4% |
| share of night ticks eating | 17.1% | 19.2% |

## Ablations (predator present, 50 days)

| | unchanged | no learning by watching | memory wiped every dawn | no children |
|---|---|---|---|---|
| colonies extinct by day 50 | 0/64 | 0/64 | 0/64 | 0/64 |
| fire still burning at day 50 | 36/64 | 6/64 | 0/64 | 33/64 |
| creatures alive at day 50 | 11.80 [11.59, 11.95] | 9.47 [8.89, 10.00] | 6.05 [5.44, 6.64] | 5.34 [5.09, 5.56] |
| hunger deaths (all colonies) | 96 | 587 | 202 | 38 |
