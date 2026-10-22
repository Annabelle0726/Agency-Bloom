"""Isolated milestones: confirmation, ownership, concurrency, retention and pagination."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.journey import JourneyRecord
from app.main import create_app
from app.models import Feedback, Message


@pytest.fixture
def fixture(tmp_path):
    url = f"sqlite:///{tmp_path / 'journey.db'}"
    with TestClient(create_app(database_url=url)) as client:
        a = client.post("/api/auth/dev", json={"privacy_accepted": True}).json()
        b = client.post("/api/auth/dev", json={"privacy_accepted": True}).json()
        auth = {"Authorization": "Bearer " + a["token"]}
        other = {"Authorization": "Bearer " + b["token"]}
        issue = client.post("/api/issues", headers=auth, json={"title": "保留收入，试试产品方向"}).json()
        engine = create_engine(url)
        with Session(engine) as db:
            message = Message(issue_id=issue["id"], conversation_id=issue["id"], role="assistant",
                content="正常回复", payload={"insight": {"observation": "你提到喜欢需求分析",
                "possibility": "也许先尝试一次需求访谈", "uncertainty": "还需要亲身体验"},
                "reasoning_content": "MUST_NOT_LEAK"})
            db.add(message)
            db.commit()
            mid = message.id
        yield client, auth, other, issue, engine, mid
        engine.dispose()


def create(client, auth, issue, **extra):
    return client.post("/api/journey/records", headers=auth, json={
        "issue_id": issue["id"], "kind": "thought", "title": "先试一次",
        "text": "我想先体验一次需求访谈", **extra})


def test_pending_requires_confirmation_and_deduplicates(fixture):
    c, a, b, issue, _, mid = fixture
    assert c.get("/api/journey/events").status_code == 401
    assert len(c.get("/api/journey/events", headers=a).json()["items"]) == 1
    value = c.get("/api/journey/candidates", headers=a).json()["items"][0]
    assert value["id"] == mid
    assert "MUST_NOT_LEAK" not in str(value)
    assert c.get("/api/journey/candidates", headers=b).json()["items"] == []
    assert create(c, b, issue).status_code == 404
    assert create(c, a, issue, source_message_id=mid, source_version="0" * 64).status_code == 409
    saved = create(c, a, issue, source_message_id=mid, source_version=value["source_version"])
    assert saved.status_code == 201
    assert create(c, a, issue, source_message_id=mid, source_version=value["source_version"]).status_code == 409
    assert c.get("/api/journey/candidates", headers=a).json()["items"] == []
    assert len(c.get("/api/journey/events", headers=a).json()["items"]) == 2
    assert c.get("/api/journey/events/" + saved.json()["id"], headers=b).status_code == 404


def test_edit_delete_versions_and_independent_retention(fixture):
    c, a, _, issue, engine, mid = fixture
    value = c.get("/api/journey/candidates", headers=a).json()["items"][0]
    saved = create(c, a, issue, source_message_id=mid, source_version=value["source_version"]).json()
    path = "/api/journey/events/" + saved["id"]
    edited = c.put(path, headers=a, json={"title": "新名字", "text": "新的真实想法", "version": "1"})
    assert edited.status_code == 200
    assert c.put(path, headers=a, json={"title": "旧版本", "text": "不能覆盖", "version": "1"}).status_code == 409
    assert c.delete(path + "?version=1", headers=a).status_code == 409
    assert c.put(path, headers=a, json={"title": "无效版本", "text": "不能覆盖", "version": "9" * 64}).status_code == 409
    assert c.put("/api/me", headers=a, json={"save_chat": False}).status_code == 200
    retained = c.get(path, headers=a).json()
    assert retained["text"] == "新的真实想法"
    assert retained["source_available"] is False
    assert retained["source_text"] == ""
    assert c.get("/api/journey/candidates", headers=a).json()["items"] == []
    assert c.delete(path + "?version=2", headers=a).status_code == 204
    assert c.get(path, headers=a).status_code == 404
    with Session(engine) as db:
        row = db.scalar(select(JourneyRecord))
        assert row.text == "" and row.title == ""


def test_pagination_includes_old_feedback_and_never_card_updated_at(fixture):
    c, a, _, issue, engine, _ = fixture
    with Session(engine) as db:
        for index in range(115):
            db.add(Feedback(issue_id=issue["id"], kind="progress", text=f"记录 {index}",
                            created_at=f"2026-01-01T00:00:{index // 10:02d}.{index % 10}00000+00:00"))
        db.commit()
    seen, cursor = [], None
    while True:
        result = c.get("/api/journey/events", headers=a,
                       params={"limit": 17, **({"before": cursor} if cursor else {})}).json()
        seen.extend(item["id"] for item in result["items"])
        cursor = result["next_cursor"]
        if cursor is None:
            break
    assert len(seen) == len(set(seen)) == 116
    assert c.get("/api/journey/events?before=invalid", headers=a).status_code == 422
    card = issue["card"] | {"title": "改过的当前标题"}
    assert c.put(f"/api/issues/{issue['id']}/card", headers=a,
                 json={"version": issue["version"], "card": card}).status_code == 200
    start = c.get("/api/journey/events/start:" + issue["id"], headers=a).json()
    assert start["text"] == issue["title"]


def test_direction_is_versioned_and_records_actual_user_choice(fixture):
    c, a, b, issue, _, _ = fixture
    path = "/api/journey/directions/" + issue["id"]
    assert c.put(path, headers=b, json={"version": 1, "next_step": "越权"}).status_code == 404
    assert c.put(path, headers=a, json={"version": 1, "next_step": "做一次访谈"}).status_code == 200
    assert c.put(path, headers=a, json={"version": 1, "next_step": "旧修改"}).status_code == 409
    assert c.put(path, headers=a, json={"version": 2, "next_step": ""}).status_code == 200
    items = c.get("/api/journey/events", headers=a).json()["items"]
    assert [row["title"] for row in items[:2]] == ["放下这一步", "调整下一步"]
    current = c.get(f"/api/issues/{issue['id']}", headers=a).json()
    assert current["card"]["next_step"] == ""
    assert current["card"]["unknowns"] == issue["card"]["unknowns"]
    c.post(f"/api/issues/{issue['id']}/end", headers=a)
    assert c.put(path, headers=a, json={"version": 3, "next_step": "不能改"}).status_code == 409


def test_dismiss_does_not_enter_timeline_and_account_deletion_cascades(fixture):
    c, a, _, _, engine, mid = fixture
    pending = c.get("/api/journey/candidates", headers=a).json()["items"][0]
    assert c.post(f"/api/journey/candidates/{mid}/dismiss", headers=a,
                  json={"source_version": pending["source_version"]}).status_code == 204
    assert len(c.get("/api/journey/events", headers=a).json()["items"]) == 1
    assert c.get("/api/journey/candidates", headers=a).json()["items"] == []
    assert c.delete("/api/me", headers=a).status_code == 204
    with Session(engine) as db:
        assert db.scalar(select(JourneyRecord)) is None


def test_feedback_correction_and_source_removal(fixture):
    c, a, _, issue, _, _ = fixture
    c.post(f"/api/issues/{issue['id']}/feedback", headers=a, json={"kind": "change", "text": "原记录"})
    item = next(row for row in c.get("/api/journey/events", headers=a).json()["items"] if row["kind"] == "change")
    path = "/api/journey/events/" + item["id"]
    changed = c.put(path, headers=a, json={"title": item["title"], "text": "修正后的记录", "version": item["version"]})
    assert changed.status_code == 200
    assert changed.json()["source_text"] == "修正后的记录"
    assert c.delete(path + "?version=" + item["version"], headers=a).status_code == 409
    assert c.delete(path + "?version=" + changed.json()["version"], headers=a).status_code == 204


def test_unknown_save_retry_is_idempotent_and_source_is_unchanged(fixture):
    c, a, b, issue, _, _ = fixture
    key = "96ec9b6f-ef04-4b80-8fa8-d9366019ada2"
    first = create(c, a, issue, request_id=key)
    second = create(c, a, issue, request_id=key)
    assert first.status_code == second.status_code == 201
    assert first.json()["id"] == second.json()["id"]
    assert len(c.get("/api/journey/events", headers=a).json()["items"]) == 2
    assert create(c, a, issue, request_id=key, text="不同的内容").status_code == 409
    second_issue = c.post("/api/issues", headers=b, json={"title": "其他账号"}).json()
    assert create(c, b, second_issue, request_id=key).status_code == 409
