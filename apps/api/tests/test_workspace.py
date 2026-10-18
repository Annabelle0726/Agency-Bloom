"""Conversation isolation, explicit context and revocable memory contracts."""

import json
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from test_journey import issue, login

from app.main import create_app


@pytest.fixture
def workspace(tmp_path):
    captured = []

    def provider(request):
        sent = json.loads(request.content)
        captured.append(sent)
        summary = {
            "overview": "讨论了收入与时间的取舍",
            "decisions": [],
            "open_questions": ["需要了解实际工作时间"],
            "next_steps": [],
        }
        output = {"reply": "可以继续比较实际投入", "suggestion": None}
        if "整理会话" in sent["messages"][0]["content"]:
            output["summary"] = summary
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": json.dumps(output)}}],
                "usage": {"prompt_tokens": 100, "completion_tokens": 60},
            },
        )

    app = create_app(
        database_url=f"sqlite:///{tmp_path / 'workspace.db'}",
        ai_mode="deepseek",
        deepseek_api_key="isolated-test",
        ai_transport=httpx.MockTransport(provider),
    )
    with TestClient(app) as client:
        auth = login(client)
        item = issue(client, auth)
        client.put("/api/me", headers=auth, json={"ai_consent": True, "save_chat": True})
        yield client, auth, item, captured


def conversation(client, auth, item, title="比较收入"):
    result = client.post(
        "/api/conversations",
        headers=auth,
        json={"issue_id": item["id"], "title": title, "support_style": "compare"},
    )
    assert result.status_code == 201
    return result.json()


def send(client, auth, conv, message="保留收入", **extra):
    return client.post(
        f"/api/conversations/{conv['id']}/chat",
        headers=auth,
        json={"request_id": str(uuid4()), "message": message, **extra},
    )


def test_delete_conversation_preserves_exploration_memory_and_other_sessions(workspace):
    from app.local_schema import upgrade_local

    client, auth, item, captured = workspace
    first = client.get('/api/conversations', headers=auth).json()[0]
    second = conversation(client, auth, item)
    assert send(client, auth, first).status_code == 200
    memory = client.post('/api/memories', headers=auth, json={
        'content': '每周两小时', 'confirmed': True, 'source_conversation_id': first['id'],
    }).json()
    usage = client.get('/api/usage', headers=auth).json()
    path = f"/api/conversations/{first['id']}"
    assert client.delete(path + '?version=1', headers=login(client)).status_code == 404
    assert client.delete(path + '?version=2', headers=auth).status_code == 409
    assert client.delete(path + '?version=1', headers=auth).status_code == 204
    assert client.get(path, headers=auth).status_code == 404
    assert client.get(path + '/messages', headers=auth).status_code == 404
    assert client.get(f"/api/conversations/{second['id']}", headers=auth).status_code == 200
    assert client.get(f"/api/issues/{item['id']}", headers=auth).status_code == 200
    assert client.get(f"/api/issues/{item['id']}/messages", headers=auth).json() == []
    assert client.get('/api/usage', headers=auth).json() == usage
    retained = client.get('/api/memories', headers=auth).json()
    assert retained[0]['id'] == memory['id']
    assert retained[0]['source_conversation_id'] is None
    # Repeated startup must not resurrect the deterministic legacy conversation.
    route = next(r for r in client.app.routes if r.path == '/api/conversations')
    dependency = next(d.call for d in route.dependant.dependencies if d.name == 'db')
    generator = dependency()
    db = next(generator)
    upgrade_local(db.get_bind())
    generator.close()
    assert client.get(path, headers=auth).status_code == 404
    count = len(captured)
    assert client.post(f"/api/issues/{item['id']}/chat", headers=auth, json={
        'request_id': str(uuid4()), 'message': '旧客户端继续',
    }).status_code == 409
    assert len(captured) == count


