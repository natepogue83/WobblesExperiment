# Results v3.1 (256 seeds per condition, seeds 3001-3256)

Pre-registration: PREREGISTRATION-v3.md, version 3.1. Contrasts are paired by seed (bootstrap over seeds, 10,000 resamples); the interaction uses only seeds where all four arms have a defined S. Correlations resample whole colonies.

## Manipulation and method checks

| check | rule | result |
|---|---|---|
| risk learning off removes risk memory | every creature in every off colony has none | pass |
| risk learning on learns risk | in at least 90% of default-predator colonies | 98%: pass |
| comfort learning about rest is kept | rest memories exist in both arms | pass |
| the switch is specific to predator risk | no-predator colonies have identical complete final-state digests with it on and off, every seed | pass |
| full horizon | every colony scored at tick 2880 | pass |
| simulation check: the gene-only regime raises S | paired interval above zero | 0.009 [0.004, 0.015]: pass |

All checks **passed**.

## H3: predator effect on selection for caution, and its interaction with risk learning

S is the offspring-weighted minus plain mean caution over each colony's cohort born before day 60 (tick 1440), early deaths included. Default is primary; direct and gene are secondary checks.

| predator | E_on | E_off | I = E_off - E_on | seeds with all four arms | decision |
|---|---|---|---|---|---|
| default | -0.008 [-0.014, -0.002] | -0.001 [-0.008, 0.005] | **0.006 [0.000, 0.012]** | 256 | effect modification: I is positive, but a positive predator-related selection differential without risk learning is not shown |
| direct | 0.011 [0.005, 0.017] | (same as E_on: no prowler, so no risk learning) | n/a | 256 | (secondary) |
| gene | 0.009 [0.004, 0.015] | (same as E_on: no prowler, so no risk learning) | n/a | 256 | (secondary) |

### All-colony outcomes

| condition | extinct | offspring credited to cohort parents (a child of two cohort parents counts twice) | births | predator attacks (non-fatal) | killed by predator | hunger deaths | mean caution of the living at day 120 (survivors only) | S undefined |
|---|---|---|---|---|---|---|---|---|
| none|on | 0/256 | 27.4 [27.0, 27.8] | 18.6 [18.4, 18.8] | 0 (0) | 0 | 192 | 0.518 [0.502, 0.533] | 0 |
| none|off | 0/256 | 27.4 [27.0, 27.8] | 18.6 [18.4, 18.8] | 0 (0) | 0 | 192 | 0.518 [0.502, 0.533] | 0 |
| default|on | 0/256 | 27.2 [26.8, 27.7] | 18.7 [18.4, 18.9] | 1515 (1482) | 33 | 199 | 0.502 [0.487, 0.518] | 0 |
| default|off | 0/256 | 27.4 [27.0, 27.8] | 18.7 [18.5, 18.9] | 1777 (1752) | 25 | 184 | 0.511 [0.495, 0.527] | 0 |
| direct|on | 1/256 | 42.5 [41.6, 43.4] | 29.1 [28.6, 29.6] | 3535 (0) | 3535 | 216 | 0.549 [0.532, 0.566] | 0 |
| gene|on | 0/256 | 44.9 [44.0, 45.7] | 30.8 [30.3, 31.2] | 0 (0) | 4055 | 224 | 0.546 [0.527, 0.564] | 0 |

### Caution and vulnerability before each night attack draw (descriptive; learning-on arms; cohort)

Statistic: caution and the share of night ticks a creature was takeable under each rule are ranked within each colony, scaled to (-0.5, 0.5), pooled, and correlated (Spearman); the interval resamples whole colonies (2,000 resamples). Cohort members with no night ticks are excluded (2 in all arms). Degenerate resamples, if any, are dropped and counted in summary.json.

| arm | default rule | direct rule (outside fire and walls) | resting in the open |
|---|---|---|---|
| none, risk learning on | -0.353 [-0.388, -0.318] | -0.446 [-0.478, -0.413] | -0.217 [-0.258, -0.177] |
| default, risk learning on | -0.279 [-0.314, -0.244] | -0.397 [-0.430, -0.364] | -0.094 [-0.133, -0.057] |
| direct, risk learning on | -0.213 [-0.246, -0.181] | -0.284 [-0.313, -0.255] | -0.117 [-0.147, -0.086] |
| gene, risk learning on | -0.212 [-0.247, -0.179] | -0.312 [-0.342, -0.281] | -0.120 [-0.152, -0.089] |

## H1: does feeding the fire depend on watching?

| | watching allowed | watching blocked |
|---|---|---|
| c2 fed the fire by day 17 | 170/256 | 78/256 |

Paired difference, allowed minus blocked: **0.36 [0.28, 0.44]**.

## H2: persistence after the founders die (70 days)

| measure | result |
|---|---|
| late practice: founders all dead, a fire burning, fed by a descendant in the last four days | 155/256 (0.61 [0.55, 0.66]) |
| a fire burned without any gap from day 3 to day 70 | 140/256 |
| colonies with at least one descendant practitioner | 170/256 |
| share of a colony's descendant practitioners who observed an actual feed before their own first (mean over those colonies) | 0.94 [0.90, 0.97] |

## Ablations (predator present, 50 days; descriptive)

| | baseline | noWatch | wipeDaily | noBreed |
|---|---|---|---|---|
| fire burning at day 50 | 156/256 | 36/256 | 1/256 | 132/256 |
| fire, paired difference from baseline | 0.00 [0.00, 0.00] | -0.47 [-0.54, -0.39] | -0.61 [-0.66, -0.55] | -0.09 [-0.15, -0.04] |
| creatures alive at day 50 | 12.0 [12.0, 12.0] | 11.5 [11.4, 11.6] | 6.8 [6.3, 7.2] | 6.0 [6.0, 6.0] |
