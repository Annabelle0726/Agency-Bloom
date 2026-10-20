"""Adaptive context and explicit phase changes through the real API + Mock provider."""

import json
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from test_journey import issue, login
from test_workspace import conversation, send
from test_workspace import workspace as adaptive_workspace

from app.main import create_app

workspace = adaptive_workspace


def context(captured):
    return json.loads(captured[-1]["messages"][1]["content"].split("：", 1)[1])


def memory(client, auth, **extra):
    result = client.post(
        "/api/memories",
        headers=auth,
        json={
            "content": "希望找到稳定工作",
            "confirmed": True,
            **extra,
        },
    )
    assert result.status_code == 201, result.text
    return result.json()


@pytest.mark.parametrize(
    "message, strategy",
    [
        ("你好，今天只想聊聊天", None),
        ("今天工作好累，不想规划", None),
        ("我想探索新的职业方向，做个小尝试", "life-design"),
        ("我纠结是否转行，帮我理清改变的原因", "motivation"),
        ("虽然害怕，但想按自己在意的价值行动", "values"),
        ("帮我向同事表达需要，怎么沟通", "communication"),
    ],
)
def test_selects_only_relevant_strategy_without_extra_request(workspace, message, strategy):
    client, auth, item, captured = workspace
    conv = conversation(client, auth, item)
    response = send(client, auth, conv, message)
    assert response.status_code == 200
    assert len(captured) == 1
    selected = context(captured).get("psychology_strategy")
    assert (selected["id"] if selected else None) == strategy


def test_phase_metadata_and_atomic_user_selected_history(workspace):
    client, auth, item, captured = workspace
    old = memory(client, auth, horizon="current_phase")
    assert old["status"] == "active"
    assert old["confirmed_at"] and old["last_verified_at"]
    path = f"/api/memories/{old['id']}/replace"
    body = {
        "version": old["version"],
        "content": "探索有成长空间的新方向",
        "confirmed": True,
        "keep_history": True,
    }
    assert client.post(path, headers=login(client), json=body).status_code == 404
    assert client.post(path, headers=auth, json={**body, "confirmed": False}).status_code == 422
    result = client.post(path, headers=auth, json=body)
    assert result.status_code == 201, result.text
    assert result.json()["horizon"] == "current_phase"
    records = client.get("/api/memories", headers=auth).json()
    assert next(m for m in records if m["id"] == old["id"])["status"] == "historical"
    assert client.post(path, headers=auth, json=body).status_code == 409
    new = result.json()
    result = client.post(
        f"/api/memories/{new['id']}/replace",
        headers=auth,
        json={
            **body,
            "version": new["version"],
            "keep_history": False,
            "content": "先做小规模探索",
        },
    )
    assert result.status_code == 201
    assert new["id"] not in [m["id"] for m in client.get("/api/memories", headers=auth).json()]
    assert captured == []


def test_topic_switch_does_not_supply_unrelated_memories_or_snapshot(workspace):
    client, auth, item, captured = workspace
    conv = conversation(client, auth, item)
    memory(client, auth)
    client.put("/api/me", headers=auth, json={"use_memory": True})
    response = send(client, auth, conv, "换个话题，聊聊今晚吃什么")
    assert response.status_code == 200
    data = context(captured)
    assert data["confirmed_memories"] == []
    assert data.get("initial_snapshot") is None
    assert data["exploration"] == {}
    assert response.json()["supplied_context"]["memories"] == []


def test_old_confirmed_memory_is_not_expired_but_pending_is_distinguished(workspace):
    client, auth, item, captured = workspace
    conv = conversation(client, auth, item)
    old = memory(client, auth, horizon="current_phase")
    pending = memory(client, auth, content="工作地点限制需要核实", status="needs_review")
    memory(client, auth, content="旧工作方向", status="historical")
    client.put("/api/me", headers=auth, json={"use_memory": True})
    assert send(client, auth, conv, "我想讨论工作方向").status_code == 200
    data = context(captured)
    assert data["current_phase"][0]["id"] == old["id"]
    assert data["memories_to_verify"][0]["id"] == pending["id"]
    assert "旧工作方向" not in json.dumps(data, ensure_ascii=False)


