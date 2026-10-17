"""Operator check: GET-only preflight, or exactly one opt-in paid chat request.

Run from the repository with uv run --directory apps/api python ../../tools/verify-deepseek.py
Add --live-once only when authorizing one real generation. A durable attempt
marker prevents a second generation on rerun, including after uncertain failures.
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
API = ROOT / "apps" / "api"
sys.path.insert(0, str(API))
os.chdir(API)

import httpx  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402

from app.config import Settings  # noqa: E402
from app.main import calendar, create_app  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--live-once", action="store_true")
    args = parser.parse_args()
    evidence = ROOT / "output" / "deepseek"
    evidence.mkdir(parents=True, exist_ok=True)
    attempt = evidence / "live-attempt.json"
    if args.live_once and attempt.exists():
        raise SystemExit("A live attempt already exists; refusing another paid request")
    settings = Settings()
    if (
        not settings.deepseek_api_key
        or settings.deepseek_base_url.rstrip("/") != "https://api.deepseek.com"
    ):
        raise SystemExit("Configure the official DeepSeek endpoint and API key in apps/api/.env")
    headers = {"Authorization": f"Bearer {settings.deepseek_api_key}"}
    with httpx.Client(timeout=20, transport=httpx.HTTPTransport(retries=0)) as provider:
        models = provider.get(settings.deepseek_base_url + "/models", headers=headers)
        models.raise_for_status()
        if settings.deepseek_model not in {m["id"] for m in models.json()["data"]}:
            raise SystemExit("Configured model is unavailable")
        balance = provider.get(settings.deepseek_base_url + "/user/balance", headers=headers)
        balance.raise_for_status()
        account = balance.json()
        if not account.get("is_available") or not any(
            b["currency"] == "CNY" for b in account["balance_infos"]
        ):
            raise SystemExit("This CNY rate card requires an available CNY provider account")
    print(
        json.dumps(
            {
                "key_accepted": True,
                "model_available": True,
                "currency": "CNY",
                "generation_requests": 0,
            }
        )
    )
    if not args.live_once:
        return
    if settings.environment != "development" or not settings.database_url.startswith("sqlite"):
        raise SystemExit("The controlled smoke check requires the local development database")
    request_id = str(uuid4())
    month, _ = calendar()
    engine = create_engine(settings.database_url)
    with engine.connect() as db:
        old = (
            db.execute(
                text("SELECT used_micro FROM budgets WHERE month=:month"), {"month": month}
            ).scalar()
            or 0
        )
    with TestClient(create_app(ai_mode="deepseek", max_output_tokens=384)) as client:
        login = client.post("/api/auth/dev", json={"privacy_accepted": True})
        login.raise_for_status()
        token = login.json()["token"]
        auth = {"Authorization": f"Bearer {token}"}
        client.put(
            "/api/me", headers=auth, json={"ai_consent": True, "save_chat": True}
        ).raise_for_status()
        issue = client.post(
            "/api/issues",
            headers=auth,
            json={"title": "了解下一步方向", "support_style": "clarify"},
        )
        issue.raise_for_status()
        # Exclusive marker is written before the only generation attempt.
        with attempt.open("x", encoding="utf-8") as target:
            json.dump(
                {
                    "request_id": request_id,
                    "started_at": datetime.now(timezone.utc).isoformat(),
                    "max_output_tokens": 384,
                },
                target,
            )
        result = client.post(
            f"/api/issues/{issue.json()['id']}/chat",
            headers=auth,
            json={"request_id": request_id, "message": "我想你了", "history": []},
        )
        report = {
            "request_id": request_id,
            "http_status": result.status_code,
            "generation_attempts": 1,
            "max_output_tokens": 384,
        }
        if result.is_success:
            data = result.json()
            report.update(
                {
                    "reply": data["reply"],
                    "suggestion": data["suggestion"],
                    "mode": data["mode"],
                    "usage": data["usage"],
                }
            )
            assert data["usage"]["provider_request_id"], "Missing provider response ID"
            after = client.get("/api/usage", headers=auth).json()["used_cny"]
            after_micro = int(Decimal(str(after)) * 1_000_000)
            report.update(
                {
                    "budget_before_micro": old,
                    "budget_after_micro": after_micro,
                    "historical_spend_preserved": after_micro >= old,
                }
            )
            (evidence / "native-session.json").write_text(
                json.dumps({"token": token, "issue_id": issue.json()["id"]}), encoding="utf-8"
            )
        else:
            report["detail"] = result.json().get("detail")
        (evidence / "live-check.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(json.dumps(report, ensure_ascii=False))
        if not result.is_success:
            raise SystemExit("The single live attempt failed; it will not be retried automatically")
    engine.dispose()


if __name__ == "__main__":
    main()
