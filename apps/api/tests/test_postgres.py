"""Optional disposable PostgreSQL integration test; never point at a real project."""

import os
from pathlib import Path

import psycopg
import pytest
from fastapi.testclient import TestClient
from test_journey import issue, login

from app.main import create_app


@pytest.mark.skipif(
    not os.getenv("AGENCY_TEST_POSTGRES_URL"), reason="Disposable PostgreSQL not configured"
)
def test_postgres_migration_blocks_data_api_and_supports_private_journey():
    url = os.environ["AGENCY_TEST_POSTGRES_URL"]
    with psycopg.connect(url, autocommit=True) as db:
        # A safety guard makes accidental use of a hosted database fail before DDL.
        assert db.info.host in ("127.0.0.1", "localhost")
        assert db.info.dbname == "agency_verify"
        for role in ("anon", "authenticated", "service_role"):
            if not db.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (role,)).fetchone():
                db.execute(f"CREATE ROLE {role}")
        migrations = Path(__file__).resolve().parents[3] / "supabase/migrations"
        for migration in sorted(migrations.glob("*.sql")):
            db.execute(migration.read_text(encoding="utf-8"))
        tables = [
            "users",
            "auth_sessions",
            "issues",
            "feedback",
            "messages",
            "budgets",
            "ai_requests",
            "consents",
        ]
        for table in tables:
            assert db.execute(
                "SELECT relrowsecurity FROM pg_class WHERE oid = %s::regclass", (f"public.{table}",)
            ).fetchone()[0]
            for role in ("anon", "authenticated", "service_role"):
                for privilege in ("SELECT", "INSERT", "UPDATE", "DELETE"):
                    assert not db.execute(
                        "SELECT has_table_privilege(%s, %s, %s)",
                        (role, f"public.{table}", privilege),
                    ).fetchone()[0]
    app = create_app(
        database_url=url.replace("postgresql://", "postgresql+psycopg://"), ai_mode="demo"
    )
    with TestClient(app) as client:
        alice, bob = login(client), login(client)
        original = issue(client, alice)
        assert client.get(f"/api/issues/{original['id']}", headers=bob).status_code == 404
        assert (
            client.post("/api/issues", headers=alice, json={"title": "another"}).status_code == 409
        )
        client.put("/api/me", headers=alice, json={"ai_consent": True, "save_chat": True})
        body = {"request_id": "b3d789cb-0bc6-4cc4-b248-f74cbbf8fcef", "message": "从哪里开始"}
        assert (
            client.post(f"/api/issues/{original['id']}/chat", headers=alice, json=body).status_code
            == 200
        )
        assert client.delete("/api/me", headers=alice).status_code == 204
        assert client.get("/api/me", headers=alice).status_code == 401
        client.delete("/api/me", headers=bob)
    with psycopg.connect(url) as db:
        for table in ["users", "auth_sessions", "issues", "feedback", "messages", "consents"]:
            assert db.execute(f"SELECT count(*) FROM public.{table}").fetchone()[0] == 0
        assert db.execute("SELECT user_id FROM public.ai_requests").fetchone()[0] is None
