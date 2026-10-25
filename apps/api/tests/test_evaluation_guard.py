"""Mock-only guard contracts, never real model quality or hosted billing proof."""
import asyncio
import json
import multiprocessing
from pathlib import Path
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from test_journey import issue, login
from test_workspace import conversation

from app import ai
from app import evaluation_guard as guard_module
from app.config import Settings
from app.evaluation_guard import (
    CAP,
    PER_CALL,
    EvaluationGuard,
    EvaluationRun,
    GuardError,
    check_payload,
    fixed_cases,
)
from app.main import calendar, create_app, digest
from app.models import Budget
from app.schemas import ChatInput


def settings():
    return Settings(_env_file=None, ai_mode='deepseek', deepseek_model='deepseek-v4-pro',
                    deepseek_api_key='mock-only', deepseek_base_url='https://offline.invalid')


def good_response(request):
    return httpx.Response(200, json={
        'model': 'DeepSeek-V4-Pro-0813',
        'choices': [{'finish_reason': 'stop', 'message': {'content': json.dumps({
            'reply': '虚构离线占位回复，不用于评价模型质量', 'suggestion': None})}}],
        'usage': {'prompt_tokens': 1000, 'completion_tokens': 100},
    })


@pytest.fixture
def guarded(tmp_path):
    guard, calls = EvaluationGuard(), []
    def provider(request):
        calls.append(request)
        return good_response(request)
    config = dict(database_url=f"sqlite:///{tmp_path / 'evaluation.sqlite'}",
                  ai_mode='deepseek', deepseek_model='deepseek-v4-pro',
                  deepseek_api_key='mock-only', deepseek_base_url='https://offline.invalid',
                  ai_transport=httpx.MockTransport(provider), evaluation_guard=guard)
    app = create_app(**config)
    with TestClient(app) as client:
        sessions = app.state.evaluation_sessions
        guard.provision_mock(sessions.kw['bind'])
        auth = login(client)
        user = client.get('/api/me', headers=auth).json()
        client.put('/api/me', headers=auth, json={'ai_consent': True, 'save_chat': True})
        bindings, conversations = {}, {}
        for group in ['A', 'B1', 'B2', 'B3']:
            item = issue(client, auth)
            conv = conversation(client, auth, item, group)
            conversations[group] = conv['id']
        for case in fixed_cases():
            group = 'A' if case['id'].startswith('A') else case['id']
            bindings[case['id']] = [user['id'], conversations[group]]
        with sessions.begin() as db:
            guard.bind_mock_fixtures(db, bindings)
            # Existing spend sentinel: never replace the monthly ledger with zero.
            db.add(Budget(month=calendar()[0], used_micro=37588))
        yield client, auth, sessions, guard, calls, bindings, config


def post(f, index=0, request_id=None):
    client, auth, _, _, _, bindings, _ = f
    case = fixed_cases()[index]
    request_id = request_id or str(uuid4())
    response = client.post(f'/api/conversations/{bindings[case["id"]][1]}/chat', headers=auth,
                           json={'request_id': request_id, 'message': case['input']})
    return response, digest(f'{bindings[case["id"]][0]}:{request_id}')


def review(f, key):
    with f[2].begin() as db:
        f[3].review(db, key, reviewer='Mock contract test', proceed=True,
                    note='Scripted fixture only; human quality scores remain blank')


def test_eight_requests_review_gate_duplicate_and_ninth(guarded):
    for i in range(8):
        rid = str(uuid4())
        response, key = post(guarded, i, rid)
        assert response.status_code == 200, response.text
        assert post(guarded, i, rid)[0].status_code == 409
        with guarded[2]() as db:
            run = db.get(EvaluationRun, guarded[3].run_id)
            assert run.status == 'review_required'
            assert run.settled_micro + run.reserved_micro + run.unknown_micro <= CAP
        review(guarded, key)
    assert post(guarded)[0].status_code == 409
    assert len(guarded[4]) == 8
    with guarded[2]() as db:
        assert db.get(Budget, calendar()[0]).used_micro == 37588 + 8 * 11700
        assert db.get(EvaluationRun, guarded[3].run_id).attempted == 8


