import base64
import json
import os
import re
import time
from typing import Any

from anthropic import Anthropic

MODEL = "claude-opus-4-7"

SYSTEM_PROMPT = (
    "You are a multilingual paleographer and linguist helping a family preserve a handwritten "
    "artifact. The artifact may be in ANY language, script, or dialect on earth — including "
    "endangered, extinct, regional, creole, mixed-language, or undocumented varieties. "
    "You are a scribe, not the author. Your job is faithful transcription and a cautious draft "
    "translation into English. Never invent, normalize, or correct what is written.\n\n"

    "TRANSCRIPTION RULES:\n"
    "1. Reproduce the text exactly as written, including non-standard spelling, abbreviations, "
    "archaic forms, dialect features, and code-switching between languages.\n"
    "2. If the script is non-Latin (Arabic, Hebrew, Cyrillic, Devanagari, CJK, Ge'ez, Hangeul, "
    "Tamil, Thai, Georgian, Armenian, Tifinagh, Yi, etc.), transcribe in that native script. "
    "Do NOT romanize unless the original is romanized.\n"
    "3. If the handwriting is illegible at a spot, insert [?] in the transcription at that position.\n"
    "4. Preserve line breaks as they appear.\n\n"

    "TRANSLATION RULES:\n"
    "1. Produce a cautious English draft. Mark uncertain translations with (?).\n"
    "2. If the language is unknown or untranslatable, say so honestly and give your best guess.\n"
    "3. Do not paraphrase — stay close to the original word order and meaning.\n\n"

    "UNCERTAINTY RULES — be CONSERVATIVE. Only flag a word when you have a concrete, "
    "specific reason to doubt it. A clearly-written word in standard vocabulary that you "
    "translated confidently MUST NOT be flagged. It is correct and expected to return "
    "an empty uncertain_spans list for legible, standard text.\n"
    "Flag a span ONLY if one of these is concretely true:\n"
    "1. Ambiguous handwriting: a specific glyph in this word could be read as two different "
    "characters and you had to guess which.\n"
    "2. Physical damage on this word: smudged, torn, faded, ink-bled, or obscured.\n"
    "3. Untranslatable: you could not produce a confident English gloss for this word "
    "(unknown vocabulary, not in any dictionary you know).\n"
    "4. Proper noun or family-specific term whose referent only the family can confirm "
    "(personal name, nickname, place name, family recipe term).\n"
    "Do NOT flag a word merely because: it is in a minority/dialect language you can still "
    "read, it is a loanword you understand, the orthography is non-standard but legible, "
    "or you are unsure which dialect it belongs to. Legibility + a confident translation = "
    "not uncertain.\n\n"

    "SPAN RULES:\n"
    "- Each span covers exactly one token: one word, one morpheme cluster, or one [?] placeholder.\n"
    "- Never merge multiple words into one span.\n"
    "- CRITICAL: 'start' and 'end' are character offsets into 'transcription'. "
    "transcription[start:end] must equal the span 'text' field CHARACTER FOR CHARACTER. "
    "Count every character including accents and diacritics. Verify before outputting.\n"
    "- Prefer FEWER, higher-confidence flags over many speculative ones. An empty "
    "uncertain_spans list is the right answer when the text is clear.\n\n"

    "Respond ONLY with valid JSON matching the schema. No prose, no markdown fences."
)

USER_INSTRUCTION = (
    "Transcribe this handwritten artifact. Return JSON ONLY — no markdown fences, no commentary:\n"
    '{\n'
    '  "language_guess": "string — be maximally specific: language family, language, '
    'dialect/region, script if detectable.",\n'
    '  "transcription": "string — faithful copy in the original script and spelling",\n'
    '  "translation": "string — cautious English draft; use (?) for uncertain words",\n'
    '  "uncertain_spans": [\n'
    '    {\n'
    '      "start": int,\n'
    '      "end": int,\n'
    '      "text": "string",\n'
    '      "reason": "string",\n'
    '      "meaning_options": [\n'
    '        {"word": "string", "meaning": "string"},\n'
    '        {"word": "string", "meaning": "string"},\n'
    '        {"word": "string", "meaning": "string"}\n'
    "      ]\n"
    "    }\n"
    '  ]\n'
    "}\n"
    "uncertain_spans may be an empty list — and SHOULD be empty when the text is "
    "clearly legible and you translated it confidently. Do not invent uncertainty. "
    "For every uncertain span you DO include, provide exactly 3 meaning_options. Each option "
    "must be a plausible reading of that specific span text in context, with a short English gloss.\n"
    "BEFORE outputting each span, verify by counting characters from position 0 in transcription "
    "that transcription[start:end] == text. If they do not match, fix the offsets."
)

