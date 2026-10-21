"""CNY rate card verified against DeepSeek's Chinese pricing page, 2026-10-20.

Reservation always uses peak/cache-miss prices. Settlement uses reported tokens
and provider creation time; unconfigured weekday holidays are a conservative
ceiling. This is a local cost estimate, not the provider's account invoice.
"""

from datetime import datetime, timezone
from decimal import ROUND_CEILING, Decimal
from zoneinfo import ZoneInfo

RATE_CARDS = {
    "deepseek-flash": ("2", "0.04", "8"),
    "deepseek-v4-pro": ("9", "0.30", "27"),
}
MODEL_ALIASES = {
    "deepseek-v4-flash": "deepseek-flash",
    "deepseek-v4-flash-vision-exp": "deepseek-flash",
    "DeepSeek-V4.1-Flash-1017": "deepseek-flash",
    "DeepSeek-V4-Pro-0813": "deepseek-v4-pro",
}


def canonical_model(model):
    name = MODEL_ALIASES.get(model, model)
    if name not in RATE_CARDS:
        raise ValueError("Unsupported DeepSeek model rate card")
    return name


def model_rates(model):
    return tuple(Decimal(value) for value in RATE_CARDS[canonical_model(model)])


def token_count(usage, name, default=None):
    value = usage.get(name, default)
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError("Invalid token usage")
    return value


def price_usage(settings, usage, created=None, provider_model=None):
    model = canonical_model(settings.deepseek_model)
    if provider_model and canonical_model(provider_model) != model:
        raise ValueError("Provider model does not match reserved rate card")
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
        "price_version": f"{model}-cny-2026-10-20",
        "priced_model": model,
        "price_band": band,
        "input_price_per_million": str(input_price),
        "cached_input_price_per_million": str(cache_price),
        "output_price_per_million": str(output_price),
        "cost_cny": format(micro / Decimal(1_000_000), "f"),
        "cost_micro": int(micro.to_integral_value(rounding=ROUND_CEILING)),
        "estimated": True,
    }
