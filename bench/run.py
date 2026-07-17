"""PunchBench: an overnight, self-improving eval loop for the punch-list prompt.

Fully local and free — uses Ollama (llava:7b for extraction, llama3.2:3b to
propose prompt edits from failures). No Anthropic API calls, no cost.

Each generation:
  1. Run the current prompt (bench/prompts/vN.txt) over every sample photo.
  2. Score deterministically against bench/data/ground_truth.json (no LLM judge).
  3. Log the metrics (resumable: bench/results/log.jsonl).
  4. Ask the text model to propose an improved prompt (vN+1.txt) from the failures.

Resumable: re-running picks up from the last completed generation. Extractions
are cached per (prompt content hash, photo) so a resume never re-calls the model
for work already done. Stop early by creating bench/STOP.

Usage:
  python bench/run.py                      # run until MAX_GENERATIONS or STOP
  python bench/run.py --max-generations 3  # smoke test: a few short generations
  python bench/run.py --report-only        # just regenerate REPORT.md from the log
"""

import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from ollama_client import extract_punch_list, propose_prompt  # noqa: E402
from scorer import aggregate, failure_summary, score_photo  # noqa: E402

BENCH_DIR = Path(__file__).parent
PHOTOS_DIR = BENCH_DIR.parent / "frontend" / "public" / "samples"
PROMPTS_DIR = BENCH_DIR / "prompts"
RESULTS_DIR = BENCH_DIR / "results"
CACHE_DIR = RESULTS_DIR / "cache"
LOG_PATH = RESULTS_DIR / "log.jsonl"
STOP_PATH = BENCH_DIR / "STOP"
MAX_GENERATIONS_DEFAULT = 15


def load_ground_truth() -> dict:
    data = json.loads((BENCH_DIR / "data" / "ground_truth.json").read_text(encoding="utf-8"))
    return {p["id"]: p for p in data["photos"]}


def latest_prompt_version(ground_truth: dict) -> int:
    versions = sorted(int(p.stem[1:]) for p in PROMPTS_DIR.glob("v*.txt") if p.stem[1:].isdigit())
    return versions[-1] if versions else 0


def prompt_hash(text: str) -> str:
    return hashlib.sha1(text.encode()).hexdigest()[:10]


def cached_extract(photo_path: Path, prompt: str) -> dict:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    key = f"{prompt_hash(prompt)}_{photo_path.stem}"
    cache_file = CACHE_DIR / f"{key}.json"
    if cache_file.exists():
        return json.loads(cache_file.read_text(encoding="utf-8"))
    result = extract_punch_list(photo_path, prompt)
    cache_file.write_text(json.dumps(result, indent=2), encoding="utf-8")
    return result


def run_generation(generation: int, ground_truth: dict) -> dict:
    prompt_path = PROMPTS_DIR / f"v{generation}.txt"
    prompt = prompt_path.read_text(encoding="utf-8")

    scores = []
    predictions = {}
    for photo_id, photo_gt in ground_truth.items():
        photo_path = PHOTOS_DIR / photo_gt["file"]
        result = cached_extract(photo_path, prompt)
        predictions[photo_id] = result
        scores.append(score_photo(photo_gt, result["parsed"]))

    metrics = aggregate(scores)
    entry = {
        "generation": generation,
        "prompt_file": prompt_path.name,
        "prompt_hash": prompt_hash(prompt),
        "timestamp": time.time(),
        "metrics": metrics,
        "per_photo": [
            {
                "photo_id": s.photo_id,
                "schema_valid": s.schema_valid,
                "recall": s.recall,
                "findings_hit": s.findings_hit,
                "findings_total": s.findings_total,
                "false_positives": s.false_positives,
                "missed": s.missed,
                "error": predictions[s.photo_id].get("error"),
            }
            for s in scores
        ],
    }
    with LOG_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")

    return {"entry": entry, "scores": scores}


def already_ran(generation: int) -> dict | None:
    if not LOG_PATH.exists():
        return None
    for line in LOG_PATH.read_text(encoding="utf-8").splitlines():
        entry = json.loads(line)
        if entry["generation"] == generation:
            return entry
    return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-generations", type=int, default=MAX_GENERATIONS_DEFAULT)
    parser.add_argument("--report-only", action="store_true")
    args = parser.parse_args()

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    if args.report_only:
        from report import write_report  # noqa: PLC0415

        write_report()
        return

    ground_truth = load_ground_truth()
    STOP_PATH.unlink(missing_ok=True)

    best_composite = -1.0
    best_generation = 1
    start_gen = latest_prompt_version(ground_truth) or 1

    print(f"PunchBench starting at generation {start_gen} (max {args.max_generations})")

    for generation in range(start_gen, args.max_generations + 1):
        if STOP_PATH.exists():
            print(f"STOP file found — halting before generation {generation}.")
            break

        cached = already_ran(generation)
        if cached:
            print(f"[gen {generation}] already logged (resume) — composite={cached['metrics']['composite']:.3f}")
            result = {"entry": cached}
        else:
            t0 = time.time()
            result = run_generation(generation, ground_truth)
            elapsed = time.time() - t0
            m = result["entry"]["metrics"]
            print(
                f"[gen {generation}] recall={m['recall']:.2f} "
                f"schema_valid={m['schema_valid_rate']:.2f} "
                f"fp/photo={m['false_positives_per_photo']:.2f} "
                f"composite={m['composite']:.3f} ({elapsed:.0f}s)"
            )

        composite = result["entry"]["metrics"]["composite"]
        if composite > best_composite:
            best_composite = composite
            best_generation = generation

        if generation >= args.max_generations:
            break

        next_prompt_path = PROMPTS_DIR / f"v{generation + 1}.txt"
        if next_prompt_path.exists():
            continue  # already proposed in a previous run — resume reuses it

        scores = result.get("scores")
        if scores is None:
            # Re-derive scores from the cache when resuming from the log alone.
            scores = []
            prompt = (PROMPTS_DIR / f"v{generation}.txt").read_text(encoding="utf-8")
            for photo_id, photo_gt in ground_truth.items():
                pred = cached_extract(PHOTOS_DIR / photo_gt["file"], prompt)
                scores.append(score_photo(photo_gt, pred["parsed"]))

        summary = failure_summary(scores, ground_truth)
        current_prompt = (PROMPTS_DIR / f"v{generation}.txt").read_text(encoding="utf-8")
        print(f"[gen {generation}] proposing v{generation + 1} from failures:\n{summary}")

        new_prompt = propose_prompt(current_prompt, summary)
        if not new_prompt:
            print(f"[gen {generation}] optimizer failed to respond — reusing current prompt as v{generation + 1}.")
            new_prompt = current_prompt
        next_prompt_path.write_text(new_prompt, encoding="utf-8")

    print(f"\nBest generation so far: v{best_generation} (composite={best_composite:.3f})")

    from report import write_report  # noqa: PLC0415

    write_report()
    print(f"Report written to {BENCH_DIR / 'REPORT.md'}")


if __name__ == "__main__":
    main()
