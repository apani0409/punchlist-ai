# PunchList AI 🏗️

**Construction site photos → a tracked, structured punch list — from one photo to a whole project.**

Upload photos of a construction site and get back structured punch list items: each visible defect with its location, responsible trade, severity, and recommended action. v1 did this for a single photo; this branch (**v2**) turns it into a platform — batches of photos consolidated into one project, inspection rounds compared over time, an honest metrics dashboard, and a schematic 3D digital twin.

**Live demo (v1):** https://punchlist-ai-five.vercel.app *(three pre-analyzed sample photos, no API key needed)*
**v2 preview:** the `v2` branch deploys its own Vercel preview automatically — the production URL above is untouched.

## Why I built this

I recently applied to [Gaudi AI](https://heygaudi.ai), whose mission is bringing AI to the physical world through construction workflow automations — punch lists among them. After applying, I wanted to show rather than tell, so I built this working slice of that idea in a weekend: a vision language model turned into a practical construction tool. v2 extends that into a small platform, built the same way — fast, honestly, with the model doing what it's actually good at.

> **Not affiliated with Gaudi AI.** This is an independent demo inspired by the public description of their product space. It is not a substitute for professional inspection.

## Two ways to use it

**Quick analyze** (`/quick`) — the original v1 flow, unchanged: one photo in, one punch list out, pre-analyzed samples so it costs nothing to explore.

**Projects** (`/`) — the v2 flow: create a project, drop in a batch of photos, and PunchList AI analyzes each one, then consolidates the findings into a single project-level list.

```
N photos ──► /analyze (per photo, forced tool call) ──► /aggregate (consolidate,
                                                          dedupe, merge duplicates)
                                                                │
                round 2 photos ──► /analyze ──► /aggregate ──► /diff (vs round 1:
                                                          closed / persistent / new)
                                                                │
                                                                ▼
                    project dashboard (honest metrics) · digital twin (where things are)
```

A pre-seeded demo project ships with the app (two inspection rounds, a real diff, real dashboard numbers) so the whole platform is explorable with zero API key.

## Design decisions carried from v1, still true in v2

- **Structured output via forced tool calls** on every endpoint (`/analyze`, `/aggregate`, `/diff`) — the model must answer through a JSON-schema-constrained tool. No regex parsing, no malformed JSON.
- **BYO API key**, forwarded per-request, never stored or logged.
- **Prompted against hallucination**, and where the model's answer references other data (which photos a finding came from, which round's items map to which), the client **validates every id it returns** and falls back to a deterministic heuristic if the call fails — the pipeline never dead-ends on a bad model response.

## v2: what's new

- **Multi-photo projects.** Batch upload with per-photo progress and retry; `POST /aggregate` merges duplicate defects seen across photos into one project-level list, normalizes locations, and keeps the worst severity when merging.
- **Inspection rounds + diff.** Start a new round anytime; `POST /diff` compares it against the previous round and classifies every item as **closed**, **persistent**, or **new** — the platform's answer to "what changed since last time."
- **Traceability.** Every consolidated item links back to the photo(s) it came from — click a thumbnail to see the full photo. Nothing is a black box.
- **An honest dashboard.** Open items, high-severity count, safety-open count, closure rate, and a severity-weighted risk score — every figure derived from real round/item data, each with a round-over-round delta. **No SPI/CPI, no synthetic figures, no percent-complete.** Deriving real earned-value metrics from photos alone would mean inventing numbers; a construction-industry audience notices immediately. What v2 shows is only what's actually measurable from inspection data — a smaller, truthful claim.
- **A digital twin** (`/project/:id/twin`) — a schematic, procedurally-generated 3D building (no downloaded model, no licensing concerns), with markers at each photo's location colored by its worst open severity. Click a marker to see its findings; click "Place" on any unplaced photo to set its position by clicking the model. **This is a placeholder for spatial context, not a survey-accurate model.**
- **Persistence stays in the browser** (IndexedDB) — the backend remains a stateless analysis service with zero new infrastructure. Photos never touch a server for storage, only for analysis.

## Where this sits in the construction-AI landscape

A useful way to think about AI in civil engineering is four phases: **Predict** (classical ML on tabular data), **Perceive** (computer vision on images/point clouds), **Generate** (LLMs synthesizing structured output from unstructured input), and **Reason & Act** (autonomous agents). Here's what PunchList AI v2 actually does in that frame, and what's deliberately left as roadmap:

