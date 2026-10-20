"""Plain chat must survive the provider's JSON-mode empty-content failure.

Only complete display text can fall back; structured artifacts remain strict.
"""
import json
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from test_ai_boundary import ready

from app.main import create_app


@pytest.mark.parametrize('retained', [True, False])
def test_chat_uses_one_text_mode_request_per_turn_and_keeps_structured_artifacts(tmp_path, retained):
    calls = []
    outputs = [
        json.dumps({'reply': '今天想聊些什么', 'conversation_title': '今天的心情'}),
        '一周没收到朋友的回应，确实会有点难过。你想先说说发生了什么吗？',
        json.dumps({'reply': '可以慢慢说', 'tail_line': '从最近的感受说起'}),
    ]

    def provider(request):
        body = json.loads(request.content)
        calls.append(body)
        # Reproduce the reported upstream symptom, without a live call in CI.
        content = '' if len(calls) > 1 and body['response_format']['type'] == 'json_object' else outputs[len(calls) - 1]
        return httpx.Response(200, json={
            'choices': [{'finish_reason': 'stop', 'message': {'content': content}}],
            'usage': {'prompt_tokens': 100, 'completion_tokens': 100},
        })

    app = create_app(database_url=f"sqlite:///{tmp_path / 'chat.db'}", ai_mode='deepseek',
                     deepseek_api_key='mock-only', ai_transport=httpx.MockTransport(provider))
    with TestClient(app) as client:
        auth, path = ready(client)
        client.put('/api/me', headers=auth, json={'save_chat': retained})
        before = client.get(path.removesuffix('/chat'), headers=auth).json()['card']
        history = []
        for index, message in enumerate(['你好', '朋友一周没理我了', '我想先说说']):
            response = client.post(path, headers=auth, json={'request_id': str(uuid4()), 'message': message, 'history': history})
            assert response.status_code == 200
            data = response.json()
            history.extend([{'role': 'user', 'content': message}, {'role': 'assistant', 'content': data['reply']}])
            assert data['suggestion'] is None and data['phase_change'] is None
            if index == 1:
                assert data['reply'] == outputs[1]
            if index == 2:
                assert data['tail_line'] == '从最近的感受说起'
        assert len(calls) == 3
        assert all(c['response_format'] == {'type': 'text'} for c in calls)
        assert len(calls[2]['messages']) == 7
        assert client.get(path.removesuffix('/chat'), headers=auth).json()['card'] == before
        assert client.get('/api/memories', headers=auth).json() == []
        saved = client.get(path.removesuffix('/chat') + '/messages', headers=auth).json()
        assert len(saved) == (6 if retained else 0)


@pytest.mark.parametrize('content,finish,task,ok', [
    ('完整的普通回复', 'stop', 'chat', True),
    ('```json\n{"reply":"结构化回复","suggestion":null}\n```', 'stop', 'chat', True),
    ('{"reply":"尚未完整', 'stop', 'chat', False),
    ('{"reply":"不能提升事实","suggestion":{"confirmed":["推测"]}}', 'stop', 'chat', False),
    ('{"reply":"你好","unapproved_field":"private"}', 'stop', 'chat', False),
    ('["列表不是回复对象"]', 'stop', 'chat', False),
    ('"一个 JSON 字符串也不是回复对象"', 'stop', 'chat', False),
    ('```json\n{"reply":"不完整"}', 'stop', 'chat', False),
    ('完整外观但已截断的回复', 'length', 'chat', False),
    ('', 'stop', 'chat', False),
    ('   ', 'stop', 'chat', False),
    ('长' * 4001, 'stop', 'chat', False),
    ('普通文字不能当成结构化总结', 'stop', 'summary', False),
    ('{"reply":"请审阅","summary":{"overview":"讨论小结","decisions":[],"open_questions":[],"next_steps":[]}}', 'stop', 'summary', True),
])
def test_display_fallback_never_salvages_invalid_structured_output(tmp_path, content, finish, task, ok):
    calls = []

    def provider(request):
        calls.append(json.loads(request.content))
        return httpx.Response(200, json={
            'choices': [{'finish_reason': finish, 'message': {'content': content}}],
            'usage': {'prompt_tokens': 100, 'completion_tokens': 100},
        })

    app = create_app(database_url=f"sqlite:///{tmp_path / 'validation.db'}", ai_mode='deepseek',
                    deepseek_api_key='mock-only', ai_transport=httpx.MockTransport(provider))
    with TestClient(app) as client:
        auth, path = ready(client)
        response = client.post(path, headers=auth, json={'request_id': str(uuid4()), 'message': '继续聊', 'task': task})
        assert response.status_code == (200 if ok else 502)
        assert len(calls) == 1
        if task == 'summary':
            assert calls[0]['response_format'] == {'type': 'json_object'}
