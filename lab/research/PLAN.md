# Plan: the lab as a research portfolio piece

Target: Anthropic Fellows application, January cohort, due 2026-10-18.
Audience: safety researchers reading a portfolio. They care about the quality of the
question, the rigour of the method, and honesty about what was done and by whom.

## The piece

**Title (working):** *Selecting for the wrong trait: specification gaming in a
recipe-free artificial-life world.*

**Headline result (from the pilot, to be confirmed at scale):** a predator added to
select for caution selected for boldness instead. Cautious creatures fled and sheltered
more, foraged less, and had fewer children. The pressure was real; it just pointed at a
proxy. We then ask what it takes to make the pressure land on the intended trait.

**Supporting results (already measured, to be re-run at scale):**
- A practice (feeding a fire) is learned from experience, spreads only by watching,
  and outlives its discoverer and all founders.
- Knowledge travels only by contact: an isolated creature never acquires it.
- Children inherit how they learn, not what they know; culture has to be passed on.

**Optional capstone (days 4-5, if the rest is solid):** an LLM as Keeper. A model gets
a stated goal ("keep the colony safe and thriving; be kind") and a small budget of
interventions, and we measure what it actually optimises.

## Timeline

| Day | Date | Work |
|---|---|---|
| 1 | Oct 11 | Plan and pre-registration committed before any new runs. Parallel harness (worker threads), 64 seeds per condition, bootstrap CIs, tables and SVG figures from one command. Fix known confounds. Run H1-H3. |
| 2 | Oct 12 | Mechanism of the boldness result (per-individual caution vs offspring). Predator variant that targets careless behaviour (H3b). Ablations: no watching, no memory, no breeding. |
| 3 | Oct 13 | Report draft with figures. Decision log: Nate's calls, in order, with what they changed. |
| 4 | Oct 14 | LLM-as-Keeper harness (needs an API key and a small budget). |
| 5 | Oct 15 | Run the Keeper study; write it up, including what the model did that we did not ask for. |
| 6 | Oct 16 | Repo tidy, README for a reader who has never seen it, portfolio text, demo captures from the 3D view. |
| 7 | Oct 17 | Buffer. Final read-through as a reviewer. |

## Deliverables

- `lab/research/PREREGISTRATION.md`: hypotheses, predictions, methods and analysis,
  committed before the confirmatory runs.
- `lab/research/run.mjs`: one command that runs every experiment and writes
  `lab/research/results/` (JSON, markdown tables, SVG figures).
- `lab/research/REPORT.md`: six to eight pages, figures included, with a limitations
  section and a plain statement of how the work was built.
- `lab/research/DECISIONS.md`: the decision log.
- A public repository (needs Nate to create it and push).

## What Nate needs to provide

- Confirmation of the Oct 18 date.
- For the Keeper study: an Anthropic API key and a budget ceiling.
- A GitHub repository to publish to, when the report is ready.
- His own words for the "how I directed this" section; the log will be drafted from
  the thread, he edits.

## Honesty note

The code in this repository was written by an AI agent (Claude) under Nate's
direction. The research questions, the judgment calls recorded in DECISIONS.md, and
the final editorial choices are his. The report says this plainly.
