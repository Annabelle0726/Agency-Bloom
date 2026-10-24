"""Adaptive routing must precede reservation and dispatch, without a classifier call."""

import json
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from test_ai_boundary import ready

from app import ai
from app.config import Settings
from app.main import create_app
from app.schemas import ChatInput


@pytest.mark.parametrize("message,model,thinking", [
    ("你好", "deepseek-flash", False),
    ("今天有点累，只想聊聊", "deepseek-flash", False),
    ("职业取舍让我很累，只想倾诉，先听我说", "deepseek-flash", False),
    ("解释一下什么是职业原型", "deepseek-flash", False),
    ("帮我比较两份 offer，收入、成长和通勤怎么取舍", "deepseek-v4-pro", True),
    ("该辞职吗？", "deepseek-v4-pro", True),
    ("我今晚可能会伤害自己", "deepseek-v4-pro", True),
    ("不用深入分析，简单说说两份 offer 的区别", "deepseek-flash", False),
])
def test_turn_uses_one_call_and_the_selected_rate_card(tmp_path, message, model, thinking):
    database = f"sqlite:///{tmp_path / 'routing.db'}"
    engine = create_engine(database)
    calls, reservations = [], []

    def provider(request):
        body = json.loads(request.content)
        calls.append(body)
        # Independent peak/cache-miss ceiling, checked while the request is pending.
        input_bound = len(json.dumps(body['messages'], ensure_ascii=False).encode()) + 2048
        with engine.connect() as db:
            reservations.append((db.scalar(text('select used_micro from budgets')), input_bound))
        return httpx.Response(200, json={
            "model": body['model'],
            "choices": [{"finish_reason": "stop", "message": {
                "content": '{"reply":"合成测试回复","suggestion":null}'}}],
            "usage": {"prompt_tokens": 100, "completion_tokens": 100},
        })

    app = create_app(database_url=database, ai_mode='deepseek', deepseek_api_key='mock-only',
                     deepseek_model='deepseek-v4-pro', ai_transport=httpx.MockTransport(provider))
    with TestClient(app) as client:
        auth, path = ready(client)
        response = client.post(path, headers=auth, json={"request_id": str(uuid4()), "message": message})
        assert response.status_code == 200, response.text
        assert len(calls) == 1
        assert calls[0]['model'] == model
        assert calls[0]['thinking'] == {'type': 'enabled' if thinking else 'disabled'}
        assert calls[0].get('reasoning_effort') == ('high' if thinking else None)
        assert 'tools' not in calls[0]
        rate, output_rate = (9, 27) if thinking else (2, 8)
        reserved, input_bound = reservations[0]
        assert reserved == input_bound * rate + 4096 * output_rate
        with engine.connect() as db:
            assert db.scalar(text('select used_micro from budgets')) == (3600 if thinking else 1000)
    engine.dispose()


def test_short_followup_keeps_complexity_but_explicit_topic_change_does_not(tmp_path):
    calls = []

    def provider(request):
        body = json.loads(request.content)
        calls.append(body)
        return httpx.Response(200, json={
            'model': body['model'],
            'choices': [{'message': {'content': '{"reply":"合成回复","suggestion":null}'}}],
            'usage': {'prompt_tokens': 100, 'completion_tokens': 100},
        })

    app = create_app(database_url=f"sqlite:///{tmp_path / 'follow.db'}", ai_mode='deepseek',
                     deepseek_api_key='mock-only', ai_transport=httpx.MockTransport(provider))
    with TestClient(app) as client:
        auth, path = ready(client)
        for message in ('帮我比较两条职业方向的风险', '继续', '谢谢', '换个话题，今晚吃什么'):
            result = client.post(path, headers=auth, json={'request_id': str(uuid4()), 'message': message})
            assert result.status_code == 200
        assert [(b['model'], b['thinking']['type']) for b in calls] == [
            ('deepseek-v4-pro', 'enabled'), ('deepseek-v4-pro', 'enabled'),
            ('deepseek-flash', 'disabled'), ('deepseek-flash', 'disabled'),
        ]


@pytest.mark.parametrize('routing,thinking,task,model,want_thinking', [
    ('fixed', True, 'chat', 'deepseek-flash', True),
    ('fixed', False, 'chat', 'deepseek-v4-pro', False),
    ('adaptive', False, 'chat', 'deepseek-flash', False),
    ('adaptive', True, 'summary', 'deepseek-flash', True),
])
def test_fixed_override_thinking_kill_switch_and_summary_are_respected(routing, thinking, task, model, want_thinking):
    settings = Settings(_env_file=None, ai_mode='deepseek', deepseek_api_key='mock-only',
                        ai_routing=routing, ai_thinking=thinking,
                        deepseek_model='deepseek-v4-pro' if routing == 'fixed' and not thinking else 'deepseek-flash')
    prompt = ai.messages_for({}, [], ChatInput(request_id=uuid4(), message='帮我比较两份 offer', task=task))
    selected = ai.settings_for_turn(settings, prompt)
    payload = ai.provider_payload(selected, prompt)
    assert payload['model'] == model
    assert payload['thinking']['type'] == ('enabled' if want_thinking else 'disabled')
    assert settings.deepseek_model == ('deepseek-v4-pro' if routing == 'fixed' and not thinking else 'deepseek-flash')


def test_exhausted_budget_blocks_pro_before_dispatch(tmp_path):
    calls = []
    app = create_app(database_url=f"sqlite:///{tmp_path / 'empty.db'}", ai_mode='deepseek',
                     deepseek_api_key='mock-only', ai_monthly_budget_cny=0,
                     ai_transport=httpx.MockTransport(lambda request: calls.append(request)))
    with TestClient(app) as client:
        auth, path = ready(client)
        assert client.post(path, headers=auth, json={'request_id': str(uuid4()),
                           'message': '该辞职吗？'}).status_code == 402
        assert calls == []
