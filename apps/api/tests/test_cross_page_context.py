import json
from uuid import uuid4

import httpx
from fastapi.testclient import TestClient

from app.main import create_app


def test_independent_problems_share_only_authorized_context_and_compare_without_saving(tmp_path):
    captured = []

    def provider(request):
        wire = json.loads(request.content)
        captured.append(wire)
        output = {'reply': '可以比较保留当前收入了解岗位、用小项目验证兴趣这两种选择；两者都需要核实时间投入。',
                  'suggestion': {'options': ['保留收入了解岗位', '小项目验证兴趣'], 'hypotheses': [], 'unknowns': ['真实时间投入'], 'next_step': '先了解真实岗位日常'}}
        return httpx.Response(200, json={'choices': [{'finish_reason': 'stop', 'message': {'content': json.dumps(output, ensure_ascii=False)}}],
                                        'usage': {'prompt_tokens': 100, 'completion_tokens': 100}})

    app = create_app(database_url=f"sqlite:///{tmp_path / 'context.db'}", ai_mode='deepseek',
                     deepseek_base_url='https://offline.invalid', deepseek_api_key='mock-only', ai_transport=httpx.MockTransport(provider))
    with TestClient(app) as c:
        auth = {'Authorization': 'Bearer ' + c.post('/api/auth/dev', json={'privacy_accepted': True}).json()['token']}
        c.put('/api/me', headers=auth, json={'ai_consent': True, 'use_memory': True})
        job = c.post('/api/issues', headers=auth, json={'title': '求职选择', 'concerns': ['job_search']}).json()
        relation = c.post('/api/issues', headers=auth, json={'title': '关系沟通', 'concerns': ['relationships']}).json()
        conversations = c.get('/api/conversations', headers=auth).json()
        job_chat = next(row for row in conversations if row['issue_id'] == job['id'])
        relation_chat = next(row for row in conversations if row['issue_id'] == relation['id'])

        def memory(content, issue_id=None):
            response = c.post('/api/memories', headers=auth, json={'content': content, 'issue_id': issue_id, 'confirmed': True})
            assert response.status_code == 201, response.text
            return response.json()

        shared = memory('每周需要照顾家人，时间安排有限')
        job_memory = memory('求职只考虑远程岗位', job['id'])
        relation_memory = memory('关系沟通时需要把周末安排说清楚', relation['id'])

        def send(conversation_id, text):
            count = len(captured)
            result = c.post(f'/api/conversations/{conversation_id}/chat', headers=auth, json={'request_id': str(uuid4()), 'message': text})
            assert result.status_code == 200, result.text
            assert len(captured) == count + 1  # No classifier, summary or follow-up model call.
            return result.json(), json.loads(captured[-1]['messages'][1]['content'].split('：', 1)[1])

        reply, context = send(job_chat['id'], '请比较求职的两个选择，考虑照顾家人的时间，求职私密细节标识')
        assert len(reply['suggestion']['options']) == 2
        assert {m['id'] for m in context['confirmed_memories']} == {shared['id'], job_memory['id']}
        assert '不强凑两条' in captured[-1]['messages'][0]['content']
        assert c.get(f"/api/issues/{job['id']}", headers=auth).json()['card'] == job['card']
        assert c.get(f"/api/issues/{relation['id']}", headers=auth).json()['card'] == relation['card']
        assert c.get(f"/api/issues/{relation['id']}/plan", headers=auth).json()['status'] == 'empty'

        _, context = send(relation_chat['id'], '关系沟通如何安排照顾家人的时间？')
        assert {m['id'] for m in context['confirmed_memories']} == {shared['id'], relation_memory['id']}
        assert '求职私密细节标识' not in json.dumps(captured[-1], ensure_ascii=False)

        another = c.post('/api/conversations', headers=auth, json={'issue_id': job['id']}).json()
        _, context = send(another['id'], '继续比较求职的远程岗位和照顾家人的时间')
        assert '求职私密细节标识' not in json.dumps(captured[-1], ensure_ascii=False)
        assert context['reviewed_conversation_summary'] is None

        live = c.get(f"/api/conversations/{relation_chat['id']}", headers=auth).json()
        linked = c.put(f"/api/conversations/{live['id']}", headers=auth,
                       json={'version': live['version'], 'linked_issue_ids': [job['id']]})
        assert linked.status_code == 200
        _, context = send(relation_chat['id'], '关系沟通也受求职远程岗位与照顾家人安排影响')
        assert any(row['id'] == job['id'] for row in context['explicitly_linked_explorations'])
        assert '求职私密细节标识' not in json.dumps(captured[-1], ensure_ascii=False)

        off = c.put(f"/api/memories/{shared['id']}", headers=auth,
                    json={'version': shared['version'], 'content': shared['content'], 'enabled': False, 'confirmed': True})
        assert off.status_code == 200
        _, context = send(relation_chat['id'], '关系沟通与照顾家人的时间安排')
        assert shared['id'] not in {row['id'] for row in context['confirmed_memories']}
        c.put('/api/me', headers=auth, json={'use_memory': False})
        _, context = send(job_chat['id'], '比较求职远程岗位与照顾家人的时间')
        assert context['confirmed_memories'] == []
        assert context['current_phase'] == []
        assert len(c.get('/api/issues', headers=auth).json()) == 2