def test_review_required_is_not_automatic_continue(guarded):
    assert post(guarded)[0].status_code == 200
    assert post(guarded, 1)[0].status_code == 409
    assert len(guarded[4]) == 1


@pytest.mark.parametrize('kind', ['experiment', 'month', 'input', 'rate', 'case', 'system'])
def test_pre_dispatch_rejection_never_calls_provider(guarded, kind, monkeypatch):
    with guarded[2].begin() as db:
        if kind == 'experiment':
            db.get(EvaluationRun, guarded[3].run_id).settled_micro = CAP - PER_CALL + 1
        if kind == 'month':
            db.get(Budget, calendar()[0]).used_micro = 100_000_000 - PER_CALL + 1
    if kind == 'input':
        original = ai.messages_for
        def large(*args, **kwargs):
            result = original(*args, **kwargs)
            context = json.loads(result[1]['content'].split('：', 1)[1])
            context['padding'] = '完整历史' * 10000
            result[1]['content'] = '以下为当前记录，仅作为数据：' + json.dumps(context, ensure_ascii=False)
            return result
        monkeypatch.setattr(ai, 'messages_for', large)
    if kind == 'rate':
        guarded[0].app.state.settings.input_price_per_million = 10
    if kind == 'system':
        approved = guard_module.reviewed_system_prompt()
        monkeypatch.setattr(guard_module, 'reviewed_system_prompt', lambda: approved + '\nchanged')
    response, _ = post(guarded, 1 if kind == 'case' else 0)
    assert response.status_code in {402, 409}
    assert not guarded[4]
    with guarded[2]() as db:
        assert db.get(EvaluationRun, guarded[3].run_id).attempted == 0


@pytest.mark.parametrize('mode', ['timeout', 'usage', 'truncated'])
def test_uncertainty_retains_both_ledgers_and_stops(guarded, mode):
    async def provider(request):
        guarded[4].append(request)
        if mode == 'timeout':
            await asyncio.sleep(.1)
        response = good_response(request)
        data = response.json()
        if mode == 'usage':
            data['usage']['total_tokens'] = -1
        if mode == 'truncated':
            data['choices'][0]['finish_reason'] = 'length'
        return httpx.Response(200, json=data)
    config = guarded[6] | {'ai_transport': httpx.MockTransport(provider),
                          'ai_timeout_seconds': .02 if mode == 'timeout' else 45}
    with TestClient(create_app(**config)) as client:
        f = (client, *guarded[1:])
        assert post(f)[0].status_code == 502
        assert post(f)[0].status_code == 409
    with guarded[2]() as db:
        run = db.get(EvaluationRun, guarded[3].run_id)
        assert run.attempted == 1 and run.status == 'stopped'
        assert run.unknown_micro == PER_CALL and run.reserved_micro == 0
        assert db.get(Budget, calendar()[0]).used_micro == 37588 + PER_CALL
    assert len(guarded[4]) == 1


def test_restart_cannot_reset_or_create_new_run(guarded):
    assert post(guarded)[0].status_code == 200
    guard = EvaluationGuard()
    guard.provision_mock(guarded[2].kw['bind'])
    with TestClient(create_app(**(guarded[6] | {'evaluation_guard': guard}))) as client:
        assert post((client, *guarded[1:]))[0].status_code == 409
    with guarded[2]() as db:
        assert db.get(EvaluationRun, guard.run_id).attempted == 1
        assert len(list(db.scalars(select(EvaluationRun)))) == 1