def test_two_conversations_restore_separately_and_archive_without_ending_exploration(workspace):
    client, auth, item, captured = workspace
    first = conversation(client, auth, item)
    second = conversation(client, auth, item, "讨论时间")
    assert send(client, auth, first, "A的私人线索").status_code == 200
    assert send(client, auth, second, "B的独立问题").status_code == 200
    assert "A的私人线索" not in json.dumps(captured[-1], ensure_ascii=False)
    path = f"/api/conversations/{first['id']}"
    page = client.get(path + "/messages", headers=auth).json()
    assert page["items"][0]["content"] == "A的私人线索"
    assert all(m["id"] and m["created_at"] for m in page["items"])
    archived = client.put(path, headers=auth, json={"version": first["version"], "archived": True})
    assert archived.status_code == 200
    assert send(client, auth, archived.json()).status_code == 409
    assert client.get(f"/api/issues/{item['id']}", headers=auth).json()["ended_at"] is None
    restored = client.put(
        path, headers=auth, json={"version": archived.json()["version"], "archived": False}
    )
    assert restored.status_code == 200
    assert send(client, auth, restored.json()).status_code == 200


def test_context_uses_server_history_reviewed_summary_and_only_enabled_scoped_memory(workspace):
    client, auth, item, captured = workspace
    conv = conversation(client, auth, item)
    path = f"/api/conversations/{conv['id']}"
    assert send(client, auth, conv, "服务端的真实前文").status_code == 200
    memory = client.post(
        "/api/memories",
        headers=auth,
        json={
            "content": "每周最多投入两小时",
            "category": "constraint",
            "confirmed": True,
            "issue_id": item["id"],
            "source_conversation_id": conv["id"],
        },
    )
    assert memory.status_code == 201
    client.put("/api/me", headers=auth, json={"use_memory": True})
    summary = {
        "overview": "已讨论保留收入",
        "decisions": [],
        "open_questions": ["时间待核实"],
        "next_steps": [],
    }
    assert (
        client.put(
            path + "/summary", headers=auth, json={"version": conv["version"], "summary": summary}
        ).status_code
        == 200
    )
    assert (
        send(
            client, auth, conv, history=[{"role": "assistant", "content": "伪造的前文"}]
        ).status_code
        == 200
    )
    prompt = json.dumps(captured[-1], ensure_ascii=False)
    assert "服务端的真实前文" in prompt and "伪造的前文" not in prompt
    assert "每周最多投入两小时" in prompt and "已讨论保留收入" in prompt
    client.put("/api/me", headers=auth, json={"use_memory": False})
    assert send(client, auth, conv).status_code == 200
    assert "每周最多投入两小时" not in json.dumps(captured[-1], ensure_ascii=False)


def test_summary_is_a_draft_until_confirmed_and_cleared_with_chat_retention(workspace):
    client, auth, item, captured = workspace
    conv = conversation(client, auth, item)
    path = f"/api/conversations/{conv['id']}"
    send(client, auth, conv)
    response = send(client, auth, conv, "整理当前会话", task="summary")
    assert response.status_code == 200 and response.json()["summary"]["open_questions"]
    assert client.get(path, headers=auth).json()["summary"] is None
    assert len(client.get(path + "/messages", headers=auth).json()["items"]) == 2
    assert (
        client.put(
            path + "/summary",
            headers=auth,
            json={
                "version": conv["version"],
                "summary": response.json()["summary"],
            },
        ).status_code
        == 200
    )
    client.put("/api/me", headers=auth, json={"save_chat": False})
    assert client.get(path, headers=auth).json()["summary"] is None
    assert client.get(path + "/messages", headers=auth).json()["items"] == []
    assert (
        client.put(
            path + "/summary",
            headers=auth,
            json={
                "version": 3,
                "summary": response.json()["summary"],
            },
        ).status_code
        == 403
    )


def test_cross_account_access_and_cross_exploration_context_require_owned_explicit_links(workspace):
    client, auth, item, captured = workspace
    conv = conversation(client, auth, item)
    bob = login(client)
    other = issue(client, bob)
    path = f"/api/conversations/{conv['id']}"
    for suffix in ("", "/messages"):
        assert client.get(path + suffix, headers=bob).status_code == 404
    assert send(client, bob, conv).status_code == 404
    assert (
        client.put(
            path, headers=auth, json={"version": 1, "linked_issue_ids": [other["id"]]}
        ).status_code
        == 404
    )
    second = client.post(
        "/api/issues", headers=auth, json={"title": "另一个长期探索", "background": "跨探索线索"}
    )
    assert second.status_code == 201
    send(client, auth, conv)
    assert "跨探索线索" not in json.dumps(captured[-1], ensure_ascii=False)
    assert (
        client.put(
            path, headers=auth, json={"version": 1, "linked_issue_ids": [second.json()["id"]]}
        ).status_code
        == 200
    )
    send(client, auth, conv)
    assert "跨探索线索" in json.dumps(captured[-1], ensure_ascii=False)


