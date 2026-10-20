import json

import httpx
from fastapi.testclient import TestClient
from test_journey import issue, login

from app.main import create_app


def ready(client):
    auth = login(client)
    current = issue(client, auth)
    client.put("/api/me", headers=auth, json={"ai_consent": True})
    return auth, f"/api/issues/{current['id']}/chat"


BODY = {
    "request_id": "b3d789cb-0bc6-4cc4-b248-f74cbbf8fcef",
    "message": "我想了解产品岗位",
    "history": [],
}


def test_zero_budget_prevents_upstream_call(tmp_path):
    def upstream(request):
        raise AssertionError("Budget exhausted: upstream must never be called")

    app = create_app(
        database_url=f"sqlite:///{tmp_path / 'budget.db'}",
        ai_mode="deepseek",
        deepseek_api_key="test-key",
        ai_monthly_budget_cny=0,
        ai_transport=httpx.MockTransport(upstream),
    )
    with TestClient(app) as client:
        auth, path = ready(client)
        assert client.post(path, headers=auth, json=BODY).status_code == 402


def test_provider_contract_is_bounded_and_cannot_change_confirmed_facts(tmp_path):
    def upstream(request):
        body = json.loads(request.content)
        assert body["thinking"] == {"type": "enabled"}
        assert body["max_tokens"] == 1200
        assert body["response_format"] == {"type": "text"}
        assert request.headers["Authorization"] == "Bearer test-key"
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "reply": "你最想了解产品岗位的哪一部分？",
                                    "suggestion": {
                                        "options": ["产品方向"],
                                        "hypotheses": ["可能希望更接近用户"],
                                        "unknowns": ["岗位的真实日常"],
                                        "next_step": "找一位产品经理聊聊",
                                    },
                                }
                            )
                        }
                    }
                ],
                "usage": {"prompt_tokens": 100, "completion_tokens": 100},
            },
        )

    app = create_app(
        database_url=f"sqlite:///{tmp_path / 'provider.db'}",
        ai_mode="deepseek",
        deepseek_api_key="test-key",
        ai_transport=httpx.MockTransport(upstream),
    )
    with TestClient(app) as client:
        auth, path = ready(client)
        before = client.get("/api/issues/current", headers=auth).json()["card"]
        result = client.post(path, headers=auth, json=BODY)
        assert result.status_code == 200
        assert result.json()["suggestion"]["options"] == ["产品方向"]
        assert client.get("/api/issues/current", headers=auth).json()["card"] == before
        usage = client.get("/api/usage", headers=auth).json()
        assert usage["used_cny"] == 0.001


def test_uncertain_provider_failure_keeps_reservation_and_allows_no_duplicate_charge(tmp_path):
    app = create_app(
        database_url=f"sqlite:///{tmp_path / 'failure.db'}",
        ai_mode="deepseek",
        deepseek_api_key="test-key",
        ai_transport=httpx.MockTransport(lambda r: httpx.Response(503)),
    )
    with TestClient(app) as client:
        auth, path = ready(client)
        assert client.post(path, headers=auth, json=BODY).status_code == 502
        used = client.get("/api/usage", headers=auth).json()["used_cny"]
        assert used > 0
        assert client.post(path, headers=auth, json=BODY).status_code == 409
        assert client.get("/api/usage", headers=auth).json()["used_cny"] == used


def test_wechat_login_validates_provider_response_and_reuses_identity(tmp_path):
    def upstream(request):
        assert request.url.params["js_code"] == "one-time-code"
        return httpx.Response(
            200, json={"openid": "wx-person", "session_key": "private-never-return"}
        )

    app = create_app(
        database_url=f"sqlite:///{tmp_path / 'wechat.db'}",
        wechat_app_id="wx-test",
        wechat_app_secret="test-secret",
        wechat_transport=httpx.MockTransport(upstream),
    )
    with TestClient(app) as client:
        body = {"code": "one-time-code", "privacy_accepted": True}
        a = client.post("/api/auth/wechat", json=body)
        b = client.post("/api/auth/wechat", json=body)
        assert a.status_code == b.status_code == 200
        assert a.json()["user"]["id"] == b.json()["user"]["id"]
        assert "private-never-return" not in a.text
