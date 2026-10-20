"""Optional web grounding through the Bocha search API.

A turn is grounded only when the user explicitly enables web search for it
and a key is configured. Results are unverified external data: they are
injected as attributed, dated snippets, never as confirmed user facts, and
they can never mutate the decision card, memories, or phase records.
"""

from typing import Any

import httpx

from .config import Settings

SEARCH_ENDPOINT = "https://api.bochaai.com/v1/web-search"
MAX_RESULTS = 5


class WebSearchError(Exception):
    """Raised when grounding was requested but the provider call failed."""


def web_search_configured(settings: Settings) -> bool:
    return bool(settings.web_search_api_key.strip())


def search_web(settings: Settings, query: str, transport: httpx.BaseTransport | None = None) -> list[dict[str, Any]]:
    """Return at most MAX_RESULTS attributed results: name, url, snippet."""
    key = settings.web_search_api_key.strip()
    if not key:
        raise WebSearchError("search_not_configured")
    cleaned = query.strip()[:120]
    if not cleaned:
        return []
    try:
        with httpx.Client(
            timeout=settings.web_search_timeout_seconds,
            transport=transport if transport is not None else httpx.HTTPTransport(retries=0),
            follow_redirects=False,
        ) as client:
            response = client.post(
                SEARCH_ENDPOINT,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={
                    "query": cleaned,
                    "count": MAX_RESULTS,
                    "summary": True,
                    "freshness": "oneYear",
                },
            )
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise WebSearchError("search_failed") from exc
    raw = ((payload or {}).get("webPages") or {}).get("value") or []
    results: list[dict[str, Any]] = []
    for entry in raw[:MAX_RESULTS]:
        if not isinstance(entry, dict):
            continue
        name = str(entry.get("name") or "").strip()
        url = str(entry.get("url") or "").strip()
        snippet = str(entry.get("summary") or entry.get("snippet") or "").strip()
        if not url:
            continue
        results.append(
            {
                "name": name[:120],
                "url": url[:300],
                "snippet": snippet[:400],
                "site": url.split("/")[2] if url.startswith("http") and len(url.split("/")) > 2 else url[:80],
                "published": str(entry.get("dateLastCrawled") or "")[:10],
            }
        )
    return results