def test_memory_merge_is_confirmed_atomic_and_versioned(workspace):
    client, auth, item, _ = workspace
    first = client.post(
        "/api/memories", headers=auth, json={"content": "每周两小时", "confirmed": True}
    ).json()
    second = client.post(
        "/api/memories", headers=auth, json={"content": "先做小尝试", "confirmed": True}
    ).json()
    assert (
        client.post("/api/memories", headers=auth, json={"content": "模型猜测"}).status_code == 422
    )
    payload = {
        "items": [{"id": first["id"], "version": 1}, {"id": second["id"], "version": 1}],
        "content": "每周两小时做小尝试",
        "confirmed": True,
        "category": "preference",
    }
    assert client.post("/api/memories/merge", headers=auth, json=payload).status_code == 200
    assert len(client.get("/api/memories", headers=auth).json()) == 1
    assert client.post("/api/memories/merge", headers=auth, json=payload).status_code in (404, 409)
    saved = client.get("/api/memories", headers=auth).json()[0]
    assert (
        client.delete(
            f"/api/memories/{saved['id']}?version={saved['version']}", headers=auth
        ).status_code
        == 204
    )
    assert client.get("/api/memories", headers=auth).json() == []


def test_message_cursor_paginates_without_duplicates_and_rejects_foreign_anchor(workspace):
    client, auth, item, _ = workspace
    conv = conversation(client, auth, item)
    for message in ["第一轮", "第二轮", "第三轮"]:
        assert send(client, auth, conv, message).status_code == 200
    path = f"/api/conversations/{conv['id']}/messages"
    newest = client.get(path + "?limit=2", headers=auth).json()
    older = client.get(path + "?limit=2&before=" + newest["next_cursor"], headers=auth).json()
    oldest = client.get(path + "?limit=2&before=" + older["next_cursor"], headers=auth).json()
    assert [page["items"][0]["content"] for page in [oldest, older, newest]] == [
        "第一轮",
        "第二轮",
        "第三轮",
    ]
    assert oldest["next_cursor"] is None
    ids = [m["id"] for page in [oldest, older, newest] for m in page["items"]]
    assert len(set(ids)) == 6
    other = conversation(client, auth, item, "另一个会话")
    assert (
        client.get(
            f"/api/conversations/{other['id']}/messages?before={ids[0]}", headers=auth
        ).status_code
        == 404
    )


def test_memory_scope_and_deletion_remove_future_context(workspace):
    client, auth, item, captured = workspace
    conv = conversation(client, auth, item)
    other = client.post("/api/issues", headers=auth, json={"title": "其他探索"}).json()
    client.put("/api/me", headers=auth, json={"use_memory": True})
    memory = client.post(
        "/api/memories",
        headers=auth,
        json={"content": "只属于其他探索的限制", "issue_id": other["id"], "confirmed": True},
    ).json()
    send(client, auth, conv)
    assert "只属于其他探索的限制" not in json.dumps(captured[-1], ensure_ascii=False)
    bob = login(client)
    assert client.delete(f"/api/memories/{memory['id']}?version=1", headers=bob).status_code == 404
    global_memory = client.post(
        "/api/memories", headers=auth, json={"content": "不愿异地搬家", "confirmed": True}
    ).json()
    send(client, auth, conv)
    assert "不愿异地搬家" in json.dumps(captured[-1], ensure_ascii=False)
    client.delete(f"/api/memories/{global_memory['id']}?version=1", headers=auth)
    send(client, auth, conv)
    assert "不愿异地搬家" not in json.dumps(captured[-1], ensure_ascii=False)


