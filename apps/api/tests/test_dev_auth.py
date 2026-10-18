"""Development sign-in must resume only the account proven by its local credential."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, update

from app.main import create_app, digest
from app.models import AuthSession


@pytest.fixture
def client(tmp_path):
    app = create_app(
        database_url=f"sqlite:///{tmp_path / 'auth.db'}",
        environment="development",
        allow_dev_auth=True,
        ai_mode="demo",
    )
    with TestClient(app) as client:
        yield client


def register(client):
    response = client.post("/api/auth/dev", json={"privacy_accepted": True})
    assert response.status_code == 200
    return response.json()


def headers(account):
    return {"Authorization": "Bearer " + account["token"]}


def resume(client, secret):
    return client.post("/api/auth/dev", json={"privacy_accepted": True, "resume_token": secret})


def test_logout_then_resume_restores_same_account_and_issue(client):
    account = register(client)
    original = client.post(
        "/api/issues", headers=headers(account), json={"title": "我的原有方向"}
    ).json()
    assert client.post("/api/auth/logout", headers=headers(account)).status_code == 204
    assert client.get("/api/me", headers=headers(account)).status_code == 401
    restored = resume(client, account["resume_token"])
    assert restored.status_code == 200
    assert restored.json()["user"]["id"] == account["user"]["id"]
    assert (
        client.get("/api/issues/current", headers=headers(restored.json())).json()["id"]
        == original["id"]
    )


def test_explicit_registration_remains_a_separate_account(client):
    alice, bob = register(client), register(client)
    assert alice["user"]["id"] != bob["user"]["id"]
    assert resume(client, alice["resume_token"]).json()["user"]["id"] == alice["user"]["id"]
    assert resume(client, bob["resume_token"]).json()["user"]["id"] == bob["user"]["id"]


def test_resume_and_api_credentials_are_not_interchangeable(client):
    account = register(client)
    assert resume(client, account["token"]).status_code == 401
    assert (
        client.get(
            "/api/me", headers={"Authorization": "Bearer " + account["resume_token"]}
        ).status_code
        == 401
    )
    assert resume(client, "x" * 43).status_code == 401
    assert (
        client.post(
            "/api/auth/dev", json={"privacy_accepted": True, "user_id": account["user"]["id"]}
        ).status_code
        == 422
    )


def test_expired_resume_does_not_silently_register_another_user(client):
    account = register(client)
    engine = create_engine(client.app.state.settings.database_url)
    with engine.begin() as connection:
        connection.execute(
            update(AuthSession)
            .where(AuthSession.token_hash == digest("dev-resume:" + account["resume_token"]))
            .values(expires_at="2000-01-01T00:00:00+00:00")
        )
    engine.dispose()
    assert resume(client, account["resume_token"]).status_code == 401


def test_delete_account_invalidates_the_saved_local_credential(client):
    account = register(client)
    assert client.delete("/api/me", headers=headers(account)).status_code == 204
    assert resume(client, account["resume_token"]).status_code == 401


def test_existing_authenticated_demo_can_be_remembered_before_logout(client):
    account = register(client)
    assert client.post("/api/auth/dev/remember", json={"privacy_accepted": True}).status_code == 401
    remembered = client.post(
        "/api/auth/dev/remember", headers=headers(account), json={"privacy_accepted": True}
    )
    assert remembered.status_code == 200
    client.post("/api/auth/logout", headers=headers(account))
    assert (
        resume(client, remembered.json()["resume_token"]).json()["user"]["id"]
        == account["user"]["id"]
    )


@pytest.mark.parametrize(
    "setting,value", [("allow_dev_auth", False), ("environment", "production")]
)
def test_dev_credentials_never_enable_production_signin(client, setting, value):
    account = register(client)
    setattr(client.app.state.settings, setting, value)
    assert resume(client, account["resume_token"]).status_code == 404
    assert (
        client.post(
            "/api/auth/dev/remember", headers=headers(account), json={"privacy_accepted": True}
        ).status_code
        == 404
    )


def test_registration_and_resume_require_explicit_consent(client):
    account = register(client)
    assert client.post("/api/auth/dev", json={"privacy_accepted": False}).status_code == 422
    assert (
        client.post("/api/auth/dev", json={"resume_token": account["resume_token"]}).status_code
        == 422
    )
