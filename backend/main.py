"""PunchList AI backend.

POST /analyze takes a construction-site photo (base64) and returns a
structured punch list produced by a Claude vision model.

POST /aggregate takes the per-photo punch lists for a project (or one
inspection round) and consolidates them into a single project-level list,
merging duplicate defects seen in multiple photos.

POST /diff compares the consolidated items from two inspection rounds and
classifies each as closed, persistent, or new, so a project's punch list
can be tracked over time.

POST /extract takes a raw message (an email or text from a subcontractor,
architect, or field crew) and turns it into one structured document: an
RFI, a change order, or a notice — never inventing figures the message
doesn't state.

POST /ask answers a natural-language question about a project using only
the project's own data (items, rounds, documents) sent as context —
grounded, citing what it used, and refusing rather than guessing when the
answer isn't in that context.

POST /risk-report turns a project's current open items (and, if given,
how they changed since the last round) into a short, prioritized risk
report a PM can read in under a minute — grouped, ranked, and referencing
real item ids rather than restating every item as its own risk.

The Anthropic API key can come from:
  1. the X-Anthropic-Key request header (BYO key — used for that request
     only, never logged or stored), or
  2. the ANTHROPIC_API_KEY environment variable (local dev / self-host).
"""

import json
import os

import anthropic
from fastapi import APIRouter, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

MODEL = os.environ.get("PUNCHLIST_MODEL", "claude-sonnet-5")
# Text-only calls (aggregate, diff) can use a cheaper model; defaults to MODEL.
TEXT_MODEL = os.environ.get("PUNCHLIST_TEXT_MODEL", MODEL)
MAX_IMAGE_MB = 5
MAX_AGGREGATE_PHOTOS = 60
MAX_AGGREGATE_ITEMS = 300

# Routes live on a router so deployments can mount them under a prefix
# (e.g. /api on Vercel) while local dev serves them at the root.
router = APIRouter()


def _forced_tool_call(
    api_key: str,
    system: str,
    user_text: str,
    tool: dict,
    *,
    model: str = TEXT_MODEL,
    max_tokens: int = 4096,
) -> dict:
    """Run a text-only Claude call that must answer via the given tool.

    Shared by /aggregate and /diff (and any future text-only endpoint) so
    they don't each re-implement client setup and error mapping.
    """
    client = anthropic.Anthropic(api_key=api_key)
    try:
        message = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system,
            tools=[tool],
            tool_choice={"type": "tool", "name": tool["name"]},
            messages=[{"role": "user", "content": user_text}],
        )
    except anthropic.AuthenticationError:
        raise HTTPException(status_code=401, detail="Invalid Anthropic API key.")
    except anthropic.APIError as e:
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {e.__class__.__name__}")

    for block in message.content:
        if block.type == "tool_use" and block.name == tool["name"]:
            return block.input

    raise HTTPException(status_code=502, detail="Model did not return the expected tool call.")


def _require_api_key(x_anthropic_key: str | None) -> str:
    api_key = x_anthropic_key or os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="No API key. Send one in the X-Anthropic-Key header (it is used for this request only).",
        )
    return api_key


class AnalyzeRequest(BaseModel):
    image_base64: str
    media_type: str = "image/jpeg"


PUNCH_LIST_TOOL = {
    "name": "record_punch_list",
    "description": "Record the punch list extracted from a construction site photo.",
    "input_schema": {
        "type": "object",
        "properties": {
            "scene_summary": {
                "type": "string",
                "description": "One or two sentences describing the scene and overall state of work.",
            },
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "integer"},
                        "title": {"type": "string", "description": "Short issue name, max ~8 words."},
                        "description": {"type": "string", "description": "What is wrong and why it matters."},
                        "location_in_photo": {
                            "type": "string",
                            "description": "Where in the photo the issue is (e.g. 'left wall, near the window'). Textual only.",
                        },
                        "trade": {
                            "type": "string",
                            "enum": [
                                "electrical",
                                "plumbing",
                                "drywall",
                                "paint",
                                "concrete",
                                "carpentry",
                                "safety",
                                "general",
                            ],
                        },
                        "severity": {"type": "string", "enum": ["low", "medium", "high"]},
                        "recommended_action": {"type": "string"},
                    },
                    "required": [
                        "id",
                        "title",
                        "description",
                        "location_in_photo",
                        "trade",
                        "severity",
                        "recommended_action",
                    ],
                },
            },
        },
        "required": ["scene_summary", "items"],
    },
}

