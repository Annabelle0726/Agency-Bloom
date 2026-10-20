"""Per-turn web grounding: explicit opt-in, attributed data, graceful degradation."""

import json
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from test_ai_boundary import ready

from app.main import create_app


@pytest.fixture
def search_workspace(tmp_path):
    captured, search_calls = [], []

    def provider(request):
        captured.append(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "choices": [
                    {"finish_reason": "stop", "message": {"content": '{"reply":"好","suggestion":null}'}}
                ],
                "usage": {"prompt_tokens": 10, "completion_tokens": 10},
            },
        )

    def search_handler(request):
        search_calls.append(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "webPages": {
                    "value": [
                        {
                            "name": "职业转换报告",
                            "url": "https://example.com/report",
                            "summary": "2025 年行业转换的平均准备期是六个月",
                            "dateLastCrawled": "2026-01-05T00:00:00Z",
                        }
                    ]
                }
            },
        )

    app = create_app(
        database_url=f"sqlite:///{tmp_path / 'web.db'}",
        ai_mode="deepseek",
        deepseek_api_key="test-key",
        web_search_api_key="search-key",
        ai_transport=httpx.MockTransport(provider),
        web_search_transport=httpx.MockTransport(search_handler),
    )
    with TestClient(app) as client:
        auth, path = ready(client)
        yield client, auth, path, captured, search_calls


def test_search_runs_only_for_an_explicit_per_turn_opt_in(search_workspace):
    client, auth, path, captured, search_calls = search_workspace
    # Default turn: no search call, no web block in the prompt.
    first = client.post(
        path, headers=auth, json={"request_id": str(uuid4()), "message": "你好", "history": []}
    )
    assert first.status_code == 200
    assert search_calls == []
    assert "web_search_results" not in captured[-1]["messages"][1]["content"]
    # Explicit opt-in: one search call, attributed results reach the prompt.
    second = client.post(
        path,
        headers=auth,
        json={"request_id": str(uuid4()), "message": "转行一般要多久", "history": [], "web_search": True},
    )
    assert second.status_code == 200
    assert len(search_calls) == 1
    context = json.loads(captured[-1]["messages"][1]["content"].split("：", 1)[1])
    results = context["web_search_results"]
    assert results[0]["url"] == "https://example.com/report"
    assert results[0]["snippet"].startswith("2025 年")
    assert results[0]["site"] == "example.com"
    # The response exposes the same sources for attribution in the UI.
    assert second.json()["web_sources"][0]["url"] == "https://example.com/report"


def test_search_failure_degrades_to_a_normal_turn(tmp_path):
    captured = []

    def provider(request):
        captured.append(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "choices": [{"finish_reason": "stop", "message": {"content": '{"reply":"好","suggestion":null}'}}],
                "usage": {"prompt_tokens": 10, "completion_tokens": 10},
            },
        )

    def failing_search(request):
        return httpx.Response(500, json={"error": "down"})

    app = create_app(
        database_url=f"sqlite:///{tmp_path / 'fail.db'}",
        ai_mode="deepseek",
        deepseek_api_key="test-key",
        web_search_api_key="search-key",
        ai_transport=httpx.MockTransport(provider),
        web_search_transport=httpx.MockTransport(failing_search),
    )
    with TestClient(app) as client:
        auth, path = ready(client)
        result = client.post(
            path,
            headers=auth,
            json={"request_id": str(uuid4()), "message": "查一下", "history": [], "web_search": True},
        )
        assert result.status_code == 200
        assert "web_search_results" not in captured[-1]["messages"][1]["content"]


def test_unconfigured_key_runs_an_ungrounded_turn(tmp_path):
    def provider(request):
        return httpx.Response(
            200,
            json={
                "choices": [{"finish_reason": "stop", "message": {"content": '{"reply":"好","suggestion":null}'}}],
                "usage": {"prompt_tokens": 10, "completion_tokens": 10},
            },
        )

    app = create_app(
        database_url=f"sqlite:///{tmp_path / 'nokey.db'}",
        ai_mode="deepseek",
        deepseek_api_key="test-key",
        ai_transport=httpx.MockTransport(provider),
    )
    with TestClient(app) as client:
        auth, path = ready(client)
        result = client.post(
            path,
            headers=auth,
            json={"request_id": str(uuid4()), "message": "查一下", "history": [], "web_search": True},
        )
        assert result.status_code == 200
        assert "web_sources" not in result.json()


def test_search_results_cannot_reach_confirmed_card_fields(tmp_path):
    """The prompt instruction must forbid promoting search hits into facts."""
    from app import ai
    from app.schemas import ChatInput

    body = ChatInput(request_id=uuid4(), message="查证")
    messages = ai.messages_for(
        {"confirmed": []},
        [],
        body,
        "discover",
        web_results=[{"name": "报告", "url": "https://example.com", "snippet": "数据", "site": "example.com"}],
    )
    system = messages[0]["content"]
    assert "web_search_results" in system
    assert "根据网上资料" in system
    assert "不把搜索结果写入 confirmed" in system
    context = json.loads(messages[1]["content"].split("：", 1)[1])
    assert context["web_search_results"][0]["url"] == "https://example.com"
