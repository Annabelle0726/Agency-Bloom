"""Isolated fictional prototype QA. No credentials, real DB or live provider.
Run: uv run --project apps/api python tools/mock-perspective-api.py
Port 8019 is reserved for this disposable helper. No paid requests.
"""
import json
import os
import sys
import tempfile
from pathlib import Path

import httpx
import uvicorn

ROOT = Path(__file__).resolve().parents[1]
os.environ['AGENCY_DATABASE_URL'] = 'sqlite://'
os.environ['AGENCY_AI_MODE'] = 'demo'
os.environ['AGENCY_ENVIRONMENT'] = 'development'
sys.path.insert(0, str(ROOT / 'apps/api'))
from app.main import create_app  # noqa: E402
from app.perspective_shift import PerspectivePrototype  # noqa: E402

calls = 0


def provider(request):
    global calls
    calls += 1
    sent = json.loads(request.content)
    context = json.loads(sent['messages'][1]['content'].split('：', 1)[1])
    output = {'reply': '［隔离 Mock］你希望保留稳定收入，同时了解产品工作。先了解内部协作机会，可以控制尝试的投入。',
              'suggestion': None}
    source = next((s for s in context.get('response_evidence', []) if '稳定收入' in s['text']), None)
    if source:
        output['reasoning_summary'] = [
            {'kind': 'understanding', 'text': '你希望保留稳定收入，同时了解产品工作。',
             'evidence': [{'source_id': source['id'], 'quote': '稳定收入'}]},
            {'kind': 'tradeoff', 'text': '先了解内部协作机会，可以控制尝试的投入。',
             'evidence': [{'source_id': source['id'], 'quote': '稳定收入'}]},
        ]
    sources = context.get('perspective_messages', [])
    if sources:
        first = next(s for s in sources[:-1] if s['role'] == 'user')
        current = sources[-1]
        output['perspective_shift'] = {
            'title': '换个角度',
            'observation': '我们一直比较两个职业，也提到了保留稳定收入',
            'possible_blind_spot': '或许还需要核实：探索产品工作是否一定要先换工作',
            'alternative_perspective': '也可以先了解现团队的需求访谈机会，在保留现职时接触产品工作',
            'supporting_message_ids': [first['id'], current['id']],
            'evidence': [
                {'message_id': first['id'], 'quote': first['content'][:100], 'supports': ['observation']},
                {'message_id': current['id'], 'quote': current['content'][:100],
                 'supports': ['possible_blind_spot', 'alternative_perspective']},
            ],
            'uncertainty': '团队是否有这样的机会，以及你是否愿意，都还需要核实',
            'optional_next_question': None, 'trigger': 'repeated_choice',
        }
    return httpx.Response(200, json={'choices': [{'finish_reason': 'stop', 'message': {
        'content': json.dumps(output, ensure_ascii=False)}}],
        'usage': {'prompt_tokens': 1000, 'completion_tokens': 100}})


temporary = tempfile.TemporaryDirectory(prefix='bloom-perspective-offline-')
app = create_app(_env_file=None, environment='development', allow_dev_auth=True,
                 database_url='sqlite:///' + str(Path(temporary.name) / 'synthetic.sqlite'),
                 ai_mode='deepseek', deepseek_model='deepseek-v4-pro', deepseek_api_key='mock-only',
                 deepseek_base_url='https://offline.invalid', wechat_app_id='', wechat_app_secret='',
                 ai_transport=httpx.MockTransport(provider), perspective_prototype=PerspectivePrototype())


@app.get('/qa/status')
def status():
    return {'provider': 'perspective-isolated-mock', 'paid_requests': 0, 'calls': calls}


if __name__ == '__main__':
    uvicorn.run(app, host='127.0.0.1', port=8019, access_log=False)
