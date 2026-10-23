"""Isolated Bloom Moment UI fixtures on 8030. No env file, provider key or private DB."""
import os
import sys
import tempfile
from pathlib import Path

import uvicorn
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[1]
os.environ['AGENCY_DATABASE_URL'] = 'sqlite://'
os.environ['AGENCY_AI_MODE'] = 'demo'
sys.path.insert(0, str(ROOT / 'apps/api'))
from app.main import create_app  # noqa: E402
from app.models import Memory  # noqa: E402

storage = tempfile.TemporaryDirectory(prefix='bloom-moment-qa-')
url = 'sqlite:///' + str(Path(storage.name) / 'synthetic.db')
app = create_app(_env_file=None, environment='development', database_url=url,
                 ai_mode='demo', deepseek_api_key='', allow_dev_auth=True,
                 wechat_app_id='', wechat_app_secret='')


@app.get('/qa/status')
def status():
    return {'provider': 'moments-isolated', 'paid_requests': 0}


@app.post('/qa/seed')
def seed(theme: str = 'forest', consent: bool = True):
    with TestClient(app) as client:
        login = client.post('/api/auth/dev', json={'privacy_accepted': True}).json()
        auth = {'Authorization': 'Bearer ' + login['token']}
        client.put('/api/me', headers=auth, json={
            'theme': theme, 'ai_consent': consent, 'use_memory': True, 'save_chat': True})
        engine = create_engine(url)
        with Session(engine) as db:
            db.add(Memory(user_id=login['user']['id'], content='喜欢把复杂的技术问题解释清楚'))
            db.commit()
        engine.dispose()
        return {'token': login['token'], 'user_id': login['user']['id']}


if __name__ == '__main__':
    uvicorn.run(app, host='127.0.0.1', port=8030, access_log=False)
