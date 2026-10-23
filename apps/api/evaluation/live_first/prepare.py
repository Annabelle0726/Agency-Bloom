"""Preparation ONLY: real backend routes, Mock provider, temporary synthetic DB.
No live switch exists. Does not read or modify the real budget or account DB.
Run from apps/api: python -m evaluation.live_first.prepare
"""
import hashlib
import json
import os
import socket
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

# Protect the module-level app as well as the explicit isolated app below.
os.environ["AGENCY_DATABASE_URL"] = "sqlite://"
os.environ["AGENCY_AI_MODE"] = "demo"
os.environ["AGENCY_ENVIRONMENT"] = "development"

import httpx  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import create_app  # noqa: E402

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
MANIFEST = HERE / "manifest.json"
original_connect = socket.socket.connect
original_connect_ex = socket.socket.connect_ex


def local_only(method):
    def guarded(self, address):
        # Windows asyncio's socketpair needs a loopback self-pipe.
        if not isinstance(address, tuple) or address[0] not in {"127.0.0.1", "::1"}:
            raise RuntimeError("Preparation forbids external sockets")
        return method(self, address)
    return guarded


def main():
    output = HERE / "preflight-mock.json"
    if output.exists():
        raise SystemExit("Existing preparation record preserved; inspect it before another run.")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    assert sum(len(s["turns"]) for s in manifest["scenarios"]) == 8
    digest = hashlib.sha256(MANIFEST.read_bytes()).hexdigest()
    records, calls = [], []
    socket.socket.connect = local_only(original_connect)
    socket.socket.connect_ex = local_only(original_connect_ex)

    def provider(request):
        assert request.url.host == "offline.invalid"
        body = json.loads(request.content)
        calls.append(body)
        assert body["model"] == "deepseek-v4-pro"
        assert body["thinking"] == {"type": "enabled"}
        assert body["max_tokens"] == 4096
        assert body["stream"] is False and body["response_format"] == {"type": "text"}
        assert "tools" not in body
        return httpx.Response(200, json={
            "model": "DeepSeek-V4-Pro-0813",
            "choices": [{"finish_reason": "stop", "message": {
                "content": json.dumps({"reply": "离线链路占位回复，不代表真实模型表现。", "suggestion": None}),
            }}],
            "usage": {"prompt_tokens": 1000, "completion_tokens": 100},
        })

    with tempfile.TemporaryDirectory(prefix="bloom-live-preparation-") as temporary:
        app = create_app(
            _env_file=None, environment="development", allow_dev_auth=True,
            database_url="sqlite:///" + str(Path(temporary) / "fictional.db"),
            ai_mode="deepseek", deepseek_model="deepseek-v4-pro",
            deepseek_base_url="https://offline.invalid", deepseek_api_key="mock-only",
            ai_thinking=True, max_output_tokens=4096, ai_monthly_budget_cny=100,
            input_price_per_million=9, output_price_per_million=27,
            cached_input_price_per_million="0.30",
            ai_timeout_seconds=45, wechat_app_id="", wechat_app_secret="",
            ai_transport=httpx.MockTransport(provider),
        )
        with TestClient(app) as client:
            auth_result = client.post("/api/auth/dev", json={"privacy_accepted": True})
            assert auth_result.status_code == 200
            headers = {"Authorization": "Bearer " + auth_result.json()["token"]}
            preferences = client.put("/api/me", headers=headers,
                                     json={"ai_consent": True, "save_chat": True, "use_memory": True})
            assert preferences.status_code == 200
            for scenario in manifest["scenarios"]:
                issue_result = client.post("/api/issues", headers=headers, json={
                    "title": "虚构评测 " + scenario["id"],
                    "background": f"完全虚构的成年人，年龄{scenario['persona']['adult_age']}岁",
                    "support_style": scenario["support_style"],
                })
                assert issue_result.status_code == 201, issue_result.status_code
                issue = issue_result.json()
                conversation = client.post("/api/conversations", headers=headers, json={
                    "issue_id": issue["id"], "title": "虚构评测 " + scenario["id"],
                    "support_style": scenario["support_style"],
                }).json()
                for memory in scenario.get("seed_memories", []):
                    saved = client.post("/api/memories", headers=headers, json=memory | {
                        "issue_id": issue["id"], "source_conversation_id": conversation["id"]})
                    assert saved.status_code == 201
                original_memories = client.get("/api/memories", headers=headers).json()
                original_card = client.get("/api/issues/" + issue["id"], headers=headers).json()["card"]
                for turn in scenario["turns"]:
                    payload = {"request_id": str(uuid5(NAMESPACE_URL, "bloom-first-live-v1/" + turn["id"])),
                               "message": turn["input"], "web_search": False}
                    route = "/api/conversations/" + conversation["id"] + "/chat"
                    previous = len(calls)
                    response = client.post(route, headers=headers, json=payload)
                    assert response.status_code == 200, response.status_code
                    assert len(calls) == previous + 1
                    sent = calls[-1]
                    assert sent["messages"][-1]["content"] == turn["input"]
                    assert client.post(route, headers=headers, json=payload).status_code == 409
                    assert len(calls) == previous + 1
                    assert client.get("/api/memories", headers=headers).json() == original_memories
                    assert client.get("/api/issues/" + issue["id"], headers=headers).json()["card"] == original_card
                    byte_bound = len(json.dumps(sent["messages"], ensure_ascii=False).encode("utf-8")) + 2048
                    records.append({
                        "case": turn["id"], "planned_input": turn["input"],
                        "captured_parameters": {k: v for k, v in sent.items() if k != "messages"},
                        "selected_history_count": response.json()["supplied_context"]["history_count"],
                        "estimated_input_bound_with_mock_history": byte_bound,
                        "conditional_peak_reservation_cny": format((byte_bound * 9 + 4096 * 27) / 1000000, ".6f"),
                        "one_request_no_retry": True, "duplicate_request_blocked": True,
                        "memories_and_cards_unchanged": True, "real_reply": None,
                        "human_scores": None,
                    })
    assert len(calls) == 8 and hashlib.sha256(MANIFEST.read_bytes()).hexdigest() == digest
    report = {
        "status": "BLOCKED_FOR_LIVE_EXECUTION",
        "paid_requests": 0, "mock_provider_calls": len(calls),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "manifest_sha256": digest,
        "app_source_sha256": {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                              for p in sorted((HERE.parents[1] / "app").glob("*.py"))},
        "blockers": [
            "30,000 prompt-token ceiling is proposed, not a current backend admission limit.",
            "No persistent evaluation-specific eight-attempt/CNY3.05 admission guard is installed.",
            "Public model tokenizer/frame audit is not a verified hosted-service billing upper bound.",
        ],
        "records": records,
        "note": "Mock history cannot predict future real history size or real response quality.",
    }
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "mock_calls": len(calls), "paid_calls": 0,
                      "input_bounds": [r["estimated_input_bound_with_mock_history"] for r in records]}))


if __name__ == "__main__":
    main()