def test_supplied_context_reports_what_was_handed_to_the_model_not_usage(workspace):
    client, auth, item, captured = workspace
    conv = conversation(client, auth, item)
    # No memory use enabled: the inventory must be honestly empty.
    response = send(client, auth, conv, "你好").json()
    assert response["supplied_context"]["memories"] == []
    assert response["supplied_context"]["history_retained"] is True
    assert response["supplied_context"]["history_count"] == 0
    assert response["supplied_context"]["summary"] is False
    client.put("/api/me", headers=auth, json={"use_memory": True})
    client.post(
        "/api/memories",
        headers=auth,
        json={
            "content": "每周最多投入两小时",
            "category": "constraint",
            "issue_id": item["id"],
            "confirmed": True,
        }
    )
    send(client, auth, conv, "先说一件事")
    with_memory = send(client, auth, conv, "最近时间紧张").json()
    supplied = with_memory["supplied_context"]
    assert supplied["memories"][0]["content"] == "每周最多投入两小时"
    assert supplied["memories"][0]["category"] == "constraint"
    # "你好" + reply, then "先说一件事" + reply: four retained rows are in scope.
    assert supplied["history_count"] == 4
    # Scope isolation must be visible in the disclosure too.
    other_issue = client.post("/api/issues", headers=auth, json={"title": "其他探索"}).json()
    client.post(
        "/api/memories",
        headers=auth,
        json={"content": "只属于其他探索", "issue_id": other_issue["id"], "confirmed": True},
    )
    scoped = send(client, auth, conv, "继续").json()["supplied_context"]
    assert [m["content"] for m in scoped["memories"]] == ["每周最多投入两小时"]


def test_supplied_context_matches_what_the_provider_actually_received(workspace):
    client, auth, item, captured = workspace
    conv = conversation(client, auth, item)
    client.put("/api/me", headers=auth, json={"use_memory": True})
    client.post(
        "/api/memories",
        headers=auth,
        json={"content": "不愿异地搬家", "confirmed": True},
    )
    response = client.post(
        f"/api/conversations/{conv['id']}/chat",
        headers=auth,
        json={"request_id": str(uuid4()), "message": "聊聊搬家"},
    ).json()
    prompt = json.loads(captured[-1]["messages"][1]["content"].split("：", 1)[1])
    disclosed = response["supplied_context"]
    # The disclosure must be a factual subset of the model payload: same memories.
    assert disclosed["memories"][0]["content"] == prompt["confirmed_memories"][0]["content"]
    assert len(disclosed["memories"]) == len(prompt["confirmed_memories"])
    # The summary flag reflects the reviewed summary handed to the model.
    assert disclosed["summary"] == (prompt["reviewed_conversation_summary"] is not None)


def test_supplied_context_covers_the_system_prompt_rule_for_correcting_outdated_memory(tmp_path):
    """The prompt must tell the model to verify rather than assert stale memories."""
    from app import ai
    from app.schemas import ChatInput

    body = ChatInput(request_id=uuid4(), message="换个话题")
    messages = ai.messages_for(
        {"confirmed": []},
        [],
        body,
        "discover",
        conversation_context={
            "reviewed_conversation_summary": None,
            "confirmed_memories": [
                {"id": "m1", "content": "每周两小时", "category": "constraint", "issue_id": None}
            ],
            "explicitly_linked_explorations": [],
        },
    )
    system = messages[0]["content"]
    assert "现在还适用吗" in system
    assert "你之前提过" in system
    assert "仅在确实与当前话题相关时" in system
    from sqlalchemy import create_engine, text

    from app.local_schema import upgrade_local
    from app.models import Base

    engine = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    # A pre-conversation database, with deliberately minimal synthetic old records.
    with engine.begin() as db:
        db.execute(
            text("CREATE TABLE users (id VARCHAR(36) PRIMARY KEY, support_style VARCHAR(20))")
        )
        db.execute(
            text(
                "CREATE TABLE issues (id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36), created_at VARCHAR(40), updated_at VARCHAR(40), ended_at VARCHAR(40))"
            )
        )
        db.execute(
            text(
                "CREATE UNIQUE INDEX one_active_issue_per_user ON issues(user_id) WHERE ended_at IS NULL"
            )
        )
        db.execute(
            text(
                "CREATE TABLE messages (id VARCHAR(36) PRIMARY KEY, issue_id VARCHAR(36), role VARCHAR(16), content TEXT, created_at VARCHAR(40))"
            )
        )
        db.execute(text("CREATE TABLE ai_requests (id VARCHAR(64) PRIMARY KEY, usage JSON)"))
        db.execute(text("INSERT INTO users VALUES ('user', 'discover')"))
        db.execute(text("INSERT INTO issues VALUES ('issue', 'user', '2026', '2026', NULL)"))
        db.execute(
            text(
                "INSERT INTO messages VALUES ('message', 'issue', 'user', 'synthetic legacy text', '2026')"
            )
        )
    Base.metadata.create_all(engine)
    upgrade_local(engine)
    upgrade_local(engine)
    with engine.connect() as db:
        assert db.execute(text("SELECT count(*) FROM conversations")).scalar() == 1
        assert db.execute(text("SELECT content, conversation_id FROM messages")).one() == (
            "synthetic legacy text",
            "issue",
        )
        assert (
            db.execute(
                text("SELECT count(*) FROM sqlite_master WHERE name='one_active_issue_per_user'")
            ).scalar()
            == 0
        )
    engine.dispose()


