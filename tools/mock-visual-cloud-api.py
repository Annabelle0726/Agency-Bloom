"""Isolated visual QA on port 8032. MockTransport only; no .env or private DB."""
import json
import sys
import tempfile
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
    candidates = context.get("visual_selection", {}).get("candidates", [])
    chosen = candidates[0]["id"] if candidates else None
    calls.append({"candidate_ids": [item["id"] for item in candidates], "visual_id": chosen})
    output = {"reply": "可以先保留稳定收入，了解一次真实的工作体验，再比较实际感受。",
              "suggestion": None, "visual_id": chosen}
    if body.get("stream"):
        class Events(httpx.AsyncByteStream):
            async def __aiter__(self):
                text = json.dumps(output, ensure_ascii=False)
                yield ("data: " + json.dumps({"choices": [{"delta": {"content": text}}]},
                                             ensure_ascii=False) + "\n\n").encode()
                yield ('data: {"choices":[{"delta":{},"finish_reason":"stop"}],'
                       '"usage":{"prompt_tokens":100,"completion_tokens":100}}\n\n').encode()
                yield b"data: [DONE]\n\n"
        return httpx.Response(200, headers={"content-type": "text/event-stream"}, stream=Events())
    return httpx.Response(200, json={
        "choices": [{"finish_reason": "stop", "message": {"content": json.dumps(output)}}],
        "usage": {"prompt_tokens": 100, "completion_tokens": 100},
    })


fixture = tempfile.TemporaryDirectory(prefix="bloom-visual-mock-")
app = create_app(_env_file=None, database_url="sqlite:///" + str(Path(fixture.name) / "qa.db"),
                 environment="development", allow_dev_auth=True, ai_mode="deepseek",
                 deepseek_api_key="mock-only", ai_transport=httpx.MockTransport(provider),
                 wechat_app_id="", wechat_app_secret="")


@app.get("/qa/status")
def status():
    return {"provider": "isolated-mock", "paid_requests": 0, "calls": calls}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8032, access_log=False)
