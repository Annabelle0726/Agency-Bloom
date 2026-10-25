import json
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def workspace(tmp_path):
    captured = []

    def provider(request):
        captured.append(json.loads(request.content))
        return httpx.Response(200, json={'choices': [{'finish_reason': 'stop', 'message': {
            'content': json.dumps({'reply': '我们可以从最新选择继续聊'})}}],
            'usage': {'prompt_tokens': 100, 'completion_tokens': 50}})

    app = create_app(database_url=f"sqlite:///{tmp_path / 'plan-memory.db'}", ai_mode='deepseek',
                     deepseek_api_key='mock-only', ai_transport=httpx.MockTransport(provider))
    with TestClient(app) as client:
        token = client.post('/api/auth/dev', json={'privacy_accepted': True}).json()['token']
        auth = {'Authorization': 'Bearer ' + token}
        client.put('/api/me', headers=auth, json={'ai_consent': True})
        issue = client.post('/api/issues', headers=auth, json={'title': '了解客户的真实需求'}).json()
        yield client, auth, issue, captured


def save(workspace, **changes):
    client, auth, issue, _ = workspace
    path = f"/api/issues/{issue['id']}/plan"
    state = client.get(path, headers=auth).json()
    return client.post(path, headers=auth, json={'request_id': str(uuid4()), 'version': state['version'], **changes})


def memories(workspace):
    client, auth, _, _ = workspace
    return client.get('/api/memories', headers=auth).json()


def test_confirmed_plan_updates_one_scoped_memory_without_enabling_memory_use(workspace):
    client, auth, issue, calls = workspace
    assert save(workspace, next_step='先做一个样品').status_code == 200
    assert memories(workspace) == []
    result = save(workspace, status='completed', remember_plan=True)
    assert result.status_code == 200
    first = memories(workspace)[0]
    assert (first['issue_id'], first['category'], first['horizon'], first['source']) == (issue['id'], 'fact', 'long_term', 'plan_sync')
    assert '已完成' in first['content'] and '先做一个样品' in first['content']
    assert client.get('/api/me', headers=auth).json()['use_memory'] is False
    assert save(workspace, next_step='先问一位客户', step_action='replace',
                record={'title': '改变做法', 'text': '样品做完了，但还不了解客户的需要'}).status_code == 200
    changed = memories(workspace)
    assert len(changed) == 1 and changed[0]['id'] == first['id']
    assert changed[0]['version'] > first['version']
    assert '先问一位客户' in changed[0]['content']
    assert '样品做完了' in changed[0]['content']
    assert len(changed[0]['content']) <= 400
    assert calls == []


@pytest.mark.parametrize('action', ['disable', 'delete', 'edit', 'stop_sync'])
def test_memory_controls_stop_automatic_updates_and_do_not_resurrect_content(workspace, action):
    client, auth, _, _ = workspace
    assert save(workspace, next_step='问朋友', remember_plan=True).status_code == 200
    memory = memories(workspace)[0]
    path = '/api/memories/' + memory['id']
    if action == 'delete':
        assert client.delete(path, headers=auth, params={'version': memory['version']}).status_code == 204
    elif action == 'stop_sync':
        assert save(workspace, status='paused', remember_plan=False).status_code == 200
    else:
        assert client.put(path, headers=auth, json={'version': memory['version'], 'confirmed': True,
            'content': '这是我的独立修改' if action == 'edit' else memory['content'],
            'enabled': action != 'disable', 'issue_id': memory['issue_id']}).status_code == 200
    result = save(workspace, status='completed')
    assert result.status_code == 200 and result.json()['memory_sync'] is False
    rows = memories(workspace)
    if action == 'delete':
        assert rows == []
    elif action == 'edit':
        assert rows[0]['content'] == '这是我的独立修改'
    else:
        assert rows[0]['enabled'] is False


def test_memory_limit_rolls_back_plan_and_retry_does_not_duplicate_memory(workspace):
    client, auth, issue, _ = workspace
    for i in range(40):
        assert client.post('/api/memories', headers=auth, json={'content': f'用户确认的事实{i}', 'confirmed': True}).status_code == 201
    response = save(workspace, next_step='不应半保存', remember_plan=True)
    assert response.status_code == 409
    path = f"/api/issues/{issue['id']}/plan"
    assert client.get(path, headers=auth).json()['next_step'] == ''
    first = memories(workspace)[0]
    client.delete('/api/memories/' + first['id'], headers=auth, params={'version': first['version']})
    body = {'request_id': str(uuid4()), 'version': issue['version'], 'next_step': '问朋友', 'remember_plan': True}
    result = client.post(path, headers=auth, json=body)
    assert result.status_code == 200
    assert client.post(path, headers=auth, json=body).json() == result.json()
    assert len(memories(workspace)) == 40


