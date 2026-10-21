from fastapi.testclient import TestClient

from app.main import create_app


def test_health_is_available_under_the_api_prefix(tmp_path):
    app = create_app(database_url=f"sqlite:///{tmp_path / 'health.db'}", ai_mode="demo")

    with TestClient(app) as client:
        response = client.get("/api/health")

        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
        assert response.headers["cache-control"] == "no-store"

        # The root path is intentionally not a health endpoint: local model
        # discovery tools otherwise probe /v1/models and log false 404s.
        assert client.get("/health").status_code == 404
