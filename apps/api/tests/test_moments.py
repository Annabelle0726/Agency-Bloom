"""Synthetic end-to-end requests only. Passing mocks is not creative-quality evidence."""
import asyncio
import json
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, update
from sqlalchemy.orm import Session

from app.main import create_app
from app.models import AIRequest, Budget, Memory, User
from app.moment_content import PROMPT, validate_content
from app.moments import BloomMoment, day_key, select_kind


class Provider:
    def __init__(self):
        self.calls = []
        self.mode = 'valid'

    async def __call__(self, request):
        payload = json.loads(request.content)
        self.calls.append(payload)
        data = json.loads(payload['messages'][-1]['content'])
        if self.mode == 'timeout':
            raise httpx.ReadTimeout('synthetic')
        if self.mode == 'slow':
            await asyncio.sleep(.3)
        themes = ['星空里的颜色', '窗前的风声', '物件的秘密名字', '一片叶子的旅途', '未来明信片', '城市的声音', '想象的地图', '湖边的倒影', '一扇不同的门']
        topic = themes[(len(self.calls)-1) % len(themes)]
        content = {'kind': data['kind'], 'title': topic, 'invitation': topic,
                   'question': topic + '会是什么样？', 'sources': []}
        if data['kind'] in ('perspective', 'echo'):
            source = data['sources'][0]
            content['sources'] = [{'id': source['id'], 'quote': source['quote']}]
        if self.mode == 'foreign':
            content['sources'] = [{'id': str(uuid4()), 'quote': '没有提供过的私人信息'}]
        if self.mode == 'private':
            content['invitation'] = '<think>RAW_SECRET</think>'
        result = {'choices': [{'finish_reason': 'length' if self.mode == 'truncated' else 'stop',
                  'message': {'content': '{broken' if self.mode == 'invalid' else json.dumps(content),
                              'reasoning_content': 'RAW_SECRET'}}],
                  'model': 'deepseek-v4-pro', 'usage': {'prompt_tokens': 300, 'completion_tokens': 100}}
        if self.mode == 'usage':
            result['usage']['completion_tokens'] = 999999
        return httpx.Response(200, json=result)


@contextmanager
def fixture(tmp_path, **settings):
    provider = Provider()
    url = f"sqlite:///{tmp_path / 'moment.db'}"
    app = create_app(_env_file=None, database_url=url, ai_mode='deepseek',
                     deepseek_api_key='synthetic-not-a-key', deepseek_base_url='https://offline.invalid',
                     deepseek_model='deepseek-v4-pro', ai_transport=httpx.MockTransport(provider), **settings)
    with TestClient(app) as client:
        login = client.post('/api/auth/dev', json={'privacy_accepted': True}).json()
        client.headers['Authorization'] = 'Bearer ' + login['token']
        client.put('/api/me', json={'ai_consent': True})
        yield client, provider, create_engine(url), app, login


def open_one(client, previous=None, **extra):
    return client.post('/api/moments/open', json={'request_id': str(uuid4()),
        'action': 'another' if previous else 'open', 'previous_id': previous, **extra})


def test_daily_idempotency_restart_and_no_conversation_side_effects(tmp_path):
    with fixture(tmp_path) as (c, provider, engine, app, login):
        assert c.get('/api/moments/today').json()['moment'] is None
        assert not provider.calls
        body = {'request_id': str(uuid4())}
        first = c.post('/api/moments/open', json=body).json()
        assert first['moment']['content']['kind'] == 'light'
        assert c.post('/api/moments/open', json=body).json() == first
        assert open_one(c).json() == first
        with TestClient(app) as restarted:
            restarted.headers['Authorization'] = 'Bearer ' + login['token']
            assert open_one(restarted).json() == first
        assert len(provider.calls) == 1
        assert c.get('/api/issues').json() == [] and c.get('/api/conversations').json() == []
        assert c.get('/api/memories').json() == []
        assert 'RAW_SECRET' not in json.dumps(first)
        with Session(engine) as db:
            assert 'RAW_SECRET' not in str(db.scalar(select(AIRequest)).usage)
            assert db.scalar(select(Budget)).used_micro == 5400
            assert db.scalar(select(AIRequest)).kind == 'moment'


