from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from test_journey import login

from app.main import create_app


def test_selected_context_and_support_style_are_saved_without_becoming_memory(tmp_path):
    app = create_app(database_url=f"sqlite:///{tmp_path / 'context.db'}")
    with TestClient(app) as client:
        auth = login(client)
        created = client.post(
            "/api/issues",
            headers=auth,
            json={
                "title": "先理清人际关系",
                "concerns": ["relationships", "overload"],
                "life_contexts": ["working", "care"],
                "support_style": "listen",
            },
        )
        assert created.status_code == 201
        result = created.json()
        assert result["life_contexts"] == ["working", "care"]
        assert result["card"]["confirmed"] == []
        assert client.get("/api/me", headers=auth).json()["support_style"] == "listen"
        assert (
            client.put("/api/me", headers=auth, json={"support_style": "compare"}).status_code
            == 200
        )
        assert (
            client.post(
                "/api/issues",
                headers=auth,
                json={"title": "invalid", "concerns": ["unsure", "direction"]},
            ).status_code
            == 422
        )


def test_consent_changes_have_versioned_records_and_are_deleted_with_account(tmp_path):
    url = f"sqlite:///{tmp_path / 'consent.db'}"
    with TestClient(create_app(database_url=url)) as client:
        auth = login(client)
        client.put("/api/me", headers=auth, json={"ai_consent": True})
        client.put("/api/me", headers=auth, json={"ai_consent": False})
        engine = create_engine(url)
        with engine.connect() as db:
            records = db.execute(text("SELECT kind, accepted, policy_version FROM consents")).all()
            assert ("registration", 1, "2026-10-16") in records
            assert ("ai", 1, "2026-10-16") in records
            assert ("ai", 0, "2026-10-16") in records
        client.delete("/api/me", headers=auth)
        with engine.connect() as db:
            assert db.execute(text("SELECT count(*) FROM consents")).scalar() == 0
        engine.dispose()
