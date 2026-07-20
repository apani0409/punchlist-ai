"""PunchList AI backend.

POST /analyze takes a construction-site photo (base64) and returns a
structured punch list produced by a Claude vision model.

POST /aggregate takes the per-photo punch lists for a project (or one
inspection round) and consolidates them into a single project-level list,
merging duplicate defects seen in multiple photos.

POST /diff compares the consolidated items from two inspection rounds and
classifies each as closed, persistent, or new, so a project's punch list
can be tracked over time.

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
