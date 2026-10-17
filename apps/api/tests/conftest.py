"""Keep local credentials and production settings out of automated tests."""

import pytest

from app import main
from app.config import Settings


@pytest.fixture(autouse=True)
def isolated_settings(monkeypatch):
    defaults = {
        "_env_file": None,
        "environment": "development",
        "ai_mode": "demo",
        "allow_dev_auth": True,
        "deepseek_api_key": "",
        "wechat_app_id": "",
        "wechat_app_secret": "",
    }
    monkeypatch.setattr(main, "Settings", lambda **kwargs: Settings(**(defaults | kwargs)))