SYSTEM_PROMPT = """You are a meticulous construction site inspector generating punch lists.

Given a photo of a construction site or building interior/exterior, identify visible
defects, unfinished work, and safety issues. For each issue produce a punch list item.

Rules:
- Only report what is actually visible in the photo. Never invent issues.
- If the photo is not a construction/building scene, return an empty items list and
  say so in scene_summary.
- location_in_photo must be textual (e.g. "ceiling, center-right"), never coordinates.
- severity: high = safety hazard or blocks occupancy; medium = must fix before
  handover; low = cosmetic.
- Use the record_punch_list tool for your answer."""


class AggregatePhotoInput(BaseModel):
    photo_id: str
    label: str
    scene_summary: str
    items: list[dict]  # PunchItem-shaped dicts, as returned by /analyze


class AggregateRequest(BaseModel):
    photos: list[AggregatePhotoInput]


CONSOLIDATED_LIST_TOOL = {
    "name": "record_consolidated_list",
    "description": "Record the project-level punch list consolidated from multiple photos.",
    "input_schema": {
        "type": "object",
        "properties": {
            "project_summary": {
                "type": "string",
                "description": "One or two sentences describing the overall state of the project across all photos.",
            },
            "progress_notes": {
                "type": "string",
                "description": (
                    "Two or three sentences of qualitative construction-progress observations "
                    "visible across the photos (e.g. framing stage, finishes underway). No "
                    "percentages or estimates — only what is directly observable."
                ),
            },
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "integer"},
                        "title": {"type": "string", "description": "Short issue name, max ~8 words."},
                        "description": {"type": "string", "description": "What is wrong and why it matters."},
                        "location": {
                            "type": "string",
                            "description": "Project-level location (e.g. 'Basement utility room, west wall'). Textual only.",
                        },
                        "trade": {
                            "type": "string",
                            "enum": [
                                "electrical",
                                "plumbing",
                                "drywall",
                                "paint",
                                "concrete",
                                "carpentry",
                                "safety",
                                "general",
                            ],
                        },
                        "severity": {"type": "string", "enum": ["low", "medium", "high"]},
                        "recommended_action": {"type": "string"},
                        "source_photos": {
                            "type": "array",
                            "description": "Which input photo/item(s) this consolidated entry was built from.",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "photo_id": {"type": "string"},
                                    "item_id": {"type": "integer"},
                                },
                                "required": ["photo_id", "item_id"],
                            },
                        },
                    },
                    "required": [
                        "id",
                        "title",
                        "description",
                        "location",
                        "trade",
                        "severity",
                        "recommended_action",
                        "source_photos",
                    ],
                },
            },
        },
        "required": ["project_summary", "progress_notes", "items"],
    },
}

AGGREGATE_SYSTEM_PROMPT = """You are consolidating punch list items from multiple photos of the
same construction project into a single project-level punch list.

Rules:
- If the same physical defect appears in more than one photo (or more than once in the
  input), merge it into one consolidated item and list every source photo/item it came
  from in source_photos. Never invent an item that has no source.
- When merging, keep the worst (highest) severity among the merged items.
- Normalize each item's location into a project-level description (e.g. "Basement
  utility room, west wall" instead of "center of photo"), using the photo's label and
  the item's original location_in_photo as context. Textual only, never coordinates.
- Do not drop or soften any item — every input item must map to exactly one output item.
- progress_notes must describe only what is visible; never estimate percent complete
  or invent schedule/cost figures.
- Use the record_consolidated_list tool for your answer."""


class DiffItemInput(BaseModel):
    id: str
    title: str
    description: str
    location: str
    trade: str
    severity: str


class DiffRequest(BaseModel):
    previous_items: list[DiffItemInput]
    current_items: list[DiffItemInput]