@pytest.mark.parametrize("change", ["archive", "memory", "retention", "revoke", "delete"])
def test_context_changes_cancel_inflight_work_without_saving_stale_reply(tmp_path, change):
    import asyncio
    import threading
    from concurrent.futures import ThreadPoolExecutor

    entered, release = threading.Event(), threading.Event()

    async def provider(request):
        entered.set()
        while not release.is_set():
            await asyncio.sleep(0.01)
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": '{"reply":"stale","suggestion":null}'}}],
                "usage": {"prompt_tokens": 10, "completion_tokens": 10},
            },
        )

    app = create_app(
        database_url=f"sqlite:///{tmp_path / 'inflight.db'}",
        ai_mode="deepseek",
        deepseek_api_key="isolated",
        ai_transport=httpx.MockTransport(provider),
    )
    with TestClient(app) as client, ThreadPoolExecutor() as pool:
        auth = login(client)
        item = issue(client, auth)
        client.put(
            "/api/me",
            headers=auth,
            json={"ai_consent": True, "save_chat": True, "use_memory": True},
        )
        conv = conversation(client, auth, item)
        pending = pool.submit(send, client, auth, conv)
        try:
            assert entered.wait(5)
            if change == "delete":
                result = client.delete(f"/api/conversations/{conv['id']}?version=1", headers=auth)
            elif change == "archive":
                result = client.put(
                    f"/api/conversations/{conv['id']}",
                    headers=auth,
                    json={"version": 1, "archived": True},
                )
            else:
                values = {
                    "memory": {"use_memory": False},
                    "retention": {"save_chat": False},
                    "revoke": {"ai_consent": False},
                }
                result = client.put("/api/me", headers=auth, json=values[change])
            assert result.status_code == (204 if change == "delete" else 200)
        finally:
            release.set()
        assert pending.result(timeout=5).status_code == 409
        if change == "delete":
            assert client.get(f"/api/conversations/{conv['id']}", headers=auth).status_code == 404
            return
        assert (
            client.get(f"/api/conversations/{conv['id']}/messages", headers=auth).json()["items"]
            == []
        )


def test_stale_authenticated_permission_is_rechecked_before_generation(workspace):
    from fastapi import Depends, Header
    from sqlalchemy import update
    from sqlalchemy.orm import Session

    from app.models import User

    client, auth, item, captured = workspace
    conv = conversation(client, auth, item)
    route = next(
        r for r in client.app.routes if r.path == "/api/conversations/{conversation_id}/chat"
    )
    authenticate = next(d.call for d in route.dependant.dependencies if d.name == "user")
    dependency = next(d.call for d in route.dependant.dependencies if d.name == "db")

    def stale_auth(authorization: str = Header(), db: Session = Depends(dependency)):
        user = authenticate(authorization, db)
        # Reproduce a permission update after authentication read, before chat admission.
        db.execute(
            update(User).where(User.id == user.id).values(ai_consent=False),
            execution_options={"synchronize_session": False},
        )
        db.commit()
        assert user.ai_consent is True
        return user

    client.app.dependency_overrides[authenticate] = stale_auth
    try:
        assert send(client, auth, conv).status_code == 403
        assert captured == []
    finally:
        client.app.dependency_overrides.clear()
