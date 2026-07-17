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
bench/prompts/v1.txt  ──►  llava:7b extracts a punch list per sample photo
                                        │
                    bench/data/ground_truth.json (hand-labeled)
                                        │
                          deterministic scorer (scorer.py)
                     recall · schema validity · false positives · severity
                                        │
                         llama3.2:3b proposes an improved prompt
                            from the specific failures observed
                                        │
                              bench/prompts/v2.txt  ──► repeat
```

- **Extraction:** `llava:7b` (local vision model, CPU — this machine has no GPU,
  so it's slow but free and unattended-safe).
- **Scoring:** deterministic keyword + trade matching against `ground_truth.json`.
  No LLM-as-judge, so results are fully reproducible and cost nothing to compute.
- **Optimization:** `llama3.2:3b` (small local text model) rewrites the prompt
  given a plain-English summary of what it missed.
- **Resumable:** every extraction is cached by `(prompt hash, photo)`, and
  generations are logged to `results/log.jsonl` as they complete. Interrupting
  and re-running picks up exactly where it left off — nothing is recomputed.

## Run it

```bash
# one short generation, to sanity-check the pipeline
python bench/run.py --max-generations 1

# the real overnight run (PowerShell helper, logs to bench/results/overnight.log)
.\bench\run_overnight.ps1 -MaxGenerations 15

# stop early at any time
New-Item bench\STOP

# regenerate the report from an existing log without running anything
python bench/run.py --report-only
```

Output: `bench/REPORT.md` — a metrics table by generation, per-photo detail
for the latest run, and the full text of the best-scoring prompt.

## Honest limitations

- `llava:7b` on CPU is a weak vision model compared to what the production app
  uses (Claude). Early generations often produce invalid JSON or miss obvious
  defects — that's expected, and it's exactly what gives the improvement curve
  something to climb. **The interesting artifact is the harness, not this
  small model's ceiling.**
- The ground truth covers 3 photos with a handful of hand-labeled findings
  each — enough to demonstrate the loop, not a rigorous benchmark. A larger,
  more diverse labeled set would be the natural next step.
- Scoring is keyword-based, so a correct finding phrased with unexpected
  vocabulary can be scored as a miss. This is a deliberate trade-off: it keeps
  scoring deterministic and free instead of spending API calls on an LLM judge.
