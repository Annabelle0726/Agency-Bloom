"""Regression contracts only; scripted outputs are NOT model quality scores."""

import asyncio
import json
from pathlib import Path
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from test_ai_boundary import ready
from test_workspace import conversation, send
from test_workspace import workspace as evaluation_workspace

from app import ai
from app.config import Settings
from app.context_selection import memory_for_turn, select_history
from app.main import create_app
from app.pricing import price_usage
from app.psychology import casual
from app.response_reasoning import public_payload
from app.schemas import ChatInput

workspace = evaluation_workspace
CASES = json.loads((Path(__file__).parents[1] / "evaluation/cases.json").read_text(encoding="utf-8"))["cases"]
DIALOGUE = next(c for c in CASES if c["id"] == "D")["turns"]


@pytest.mark.parametrize("retained", [True, False])
def test_twelve_turn_continuity_remains_bounded_and_isolated(workspace, retained):
    client, auth, issue, captured = workspace
    client.put("/api/me", headers=auth, json={"save_chat": retained})
    conv = conversation(client, auth, issue)
    other = conversation(client, auth, issue, "Separate")
    assert send(client, auth, other, "FOREIGN_HISTORY_SENTINEL").status_code == 200
    history = []
    for turn in DIALOGUE:
        result = send(client, auth, conv, turn["user"], history=history[-32:])
        assert result.status_code == 200, result.text
        history += [{"role": "user", "content": turn["user"]},
                    {"role": "assistant", "content": result.json()["reply"]}]
    sent = captured[-1]["messages"]
    assert DIALOGUE[3]["user"] in [m["content"] for m in sent[2:-1]]
    assert len(sent[2:-1]) <= 12
    assert "FOREIGN_HISTORY_SENTINEL" not in json.dumps(sent)
    assert result.json()["supplied_context"]["history_count"] == len(sent[2:-1])
    stored = client.get(f"/api/conversations/{conv['id']}/messages", headers=auth).json()["items"]
    assert len(stored) == (24 if retained else 0)


def test_retrieval_does_not_reintroduce_older_unrelated_turns():
    history = [{"role": "user", "content": "职业选择必须保留收入"},
               {"role": "assistant", "content": "EARLIER_CAREER_ADVICE"}]
    history += [{"role": "user", "content": f"散步照片 {i}"} for i in range(10)]
    selected = select_history(history, "你好，今天有点想找人聊聊。")
    assert len(selected) == 8
    assert history[0] not in selected
    assert select_history(history, "换个话题，今晚吃什么") == history[-8:]


@pytest.mark.parametrize("message,pending", [
    ("最近换了工作，时间不一样了。", True),
    ("最近换了工作，时间没有变化。", False),
    ("如果换了工作，时间不一样了怎么办？", False),
    ("每周的时间安排仍然没变。", False),
])
def test_schedule_change_is_request_local_and_does_not_invent_replacement(message, pending):
    memory = {"id": "m", "content": "每周有两小时可以学习。",
              "category": "constraint", "status": "active", "version": 7}
    result = memory_for_turn(memory, message)
    assert result["status"] == ("needs_review" if pending else "active")
    assert memory["status"] == "active" and memory["version"] == 7
    assert result["content"] == memory["content"]


def test_mixed_greeting_keeps_explicit_request_and_relevant_history():
    assert not casual("你好，帮我比较软件工程师和 AI 产品经理")
    assert not casual("今天很累，但我需要职业选择建议")
    assert casual("今天好累，只想聊聊")


def pro_settings(**kwargs):
    return Settings(_env_file=None, ai_mode="deepseek", deepseek_api_key="mock",
                    deepseek_model="deepseek-v4-pro", **kwargs)


def test_reasoning_tokens_are_a_subset_not_an_extra_charge():
    settings = pro_settings()
    usage = {"prompt_tokens": 1000, "completion_tokens": 4096, "total_tokens": 5096,
             "completion_tokens_details": {"reasoning_tokens": 4000}}
    result = price_usage(settings, usage)
    assert result["reasoning_tokens"] == 4000
    assert result["non_reasoning_completion_tokens"] == 96
    assert result["cost_micro"] == 1000 * 9 + 4096 * 27
    assert price_usage(settings, {"prompt_tokens": 1, "completion_tokens": 1})["reasoning_tokens"] is None


@pytest.mark.parametrize("extra", [
    {"total_tokens": 999},
    {"completion_tokens_details": {"reasoning_tokens": 4097}},
    {"completion_tokens_details": {"reasoning_tokens": -1}},
    {"completion_tokens_details": {"reasoning_tokens": True}},
])
def test_inconsistent_usage_fails_closed(extra):
    with pytest.raises(ValueError):
        price_usage(pro_settings(), {"prompt_tokens": 1000, "completion_tokens": 4096, **extra})


