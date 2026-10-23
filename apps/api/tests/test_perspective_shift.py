"""Fictional offline conversations: provenance/UI contracts, not model skill scores."""
import json
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from test_journey import issue, login
from test_workspace import conversation

from app.evaluation_guard import EvaluationGuard, GuardError
from app.main import create_app
from app.models import Issue, Memory, Message
from app.perspective_shift import PerspectivePrototype
from app.schemas import AIOutput


def candidate_for(sent, *, assistant=False):
    context = json.loads(sent['messages'][1]['content'].split('：', 1)[1])
    rows = context.get('perspective_messages') or []
    if not rows:
        return None
    previous = next(s for s in rows[:-1] if s['role'] == ('assistant' if assistant else 'user'))
    current = rows[-1]
    return {
        'title': '换个角度',
        'observation': '我们讨论了两个职业，但还没有核实可承担的现实代价',
        'possible_blind_spot': '也许需要先核实收入保障这个决策条件',
        'alternative_perspective': '可以先保留现职，通过一次内部需求访谈了解产品工作',
        'supporting_message_ids': [previous['id'], current['id']],
        'evidence': [
            {'message_id': previous['id'], 'quote': previous['content'][:100],
             'supports': ['observation']},
            {'message_id': current['id'], 'quote': current['content'][:100],
             'supports': ['possible_blind_spot', 'alternative_perspective']},
        ],
        'uncertainty': '实际可用时间与团队是否支持仍需由你核实',
        'optional_next_question': None,
        'trigger': 'assistant_revision' if assistant else (
            'new_constraint' if '不能' in current['content'] else 'repeated_choice'),
    }


@pytest.fixture
def prototype(tmp_path):
    calls, behavior = [], {'change': lambda x: x, 'assistant': False}
    def provider(request):
        sent = json.loads(request.content)
        calls.append(sent)
        candidate = candidate_for(sent, assistant=behavior['assistant'])
        candidate = behavior['change'](candidate)
        return httpx.Response(200, json={
            'choices': [{'finish_reason': 'stop', 'message': {
                'reasoning_content': 'PRIVATE_RAW_TRACE_SENTINEL',
                'content': json.dumps({'reply': '这是一段虚构测试回复，未宣称已保存任何变化',
                                       'perspective_shift': candidate})}}],
            'usage': {'prompt_tokens': 1000, 'completion_tokens': 100},
        })
    url = f"sqlite:///{tmp_path / 'perspective.sqlite'}"
    proto = PerspectivePrototype()
    config = dict(database_url=url, ai_mode='deepseek', deepseek_model='deepseek-v4-pro',
                  deepseek_api_key='mock-only', deepseek_base_url='https://offline.invalid',
                  ai_transport=httpx.MockTransport(provider), perspective_prototype=proto)
    with TestClient(create_app(**config)) as client:
        auth = login(client)
        client.put('/api/me', headers=auth, json={'ai_consent': True, 'save_chat': True})
        item = issue(client, auth)
        conv = conversation(client, auth, item)
        engine = create_engine(url)
        yield client, auth, item, conv, engine, calls, behavior, proto, config
        engine.dispose()


def seed(f, count=6):
    with Session(f[4]) as db, db.begin():
        for i in range(count):
            db.add(Message(id=f'u{i}', issue_id=f[2]['id'], conversation_id=f[3]['id'],
                           role='user', content='软件工程师和 AI 产品经理这两个职业应该选哪个',
                           created_at=f'2026-10-20T00:00:{i*2:02d}+00:00'))
            db.add(Message(id=f'a{i}', issue_id=f[2]['id'], conversation_id=f[3]['id'],
                           role='assistant', content='之前只比较了兴趣，没有核实收入与岗位要求',
                           created_at=f'2026-10-20T00:00:{i*2+1:02d}+00:00'))


def send(f, message='软件工程师和 AI 产品经理这两个职业应该怎么比较', **extra):
    return f[0].post(f'/api/conversations/{f[3]["id"]}/chat', headers=f[1],
                     json={'request_id': str(uuid4()), 'message': message, **extra})


def test_six_turn_repeat_with_one_call_and_no_memory_or_card_write(prototype):
    f = prototype
    seed(f)
    response = send(f)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data['perspective_shift'] and len(f[5]) == 1
    assert 'PRIVATE_RAW_TRACE_SENTINEL' not in response.text
    assert data['user_message_id'] in data['perspective_shift']['supporting_message_ids']
    with Session(f[4]) as db:
        assert db.get(Issue, f[2]['id']).card == f[2]['card']
        assert list(db.scalars(select(Memory))) == []
        # Prototype is session-only: no new persisted personalization or artifact.
        payload = db.get(Message, data['assistant_message_id']).payload
        assert 'perspective_shift' not in payload
    history = f[0].get(f'/api/conversations/{f[3]["id"]}/messages', headers=f[1]).json()
    assert 'PRIVATE_RAW_TRACE_SENTINEL' not in json.dumps(history)


def test_new_constraint_and_ai_self_correction(prototype):
    seed(prototype, 1)
    prototype[6]['assistant'] = True
    response = send(prototype, '补充一个限制：我不能裸辞，需要保留收入，请修正之前的建议')
    assert response.status_code == 200
    p = response.json()['perspective_shift']
    assert p is not None and p['trigger'] == 'assistant_revision'
    assert 'a0' in p['supporting_message_ids']


