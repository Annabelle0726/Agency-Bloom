import asyncio
import json
import threading
from concurrent.futures import ThreadPoolExecutor

import httpx
import pytest
from fastapi.testclient import TestClient
from test_ai_boundary import BODY, ready

from app.main import create_app


@pytest.mark.parametrize("action", ["cancel", "revoke", "delete", "end", "plan"])
def test_inflight_reply_is_discarded_when_permission_or_issue_changes(tmp_path, action):
    entered, release = threading.Event(), threading.Event()

    async def upstream(request):
        entered.set()
        while not release.is_set():
            await asyncio.sleep(0.01)
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {"reply": "This reply must not be saved.", "suggestion": {}}
                            )
                        }
                    }
                ],
                "usage": {"prompt_tokens": 10, "completion_tokens": 10},
            },
        )

    app = create_app(
        database_url=f"sqlite:///{tmp_path / 'cancel.db'}",
        ai_mode="deepseek",
        deepseek_api_key="test-key",
        ai_transport=httpx.MockTransport(upstream),
    )
    with TestClient(app) as client, ThreadPoolExecutor() as pool:
        auth, path = ready(client)
        client.put("/api/me", headers=auth, json={"save_chat": True})
        if action == 'plan':
            state = client.post(path.replace('/chat', '/plan'), headers=auth, json={
                'request_id': '7f964606-48cf-4308-8b6a-7b8f41837b9c', 'version': 1, 'next_step': '问朋友'}).json()
        pending = pool.submit(client.post, path, headers=auth, json=BODY)
        try:
            assert entered.wait(5), "Provider was not called"
            if action == "cancel":
                assert (
                    client.post(
                        f"/api/requests/{BODY['request_id']}/cancel", headers=auth
                    ).status_code
                    == 204
                )
            elif action == "revoke":
                assert (
                    client.put("/api/me", headers=auth, json={"ai_consent": False}).status_code
                    == 200
                )
            elif action == "delete":
                assert client.delete("/api/me", headers=auth).status_code == 204
            elif action == 'plan':
                assert client.post(path.replace('/chat', '/plan'), headers=auth, json={
                    'request_id': '2e951c23-6167-4428-84d3-3e57e1205d8e', 'version': state['version'],
                    'status': 'completed', 'remember_plan': True}).status_code == 200
            else:
                assert client.post(path.replace("/chat", "/end"), headers=auth).status_code == 200
        finally:
            release.set()
        assert pending.result(timeout=5).status_code == 409
        if action != "delete":
            assert client.get(path.replace("/chat", "/messages"), headers=auth).json() == []


def test_daily_limit_cannot_be_bypassed_by_new_request_ids(tmp_path):
    app = create_app(database_url=f"sqlite:///{tmp_path / 'daily.db'}", daily_chat_limit=1)
    with TestClient(app) as client:
        auth, path = ready(client)
        assert client.post(path, headers=auth, json=BODY).status_code == 200
        other = BODY | {"request_id": "fa8a5380-9cdc-443a-afcc-909898382bca"}
        assert client.post(path, headers=auth, json=other).status_code == 429