def test_actual_chat_receives_latest_plan_and_respects_memory_use_and_exploration_scope(workspace):
    client, auth, issue, calls = workspace
    assert save(workspace, next_step='问朋友', remember_plan=True).status_code == 200
    assert save(workspace, status='completed').status_code == 200

    def chat(issue_id):
        conversation = client.post('/api/conversations', headers=auth, json={'issue_id': issue_id}).json()
        response = client.post(f"/api/conversations/{conversation['id']}/chat", headers=auth,
                               json={'request_id': str(uuid4()), 'message': '接下来呢'})
        assert response.status_code == 200
        return json.loads(calls[-1]['messages'][1]['content'].split('：', 1)[1]), response.json()

    context, response = chat(issue['id'])
    assert context['confirmed_plan']['status'] == 'completed'
    assert context['confirmed_plan']['next_step'] == '问朋友'
    assert context['confirmed_memories'] == []
    assert response['supplied_context']['confirmed_plan']['status'] == 'completed'
    client.put('/api/me', headers=auth, json={'use_memory': True})
    context, _ = chat(issue['id'])
    assert len(context['confirmed_memories']) == 1
    assert context['confirmed_memories'][0]['source'] == 'plan_sync'
    assert save(workspace, next_step='', step_action='replace').status_code == 200
    context, _ = chat(issue['id'])
    assert context['confirmed_plan']['status'] == 'empty'
    assert context['confirmed_plan']['changes'][0]['title'] == '暂时不保留下一步'
    other = client.post('/api/issues', headers=auth, json={'title': '另一个问题'}).json()
    context, _ = chat(other['id'])
    assert context.get('confirmed_plan') is None
    assert context['confirmed_memories'] == []


def test_journey_edits_deletion_and_exploration_end_refresh_the_managed_memory(workspace):
    client, auth, issue, _ = workspace
    result = save(workspace, next_step='问朋友', remember_plan=True, record={'title': '经历', 'text': '原来的记录'})
    assert result.status_code == 200
    row = result.json()['latest']
    edited = client.put('/api/journey/events/' + row['id'], headers=auth,
                        json={'version': row['version'], 'title': '更正', 'text': '我更正后的记录'})
    assert edited.status_code == 200
    assert '我更正后的记录' in memories(workspace)[0]['content']
    assert client.delete('/api/journey/events/' + row['id'], headers=auth,
                         params={'version': edited.json()['version']}).status_code == 204
    assert '我更正后的记录' not in memories(workspace)[0]['content']
    client.post(f"/api/issues/{issue['id']}/end", headers=auth)
    assert '探索已结束' in memories(workspace)[0]['content']
    client.post(f"/api/issues/{issue['id']}/resume", headers=auth)
    assert '探索已结束' not in memories(workspace)[0]['content']


def test_memory_conflict_preserves_plan_and_manual_memory_edits(workspace):
    client, auth, issue, _ = workspace
    first = save(workspace, next_step='原来的一步', remember_plan=True).json()
    memory = memories(workspace)[0]
    client.put('/api/memories/' + memory['id'], headers=auth, json={
        'content': '我的独立修改', 'version': memory['version'], 'confirmed': True, 'issue_id': issue['id']})
    result = save(workspace, status='completed', remember_plan=True, memory_version=first['memory_version'])
    assert result.status_code == 409
    assert memories(workspace)[0]['content'] == '我的独立修改'
    assert client.get(f"/api/issues/{issue['id']}/plan", headers=auth).json()['status'] == 'active'


def test_long_records_remain_editable_while_memory_uses_a_bounded_excerpt(workspace):
    step, observation = '用户原话' * 150, '已发生的经历' * 300
    result = save(workspace, next_step=step, record={'title': '完整记录', 'text': observation}, remember_plan=True)
    assert result.status_code == 200
    assert result.json()['next_step'] == step
    assert result.json()['latest']['text'] == observation
    assert len(memories(workspace)[0]['content']) <= 400
    assert '节选' in memories(workspace)[0]['content']


def test_removing_onboarding_snapshot_preserves_confirmed_plan_and_memory_link(workspace):
    client, auth, issue, _ = workspace
    state = save(workspace, next_step='问朋友', remember_plan=True).json()
    state = save(workspace, status='completed').json()
    memory_id = memories(workspace)[0]['id']
    assert client.delete(f"/api/issues/{issue['id']}/snapshot", headers=auth,
                         params={'version': state['version']}).status_code == 204
    current = client.get(f"/api/issues/{issue['id']}/plan", headers=auth).json()
    assert current['status'] == 'completed' and current['memory_sync'] is True
    assert save(workspace, next_step='了解真实需要', step_action='replace').status_code == 200
    assert memories(workspace)[0]['id'] == memory_id
    assert '了解真实需要' in memories(workspace)[0]['content']
