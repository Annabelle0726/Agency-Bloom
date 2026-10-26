from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import create_app


def test_draft_source_references_restore_and_cannot_reference_another_account(tmp_path):
    with TestClient(create_app(database_url=f"sqlite:///{tmp_path / 'sources.db'}")) as c:
        def login():
            return {'Authorization': 'Bearer ' + c.post('/api/auth/dev', json={'privacy_accepted': True}).json()['token']}
        auth, other = login(), login()
        own = c.post('/api/issues', headers=auth, json={'title': '求职'}).json()
        private = c.post('/api/issues', headers=other, json={'title': '私人问题'}).json()
        source = {'id': 'angle', 'issue_id': own['id'], 'strategy': 'boundary', 'quote': '收入不能中断', 'text': '带入的完整文字'}
        key = 'draft:' + str(uuid4())
        body = {'version': 0, 'issue_id': own['id'], 'content': '我的原稿\n收入不能中断', 'source_refs': [source]}
        saved = c.put(f'/api/chat-drafts/{key}', headers=auth, json=body)
        assert saved.status_code == 200, saved.text
        assert c.get('/api/chat-drafts', headers=auth).json()[0]['source_refs'] == [source]
        body['source_refs'] = [source | {'issue_id': private['id']}]
        body['version'] = 1
        assert c.put(f'/api/chat-drafts/{key}', headers=auth, json=body).status_code == 404
