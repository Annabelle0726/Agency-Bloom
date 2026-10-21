"""Isolated response-explanation QA, port 8022; no provider calls or private DB."""
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
    context = json.loads(body["messages"][1]["content"].split("：", 1)[1])
    question = body["messages"][-1]["content"]
    await asyncio.sleep(3)
    output = {"reply": "［隔离 Mock］今天可以慢慢说，不用急着整理好", "suggestion": None}
    if "稳定收入" in question:
        texts = ["你希望保留稳定收入，同时看看其他可能。",
                 "每周只有两小时，先做一次短访谈比立刻辞职更合适。"]
        source = next(s["id"] for s in context["response_evidence"] if s["text"] == question)
        output = {"reply": "\n".join(texts), "suggestion": None, "reasoning_summary": [
            {"kind": "understanding", "text": texts[0],
             "evidence": [{"source_id": source, "quote": "保留稳定收入"}]},
            {"kind": "tradeoff", "text": texts[1],
             "evidence": [{"source_id": source, "quote": "每周只能投入两小时"}]},
        ]}
    return httpx.Response(200, json={
        "model": body["model"],
        "choices": [{"finish_reason": "stop", "message": {
            "content": json.dumps(output, ensure_ascii=False),
            "reasoning_content": "PRIVATE_TRACE_SENTINEL system prompt tool_calls",
        }}],
        "usage": {"prompt_tokens": 100, "completion_tokens": 200},
    })


fixture = tempfile.TemporaryDirectory(prefix="agency-reasoning-qa-")
app = create_app(_env_file=None, environment="development", allow_dev_auth=True,
                 database_url="sqlite:///" + str(Path(fixture.name) / "synthetic.db"),
                 ai_mode="deepseek", deepseek_api_key="mock-only", deepseek_model="deepseek-v4-pro",
                 wechat_app_id="", wechat_app_secret="", ai_transport=httpx.MockTransport(provider))


@app.get("/qa/status")
def status():
    return {"provider": "reasoning-isolated-mock", "paid_requests": 0, "calls": calls}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8022, access_log=False)
