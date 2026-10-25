import json
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.schemas import AIOutput


@pytest.fixture
def setup(tmp_path):
    with TestClient(create_app(database_url=f"sqlite:///{tmp_path / 'plan.db'}")) as client:
        token = client.post('/api/auth/dev', json={'privacy_accepted': True}).json()['token']
        auth = {'Authorization': 'Bearer ' + token}
        issue = client.post('/api/issues', headers=auth, json={'title': '试做作品', 'constraints': ['保留收入']}).json()
        yield client, auth, issue


def commit(client, auth, issue, **fields):
    return client.post(f"/api/issues/{issue['id']}/plan", headers=auth,
                       json={'request_id': str(uuid4()), 'version': issue['version'], **fields})


def test_plan_record_and_step_are_atomic_versioned_and_linked(setup):
    client, auth, issue = setup
    response = commit(client, auth, issue, next_step='先画草图')
    assert response.status_code == 200
    state = response.json()
    attempt = state['attempt_id']
    issue['version'] = state['version']
    response = commit(client, auth, issue, record={'title': '试过之后', 'text': '卡在不知道给谁用'})
    assert response.status_code == 200
    assert response.json()['status'] == 'active'
    assert response.json()['latest']['text'] == '卡在不知道给谁用'
    assert response.json()['latest']['attempt_id'] == attempt
    # A conflict cannot leave the record half-saved or change the step.
    bad = commit(client, auth, issue, next_step='被覆盖', record={'title': '不应保存', 'text': '冲突'})
    assert bad.status_code == 409
    events = client.get('/api/journey/events', headers=auth, params={'issue_id': issue['id']}).json()['items']
    assert not any(row['text'] == '冲突' for row in events)
    assert client.get(f"/api/issues/{issue['id']}", headers=auth).json()['card']['constraints'] == ['保留收入']


def test_pause_completion_resume_and_repeated_save_are_explicit(setup):
    client, auth, issue = setup
    state = commit(client, auth, issue, next_step='问一位朋友').json()
    body = {'request_id': str(uuid4()), 'version': state['version'], 'status': 'paused'}
    path = f"/api/issues/{issue['id']}/plan"
    first = client.post(path, headers=auth, json=body)
    assert first.status_code == 200
    assert client.post(path, headers=auth, json=body).json()['version'] == first.json()['version']
    assert first.json()['status'] == 'paused'
    assert first.json()['next_step'] == '问一位朋友'
    issue['version'] = first.json()['version']
    completed = commit(client, auth, issue, status='completed').json()
    assert completed['status'] == 'completed'
    issue['version'] = completed['version']
    revised = commit(client, auth, issue, next_step='画一个小原型').json()
    assert revised['status'] == 'active'
    assert revised['attempt_id'] != completed['attempt_id']
    assert revised['latest'] is None


def test_edit_record_preserves_plan_and_is_shared_with_journey(setup):
    client, auth, issue = setup
    state = commit(client, auth, issue, record={'title': '未决定', 'text': '我可能想休息'}).json()
    row = state['records'][0]
    issue['version'] = state['version']
    state = commit(client, auth, issue, record={'id': row['id'], 'version': row['version'],
                    'title': '更正', 'text': '只是今天想休息'}).json()
    assert state['next_step'] == ''
    saved = client.get('/api/journey/events/' + row['id'], headers=auth).json()
    assert saved['text'] == '只是今天想休息'
    assert saved['version'] != row['version']
    assert len([r for r in state['records'] if r['id'] == row['id']]) == 1


def test_ownership_and_ended_guards(setup):
    client, auth, issue = setup
    token = client.post('/api/auth/dev', json={'privacy_accepted': True}).json()['token']
    assert commit(client, {'Authorization': 'Bearer ' + token}, issue, next_step='不允许').status_code == 404
    client.post(f"/api/issues/{issue['id']}/end", headers=auth)
    assert commit(client, auth, issue, next_step='不允许').status_code == 409


def test_optional_plan_draft_does_not_turn_a_question_into_an_action():
    output = AIOutput.model_validate({'reply': '先聊聊', 'plan_draft': {'title': '记录', 'text': '还没决定', 'next_step': None}})
    assert output.plan_draft.text == '还没决定'
    assert output.plan_draft.next_step is None
    assert AIOutput.model_validate({'reply': '回复', 'plan_draft': {'text': []}}).plan_draft is None
    draft = AIOutput.model_validate({'reply': '先聊聊', 'plan_draft': {
        'title': '还没决定', 'text': '仍在了解问题', 'next_step': '你可以先回答一句：目前最卡的是什么？'}})
    assert draft.plan_draft.next_step is None


