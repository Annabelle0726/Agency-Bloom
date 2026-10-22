"""First-send drafts: no model request, no old transcript, owned topic reuse."""
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import create_app


def test_promotion_is_idempotent_owned_and_separate(tmp_path):
    with TestClient(create_app(_env_file=None, database_url=f"sqlite:///{tmp_path / 'entry.db'}",
                              ai_mode='demo', deepseek_api_key='')) as c:
        login = c.post('/api/auth/dev', json={'privacy_accepted': True}).json()
        other = c.post('/api/auth/dev', json={'privacy_accepted': True}).json()
        a = {'Authorization': 'Bearer ' + login['token']}
        b = {'Authorization': 'Bearer ' + other['token']}
        issue = c.post('/api/issues', headers=a, json={'title': '职业选择'}).json()
        body = {'request_id': str(uuid4()), 'issue_id': issue['id'], 'title': '新的问题'}
        assert c.post('/api/discovery/conversations', json=body).status_code == 401
        assert c.post('/api/discovery/conversations', headers=b, json=body).status_code == 404
        first = c.post('/api/discovery/conversations', headers=a, json=body)
        second = c.post('/api/discovery/conversations', headers=a, json=body)
        assert first.status_code == second.status_code == 201
        assert first.json() == second.json()
        conversation = first.json()['conversation']
        assert conversation['id'] != issue['id']
        assert conversation['issue_id'] == issue['id']
        assert conversation['linked_issue_ids'] == [] and conversation['summary'] is None
        assert len(c.get('/api/issues', headers=a).json()) == 1
        assert len(c.get('/api/conversations', headers=a).json()) == 2
        assert c.get('/api/conversations/' + conversation['id'] + '/messages', headers=a).json()['items'] == []
        assert c.post('/api/discovery/conversations', headers=b, json=body).status_code == 409
        c.post('/api/issues/' + issue['id'] + '/end', headers=a)
        assert c.post('/api/discovery/conversations', headers=a, json=body).status_code == 409
        assert c.post('/api/discovery/conversations', headers=a, json={**body, 'request_id': str(uuid4())}).status_code == 409


def test_first_exploration_only_on_promotion_and_no_inferred_background(tmp_path):
    with TestClient(create_app(_env_file=None, database_url=f"sqlite:///{tmp_path / 'empty.db'}",
                              ai_mode='demo', deepseek_api_key='')) as c:
        login = c.post('/api/auth/dev', json={'privacy_accepted': True}).json()
        auth = {'Authorization': 'Bearer ' + login['token']}
        assert c.get('/api/issues', headers=auth).json() == []
        key = str(uuid4())
        body = {'request_id': key, 'issue_id': None, 'title': '我自己改过的问题'}
        first = c.post('/api/discovery/conversations', headers=auth, json=body)
        assert first.status_code == 201
        assert c.post('/api/discovery/conversations', headers=auth, json=body).json() == first.json()
        issue = first.json()['issue']
        assert issue['card']['confirmed'] == [] and issue['card']['hypotheses'] == []
        assert issue['background'] == '' and issue['title'] == body['title']
        assert len(c.get('/api/issues', headers=auth).json()) == 1
        assert len(c.get('/api/conversations', headers=auth).json()) == 1
        assert c.post('/api/discovery/conversations', headers=auth, json={**body, 'title': ' '}).status_code == 422