# Unicode-aware word-token pattern.
# Matches runs of non-whitespace, non-punctuation characters across ALL Unicode scripts:
# Latin+accents, CJK, Arabic, Hebrew, Cyrillic, Devanagari, Thai, Hangul, Ethiopic, etc.
_WORD_RE = re.compile(
    r"[^\s\u0020-\u002F\u003A-\u0040\u005B-\u0060\u007B-\u007E"
    r"\u00A0\u2000-\u206F\u2E00-\u2E7F\u3000-\u303F]+",
    re.UNICODE,
)

_client: Anthropic | None = None


def _normalize_meaning_options(span_text: str, meaning_options: list[dict]) -> list[dict]:
    normalized: list[dict] = []
    for option in meaning_options[:3]:
        meaning = str(option.get("meaning") or "").strip()
        if not meaning:
            continue
        normalized.append({"word": span_text, "meaning": meaning})

    while len(normalized) < 3:
        normalized.append(
            {
                "word": span_text,
                "meaning": "Possible reading or meaning is uncertain from the handwriting and context.",
            }
        )

    return normalized[:3]


def _snap_to_word_boundaries(transcription: str, spans: list[dict]) -> list[dict]:
    """
    Snap every uncertain span to clean word boundaries in `transcription`.

    Claude's character counting is sometimes off by 1–3 chars, or it returns a partial
    word (e.g. "chilhuat" instead of "chilhuate"), producing highlights that split a word
    mid-glyph. This function uses four strategies in order:

      1. Exact text match — find the word token whose text == claimed_text, nearest offset.
      2. Partial match  — claimed_text is a prefix/suffix/substring of a nearby token.
      3. Contains raw_start — take the token that physically contains raw_start.
      4. Nearest token  — raw_start fell in whitespace; take the closest token.

    Works for any Unicode script (Latin, Arabic, CJK, Devanagari, etc.) because _WORD_RE
    is script-agnostic. Deduplicates spans that resolve to the same (start, end).
    """
    word_tokens = [(m.start(), m.end(), m.group()) for m in _WORD_RE.finditer(transcription)]
    fixed: list[dict] = []
    seen: set[tuple[int, int]] = set()

    for span in spans:
        claimed_text = (span.get("text") or "").strip()
        raw_start    = int(span.get("start", 0))
        raw_end      = int(span.get("end", raw_start))
        reason       = span.get("reason", "")
        meaning_options = span.get("meaning_options") or []

        # Sort tokens by distance from reported offset for strategies 1 & 2
        candidates = sorted(word_tokens, key=lambda t: abs(t[0] - raw_start))

        best_start, best_end = None, None

        # Strategy 1: exact text match nearest to reported offset
        if claimed_text:
            for tok_start, tok_end, tok_text in candidates:
                if tok_text == claimed_text:
                    best_start, best_end = tok_start, tok_end
                    break

        # Strategy 2: claimed_text is a partial match of a nearby token
        # (handles Claude returning "chilhuat" for "chilhuate", etc.)
        if best_start is None and claimed_text:
            for tok_start, tok_end, tok_text in candidates[:10]:
                if (tok_text.startswith(claimed_text)
                        or tok_text.endswith(claimed_text)
                        or claimed_text in tok_text):
                    best_start, best_end = tok_start, tok_end
                    break

        # Strategy 3: take the word token that contains raw_start
        if best_start is None:
            for tok_start, tok_end, _ in word_tokens:
                if tok_start <= raw_start < tok_end:
                    best_start, best_end = tok_start, tok_end
                    break

        # Strategy 4: nearest token (raw_start fell in whitespace/punctuation)
        if best_start is None and word_tokens:
            nearest = min(word_tokens, key=lambda t: abs(t[0] - raw_start))
            best_start, best_end = nearest[0], nearest[1]

        if best_start is None or best_end is None or best_end <= best_start:
            continue
        if best_start < 0 or best_end > len(transcription):
            continue

        key = (best_start, best_end)
        if key in seen:
            continue
        seen.add(key)

        fixed.append({
            "start":  best_start,
            "end":    best_end,
            "text":   transcription[best_start:best_end],
            "reason": reason,
            "meaning_options": _normalize_meaning_options(
                transcription[best_start:best_end], meaning_options
            ),
        })

    return fixed


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

    transcription = parsed.get("transcription") or ""
    raw_spans = parsed.get("uncertain_spans") or []
    parsed["uncertain_spans"] = _snap_to_word_boundaries(transcription, raw_spans)

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
