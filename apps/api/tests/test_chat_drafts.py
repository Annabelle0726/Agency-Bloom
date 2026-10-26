from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import create_app


def login(c):
    token = c.post('/api/auth/dev', json={'privacy_accepted': True}).json()['token']
    return {'Authorization': f'Bearer {token}'}


def test_unsent_drafts_restore_without_creating_messages_and_respect_versions(tmp_path):
    url = f"sqlite:///{tmp_path / 'drafts.db'}"
    with TestClient(create_app(database_url=url)) as c:
        auth, other = login(c), login(c)
        issue = c.post('/api/issues', headers=auth, json={'title': '探索'}).json()
        key = f'draft:{uuid4()}'
        body = {'version': 0, 'issue_id': issue['id'], 'content': '  未发送\n保留空格  '}
        saved = c.put(f'/api/chat-drafts/{key}', headers=auth, json=body)
        assert saved.status_code == 200
        assert saved.json()['version'] == 1
        assert c.get('/api/chat-drafts', headers=other).json() == []
        assert c.put(f'/api/chat-drafts/{key}', headers=other, json=body).status_code == 404
        assert c.get(f"/api/issues/{issue['id']}/messages", headers=auth).json() == []
        assert c.put(f'/api/chat-drafts/{key}', headers=auth, json=body).status_code == 409
    with TestClient(create_app(database_url=url)) as c:
        restored = c.get('/api/chat-drafts', headers=auth).json()
        assert restored[0]['content'] == body['content']
        assert restored[0]['key'] == key
        assert c.put(f'/api/chat-drafts/{key}', headers=auth,
                     json=body | {'version': 1, 'content': ''}).status_code == 200
        assert c.get('/api/chat-drafts', headers=auth).json()[0]['content'] == ''


def test_conversation_delete_and_retention_opt_out_purge_owned_drafts(tmp_path):
    with TestClient(create_app(database_url=f"sqlite:///{tmp_path / 'drafts.db'}")) as c:
        auth = login(c)
        issue = c.post('/api/issues', headers=auth, json={'title': '探索'}).json()
        conversation = c.post('/api/conversations', headers=auth, json={'issue_id': issue['id']}).json()
        key = conversation['id']
        body = {'version': 0, 'issue_id': issue['id'], 'content': '会话草稿'}
        assert c.put(f'/api/chat-drafts/{key}', headers=auth, json=body).status_code == 200
        assert c.delete(f'/api/conversations/{key}?version=1', headers=auth).status_code == 204
        assert c.get('/api/chat-drafts', headers=auth).json() == []
        key = f'draft:{uuid4()}'
        assert c.put(f'/api/chat-drafts/{key}', headers=auth, json=body).status_code == 200
        c.put('/api/me', headers=auth, json={'save_chat': False})
        assert c.get('/api/chat-drafts', headers=auth).json() == []
        assert c.put(f'/api/chat-drafts/{key}', headers=auth, json=body).status_code == 409
        c.put('/api/me', headers=auth, json={'save_chat': True})
        assert c.get('/api/chat-drafts', headers=auth).json() == []


def test_invalid_and_overlong_drafts_are_rejected_without_server_errors(tmp_path):
    with TestClient(create_app(database_url=f"sqlite:///{tmp_path / 'drafts.db'}")) as c:
        auth = login(c)
        body = {'version': 0, 'content': '字' * 4001}
        assert c.put(f'/api/chat-drafts/draft:{uuid4()}', headers=auth, json=body).status_code == 422
        assert c.put('/api/chat-drafts/bad-key', headers=auth,
                     json={'version': 0, 'content': '输入'}).status_code == 422
