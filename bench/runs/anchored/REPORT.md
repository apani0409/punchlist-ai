# PunchBench Report

An overnight, self-improving evaluation loop for the PunchList AI prompt.
Runs entirely locally with Ollama (`llava:7b` for extraction, `llama3.2:3b`
to propose prompt edits from failures) — no API cost.

**Generations run:** 15  ·  **Best:** v11 (composite 0.434)

## Metrics by generation

| Gen | Recall | Schema valid | FP / photo | Severity acc. | Composite |
|---|---|---|---|---|---|
| v1 | 0.22 | 1.00 | 1.00 | 0.50 | 0.192 |
| v2 | 0.11 | 0.67 | 1.33 | 1.00 | 0.034 |
| v3 | 0.22 | 1.00 | 2.00 | 1.00 | 0.162 |
| v4 | 0.44 | 1.00 | 0.67 | 1.00 | 0.424 |
| v5 | 0.33 | 1.00 | 1.00 | 1.00 | 0.303 |
| v6 | 0.33 | 1.00 | 0.67 | 0.67 | 0.313 |
| v7 | 0.22 | 1.00 | 1.67 | 0.50 | 0.172 |
| v8 | 0.44 | 1.00 | 0.67 | 1.00 | 0.424 |
| v9 | 0.33 | 1.00 | 1.33 | 1.00 | 0.293 |
| v10 | 0.33 | 1.00 | 0.33 | 0.67 | 0.323 |
| v11 🏆 | 0.44 | 1.00 | 0.33 | 0.75 | 0.434 |
| v12 | 0.33 | 1.00 | 1.00 | 1.00 | 0.303 |
| v13 | 0.33 | 1.00 | 1.33 | 1.00 | 0.293 |
| v14 | 0.11 | 1.00 | 2.00 | 1.00 | 0.051 |
| v15 | 0.22 | 1.00 | 1.33 | 1.00 | 0.182 |

## Per-photo detail (latest generation)

- **cracked-wall** ✅ — 0/3 findings, 2 false positives, missed: crack, displaced-unit, debris-walkway
- **basement-wiring** ✅ — 1/3 findings, 1 false positives, missed: pipe-insulation, unfinished-wall
- **water-damage-ceiling** ✅ — 1/3 findings, 1 false positives, missed: water-stain, drywall-damage

## Best prompt (v11)

```
---
---
You are a meticulous construction site inspector generating punch lists.

Given a photo of a construction site or building interior/exterior, identify visible defects, unfinished work, safety issues, and potential hazards that could impact quality or occupancy.

Rules:
- Only report what is actually visible in the photo. Never invent issues.
- If the photo does not depict a construction/building scene, return an empty items list with a scene summary indicating it's not a construction site.
- Location must be described using textual references (e.g. "ceiling, center-right", "paver unit at top of wall").
- Severity levels are as follows:
  - High: Safety hazards or issues that block occupancy
  - Medium: Issues requiring correction before handover to clients
  - Low: Cosmetic defects

Respond with ONLY a JSON object:
{
  "scene_summary": "one or two sentences",
  "items": [
    {
      "id": 1,
      "title": "short issue name",
      "description": "what is wrong and why it matters",
      "location_in_photo": "textual location",
      "trade": "electrical|plumbing|drywall|paint|concrete|carpentry|safety|general",
      "severity": "low|medium|high",
      "recommended_action": "what to do about it"
    }
  ]
}
```

## Notes

- Scoring is deterministic keyword+trade matching against a hand-labeled
  ground truth (`bench/data/ground_truth.json`) — no LLM judge, so the
  numbers are fully reproducible.
- The extraction model (`llava:7b`) runs on CPU with no GPU on this machine,
  so early generations often produce invalid JSON or miss findings. The
  point of the harness is the improvement loop, not this small model's
  raw accuracy — the production app uses Claude, which scores far higher.
