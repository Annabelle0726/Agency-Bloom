"""Explicit, atomic Plan review using existing issue metadata and Journey records."""
import hashlib
import json
from typing import Literal
from uuid import UUID

from fastapi import Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from .journey import JourneyRecord, revision
from .models import Feedback, Issue, Message, User, now, uid
from .plan_continuity import lock_plan_owner, memory_sync_state, sync_plan_context


class RecordDraft(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id: str | None = Field(None, max_length=80)
    version: str | None = Field(None, max_length=64)
    title: str = Field(min_length=1, max_length=120)
    text: str = Field(min_length=1, max_length=2000)

    @field_validator('title', 'text')
    @classmethod
    def trim(cls, value):
        if not value.strip():
            raise ValueError('blank content')
        return value.strip()


class PlanWrite(BaseModel):
    model_config = ConfigDict(extra='forbid')
    request_id: UUID
    version: int = Field(ge=1)
    record: RecordDraft | None = None
    next_step: str | None = Field(None, max_length=600)
    step_action: Literal['revise', 'replace'] | None = None
    attempt_id: str | None = Field(None, min_length=1, max_length=80)
    record_attempt_id: str | None = Field(None, min_length=1, max_length=80)
    status: Literal['active', 'paused', 'completed'] | None = None
    source_message_id: UUID | None = None
    remember_plan: bool | None = None
    memory_version: int | None = Field(None, ge=1)


def plan_meta(issue):
    data = dict((issue.exploration or {}).get('plan') or {})
    step = (issue.card or {}).get('next_step', '')
    # Other card editors cannot accidentally carry a pause over to a different step.
    if data.get('step') != step:
        data = {**data, 'step': step, 'status': 'active' if step else 'empty',
                'attempt_id': hashlib.sha256((issue.id + step).encode()).hexdigest()[:32] if step else None}
    return data


def plan_view(db, issue):
    meta = plan_meta(issue)
    links = meta.get('links', {})
    rows = db.scalars(select(JourneyRecord).where(JourneyRecord.issue_id == issue.id,
                      JourneyRecord.status == 'confirmed').order_by(JourneyRecord.created_at.desc()).limit(50)).all()
    records = [{'id': 'record:' + r.id, 'title': r.title, 'text': r.text, 'kind': r.kind,
                'created_at': r.created_at, 'version': str(r.version),
                'attempt_id': links.get('record:' + r.id), 'editable': True} for r in rows]
    feedback = db.scalars(select(Feedback).where(Feedback.issue_id == issue.id)
                          .order_by(Feedback.created_at.desc()).limit(50)).all()
    records += [{'id': 'feedback:' + r.id, 'title': '你留下的经历', 'text': r.text,
                 'kind': r.kind, 'created_at': r.created_at, 'version': revision(r.text),
                 'attempt_id': links.get('feedback:' + r.id), 'editable': True} for r in feedback]
    records.sort(key=lambda r: (r['created_at'], r['id']), reverse=True)
    latest = next((r for r in records if meta.get('attempt_id') and
                   r['attempt_id'] == meta['attempt_id'] and r['kind'] != 'decision'), None)
    return {'issue_id': issue.id, 'version': issue.version, 'next_step': (issue.card or {}).get('next_step', ''),
            'attempt_id': meta.get('attempt_id'), 'status': meta.get('status', 'empty'),
            'records': records[:50], 'latest': latest, **memory_sync_state(db, issue)}


def plan_from_card_edit(db, issue, step):
    """Card and Journey edits revise an attempt; clearing it retires its identity."""
    exploration = dict(issue.exploration or {})
    old_step = (issue.card or {}).get('next_step', '')
    if step == old_step:
        return exploration
    meta = plan_meta(issue)
    links = dict(meta.get('links', {}))
    previous = meta.get('attempt_id')
    if not step:
        meta.update(step='', attempt_id=None, status='empty')
    elif not old_step:
        meta.update(step=step, attempt_id=uid(), status='active')
    else:
        meta['step'] = step
    event_id = uid()
    db.add(JourneyRecord(id=event_id, user_id=issue.user_id, issue_id=issue.id, kind='decision',
        title='调整下一步' if step else '放下这一步',
        text=('原先：\n' + old_step + '\n\n' if old_step else '') + ('现在保留：\n' + step if step else '暂时不保留下一步')))
    links['record:' + event_id] = meta.get('attempt_id') or previous
    exploration['plan'] = {**meta, 'links': links}
    return exploration


def register_plan_routes(app, authenticated, db_dependency, owned):
    @app.get('/api/issues/{issue_id}/plan')
    def read(issue_id: str, user: User = Depends(authenticated), db: Session = Depends(db_dependency)):
        return plan_view(db, owned(db, user, issue_id))

    @app.post('/api/issues/{issue_id}/plan')
    def save(issue_id: str, body: PlanWrite, user: User = Depends(authenticated), db: Session = Depends(db_dependency)):
        lock_plan_owner(db, user.id)
        issue = owned(db, user, issue_id)
        meta = plan_meta(issue)
        digest = hashlib.sha256(json.dumps(body.model_dump(mode='json'), sort_keys=True).encode()).hexdigest()
        if meta.get('request_id') == str(body.request_id):
            if meta.get('digest') != digest:
                raise HTTPException(409, '这次保存已处理，请核对后重新保存')
            return plan_view(db, issue)
        if issue.ended_at or issue.version != body.version:
            raise HTTPException(409, '探索已结束或内容已变化，你的编辑仍保留，请读取最新内容后核对')
        if body.record is None and body.next_step is None and body.status is None:
            raise HTTPException(422, '请选择要保存的记录或下一步')
        source = None
        if body.source_message_id:
            source = db.scalar(select(Message).where(Message.id == str(body.source_message_id),
                               Message.issue_id == issue.id, Message.role == 'assistant'))
            if not source or not user.save_chat or not (source.payload or {}).get('plan_draft'):
                raise HTTPException(409, '原始对话已不可用，请重新核对草稿')
        old_step = (issue.card or {}).get('next_step', '')
        step = old_step if body.next_step is None else body.next_step.strip()
        previous_attempt = meta.get('attempt_id')
        links = dict(meta.get('links', {}))
        if (body.next_step is not None or body.status) and 'attempt_id' in body.model_fields_set and body.attempt_id != previous_attempt:
            raise HTTPException(409, '当前尝试已更换，你的文字仍保留；请关闭草稿后重新选择要调整的尝试')
        if body.record_attempt_id and body.record_attempt_id not in {*links.values(), previous_attempt}:
            raise HTTPException(422, '这条记录所属的尝试不在当前探索中')
        if body.step_action and body.next_step is None:
            raise HTTPException(422, '请同时确认下一步的内容')
        new_attempt = bool(step and (not old_step or
            (body.next_step is not None and body.step_action == 'replace') or
            (step != old_step and body.step_action != 'revise')))
        if new_attempt and body.status:
            raise HTTPException(422, '请先确认原来这一步的状态，再选择新的尝试')
        if not step:
            meta.update(step='', attempt_id=None, status='empty')
        elif new_attempt:
            meta.update(step=step, attempt_id=uid(), status='active')
        else:
            meta['step'] = step
        if body.status:
            if not step:
                raise HTTPException(422, '先留下一步，再选择它的状态')
            meta['status'] = body.status
        if body.record:
            record = body.record
            if record.id:
                prefix, _, key = record.id.partition(':')
                if prefix == 'record':
                    row = db.scalar(select(JourneyRecord).where(JourneyRecord.id == key,
                        JourneyRecord.issue_id == issue.id, JourneyRecord.user_id == user.id,
                        JourneyRecord.status == 'confirmed'))
                    if not row or str(row.version) != record.version:
                        raise HTTPException(409, '记录已变化，请核对最新内容')
                    changed = db.execute(update(JourneyRecord).where(JourneyRecord.id == key,
                        JourneyRecord.version == row.version).values(title=record.title, text=record.text,
                                                                   version=JourneyRecord.version + 1))
                elif prefix == 'feedback':
                    row = db.scalar(select(Feedback).where(Feedback.id == key, Feedback.issue_id == issue.id))
                    if not row or revision(row.text) != record.version:
                        raise HTTPException(409, '记录已变化，请核对最新内容')
                    changed = db.execute(update(Feedback).where(Feedback.id == key, Feedback.text == row.text)
                                         .values(text=record.text))
                else:
                    raise HTTPException(422, '不能修改这类记录')
                if changed.rowcount != 1:
                    db.rollback()
                    raise HTTPException(409, '记录已变化，你的文字仍保留')
            else:
                record_id = str(body.request_id)
                db.add(JourneyRecord(id=record_id, user_id=user.id, issue_id=issue.id, kind='thought',
                                     title=record.title, text=record.text))
                target = previous_attempt or meta.get('attempt_id')
                if 'record_attempt_id' in body.model_fields_set:
                    target = body.record_attempt_id or (meta.get('attempt_id') if not old_step else None)
                links['record:' + record_id] = target
        if step != old_step or new_attempt or body.status:
            event_id = uid()
            label = {'paused': '先放一放', 'completed': '这一步已完成', 'active': '继续这一步'}.get(
                body.status, '选择新的尝试' if new_attempt else '调整这一步' if step else '暂时不保留下一步')
            db.add(JourneyRecord(id=event_id, user_id=user.id, issue_id=issue.id, kind='decision', title=label,
                text=('原先：\n' + old_step + '\n\n' if old_step else '') +
                     ('现在保留：\n' + step if step else '暂时不保留下一步') + ('\n选择：' + label if body.status else '')))
            links['record:' + event_id] = meta.get('attempt_id')
        meta.update(links=links, request_id=str(body.request_id), digest=digest)
        changed = db.execute(update(Issue).where(Issue.id == issue.id, Issue.user_id == user.id,
             Issue.version == body.version, Issue.ended_at.is_(None)).values(
             card={**issue.card, 'next_step': step}, exploration={**(issue.exploration or {}), 'plan': meta},
             version=Issue.version + 1, updated_at=now()))
        if changed.rowcount != 1:
            db.rollback()
            raise HTTPException(409, '内容已变化，你的编辑仍保留')
        if source:
            source.payload = {**(source.payload or {}), 'plan_draft': None, 'plan_saved': True}
        sync_plan_context(db, issue, body.remember_plan, body.memory_version)
        db.commit()
        db.refresh(issue)
        return plan_view(db, issue)
