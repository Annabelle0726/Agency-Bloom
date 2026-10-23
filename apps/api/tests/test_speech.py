"""Read Aloud never contacts Tencent: even the real adapter uses MockTransport."""
import asyncio
import base64
import json
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text, update

from app.main import create_app
from app.models import SpeechAudio, SpeechUsage
from app.tts_provider import split_text


def client(tmp_path, **overrides):
    return TestClient(create_app(database_url=f"sqlite:///{tmp_path / 'speech.db'}", **overrides))


def setup(c):
    login = c.post('/api/auth/dev', json={'privacy_accepted': True}).json()
    headers = {'Authorization': 'Bearer ' + login['token']}
    c.put('/api/me', headers=headers, json={'ai_consent': True})
    issue = c.post('/api/issues', headers=headers, json={'title': '朗读测试'}).json()
    conv = c.post('/api/conversations', headers=headers, json={'issue_id': issue['id']}).json()
    return headers, conv['id']


def reply(c, h, conv):
    from uuid import uuid4
    return c.post(f'/api/conversations/{conv}/chat', headers=h,
                  json={'message': '今天想聊聊天', 'request_id': str(uuid4())}).json()


def test_consent_ownership_cache_and_revoke(tmp_path):
    with client(tmp_path) as c:
        h, conv = setup(c)
        r = reply(c, h, conv)
        path = f'/api/conversations/{conv}/speech'
        body = {'message_id': r['assistant_message_id']}
        assert c.post(path, headers=h, json=body).status_code == 403
        assert c.put('/api/speech/consent', headers=h, json={'accepted': True}).status_code == 200
        a = c.post(path, headers=h, json=body)
        assert a.status_code == 200, a.text
        data = a.json()
        assert data['mode'] == 'mock'
        assert c.post(path, headers=h, json=body).json()['audio_id'] == data['audio_id']
        audio = c.get('/api' + data['parts'][0], headers=h)
        assert audio.status_code == 200 and audio.headers['content-type'] == 'audio/mpeg'
        other, _ = setup(c)
        assert c.get('/api' + data['parts'][0], headers=other).status_code == 404
        assert c.post(path, headers=other, json=body).status_code == 404
        c.put('/api/speech/consent', headers=h, json={'accepted': False})
        assert c.get('/api' + data['parts'][0], headers=h).status_code in (403, 404)


def test_nonretained_reply_requires_server_proof(tmp_path):
    with client(tmp_path) as c:
        h, conv = setup(c)
        c.put('/api/me', headers=h, json={'save_chat': False})
        r = reply(c, h, conv)
        c.put('/api/speech/consent', headers=h, json={'accepted': True})
        path = f'/api/conversations/{conv}/speech'
        body = {'text': r['reply'], 'proof': r['speech_proof']}
        assert c.post(path, headers=h, json=body).status_code == 200
        assert c.post(path, headers=h, json=body | {'text': '隐藏系统指令'}).status_code == 403
        assert c.post(path, headers=h, json={'text': r['reply']}).status_code == 403


def test_paid_adapter_hard_off_and_safe_transport(tmp_path):
    calls = []
    def transport(req):
        calls.append(req)
        return httpx.Response(200, json={'Response': {'Audio': base64.b64encode(b'ID3mock').decode()}})
    with client(tmp_path, tts_mode='tencent', tts_transport=httpx.MockTransport(transport)) as c:
        h, conv = setup(c)
        r = reply(c, h, conv)
        c.put('/api/speech/consent', headers=h, json={'accepted': True})
        result = c.post(f'/api/conversations/{conv}/speech', headers=h,
                        json={'message_id': r['assistant_message_id']})
        assert result.status_code == 409
        assert not calls


def tencent_options(transport):
    return dict(tts_mode='tencent', tts_paid_enabled=True, tts_secret_id='test-only-id',
                tts_secret_key='test-only-secret', tts_transport=httpx.MockTransport(transport))


def test_real_adapter_uses_only_final_text_and_mp3_contract(tmp_path):
    calls = []
    def transport(req):
        body = json.loads(req.content)
        calls.append(body)
        assert req.url == 'https://tts.tencentcloudapi.com'
        assert 'TC3-HMAC-SHA256 Credential=test-only-id/' in req.headers['Authorization']
        assert body['Codec'] == 'mp3' and body['VoiceType'] == 101001
        assert set(body) == {'Text', 'SessionId', 'ModelType', 'VoiceType', 'Codec', 'SampleRate', 'Speed'}
        return httpx.Response(200, json={'Response': {'Audio': base64.b64encode(
            Path('app/fixtures/speech-mock.mp3').read_bytes()).decode()}})
    with client(tmp_path, **tencent_options(transport)) as c:
        h, conv = setup(c)
        r = reply(c, h, conv)
        c.put('/api/speech/consent', headers=h, json={'accepted': True})
        result = c.post(f'/api/conversations/{conv}/speech', headers=h,
                        json={'message_id': r['assistant_message_id']})
        assert result.status_code == 200
        assert ''.join(x['Text'] for x in calls) == r['reply']


