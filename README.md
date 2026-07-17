# PunchList AI 🏗️

**Construction site photo → structured punch list, in one request.**

Upload a photo of a construction site and get back a structured punch list: each visible defect with its location, responsible trade, severity, and recommended action — rendered as a filterable table you can export to PDF.

**Live demo:** https://punchlist-ai.vercel.app *(three pre-analyzed sample photos, no API key needed)*

## Why I built this

I recently applied to [Gaudi AI](https://heygaudi.ai), whose mission is bringing AI to the physical world through construction workflow automations — punch lists among them. After applying, I wanted to show rather than tell, so I built this working slice of that idea in a weekend: a vision language model turned into a practical construction tool.

> **Not affiliated with Gaudi AI.** This is an independent demo inspired by the public description of their product space. It is not a substitute for professional inspection.

## How it works

```
photo (base64) ──► FastAPI /analyze ──► Claude (vision) with a forced tool call
                                          │  record_punch_list(JSON schema)
                                          ▼
                        { scene_summary, items: [ {title, description,
                          location_in_photo, trade, severity,
                          recommended_action} ] }
                                          │
                                          ▼
                  React table (filter by trade / severity) ──► PDF export
```

**Key design decisions**

- **Structured output via a forced tool call.** The model must answer through the `record_punch_list` tool, whose JSON schema constrains trades and severities to fixed enums. No regex parsing, no malformed JSON.
- **Textual locations, not bounding boxes.** VLMs describe *where* things are far more reliably than they localize pixels. The schema asks for descriptions like "ceiling, center-right" — honest about what the model does well.
- **Prompted against hallucination.** The system prompt instructs the model to only report visible issues and to return an empty list for non-construction photos.
- **BYO API key.** The live mode takes your Anthropic API key, forwards it for that single request (`X-Anthropic-Key` header), and never stores or logs it. The sample gallery is pre-analyzed, so exploring the demo costs nothing.
- **Severity model:** `high` = safety hazard or blocks occupancy · `medium` = fix before handover · `low` = cosmetic.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite, jsPDF (lazy-loaded) |
| Backend | Python, FastAPI, Anthropic SDK (tool use + vision) |
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

Set `ANTHROPIC_API_KEY` in the backend environment to skip the per-request key, and `PUNCHLIST_MODEL` to override the default model.

## Sample photos

The three gallery photos are CC0 / public-domain images from Wikimedia Commons ([cracked retaining wall](https://commons.wikimedia.org/wiki/File:Cracked_concrete_retaining_wall_at_Medway_Park_Sports_Centre,_Gillingham,_Kent,_England.jpg), [basement utility room](https://commons.wikimedia.org/wiki/File:EFTA00000341_-_Empty_basement_room_with_exposed_electrical_wiring_panels_and_pipes_on_the_wall_leading_to_a_doorway_into_another_space.jpg), [water-damaged ceiling](https://commons.wikimedia.org/wiki/File:Ceiling_sheetrock_damaged_by_water_so_paint_was_peeling.jpg)). Their cached results were produced with the same prompt/schema during development and reviewed by hand.

## Limitations (honest ones)

- No pixel-level localization — locations are textual descriptions by design.
- One photo per request; no cross-photo project state or history.
- A demo, not an inspection tool: outputs need review by a qualified professional.
- Natural next steps: batch photo ingestion, Azure deployment (Functions + Blob Storage), project-level punch list aggregation, and feedback loops on accepted/rejected items.

## License

MIT — see [LICENSE](LICENSE).
