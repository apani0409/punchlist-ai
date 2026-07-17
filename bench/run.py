"""PunchBench: an overnight, self-improving eval loop for the punch-list prompt.

Fully local and free — uses Ollama (llava:7b for extraction, llama3.2:3b to
propose prompt edits from failures). No Anthropic API calls, no cost.

Each generation:
  1. Run the current candidate prompt over every sample photo.
  2. Score deterministically against bench/data/ground_truth.json (no LLM judge).
  3. Log the metrics (resumable: <run-dir>/results/log.jsonl).
  4. Ask the text model to propose an improved prompt from a failure summary.

Two anchoring strategies for step 4 (--anchor):
  latest  Edit the prompt that was just tried, using its own failures. This is
          plain hill-climbing with no memory: if a generation drifts to a worse
          prompt, the next edit builds on that worse prompt too, with nothing
          pulling it back. The first overnight run used this and got stuck in a
          local optimum from generation 5 onward (see runs/original/REPORT.md).
  best    Edit the best-known prompt so far, using ITS failures, every time.
          This is elitist hill-climbing: a bad generation can't drag the next
          candidate down with it, because the next candidate always starts from
          the incumbent best. Default, and the fix for the "latest" collapse.

Resumable: re-running picks up from the last completed generation. Extractions
are cached per (prompt content hash, photo) so a resume never re-calls the model
for work already done. Stop early by creating <run-dir>/STOP.

Usage:
  python bench/run.py --run-dir bench/runs/anchored --anchor best
  python bench/run.py --run-dir bench/runs/original --anchor latest --max-generations 1
  python bench/run.py --run-dir bench/runs/anchored --report-only
"""

import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from ollama_client import extract_punch_list, propose_prompt  # noqa: E402
from report import write_report  # noqa: E402
from scorer import PhotoScore, aggregate, failure_summary, score_photo  # noqa: E402

BENCH_DIR = Path(__file__).parent
PHOTOS_DIR = BENCH_DIR.parent / "frontend" / "public" / "samples"
MAX_GENERATIONS_DEFAULT = 15


def load_ground_truth() -> dict:
    data = json.loads((BENCH_DIR / "data" / "ground_truth.json").read_text(encoding="utf-8"))
    return {p["id"]: p for p in data["photos"]}


def prompt_hash(text: str) -> str:
    return hashlib.sha1(text.encode()).hexdigest()[:10]