ROUND_DIFF_TOOL = {
    "name": "record_round_diff",
    "description": "Record how punch list items changed between two inspection rounds.",
    "input_schema": {
        "type": "object",
        "properties": {
            "closed": {
                "type": "array",
                "description": "IDs from previous_items that are no longer visible/present in current_items (resolved).",
                "items": {"type": "string"},
            },
            "persistent": {
                "type": "array",
                "description": "Pairs where the same physical defect appears in both rounds.",
                "items": {
                    "type": "object",
                    "properties": {
                        "previous_id": {"type": "string"},
                        "current_id": {"type": "string"},
                        "note": {
                            "type": "string",
                            "description": "Optional short note on how it changed (e.g. 'unchanged', 'worsened').",
                        },
                    },
                    "required": ["previous_id", "current_id"],
                },
            },
            "new": {
                "type": "array",
                "description": "IDs from current_items that were not present in previous_items.",
                "items": {"type": "string"},
            },
        },
        "required": ["closed", "persistent", "new"],
    },
}

DIFF_SYSTEM_PROMPT = """You are comparing two rounds of construction site punch list items to track
progress over time.

Rules:
- Match items that describe the same physical defect (same trade, same or very similar
  location, similar description) as persistent — the defect is still present.
- Items from previous_items with no match in current_items are closed (assume resolved).
- Items from current_items with no match in previous_items are new.
- Every id from previous_items must appear in exactly one of closed or persistent.previous_id.
- Every id from current_items must appear in exactly one of new or persistent.current_id.
- Do not invent ids that are not in the input.
- Use the record_round_diff tool for your answer."""


class ExtractRequest(BaseModel):
    text: str
    hint: str | None = None  # 'rfi' | 'change_order' | 'notice' | 'auto' | None


MAX_EXTRACT_CHARS = 8000

_TRADE_ENUM = [
    "electrical",
    "plumbing",
    "drywall",
    "paint",
    "concrete",
    "carpentry",
    "safety",
    "general",
]

DOCUMENT_TOOL = {
    "name": "record_document",
    "description": "Record a structured RFI, change order, or notice extracted from a raw message.",
    "input_schema": {
        "type": "object",
        "properties": {
            "type": {"type": "string", "enum": ["rfi", "change_order", "notice"]},
            "priority": {"type": "string", "enum": ["low", "medium", "high"]},
            "summary": {"type": "string", "description": "One-sentence plain-language summary of the message."},
            "subject": {"type": "string", "description": "Short subject line."},
            "rfi_question": {
                "type": "string",
                "description": "The question being asked, verbatim intent. Empty string if type is not rfi.",
            },
            "rfi_discipline": {"type": "string", "enum": [*_TRADE_ENUM, ""]},
            "rfi_reference": {
                "type": "string",
                "description": "Referenced drawing/spec section, if mentioned. Empty string otherwise.",
            },
            "co_description": {
                "type": "string",
                "description": "What is changing and why. Empty string if type is not change_order.",
            },
            "co_trade": {"type": "string", "enum": [*_TRADE_ENUM, ""]},
            "co_cost_amount": {
                "type": ["number", "null"],
                "description": "Dollar amount ONLY if explicitly stated in the text. Never estimate — null otherwise.",
            },
            "co_cost_currency": {"type": "string", "description": "e.g. USD. Empty string if no amount stated."},
            "co_schedule_impact_days": {
                "type": ["integer", "null"],
                "description": "Schedule impact in days ONLY if explicitly stated. Never estimate — null otherwise.",
            },
            "co_initiated_by": {"type": "string", "description": "Who requested it, if named. Empty string otherwise."},
            "notice_type": {"type": "string", "enum": ["delay", "change", "defect", "other", ""]},
            "notice_body_draft": {
                "type": "string",
                "description": "Drafted notice body ready for human review/edit. Empty string if type is not notice.",
            },
        },
        "required": [
            "type",
            "priority",
            "summary",
            "subject",
            "rfi_question",
            "rfi_discipline",
            "rfi_reference",
            "co_description",
            "co_trade",
            "co_cost_amount",
            "co_cost_currency",
            "co_schedule_impact_days",
            "co_initiated_by",
            "notice_type",
            "notice_body_draft",
        ],
    },
}