| Phase | What v2 does | What's roadmap (not built) |
|---|---|---|
| **Perceive** | `/analyze` uses a **general-purpose VLM (Claude vision)**, not a defect-specific CNN/YOLO model. One zero-shot model replaces training N specialized detectors, and sidesteps the "scarce labeled defect data" problem entirely — no training set needed. | Real-time video/CCTV monitoring; a trained defect-classification model for cases where a general VLM underperforms a specialist. |
| **Generate** | `/aggregate` and `/diff` are exactly this phase: LLMs turning unstructured, multi-source findings into a prioritized, deduplicated structured record. | — |
| **Reason & Act** | [`bench/`](bench/) (PunchBench) is a small autonomous loop: it runs the extraction prompt overnight, scores it deterministically against ground truth, and has a second model propose improvements from the failures — a working (if small) example of an agent that "detects issues while you sleep." | A field-deployed agent that watches a live project and proactively flags risk, rather than one that improves an offline eval. |
| **Predict / EVM** | Nothing — deliberately. | Real schedule/cost tracking (SPI/CPI) requires **AI-verified physical progress** — photogrammetry and point-cloud comparison against a BIM model — which is a different, much harder problem than photo defect detection. Faking these numbers from punch-list data would be exactly the kind of unverifiable claim this project avoids. |

**The drone-ready angle.** The capture layer is designed to be swappable: `Photo.source` is already typed as `'upload' | 'drone'`, and inspection rounds already map cleanly onto periodic drone flights (a round *is* "compare this pass to the last one"). Swapping manual photo uploads for stills pulled from a drone flight wouldn't touch the analysis, aggregation, or tracking pipeline — only the capture step changes. The harder next problem — turning drone flights into the aerial %-complete-per-building overlays common in construction dashboards — needs photogrammetry and 3D reconstruction compared against a real BIM model; that's a fundamentally different (and much larger) system than this one, so it's named here as the honest next step rather than simulated.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router, IndexedDB (`idb`), Three.js / React Three Fiber (lazy-loaded), jsPDF (lazy-loaded) |
| Backend | Python, FastAPI, Anthropic SDK (tool use + vision) — a single stateless analysis service; all project state lives in the browser |
| Deploy | Vercel (static frontend + Python serverless function) |

Built with [Claude Code](https://claude.com/claude-code) as the daily driver — the same agentic-coding workflow the industry is converging on.

## Run it locally

```bash
# backend
python -m venv .venv && .venv/Scripts/activate   # or source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload                # http://localhost:8000

# frontend (separate terminal)
cd frontend
npm install
npm run dev                                       # http://localhost:5173, proxies /api
```

Set `ANTHROPIC_API_KEY` in the backend environment to skip the per-request key, `PUNCHLIST_MODEL` to override the vision model, and `PUNCHLIST_TEXT_MODEL` to use a cheaper model for the text-only `/aggregate` and `/diff` calls.

## PunchBench: measuring and improving the prompt

Writing a prompt once isn't the same as knowing it's good. [`bench/`](bench/) is a
small, fully local, zero-cost harness (Ollama — no Anthropic API calls) that runs
the extraction prompt against a hand-labeled photo set, scores it deterministically,
and has a second model propose an improved prompt from the failures — left running
overnight, it produces a report of the prompt improving generation over generation.

The first run also surfaced a real finding: a naive "edit whatever was just tried"
optimizer strategy drifted into a local optimum and stayed there for 10+
generations — both strategies find a good prompt at roughly the same peak score
(composite ≈0.41–0.43), but the naive one loses it afterward (post-peak average
composite 0.063) while an "always edit the best-known prompt" strategy holds onto
it (post-peak average 0.281, 4.5× higher). See [`bench/README.md`](bench/README.md)
for the full comparison and both reports.

## Sample photos

The three gallery photos are CC0 / public-domain images from Wikimedia Commons ([cracked retaining wall](https://commons.wikimedia.org/wiki/File:Cracked_concrete_retaining_wall_at_Medway_Park_Sports_Centre,_Gillingham,_Kent,_England.jpg), [basement utility room](https://commons.wikimedia.org/wiki/File:EFTA00000341_-_Empty_basement_room_with_exposed_electrical_wiring_panels_and_pipes_on_the_wall_leading_to_a_doorway_into_another_space.jpg), [water-damaged ceiling](https://commons.wikimedia.org/wiki/File:Ceiling_sheetrock_damaged_by_water_so_paint_was_peeling.jpg)). Their cached results were produced with the same prompt/schema during development and reviewed by hand. The v2 demo project's "Round 2" re-inspects the same three photos rather than sourcing new ones — labeled explicitly as a re-inspection pass, with closures noted as verified on site rather than claiming the photos themselves changed.

## Limitations (honest ones)

- No pixel-level localization — locations are textual descriptions by design.
- The digital twin is a **schematic placeholder**: a procedurally-generated massing model with hand- or click-placed markers, not a survey-accurate BIM or a photogrammetric reconstruction.
- No real schedule or cost tracking (SPI/CPI) — that requires physical progress verification this project doesn't attempt. See the landscape table above.
- A demo, not an inspection tool: outputs need review by a qualified professional.
- Natural next steps: drone-flight photo ingestion (the capture layer already supports it — see above), Azure deployment option, and feedback loops on accepted/rejected items.

## License

MIT — see [LICENSE](LICENSE).
