import asyncio
import json
import threading
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from test_ai_boundary import ready
from test_journey import login

from app.main import create_app


def test_edit_replaces_branch_atomically_and_uses_corrected_context(tmp_path):
    calls = []
    fail = False

    def provider(request):
        calls.append(json.loads(request.content))
        return httpx.Response(200, json={
            'choices': [{'finish_reason': 'stop', 'message': {
                'content': '' if fail else '{"reply":"新的回应"}'}}],
            'usage': {'prompt_tokens': 100, 'completion_tokens': 20},
        })

    app = create_app(database_url=f"sqlite:///{tmp_path / 'edit.db'}", ai_mode='deepseek',
                     deepseek_api_key='mock', ai_transport=httpx.MockTransport(provider))
    with TestClient(app) as client:
        auth, legacy = ready(client)
        client.put('/api/me', headers=auth, json={'save_chat': True})
        cid = legacy.split('/')[-2]
        path = f'/api/conversations/{cid}'

        def send(text, **extra):
            return client.post(path + '/chat', headers=auth,
                               json={'request_id': str(uuid4()), 'message': text, **extra})

        assert send('第一条').status_code == 200
        assert send('旧的第二条').status_code == 200
        rows = client.get(path + '/messages', headers=auth).json()['items']
        edit = {'edit_message_id': rows[2]['id'], 'edit_tail_id': rows[-1]['id']}
        conversation = client.get(path, headers=auth).json()
        client.put(path + '/summary', headers=auth, json={
            'version': conversation['version'], 'summary': {'overview': '旧总结'}})
        fail = True
        assert send('修改后的第二条', **edit).status_code == 502
        assert client.get(path + '/messages', headers=auth).json()['items'] == rows
        fail = False
        result = send('修改后的第二条', **edit)
        assert result.status_code == 200
        saved = client.get(path + '/messages', headers=auth).json()['items']
        assert [r['content'] for r in saved] == ['第一条', '新的回应', '修改后的第二条', '新的回应']
        assert result.json()['user_message_id'] == saved[2]['id']
        assert result.json()['assistant_message_id'] == saved[3]['id']
        assert client.get(path, headers=auth).json()['summary'] is None
        prompt = json.dumps(calls[-1], ensure_ascii=False)
        assert '修改后的第二条' in prompt and '旧的第二条' not in prompt and '旧总结' not in prompt
        count = len(calls)
        assert send('过期重试', **edit).status_code == 409
        assert send('修改机器人', edit_message_id=saved[-1]['id'],
                    edit_tail_id=saved[-1]['id']).status_code == 409
        assert len(calls) == count
        # A different owned conversation's target cannot be edited through this route.
        other = client.post('/api/conversations', headers=auth,
                            json={'issue_id': cid, 'title': '另一段会话'}).json()
        forged = {'request_id': str(uuid4()), 'message': '篡改',
                  'edit_message_id': saved[0]['id'], 'edit_tail_id': saved[-1]['id']}
        assert client.post(f"/api/conversations/{other['id']}/chat",
                           headers=auth, json=forged).status_code == 409
        stranger = login(client)
        assert client.post(path + '/chat', headers=stranger, json=forged).status_code == 404
        assert send('缺少末尾标识', edit_message_id=saved[0]['id']).status_code == 409
        assert send('不能修改总结', task='summary', edit_message_id=saved[0]['id'],
                    edit_tail_id=saved[-1]['id']).status_code == 409
        assert send('错误的保留状态', edit_in_memory=True).status_code == 409
        assert len(calls) == count
        assert send('修正第一条', edit_message_id=saved[0]['id'],
                    edit_tail_id=saved[-1]['id']).status_code == 200
        assert len(client.get(path + '/messages', headers=auth).json()['items']) == 2
        assert send('接着说').status_code == 200
        prompt = json.dumps(calls[-1], ensure_ascii=False)
        assert '修正第一条' in prompt and '修改后的第二条' not in prompt
        client.put('/api/me', headers=auth, json={'save_chat': False})
        assert send('已经删除', **edit).status_code == 409
        assert send('不保存的修正', edit_in_memory=True).status_code == 200
        assert client.get(path + '/messages', headers=auth).json()['items'] == []


@pytest.mark.parametrize('action', ['cancel', 'retention'])
def test_inflight_edit_cannot_destroy_or_resurrect_history(tmp_path, action):
    entered, release = threading.Event(), threading.Event()
    calls = 0

    async def provider(request):
        nonlocal calls
        calls += 1
        if calls > 1:
            entered.set()
            while not release.is_set():
                await asyncio.sleep(0.01)
        return httpx.Response(200, json={
            'choices': [{'message': {'content': '{"reply":"测试回复"}'}}],
            'usage': {'prompt_tokens': 20, 'completion_tokens': 20}})

    app = create_app(database_url=f"sqlite:///{tmp_path / 'race.db'}", ai_mode='deepseek',
                     deepseek_api_key='mock', ai_transport=httpx.MockTransport(provider))
    with TestClient(app) as client, ThreadPoolExecutor() as pool:
        auth, legacy = ready(client)
        client.put('/api/me', headers=auth, json={'save_chat': True})
        path = f"/api/conversations/{legacy.split('/')[-2]}"
        client.post(path + '/chat', headers=auth,
                    json={'request_id': str(uuid4()), 'message': '原文'})
        rows = client.get(path + '/messages', headers=auth).json()['items']
        rid = str(uuid4())
        pending = pool.submit(client.post, path + '/chat', headers=auth, json={
            'request_id': rid, 'message': '修改', 'edit_message_id': rows[0]['id'],
            'edit_tail_id': rows[-1]['id']})
        try:
            assert entered.wait(5)
            if action == 'cancel':
                assert client.post(f'/api/requests/{rid}/cancel', headers=auth).status_code == 204
            else:
                assert client.put('/api/me', headers=auth, json={'save_chat': False}).status_code == 200
        finally:
            release.set()
        assert pending.result(timeout=5).status_code == 409
        assert client.get(path + '/messages', headers=auth).json()['items'] == (
            rows if action == 'cancel' else [])