class Run:
    """Bundles the file layout for one bench run so two runs never collide."""

    def __init__(self, run_dir: Path, seed_prompt: Path):
        self.dir = run_dir
        self.prompts_dir = run_dir / "prompts"
        self.results_dir = run_dir / "results"
        self.cache_dir = self.results_dir / "cache"
        self.log_path = self.results_dir / "log.jsonl"
        self.stop_path = run_dir / "STOP"

        self.prompts_dir.mkdir(parents=True, exist_ok=True)
        self.results_dir.mkdir(parents=True, exist_ok=True)
        v1 = self.prompts_dir / "v1.txt"
        if not v1.exists():
            v1.write_text(seed_prompt.read_text(encoding="utf-8"), encoding="utf-8")

    def prompt_path(self, generation: int) -> Path:
        return self.prompts_dir / f"v{generation}.txt"

    def latest_prompt_version(self) -> int:
        versions = sorted(
            int(p.stem[1:]) for p in self.prompts_dir.glob("v*.txt") if p.stem[1:].isdigit()
        )
        return versions[-1] if versions else 1

    def cached_extract(self, photo_path: Path, prompt: str) -> dict:
        key = f"{prompt_hash(prompt)}_{photo_path.stem}"
        cache_file = self.cache_dir / f"{key}.json"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        if cache_file.exists():
            return json.loads(cache_file.read_text(encoding="utf-8"))
        result = extract_punch_list(photo_path, prompt)
        cache_file.write_text(json.dumps(result, indent=2), encoding="utf-8")
        return result

    def scores_for_generation(self, generation: int, ground_truth: dict) -> list[PhotoScore]:
        prompt = self.prompt_path(generation).read_text(encoding="utf-8")
        scores = []
        for photo_id, photo_gt in ground_truth.items():
            pred = self.cached_extract(PHOTOS_DIR / photo_gt["file"], prompt)
            scores.append(score_photo(photo_gt, pred["parsed"]))
        return scores

    def logged_entries(self) -> list[dict]:
        if not self.log_path.exists():
            return []
        return [json.loads(line) for line in self.log_path.read_text(encoding="utf-8").splitlines()]

    def already_ran(self, generation: int) -> dict | None:
        for entry in self.logged_entries():
            if entry["generation"] == generation:
                return entry
        return None

    def best_entry(self) -> dict | None:
        entries = self.logged_entries()
        return max(entries, key=lambda e: e["metrics"]["composite"]) if entries else None

    def run_generation(self, generation: int, ground_truth: dict) -> dict:
        scores = self.scores_for_generation(generation, ground_truth)
        metrics = aggregate(scores)
        entry = {
            "generation": generation,
            "prompt_hash": prompt_hash(self.prompt_path(generation).read_text(encoding="utf-8")),
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
                }
                for s in scores
            ],
        }
        with self.log_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
        return entry


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-dir", type=Path, default=BENCH_DIR / "runs" / "anchored")
    parser.add_argument("--seed-prompt", type=Path, default=BENCH_DIR / "prompts" / "v1.txt")
    parser.add_argument("--anchor", choices=["latest", "best"], default="best")
    parser.add_argument("--max-generations", type=int, default=MAX_GENERATIONS_DEFAULT)
    parser.add_argument("--report-only", action="store_true")
    args = parser.parse_args()

    run = Run(args.run_dir, args.seed_prompt)

    if args.report_only:
        write_report(run.dir)
        return

    ground_truth = load_ground_truth()
    run.stop_path.unlink(missing_ok=True)

    start_gen = run.latest_prompt_version()
    print(f"PunchBench ({args.anchor}-anchored) starting at generation {start_gen} " f"(max {args.max_generations})")

    for generation in range(start_gen, args.max_generations + 1):
        if run.stop_path.exists():
            print(f"STOP file found — halting before generation {generation}.")
            break

        cached = run.already_ran(generation)
        if cached:
            print(f"[gen {generation}] already logged (resume) — composite={cached['metrics']['composite']:.3f}")
        else:
            t0 = time.time()
            entry = run.run_generation(generation, ground_truth)
            elapsed = time.time() - t0
            m = entry["metrics"]
            print(
                f"[gen {generation}] recall={m['recall']:.2f} "
                f"schema_valid={m['schema_valid_rate']:.2f} "
                f"fp/photo={m['false_positives_per_photo']:.2f} "
                f"composite={m['composite']:.3f} ({elapsed:.0f}s)"
            )

        if generation >= args.max_generations:
            break

        next_prompt_path = run.prompt_path(generation + 1)
        if next_prompt_path.exists():
            continue  # already proposed in a previous run — resume reuses it

        # Anchoring: "best" edits the incumbent best prompt using its own
        # failures, so a bad generation can never drag the next candidate down
        # with it. "latest" edits whatever was just tried (the naive, memoryless
        # strategy that got stuck in a local optimum in the original run).
        if args.anchor == "best":
            base_entry = run.best_entry()
            base_generation = base_entry["generation"]
        else:
            base_generation = generation

        base_prompt = run.prompt_path(base_generation).read_text(encoding="utf-8")
        base_scores = run.scores_for_generation(base_generation, ground_truth)
        summary = failure_summary(base_scores, ground_truth)
        print(f"[gen {generation}] proposing v{generation + 1} from v{base_generation}'s failures:\n{summary}")

        new_prompt = propose_prompt(base_prompt, summary)
        if not new_prompt:
            print(f"[gen {generation}] optimizer failed to respond — reusing v{base_generation} as v{generation + 1}.")
            new_prompt = base_prompt
        next_prompt_path.write_text(new_prompt, encoding="utf-8")

    best = run.best_entry()
    print(f"\nBest generation: v{best['generation']} (composite={best['metrics']['composite']:.3f})")

    write_report(run.dir)
    print(f"Report written to {run.dir / 'REPORT.md'}")


if __name__ == "__main__":
    main()
