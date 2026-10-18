import pytest
from fastapi.testclient import TestClient
from test_journey import login

from app.main import create_app


def test_all_themes_persist_without_changing_account_or_privacy(tmp_path):
    app = create_app(database_url=f"sqlite:///{tmp_path / 'themes.db'}")
    with TestClient(app) as client:
        auth = login(client)
        original = client.get('/api/me', headers=auth).json()
        for theme in ('light', 'dark', 'dawn', 'forest', 'lavender', 'minimal'):
            updated = client.put('/api/me', headers=auth, json={'theme': theme})
            assert updated.status_code == 200
            assert client.get('/api/me', headers=auth).json()['theme'] == theme
            for key in ('id', 'save_chat', 'ai_consent', 'support_style'):
                assert updated.json()[key] == original[key]
        assert client.put('/api/me', headers=auth, json={'theme': 'unknown'}).status_code == 422
        assert client.get('/api/me', headers=auth).json()['theme'] == 'minimal'


@pytest.mark.parametrize('theme', ['dawn', 'forest', 'lavender', 'minimal'])
def test_theme_changes_require_authentication(tmp_path, theme):
    with TestClient(create_app(database_url=f"sqlite:///{tmp_path / 'auth.db'}")) as client:
        assert client.put('/api/me', json={'theme': theme}).status_code == 401