@pytest.mark.parametrize("message,thinking,effort", [
    ("你好，今天有点想找人聊聊。", True, "low"),
    ("软件工程师和 AI 产品经理我应该怎么选", True, "high"),
    ("我今晚可能会伤害自己", True, "high"),
    ("你好", False, None),
])
async def test_thinking_policy_and_crisis_artifacts(message, thinking, effort):
    captured = []

    def provider(request):
        captured.append(json.loads(request.content))
        return httpx.Response(200, json={
            "choices": [{"finish_reason": "stop", "message": {
                "content": json.dumps({"reply": "这是虚构的契约测试回复，不代表安全或对话质量已验证",
                                       "suggestion": {"options": ["职业行动"]}, "tail_line": "继续职业分析"}),
                "reasoning_content": "PRIVATE_TRACE",
            }}],
            "usage": {"prompt_tokens": 100, "completion_tokens": 100},
        })
    body = ChatInput(request_id=uuid4(), message=message)
    result = await ai.generate(pro_settings(ai_thinking=thinking),
                               ai.messages_for({}, [], body), httpx.MockTransport(provider))
    assert captured[0].get("reasoning_effort") == effort
    assert captured[0]["max_tokens"] == 4096
    assert len(captured) == 1
    if "伤害自己" in message:
        assert result.output.suggestion is None and result.output.tail_line is None
    assert "PRIVATE_TRACE" not in result.output.model_dump_json()


async def test_total_deadline_cancels_slow_provider_without_retry():
    calls, cancelled = [], []

    async def slow(request):
        calls.append(request)
        try:
            await asyncio.sleep(5)
        finally:
            cancelled.append(True)
    settings = pro_settings().model_copy(update={"ai_timeout_seconds": 0.02})
    body = ChatInput(request_id=uuid4(), message="比较工作方向")
    with pytest.raises(httpx.TimeoutException):
        await ai.generate_with_deadline(settings, ai.messages_for({}, [], body),
                                        httpx.MockTransport(slow))
    assert len(calls) == 1 and cancelled == [True]


def test_failed_pro_reservation_survives_restart_and_rejects_replay(tmp_path):
    database = f"sqlite:///{tmp_path / 'persistent-budget.db'}"
    calls = []

    def truncated(request):
        calls.append(json.loads(request.content))
        return httpx.Response(200, json={
            "choices": [{"finish_reason": "length", "message": {"content": '{"reply":"partial'}}],
            "usage": {"prompt_tokens": 1000, "completion_tokens": 4096},
        })

    def app():
        return create_app(database_url=database, ai_mode="deepseek",
                          deepseek_model="deepseek-v4-pro", deepseek_api_key="mock",
                          ai_transport=httpx.MockTransport(truncated))
    request = {"request_id": str(uuid4()), "message": "比较职业选择"}
    with TestClient(app()) as client:
        auth, path = ready(client)
        result = client.post(path, headers=auth, json=request)
        assert result.status_code == 502 and result.json()["detail"]["code"] == "output_truncated"
    engine = create_engine(database)
    with engine.connect() as db:
        before = db.execute(text("SELECT used_micro FROM budgets")).scalar_one()
        assert before >= 4096 * 27
        assert db.execute(text("SELECT status FROM ai_requests")).scalar_one() == "failed"
    with TestClient(app()) as client:
        assert client.post(path, headers=auth, json=request).status_code == 409
    with engine.connect() as db:
        assert db.execute(text("SELECT used_micro FROM budgets")).scalar_one() == before
    engine.dispose()
    assert len(calls) == 1


def test_history_explanation_fails_closed_without_evidence_and_debug_fields():
    reply = "这是一句足够长的解释。另一条说明也是正文的一部分。"
    payload = {"reasoning_summary": [{"kind": "understanding", "text": "这是一句足够长的解释。"},
                                    {"kind": "basis", "text": "另一条说明也是正文的一部分。"}],
               "debug_log": "PRIVATE_DEBUG", "system_prompt": "PRIVATE_SYSTEM"}
    clean = public_payload(payload, reply)
    assert clean["reasoning_summary"] is None
    assert "PRIVATE_" not in json.dumps(clean)


def test_fixture_records_explicitly_leave_real_quality_and_human_review_unverified():
    report = json.loads((Path(__file__).parents[1] / "evaluation/baseline.json").read_text(encoding="utf-8"))
    assert report["paid_requests"] == 0 and report["semantic_quality"] == "not_verified"
    assert len(DIALOGUE) == 12
    for record in report["records"]:
        assert record["human_review"]["status"] == "pending"
        assert set(record["quality_dimensions"].values()) == {"not_assessed_mock"}


@pytest.mark.parametrize("private", [
    "<think>PRIVATE_COT</think>最终回复",
    "reasoning_content: PRIVATE_COT",
    "Traceback (most recent call last): PRIVATE_LOG",
    "   ",
])
def test_private_channels_in_visible_content_are_rejected(private):
    for content in (private, json.dumps({"reply": private})):
        with pytest.raises(ai.ProviderOutputError):
            ai.parse_output(content, allow_text=True)
