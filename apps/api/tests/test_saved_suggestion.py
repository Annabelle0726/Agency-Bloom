from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import create_app


def test_saved_suggestion_stays_consumed_when_conversation_reloads(tmp_path):
    with TestClient(create_app(database_url=f"sqlite:///{tmp_path / 'proposal.db'}")) as c:
        token = c.post('/api/auth/dev', json={'privacy_accepted': True}).json()['token']
        auth = {'Authorization': f'Bearer {token}'}
        c.put('/api/me', headers=auth, json={'ai_consent': True})
        issue = c.post('/api/issues', headers=auth, json={'title': '设计方向'}).json()
        conversation = c.post('/api/conversations', headers=auth, json={'issue_id': issue['id']}).json()
        path = f"/api/conversations/{conversation['id']}"
        reply = c.post(f'{path}/chat', headers=auth, json={
            'request_id': str(uuid4()), 'message': '我想探索产品设计', 'history': [],
        }).json()
        assert reply['suggestion']
        body = {'version': issue['version'], 'card': issue['card'],
                'suggestion_message_id': reply['assistant_message_id']}
        other_issue = c.post('/api/issues', headers=auth, json={'title': '另一个问题'}).json()
        assert c.put(f"/api/issues/{other_issue['id']}/card", headers=auth,
                     json=body | {'card': other_issue['card']}).status_code == 409
        # A conflict must leave the proposal available for another save attempt.
        assert c.put(f"/api/issues/{issue['id']}/card", headers=auth,
                     json=body | {'version': 999}).status_code == 409
        assert c.get(f'{path}/messages', headers=auth).json()['items'][-1]['payload']['suggestion']
        saved = c.put(f"/api/issues/{issue['id']}/card", headers=auth, json=body)
        assert saved.status_code == 200
        message = c.get(f'{path}/messages', headers=auth).json()['items'][-1]
        assert message['payload']['suggestion'] is None
        assert message['payload']['plan_saved'] is True
        assert message['content'] == reply['reply']
        # A later independent proposal is still available.
        c.post(f'{path}/chat', headers=auth, json={
            'request_id': str(uuid4()), 'message': '再考虑一个新方向', 'history': [],
        })
        assert c.get(f'{path}/messages', headers=auth).json()['items'][-1]['payload']['suggestion']
