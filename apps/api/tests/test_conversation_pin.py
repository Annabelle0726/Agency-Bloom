"""Pinning is owned presentation metadata, never a context change or model call."""
from fastapi.testclient import TestClient
from sqlalchemy import text
from test_journey import issue, login

from app.main import create_app


def test_pin_survives_reload_sorts_before_recent_and_unpin_restores_recency(tmp_path):
    app = create_app(database_url=f"sqlite:///{tmp_path / 'pin.db'}")
    with TestClient(app) as client:
        auth = login(client)
        item = issue(client, auth)
        old = client.get('/api/conversations', headers=auth).json()[0]
        newest = client.post('/api/conversations', headers=auth, json={
            'issue_id': item['id'], 'title': 'A newer conversation',
        }).json()
        path = f"/api/conversations/{old['id']}"
        pinned = client.put(path + '/pin', headers=auth, json={'version': old['version'], 'pinned': True})
        assert pinned.status_code == 200
        assert pinned.json()['pinned_at']
        assert pinned.json()['version'] == old['version']
        assert pinned.json()['updated_at'] == old['updated_at']
        again = client.put(path + '/pin', headers=auth, json={'version': old['version'], 'pinned': True})
        assert again.json()['pinned_at'] == pinned.json()['pinned_at']
        assert client.get('/api/conversations', headers=auth).json()[0]['id'] == old['id']
        assert client.get(path, headers=auth).json()['pinned_at'] == pinned.json()['pinned_at']
        unpin = client.put(path + '/pin', headers=auth, json={'version': old['version'], 'pinned': False})
        assert unpin.json()['pinned_at'] is None
        assert client.get('/api/conversations', headers=auth).json()[0]['id'] == newest['id']


def test_pin_checks_owner_and_version_and_leaves_pending_reply_alone(tmp_path):
    app = create_app(database_url=f"sqlite:///{tmp_path / 'owned-pin.db'}")
    with TestClient(app) as client:
        auth = login(client)
        issue(client, auth)
        conv = client.get('/api/conversations', headers=auth).json()[0]
        path = f"/api/conversations/{conv['id']}/pin"
        other = login(client)
        assert client.put(path, headers=other, json={'version': conv['version'], 'pinned': True}).status_code == 404
        assert client.put(path, headers=auth, json={'version': conv['version'] + 1, 'pinned': True}).status_code == 409
        # A pin must not enter the generic context-update cancellation path.
        from unittest.mock import patch
        with patch('app.conversations.cancel_pending') as cancel:
            assert client.put(path, headers=auth, json={'version': conv['version'], 'pinned': True}).status_code == 200
            cancel.assert_not_called()
        assert client.get('/api/usage', headers=auth).status_code == 200


def test_legacy_local_upgrade_adds_nullable_pin_without_losing_conversations(tmp_path):
    from sqlalchemy import create_engine, inspect

    from app.local_schema import upgrade_local
    app = create_app(database_url=f"sqlite:///{tmp_path / 'legacy-pin.db'}")
    with TestClient(app) as client:
        auth = login(client)
        issue(client, auth)
        old = client.get('/api/conversations', headers=auth).json()[0]
    engine = create_engine(f"sqlite:///{tmp_path / 'legacy-pin.db'}")
    # Simulate the previous schema before the additive upgrade.
    with engine.begin() as db:
        if 'pinned_at' in {c['name'] for c in inspect(db).get_columns('conversations')}:
            db.exec_driver_sql('ALTER TABLE conversations DROP COLUMN pinned_at')
    upgrade_local(engine)
    with engine.connect() as db:
        row = db.execute(text('SELECT id, pinned_at FROM conversations WHERE id=:id'), {'id': old['id']}).one()
        assert row.id == old['id'] and row.pinned_at is None
    engine.dispose()
