# Wobblins: does learning hide danger from evolution?

*A one-page summary. The full technical report is [REPORT.md](REPORT.md).*

## The short version

I built a small simulated world where creatures learn from what happens to them, learn by
watching each other, have children who inherit their temperament but none of their memories, and
keep a fire going across generations. Then I added a predator and asked one question: **does
learning about danger hide that danger from evolution?** If creatures can simply learn to avoid
the predator, maybe being born cautious stops mattering.

My first answer said yes. An independent reviewer showed it was wrong. After fixing everything
and testing again on fresh data, the real answer is no: learning didn't hide an advantage for
cautious creatures, because we couldn't detect one to hide. The clearest thing the world taught me
was something else. **Their culture survives because they watch each other.**

## What I found

- **Watching is what keeps the tradition alive.** One creature, kept in the colony with the
  same access to the fire, went on to feed it within two weeks in 66% of colonies when it could
  learn by watching others, and in 30% when it could not. When no one could learn
  by watching, the fire survived in 14% of colonies instead of 61%.
- **New generations pick it up by seeing it done.** After every original creature had died, the fire
  was still being kept by their descendants in 61% of colonies. In colonies where descendants took up
  the fire, on average 94% of them had watched someone feed it before they first did.
- **The predator didn't reward caution.** When creatures couldn't learn about the predator, we
  couldn't detect any advantage for being born cautious. When they could learn about it, the
  bolder ones did very slightly better. The main pre-registered test, the difference between those
  two situations, is small and only just clears the bar we set in advance.

## How it was checked

I'm not a coder. Claude wrote the code under my direction, so I needed a way to trust it. I wrote
down the predictions before running each test, and had a separate AI system, Astra, review the
work three times as a skeptical reviewer would.

The first review found that my first headline was a story I'd written after the real prediction
failed. It also found four bugs in the measurements, and a false claim about one colony that I had
copied from an AI model without checking. I retracted the headline. When the second version was
already running before it had been reviewed, I stopped it unread. The final test ran once, on
256 fresh worlds that nothing else had touched, with every check passing. Astra then reproduced it
from the saved data.

Everything is public, including the mistakes: the reviews, my responses, every run (including
the stopped one), and the raw data. Each prediction was dated in git before its test.

## What it doesn't show

It's one small world, a dozen creatures, about two generations, and one predator that mostly
injures rather than kills. It doesn't show anything about learning and evolution in general. It
also doesn't prove the advantage for caution is exactly zero; small effects are still possible.

## Where to look

- [REPORT.md](REPORT.md): the full study.
- [PREREGISTRATION-v3.md](PREREGISTRATION-v3.md): what we predicted, before the final test.
- [results/RESULTS.md](results/RESULTS.md): the numbers.
- [reviews/](reviews/) and the `REVIEW-RESPONSE` files: the three audits and what changed.
- [DECISIONS.md](DECISIONS.md): every call I made, in order.