def test_journey_edits_and_home_read_the_same_plan_record(setup):
    client, auth, issue = setup
    state = commit(client, auth, issue, record={'title': '原话', 'text': '今天想暂停'}).json()
    row = state['records'][0]
    response = client.put('/api/journey/events/' + row['id'], headers=auth,
                          json={'title': '更正', 'text': '只想今天休息', 'version': row['version']})
    assert response.status_code == 200
    current = client.get(f"/api/issues/{issue['id']}", headers=auth).json()
    assert current['plan']['records'][0]['text'] == '只想今天休息'


@pytest.mark.parametrize('retained', [True, False])
def test_chat_draft_requires_review_and_saves_once_without_another_model_call(tmp_path, retained):
    calls = []

    def provider(request):
        calls.append(request)
        return httpx.Response(200, json={'choices': [{'finish_reason': 'stop', 'message': {
            'content': json.dumps({'reply': '这是一份待你修改的记录',
                'plan_draft': {'title': '尝试之后', 'text': '还没决定，想先了解日常', 'next_step': '找朋友聊一聊'}})}}],
            'usage': {'prompt_tokens': 100, 'completion_tokens': 100}})

    app = create_app(database_url=f"sqlite:///{tmp_path / 'chat-plan.db'}", ai_mode='deepseek',
                     deepseek_api_key='mock-only', ai_transport=httpx.MockTransport(provider))
    with TestClient(app) as client:
        token = client.post('/api/auth/dev', json={'privacy_accepted': True}).json()['token']
        auth = {'Authorization': 'Bearer ' + token}
        client.put('/api/me', headers=auth, json={'ai_consent': True, 'save_chat': retained})
        issue = client.post('/api/issues', headers=auth, json={'title': '新的尝试'}).json()
        path = f"/api/issues/{issue['id']}"
        response = client.post(path + '/chat', headers=auth,
            json={'request_id': str(uuid4()), 'message': '帮我整理成记录：还没决定，想先了解日常'})
        assert response.status_code == 200
        draft = response.json()['plan_draft']
        assert draft['text'] == '还没决定，想先了解日常'
        assert client.get(path + '/plan', headers=auth).json()['records'] == []
        conversation = client.get('/api/conversations', headers=auth).json()[0]
        messages_path = f"/api/conversations/{conversation['id']}/messages"
        messages = client.get(messages_path, headers=auth).json()['items']
        assert len(messages) == (2 if retained else 0)
        source = next((m for m in messages if m['role'] == 'assistant'), None)
        if source:
            assert source['payload']['plan_draft'] == draft
        body = {'request_id': str(uuid4()), 'version': issue['version'],
                'record': {'title': draft['title'], 'text': '我的修改：只想先了解，并未决定'}}
        if source:
            body['source_message_id'] = source['id']
        saved = client.post(path + '/plan', headers=auth, json=body)
        assert saved.status_code == 200
        assert saved.json()['next_step'] == ''
        assert len(saved.json()['records']) == 1
        assert client.post(path + '/plan', headers=auth, json=body).json() == saved.json()
        if source:
            messages = client.get(messages_path, headers=auth).json()['items']
            assert next(m for m in messages if m['id'] == source['id'])['payload']['plan_draft'] is None
            assert next(m for m in messages if m['id'] == source['id'])['payload']['plan_saved'] is True
            body.update(request_id=str(uuid4()), version=saved.json()['version'])
            assert client.post(path + '/plan', headers=auth, json=body).status_code == 409
        assert len(calls) == 1


@pytest.mark.asyncio
@pytest.mark.parametrize('mode', ['summary', 'crisis', 'web'])
async def test_plan_drafts_are_removed_from_summary_crisis_and_external_results(mode):
    from app import ai
    from app.config import Settings
    from app.schemas import ChatInput
    body = ChatInput(request_id=uuid4(), message='我现在想自杀' if mode == 'crisis' else '帮我整理记录',
                     task='summary' if mode == 'summary' else 'chat')
    output = {'reply': '一段回复', 'plan_draft': {'title': '不应出现', 'text': '不能当成用户记录'},
              'summary': {'overview': '待确认总结', 'decisions': [], 'open_questions': [], 'next_steps': []}}
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json={
        'choices': [{'finish_reason': 'stop', 'message': {'content': json.dumps(output)}}],
        'usage': {'prompt_tokens': 100, 'completion_tokens': 100}}))
    messages = ai.messages_for({}, [], body, plan_review=True,
        web_results=[{'name': 'synthetic', 'url': 'https://example.invalid', 'snippet': 'unverified'}] if mode == 'web' else None)
    result = await ai.generate(Settings(_env_file=None, ai_mode='deepseek', deepseek_api_key='mock-only'),
                               messages, transport)
    assert result.output.plan_draft is None


