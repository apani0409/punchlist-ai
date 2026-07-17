"""Deterministic scoring: no LLM judge, no extra cost, fully reproducible.

A predicted item "hits" a ground-truth finding when it reports the same trade
AND its title+description contains at least one of the finding's keywords.
"""

from dataclasses import dataclass, field

SEVERITY_RANK = {"low": 0, "medium": 1, "high": 2}


@dataclass
class PhotoScore:
    photo_id: str
    schema_valid: bool
    findings_total: int = 0
    findings_hit: int = 0
    false_positives: int = 0
    severity_ok: int = 0
    severity_checked: int = 0
    missed: list[str] = field(default_factory=list)

    @property
    def recall(self) -> float:
        return self.findings_hit / self.findings_total if self.findings_total else 1.0


def score_photo(ground_truth: dict, prediction: dict | None) -> PhotoScore:
    photo_id = ground_truth["id"]
    findings = ground_truth["findings"]
    score = PhotoScore(photo_id=photo_id, schema_valid=prediction is not None, findings_total=len(findings))

    if prediction is None:
        score.missed = [f["id"] for f in findings]
        return score

    items = prediction.get("items") if isinstance(prediction, dict) else None
    if not isinstance(items, list):
        score.schema_valid = False
        score.missed = [f["id"] for f in findings]
        return score

    matched_item_indices: set[int] = set()

    for finding in findings:
        hit = False
        for idx, item in enumerate(items):
            if not isinstance(item, dict):
                continue
            trade = str(item.get("trade", "")).lower()
            text = f"{item.get('title', '')} {item.get('description', '')}".lower()
            if trade != finding["trade"]:
                continue
            if any(kw.lower() in text for kw in finding["keywords"]):
                hit = True
                matched_item_indices.add(idx)
                # Severity check: predicted severity should be >= min_severity.
                sev = str(item.get("severity", "")).lower()
                if sev in SEVERITY_RANK:
                    score.severity_checked += 1
                    if SEVERITY_RANK[sev] >= SEVERITY_RANK[finding["min_severity"]]:
                        score.severity_ok += 1
                break
        if hit:
            score.findings_hit += 1
        else:
            score.missed.append(finding["id"])

    score.false_positives = max(0, len(items) - len(matched_item_indices))
    return score


def aggregate(scores: list[PhotoScore]) -> dict:
    total_findings = sum(s.findings_total for s in scores)
    total_hit = sum(s.findings_hit for s in scores)
    total_fp = sum(s.false_positives for s in scores)
    sev_checked = sum(s.severity_checked for s in scores)
    sev_ok = sum(s.severity_ok for s in scores)
    valid = sum(1 for s in scores if s.schema_valid)

    return {
        "photos": len(scores),
        "schema_valid_rate": valid / len(scores) if scores else 0.0,
        "recall": total_hit / total_findings if total_findings else 0.0,
        "findings_hit": total_hit,
        "findings_total": total_findings,
        "false_positives_total": total_fp,
        "false_positives_per_photo": total_fp / len(scores) if scores else 0.0,
        "severity_accuracy": sev_ok / sev_checked if sev_checked else None,
        # Single scalar to rank prompt versions by: recall matters most, schema
        # validity is a hard gate, false positives and bad severities are penalized lightly.
        "composite": (
            (total_hit / total_findings if total_findings else 0.0) * (valid / len(scores) if scores else 0.0)
            - 0.03 * (total_fp / len(scores) if scores else 0.0)
        ),
    }


def failure_summary(scores: list[PhotoScore], ground_truth_by_id: dict) -> str:
    """Turn misses into a short, concrete note for the prompt optimizer."""
    lines = []
    invalid = [s.photo_id for s in scores if not s.schema_valid]
    if invalid:
        lines.append(f"- Invalid/unparseable JSON output on: {', '.join(invalid)}.")

    miss_counts: dict[str, int] = {}
    for s in scores:
        for finding_id in s.missed:
            miss_counts[finding_id] = miss_counts.get(finding_id, 0) + 1

    for finding_id, count in sorted(miss_counts.items(), key=lambda kv: -kv[1]):
        note = None
        for photo in ground_truth_by_id.values():
            for f in photo["findings"]:
                if f["id"] == finding_id:
                    note = f["note"]
                    break
        lines.append(f"- Missed '{finding_id}' in {count} photo(s): {note}")

    high_fp = [s for s in scores if s.false_positives >= 3]
    if high_fp:
        lines.append(
            f"- Over-reporting (many extra/unmatched items) on: {', '.join(s.photo_id for s in high_fp)}."
        )

    return "\n".join(lines) if lines else "- No significant failures; only minor refinements possible."
