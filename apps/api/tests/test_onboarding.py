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


def test_untitled_exploration_preserves_intent_and_answers_without_inventing_facts(tmp_path):
    with TestClient(create_app(database_url=f"sqlite:///{tmp_path / 'exploration.db'}")) as client:
        auth = login(client)
        response = client.post(
            "/api/issues",
            headers=auth,
            json={
                "title": "",
                "concerns": ["change", "possibility"],
                "exploration_intent": "change",
                "actual_question": "我的能力还能用在哪",
                "focus_response": "别人常找我解释技术问题",
                "support_style": "discover",
                "constraints": ["每周两小时"],
            },
        )
        assert response.status_code == 201
        issue = response.json()
        assert issue["title"] == issue["card"]["title"] == ""
        assert issue["card"]["confirmed"] == []
        assert issue["exploration_intent"] == "change"
        assert issue["focus_response"] == "别人常找我解释技术问题"
        assert issue["concerns"] == ["change", "possibility"]
        assert (
            client.put("/api/me", headers=auth, json={"support_style": "experiment"}).status_code
            == 200
        )
        assert client.put("/api/me", headers=auth, json={"support_style": "act"}).status_code == 200
        assert (
            client.get("/api/issues/current", headers=auth).json()["actual_question"]
            == "我的能力还能用在哪"
        )


def test_mainline_must_be_selected_and_action_label_cannot_be_a_new_title(tmp_path):
    with TestClient(create_app(database_url=f"sqlite:///{tmp_path / 'invalid.db'}")) as client:
        auth = login(client)
        assert (
            client.post(
                "/api/issues",
                headers=auth,
                json={
                    "concerns": ["direction"],
                    "exploration_intent": "change",
                },
            ).status_code
            == 422
        )
        result = client.post(
            "/api/issues",
            headers=auth,
            json={
                "title": "我也不知道，帮我一起理清",
                "concerns": ["unsure"],
            },
        )
        assert result.status_code == 201
        assert result.json()["title"] == ""


def test_additive_exploration_upgrade_preserves_legacy_cards_and_nonzero_ledger(tmp_path):
    url = f"sqlite:///{tmp_path / 'legacy.db'}"
    with TestClient(create_app(database_url=url)) as client:
        auth = login(client)
        created = client.post(
            "/api/issues",
            headers=auth,
            json={"title": "旧账户自己的问题", "background": "用户确认的经历"},
        ).json()
        original_card = created["card"]
    engine = create_engine(url)
    with engine.begin() as db:
        db.execute(text("ALTER TABLE issues DROP COLUMN exploration"))
        db.execute(text("INSERT INTO budgets (month, used_micro) VALUES ('2026-10', 1234567)"))
    with TestClient(create_app(database_url=url)) as client:
        current = client.get("/api/issues/current", headers=auth).json()
        assert current["card"] == original_card
        assert current["exploration_intent"] == ""
        assert current["actual_question"] == ""
        assert current["focus_response"] == ""
    with engine.connect() as db:
        assert (
            db.execute(text("SELECT used_micro FROM budgets WHERE month='2026-10'")).scalar()
            == 1234567
        )
    engine.dispose()
