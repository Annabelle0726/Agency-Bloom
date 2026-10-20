import json
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from test_ai_boundary import ready

from app import ai
from app.config import Settings
from app.main import create_app
from app.schemas import AIOutput, ChatInput

CASES = [
    ("你好", "你好，今天想聊些什么？", None),
    ("我想你了", "听起来你此刻很想有人聊聊，今天过得怎么样？", None),
    ("我不知道自己未来做什么", "你过去做过的事情里，哪件事让你愿意继续了解？", None),
    (
        "程序员和 AI 产品经理，我应该怎么选择？",
        "可以先比较两条路的实际工作和你的收入约束，产品岗位的要求还需要核实",
        {
            "options": ["继续程序开发", "探索 AI 产品"],
            "hypotheses": ["可能对用户问题感兴趣"],
            "unknowns": ["目标岗位的真实要求"],
            "next_step": "了解一个实际产品岗位的日常",
        },
    ),
    ("我尝试过了，但失败了", "你之前联系公司的尝试没有得到回复，这次具体卡在哪一步？", None),
]


@pytest.mark.parametrize("message,reply,suggestion", CASES)
def test_intent_examples_use_optional_proposals_and_never_autosave(
    tmp_path, message, reply, suggestion
):
    captured = []

    def provider(request):
        sent = json.loads(request.content)
        captured.append(sent)
        assert sent["messages"][-1]["content"] == message
        assert sent["stream"] is False and sent["thinking"] == {"type": "enabled"}
        assert "tools" not in sent
        return httpx.Response(
            200,
            json={
                "id": "mock-intent",
                "model": "deepseek-flash",
                "created": 1792216800,
                "choices": [
                    {
                        "finish_reason": "stop",
                        "message": {
                            "content": json.dumps(
                                {"reply": reply, "suggestion": suggestion}, ensure_ascii=False
                            )
                        },
                    }
                ],
                "usage": {
                    "prompt_tokens": 100,
                    "completion_tokens": 80,
                    "prompt_cache_hit_tokens": 30,
                    "prompt_cache_miss_tokens": 70,
                },
            },
        )

    app = create_app(
        database_url=f"sqlite:///{tmp_path / 'intent.db'}",
        ai_mode="deepseek",
        deepseek_api_key="test-key",
        ai_transport=httpx.MockTransport(provider),
    )
    with TestClient(app) as client:
        auth, path = ready(client)
        issue_path = path.removesuffix("/chat")
        before = client.get(issue_path, headers=auth).json()
        client.post(
            issue_path + "/feedback",
            headers=auth,
            json={"kind": "stuck", "text": "联系了两家公司，都没有回复"},
        )
        result = client.post(
            path,
            headers=auth,
            json={
                "request_id": str(uuid4()),
                "message": message,
                "history": [{"role": "assistant", "content": "之前的讨论"}],
            },
        )
        assert result.status_code == 200
        assert result.json()["reply"] == reply
        assert result.json()["suggestion"] == suggestion
        assert len(captured) == 1
        context = json.loads(captured[0]["messages"][1]["content"].split("：", 1)[1])
        if message in ('你好', '我想你了'):
            assert context['current_issue'] == {}
            assert context['recent_feedback'] == []
        else:
            assert context["current_issue"]["title"] == before["title"]
            assert context["recent_feedback"][0]["text"] == "联系了两家公司，都没有回复"
        assert client.get(issue_path, headers=auth).json()["card"] == before["card"]
        # Retention defaults on: the completed turn is stored (never autosaving a card).
        stored = client.get(issue_path + "/messages", headers=auth).json()
        assert [m["content"] for m in stored] == [message, reply]
        receipt = result.json()["usage"]
        assert receipt["prompt_tokens"] == 100 and receipt["currency"] == "CNY"


def test_optional_suggestion_still_requires_a_reply():
    assert AIOutput.model_validate({"reply": "你好", "suggestion": None}).suggestion is None
    with pytest.raises(ValueError):
        AIOutput.model_validate({"reply": "", "suggestion": None})


def test_context_is_bounded_and_support_does_not_force_career_advice():
    body = ChatInput(request_id=uuid4(), message="我想你了", history=[])
    messages = ai.messages_for(
        {"confirmed": ["三年开发经验"]},
        [{"text": f"feedback {i}"} for i in range(20)],
        body,
        "act",
        current_issue={"title": "比较职业方向"},
    )
    context = json.loads(messages[1]["content"].split("：", 1)[1])
    assert len(context["recent_feedback"]) == 5
    assert "suggestion" in messages[0]["content"] and "null" in messages[0]["content"]
    assert "私人关系" in messages[0]["content"]
    assert "当前意图" in messages[0]["content"]


