# Guardrail evals

Every endpoint in this app makes a specific honesty claim: `/extract` never
invents a dollar figure or a day count that isn't in the source text; `/ask`
and `/code-search` refuse rather than guess when the answer isn't grounded in
what they were given; `/aggregate`, `/diff`, and `/risk-report` never
reference an id that wasn't in their own input. Those claims are stated in
the README and in every system prompt in `backend/main.py` — this is a small
suite of adversarial requests against the real, running backend that turns
each claim into a deterministic, code-checked assertion instead of leaving it
as a claim.

## Why this is separate from `bench/`

[`bench/`](../bench/README.md) (PunchBench) tests the *extraction quality* of
a small local model (`llava:7b` via Ollama) in an overnight, self-improving,
zero-cost loop — its whole point is that it costs nothing and needs no API
key, so it can run unattended.

This tests something different: whether the **actual deployed endpoints**
(Claude-backed, fixed prompts — nothing here is being optimized) keep the
promises made about them. That requires calling the real Anthropic API, so it
needs a real key and costs a small amount to run — a fair trade for testing
what's actually deployed instead of a local surrogate.

Both use the same philosophy as [`bench/scorer.py`](../bench/scorer.py): no
LLM judge. A claim about JSON shape — a field is `null`, an id is a member of
a known set, a quoted string is a literal substring of text that was sent —
is either true or false, checked in plain Python.

## What's checked (11 cases across 6 endpoints)

| Endpoint | Guarantee |
|---|---|
| `/extract` | Leaves `co_cost_amount` / `co_schedule_impact_days` `null` when the message doesn't state them — and correctly captures them when it does (a positive control, so "always null" can't pass by accident). |
| `/ask` | Returns `grounded: false` with no citations for a question the context can't answer; returns `grounded: true` with citations that are real context ids for one it can. |
| `/code-search` | Returns `grounded: false` for a question outside the sent corpus; for one inside it, every citation's `quote` is verified as a literal substring of the section text this script sent — not a paraphrase. |
| `/aggregate` | Every `source_photos` reference is a real `(photo_id, item_id)` pair from the input, **and** every input item is covered by exactly one output item — nothing invented, nothing silently dropped. |
| `/diff` | Every id in `closed`/`persistent`/`new` is a real input id, **and** every input id is accounted for in exactly one bucket. |
| `/risk-report` | Every `reference_ids` entry is a real input item id. |

## Run it

```bash
# backend must be running locally
uvicorn backend.main:app --reload

# from the repo root
pip install httpx  # if not already installed (ships with the anthropic SDK)
python evals/guardrails.py --api-key sk-ant-...
# or: export ANTHROPIC_API_KEY=sk-ant-... && python evals/guardrails.py
```

Prints a `[PASS]`/`[FAIL]` line per case and writes `evals/REPORT.md`. Exits
`0` only if all cases pass — safe to wire into CI as a regression gate on the
system prompts in `backend/main.py`.

## Honest limitations

- 11 cases is a starting set covering each stated guarantee once (twice for
  `/extract`, `/ask`, `/code-search`, `/aggregate`, `/diff`, since those need
  both a negative and positive control) — not exhaustive adversarial coverage.
  A larger, more varied case set (multiple phrasings, edge cases like a
  change order stating a cost *range* rather than a figure) would be the
  natural next step, the same honest gap `bench/README.md` names for its own
  ground truth set.
- Costs a small amount per run (11 short, mostly text-only Claude calls) —
  not free, unlike `bench/`. That's the deliberate trade for testing the real
  deployed endpoints instead of a local stand-in.
- Non-deterministic at the margin: the model samples, so a case that's
  normally a clean pass could occasionally fail on a given run even with the
  guardrail prompt unchanged. A single fresh failure is worth re-running once
  before treating it as a regression.