@pytest.mark.parametrize('message', [
    '你好，今天有点想找人聊聊。',
    '两个职业选哪个，我还没有提供任何背景',
    '我现在只想倾诉，不想分析职业，也不想安排下一步',
    '今天被拒绝了很难过，想安静说说',
    '我现在想伤害自己，职业选择已经不重要了',
    '一公里是多少米？',
])
def test_no_supported_perspective_for_insufficient_or_listening_or_crisis(prototype, message):
    if '没有提供' not in message:
        seed(prototype)
    response = send(prototype, message)
    assert response.status_code == 200
    assert response.json()['perspective_shift'] is None
    context = json.loads(prototype[5][-1]['messages'][1]['content'].split('：', 1)[1])
    assert 'perspective_messages' not in context


@pytest.mark.parametrize('mode', ['schema', 'missing', 'foreign', 'bad_quote', 'internal', 'uncovered'])
def test_invalid_artifact_hidden_usable_reply_preserved(prototype, mode):
    seed(prototype)
    def change(p):
        if mode == 'schema':
            return {'title': 'invalid'}
        if mode in {'missing', 'foreign'}:
            p['supporting_message_ids'][0] = mode + '-message-id'
            p['evidence'][0]['message_id'] = mode + '-message-id'
        if mode == 'bad_quote':
            p['evidence'][0]['quote'] = '用户从未说过自己有海外产品经验'
        if mode == 'internal':
            p['possible_blind_spot'] = '<think>PRIVATE_RAW_TRACE_SENTINEL</think>'
        if mode == 'uncovered':
            p['evidence'][1]['supports'] = ['observation']
        return p
    if mode == 'foreign':
        other = conversation(prototype[0], prototype[1], prototype[2], '另一段会话')
        with Session(prototype[4]) as db, db.begin():
            db.add(Message(id='foreign-message-id', issue_id=prototype[2]['id'],
                           conversation_id=other['id'], role='user', content='其他会话中的真实消息'))
    prototype[6]['change'] = change
    response = send(prototype)
    assert response.status_code == 200
    assert response.json()['perspective_shift'] is None
    assert len(prototype[5]) == 1 and 'PRIVATE_RAW_TRACE_SENTINEL' not in response.text


def test_rejection_cooldown_and_close_are_conversation_scoped(prototype):
    seed(prototype)
    first = send(prototype).json()
    token = first['perspective_token']
    for message in [
        '还是想比较这两个职业', '请继续比较这两个职业',
        '现在不能搬家，请重新考虑这个新限制',
    ]:
        response = send(prototype, message, perspective_control={'dismissed': [token]})
        assert response.json()['perspective_shift'] is None
    # New source alone cannot revive the rejected concern through the same wording.
    response = send(prototype, '现在不能搬家，需要照顾家人，请重新推荐',
                    perspective_control={'disabled': True})
    assert response.json()['perspective_shift'] is None
    assert send(prototype, '现在不能裸辞，帮我比较').json()['perspective_shift'] is None
    other = conversation(prototype[0], prototype[1], prototype[2], '独立会话')
    assert all(key[1] != other['id'] for key in prototype[7].states)


def test_outdated_memory_cannot_be_an_evidence_message(prototype):
    seed(prototype)
    prototype[0].put('/api/me', headers=prototype[1], json={'use_memory': True})
    user_id = prototype[0].get('/api/me', headers=prototype[1]).json()['id']
    with Session(prototype[4]) as db, db.begin():
        db.add(Memory(id='old-memory', user_id=user_id, issue_id=prototype[2]['id'],
                      content='每周有两小时可以学习', category='constraint', horizon='current_phase'))
    # Even an authorized real memory ID is not a supplied conversational message.
    def change(p):
        p['supporting_message_ids'][0] = 'old-memory'
        p['evidence'][0] = {'message_id': 'old-memory', 'quote': '每周有两小时可以学习',
                            'supports': ['observation']}
        return p
    prototype[6]['change'] = change
    result = send(prototype, '我现在不能按以前的两小时安排，工作变了，请重新比较')
    assert result.json()['perspective_shift'] is None


def test_off_flag_does_not_change_prompt_and_hides_injected_candidate(prototype):
    seed(prototype)
    config = prototype[8] | {'perspective_prototype': None}
    with TestClient(create_app(**config)) as client:
        f = (client, *prototype[1:])
        assert send(f).json()['perspective_shift'] is None
    sent = prototype[5][-1]
    assert 'perspective_shift' not in sent['messages'][0]['content']
    assert 'perspective_messages' not in sent['messages'][1]['content']


def test_prototype_cannot_enter_live_or_frozen_evaluation():
    with pytest.raises(GuardError):
        create_app(perspective_prototype=PerspectivePrototype())
    with pytest.raises(GuardError):
        create_app(perspective_prototype=PerspectivePrototype(), evaluation_guard=EvaluationGuard(),
                   ai_transport=httpx.MockTransport(lambda r: httpx.Response(200)),
                   deepseek_base_url='https://offline.invalid')
    assert AIOutput(reply='可用正文', perspective_shift={'wrong': 'schema'}).perspective_shift is None