def test_snapshot_is_dated_owned_deletable_and_not_a_permanent_profile(workspace):
    client, auth, item, captured = workspace
    path = f"/api/issues/{item['id']}/snapshot"
    response = client.get(path, headers=auth)
    assert response.status_code == 200
    assert response.json()["captured_at"] == item["created_at"]
    assert response.json()["source"] == "onboarding"
    other = login(client)
    assert client.get(path, headers=other).status_code == 404
    assert client.delete(path + "?version=1", headers=other).status_code == 404
    assert client.delete(path + "?version=99", headers=auth).status_code == 409
    assert client.delete(path + "?version=1", headers=auth).status_code == 204
    assert client.get(path, headers=auth).json() is None
    conv = conversation(client, auth, item)
    send(client, auth, conv, "继续探索工作")
    assert context(captured).get("initial_snapshot") is None


@pytest.mark.parametrize(
    "message,dismiss,expected",
    [
        ("现在更想探索有成长空间的新工作方向", False, True),
        ("今天工作好累，只想休息", False, False),
        ("今天工作很累，现在想停一停", False, False),
        ("如果我决定转行会怎样", False, False),
        ("现在更想探索有成长空间的新工作方向", True, False),
        ("现在更想探索有成长空间的新工作方向", "persisted", False),
        ("换个话题，聊聊今晚吃什么", False, False),
    ],
)
def test_untrusted_change_candidate_never_saves_and_respects_skip(
    tmp_path, message, dismiss, expected
):
    captured = []
    source = {}

    def provider(request):
        captured.append(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "reply": "先尊重你现在的想法",
                                    "suggestion": None,
                                    "phase_change": {
                                        "source_id": source["id"],
                                        "evidence": message,
                                    },
                                }
                            )
                        }
                    }
                ],
                "usage": {"prompt_tokens": 100, "completion_tokens": 60},
            },
        )

    app = create_app(
        database_url=f"sqlite:///{tmp_path / 'change.db'}",
        ai_mode="deepseek",
        deepseek_api_key="mock-only",
        ai_transport=httpx.MockTransport(provider),
    )
    with TestClient(app) as client:
        auth = login(client)
        item = issue(client, auth)
        conv = conversation(client, auth, item)
        source.update(memory(client, auth, horizon="current_phase"))
        client.put("/api/me", headers=auth, json={"ai_consent": True, "use_memory": True})
        before = client.get("/api/memories", headers=auth).json()
        if dismiss == "persisted":
            response = client.put(
                f"/api/conversations/{conv['id']}",
                headers=auth,
                json={
                    "version": conv["version"],
                    "dismissed_change_ids": [source["id"]],
                },
            )
            assert response.status_code == 200, response.text
        result = send(
            client, auth, conv, message, dismissed_changes=[source["id"]] if dismiss is True else []
        )
        assert result.status_code == 200, result.text
        assert bool(result.json().get("phase_change")) == expected
        if expected:
            assert result.json()["phase_change"]["source_version"] == source["version"]
            assert result.json()["phase_change"]["previous"] == source["content"]
        assert client.get("/api/memories", headers=auth).json() == before
        assert len(captured) == 1


def test_new_phase_excludes_initial_card_background_and_snapshot(workspace):
    client, auth, item, captured = workspace
    conv = conversation(client, auth, item)
    memory(client, auth, horizon="current_phase", content="现在探索成长空间更大的工作")
    client.put("/api/me", headers=auth, json={"use_memory": True})
    send(client, auth, conv, "讨论新的工作方向")
    data = context(captured)
    assert data.get("initial_snapshot") is None
    assert item["background"] not in json.dumps(data, ensure_ascii=False)


def test_snapshot_phase_save_requires_explicit_confirmation_and_version(workspace):
    client, auth, item, captured = workspace
    path = f"/api/issues/{item['id']}/phase"
    body = {
        "version": item["version"],
        "content": "探索有成长空间的新工作",
        "confirmed": True,
        "keep_history": False,
    }
    assert client.post(path, headers=login(client), json=body).status_code == 404
    assert client.post(path, headers=auth, json={**body, "confirmed": False}).status_code == 422
    assert client.post(path, headers=auth, json={**body, "version": 99}).status_code == 409
    result = client.post(path, headers=auth, json=body)
    assert result.status_code == 201, result.text
    assert result.json()["horizon"] == "current_phase"
    assert result.json()["issue_id"] == item["id"]
    assert client.get(f"/api/issues/{item['id']}/snapshot", headers=auth).json() is None
    assert client.post(path, headers=auth, json=body).status_code == 409
    assert captured == []


