from fastapi.testclient import TestClient

from app.main import create_app


def login(client):
    result = client.post('/api/auth/dev', json={'privacy_accepted': True}).json()
    return {'Authorization': f"Bearer {result['token']}"}


def draft(version=0, step=1, status='in_progress'):
    return {'version': version, 'step': step, 'status': status, 'answers': {
        'concerns': ['relationships'], 'exploration_intent': 'relationships',
        'support_style': '', 'follow_ups': {
            'relationships': {'selections': ['自己的想法和家人的期待不同'], 'note': '暂时不知道怎么说'},
            'job_search': {'selections': [], 'note': '未启用分支的本机草稿', 'refinements': {'旧选择': ['原回答']}},
        },
    }}


def test_progress_restores_after_restart_and_pause_without_creating_an_exploration(tmp_path):
    url = f"sqlite:///{tmp_path / 'progress.db'}"
    with TestClient(create_app(database_url=url)) as c:
        auth = login(c)
        assert c.get('/api/onboarding-progress', headers=auth).json() is None
        saved = c.put('/api/onboarding-progress', headers=auth, json=draft())
        assert saved.status_code == 200, saved.text
        assert saved.json()['version'] == 1
        paused = c.put('/api/onboarding-progress', headers=auth, json=draft(1, status='paused'))
        assert paused.status_code == 200
    with TestClient(create_app(database_url=url)) as c:
        restored = c.get('/api/onboarding-progress', headers=auth).json()
        assert restored['step'] == 1 and restored['status'] == 'paused'
        assert restored['answers']['follow_ups']['relationships']['note'] == '暂时不知道怎么说'
        assert restored['answers']['follow_ups']['job_search']['refinements'] == {'旧选择': ['原回答']}
        assert c.get('/api/issues', headers=auth).json() == []


def test_progress_is_owned_versioned_and_not_tied_to_chat_retention(tmp_path):
    with TestClient(create_app(database_url=f"sqlite:///{tmp_path / 'progress.db'}")) as c:
        a, b = login(c), login(c)
        assert c.get('/api/onboarding-progress').status_code == 401
        assert c.put('/api/onboarding-progress', headers=a, json=draft()).status_code == 200
        assert c.get('/api/onboarding-progress', headers=b).json() is None
        assert c.put('/api/onboarding-progress', headers=a, json=draft()).status_code == 409
        c.put('/api/me', headers=a, json={'save_chat': False})
        assert c.put('/api/onboarding-progress', headers=a, json=draft(1, step=2)).status_code == 200
        assert c.get('/api/onboarding-progress', headers=a).json()['step'] == 2
        assert c.delete('/api/me', headers=a).status_code == 204
        assert c.get('/api/onboarding-progress', headers=a).status_code == 401


def test_finish_is_atomic_and_prevents_late_writes_and_duplicate_submissions(tmp_path):
    with TestClient(create_app(database_url=f"sqlite:///{tmp_path / 'progress.db'}")) as c:
        auth = login(c)
        c.put('/api/onboarding-progress', headers=auth, json=draft())
        body = {'title': '先理清自己的想法', 'concerns': ['relationships'],
                'exploration_intent': 'relationships', 'onboarding_progress_version': 1}
        finished = c.post('/api/issues', headers=auth, json=body)
        assert finished.status_code == 201, finished.text
        row = c.get('/api/onboarding-progress', headers=auth).json()
        assert row['status'] == 'completed' and row['answers'] is None and row['step'] == 4
        assert c.put('/api/onboarding-progress', headers=auth, json=draft(1)).status_code == 409
        assert c.post('/api/issues', headers=auth, json=body).status_code == 409
        assert len(c.get('/api/issues', headers=auth).json()) == 1
        assert c.put('/api/onboarding-progress', headers=auth, json=draft(row['version'])).status_code == 200


def test_invalid_progress_is_rejected_and_failed_completion_preserves_it(tmp_path):
    with TestClient(create_app(database_url=f"sqlite:///{tmp_path / 'progress.db'}")) as c:
        auth = login(c)
        for body in [draft(step=5), draft(step=-1), draft(status='anything'),
                     dict(draft(), answers={'unknown': 'data'}),
                     dict(draft(), answers={'background': '字' * 401}),
                     dict(draft(), answers={'follow_ups': {'': {}}})]:
            assert c.put('/api/onboarding-progress', headers=auth, json=body).status_code == 422
        assert c.put('/api/onboarding-progress', headers=auth, json=draft()).status_code == 200
        assert c.post('/api/issues', headers=auth, json={'onboarding_progress_version': 2, 'concerns': ['relationships']}).status_code == 409
        assert c.get('/api/onboarding-progress', headers=auth).json()['status'] == 'in_progress'
        assert c.get('/api/issues', headers=auth).json() == []


def test_empty_q1_can_be_saved_as_a_draft_but_cannot_complete_the_questionnaire(tmp_path):
    with TestClient(create_app(database_url=f"sqlite:///{tmp_path / 'required.db'}")) as c:
        auth = login(c)
        empty = {'version': 0, 'step': 4, 'status': 'paused', 'answers': {}}
        assert c.put('/api/onboarding-progress', headers=auth, json=empty).status_code == 200
        failed = c.post('/api/issues', headers=auth, json={'onboarding_progress_version': 1})
        assert failed.status_code == 422
        row = c.get('/api/onboarding-progress', headers=auth).json()
        assert row['version'] == 1 and row['status'] == 'paused' and row['answers'] is not None
        assert c.get('/api/issues', headers=auth).json() == []
        completed = c.post('/api/issues', headers=auth, json={
            'onboarding_progress_version': 1, 'concerns': ['unsure'], 'exploration_intent': 'unsure',
        })
        assert completed.status_code == 201, completed.text
        assert completed.json()['concerns'] == ['unsure']
        assert c.get('/api/onboarding-progress', headers=auth).json()['status'] == 'completed'


def test_direct_exploration_creation_still_accepts_a_question_without_topic_options(tmp_path):
    with TestClient(create_app(database_url=f"sqlite:///{tmp_path / 'direct.db'}")) as c:
        auth = login(c)
        result = c.post('/api/issues', headers=auth, json={'title': '直接写下的问题'})
        assert result.status_code == 201
