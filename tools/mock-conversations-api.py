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
from starlette.responses import JSONResponse

ROOT = Path(__file__).resolve().parents[1]
os.environ["AGENCY_DATABASE_URL"] = "sqlite://"
os.environ["AGENCY_AI_MODE"] = "demo"
sys.path.insert(0, str(ROOT / "apps/api"))
from app.main import create_app  # noqa: E402

calls = 0
consent_failures = 0
speech_download_failures = 0
stream_fixture = None


class StreamFixture(httpx.AsyncByteStream):
    def __init__(self, output, controlled=False):
        self.output = output
        self.controlled = controlled
        self.steps = asyncio.Queue()

    async def __aiter__(self):
        yield ('data: ' + json.dumps({'choices': [{'delta': {'content': None, 'reasoning_content': 'MOCK_PRIVATE_REASONING'}}]}) + '\n\n').encode()
        await asyncio.sleep(1)
        text = self.output if isinstance(self.output, str) else json.dumps(self.output, ensure_ascii=False)
        for offset in range(0, len(text), 40):
            if self.controlled and offset in (160, 640):
                await self.steps.get()
            yield ('data: ' + json.dumps({'choices': [{'delta': {'content': text[offset:offset+40]}}]}, ensure_ascii=False) + '\n\n').encode()
            await asyncio.sleep(.15)
        yield ('data: ' + json.dumps({'choices': [{'delta': {}, 'finish_reason': 'stop'}], 'usage': {'prompt_tokens': 100, 'completion_tokens': 100}}) + '\n\n').encode()
        yield b'data: [DONE]\n\n'


async def provider(request):
    global calls, stream_fixture
    calls += 1
    body = json.loads(request.content)
    if "等待状态测试" in body["messages"][-1]["content"]:
        await asyncio.sleep(20)
    if '异常格式测试' in body['messages'][-1]['content']:
        return httpx.Response(200, headers={'content-type': 'text/event-stream'}, stream=StreamFixture('{"reply":INVALID}'))
    if "等待失败测试" in body["messages"][-1]["content"]:
        return httpx.Response(200, json={"choices": [{"message": {"content": ""}}],
                                       "usage": {"prompt_tokens": 100, "completion_tokens": 0}})
    if "慢回复" in body["messages"][-1]["content"]:
        await asyncio.sleep(3)
    output = {"reply": "［隔离 Mock］已接续本会话，可以比较收入约束和实际时间投入", "suggestion": None}
    if any(marker in body['messages'][-1]['content'] for marker in ('流式体验测试', '异常铺底测试')):
        output['reply'] = '［隔离 Mock］听起来你已经为这件事投入了很多心力，累的时候也可以先停一下 🌿\n\n' + ('我们可以从眼前最在意的事聊起，按你舒服的节奏往下走。\n\n' * 24)
    context = json.loads(body['messages'][1]['content'].split('：', 1)[1])
    if context.get('first_turn'):
        output['conversation_title'] = body['messages'][-1]['content'][:12]
    if '现在更想' in body['messages'][-1]['content'] and context.get('current_phase'):
        source = context['current_phase'][0]
        if source['id'] not in context.get('dismissed_changes', []):
            output['phase_change'] = {'source_id': source['id'], 'evidence': body['messages'][-1]['content']}
    if "本次任务是整理会话" in body["messages"][0]["content"]:
        output["summary"] = {"overview": "［隔离 Mock］比较工作选择与每周可投入时间", "decisions": ["先保留稳定收入"],
                             "open_questions": ["实际工作时间还需核实"], "next_steps": ["了解一次真实工作体验"]}
    if body.get('stream'):
        stream_fixture = StreamFixture(output, controlled='流式体验测试' in body['messages'][-1]['content'])
        return httpx.Response(200, headers={'content-type': 'text/event-stream'}, stream=stream_fixture)
    return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(output, ensure_ascii=False)}}],
                                   "usage": {"prompt_tokens": 100, "completion_tokens": 100}})


fixture_dir = tempfile.TemporaryDirectory(prefix="agency-conversation-qa-")
app = create_app(_env_file=None, environment="development", allow_dev_auth=True,
                 database_url="sqlite:///" + str(Path(fixture_dir.name) / "synthetic.db"),
                 ai_mode="deepseek", deepseek_api_key="mock-only", wechat_app_id="", wechat_app_secret="",
                 tts_mode="mock", tts_paid_enabled=False,
                 cors_origins=['http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:5189'],
                 ai_transport=httpx.MockTransport(provider), ai_timeout_seconds=120)


@app.get("/qa/status")
def status():
    return {"provider": "conversation-isolated-mock", "paid_requests": 0, "calls": calls}


@app.post("/qa/stream-step")
async def stream_step():
    if stream_fixture:
        stream_fixture.steps.put_nowait(None)
    return {"released": True}


@app.post("/qa/fail-next-consent")
def fail_next_consent():
    global consent_failures
    consent_failures = 1
    return {"armed": True}


@app.middleware("http")
async def consent_failure_fixture(request, call_next):
    global consent_failures
    if consent_failures and request.method == "PUT" and request.url.path == "/api/me":
        body = await request.json()
        if body.get("ai_consent") is True:
            consent_failures -= 1
            return JSONResponse({"detail": "Synthetic consent save failure"}, status_code=503)
    return await call_next(request)


@app.post('/qa/fail-next-speech-download')
def fail_speech_download():
    global speech_download_failures
    speech_download_failures = 1
    return {'armed': True}


@app.middleware('http')
async def speech_failure_fixture(request, call_next):
    global speech_download_failures
    if speech_download_failures and request.url.path.startswith('/api/speech/audio/'):
        speech_download_failures -= 1
        return JSONResponse({'detail': 'Synthetic audio network failure'}, status_code=503)
    return await call_next(request)


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8018, access_log=False)