def test_legacy_chat_uses_the_same_relevant_context_and_no_profile(workspace):
    client, auth, item, captured = workspace
    result = client.post(
        f"/api/issues/{item['id']}/chat",
        headers=auth,
        json={
            "request_id": uuid4().hex,
            "message": "你好，今天只想聊聊天",
        },
    )
    assert result.status_code == 200
    assert context(captured)["confirmed_card"] == {}
    assert context(captured)["exploration"] == {}


def test_toggling_legacy_payload_preserves_phase_status_and_verification(workspace):
    client, auth, item, captured = workspace
    record = memory(client, auth, horizon="current_phase", status="needs_review")
    response = client.put(
        f"/api/memories/{record['id']}",
        headers=auth,
        json={
            "content": record["content"],
            "confirmed": True,
            "version": 1,
            "enabled": False,
        },
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["status"] == "needs_review"
    assert updated["horizon"] == "current_phase"
    assert updated["last_verified_at"] == record["last_verified_at"]


def test_month_old_snapshot_yields_to_current_confirmed_direction(workspace):
    from sqlalchemy import update

    from app.models import Issue, Memory

    client, auth, item, captured = workspace
    record = memory(client, auth, horizon="current_phase", content="稳定工作")
    route = next(r for r in client.app.routes if r.path == "/api/conversations")
    dependency = next(d.call for d in route.dependant.dependencies if d.name == "db")
    generator = dependency()
    db = next(generator)
    db.execute(
        update(Issue).where(Issue.id == item["id"]).values(created_at="2026-09-19T00:00:00+00:00")
    )
    db.execute(
        update(Memory)
        .where(Memory.id == record["id"])
        .values(
            created_at="2020-01-01T00:00:00+00:00", last_verified_at="2020-01-01T00:00:00+00:00"
        )
    )
    db.commit()
    generator.close()
    client.put("/api/me", headers=auth, json={"use_memory": True})
    conv = conversation(client, auth, item)
    send(client, auth, conv, "现在更想探索有成长空间的新工作方向")
    data = context(captured)
    assert data["current_phase"][0]["content"] == "稳定工作"
    assert data["current_phase"][0]["status"] == "active"  # Age never marks it stale.
    assert data["initial_snapshot"] is None
    assert captured[-1]["messages"][-1]["content"] == "现在更想探索有成长空间的新工作方向"
    assert client.get("/api/memories", headers=auth).json()[0]["content"] == "稳定工作"


def test_snapshot_keeps_original_direction_when_card_title_changes(workspace):
    client, auth, item, captured = workspace
    response = client.put(
        f"/api/issues/{item['id']}/card",
        headers=auth,
        json={
            "version": 1,
            "card": {**item["card"], "title": "修改后的探索名称"},
        },
    )
    assert response.status_code == 200
    snapshot = client.get(f"/api/issues/{item['id']}/snapshot", headers=auth).json()
    assert snapshot["direction"] == item["title"]
    assert snapshot["constraints"] == ["收入稳定"]


def test_retaining_snapshot_does_not_promote_old_card_to_current_facts(workspace):
    client, auth, item, captured = workspace
    response = client.post(
        f"/api/issues/{item['id']}/phase",
        headers=auth,
        json={
            "version": 1,
            "content": "探索成长空间更大的工作",
            "confirmed": True,
            "keep_history": True,
        },
    )
    assert response.status_code == 201
    client.put("/api/me", headers=auth, json={"use_memory": True})
    conv = conversation(client, auth, item)
    send(client, auth, conv, "讨论工作方向")
    assert context(captured)["confirmed_card"] == {}
    assert context(captured)["current_issue"] == {}


def test_replacement_source_is_current_owned_conversation(workspace):
    client, auth, item, captured = workspace
    old = memory(client, auth, horizon="current_phase")
    conv = conversation(client, auth, item)
    other_auth = login(client)
    other_issue = issue(client, other_auth)
    other_conv = conversation(client, other_auth, other_issue)
    body = {
        "version": 1,
        "content": "探索新的工作",
        "confirmed": True,
        "source_conversation_id": other_conv["id"],
    }
    path = f"/api/memories/{old['id']}/replace"
    assert client.post(path, headers=auth, json=body).status_code == 404
    response = client.post(path, headers=auth, json={**body, "source_conversation_id": conv["id"]})
    assert response.status_code == 201
    assert response.json()["source_conversation_id"] == conv["id"]
