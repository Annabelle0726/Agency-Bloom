"""Confirmed Plan context and explicitly enabled, exploration-scoped memory sync."""
from fastapi import HTTPException
from sqlalchemy import func, or_, select, update

from .models import AIRequest, Conversation, ConversationLink, Memory, User, now, uid


def lock_plan_owner(db, user_id):
    # Same admission lock as memory edits and chat; no new model call can race the save.
    db.execute(update(User).where(User.id == user_id).values(use_memory=User.use_memory))


def linked_memory(db, issue):
    key = ((issue.exploration or {}).get('plan') or {}).get('memory_id')
    return db.scalar(select(Memory).where(Memory.id == key, Memory.user_id == issue.user_id)) if key else None


def memory_sync_state(db, issue):
    meta = (issue.exploration or {}).get('plan') or {}
    row = linked_memory(db, issue)
    active = row and row.source == 'plan_sync' and row.issue_id == issue.id and row.enabled and row.status == 'active'
    return {'memory_sync': bool(active and meta.get('memory_sync')) if 'memory_sync' in meta else None,
            'memory_version': row.version if row else None}


def plan_context(db, issue):
    from .plan import plan_view

    state = plan_view(db, issue)
    if not state['next_step'] and not state['records'] and not (issue.exploration or {}).get('plan'):
        return None
    observations = [r for r in state['records'] if r['kind'] != 'decision'][:3]
    changes = [r for r in state['records'] if r['kind'] == 'decision'][:3]
    return {'issue_id': issue.id, 'version': issue.version, 'next_step': state['next_step'],
            'attempt_id': state['attempt_id'],
            'status': state['status'], 'exploration_ended': bool(issue.ended_at),
            'observations': [{k: (r[k][:500] if k == 'text' else r[k]) for k in ('title', 'text', 'created_at', 'attempt_id')}
                             for r in observations],
            'changes': [{k: (r[k][:600] if k == 'text' else r[k]) for k in ('title', 'text', 'created_at')} for r in changes]}


def excerpt(text, limit):
    value = ' '.join(text.split())
    return value if len(value) <= limit else value[:limit - 1] + '…'


def memory_content(issue, context):
    state = {'active': '正在尝试', 'paused': '先放一放', 'completed': '这一步已完成', 'empty': '尚未选择下一步'}[context['status']]
    lines = ['Plan · ' + excerpt(issue.title, 25), '状态：' + ('探索已结束；' if issue.ended_at else '') + state,
             '当前一步：' + excerpt(context['next_step'] or '暂未选择', 100)]
    if context['changes']:
        change = context['changes'][0]
        lines.append('最近变化：' + excerpt(change['title'] + '；' + change['text'], 90))
    if context['observations']:
        lines.append('最近记录（节选）：' + excerpt(context['observations'][0]['text'], 100))
    lines.append('仅描述这段探索的选择，不代表长期性格或偏好')
    return '\n'.join(lines)


def sync_plan_context(db, issue, remember=None, expected_memory_version=None):
    """Runs inside the caller's transaction, after its confirmed Plan change."""
    db.flush()
    meta = dict((issue.exploration or {}).get('plan') or {})
    row = linked_memory(db, issue)
    managed = row and row.source == 'plan_sync' and row.issue_id == issue.id
    if remember is not None:
        meta['memory_sync'] = remember
    if remember is False and managed:
        # Retain the old wording for management, but never serve an outdated snapshot.
        row.enabled = False
        row.version += 1
        row.updated_at = now()
    if meta.get('memory_sync'):
        if remember is True and expected_memory_version != (row.version if row else None):
            raise HTTPException(409, '长期记忆已变化，请读取最新内容后核对；计划与文字尚未保存')
        if not (managed and row.enabled and row.status == 'active'):
            if remember is not True:
                # Deleting, disabling or editing independently never silently re-enables sync.
                meta['memory_sync'] = False
            elif managed and row.status == 'active':
                row.enabled = True
            else:
                count = db.scalar(select(func.count()).select_from(Memory).where(Memory.user_id == issue.user_id))
                if count >= 40:
                    raise HTTPException(409, '长期记忆已达40条；请先整理记忆，或取消同步后保存计划。当前修改仍保留')
                row = Memory(id=uid(), user_id=issue.user_id, issue_id=issue.id, category='fact', content='',
                             horizon='long_term', source='plan_sync', status='active', enabled=True, version=0)
                db.add(row)
        if meta.get('memory_sync'):
            content = memory_content(issue, plan_context(db, issue))
            if row.content != content or remember is True:
                row.content = content
                row.version += 1
                row.updated_at = row.confirmed_at = row.last_verified_at = now()
            meta['memory_id'] = row.id
    if meta:
        issue.exploration = {**(issue.exploration or {}), 'plan': meta}
    conversations = select(Conversation.id).where(Conversation.user_id == issue.user_id, or_(
        Conversation.issue_id == issue.id,
        Conversation.id.in_(select(ConversationLink.conversation_id).where(ConversationLink.issue_id == issue.id))))
    db.execute(update(AIRequest).where(AIRequest.user_id == issue.user_id, AIRequest.status == 'pending',
        AIRequest.conversation_id.in_(conversations)).values(status='cancelled'))
