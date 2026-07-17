"""Thin client for the local Ollama server (free, no API key, no network cost)."""

import base64
import json
import re
from pathlib import Path

import requests

OLLAMA_URL = "http://localhost:11434/api/generate"
VISION_MODEL = "llava:7b"
TEXT_MODEL = "llama3.2:3b"


def _extract_json(raw: str) -> dict | None:
    """Local vision models rarely emit clean JSON. Try progressively looser parses."""
    raw = raw.strip()
    # Strip markdown fences if present.
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.MULTILINE).strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    # Fall back to the first {...} block found (models often add chatter around it).
    match = re.search(r"\{.*\}", raw, flags=re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
    return None


def extract_punch_list(photo_path: Path, prompt: str, timeout: int = 180) -> dict:
    """Run the vision model on one photo with the given prompt.

    Returns {"raw": str, "parsed": dict | None, "error": str | None}.
    Never raises — extraction failures are data for the scorer, not exceptions.
    """
    image_b64 = base64.b64encode(photo_path.read_bytes()).decode("ascii")
    try:
        resp = requests.post(
            OLLAMA_URL,
            json={
                "model": VISION_MODEL,
                "prompt": prompt,
                "images": [image_b64],
                "stream": False,
                "options": {"temperature": 0.2},
            },
            timeout=timeout,
        )
        resp.raise_for_status()
        raw = resp.json().get("response", "")
    except Exception as e:  # noqa: BLE001 — any failure is a scored miss, not a crash
        return {"raw": "", "parsed": None, "error": f"{type(e).__name__}: {e}"}

    parsed = _extract_json(raw)
    return {"raw": raw, "parsed": parsed, "error": None if parsed else "json_parse_failed"}


def propose_prompt(current_prompt: str, failure_summary: str, timeout: int = 120) -> str | None:
    """Ask the (small, fast) text model to rewrite the prompt given observed failures."""
    meta_prompt = f"""You are improving a system prompt for a small local vision model that
extracts construction-site punch lists as JSON. The model currently makes these mistakes:

{failure_summary}

Current prompt:
---
{current_prompt}
---

Rewrite the prompt to reduce these specific mistakes. Keep the required JSON shape
identical (same field names, same enums for trade/severity) — only change wording,
add emphasis, add short examples, or clarify instructions. The model is small and
literal, so be concrete and repeat critical constraints if needed.

Reply with ONLY the new prompt text, nothing else — no preamble, no explanation."""

    try:
        resp = requests.post(
            OLLAMA_URL,
            json={
                "model": TEXT_MODEL,
                "prompt": meta_prompt,
                "stream": False,
                "options": {"temperature": 0.4},
            },
            timeout=timeout,
        )
        resp.raise_for_status()
        text = resp.json().get("response", "").strip()
        return text if text else None
    except Exception:  # noqa: BLE001
        return None