def test_another_and_refusal_require_explicit_actions(tmp_path):
    with fixture(tmp_path) as (c, p, engine, *_):
        first = open_one(c).json()['moment']
        assert c.post('/api/moments/' + first['id'] + '/dismiss').status_code == 204
        assert len(p.calls) == 1
        assert c.get('/api/moments/today').json()['moment']['content'] is None
        second = open_one(c, first['id']).json()['moment']
        assert second['content']['kind'] == 'experiment'
        assert open_one(c, first['id']).status_code == 409
        assert len(p.calls) == 2
        with Session(engine) as db:
            assert db.get(BloomMoment, first['id']).content is None


@pytest.mark.parametrize('mode', ['timeout', 'usage', 'invalid', 'truncated', 'private', 'foreign'])
def test_failure_no_retry_no_private_text_and_conservative_cost(tmp_path, mode):
    with fixture(tmp_path) as (c, p, engine, *_):
        p.mode = mode
        response = open_one(c)
        assert response.status_code == 200
        value = response.json()['moment']
        assert value['content'] is None
        assert value['status'] in ('unknown', 'failed')
        assert len(p.calls) == 1
        assert c.get('/api/moments/today').json()['moment']['id'] == value['id']
        with Session(engine) as db:
            record = db.scalar(select(AIRequest))
            assert record.cost_micro > 0
            assert db.scalar(select(Budget)).used_micro == record.cost_micro
            if mode in ('timeout', 'usage'):
                assert record.usage is None and record.cost_micro > 5400


def test_simultaneous_daily_open_reserves_only_once(tmp_path):
    with fixture(tmp_path) as (c, p, engine, *_):
        p.mode = 'slow'
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(lambda _: open_one(c), range(2)))
        assert all(r.status_code == 200 for r in responses)
        assert len(p.calls) == 1
        with Session(engine) as db:
            assert len(db.scalars(select(AIRequest)).all()) == 1


def test_monthly_and_daily_limits_are_shared(tmp_path):
    with fixture(tmp_path, daily_chat_limit=1) as (c, p, engine, *_):
        first = open_one(c).json()['moment']
        assert open_one(c, first['id']).status_code == 429
        assert len(p.calls) == 1
        with Session(engine) as db:
            db.execute(update(Budget).values(used_micro=100_000_000))
            db.commit()
        assert open_one(c, first['id']).status_code == 402
        assert c.get('/api/usage').json()['used_cny'] == 100


def test_retention_revocation_and_account_isolation(tmp_path):
    with fixture(tmp_path) as (c, p, engine, app, _):
        first = open_one(c).json()['moment']
        with TestClient(app) as stranger:
            other = stranger.post('/api/auth/dev', json={'privacy_accepted': True}).json()
            stranger.headers['Authorization'] = 'Bearer ' + other['token']
            assert stranger.get('/api/moments/today').json()['moment'] is None
            assert stranger.post('/api/moments/' + first['id'] + '/dismiss').status_code == 404
        c.put('/api/me', json={'save_chat': False})
        assert c.get('/api/moments/today').json()['moment']['content'] is None
        second = open_one(c, first['id']).json()['moment']
        assert second['content']
        assert c.get('/api/moments/today').json()['moment']['content'] is None
        c.put('/api/me', json={'ai_consent': False})
        assert open_one(c).status_code == 403
        with Session(engine) as db:
            assert all(r.content is None for r in db.scalars(select(BloomMoment)))
        c.delete('/api/me')
        with Session(engine) as db:
            assert not db.scalars(select(BloomMoment)).all()
            assert db.scalars(select(AIRequest)).all()  # usage survives deletion


