from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.main import create_app
from app.models import Message


def test_saved_plan_record_keeps_source_until_conversation_is_deleted(tmp_path):
    url = f"sqlite:///{tmp_path / 'plan.db'}"
    with TestClient(create_app(database_url=url)) as c:
        auth = {'Authorization': 'Bearer ' + c.post('/api/auth/dev', json={'privacy_accepted': True}).json()['token']}
        issue = c.post('/api/issues', headers=auth, json={'title': '求职'}).json()
        conversation = c.get('/api/conversations', headers=auth).json()[0]
        engine = create_engine(url)
        with Session(engine) as db:
            message = Message(issue_id=issue['id'], conversation_id=conversation['id'], role='assistant',
                              content='我们可以先了解实际工作，再决定。', payload={'plan_draft': {'title': '一次了解', 'text': '已经与朋友聊过', 'next_step': None}})
            db.add(message)
            db.commit()
            source_id = message.id
        engine.dispose()
        record_id = str(uuid4())
        saved = c.post(f"/api/issues/{issue['id']}/plan", headers=auth, json={
            'version': issue['version'], 'request_id': record_id, 'source_message_id': source_id,
            'remember_plan': False, 'record': {'title': '一次了解', 'text': '已经与朋友聊过'},
        })
        assert saved.status_code == 200
        detail = c.get(f'/api/journey/events/record:{record_id}', headers=auth)
        assert detail.status_code == 200, detail.text
        assert detail.json()['source_available'] is True
        assert detail.json()['source_text'] == '我们可以先了解实际工作，再决定。'
        assert c.delete(f"/api/conversations/{conversation['id']}?version={conversation['version']}", headers=auth).status_code == 204
        detail = c.get(f'/api/journey/events/record:{record_id}', headers=auth).json()
        assert detail['text'] == '已经与朋友聊过'
        assert detail['source_available'] is False


def test_reusing_a_record_request_in_another_exploration_is_a_safe_conflict(tmp_path):
    with TestClient(create_app(database_url=f"sqlite:///{tmp_path / 'plan.db'}"), raise_server_exceptions=False) as c:
        auth = {'Authorization': 'Bearer ' + c.post('/api/auth/dev', json={'privacy_accepted': True}).json()['token']}
        issues = [c.post('/api/issues', headers=auth, json={'title': title}).json() for title in ['求职', '关系']]
        body = {'request_id': str(uuid4()), 'version': 1, 'remember_plan': False, 'record': {'title': '记录', 'text': '只属于这一件事'}}
        assert c.post(f"/api/issues/{issues[0]['id']}/plan", headers=auth, json=body).status_code == 200
        assert c.post(f"/api/issues/{issues[1]['id']}/plan", headers=auth, json=body).status_code == 409
