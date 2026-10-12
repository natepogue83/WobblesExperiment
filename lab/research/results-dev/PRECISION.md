# Precision on the development bank (seeds 1001-1064; never used for confirmation)

delta = 0.02 (smallest effect on S worth resolving). N for 80% power at two-sided 5% = ((1.96 + 0.84) x SD / delta)^2.

| contrast | estimate [95% CI] | seeds used | per-seed SD | N for 80% power |
|---|---|---|---|---|
| default: E_on (predator minus none, risk learning on) | 0.009 [-0.005, 0.022] | 64 | 0.057 | 65 |
| default: interaction I | 0.001 [-0.011, 0.014] | 64 | 0.051 | 51 |
| direct: E_on (predator minus none, risk learning on) | 0.010 [-0.005, 0.024] | 64 | 0.060 | 70 |
| direct: interaction I | 0.000 [0.000, 0.000] | 64 | 0.000 | 0 |
| gene: E_on (predator minus none, risk learning on) | 0.015 [-0.000, 0.030] | 64 | 0.062 | 77 |
| gene: interaction I | 0.000 [0.000, 0.000] | 64 | 0.000 | 0 |

| condition | extinct | undefined S |
|---|---|---|
| none|on | 0/64 | 0 |
| none|off | 0/64 | 0 |
| default|on | 0/64 | 0 |
| default|off | 0/64 | 0 |
| direct|on | 1/64 | 0 |
| direct|off | 1/64 | 0 |
| gene|on | 0/64 | 0 |
| gene|off | 0/64 | 0 |
