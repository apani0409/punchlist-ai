# PunchList AI 🏗️

**Construction site photos → a tracked, structured punch list — from one photo to a whole project.**

Upload photos of a construction site and get back structured punch list items: each visible defect with its location, responsible trade, severity, and recommended action. v1 did this for a single photo; **v2** turned it into a small platform — batches of photos consolidated into one project, inspection rounds compared over time, an honest metrics dashboard, a schematic 3D digital twin, and three features aimed at a problem GCs describe wanting solved: turning raw, unstructured project communication into structured records without manual re-typing. **v3** (this branch) adds the two things still missing from that picture: a grounded search over real code/standard text, and a digital twin that can load an actual parsed BIM model instead of only a schematic placeholder.

**Live demo (v1):** https://punchlist-ai-five.vercel.app *(three pre-analyzed sample photos, no API key needed)*
**v2 / v3 previews:** the `v2` and `v3` branches each deploy their own Vercel preview automatically — the production URL above is untouched.

## Why I built this

I recently applied to [Gaudi AI](https://heygaudi.ai), whose mission is bringing AI to the physical world through construction workflow automations — punch lists among them. After applying, I wanted to show rather than tell, so I built this working slice of that idea in a weekend: a vision language model turned into a practical construction tool. v2 extends that into a small platform, built the same way — fast, honestly, with the model doing what it's actually good at, informed by what people who actually run construction projects say they want.

> **Not affiliated with Gaudi AI.** This is an independent demo inspired by the public description of their product space. It is not a substitute for professional inspection.

## What prompted v2's direction

Two things, alongside a taxonomy of AI in civil engineering (see the landscape table below):

- **A GC/CM discussion of AI construction tools.** The recurring complaint: manual data entry into Procore/Projectsight is the real burden, and what people actually want is software that reads their emails and texts and turns them into structured RFIs and change orders — "meet the subcontractor where they are," not force them into a new tool. One thread example, almost verbatim: *"I have to charge you $3,000 for changing the foundation wall from 12" to 16"."* → a change order, ready for review, not manually re-typed. That's a real seed in the demo project's Inbox.
- **A GC ($200M revenue) describing a tool they use in production**, built by a small team, that connects to Procore/ACC, runs a chatbot **grounded in the project's own documents that doesn't hallucinate**, drafts notices with a priority score before a human sends them, and runs **proactive background comparisons** (e.g. plan v1 vs v2) that produce a **prioritized risk report with references and recommended actions**. They also flagged a separate product ([civils.ai](https://civils.ai)) that does document-grounded takeoffs and checks but **explicitly doesn't do RFIs or change orders** — a real gap between the two tools.

The common thread in both: turn unstructured input (photos, emails, texts) into structured, reviewable records — grounded, human-in-the-loop, never guessing. That's what v1 already did for photos; the Document Intelligence, Ask, and Codes features below extend the same pattern to text.

## Five ways to use it

**Quick analyze** (`/quick`) — the original v1 flow, unchanged: one photo in, one punch list out, pre-analyzed samples so it costs nothing to explore.

**Projects** (`/`) — the core v2 flow: create a project, drop in a batch of photos, and PunchList AI analyzes each one, then consolidates the findings into a single project-level list, tracked across inspection rounds.

**Inbox** (`/project/:id/inbox`) — paste a raw email or text message; it's classified and extracted into an editable RFI, change order, or notice.

**Ask** (`/project/:id/ask`) — ask a question about the project in plain language; answers are grounded only in that project's own data, with citations, and an honest refusal when something isn't tracked.

**Codes** (`/project/:id/codes`) — ask what a code/standard requires; answers are grounded only in a curated corpus of real regulation text, citing the exact section and quoting it verbatim, with the same honest refusal for anything outside that subset.

```
N photos ──► /analyze (per photo) ──► /aggregate (consolidate, dedupe)
                                              │
     round 2 photos ──► /analyze ──► /aggregate ──► /diff (closed / persistent / new)
                                              │
                                              ▼
        dashboard (honest metrics + risk report) · digital twin (schematic or real IFC) · Ask (grounded Q&A)

email/text ──► /extract ──► editable RFI / change order / notice (Inbox)

question + code corpus ──► /code-search ──► grounded answer, cited section + quote (Codes)
```

A pre-seeded demo project ships with the app (three inspection rounds with real diffs, five example messages, four example questions, and a generated risk report) so the whole platform is explorable with zero API key.

## Design decisions carried through every endpoint

- **Structured output via forced tool calls** — `/analyze`, `/aggregate`, `/diff`, `/extract`, `/ask`, `/code-search`, and `/risk-report` all share one pattern: the model must answer through a JSON-schema-constrained tool (`_forced_tool_call` in `backend/main.py`). No regex parsing, no malformed JSON, no free-text response to parse.
- **BYO API key**, forwarded per-request, never stored or logged.
- **Never invent a figure.** `/extract`'s cost and schedule-impact fields are nullable, and the model is instructed to leave them null rather than estimate when the source text doesn't state a number — the same rule that keeps the dashboard free of fabricated SPI/CPI.
- **Grounded, with citations, and permission to refuse.** `/ask` and `/risk-report` must trace every claim back to a real item/round/document id; `/ask` explicitly returns `grounded: false` and explains what's missing rather than guessing.
- **Anti-hallucination where the model references other data.** Where an answer references ids from earlier in the pipeline (which photos a finding came from, which round's items map to which, which items a risk cites), the **client validates every id it returns** and falls back to a deterministic heuristic if the call fails — the pipeline never dead-ends on a bad model response.

## v2: what's new

- **Multi-photo projects.** Batch upload with per-photo progress and retry; `POST /aggregate` merges duplicate defects seen across photos into one project-level list, normalizes locations, and keeps the worst severity when merging.
- **Inspection rounds + diff.** Start a new round anytime; `POST /diff` compares it against the previous round and classifies every item as **closed**, **persistent**, or **new**.
- **Traceability.** Every consolidated item links back to the photo(s) it came from — click a thumbnail to see the full photo. Nothing is a black box.
- **An honest dashboard.** Open items, high-severity count, safety-open count, closure rate, and a severity-weighted risk score — every figure derived from real round/item data, each with a round-over-round delta. **No SPI/CPI, no synthetic figures, no percent-complete.**
- **A digital twin** (`/project/:id/twin`) — a schematic, procedurally-generated 3D building, with markers at each photo's location colored by its worst open severity. **A placeholder for spatial context, not a survey-accurate model.**
- **Document Intelligence** (`/project/:id/inbox`) — paste an email or text and get back a classified, editable RFI / change order / notice. RFIs are deliberately **not auto-answered** — resolving one means reviewing the actual drawings/specs, a human's job. Cost and schedule figures are only ever what the message actually states.
- **Grounded Q&A** (`/project/:id/ask`) — a chat-style interface answering only from the project's own items, rounds, and documents, with clickable citations and an honest "not in project data" state instead of a guess.
- **A prioritized risk report** (on the dashboard) — generalizes the round-diff idea into a short narrative: a handful of grouped, ranked risks with *why* they matter and a concrete recommended action, rather than a flat list of every open item.
- **Persistence stays in the browser** (IndexedDB) — the backend remains a stateless analysis service with zero new infrastructure across all six days of v2. Photos and messages never touch a server for storage, only for analysis.

## v3: what's new

- **Codes & standards search** (`POST /code-search`, `/project/:id/codes`) — the "ctrl-F with steroids" gap both industry testimonials above named directly: Telamont has it, civils.ai has it, v2 didn't. Clones the `/ask` pattern exactly (context-stuffed sections, forced tool call, `grounded`/citations shape) against a curated ~20-section subset of **29 CFR 1926** (OSHA construction safety, U.S. federal regulation — public domain). Every quoted clause was copied verbatim from osha.gov and spot-checked against the raw page HTML before inclusion — see [Codes corpus & demo BIM model](#codes-corpus--demo-bim-model) below. Two demo safety items (an exposed cable, a missing panel cover plate) carry real `codeRefs` that render as clickable chips in the punch list, linking straight to the matching answer.
- **Real BIM/IFC import for the digital twin** — a Schematic ↔ BIM toggle on the twin swaps the procedural placeholder for an actual IFC model, **parsed entirely in the browser** with [`web-ifc`](https://github.com/ThatOpen/engine_web-ifc) (used directly, not the deprecated `web-ifc-three`). The existing marker system needed zero changes: markers are normalized against whichever model's bounding box is currently shown, so the same photo-location pins land sensibly on the schematic box *or* the real IFC geometry — proof that the twin's marker layer is agnostic to its geometry source, the same "swappable capture layer" idea already applied to photos vs. drone stills. Anyone can also upload their own `.ifc` file; it's parsed client-side, never uploaded anywhere.

## Where this sits in the construction-AI landscape

A useful way to think about AI in civil engineering is four phases: **Predict** (classical ML on tabular data), **Perceive** (computer vision on images/point clouds), **Generate** (LLMs synthesizing structured output from unstructured input), and **Reason & Act** (autonomous agents). Here's what PunchList AI actually does in that frame, and what's deliberately left as roadmap:

| Phase | What v2 does | What's roadmap (not built) |
|---|---|---|
| **Perceive** | `/analyze` uses a **general-purpose VLM (Claude vision)**, not a defect-specific CNN/YOLO model. One zero-shot model replaces training N specialized detectors, and sidesteps the "scarce labeled defect data" problem entirely. | Real-time video/CCTV monitoring; a specialist model for cases a general VLM underperforms on. |
| **Generate** | `/aggregate`, `/diff`, `/extract`, `/ask`, `/code-search`, and `/risk-report` are all this phase: LLMs turning unstructured, multi-source input (photos, rounds, raw messages, code text) into prioritized, deduplicated, grounded structured records. `/code-search` closes the "codes/standards search" gap both testimonials named — grounded in real, verbatim OSHA text, not the model's general knowledge. | Document-grounded takeoffs from drawings/plans (civils.ai's territory — vision on technical drawings is a different, harder problem than photo defect detection); cross-checking plan sets (e.g. architectural vs. electrical reflected ceiling plans for fixture mismatches). |
| **Reason & Act** | [`bench/`](bench/) (PunchBench) is an autonomous loop: it runs the extraction prompt overnight, scores it deterministically against ground truth, and has a second model propose improvements from the failures — "detects issues while you sleep," in miniature. | A field-deployed agent that proactively monitors a *live* project and runs comparisons in the background, the way a production tool like Telamont does — this project's version only improves an offline eval, not a live project. |
| **Predict / EVM** | Nothing — deliberately. | Real schedule/cost tracking (SPI/CPI) requires **AI-verified physical progress**: photogrammetry and point-cloud comparison against a BIM model. Faking these numbers from punch-list data would be exactly the kind of unverifiable claim this project avoids. |

**The drone-ready angle.** The capture layer is designed to be swappable: `Photo.source` is already typed as `'upload' | 'drone'`, and inspection rounds already map cleanly onto periodic drone flights. Swapping manual photo uploads for stills pulled from a drone flight wouldn't touch the analysis, aggregation, or tracking pipeline — only the capture step changes. v3 applies the identical idea one layer down, to the twin's *geometry*: the same marker system now works against a procedural placeholder or a real parsed IFC model, so a project's own BIM model (or a future photogrammetric reconstruction) is a drop-in replacement, not a rewrite. What's still genuinely roadmap: turning drone flights into aerial %-complete-per-building overlays needs photogrammetry, 3D reconstruction, and a **scan-vs-BIM comparison** (what's built vs. what the model says should be built) — a fundamentally larger system than this one, named here as the honest next step rather than simulated.

**Not built, and deliberately not faked:** an overall project budget or inventory/personnel tracking — this project has no real source of that data, and estimating it would repeat the exact SPI/CPI mistake described above. A live sync to Procore/ACC/Outlook and a voice-enabled field app are also out of scope for a demo, named here rather than mocked.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router, IndexedDB (`idb`), Three.js / React Three Fiber (lazy-loaded), `web-ifc` for client-side BIM parsing (lazy-loaded behind the twin's BIM toggle), jsPDF (lazy-loaded) |
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

Set `ANTHROPIC_API_KEY` in the backend environment to skip the per-request key, `PUNCHLIST_MODEL` to override the vision model, and `PUNCHLIST_TEXT_MODEL` to use a cheaper model for the text-only endpoints (`/aggregate`, `/diff`, `/extract`, `/ask`, `/code-search`, `/risk-report`).

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

## Guardrail evals: proving the honesty guarantees, not just stating them

Every endpoint here claims something specific — `/extract` never invents a
cost figure, `/ask` and `/code-search` refuse rather than guess, `/aggregate`/
`/diff`/`/risk-report` never reference an id absent from their own input.
[`evals/`](evals/) turns each of those claims into an adversarial request
against the real, running backend with a deterministic, code-checked
assertion (no LLM judge — same philosophy as `bench/scorer.py`): 11 cases
across all 6 text-model endpoints, including verifying a `/code-search`
citation's quote is a literal substring of the corpus text sent, not a
paraphrase. Unlike `bench/`, this calls the real Claude-backed endpoints, so
it needs a real API key and costs a small amount to run (11 short, mostly
text-only calls — a fraction of a cent) — see [`evals/README.md`](evals/README.md)
for what's checked and how to run it.

## Sample photos

The gallery photos are CC0 / public-domain images from Wikimedia Commons ([cracked retaining wall](https://commons.wikimedia.org/wiki/File:Cracked_concrete_retaining_wall_at_Medway_Park_Sports_Centre,_Gillingham,_Kent,_England.jpg), [basement utility room](https://commons.wikimedia.org/wiki/File:EFTA00000341_-_Empty_basement_room_with_exposed_electrical_wiring_panels_and_pipes_on_the_wall_leading_to_a_doorway_into_another_space.jpg), [water-damaged ceiling](https://commons.wikimedia.org/wiki/File:Ceiling_sheetrock_damaged_by_water_so_paint_was_peeling.jpg), [crack close-up](https://commons.wikimedia.org/wiki/File:Detail_of_vertical_crack_in_concrete_retaining_wall_at_Medway_Park_Sports_Centre,_Gillingham,_Kent,_England.jpg), [leaky sink valve](https://commons.wikimedia.org/wiki/File:Kitchen_renovation_leaky_valve_beneath_kitchen_sink.JPG)). Their cached results were produced with the same prompt/schema during development and reviewed by hand. The crack close-up shares a physical defect with the wide retaining-wall shot, so the demo merges them into one consolidated item with two source photos — a visible example of what `/aggregate` does with duplicate photos of the same finding. The v2 demo project's "Round 2" re-inspects the same areas rather than sourcing new photos every round — labeled explicitly as a re-inspection pass, with closures noted as verified on site rather than claiming the photos themselves changed. The Inbox's change-order example ("$3,000 to widen a foundation wall from 12\" to 16\"") mirrors the GC/CM discussion referenced above.

## Codes corpus & demo BIM model

**The codes corpus** (`frontend/src/data/codeCorpus.ts`) is a curated ~20-section subset of **29 CFR 1926**, OSHA's U.S. federal construction safety standards — public domain text. Every section's `text` was copied verbatim from its official page on [osha.gov](https://www.osha.gov/laws-regs/regulations/standardnumber/1926) and spot-checked against the raw page HTML (not just an AI-summarized version of it) before being included, the same "verify before trusting" discipline as sourcing the CC0 sample photos. It's a small demo-scoped subset, not the full regulation — see Limitations.

**The demo BIM model** (`frontend/public/models/demo-building.ifc`) is **original content**, generated from scratch with [ifcopenshell](https://ifcopenshell.org) rather than sourced from a third-party sample file — see [`scripts/gen_demo_building_ifc.py`](scripts/gen_demo_building_ifc.py). A few well-known open IFC test models were considered first (buildingSMART's official sample-file repos, IfcOpenShell's own "IfcOpenHouse"); their licensing was either unclear or their hosting was Git-LFS-gated and inaccessible at the time. Generating an original file sidesteps the licensing question entirely and produces a small, real, parseable IFC4 model (two-storey main block + a wing, ~17 building elements) purpose-built to exercise the actual `web-ifc` parsing path.

## Limitations (honest ones)

- No pixel-level localization — locations are textual descriptions by design.
- The digital twin defaults to a **schematic placeholder** (a procedurally-generated massing model with hand- or click-placed markers) and can also load a **real parsed IFC/BIM model** — but that model is uniformly rescaled to fit the existing footprint so markers still land on it, not registered via a real site survey. Neither mode is a substitute for a photogrammetric reconstruction compared against the model.
- No real schedule, cost, inventory, or personnel tracking — that requires data sources (a budget, a schedule baseline, a materials list) this project never had, and estimating them would mean inventing numbers. See the landscape table above.
- RFIs are extracted, not answered — resolving one requires reviewing the actual drawings/specs.
- `/ask`, `/code-search`, and `/risk-report` send their context (project data or code sections) on each call (no vector database) — fine at demo scale, but wouldn't scale to a very large project's full history, or a full code book, without real retrieval.
- The codes corpus is a small curated subset (~20 sections of one regulation, 29 CFR 1926) picked to cover this demo's items, not a complete or current reference — always check the primary source for anything you'd actually rely on.
- A demo, not an inspection or project-management tool: outputs need review by a qualified professional before being acted on.

## License

MIT — see [LICENSE](LICENSE).
