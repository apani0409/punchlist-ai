"""Renders bench/results/log.jsonl into a human-readable bench/REPORT.md."""

import json
from pathlib import Path

BENCH_DIR = Path(__file__).parent
LOG_PATH = BENCH_DIR / "results" / "log.jsonl"
PROMPTS_DIR = BENCH_DIR / "prompts"
REPORT_PATH = BENCH_DIR / "REPORT.md"


def write_report() -> None:
    if not LOG_PATH.exists():
        REPORT_PATH.write_text("# PunchBench Report\n\nNo runs logged yet.\n", encoding="utf-8")
        return

    entries = [json.loads(line) for line in LOG_PATH.read_text(encoding="utf-8").splitlines()]
    entries.sort(key=lambda e: e["generation"])

    best = max(entries, key=lambda e: e["metrics"]["composite"])

    lines = [
        "# PunchBench Report",
        "",
        "An overnight, self-improving evaluation loop for the PunchList AI prompt.",
        "Runs entirely locally with Ollama (`llava:7b` for extraction, `llama3.2:3b`",
        "to propose prompt edits from failures) — no API cost.",
        "",
        f"**Generations run:** {len(entries)}  ·  **Best:** v{best['generation']} "
        f"(composite {best['metrics']['composite']:.3f})",
        "",
        "## Metrics by generation",
        "",
        "| Gen | Recall | Schema valid | FP / photo | Severity acc. | Composite |",
        "|---|---|---|---|---|---|",
    ]

    for e in entries:
        m = e["metrics"]
        sev = f"{m['severity_accuracy']:.2f}" if m["severity_accuracy"] is not None else "—"
        marker = " 🏆" if e["generation"] == best["generation"] else ""
        lines.append(
            f"| v{e['generation']}{marker} | {m['recall']:.2f} | {m['schema_valid_rate']:.2f} | "
            f"{m['false_positives_per_photo']:.2f} | {sev} | {m['composite']:.3f} |"
        )

    lines += [
        "",
        "## Per-photo detail (latest generation)",
        "",
    ]
    latest = entries[-1]
    for p in latest["per_photo"]:
        status = "✅" if p["schema_valid"] else "❌ invalid JSON"
        missed = ", ".join(p["missed"]) if p["missed"] else "none"
        lines.append(
            f"- **{p['photo_id']}** {status} — {p['findings_hit']}/{p['findings_total']} findings, "
            f"{p['false_positives']} false positives, missed: {missed}"
        )

    best_prompt_path = PROMPTS_DIR / f"v{best['generation']}.txt"
    lines += [
        "",
        f"## Best prompt (v{best['generation']})",
        "",
        "```",
        best_prompt_path.read_text(encoding="utf-8").strip() if best_prompt_path.exists() else "(not found)",
        "```",
        "",
        "## Notes",
        "",
        "- Scoring is deterministic keyword+trade matching against a hand-labeled",
        "  ground truth (`bench/data/ground_truth.json`) — no LLM judge, so the",
        "  numbers are fully reproducible.",
        "- The extraction model (`llava:7b`) runs on CPU with no GPU on this machine,",
        "  so early generations often produce invalid JSON or miss findings. The",
        "  point of the harness is the improvement loop, not this small model's",
        "  raw accuracy — the production app uses Claude, which scores far higher.",
    ]

    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    write_report()
