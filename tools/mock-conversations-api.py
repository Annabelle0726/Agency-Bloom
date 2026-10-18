"""Disposable localhost QA service. Every generation uses MockTransport.

Run from repository root: uv run --project apps/api python tools/mock-conversations-api.py
Never reads backend .env or the application database. Uses a fresh temporary database.
"""

import asyncio
import json
import os
import sys
import tempfile
from pathlib import Path

import httpx
import uvicorn

ROOT = Path(__file__).resolve().parents[1]
os.environ["AGENCY_DATABASE_URL"] = "sqlite://"
os.environ["AGENCY_AI_MODE"] = "demo"
sys.path.insert(0, str(ROOT / "apps/api"))
from app.main import create_app  # noqa: E402

calls = 0


async def provider(request):
    global calls
    calls += 1
    body = json.loads(request.content)
    if "慢回复" in body["messages"][-1]["content"]:
        await asyncio.sleep(3)
    output = {"reply": "［隔离 Mock］已接续本会话，可以比较收入约束和实际时间投入", "suggestion": None}
    if "本次任务是整理会话" in body["messages"][0]["content"]:
        output["summary"] = {"overview": "［隔离 Mock］比较工作选择与每周可投入时间", "decisions": ["先保留稳定收入"],
                             "open_questions": ["实际工作时间还需核实"], "next_steps": ["了解一次真实工作体验"]}
    return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(output, ensure_ascii=False)}}],
                                   "usage": {"prompt_tokens": 100, "completion_tokens": 100}})


fixture_dir = tempfile.TemporaryDirectory(prefix="agency-conversation-qa-")
app = create_app(_env_file=None, environment="development", allow_dev_auth=True,
                 database_url="sqlite:///" + str(Path(fixture_dir.name) / "synthetic.db"),
                 ai_mode="deepseek", deepseek_api_key="mock-only", wechat_app_id="", wechat_app_secret="",
                 ai_transport=httpx.MockTransport(provider))


@app.get("/qa/status")
def status():
    return {"provider": "conversation-isolated-mock", "paid_requests": 0, "calls": calls}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8018, access_log=False)