EXTRACT_SYSTEM_PROMPT = """You are a construction-project assistant that turns a raw message (an
email or text from a subcontractor, architect, or field crew) into one structured document: an
RFI (request for information), a change order, or a notice (e.g. of delay or defect).

Rules:
- Classify the message as exactly one of: rfi, change_order, notice. Use the hint if one is
  given and plausible, otherwise infer from content.
- Only fill in the fields for the detected type; leave every field belonging to the other types
  as an empty string (or null for the two numeric change-order fields).
- NEVER invent a dollar amount, a schedule-impact day count, or any other figure that is not
  explicitly stated in the text. If a change order mentions cost or schedule impact without a
  specific number, leave co_cost_amount / co_schedule_impact_days as null — do not estimate.
- For an RFI: extract the question being asked. Do NOT answer it — resolving RFIs requires
  reviewing the actual drawings/specs, which is a human's job, not this tool's.
- For a change order: extract what's changing, why, the responsible trade, and any stated cost
  or schedule impact.
- For a notice: draft a short, professional notice body ready for human review and editing
  before it's sent — do not state anything as fact beyond what the message itself says.
- priority: high = safety/blocking/urgent; medium = needs attention this week; low = routine.
- Use the record_document tool for your answer."""


class AskContextItem(BaseModel):
    id: str
    title: str
    description: str
    location: str
    trade: str
    severity: str
    round_index: int


class AskContextRound(BaseModel):
    id: str
    index: int
    name: str
    project_summary: str = ""
    progress_notes: str = ""


class AskContextDocument(BaseModel):
    id: str
    type: str
    subject: str
    summary: str


class AskRequest(BaseModel):
    question: str
    items: list[AskContextItem] = []
    rounds: list[AskContextRound] = []
    documents: list[AskContextDocument] = []


MAX_ASK_CONTEXT_RECORDS = 400

ANSWER_TOOL = {
    "name": "record_answer",
    "description": "Record a grounded answer to a question about this construction project.",
    "input_schema": {
        "type": "object",
        "properties": {
            "answer": {
                "type": "string",
                "description": (
                    "The answer, in plain language, a few sentences. If not answerable from the "
                    "provided context, explain what information would be needed instead."
                ),
            },
            "grounded": {
                "type": "boolean",
                "description": "True only if the answer is fully supported by the provided context.",
            },
            "citations": {
                "type": "array",
                "description": "Every item/round/document referenced in the answer. Empty if grounded is false.",
                "items": {
                    "type": "object",
                    "properties": {
                        "kind": {"type": "string", "enum": ["item", "round", "document"]},
                        "id": {"type": "string"},
                        "label": {"type": "string", "description": "Short human-readable label for this citation."},
                    },
                    "required": ["kind", "id", "label"],
                },
            },
        },
        "required": ["answer", "grounded", "citations"],
    },
}

ASK_SYSTEM_PROMPT = """You are answering questions about a construction project using ONLY the
structured data provided below (punch list items, inspection rounds, and extracted documents).
This is the project's actual current data — you have no other knowledge of this project.

Context notes:
- Each item has a round_index: the round in which that finding was observed. If an item appears
  in an earlier round but not in a later one, treat it as likely resolved by that later round —
  check that round's progress_notes for confirmation before stating this as fact.
- Rounds are listed in order with their project_summary and progress_notes, which describe what
  changed between rounds.

Rules:
- Answer ONLY from the provided context. Never use outside knowledge about construction in
  general, this project, or anything not explicitly given to you here.
- If the answer isn't in the provided context (e.g. asking about budget, schedule, or anything
  not tracked), set grounded to false and say plainly what information would be needed. Do not
  guess, estimate, or speculate to fill the gap.
- Every fact in your answer must trace to a specific item, round, or document in the context —
  list each one you used in citations, with a short human-readable label. If grounded is false,
  citations must be empty.
- Keep the answer to a few sentences.
- Use the record_answer tool for your response."""


class RiskReportItem(BaseModel):
    id: str
    title: str
    description: str
    location: str
    trade: str
    severity: str


class RiskReportDiffSummary(BaseModel):
    closed_count: int
    persistent_count: int
    new_count: int


