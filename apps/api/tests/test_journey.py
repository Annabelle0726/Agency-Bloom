"""Contract tests: missing isolation, persistence, consent or limits must fail these."""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(database_url=f"sqlite:///{tmp_path / 'test.db'}")) as client:
        yield client


def login(client):
    response = client.post("/api/auth/dev", json={"privacy_accepted": True})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['token']}"}


def issue(client, headers):
    response = client.post(
        "/api/issues",
        headers=headers,
        json={
            "title": "在设计和产品之间做选择",
            "concerns": ["choices"],
            "stage": "working",
            "background": "做了三年设计，希望保留收入。",
            "constraints": ["收入稳定"],
        },
    )
    assert response.status_code == 201
    return response.json()


def test_anonymous_cannot_read_private_issues(client):
    assert client.get("/api/issues/current").status_code == 401


def test_resume_card_and_feedback_but_not_other_users_data(client):
    alice, bob = login(client), login(client)
    original = issue(client, alice)
    card = original["card"] | {
        "options": ["继续设计", "尝试产品"],
        "next_step": "和一位产品经理聊聊",
    }
    saved = client.put(
        f"/api/issues/{original['id']}/card", headers=alice, json={"version": 1, "card": card}
    )
    assert saved.status_code == 200
    assert saved.json()["version"] == 2
    assert (
        client.get("/api/issues/current", headers=alice).json()["card"]["next_step"]
        == "和一位产品经理聊聊"
    )
    assert client.get("/api/issues/current", headers=bob).json() is None
    assert client.get(f"/api/issues/{original['id']}", headers=bob).status_code == 404
    assert (
        client.put(
            f"/api/issues/{original['id']}/card", headers=bob, json={"version": 2, "card": card}
        ).status_code
        == 404
    )
    feedback = client.post(
        f"/api/issues/{original['id']}/feedback",
        headers=alice,
        json={"kind": "progress", "text": "聊完发现我喜欢用户研究"},
    )
    assert feedback.status_code == 201
    assert (
        client.get("/api/issues/current", headers=alice).json()["feedback"][0]["text"]
        == "聊完发现我喜欢用户研究"
    )


def test_only_one_active_issue_and_old_version_cannot_overwrite(client):
    auth = login(client)
    current = issue(client, auth)
    assert client.post("/api/issues", headers=auth, json={"title": "第二件事"}).status_code == 409
    path = f"/api/issues/{current['id']}/card"
    body = {"version": 1, "card": current["card"] | {"next_step": "新行动"}}
    assert client.put(path, headers=auth, json=body).status_code == 200
    assert client.put(path, headers=auth, json=body).status_code == 409
    assert client.post(f"/api/issues/{current['id']}/end", headers=auth).status_code == 200
    assert client.get("/api/issues/current", headers=auth).json() is None
    assert client.post("/api/issues", headers=auth, json={"title": "新的方向"}).status_code == 201


def test_ai_requires_separate_consent_and_does_not_save_chat_by_default(client):
    auth = login(client)
    current = issue(client, auth)
    path = f"/api/issues/{current['id']}/chat"
    body = {
        "request_id": "ae15df3d-2787-4b9a-885f-44d5dd59622b",
        "message": "我担心收入下降",
        "history": [],
    }
    assert client.post(path, headers=auth, json=body).status_code == 403
    assert client.put("/api/me", headers=auth, json={"ai_consent": True}).status_code == 200
    response = client.post(path, headers=auth, json=body)
    assert response.status_code == 200
    assert response.json()["mode"] == "demo"
    assert response.json()["suggestion"]["unknowns"]
    assert client.get(f"/api/issues/{current['id']}/messages", headers=auth).json() == []
    assert client.get("/api/issues/current", headers=auth).json()["card"] == current["card"]
    assert client.post(path, headers=auth, json=body).status_code == 409


def test_chat_retention_can_be_enabled_then_purged(client):
    auth = login(client)
    current = issue(client, auth)
    client.put("/api/me", headers=auth, json={"ai_consent": True, "save_chat": True})
    response = client.post(
        f"/api/issues/{current['id']}/chat",
        headers=auth,
        json={
            "request_id": "cb287251-9d34-4474-9baa-2ff5adfb7120",
            "message": "不知道如何开始",
            "history": [],
        },
    )
    assert response.status_code == 200
    path = f"/api/issues/{current['id']}/messages"
    messages = client.get(path, headers=auth).json()
    assert len(messages) == 2
    assert messages[0]["content"] == "不知道如何开始"
    client.put("/api/me", headers=auth, json={"save_chat": False})
    assert client.get(path, headers=auth).json() == []


def test_account_deletion_revokes_session_and_erases_private_data(client):
    auth = login(client)
    issue(client, auth)
    assert client.delete("/api/me", headers=auth).status_code == 204
    assert client.get("/api/me", headers=auth).status_code == 401


def test_production_rejects_demo_configuration(tmp_path):
    with pytest.raises(ValueError, match="production"):
        create_app(
            environment="production",
            allow_dev_auth=True,
            database_url=f"sqlite:///{tmp_path / 'production.db'}",
        )
