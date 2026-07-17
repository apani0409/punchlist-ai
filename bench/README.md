# PunchBench

An overnight, self-improving evaluation loop for the PunchList AI prompt — runs
entirely locally with [Ollama](https://ollama.com), no API key, no cost.

## Why

Calling a vision model is the easy part. The hard part — the part that actually
matters in production — is *measuring* whether the model is any good, and
*improving it* from that measurement without a human rewriting the prompt by
hand every time. PunchBench is a small harness that does exactly that: it runs
the extraction prompt against a hand-labeled set of construction photos, scores
it deterministically (no LLM judge), and lets a second, smaller model propose a
better prompt from the specific failures observed. Left running overnight, it
produces a report showing the prompt improving generation over generation.

## How it works

```
prompts/v1.txt  ──►  llava:7b extracts a punch list per sample photo
                                │
              bench/data/ground_truth.json (hand-labeled)
                                │
                  deterministic scorer (scorer.py)
             recall · schema validity · false positives · severity
                                │
                 llama3.2:3b proposes an improved prompt
                    from a failure summary (see "anchoring" below)
                                │
                         prompts/v2.txt  ──► repeat
```

- **Extraction:** `llava:7b` (local vision model, CPU — this machine has no GPU,
  so it's slow but free and unattended-safe).
- **Scoring:** deterministic keyword + trade matching against `ground_truth.json`.
  No LLM-as-judge, so results are reproducible given a fixed model output (the
  extraction model itself still samples at `temperature=0.2`, so re-running an
  identical prompt can vary slightly).
- **Optimization:** `llama3.2:3b` (small local text model) rewrites the prompt
  given a plain-English summary of what it missed.
- **Resumable:** every extraction is cached by `(prompt hash, photo)` inside
  each run's own `results/cache/`, and generations are logged to
  `results/log.jsonl` as they complete. Interrupting and re-running picks up
  exactly where it left off — nothing is recomputed.

## Two anchoring strategies — and a real finding

The optimizer needs a "current prompt + its failures" to edit from. There are
two reasonable choices for *which* prompt that is, and they behave very
differently:

- **`latest`** (naive hill-climbing): edit whatever was just tried, using its
  own failures. If a generation drifts to a worse prompt, the *next* edit
  builds on that worse prompt too — nothing pulls it back toward what worked.
- **`best`** (elitist hill-climbing, the default): edit the best-known prompt
  so far, using *its* failures, every time. A bad generation can never drag the
  next candidate down with it, because the next candidate always starts from
  the incumbent best.

The first overnight run used `latest` and hit its peak at generation 2
(composite 0.414, recall 0.44), then **collapsed into a local optimum**:
generations 5 through 14 mostly plateaued around recall 0.11, never
re-approaching v2. See [`runs/original/REPORT.md`](runs/original/REPORT.md) for
the full, unedited curve — it's a genuine (if unglamorous) finding about
memoryless prompt optimization, not a harness bug, and it's the reason `best`
is now the default. The second run, using `best`, lives in
[`runs/anchored/REPORT.md`](runs/anchored/REPORT.md).

**Both runs peaked at almost the same score — the difference is what happens
after the peak**, which is the part that actually matters for an unattended
overnight loop:

| | Peak composite | Mean composite (all 15 gens) | Mean composite (gens 5–15, post-peak) |
|---|---|---|---|
| `latest` (original) | 0.414 (v2) | 0.115 | 0.063 |
| `best` (anchored) | 0.434 (v11) | 0.260 (2.3×) | 0.281 (4.5×) |

`latest` finds a good prompt just as fast as `best` does — the peak scores are
almost identical. What `latest` cannot do is *hold onto* that peak: once a
worse generation appears, it edits from the worse prompt, and the average
quality for the rest of the run collapses to roughly half the peak. `best`
never loses the peak, because every edit is anchored to the incumbent — the
post-peak average is essentially the same as the peak itself. Left running
overnight with no one watching, that difference is the whole point.

## Run it

```bash
# one short generation, to sanity-check the pipeline
python bench/run.py --run-dir bench/runs/anchored --anchor best --max-generations 1

# the real overnight run (PowerShell helper, logs to <run-dir>/results/overnight.log)
.\bench\run_overnight.ps1                                  # best-anchored, 15 generations
.\bench\run_overnight.ps1 -Anchor latest -RunDir bench\runs\original -MaxGenerations 15

# stop early at any time
New-Item bench\runs\anchored\STOP

# regenerate a run's report without running anything
python bench/run.py --run-dir bench/runs/anchored --report-only
```

Output: `<run-dir>/REPORT.md` — a metrics table by generation, per-photo detail
for the latest run, and the full text of the best-scoring prompt.

## Honest limitations

- `llava:7b` on CPU is a weak vision model compared to what the production app
  uses (Claude). Even the best generation misses real findings — that's
  expected, and it's exactly what gives the improvement loop something to
  climb. **The interesting artifact is the harness and the anchoring finding,
  not this small model's ceiling.**
- The ground truth covers 3 photos with a handful of hand-labeled findings
  each — enough to demonstrate the loop, not a rigorous benchmark. A larger,
  more diverse labeled set would be the natural next step.
- Scoring is keyword-based, so a correct finding phrased with unexpected
  vocabulary can be scored as a miss. This is a deliberate trade-off: it keeps
  scoring deterministic and free instead of spending API calls on an LLM judge.
- `best`-anchoring fixes the drift problem but is still a local search: it can
  still plateau if the optimizer runs out of distinct edits to try from the
  same incumbent. A natural next step would be occasional random restarts or
  keeping a small population of candidates instead of a single incumbent.
