"""Isolated localhost native QA API; completion traffic cannot leave MockTransport.

Run: uv run --directory apps/api python ../../tools/mock-exploration-api.py
Uses only output/exploration/native.db, never the application database or ledger.
"""

import asyncio
import json
import sys
from pathlib import Path

import httpx
import uvicorn

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/api"))
from app.main import create_app  # noqa: E402

calls = []


async def provider(request):
    body = json.loads(request.content)
    context = json.loads(body["messages"][1]["content"].split("：", 1)[1])
    message = body["messages"][-1]["content"]
    calls.append({"mode": context["interaction_mode"], "count": 1})
    if message == "测试超时":
        raise httpx.ReadTimeout("isolated QA timeout")
    if message == "测试取消":
        await asyncio.sleep(15)
    clues = "软件开发经历" in json.dumps(
        context, ensure_ascii=False
    ) and "喜欢解释复杂问题" in json.dumps(context, ensure_ascii=False)
    insight = None
    reply = "我们可以先从一次真实经历开始，你最近做过什么让自己愿意多了解一点的事？"
    if context["interaction_mode"] == "listen":
        reply = "我在听，不必急着决定。你可以先说说此刻最想表达的部分"
    elif clues:
        reply = "你留下的两条线索，也许可以连接起来。这是一个待探索角度，是否尝试由你决定"
        insight = {
            "title": "还有一种可能",
            "observation": "你提到软件开发经历，也提到喜欢解释复杂问题",
            "possibility": "也许可以探索同时理解技术和业务、帮助双方沟通的工作内容",
            "uncertainty": "这不是职业适配结论，实际工作内容与要求仍需了解",
            "evidence": ["软件开发经历", "喜欢解释复杂问题"],
            "experiment": {
                "action": "向一位朋友解释一个最近做过的技术概念",
                "tests": "是否享受向非技术受众解释的过程",
                "effort": "二十分钟，不花钱",
                "stop_rule": "觉得疲惫或不想继续时就停止",
            },
        }
    return httpx.Response(
        200,
        json={
            "id": "ISOLATED-EXPLORATION-MOCK",
            "model": "mock-deepseek-flash",
            "choices": [
                {
                    "finish_reason": "stop",
                    "message": {
                        "content": json.dumps(
                            {"reply": reply, "suggestion": None, "insight": insight},
                            ensure_ascii=False,
                        )
                    },
                }
            ],
            "usage": {"prompt_tokens": 100, "completion_tokens": 150},
        },
    )


(ROOT / "output/exploration").mkdir(parents=True, exist_ok=True)
app = create_app(
    environment="development",
    allow_dev_auth=True,
    database_url="sqlite:///" + str(ROOT / "output/exploration/native.db"),
    ai_mode="deepseek",
    deepseek_api_key="mock-not-a-real-key",
    ai_transport=httpx.MockTransport(provider),
)


@app.get("/qa/status")
def status():
    return {"provider": "MockTransport only", "paid_requests": 0, "calls": calls}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8002, access_log=False)
