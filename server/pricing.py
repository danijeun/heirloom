"""Anthropic claude-opus-4-7 pricing constants (USD per million tokens, Apr 2026)."""
INPUT_PER_MTOK_USD = 5.00
OUTPUT_PER_MTOK_USD = 25.00
CACHE_WRITE_PER_MTOK_USD = 6.25
CACHE_READ_PER_MTOK_USD = 0.50


def cost_cents(input_tokens: int, output_tokens: int,
               cache_read: int = 0, cache_write: int = 0) -> int:
    usd = (
        (input_tokens / 1_000_000) * INPUT_PER_MTOK_USD
        + (output_tokens / 1_000_000) * OUTPUT_PER_MTOK_USD
        + (cache_read / 1_000_000) * CACHE_READ_PER_MTOK_USD
        + (cache_write / 1_000_000) * CACHE_WRITE_PER_MTOK_USD
    )
    return round(usd * 100)
