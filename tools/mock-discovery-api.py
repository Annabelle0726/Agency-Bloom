"""Temporary localhost Discovery QA database. No env file or paid provider."""
import asyncio
import os
import sys
import tempfile
from pathlib import Path

import uvicorn
from fastapi import Request
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, update
from sqlalchemy.orm import Session
from starlette.responses import JSONResponse

ROOT = Path(__file__).resolve().parents[1]
os.environ["AGENCY_DATABASE_URL"] = "sqlite://"
os.environ["AGENCY_AI_MODE"] = "demo"
sys.path.insert(0, str(ROOT / "apps/api"))
from app.main import create_app  # noqa: E402
from app.models import Feedback, Issue, Message  # noqa: E402

temporary = tempfile.TemporaryDirectory(prefix="agency-discovery-qa-")
url = "sqlite:///" + str(Path(temporary.name) / "synthetic.db")
app = create_app(_env_file=None, environment="development", database_url=url, allow_dev_auth=True,
                 ai_mode="demo", deepseek_api_key="", wechat_app_id="", wechat_app_secret="")
fail_next = False


@app.get("/qa/status")
def status():
    return {"provider": "discovery-isolated", "paid_requests": 0}


@app.post("/qa/fail-next")
def failure():
    global fail_next
    fail_next = True
    return {"armed": True}


@app.middleware("http")
async def fail_save(request: Request, call_next):
    global fail_next
    if fail_next and request.method in ("PUT", "POST") and request.url.path == "/api/discovery/conversations":
        fail_next = False
        return JSONResponse({"detail": "Synthetic save failure"}, status_code=503)
    if request.method == "POST" and request.url.path == "/api/discovery/conversations":
        await asyncio.sleep(0.4)
    return await call_next(request)


@app.post("/qa/seed")
def seed(theme: str = "dawn", empty: bool = False):
    # TestClient only calls local demo endpoints; fixture writes are isolated.
    with TestClient(app) as client:
        login = client.post("/api/auth/dev", json={"privacy_accepted": True}).json()
        auth = {"Authorization": "Bearer " + login["token"]}
        client.put("/api/me", headers=auth, json={"theme": theme, "save_chat": True, "ai_consent": True})
        if empty:
            return {"token": login["token"], "user_id": login["user"]["id"], "issue_id": None}
        issue = client.post("/api/issues", headers=auth, json={
            "title": "继续开发，还是尝试产品方向？", "constraints": ["保留稳定收入"]}).json()
        card = {**issue["card"], "next_step": "继续一次小范围的真实尝试"}
        client.put("/api/issues/" + issue["id"] + "/card", headers=auth, json={"version": 1, "card": card})
        engine = create_engine(url)
        with Session(engine) as db:
            db.execute(update(Issue).where(Issue.id == issue["id"]).values(created_at="2026-10-09T03:00:00+00:00"))
            db.add(Feedback(issue_id=issue["id"], kind="progress", text="完成了第一份需求分析练习", created_at="2026-10-12T03:00:00+00:00"))
            db.add(Feedback(issue_id=issue["id"], kind="change", text="找到更适合自己的时间安排，先保留两种可能", created_at="2026-10-18T03:00:00+00:00"))
            db.add(Message(issue_id=issue["id"], conversation_id=issue["id"], role="assistant",
                content="一段供验证的本地回复", payload={"insight": {
                    "observation": "你比较过两个方向，也记录过一次真实尝试",
                    "possibility": "也许可以先看自己是否喜欢日常工作，再决定职位名称",
                    "uncertainty": "这仍然是需要你核实的角度"}}, created_at="2026-10-19T03:00:00+00:00"))
            db.commit()
        engine.dispose()
        return {"token": login["token"], "user_id": login["user"]["id"], "issue_id": issue["id"], "conversation_id": issue["id"]}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8023, access_log=False)