def test_cache_and_weekend_pricing_use_cny_without_resetting_old_usage():
    settings = Settings(_env_file=None, ai_mode="deepseek", deepseek_api_key="test-key")
    saturday = int(datetime(2026, 10, 17, 6, tzinfo=timezone.utc).timestamp())
    usage = {
        "prompt_tokens": 1000,
        "prompt_cache_hit_tokens": 600,
        "prompt_cache_miss_tokens": 400,
        "completion_tokens": 100,
    }
    receipt = ai.price_usage(settings, usage, saturday)
    assert receipt["cost_cny"] == "0.000812"
    assert receipt["cost_micro"] == 812
    assert receipt["input_price_per_million"] == "1.0"
    assert receipt["currency"] == "CNY"
    assert ai.reservation_micro(settings, [{"role": "user", "content": "你好"}]) >= 812
    assert settings.input_price_per_million == Decimal("2")


@pytest.mark.parametrize(
    "payload",
    [
        {"prompt_tokens": -1, "completion_tokens": 1},
        {"prompt_tokens": 10, "prompt_cache_hit_tokens": 11, "completion_tokens": 1},
        {
            "prompt_tokens": 10,
            "prompt_cache_hit_tokens": 4,
            "prompt_cache_miss_tokens": 9,
            "completion_tokens": 1,
        },
    ],
)
def test_invalid_token_usage_cannot_reduce_the_ledger(payload):
    with pytest.raises(ValueError):
        ai.price_usage(Settings(_env_file=None), payload, 1792216800)


def test_enabling_live_mode_preserves_historical_spend_and_records_usage_only(tmp_path):
    url = f"sqlite:///{tmp_path / 'existing.db'}"
    with TestClient(create_app(database_url=url)) as client:
        auth, path = ready(client)
        month = client.get("/api/usage", headers=auth).json()["month"]
    engine = create_engine(url)
    with engine.begin() as db:
        db.execute(
            text("INSERT INTO budgets(month,used_micro) VALUES(:month,1234567)"), {"month": month}
        )
        # Model an existing database without the additive usage column.
        db.execute(text("ALTER TABLE ai_requests DROP COLUMN usage"))

    def provider(request):
        return httpx.Response(
            200,
            json={
                "id": "mock-ledger",
                "model": "deepseek-flash",
                "choices": [{"message": {"content": '{"reply":"你好","suggestion":null}'}}],
                "usage": {"prompt_tokens": 100, "completion_tokens": 100},
            },
        )

    app = create_app(
        database_url=url,
        ai_mode="deepseek",
        deepseek_api_key="test-key",
        ai_transport=httpx.MockTransport(provider),
    )
    with TestClient(app) as client:
        assert client.get("/api/usage", headers=auth).json()["used_cny"] == 1.234567
        result = client.post(
            path, headers=auth, json={"request_id": str(uuid4()), "message": "你好", "history": []}
        )
        assert result.status_code == 200
        assert client.get("/api/usage", headers=auth).json()["used_cny"] == 1.235567
        with engine.connect() as db:
            saved = json.loads(db.execute(text("SELECT usage FROM ai_requests")).scalar())
        assert saved["provider_request_id"] == "mock-ledger"
        assert "messages" not in saved and "reply" not in saved
    engine.dispose()


def test_model_cannot_put_confirmed_facts_in_a_proposal_and_is_not_retried(tmp_path):
    calls = []

    def provider(request):
        calls.append(request)
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "reply": "我确认你适合产品",
                                    "suggestion": {"confirmed": ["适合产品"]},
                                }
                            )
                        }
                    }
                ],
                "usage": {"prompt_tokens": 10, "completion_tokens": 10},
            },
        )

    app = create_app(
        database_url=f"sqlite:///{tmp_path / 'facts.db'}",
        ai_mode="deepseek",
        deepseek_api_key="test-key",
        ai_transport=httpx.MockTransport(provider),
    )
    with TestClient(app) as client:
        auth, path = ready(client)
        before = client.get("/api/issues/current", headers=auth).json()["card"]
        response = client.post(
            path,
            headers=auth,
            json={"request_id": str(uuid4()), "message": "怎么选", "history": []},
        )
        assert response.status_code == 502
        assert len(calls) == 1
        assert client.get("/api/issues/current", headers=auth).json()["card"] == before


@pytest.mark.parametrize(
    "moment,band",
    [
        ("2026-10-19T00:59:59+00:00", "offpeak"),
        ("2026-10-19T01:00:00+00:00", "peak_ceiling"),
        ("2026-10-19T04:00:00+00:00", "offpeak"),
        ("2026-10-19T06:00:00+00:00", "peak_ceiling"),
        ("2026-10-19T10:00:00+00:00", "offpeak"),
    ],
)
def test_beijing_peak_boundaries(moment, band):
    receipt = ai.price_usage(
        Settings(_env_file=None),
        {"prompt_tokens": 100, "completion_tokens": 10},
        int(datetime.fromisoformat(moment).timestamp()),
    )
    assert receipt["price_band"] == band
