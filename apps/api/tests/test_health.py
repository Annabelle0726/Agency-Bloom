import logging

from fastapi.testclient import TestClient

from app.main import HealthProbeLogFilter, create_app


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


def test_root_health_probe_access_log_is_filtered():
    def record(method: str, path: str, status: int) -> logging.LogRecord:
        return logging.LogRecord(
            "uvicorn.access",
            logging.INFO,
            __file__,
            1,
            "",
            ("127.0.0.1:12345", method, path, "HTTP/1.1", status),
            None,
        )

    health_probe = HealthProbeLogFilter()

    assert health_probe.filter(record("GET", "/health", 404)) is False
    assert health_probe.filter(record("GET", "/api/health", 200)) is True
