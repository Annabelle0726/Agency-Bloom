import json
from datetime import datetime
from decimal import Decimal
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from test_ai_boundary import ready

from app.ai import reservation_micro
from app.config import Settings
from app.main import create_app
from app.models import Message
from app.pricing import price_usage
from app.response_reasoning import evidence_catalog, ground_reasoning
from app.schemas import AIOutput

QUESTION = "我需要保留稳定收入，每周只能投入两小时"
TEXTS = ["你希望保留稳定收入，同时看看其他可能。",
         "每周只有两小时，先做一次短访谈比立刻辞职更合适。"]
REPLY = "\n".join(TEXTS)
RAW = "PRIVATE_TRACE_SENTINEL system prompt tool_calls secret"


def points(source="s1"):
    return [
        {"kind": "understanding", "text": TEXTS[0],
         "evidence": [{"source_id": source, "quote": "保留稳定收入"}]},
        {"kind": "tradeoff", "text": TEXTS[1],
         "evidence": [{"source_id": source, "quote": "每周只能投入两小时"}]},
    ]


@pytest.mark.parametrize("mutate", [
    lambda p: p[:1],
    lambda p: p * 2,
    lambda p: "raw private reasoning",
    lambda p: [dict(p[0], text="没有在实际回复出现的结论"), p[1]],
    lambda p: [dict(p[0], evidence=[{"source_id": "s99", "quote": "保留稳定收入"}]), p[1]],
    lambda p: [dict(p[0], evidence=[{"source_id": "s1", "quote": "用户没有说过的话"}]), p[1]],
    lambda p: [p[0], dict(p[1], kind="understanding")],
    lambda p: [dict(p[0], private_trace="secret"), p[1]],
])
def test_bad_optional_explanations_do_not_break_reply(mutate):
    result = AIOutput(reply=REPLY, reasoning_summary=mutate(points()))
    result = ground_reasoning(result, [{"id": "s1", "text": QUESTION}])
    assert result.reply == REPLY
    assert result.reasoning_summary is None


def test_catalog_excludes_instructions_hypotheses_and_unconfirmed_memory():
    catalog = evidence_catalog({
        "psychology_strategy": {"guidance": "PRIVATE_RULE"},
        "confirmed_card": {"hypotheses": ["UNCONFIRMED"], "confirmed": ["已确认约束"]},
        "memories_to_verify": [{"content": "UNVERIFIED"}],
    }, [{"role": "assistant", "content": "AI_GUESS"}], QUESTION)
    value = json.dumps(catalog, ensure_ascii=False)
    assert "已确认约束" in value
    assert all(word not in value for word in ["PRIVATE_RULE", "UNCONFIRMED", "UNVERIFIED", "AI_GUESS"])
    result = AIOutput(reply=REPLY, reasoning_summary=points())
    assert len(ground_reasoning(result, catalog).reasoning_summary) == 2
    assert ground_reasoning(result, catalog, summary_task=True).reasoning_summary is None


@pytest.mark.parametrize("retained", [True, False])
def test_api_never_returns_or_stores_raw_trace_and_restores_explanations(tmp_path, retained):
    calls = []

    def provider(request):
        body = json.loads(request.content)
        calls.append(body)
        context = json.loads(body["messages"][1]["content"].split("：", 1)[1])
        sid = next(s["id"] for s in context["response_evidence"] if s["text"] == QUESTION)
        return httpx.Response(200, json={
            "model": body["model"],
            "choices": [{"finish_reason": "stop", "message": {
                "content": json.dumps({"reply": REPLY, "reasoning_summary": points(sid)}, ensure_ascii=False),
                "reasoning_content": RAW,
            }}],
            "usage": {"prompt_tokens": 100, "completion_tokens": 200},
        })
    app = create_app(_env_file=None, database_url=f"sqlite:///{tmp_path / 'reasoning.db'}",
                     ai_mode="deepseek", deepseek_api_key="mock", ai_transport=httpx.MockTransport(provider))
    with TestClient(app) as client:
        auth, path = ready(client)
        client.put("/api/me", headers=auth, json={"save_chat": retained})
        result = client.post(path, headers=auth, json={"request_id": str(uuid4()), "message": QUESTION})
        assert result.status_code == 200, result.text
        assert len(result.json()["reasoning_summary"]) == 2
        assert "thinking_steps" not in result.text and RAW not in result.text
        assert len(calls) == 1
        conversations = client.get("/api/conversations", headers=auth).json()
        cid = conversations[0]["id"]
        history = client.get(f"/api/conversations/{cid}/messages", headers=auth).json()["items"]
        assert RAW not in json.dumps(history)
        if retained:
            assert len(history[-1]["payload"]["reasoning_summary"]) == 2
            engine = create_engine(f"sqlite:///{tmp_path / 'reasoning.db'}")
            with Session(engine) as db:
                row = db.scalar(select(Message).where(Message.role == "assistant"))
                assert RAW not in json.dumps(row.payload)
                row.payload = dict(row.payload, thinking_steps=[RAW], reasoning_content=RAW)
                db.commit()
            engine.dispose()
            restored = client.get(f"/api/conversations/{cid}/messages", headers=auth)
            assert RAW not in restored.text and "thinking_steps" not in restored.text
            assert len(restored.json()["items"][-1]["payload"]["reasoning_summary"]) == 2
        else:
            assert history == []


@pytest.mark.parametrize("model,input_rate,cache_rate,output_rate", [
    ("deepseek-flash", "2", "0.04", "8"),
    ("deepseek-v4-pro", "9", "0.30", "27"),
])
@pytest.mark.parametrize("hour,factor", [(10, Decimal(1)), (20, Decimal("0.5"))])
def test_model_aware_pricing_and_reservation(model, input_rate, cache_rate, output_rate, hour, factor):
    settings = Settings(_env_file=None, ai_mode="deepseek", deepseek_api_key="mock", deepseek_model=model)
    assert settings.ai_monthly_budget_cny == 100
    assert settings.max_output_tokens == 4096
    usage = {"prompt_tokens": 1000, "completion_tokens": 200,
             "prompt_cache_hit_tokens": 400, "prompt_cache_miss_tokens": 600}
    moment = int(datetime.fromisoformat(f"2026-10-20T{hour}:00:00+08:00").timestamp())
    receipt = price_usage(settings, usage, moment, model)
    expected = (600 * Decimal(input_rate) + 400 * Decimal(cache_rate) + 200 * Decimal(output_rate)) * factor
    assert Decimal(receipt["cost_cny"]) * 1_000_000 == expected
    assert receipt["priced_model"] == model and model in receipt["price_version"]
    assert reservation_micro(settings, [{"role": "user", "content": QUESTION}]) >= receipt["cost_micro"]


def test_stale_flash_overrides_and_unknown_models_fail_closed():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, deepseek_model="deepseek-v4-pro", input_price_per_million=2)
    with pytest.raises(ValidationError):
        Settings(_env_file=None, deepseek_model="unknown-model")
    with pytest.raises(ValueError):
        price_usage(Settings(_env_file=None), {"prompt_tokens": 100, "completion_tokens": 10},
                    provider_model="deepseek-v4-pro")