def test_authorized_quote_only_and_deleted_memory_not_reused(tmp_path):
    with fixture(tmp_path) as (c, p, engine, _, login):
        user_id = login['user']['id']
        with Session(engine) as db:
            db.execute(update(User).where(User.id == user_id).values(use_memory=True))
            memory = Memory(user_id=user_id, content='喜欢把复杂问题解释清楚')
            db.add(memory)
            db.commit()
            memory_id = memory.id
        first = open_one(c, personalize=True).json()['moment']
        assert json.loads(p.calls[-1]['messages'][-1]['content'])['sources'] == []
        second = open_one(c, first['id'], personalize=True).json()['moment']
        third = open_one(c, second['id'], personalize=True).json()['moment']
        assert third['content']['kind'] == 'perspective'
        assert third['content']['sources'][0]['id'] == memory_id
        with Session(engine) as db:
            db.delete(db.get(Memory, memory_id))
            db.commit()
        assert c.get('/api/moments/today').json()['moment']['content'] is None
        fourth = open_one(c, third['id']).json()['moment']
        assert fourth['content']['kind'] in ('light', 'experiment')
        assert memory_id not in json.dumps(p.calls[-1])


def test_crash_unknown_keeps_reservation_and_day_rolls_without_generation(tmp_path, monkeypatch):
    with fixture(tmp_path) as (c, p, engine, *_):
        first = open_one(c).json()['moment']
        with Session(engine) as db:
            record = db.scalar(select(AIRequest))
            record.status = 'pending'
            record.created_at = '2020-01-01T00:00:00+00:00'
            db.commit()
        assert c.get('/api/moments/today').json()['moment']['status'] == 'unknown'
        before = c.get('/api/usage').json()['used_cny']
        open_one(c, first['id'])
        assert c.get('/api/usage').json()['used_cny'] > before
        monkeypatch.setattr('app.moments.day_key', lambda: '2099-01-01')
        assert c.get('/api/moments/today').json()['moment'] is None
        assert len(p.calls) == 2


def test_pure_contracts():
    value = {'kind': 'light', 'title': '小邀请', 'invitation': '想象另一种颜色', 'question': '它是什么颜色？', 'sources': []}
    checked = validate_content(json.dumps(value), 'light', [], [])
    from app.moment_content import fingerprint
    with pytest.raises(ValueError):
        validate_content(json.dumps(value), 'light', [], [{'fingerprint': fingerprint(checked), 'content': checked}])
    with pytest.raises(ValueError):
        validate_content(json.dumps({**value, 'invitation': '你曾经很害怕失败'}), 'light', [], [])
    assert select_kind([], [{'kind': 'light', 'dismissed': True}]) == 'experiment'
    assert '不必导向职业' in PROMPT
    assert len(day_key()) == 10


def test_input_admission_rejects_without_clipping_or_dispatch(tmp_path, monkeypatch):
    with fixture(tmp_path) as (c, p, engine, *_):
        monkeypatch.setattr('app.moments.messages_for', lambda *args: [
            {'role': 'system', 'content': '长' * 9000}])
        assert open_one(c).status_code == 413
        assert not p.calls
        with Session(engine) as db:
            assert not db.scalars(select(AIRequest)).all()


def test_revocation_while_generating_never_saves_or_refunds_unknown(tmp_path):
    import time
    with fixture(tmp_path) as (c, p, engine, *_):
        p.mode = 'slow'
        with ThreadPoolExecutor(max_workers=1) as pool:
            pending = pool.submit(open_one, c)
            deadline = time.monotonic() + 2
            while not p.calls and time.monotonic() < deadline:
                time.sleep(.01)
            assert p.calls
            assert c.put('/api/me', json={'ai_consent': False}).status_code == 200
            assert pending.result().status_code == 409
        with Session(engine) as db:
            assert db.scalar(select(BloomMoment)).content is None
            receipt = db.scalar(select(AIRequest))
            assert receipt.status == 'cancelled' and receipt.cost_micro > 0


def test_model_parameters_are_separate_from_chat_prompt(tmp_path):
    with fixture(tmp_path) as (c, p, *_):
        open_one(c)
        payload = p.calls[0]
        assert payload['model'] == 'deepseek-v4-pro'
        assert payload['thinking'] == {'type': 'enabled'}
        assert payload['max_tokens'] == 4096 and payload['stream'] is False
        assert payload['reasoning_effort'] == 'low'
        assert payload['messages'][0]['content'] == PROMPT
