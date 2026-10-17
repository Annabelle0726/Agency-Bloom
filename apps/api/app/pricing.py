"""CNY rate card verified against DeepSeek's Chinese pricing page, 2026-10-17.

Reservation always uses peak/cache-miss prices. Settlement uses reported tokens
and provider creation time; unconfigured weekday holidays are a conservative
ceiling. This is a local cost estimate, not the provider's account invoice.
"""

from datetime import datetime, timezone
from decimal import ROUND_CEILING, Decimal
from zoneinfo import ZoneInfo


def token_count(usage, name, default=None):
    value = usage.get(name, default)
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError("Invalid token usage")
    return value


def price_usage(settings, usage, created=None):
    prompt = token_count(usage, "prompt_tokens")
    output = token_count(usage, "completion_tokens")
    hit = token_count(
        usage,
        "prompt_cache_hit_tokens",
        usage.get("prompt_tokens_details", {}).get("cached_tokens", 0),
    )
    miss = token_count(usage, "prompt_cache_miss_tokens", prompt - hit)
    if hit + miss != prompt or output > settings.max_output_tokens:
        raise ValueError("Inconsistent token usage")
    factor = Decimal(1)
    band = "peak_ceiling"
    if isinstance(created, int) and not isinstance(created, bool) and created > 0:
        moment = datetime.fromtimestamp(created, timezone.utc).astimezone(ZoneInfo("Asia/Shanghai"))
        peak = moment.weekday() < 5 and (9 <= moment.hour < 12 or 14 <= moment.hour < 18)
        if not peak or moment.date() in settings.deepseek_offpeak_dates:
            factor = settings.offpeak_price_multiplier
            band = "offpeak"
    input_price = settings.input_price_per_million * factor
    cache_price = settings.cached_input_price_per_million * factor
    output_price = settings.output_price_per_million * factor
    micro = (
        Decimal(miss) * input_price + Decimal(hit) * cache_price + Decimal(output) * output_price
    )
    return {
        "prompt_tokens": prompt,
        "completion_tokens": output,
        "total_tokens": prompt + output,
        "prompt_cache_hit_tokens": hit,
        "prompt_cache_miss_tokens": miss,
        "currency": "CNY",
        "price_version": "deepseek-flash-cny-2026-10-17",
        "price_band": band,
        "input_price_per_million": str(input_price),
        "cached_input_price_per_million": str(cache_price),
        "output_price_per_million": str(output_price),
        "cost_cny": format(micro / Decimal(1_000_000), "f"),
        "cost_micro": int(micro.to_integral_value(rounding=ROUND_CEILING)),
        "estimated": True,
    }
