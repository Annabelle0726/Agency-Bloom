from fastapi.testclient import TestClient

from app.main import create_app


def test_health_is_available_at_root_and_api_prefix(tmp_path):
    app = create_app(database_url=f"sqlite:///{tmp_path / 'health.db'}", ai_mode="demo")

    with TestClient(app) as client:
        for path in ("/health", "/api/health"):
            response = client.get(path)

            assert response.status_code == 200
            assert response.json() == {"status": "ok"}
            assert response.headers["cache-control"] == "no-store"