class RiskReportRequest(BaseModel):
    items: list[RiskReportItem]
    diff: RiskReportDiffSummary | None = None
    progress_notes: str | None = None


RISK_REPORT_TOOL = {
    "name": "record_risk_report",
    "description": "Record a prioritized risk report for a construction project's current open items.",
    "input_schema": {
        "type": "object",
        "properties": {
            "headline": {
                "type": "string",
                "description": "One-sentence executive summary of the project's current risk posture.",
            },
            "risks": {
                "type": "array",
                "description": (
                    "Risks ranked most urgent first. Group related items into one risk when they "
                    "share a root cause — don't just restate every open item as its own risk."
                ),
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "severity": {"type": "string", "enum": ["low", "medium", "high"]},
                        "why": {
                            "type": "string",
                            "description": "Why this matters now — e.g. blocks other work, safety, open multiple rounds.",
                        },
                        "reference_ids": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Ids of the source items this risk is built from. Never invent an id.",
                        },
                        "recommended_action": {"type": "string"},
                    },
                    "required": ["title", "severity", "why", "reference_ids", "recommended_action"],
                },
            },
        },
        "required": ["headline", "risks"],
    },
}

RISK_REPORT_SYSTEM_PROMPT = """You are writing a short, prioritized risk report for a construction
project manager to read in under a minute, based on the project's current open punch-list items
(and, if provided, how they changed since the last inspection round).

Rules:
- Rank risks most urgent first: prioritize high severity, items that block other work (mentioned
  in another item's description or recommended action), safety issues, and items implied to have
  persisted across multiple rounds by progress_notes or the diff summary.
- Group related items into one risk when they share a root cause. Aim for a handful of risks,
  not a wall of them — this must be readable in under a minute.
- Every risk's reference_ids must be real item ids from the input. Never invent an id or state a
  fact not supported by the input.
- recommended_action should be concrete and specific to what's actually blocking progress.
- headline: one sentence capturing the overall state — what needs attention first, and whether
  anything is currently blocking other work.
- Use the record_risk_report tool for your answer."""


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "model": MODEL}


@router.post("/analyze")
def analyze(
    req: AnalyzeRequest,
    x_anthropic_key: str | None = Header(default=None),
) -> dict:
    api_key = _require_api_key(x_anthropic_key)

    if len(req.image_base64) * 3 / 4 > MAX_IMAGE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Image larger than {MAX_IMAGE_MB} MB.")
    if req.media_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=415, detail="Use a JPEG, PNG or WebP image.")

    client = anthropic.Anthropic(api_key=api_key)
    try:
        message = client.messages.create(
            model=MODEL,
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            tools=[PUNCH_LIST_TOOL],
            tool_choice={"type": "tool", "name": "record_punch_list"},
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": req.media_type,
                                "data": req.image_base64,
                            },
                        },
                        {
                            "type": "text",
                            "text": "Inspect this photo and produce the punch list.",
                        },
                    ],
                }
            ],
        )
    except anthropic.AuthenticationError:
        raise HTTPException(status_code=401, detail="Invalid Anthropic API key.")
    except anthropic.APIError as e:
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {e.__class__.__name__}")

    for block in message.content:
        if block.type == "tool_use" and block.name == "record_punch_list":
            return block.input

    raise HTTPException(status_code=502, detail="Model did not return a punch list.")


@router.post("/aggregate")
def aggregate(
    req: AggregateRequest,
    x_anthropic_key: str | None = Header(default=None),
) -> dict:
    api_key = _require_api_key(x_anthropic_key)

    if not req.photos:
        raise HTTPException(status_code=400, detail="No photos to aggregate.")
    if len(req.photos) > MAX_AGGREGATE_PHOTOS:
        raise HTTPException(
            status_code=413, detail=f"Too many photos to aggregate (max {MAX_AGGREGATE_PHOTOS})."
        )
    total_items = sum(len(p.items) for p in req.photos)
    if total_items > MAX_AGGREGATE_ITEMS:
        raise HTTPException(
            status_code=413, detail=f"Too many items to aggregate (max {MAX_AGGREGATE_ITEMS})."
        )

    payload = json.dumps([p.model_dump() for p in req.photos], indent=2)
    user_text = (
        "Consolidate the per-photo punch list items below into a single project-level "
        "punch list.\n\n" + payload
    )
    return _forced_tool_call(api_key, AGGREGATE_SYSTEM_PROMPT, user_text, CONSOLIDATED_LIST_TOOL)


