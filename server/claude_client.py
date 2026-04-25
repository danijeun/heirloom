import base64
import json
import os
import re
import time
from typing import Any

from anthropic import Anthropic

MODEL = "claude-opus-4-7"

SYSTEM_PROMPT = (
    "You are assisting a family preserve a handwritten artifact in a possibly low-resource "
    "or endangered language or dialect. Your job is to produce a faithful transcription and "
    "a cautious draft translation. You are NOT the author; the human family member is. "
    "Flag every word you are uncertain about by character offsets in the transcription. "
    "Never invent content that is not visible in the image. If a portion is illegible, "
    "say so. Respond ONLY with valid JSON matching the requested schema, no prose."
)

USER_INSTRUCTION = (
    "Transcribe this handwritten artifact. Return JSON ONLY:\n"
    '{\n'
    '  "language_guess": "string (best guess at language/dialect)",\n'
    '  "transcription": "string (the transcribed text, faithful to the original)",\n'
    '  "translation": "string (cautious English draft translation)",\n'
    '  "uncertain_spans": [{"start": int, "end": int, "reason": "string"}]\n'
    "}\n"
    "Character offsets are into transcription. No markdown fences, no commentary."
)

_client: Anthropic | None = None


def client() -> Anthropic:
    global _client
    if _client is None:
        _client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _client


def _strip_fences(s: str) -> str:
    s = s.strip()
    s = re.sub(r"^```(?:json)?\s*", "", s)
    s = re.sub(r"\s*```$", "", s)
    return s


def transcribe_image(jpeg_bytes: bytes) -> dict[str, Any]:
    """Call Claude Opus 4.7 multimodal. Returns dict with parsed JSON + usage metadata."""
    b64 = base64.standard_b64encode(jpeg_bytes).decode()
    t0 = time.time()
    msg = client().messages.create(
        model=MODEL,
        max_tokens=2048,
        system=[
            {
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": b64,
                        },
                    },
                    {"type": "text", "text": USER_INSTRUCTION},
                ],
            }
        ],
    )
    latency_ms = int((time.time() - t0) * 1000)

    text_blocks = [b.text for b in msg.content if getattr(b, "type", None) == "text"]
    raw = _strip_fences("".join(text_blocks))
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"Claude returned non-JSON: {raw[:500]}") from e

    usage = msg.usage
    return {
        "parsed": parsed,
        "raw": raw,
        "model": MODEL,
        "latency_ms": latency_ms,
        "input_tokens": getattr(usage, "input_tokens", 0),
        "output_tokens": getattr(usage, "output_tokens", 0),
        "cache_read": getattr(usage, "cache_read_input_tokens", 0) or 0,
        "cache_write": getattr(usage, "cache_creation_input_tokens", 0) or 0,
    }