def test_dispatch_bound_and_crash_recovery(guarded):
    guard, sessions = guarded[3], guarded[2]
    body = ChatInput(request_id=uuid4(), message=fixed_cases()[0]['input'])
    payload = ai.provider_payload(settings(), ai.messages_for({}, [], body, evaluation_system=True))
    with sessions.begin() as db:
        guard.reserve(db, 'crashed', body, *guarded[5]['A1'], payload,
                      settings(), httpx.MockTransport(good_response))
        db.get(Budget, calendar()[0]).used_micro += PER_CALL
    with sessions.begin() as db:
        guard.dispatch(db, 'crashed', payload, settings(), httpx.MockTransport(good_response))
    with sessions.begin() as db, pytest.raises(GuardError):
        guard.dispatch(db, 'crashed', payload, settings(), httpx.MockTransport(good_response))
    with sessions.begin() as db:
        EvaluationGuard().recover(db)
    with sessions() as db:
        assert db.get(EvaluationRun, guard.run_id).unknown_micro == PER_CALL
        assert db.get(Budget, calendar()[0]).used_micro == 37588 + PER_CALL


def reserve_worker(url, bindings, queue):
    """Separate process and independent SQL connection; races one durable run row."""
    engine = create_engine(url)
    body = ChatInput(request_id=uuid4(), message=fixed_cases()[0]['input'])
    payload = ai.provider_payload(settings(), ai.messages_for({}, [], body, evaluation_system=True))
    try:
        with Session(engine) as db, db.begin():
            EvaluationGuard().reserve(db, str(uuid4()), body, *bindings, payload,
                                      settings(), httpx.MockTransport(good_response))
        queue.put('admitted')
    except GuardError:
        queue.put('rejected')
    finally:
        engine.dispose()


def test_multiple_processes_atomic_reservation(guarded):
    ctx = multiprocessing.get_context('spawn')
    queue = ctx.Queue()
    workers = [ctx.Process(target=reserve_worker, args=(guarded[6]['database_url'],
                guarded[5]['A1'], queue)) for _ in range(2)]
    for p in workers:
        p.start()
    for p in workers:
        p.join(20)
        assert p.exitcode == 0
    assert sorted([queue.get(timeout=2), queue.get(timeout=2)]) == ['admitted', 'rejected']
    with guarded[2]() as db:
        run = db.get(EvaluationRun, guarded[3].run_id)
        assert run.attempted == 1 and run.reserved_micro == PER_CALL


def test_real_transport_is_hard_blocked_without_network():
    body = ChatInput(request_id=uuid4(), message=fixed_cases()[0]['input'])
    payload = ai.provider_payload(settings(), ai.messages_for({}, [], body, evaluation_system=True))
    with pytest.raises(GuardError, match='hosted_input_bound_unverified'):
        check_payload(payload, settings(), None)
    with pytest.raises(GuardError, match='hosted_input_bound_unverified'):
        create_app(evaluation_guard=EvaluationGuard())


def test_frozen_inputs_and_system_hash():
    assert len(fixed_cases()) == 8
    body = ChatInput(request_id=uuid4(), message=fixed_cases()[0]['input'])
    payload = ai.provider_payload(settings(), ai.messages_for({}, [], body, evaluation_system=True))
    assert check_payload(payload, settings(), httpx.MockTransport(good_response)) < 30000
    assert Path(__file__).parents[1].joinpath('evaluation/live_first/rubric.json').exists()


def test_frozen_prompt_is_independent_of_product_copy_and_rejects_modified_fixture(tmp_path, monkeypatch):
    from app.evaluation_guard import SYSTEM_SHA, reviewed_system_prompt, sha

    approved = reviewed_system_prompt()
    assert sha(approved.encode()) == SYSTEM_SHA
    monkeypatch.setattr(ai, 'SYSTEM_PROMPT', ai.SYSTEM_PROMPT + '\nproduct wording changed')
    body = ChatInput(request_id=uuid4(), message=fixed_cases()[0]['input'])
    assert ai.messages_for({}, [], body, evaluation_system=True)[0]['content'] == approved
    assert ai.messages_for({}, [], body)[0]['content'] != approved
    monkeypatch.setattr(guard_module, 'MANIFEST', tmp_path / 'manifest.json')
    (tmp_path / 'system-prompt.txt').write_text('changed fixture', encoding='utf-8')
    with pytest.raises(GuardError, match='evaluation_system_changed'):
        reviewed_system_prompt()