@router.post("/diff")
def diff(
    req: DiffRequest,
    x_anthropic_key: str | None = Header(default=None),
) -> dict:
    api_key = _require_api_key(x_anthropic_key)

    if not req.previous_items and not req.current_items:
        raise HTTPException(status_code=400, detail="No items to diff.")
    total_items = len(req.previous_items) + len(req.current_items)
    if total_items > MAX_AGGREGATE_ITEMS:
        raise HTTPException(
            status_code=413, detail=f"Too many items to diff (max {MAX_AGGREGATE_ITEMS})."
        )

    payload = json.dumps(
        {
            "previous_items": [i.model_dump() for i in req.previous_items],
            "current_items": [i.model_dump() for i in req.current_items],
        },
        indent=2,
    )
    user_text = "Compare these two inspection rounds and classify every item.\n\n" + payload
    return _forced_tool_call(api_key, DIFF_SYSTEM_PROMPT, user_text, ROUND_DIFF_TOOL)


@router.post("/extract")
def extract(
    req: ExtractRequest,
    x_anthropic_key: str | None = Header(default=None),
) -> dict:
    api_key = _require_api_key(x_anthropic_key)

    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="No text to extract from.")
    if len(text) > MAX_EXTRACT_CHARS:
        raise HTTPException(status_code=413, detail=f"Text too long (max {MAX_EXTRACT_CHARS} characters).")

    hint_line = f"\n\nHint: this is likely a {req.hint}." if req.hint and req.hint != "auto" else ""
    user_text = f"Extract a structured document from this message:{hint_line}\n\n{text}"
    return _forced_tool_call(api_key, EXTRACT_SYSTEM_PROMPT, user_text, DOCUMENT_TOOL)


@router.post("/ask")
def ask(
    req: AskRequest,
    x_anthropic_key: str | None = Header(default=None),
) -> dict:
    api_key = _require_api_key(x_anthropic_key)

    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="No question asked.")
    total_context = len(req.items) + len(req.rounds) + len(req.documents)
    if total_context > MAX_ASK_CONTEXT_RECORDS:
        raise HTTPException(
            status_code=413, detail=f"Too much project context (max {MAX_ASK_CONTEXT_RECORDS} records)."
        )

    payload = json.dumps(
        {
            "items": [i.model_dump() for i in req.items],
            "rounds": [r.model_dump() for r in req.rounds],
            "documents": [d.model_dump() for d in req.documents],
        },
        indent=2,
    )
    user_text = f"Project context:\n\n{payload}\n\nQuestion: {question}"
    return _forced_tool_call(api_key, ASK_SYSTEM_PROMPT, user_text, ANSWER_TOOL)


@router.post("/risk-report")
def risk_report(
    req: RiskReportRequest,
    x_anthropic_key: str | None = Header(default=None),
) -> dict:
    api_key = _require_api_key(x_anthropic_key)

    if not req.items:
        raise HTTPException(status_code=400, detail="No open items to assess.")
    if len(req.items) > MAX_AGGREGATE_ITEMS:
        raise HTTPException(status_code=413, detail=f"Too many items to assess (max {MAX_AGGREGATE_ITEMS}).")

    payload = json.dumps(
        {
            "items": [i.model_dump() for i in req.items],
            "diff": req.diff.model_dump() if req.diff else None,
            "progress_notes": req.progress_notes,
        },
        indent=2,
    )
    user_text = f"Write a prioritized risk report for these open items:\n\n{payload}"
    return _forced_tool_call(api_key, RISK_REPORT_SYSTEM_PROMPT, user_text, RISK_REPORT_TOOL)


def create_app(prefix: str = "") -> FastAPI:
    application = FastAPI(title="PunchList AI", version="1.0.0")
    application.add_middleware(
        CORSMiddleware,
        allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(router, prefix=prefix)
    return application


# Local dev / classic hosting: uvicorn backend.main:app --reload
app = create_app()
