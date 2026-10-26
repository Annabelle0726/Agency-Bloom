from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import create_app


def test_retrying_independent_problem_creation_does_not_duplicate_cards(tmp_path):
    with TestClient(create_app(database_url=f"sqlite:///{tmp_path / 'issues.db'}")) as c:
        auth = {'Authorization': 'Bearer ' + c.post('/api/auth/dev', json={'privacy_accepted': True}).json()['token']}
        original = c.post('/api/issues', headers=auth, json={'title': '求职'}).json()
        body = {'title': '关系沟通', 'creation_request_id': str(uuid4())}
        first = c.post('/api/issues', headers=auth, json=body)
        retry = c.post('/api/issues', headers=auth, json=body)
        assert first.status_code == retry.status_code == 201
        assert first.json()['id'] == retry.json()['id']
        assert len(c.get('/api/issues', headers=auth).json()) == 2
        assert c.get(f"/api/issues/{original['id']}", headers=auth).json()['card'] == original['card']
        assert c.post('/api/issues', headers=auth, json=body | {'title': '更改后的内容'}).status_code == 409
