import base64
import json
from pathlib import Path

import httpx
from fastapi.testclient import TestClient

from app.main import create_app


def test_fixed_welcome_works_before_any_conversation_and_requires_consent(tmp_path):
    with TestClient(create_app(_env_file=None, database_url=f"sqlite:///{tmp_path / 'welcome.db'}", ai_mode='demo')) as c:
        login=c.post('/api/auth/dev',json={'privacy_accepted':True}).json()
        auth={'Authorization':'Bearer '+login['token']}
        body={'variant':'first-context-v1'}
        assert c.post('/api/speech/welcome',headers=auth,json=body).status_code==403
        c.put('/api/speech/consent',headers=auth,json={'accepted':True})
        result=c.post('/api/speech/welcome',headers=auth,json=body)
        assert result.status_code==200,result.text
        assert c.get('/api/conversations',headers=auth).json()==[]
        assert c.get('/api/issues',headers=auth).json()==[]
        assert c.post('/api/speech/welcome',headers=auth,json=body).json()['audio_id']==result.json()['audio_id']
        audio='/api'+result.json()['parts'][0]
        assert c.get(audio,headers=auth).status_code==200
        assert c.post('/api/speech/welcome',headers=auth,json=body|{'text':'任意客户端文字'}).status_code==422
        assert c.post('/api/speech/welcome',headers=auth,json={'variant':'unknown'}).status_code==422
        other=c.post('/api/auth/dev',json={'privacy_accepted':True}).json()
        assert c.get(audio,headers={'Authorization':'Bearer '+other['token']}).status_code==404
        c.put('/api/speech/consent',headers=auth,json={'accepted':False})
        assert c.get(audio,headers=auth).status_code in (403,404)


def test_welcome_paid_guard_and_fixed_visible_text(tmp_path):
    calls=[]
    def provider(request):
        calls.append(json.loads(request.content))
        return httpx.Response(200,json={'Response':{'Audio':base64.b64encode(Path('app/fixtures/speech-mock.mp3').read_bytes()).decode()}})
    options=dict(_env_file=None,database_url=f"sqlite:///{tmp_path / 'tts.db'}",ai_mode='demo',tts_mode='tencent',tts_paid_enabled=True,
                 tts_secret_id='test-only',tts_secret_key='test-only',tts_transport=httpx.MockTransport(provider))
    with TestClient(create_app(**options)) as c:
        login=c.post('/api/auth/dev',json={'privacy_accepted':True}).json()
        auth={'Authorization':'Bearer '+login['token']}
        c.put('/api/speech/consent',headers=auth,json={'accepted':True})
        result=c.post('/api/speech/welcome',headers=auth,json={'variant':'first-open-v1'})
        assert result.status_code==200,result.text
        assert ''.join(row['Text'] for row in calls)=='嗨，我是 Bloom，很高兴认识你，还没想清楚也没关系，想到哪里就先说到哪里，也许聊着聊着，就会发现一件你愿意试试的小事。'


def test_read_aloud_speaks_visible_markdown_text_instead_of_format_markers(tmp_path):
    from sqlalchemy import create_engine, update
    from test_speech import reply, setup, tencent_options

    from app.models import Message
    calls=[]
    def provider(request):
        calls.append(json.loads(request.content)['Text'])
        return httpx.Response(200,json={'Response':{'Audio':base64.b64encode(Path('app/fixtures/speech-mock.mp3').read_bytes()).decode()}})
    url=f"sqlite:///{tmp_path / 'formatted.db'}"
    with TestClient(create_app(_env_file=None,database_url=url,ai_mode='demo',**tencent_options(provider))) as c:
        auth,conversation=setup(c)
        response=reply(c,auth,conversation)
        engine=create_engine(url)
        with engine.begin() as db:
            db.execute(update(Message).where(Message.id==response['assistant_message_id']).values(content='## 先了解\n\n保留 **稳定收入**，==慢慢来==，也可以 [看看这里](https://example.com)。'))
        engine.dispose()
        c.put('/api/speech/consent',headers=auth,json={'accepted':True})
        result=c.post(f'/api/conversations/{conversation}/speech',headers=auth,json={'message_id':response['assistant_message_id']})
        assert result.status_code==200,result.text
        assert ''.join(calls)=='先了解\n\n保留 稳定收入，慢慢来，也可以 看看这里。'


def test_welcome_respects_paid_off_character_limit_and_shared_request_quota(tmp_path):
    for name, options, expected in [
        ('off', {'tts_mode':'tencent','tts_paid_enabled':False},409),
        ('short', {'tts_max_chars':1},409),
        ('quota', {'tts_daily_requests':1},200),
    ]:
        with TestClient(create_app(_env_file=None,database_url=f"sqlite:///{tmp_path / (name+'.db')}",ai_mode='demo',**options)) as c:
            login=c.post('/api/auth/dev',json={'privacy_accepted':True}).json()
            auth={'Authorization':'Bearer '+login['token']}
            c.put('/api/speech/consent',headers=auth,json={'accepted':True})
            body={'variant':'first-open-v1'}
            response=c.post('/api/speech/welcome',headers=auth,json=body)
            assert response.status_code==expected,response.text
            if name=='quota':
                assert c.post('/api/speech/welcome',headers=auth,json=body).status_code==200
                assert c.post('/api/speech/welcome',headers=auth,json={'variant':'first-context-v1'}).status_code==429
