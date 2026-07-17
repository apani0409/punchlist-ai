"""PunchList AI backend.

One endpoint: POST /analyze takes a construction-site photo (base64) and
returns a structured punch list produced by a Claude vision model.

The Anthropic API key can come from:
  1. the X-Anthropic-Key request header (BYO key — used for that request
     only, never logged or stored), or
  2. the ANTHROPIC_API_KEY environment variable (local dev / self-host).
"""

import os

import anthropic
from fastapi import APIRouter, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

MODEL = os.environ.get("PUNCHLIST_MODEL", "claude-sonnet-5")
MAX_IMAGE_MB = 5

# Routes live on a router so deployments can mount them under a prefix
# (e.g. /api on Vercel) while local dev serves them at the root.
router = APIRouter()


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


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "model": MODEL}


@router.post("/analyze")
def analyze(
    req: AnalyzeRequest,
    x_anthropic_key: str | None = Header(default=None),
) -> dict:
    api_key = x_anthropic_key or os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="No API key. Send one in the X-Anthropic-Key header (it is used for this request only).",
        )

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