def test_rewording_an_attempt_preserves_its_progress_and_pause(setup):
    client, auth, issue = setup
    state = commit(client, auth, issue, next_step='问朋友').json()
    issue['version'] = state['version']
    state = commit(client, auth, issue, status='paused', record={'title': '进展', 'text': '问过一位，想歇一歇'}).json()
    issue['version'] = state['version']
    response = commit(client, auth, issue, next_step='问熟悉行业的朋友', step_action='revise')
    assert response.status_code == 200
    revised = response.json()
    assert revised['attempt_id'] == state['attempt_id']
    assert revised['status'] == 'paused'
    assert revised['latest']['id'] == state['latest']['id']


def test_new_attempt_can_repeat_words_without_reusing_old_progress(setup):
    client, auth, issue = setup
    state = commit(client, auth, issue, next_step='问一位朋友').json()
    issue['version'] = state['version']
    state = commit(client, auth, issue, status='completed', record={'title': '完成', 'text': '已经问过一位'}).json()
    issue['version'] = state['version']
    response = commit(client, auth, issue, next_step='问一位朋友', step_action='replace')
    assert response.status_code == 200
    replacement = response.json()
    assert replacement['attempt_id'] != state['attempt_id']
    assert replacement['status'] == 'active'
    assert replacement['latest'] is None
    assert any(r['text'] == '已经问过一位' for r in replacement['records'])


def test_first_record_and_step_are_linked_but_later_replacement_keeps_observation_with_old_attempt(setup):
    client, auth, issue = setup
    first = commit(client, auth, issue, next_step='先做一个样品', record={'title': '开始', 'text': '我决定先做一个样品'}).json()
    assert first['latest']['text'] == '我决定先做一个样品'
    issue['version'] = first['version']
    second = commit(client, auth, issue, next_step='先了解需求', step_action='replace', record={'title': '新发现', 'text': '做完才发现还不了解需求'}).json()
    assert second['latest'] is None
    row = next(r for r in second['records'] if r['title'] == '新发现')
    assert row['attempt_id'] == first['attempt_id']


def test_completing_current_attempt_cannot_accidentally_complete_a_replacement(setup):
    client, auth, issue = setup
    state = commit(client, auth, issue, next_step='旧的一步').json()
    issue['version'] = state['version']
    response = commit(client, auth, issue, next_step='新的一步', step_action='replace', status='completed')
    assert response.status_code == 422
    assert client.get(f"/api/issues/{issue['id']}/plan", headers=auth).json()['next_step'] == '旧的一步'


def test_reloaded_progress_draft_keeps_its_original_attempt_and_cannot_complete_the_new_one(setup):
    client, auth, issue = setup
    first = commit(client, auth, issue, next_step='旧尝试').json()
    issue['version'] = first['version']
    second = commit(client, auth, issue, next_step='新尝试', step_action='replace').json()
    issue['version'] = second['version']
    invalid = commit(client, auth, issue, status='completed', attempt_id=first['attempt_id'])
    assert invalid.status_code == 409
    saved = commit(client, auth, issue, record={'title': '之前的进展', 'text': '这是旧尝试的经历'},
                   record_attempt_id=first['attempt_id'])
    assert saved.status_code == 200
    assert saved.json()['latest'] is None
    assert next(r for r in saved.json()['records'] if r['title'] == '之前的进展')['attempt_id'] == first['attempt_id']


@pytest.mark.parametrize('editor', ['card', 'direction'])
def test_other_editors_cannot_resurrect_the_status_of_a_removed_attempt(setup, editor):
    client, auth, issue = setup
    state = commit(client, auth, issue, next_step='问朋友').json()
    issue['version'] = state['version']
    state = commit(client, auth, issue, status='completed').json()
    card = {**issue['card'], 'next_step': ''}
    path = f"/api/issues/{issue['id']}/card" if editor == 'card' else f"/api/journey/directions/{issue['id']}"
    removed = client.put(path, headers=auth, json={'version': state['version'],
        **({'card': card} if editor == 'card' else {'next_step': ''})})
    assert removed.status_code == 200
    restored = client.put(path, headers=auth, json={'version': removed.json()['version'],
        **({'card': {**card, 'next_step': '问朋友'}} if editor == 'card' else {'next_step': '问朋友'})})
    assert restored.status_code == 200
    saved = client.get(f"/api/issues/{issue['id']}/plan", headers=auth).json()
    assert saved['status'] == 'active'
    assert saved['attempt_id'] != state['attempt_id']
