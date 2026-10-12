# Results v3 (64 seeds per condition, seeds 1001-1064)

Pre-registration: PREREGISTRATION-v3.md. Contrasts are paired by seed (bootstrap over seeds, 10,000 resamples); the interaction uses only seeds where all four arms have a defined S. Correlations resample whole colonies.

## Manipulation and method checks

| check | rule | result |
|---|---|---|
| risk learning off removes risk memory | every creature in every off colony has none | pass |
| risk learning on learns risk | in at least 90% of default-predator colonies | 98%: pass |
| comfort learning about rest is kept | rest memories exist in both arms | pass |
| the switch is specific to predator risk | no-predator colonies have identical complete final-state digests with it on and off, every seed | pass |
| full horizon | every colony scored at tick 2880 | pass |
| simulation check: the gene-only regime raises S | paired interval above zero | 0.015 [0.000, 0.030]: pass |

All checks **passed**.

## H3: predator effect on selection for caution, and its interaction with risk learning

S is the offspring-weighted minus plain mean caution over each colony's cohort born by day 60, early deaths included. Default is primary; direct and gene are secondary checks.

| predator | E_on | E_off | I = E_off - E_on | seeds with all four arms | decision |
|---|---|---|---|---|---|
| default | 0.009 [-0.005, 0.023] | 0.010 [-0.002, 0.023] | **0.001 [-0.011, 0.014]** | 64 | inconclusive: the interval includes zero and effects of meaningful size |
| direct | 0.010 [-0.005, 0.024] | (same as E_on: no prowler, so no risk learning) | n/a | 64 | (secondary) |
| gene | 0.015 [0.000, 0.030] | (same as E_on: no prowler, so no risk learning) | n/a | 64 | (secondary) |

### All-colony outcomes

| condition | extinct | offspring credited to cohort parents (a child of two cohort parents counts twice) | births | predator attacks (non-fatal) | killed by predator | hunger deaths | mean caution of the living at day 120 (survivors only) | S undefined |
|---|---|---|---|---|---|---|---|---|
| none|on | 0/64 | 27.7 [26.8, 28.7] | 19.1 [18.6, 19.6] | 0 (0) | 0 | 73 | 0.460 [0.424, 0.496] | 0 |
| none|off | 0/64 | 27.7 [26.8, 28.7] | 19.1 [18.6, 19.6] | 0 (0) | 0 | 73 | 0.460 [0.424, 0.496] | 0 |
| default|on | 0/64 | 26.8 [25.6, 28.0] | 18.7 [18.2, 19.2] | 400 (397) | 3 | 61 | 0.512 [0.477, 0.546] | 0 |
| default|off | 0/64 | 26.9 [25.9, 27.9] | 19.0 [18.6, 19.5] | 494 (484) | 10 | 68 | 0.489 [0.458, 0.519] | 0 |
| direct|on | 1/64 | 44.6 [42.2, 47.0] | 29.8 [28.4, 31.2] | 951 (0) | 951 | 79 | 0.526 [0.490, 0.560] | 0 |
| gene|on | 0/64 | 47.2 [45.5, 48.9] | 32.0 [31.1, 32.9] | 0 (0) | 1081 | 109 | 0.510 [0.469, 0.553] | 0 |

### Caution and vulnerability before each night attack draw (descriptive; learning-on arms; cohort)

Statistic: caution and the share of night ticks a creature was takeable under each rule are ranked within each colony, scaled to (-0.5, 0.5), pooled, and correlated (Spearman); the interval resamples whole colonies (2,000 resamples). Cohort members with no night ticks are excluded (2 in all arms). Degenerate resamples, if any, are dropped and counted in summary.json.

| arm | default rule | direct rule (outside fire and walls) | resting in the open |
|---|---|---|---|
| none, risk learning on | -0.354 [-0.421, -0.283] | -0.431 [-0.501, -0.357] | -0.143 [-0.231, -0.049] |
| default, risk learning on | -0.231 [-0.301, -0.162] | -0.349 [-0.421, -0.276] | -0.056 [-0.135, 0.028] |
| direct, risk learning on | -0.245 [-0.302, -0.186] | -0.303 [-0.358, -0.249] | -0.091 [-0.147, -0.034] |
| gene, risk learning on | -0.246 [-0.299, -0.192] | -0.297 [-0.348, -0.242] | -0.185 [-0.238, -0.129] |