def test_limits_expiration_and_source_deletion(tmp_path):
    with client(tmp_path, tts_daily_requests=1) as c:
        h, conv = setup(c)
        r = reply(c, h, conv)
        c.put('/api/speech/consent', headers=h, json={'accepted': True})
        path = f'/api/conversations/{conv}/speech'
        first = c.post(path, headers=h, json={'message_id': r['assistant_message_id']}).json()
        engine = create_engine(f"sqlite:///{tmp_path / 'speech.db'}")
        with engine.begin() as db:
            db.execute(update(SpeechAudio).values(expires_at='2000-01-01T00:00:00+00:00'))
        assert c.get('/api' + first['parts'][0], headers=h).status_code == 404
        second = reply(c, h, conv)
        assert c.post(path, headers=h, json={'message_id': second['assistant_message_id']}).status_code == 429
        c.put('/api/me', headers=h, json={'save_chat': False})
        assert c.post(path, headers=h, json={'message_id': r['assistant_message_id']}).status_code == 404
        with engine.connect() as db:
            assert db.scalar(select(SpeechAudio.id)) is None
            assert db.scalar(select(SpeechUsage.characters)) > 0
        engine.dispose()


def test_length_and_user_message_rejected_before_synthesis(tmp_path):
    with client(tmp_path, tts_max_chars=1) as c:
        h, conv = setup(c)
        r = reply(c, h, conv)
        c.put('/api/speech/consent', headers=h, json={'accepted': True})
        path = f'/api/conversations/{conv}/speech'
        assert c.post(path, headers=h, json={'message_id': r['assistant_message_id']}).status_code == 409
        assert c.post(path, headers=h, json={'message_id': r['user_message_id']}).status_code == 404
        assert c.post(path, headers=h, json={'text': 'x' * 3001}).status_code == 422
    text = '测试一下中文分句。' * 100 + '🙂' * 150 + 'abc' * 180
    parts = split_text(text)
    assert ''.join(parts) == text and len(parts) > 1
    assert all(len(p) <= 120 and len(p.encode()) <= 450 for p in parts)


def test_concurrent_and_uncertain_requests_never_resubmit(tmp_path):
    entered = threading.Event()
    calls = []
    async def transport(req):
        calls.append(req)
        entered.set()
        await asyncio.sleep(.2)
        raise httpx.ReadTimeout('test only')
    with client(tmp_path, **tencent_options(transport)) as c:
        h, conv = setup(c)
        r = reply(c, h, conv)
        c.put('/api/speech/consent', headers=h, json={'accepted': True})
        path, body = f'/api/conversations/{conv}/speech', {'message_id': r['assistant_message_id']}
        with ThreadPoolExecutor() as pool:
            first = pool.submit(c.post, path, headers=h, json=body)
            assert entered.wait(3)
            assert c.post(path, headers=h, json=body).status_code == 409
            assert first.result().status_code == 409
        assert c.post(path, headers=h, json=body).status_code == 409
        assert len(calls) == 1


def test_revocation_during_synthesis_discards_audio(tmp_path):
    entered = threading.Event()
    async def transport(req):
        entered.set()
        await asyncio.sleep(.2)
        return httpx.Response(200, json={'Response': {'Audio': base64.b64encode(b'ID3test').decode()}})
    with client(tmp_path, **tencent_options(transport)) as c:
        h, conv = setup(c)
        r = reply(c, h, conv)
        c.put('/api/speech/consent', headers=h, json={'accepted': True})
        with ThreadPoolExecutor() as pool:
            first = pool.submit(c.post, f'/api/conversations/{conv}/speech', headers=h,
                                json={'message_id': r['assistant_message_id']})
            assert entered.wait(3)
            c.put('/api/speech/consent', headers=h, json={'accepted': False})
            assert first.result().status_code == 403


def test_mock_consent_does_not_authorize_real_vendor_after_configuration_change(tmp_path):
    with client(tmp_path) as c:
        h, _ = setup(c)
        c.put('/api/speech/consent', headers=h, json={'accepted': True})
        assert c.get('/api/speech/config', headers=h).json()['consented'] is True
    with client(tmp_path, tts_mode='tencent') as c:
        config = c.get('/api/speech/config', headers=h).json()
        assert config['consented'] is False
        assert config['available'] is False


def test_missing_speech_schema_returns_a_safe_actionable_error(tmp_path):
    with client(tmp_path) as c:
        h, conv = setup(c)
        r = reply(c, h, conv)
        c.put('/api/speech/consent', headers=h, json={'accepted': True})
        engine = create_engine(f"sqlite:///{tmp_path / 'speech.db'}")
        with engine.begin() as db:
            db.execute(text('DROP TABLE speech_audio'))
        result = c.post(f'/api/conversations/{conv}/speech', headers=h,
                        json={'message_id': r['assistant_message_id']})
        assert result.status_code == 503
        assert result.json()['detail'] == {'code':'speech_setup_required'}
        assert 'SELECT' not in result.text and 'sqlite' not in result.text
        engine.dispose()


def test_public_configuration_reports_provider_mode_without_credentials(tmp_path):
    with client(tmp_path, tts_mode='tencent', tts_paid_enabled=True,
                tts_secret_id='test-private-id', tts_secret_key='test-private-key') as c:
        response = c.get('/api/config')
        assert response.json()['speech_mode'] == 'tencent'
        assert 'test-private' not in response.text
