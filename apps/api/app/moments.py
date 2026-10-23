"""On-demand Moments; shared monthly ledger, durable admission, separate content."""
import asyncio
import hashlib
import json
import re
from contextlib import suppress
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from time import perf_counter
from typing import Literal
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

import httpx
from fastapi import Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict
from sqlalchemy import (
    JSON,
    Boolean,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
    inspect,
    select,
    update,
)
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Mapped, Session, mapped_column

from . import ai
from .models import AIRequest, Base, Budget, Memory, User, now
from .moment_content import demo_content, fingerprint, messages_for, validate_content
from .pricing import price_usage


class BloomMoment(Base):
    __tablename__ = 'bloom_moments'
    __table_args__ = (UniqueConstraint('user_id', 'day', 'ordinal'),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    request_key: Mapped[str] = mapped_column(ForeignKey('ai_requests.id'), unique=True)
    day: Mapped[str] = mapped_column(String(10))
    ordinal: Mapped[int] = mapped_column(Integer)
    kind: Mapped[str] = mapped_column(String(20))
    content: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    fingerprint: Mapped[str] = mapped_column(String(64), default='')
    dismissed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[str] = mapped_column(String(40), default=now)


class OpenMoment(BaseModel):
    model_config = ConfigDict(extra='forbid')
    request_id: UUID
    action: Literal['open', 'another'] = 'open'
    previous_id: UUID | None = None
    personalize: bool = False


def day_key():
    return datetime.now(timezone.utc).astimezone(ZoneInfo('Asia/Shanghai')).date().isoformat()


def purge_moments(db, user_id):
    # Older deployments may not have applied the additive migration yet.
    if inspect(db.bind).has_table('bloom_moments'):
        db.execute(update(BloomMoment).where(BloomMoment.user_id == user_id).values(content=None))


def authorized_sources(db, user, personalize):
    if not personalize or not user.use_memory:
        return []
    rows = db.scalars(select(Memory).where(
        Memory.user_id == user.id, Memory.issue_id.is_(None), Memory.enabled.is_(True),
        Memory.status == 'active', Memory.source == 'user_confirmed', Memory.confirmed_at.is_not(None),
    ).order_by(Memory.updated_at.desc(), Memory.id).limit(8)).all()
    return [{'id': r.id, 'quote': r.content, 'date': r.confirmed_at[:10], 'version': r.version}
            for r in rows if 4 <= len(r.content) <= 240 and not re.search(r'自杀|自伤|不想活|结束生命|伤害自己|suicid|self.harm', r.content, re.I)][:3]


def recent_moments(db, user_id):
    rows = db.scalars(select(BloomMoment).where(BloomMoment.user_id == user_id)
                      .order_by(BloomMoment.created_at.desc(), BloomMoment.ordinal.desc()).limit(12)).all()
    return [{'kind': r.kind, 'fingerprint': r.fingerprint, 'dismissed': r.dismissed,
             'content': r.content} for r in rows]


def select_kind(sources, recent):
    eligible = ['light', 'experiment', 'perspective', 'echo'] if sources else ['light', 'experiment']
    # A refusal rests that flavor for the next two experiences, not a trait.
    rested = {r['kind'] for r in recent[:2] if r['dismissed']}
    candidates = [k for k in eligible if k not in rested] or eligible
    return min(candidates, key=lambda k: sum(r['kind'] == k for r in recent[:4]))


def view(db, row, user):
    if not row:
        return {'day': day_key(), 'moment': None}
    receipt = db.get(AIRequest, row.request_key)
    content = row.content if user.save_chat and user.ai_consent and not row.dismissed else None
    # Source deletion/disable/revision revokes cached personal content as well.
    if content and content['sources']:
        sources = {s['id']: s for s in authorized_sources(db, user, True)}
        if any(sources.get(s['id']) != s for s in content['sources']):
            content = None
    status = receipt.status
    if status == 'pending':
        # A crashed worker must not strand the account forever or refund unknown cost.
        age = datetime.now(timezone.utc) - datetime.fromisoformat(receipt.created_at)
        if age > timedelta(minutes=3):
            status = 'unknown'
    return {'day': row.day, 'moment': {'id': row.id, 'status': status,
            'content': content, 'dismissed': row.dismissed,
            'demo': bool(receipt.usage and receipt.usage.get('provider') == 'local_preview')}}


async def generate(settings, messages, transport, kind, sources, ordinal):
    if settings.ai_mode == 'demo':
        return demo_content(kind, sources, ordinal), {'cost_micro': 0, 'provider': 'local_preview'}, None
    payload = {'model': settings.deepseek_model, 'messages': messages,
               'thinking': {'type': 'enabled' if settings.ai_thinking else 'disabled'},
               'max_tokens': settings.max_output_tokens, 'stream': False,
               'response_format': {'type': 'text'},
               **({'reasoning_effort': 'low'} if settings.ai_thinking else {})}
    started = perf_counter()
    async with asyncio.timeout(settings.ai_timeout_seconds):
        async with httpx.AsyncClient(transport=transport or httpx.AsyncHTTPTransport(retries=0),
                                     timeout=settings.ai_timeout_seconds, follow_redirects=False) as client:
            response = await client.post(settings.deepseek_base_url.rstrip('/') + '/chat/completions',
                headers={'Authorization': 'Bearer ' + settings.deepseek_api_key}, json=payload)
            response.raise_for_status()
            result = response.json()
    receipt = price_usage(settings, result['usage'], result.get('created'), result.get('model'))
    if receipt['cost_micro'] > ai.reservation_micro(settings, messages):
        raise ValueError('usage_exceeds_reservation')
    receipt.update(provider='DeepSeek', requested_model=settings.deepseek_model,
                   thinking='enabled' if settings.ai_thinking else 'disabled',
                   total_ms=round((perf_counter() - started) * 1000))
    choice = result['choices'][0]
    # Only final content is read. Provider reasoning is neither logged nor persisted.
    return choice['message'].get('content') or '', receipt, choice.get('finish_reason')


def register_moment_routes(app, authenticated, db_dependency, sessions, settings, transport, evaluation=False):
    def ready(db):
        if evaluation:
            raise HTTPException(409, '固定评测不包含 Bloom Moment')
        if not inspect(db.bind).has_table('bloom_moments'):
            raise HTTPException(503, '今天的小惊喜尚未准备好')

    def latest(db, user_id):
        return db.scalar(select(BloomMoment).where(BloomMoment.user_id == user_id,
            BloomMoment.day == day_key()).order_by(BloomMoment.ordinal.desc()).limit(1))

    @app.get('/api/moments/today')
    def today(user: User = Depends(authenticated), db: Session = Depends(db_dependency)):
        ready(db)
        return view(db, latest(db, user.id), user)

    @app.post('/api/moments/{moment_id}/dismiss', status_code=204)
    def dismiss(moment_id: UUID, user: User = Depends(authenticated), db: Session = Depends(db_dependency)):
        ready(db)
        result = db.execute(update(BloomMoment).where(BloomMoment.id == str(moment_id),
            BloomMoment.user_id == user.id).values(dismissed=True, content=None))
        if result.rowcount != 1:
            raise HTTPException(404, '没有找到这份小惊喜')
        db.commit()

    @app.post('/api/moments/open')
    async def open_moment(body: OpenMoment, request: Request,
                          user: User = Depends(authenticated), db: Session = Depends(db_dependency)):
        ready(db)
        user_id = user.id
        db.execute(update(User).where(User.id == user_id).values(use_memory=User.use_memory))
        db.refresh(user)
        if not user.ai_consent:
            raise HTTPException(403, '请先允许 AI 数据处理')
        key = hashlib.sha256(f'{user_id}:{body.request_id}'.encode()).hexdigest()
        existing = db.scalar(select(BloomMoment).where(BloomMoment.request_key == key))
        if existing:
            return view(db, existing, user)
        if db.get(AIRequest, key):
            raise HTTPException(409, '这条请求已经提交')
        previous = latest(db, user_id)
        if body.action == 'open' and previous:
            return view(db, previous, user)
        if body.action == 'another' and (not previous or str(body.previous_id) != previous.id):
            raise HTTPException(409, '请先查看今天的小惊喜，再决定是否换一个')
        pending = db.scalar(select(AIRequest).where(AIRequest.user_id == user_id,
            AIRequest.kind == 'moment', AIRequest.status == 'pending').limit(1))
        if pending:
            if datetime.now(timezone.utc) - datetime.fromisoformat(pending.created_at) <= timedelta(minutes=3):
                raise HTTPException(409, '有一份小惊喜正在准备，请先查看结果')
            pending.status = 'unknown'  # Reservation survives timeout/crash/restart.
        retain = user.save_chat
        sources = authorized_sources(db, user, body.personalize)
        recent = recent_moments(db, user_id)
        catalog = {s['id']: s for s in sources}
        for item in recent:
            if item['content'] and any(catalog.get(s['id']) != s for s in item['content']['sources']):
                item['content'] = None
        kind = select_kind(sources, recent)
        if kind in ('light', 'experiment'):
            sources = []  # Generic experiences do not transmit personal data.
        messages = messages_for(kind, sources, recent, str(body.request_id))
        # Local size admission is an operational estimate, not a hosted-token proof.
        if len(json.dumps(messages, ensure_ascii=False).encode()) > 24000:
            raise HTTPException(413, '已有记录较长，暂时无法准备这份小惊喜')
        reserved = ai.reservation_micro(settings, messages)
        month, day = day_key()[:7], day_key()
        insert = sqlite_insert if db.bind.dialect.name == 'sqlite' else pg_insert
        db.execute(insert(Budget).values(month=month, used_micro=0).on_conflict_do_nothing(index_elements=['month']))
        limit = int(settings.ai_monthly_budget_cny * Decimal(1_000_000))
        if db.execute(update(Budget).where(Budget.month == month, Budget.used_micro + reserved <= limit)
                      .values(used_micro=Budget.used_micro + reserved)).rowcount != 1:
            db.rollback()
            raise HTTPException(402, '本月 AI 服务额度已用完，已有内容仍可查看')
        midnight = datetime.now(timezone.utc).astimezone(ZoneInfo('Asia/Shanghai')).replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc).isoformat()
        count = db.scalar(select(func.count()).select_from(AIRequest).where(
            AIRequest.user_id == user_id, AIRequest.created_at >= midnight))
        if count >= settings.daily_chat_limit:
            db.rollback()
            raise HTTPException(429, '今天的 AI 额度已用完，已有内容仍可查看')
        ordinal = previous.ordinal + 1 if previous else 1
        row = BloomMoment(id=str(uuid4()), user_id=user_id, request_key=key, day=day,
                          ordinal=ordinal, kind=kind, content=None)
        db.add(AIRequest(id=key, user_id=user_id, month=month, cost_micro=reserved, kind='moment'))
        db.flush()
        db.add(row)
        db.commit()
        task = asyncio.create_task(generate(settings, messages, transport, kind, sources, ordinal))
        receipt, content = None, None
        try:
            while not task.done():
                await asyncio.wait([task], timeout=.2)
                with sessions() as check:
                    record = check.get(AIRequest, key)
                    live_user = check.get(User, user_id)
                    if not live_user or not live_user.ai_consent or record.status != 'pending' or await request.is_disconnected():
                        raise asyncio.CancelledError()
            raw, receipt, finish = await task
            if finish not in (None, 'stop'):
                raise ValueError('incomplete')
            content = validate_content(raw, kind, sources, recent)
        except (Exception, asyncio.CancelledError):
            # No content/logging, no retry or silent fallback. Known usage settles;
            # unknown billing keeps its full reservation, including disconnects.
            task.cancel()
            with suppress(Exception, asyncio.CancelledError):
                await task
        with sessions.begin() as done:
            done.execute(update(User).where(User.id == user_id).values(use_memory=User.use_memory))
            live_user, record = done.get(User, user_id), done.get(AIRequest, key)
            saved = done.get(BloomMoment, row.id)
            if receipt:
                done.execute(update(Budget).where(Budget.month == month).values(
                    used_micro=Budget.used_micro - reserved + receipt['cost_micro']))
                record.cost_micro, record.usage = receipt['cost_micro'], receipt
            allowed = live_user and live_user.ai_consent and record.status == 'pending' and saved
            if allowed and sources:
                allowed = sources == authorized_sources(done, live_user, body.personalize)
            if not allowed:
                record.status = 'cancelled'
                raise_after = True
            else:
                record.status = 'completed' if content else ('failed' if receipt else 'unknown')
                saved.content = content if retain and live_user.save_chat and not saved.dismissed else None
                saved.fingerprint = fingerprint(content) if content else ''
                raise_after = False
                result = view(done, saved, live_user)
                if content and not saved.dismissed:
                    result['moment']['content'] = content  # Retention off: this response only.
        if raise_after:
            raise HTTPException(409, '授权或记录已改变，这次结果不会展示')
        return result
