# PunchBench Report

An overnight, self-improving evaluation loop for the PunchList AI prompt.
Runs entirely locally with Ollama (`llava:7b` for extraction, `llama3.2:3b`
to propose prompt edits from failures) — no API cost.

**Generations run:** 15  ·  **Best:** v2 (composite 0.414)

## Metrics by generation

| Gen | Recall | Schema valid | FP / photo | Severity acc. | Composite |
|---|---|---|---|---|---|
| v1 | 0.22 | 0.67 | 0.33 | 1.00 | 0.138 |
| v2 🏆 | 0.44 | 1.00 | 1.00 | 0.75 | 0.414 |
| v3 | 0.22 | 1.00 | 1.33 | 0.50 | 0.182 |
| v4 | 0.33 | 1.00 | 1.33 | 1.00 | 0.293 |
| v5 | 0.11 | 0.67 | 1.00 | 0.00 | 0.044 |
| v6 | 0.11 | 0.67 | 1.00 | 0.00 | 0.044 |
| v7 | 0.11 | 1.00 | 2.00 | 1.00 | 0.051 |
| v8 | 0.11 | 1.00 | 1.00 | 0.00 | 0.081 |
| v9 | 0.11 | 0.67 | 1.00 | 0.00 | 0.044 |
| v10 | 0.11 | 1.00 | 0.67 | 1.00 | 0.091 |
| v11 | 0.00 | 0.67 | 1.33 | — | -0.040 |
| v12 | 0.11 | 1.00 | 1.33 | 1.00 | 0.071 |
| v13 | 0.22 | 1.00 | 1.33 | 1.00 | 0.182 |
| v14 | 0.11 | 0.67 | 1.00 | 0.00 | 0.044 |
| v15 | 0.11 | 1.00 | 1.00 | 1.00 | 0.081 |

## Per-photo detail (latest generation)

- **cracked-wall** ✅ — 0/3 findings, 2 false positives, missed: crack, displaced-unit, debris-walkway
- **basement-wiring** ✅ — 0/3 findings, 0 false positives, missed: loose-cable, pipe-insulation, unfinished-wall
- **water-damage-ceiling** ✅ — 1/3 findings, 1 false positives, missed: water-stain, drywall-damage

## Best prompt (v2)

```
---
You are a meticulous construction site inspector generating punch lists.

Given a photo of a construction site or building interior/exterior, identify visible defects, unfinished work, and safety issues that can be seen from the provided image. For each issue produce a detailed punch list item with specific location in the photo.

Rules:
- Only report what is actually visible in the photo. Never invent issues.
- If the photo is not a construction/building scene, return an empty items list and state "No relevant defects or issues found" in scene_summary.
- Ensure location_in_photo is textual (e.g. "ceiling, center-right"), never coordinates.
- Specify severity: high = safety hazard or blocks occupancy; medium = must fix before handover; low = cosmetic.

Respond with ONLY a JSON object, no markdown fences, no extra text, matching exactly this shape:
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
