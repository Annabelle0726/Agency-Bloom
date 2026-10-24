"""One-call streaming, private-channel isolation and final persistence."""
import asyncio
import json
import threading
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from test_ai_boundary import ready

from app.main import create_app


def test_stream_cancel_stops_provider_and_does_not_save_partial_reply(tmp_path):
    entered, stopped = threading.Event(), threading.Event()

    class Waiting(httpx.AsyncByteStream):
        async def __aiter__(self):
            try:
                yield b'data: {"choices":[{"delta":{"content":"{\\"reply\\":\\"partial"}}]}\n\n'
                entered.set()
                await asyncio.sleep(30)
            finally:
                stopped.set()

    app = create_app(database_url=f"sqlite:///{tmp_path / 'cancel.db'}", ai_mode='deepseek',
                     deepseek_api_key='mock-only', ai_transport=httpx.MockTransport(lambda request:
                         httpx.Response(200, headers={'content-type': 'text/event-stream'}, stream=Waiting())))
    with TestClient(app) as client, ThreadPoolExecutor() as pool:
        auth, path = ready(client)
        request_id = str(uuid4())
        pending = pool.submit(client.post, path, headers=auth | {'Accept': 'text/event-stream'},
                              json={'request_id': request_id, 'message': '测试停止'})
        assert entered.wait(5)
        assert client.post(f'/api/requests/{request_id}/cancel', headers=auth).status_code == 204
        result = pending.result(timeout=5)
        assert stopped.wait(2)
        assert '"type": "error"' in result.text
        assert client.get(path.removesuffix('/chat') + '/messages', headers=auth).json() == []


class Chunks(httpx.AsyncByteStream):
    def __init__(self, finish="stop"):
        self.finish = finish

    async def __aiter__(self):
        for delta in ({"reasoning_content": "PRIVATE_REASONING"},
                      {"content": '{"reply":"听起来这件事让你很累。'},
                      {"content": '可以先歇一歇 🌿","suggestion":null}'}):
            yield ("data: " + json.dumps({"choices": [{"delta": delta}]}) + "\n\n").encode()
        yield ("data: " + json.dumps({"choices": [{"delta": {}, "finish_reason": self.finish}],
                                     "usage": {"prompt_tokens": 100, "completion_tokens": 40}}) + "\n\n").encode()
        yield b"data: [DONE]\n\n"


@pytest.mark.parametrize('prefix', ['null_content', 'whitespace'])
def test_normal_stream_prefix_does_not_fail_a_complete_reply(tmp_path, prefix):
    class PrefixChunks(httpx.AsyncByteStream):
        async def __aiter__(self):
            deltas = ([{'role': 'assistant', 'content': None},
                       {'content': None, 'reasoning_content': 'PRIVATE_REASONING'}]
                      if prefix == 'null_content' else [{'content': '{"reply":"\\n'}])
            deltas += [{'content': '{"reply":"可以继续聊","suggestion":null}' if prefix == 'null_content'
                        else '可以继续聊","suggestion":null}'}]
            for delta in deltas:
                yield ('data: ' + json.dumps({'choices': [{'delta': delta}]}) + '\n\n').encode()
            yield ('data: ' + json.dumps({'choices': [{'delta': {}, 'finish_reason': 'stop'}],
                                         'usage': {'prompt_tokens': 100, 'completion_tokens': 40}}) + '\n\n').encode()

    app = create_app(database_url=f"sqlite:///{tmp_path / 'prefix.db'}", ai_mode='deepseek',
                     deepseek_api_key='mock-only', ai_transport=httpx.MockTransport(lambda request:
                         httpx.Response(200, headers={'content-type': 'text/event-stream'}, stream=PrefixChunks())))
    with TestClient(app) as client:
        auth, path = ready(client)
        response = client.post(path, headers=auth | {'Accept': 'text/event-stream'},
                               json={'request_id': str(uuid4()), 'message': '你好'})
        events = [json.loads(line[6:]) for line in response.text.splitlines() if line.startswith('data: ')]
        assert events[-1]['type'] == 'done'
        assert events[-1]['response']['reply'].strip() == '可以继续聊'
        assert 'PRIVATE_REASONING' not in response.text


@pytest.mark.parametrize("retained", [True, False])
@pytest.mark.parametrize("finish", ["stop", "length"])
@pytest.mark.parametrize('thinking', [True, False])
def test_stream_is_private_and_commits_only_a_complete_reply(tmp_path, retained, finish, thinking):
    calls = []

    def provider(request):
        calls.append(json.loads(request.content))
        return httpx.Response(200, headers={"content-type": "text/event-stream"}, stream=Chunks(finish))

    app = create_app(database_url=f"sqlite:///{tmp_path / 'stream.db'}", ai_mode="deepseek",
                     deepseek_api_key="mock-only", ai_transport=httpx.MockTransport(provider))
    with TestClient(app) as client:
        auth, path = ready(client)
        client.put('/api/me', headers=auth, json={"save_chat": retained})
        request_id = str(uuid4())
        response = client.post(path, headers=auth | {"Accept": "text/event-stream"},
                               json={"request_id": request_id, "message": "帮我比较两个职业方向" if thinking else "最近真的有点累"})
        assert response.headers['content-type'].startswith('text/event-stream')
        events = [json.loads(line[6:]) for line in response.text.splitlines() if line.startswith('data: ')]
        assert 'PRIVATE_REASONING' not in response.text
        assert len(calls) == 1 and calls[0]['stream'] is True
        assert calls[0]['stream_options'] == {"include_usage": True}
        assert calls[0]['model'] == ('deepseek-v4-pro' if thinking else 'deepseek-flash')
        assert any(e.get('phase') == 'thinking' for e in events) is thinking
        assert any(e.get('type') == 'reply' and '听起来' in e['text'] for e in events)
        terminal = events[-1]
        assert terminal['type'] == ('done' if finish == 'stop' else 'error')
        if finish == 'stop':
            assert terminal['response']['reply'].endswith('🌿')
        else:
            assert terminal['status'] == 502 and terminal['detail']['code'] == 'output_truncated'
        saved = client.get(path.removesuffix('/chat') + '/messages', headers=auth).json()
        assert len(saved) == (2 if retained and finish == 'stop' else 0)
        status = client.get(f'/api/requests/{request_id}', headers=auth).json()
        assert status['status'] == ('completed' if finish == 'stop' else 'failed')
