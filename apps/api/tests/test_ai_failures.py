"""Multi-turn failure diagnostics without private payloads or paid retries."""

import json
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from test_ai_boundary import ready

from app.main import create_app


@pytest.mark.parametrize('failure', ['output_empty', 'output_truncated'])
@pytest.mark.parametrize('retained', [True, False])
def test_second_turn_failure_does_not_block_following_turn(tmp_path, retained, failure, caplog):
    captured = []

    def provider(request):
        captured.append(json.loads(request.content))
        failed = len(captured) == 2
        truncated = failed and failure == 'output_truncated'
        return httpx.Response(200, json={
            'choices': [{'finish_reason': 'length' if truncated else 'stop', 'message': {
                'content': '{"reply":"private-incomplete' if truncated else '' if failed else json.dumps({'reply': '可以继续聊', 'suggestion': None}),
            }}],
            'usage': {'prompt_tokens': 100, 'completion_tokens': 768 if truncated else 30},
        })

    app = create_app(database_url=f"sqlite:///{tmp_path / 'turns.db'}", ai_mode='deepseek',
                     deepseek_api_key='mock-only', max_output_tokens=768,
                     ai_transport=httpx.MockTransport(provider))
    with TestClient(app) as client:
        auth, legacy_path = ready(client)
        client.put('/api/me', headers=auth, json={'save_chat': retained})
        conv = client.get('/api/conversations', headers=auth).json()[0]
        path = f"/api/conversations/{conv['id']}/chat"
        first = client.post(path, headers=auth, json={'request_id': str(uuid4()), 'message': '你好'})
        assert first.status_code == 200
        history = [{'role': 'user', 'content': '你好'}, {'role': 'assistant', 'content': first.json()['reply']}]
        failed_id = str(uuid4())
        failed = client.post(path, headers=auth, json={'request_id': failed_id, 'message': '继续', 'history': history})
        assert failed.status_code == 502
        assert failed.json()['detail'] == {'code': failure}
        assert 'private-incomplete' not in failed.text + caplog.text
        assert f'code={failure}' in caplog.text
        assert client.get(f'/api/requests/{failed_id}', headers=auth).json()['status'] == 'failed'
        following = client.post(path, headers=auth, json={'request_id': str(uuid4()), 'message': '接着谈', 'history': history})
        assert following.status_code == 200
        assert len(captured) == 3  # One call per action, no automatic paid retry.
        for request in captured[1:]:
            assert request['messages'][2] == history[0]
            # Our provider requests require JSON replies: previous assistant
            # turns must demonstrate that format instead of plain-text replies.
            prior_reply = json.loads(request['messages'][3]['content'])
            assert prior_reply == {'reply': history[1]['content'], 'suggestion': None}
        assert captured[2]['thinking'] == {'type': 'enabled'}
        saved = client.get(legacy_path.removesuffix('/chat') + '/messages', headers=auth).json()
        assert len(saved) == (4 if retained else 0)


@pytest.mark.parametrize('upstream_status,code', [
    (400, 'provider_rejected'), (401, 'provider_auth'), (402, 'provider_balance'),
    (429, 'provider_rate_limit'), (503, 'provider_unavailable'),
])
def test_provider_errors_return_only_allowlisted_codes(tmp_path, upstream_status, code, caplog):
    calls = []

    def provider(request):
        calls.append(request)
        return httpx.Response(upstream_status, json={'error': {'message': 'private-provider-body'}})

    app = create_app(database_url=f"sqlite:///{tmp_path / 'failure.db'}", ai_mode='deepseek',
                     deepseek_api_key='mock-only', ai_transport=httpx.MockTransport(provider))
    with TestClient(app) as client:
        auth, path = ready(client)
        response = client.post(path, headers=auth, json={'request_id': str(uuid4()), 'message': '你好'})
        assert response.status_code == 502
        assert response.json()['detail'] == {'code': code}
        assert len(calls) == 1
        assert 'private-provider-body' not in response.text + caplog.text


@pytest.mark.parametrize('content,usage,code', [
    ('', {'prompt_tokens': 1, 'completion_tokens': 0}, 'output_empty'),
    ('{"reply":"private-text","tail_line":42}', {'prompt_tokens': 1, 'completion_tokens': 1}, 'output_invalid'),
    ('{"reply":"private-text","private-key":42}', {'prompt_tokens': 1, 'completion_tokens': 1}, 'output_invalid'),
    ('{"reply":"private-text"}', None, 'usage_invalid'),
])
def test_validation_failure_diagnostics_do_not_contain_private_output(tmp_path, content, usage, code, caplog):
    app = create_app(database_url=f"sqlite:///{tmp_path / 'validation.db'}", ai_mode='deepseek',
                    deepseek_api_key='mock-only', ai_transport=httpx.MockTransport(lambda r:
                        httpx.Response(200, json={'choices': [{'message': {'content': content}}], 'usage': usage})))
    with TestClient(app) as client:
        auth, path = ready(client)
        response = client.post(path, headers=auth, json={'request_id': str(uuid4()), 'message': '你好'})
        assert response.json()['detail'] == {'code': code}
        assert 'private-text' not in response.text + caplog.text
        assert 'private-key' not in response.text + caplog.text
        if 'tail_line' in content:
            assert 'fields=tail_line' in caplog.text
