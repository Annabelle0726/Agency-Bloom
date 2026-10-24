import asyncio
import hashlib
import json
import logging
import secrets
from contextlib import asynccontextmanager, suppress
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import create_engine, delete, event, func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from . import ai, visual_selection, web_search
from .chat_stream import stream_response
from .config import Settings
from .conversations import before_message, cancel_pending, context_for, edit_anchor, register_routes
from .discovery import register_discovery_routes
from .evaluation_guard import GuardError
from .journey import register_journey_routes
from .local_schema import upgrade_local
from .models import (
    AIRequest,
    AuthSession,
    Base,
    Budget,
    Consent,
    Conversation,
    Feedback,
    Issue,
    Message,
    SpeechAudio,
    User,
    now,
)
from .moments import purge_moments, register_moment_routes
from .perspective_shift import fingerprint as perspective_fingerprint
from .schemas import (
    Card,
    CardUpdate,
    ChatInput,
    DevLogin,
    FeedbackInput,
    IssueInput,
    Login,
    Preferences,
    WechatLogin,
)
from .speech import SpeechService


class HealthProbeLogFilter(logging.Filter):
    """Hide access-log noise from local model discovery probing the root path."""

    def filter(self, record: logging.LogRecord) -> bool:
        args = record.args
        if isinstance(args, tuple) and len(args) == 5:
            method, path, status = args[1], args[2], args[4]
            if method == "GET" and path == "/health" and status == 404:
                return False
        return True


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def calendar():
    local = datetime.now(ZoneInfo("Asia/Shanghai"))
    midnight = local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
    return local.strftime("%Y-%m"), midnight.isoformat()


def user_view(user):
    return {
        "id": user.id,
        "save_chat": user.save_chat,
        "ai_consent": user.ai_consent,
        "theme": user.theme,
        "support_style": user.support_style,
        "use_memory": user.use_memory,
        "created_at": user.created_at,
    }


def issue_view(db, item):
    feedback = db.scalars(
        select(Feedback)
        .where(Feedback.issue_id == item.id)
        .order_by(Feedback.created_at.desc())
        .limit(50)
    ).all()
    return {
        "id": item.id,
        "title": item.title,
        "concerns": item.concerns,
        "life_contexts": item.life_contexts,
        "exploration_intent": (item.exploration or {}).get("intent", ""),
        "actual_question": (item.exploration or {}).get("question", ""),
        "focus_response": (item.exploration or {}).get("response", ""),
        "stage": item.stage,
        "background": item.background,
        "card": item.card,
        "version": item.version,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
        "ended_at": item.ended_at,
        "feedback": [
            {"id": f.id, "kind": f.kind, "text": f.text, "created_at": f.created_at}
            for f in feedback
        ],
    }


def create_app(ai_transport=None, wechat_transport=None, web_search_transport=None, evaluation_guard=None, perspective_prototype=None, tts_transport=None, **overrides):
    settings = Settings(**overrides)
    if evaluation_guard is not None and (not isinstance(ai_transport, httpx.MockTransport)
            or settings.deepseek_base_url != "https://offline.invalid"
            or not settings.database_url.startswith("sqlite")):
        raise GuardError("hosted_input_bound_unverified")
    if perspective_prototype is not None and (
        evaluation_guard is not None or not isinstance(ai_transport, httpx.MockTransport)
        or settings.deepseek_base_url != "https://offline.invalid"
        or not settings.database_url.startswith("sqlite")
    ):
        raise GuardError("perspective_prototype_requires_isolated_mock")
    sqlite = settings.database_url.startswith("sqlite")
    args = {"check_same_thread": False, "timeout": 30} if sqlite else {"prepare_threshold": None}
    engine = create_engine(settings.database_url, connect_args=args, pool_pre_ping=True)
    if sqlite:

        @event.listens_for(engine, "connect")
        def foreign_keys(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")

    sessions = sessionmaker(engine, expire_on_commit=False)
    speech = SpeechService(settings, sessions, tts_transport)

    @asynccontextmanager
    async def lifespan(app):
        if settings.environment == "development" and sqlite:
            Base.metadata.create_all(engine)
            upgrade_local(engine)
        sweeper = asyncio.create_task(speech.sweep())
        try:
            yield
        finally:
            sweeper.cancel()
            with suppress(asyncio.CancelledError):
                await sweeper
            engine.dispose()

    app = FastAPI(
        title="Agency Bloom API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.environment == "development" else None,
        redoc_url=None,
    )
    app.state.settings = settings
    app.state.evaluation_sessions = sessions if evaluation_guard is not None else None
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

    access_logger = logging.getLogger("uvicorn.access")
    if not any(isinstance(entry, HealthProbeLogFilter) for entry in access_logger.filters):
        access_logger.addFilter(HealthProbeLogFilter())

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, error):
        return JSONResponse(
            status_code=422, content={"detail": "内容格式不正确或超过长度限制，请检查后重试"}
        )

    @app.middleware("http")
    async def private_responses(request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    def db_dependency():
        with sessions() as db:
            yield db

    def authenticated(
        authorization: str | None = Header(default=None), db: Session = Depends(db_dependency)
    ):
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(401, "请先登录，再继续保存你的进展")
        token = db.get(AuthSession, digest(authorization[7:]))
        if token is None or token.expires_at <= now():
            raise HTTPException(401, "登录已过期，请重新登录")
        user = db.get(User, token.user_id)
        if user is None:
            raise HTTPException(401, "登录已失效")
        return user

    def owned(db, user, issue_id):
        item = db.scalar(select(Issue).where(Issue.id == issue_id, Issue.user_id == user.id))
        if not item:
            raise HTTPException(404, "没有找到这件事")
        return item

    def active(item):
        if item.ended_at:
            raise HTTPException(409, "这件事已结束，可以开启一个新的问题")

    def dev_resume_credential(db, user):
        raw = secrets.token_urlsafe(32)
        # Separate namespace: this credential cannot be used as a normal API session.
        db.add(
            AuthSession(
                token_hash=digest("dev-resume:" + raw),
                user_id=user.id,
                expires_at=(datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            )
        )
        return raw

    def sign_in(db, user, remember_dev=False):
        db.add(user)
        db.flush()
        db.add(
            Consent(
                user_id=user.id, kind="registration", accepted=True, policy_version="2026-10-16"
            )
        )
        raw = secrets.token_urlsafe(32)
        db.add(
            AuthSession(
                token_hash=digest(raw),
                user_id=user.id,
                expires_at=(datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            )
        )
        resume_token = dev_resume_credential(db, user) if remember_dev else None
        db.commit()
        result = {"token": raw, "user": user_view(user)}
        if resume_token:
            result["resume_token"] = resume_token
        return result

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.get("/api/config")
    def public_config():
        return {
            "dev_auth": settings.allow_dev_auth and settings.environment == "development",
            "wechat_auth": bool(settings.wechat_app_id and settings.wechat_app_secret),
            "ai_mode": settings.ai_mode,
            "speech_mode": settings.tts_mode,
            "privacy_version": "2026-10-16",
        }

    @app.post("/api/auth/dev")
    def dev_login(body: DevLogin, db: Session = Depends(db_dependency)):
        if not settings.allow_dev_auth or settings.environment != "development":
            raise HTTPException(404)
        if body.resume_token:
            credential = db.get(AuthSession, digest("dev-resume:" + body.resume_token))
            if credential is None or credential.expires_at <= now():
                raise HTTPException(401, "本机演示登录已失效")
            user = db.get(User, credential.user_id)
            if user is None or user.wechat_id is not None:
                raise HTTPException(401, "本机演示登录已失效")
            return sign_in(db, user)
        return sign_in(db, User(), remember_dev=True)

    @app.post("/api/auth/dev/remember")
    def remember_dev(
        body: Login, user: User = Depends(authenticated), db: Session = Depends(db_dependency)
    ):
        if not settings.allow_dev_auth or settings.environment != "development":
            raise HTTPException(404)
        if user.wechat_id is not None:
            raise HTTPException(403)
        credential = dev_resume_credential(db, user)
        db.commit()
        return {"resume_token": credential}

    @app.post("/api/auth/wechat")
    async def wechat_login(body: WechatLogin, db: Session = Depends(db_dependency)):
        if not settings.wechat_app_id or not settings.wechat_app_secret:
            raise HTTPException(503, "微信登录尚未配置，请联系内测负责人")
        try:
            async with httpx.AsyncClient(timeout=10, transport=wechat_transport) as client:
                response = await client.get(
                    "https://api.weixin.qq.com/sns/jscode2session",
                    params={
                        "appid": settings.wechat_app_id,
                        "secret": settings.wechat_app_secret,
                        "js_code": body.code,
                        "grant_type": "authorization_code",
                    },
                )
                response.raise_for_status()
                payload = response.json()
            if payload.get("errcode") or not isinstance(payload.get("openid"), str):
                raise ValueError("WeChat login rejected")
            openid = payload["openid"]
            if not 1 <= len(openid) <= 128:
                raise ValueError("Invalid identity")
        except (httpx.HTTPError, ValueError, KeyError):
            raise HTTPException(502, "微信登录暂时没有完成，请重新尝试") from None
        user = db.scalar(select(User).where(User.wechat_id == openid)) or User(wechat_id=openid)
        try:
            return sign_in(db, user)
        except IntegrityError:
            db.rollback()
            return sign_in(db, db.scalar(select(User).where(User.wechat_id == openid)))

    @app.get("/api/me")
    def me(user: User = Depends(authenticated)):
        return user_view(user)

    @app.put("/api/me")
    def preferences(
        body: Preferences, user: User = Depends(authenticated), db: Session = Depends(db_dependency)
    ):
        db.execute(update(User).where(User.id == user.id).values(use_memory=User.use_memory))
        db.refresh(user)
        values = body.model_dump(exclude_unset=True, exclude_none=True)
        if "ai_consent" in values and values["ai_consent"] != user.ai_consent:
            db.add(
                Consent(
                    user_id=user.id,
                    kind="ai",
                    accepted=values["ai_consent"],
                    policy_version="2026-10-16",
                )
            )
        if values.get("save_chat") is False or values.get("ai_consent") is False:
            purge_moments(db, user.id)
            db.execute(delete(SpeechAudio).where(SpeechAudio.user_id == user.id))
        if values.get("save_chat") is False:
            ids = select(Issue.id).where(Issue.user_id == user.id)
            db.execute(delete(Message).where(Message.issue_id.in_(ids)))
            db.execute(
                update(Conversation)
                .where(Conversation.user_id == user.id)
                .values(summary=None, version=Conversation.version + 1)
            )
            cancel_pending(db, user.id)
        if "use_memory" in values and values["use_memory"] != user.use_memory:
            cancel_pending(db, user.id)
        if values.get("ai_consent") is False:
            db.execute(
                update(AIRequest)
                .where(AIRequest.user_id == user.id, AIRequest.status == "pending")
                .values(status="cancelled")
            )
        for key, value in values.items():
            setattr(user, key, value)
        db.commit()
        return user_view(user)

    @app.post("/api/auth/logout", status_code=204)
    def logout(
        authorization: str = Header(),
        user: User = Depends(authenticated),
        db: Session = Depends(db_dependency),
    ):
        db.execute(delete(AuthSession).where(AuthSession.token_hash == digest(authorization[7:])))
        db.commit()
        return Response(status_code=204)

    @app.delete("/api/me", status_code=204)
    def delete_account(user: User = Depends(authenticated), db: Session = Depends(db_dependency)):
        db.execute(
            update(AIRequest)
            .where(AIRequest.user_id == user.id, AIRequest.status == "pending")
            .values(status="cancelled")
        )
        db.delete(user)
        db.commit()
        return Response(status_code=204)

    @app.get("/api/issues/current")
    def current(user: User = Depends(authenticated), db: Session = Depends(db_dependency)):
        item = db.scalar(
            select(Issue)
            .where(Issue.user_id == user.id, Issue.ended_at.is_(None))
            .order_by(Issue.updated_at.desc(), Issue.id)
            .limit(1)
        )
        return issue_view(db, item) if item else None

    @app.get("/api/issues")
    def issue_list(
        user: User = Depends(authenticated),
        db: Session = Depends(db_dependency),
        offset: int = Query(0, ge=0),
        limit: int = Query(50, ge=1, le=100),
    ):
        return [
            issue_view(db, row)
            for row in db.scalars(
                select(Issue)
                .where(Issue.user_id == user.id)
                .order_by(Issue.updated_at.desc(), Issue.id)
                .offset(offset)
                .limit(limit)
            )
        ]

    @app.post("/api/issues", status_code=201)
    def create_issue(
        body: IssueInput, user: User = Depends(authenticated), db: Session = Depends(db_dependency)
    ):
        initial = Card(
            title=body.title,
            constraints=body.constraints,
            confirmed=[body.background] if body.background.strip() else [],
            unknowns=["我需要哪些信息，才能更清楚地选择？"],
        )
        item = Issue(
            user_id=user.id,
            title=body.title,
            concerns=body.concerns,
            life_contexts=body.life_contexts,
            exploration={
                "card_reviewed_at": None,
                "initial_title": body.title,
                "initial_constraints": body.constraints,
                "intent": body.exploration_intent,
                "question": body.actual_question,
                "response": body.focus_response,
            },
            stage=body.stage,
            background=body.background,
            card=initial.model_dump(),
        )
        db.add(item)
        user.support_style = body.support_style
        db.flush()
        db.add(
            Conversation(
                id=item.id,
                user_id=user.id,
                issue_id=item.id,
                title="开始探索",
                support_style=body.support_style,
            )
        )
        db.commit()
        return issue_view(db, item)

    @app.get("/api/issues/{issue_id}")
    def get_issue(
        issue_id: str, user: User = Depends(authenticated), db: Session = Depends(db_dependency)
    ):
        return issue_view(db, owned(db, user, issue_id))

    @app.put("/api/issues/{issue_id}/card")
    def save_card(
        issue_id: str,
        body: CardUpdate,
        user: User = Depends(authenticated),
        db: Session = Depends(db_dependency),
    ):
        item = owned(db, user, issue_id)
        active(item)
        changed = db.execute(
            update(Issue)
            .where(
                Issue.id == item.id,
                Issue.user_id == user.id,
                Issue.version == body.version,
                Issue.ended_at.is_(None),
            )
            .values(
                card=body.card.model_dump(),
                exploration={**(item.exploration or {}), 'card_reviewed_at': now()},
                title=body.card.title,
                version=Issue.version + 1,
                updated_at=now(),
            )
        )
        if changed.rowcount != 1:
            db.rollback()
            raise HTTPException(409, "卡片已在别处更新，请刷新后再保存；当前修改仍可保留")
        db.commit()
        db.refresh(item)
        return issue_view(db, item)

    @app.post("/api/issues/{issue_id}/end")
    def end_issue(
        issue_id: str, user: User = Depends(authenticated), db: Session = Depends(db_dependency)
    ):
        item = owned(db, user, issue_id)
        item.ended_at = now()
        item.updated_at = now()
        conversation_ids = select(Conversation.id).where(Conversation.issue_id == item.id)
        db.execute(
            update(AIRequest)
            .where(AIRequest.conversation_id.in_(conversation_ids), AIRequest.status == "pending")
            .values(status="cancelled")
        )
        db.commit()
        return issue_view(db, item)

    @app.post("/api/issues/{issue_id}/resume")
    def resume_issue(
        issue_id: str, user: User = Depends(authenticated), db: Session = Depends(db_dependency)
    ):
        item = owned(db, user, issue_id)
        item.ended_at = None
        item.updated_at = now()
        db.commit()
        return issue_view(db, item)

    @app.post("/api/issues/{issue_id}/feedback", status_code=201)
    def add_feedback(
        issue_id: str,
        body: FeedbackInput,
        user: User = Depends(authenticated),
        db: Session = Depends(db_dependency),
    ):
        item = owned(db, user, issue_id)
        active(item)
        db.add(Feedback(issue_id=item.id, **body.model_dump()))
        item.updated_at = now()
        db.commit()
        return issue_view(db, item)

    @app.get("/api/issues/{issue_id}/messages")
    def messages(
        issue_id: str, user: User = Depends(authenticated), db: Session = Depends(db_dependency)
    ):
        owned(db, user, issue_id)
        rows = db.scalars(
            select(Message)
            .where(Message.issue_id == issue_id)
            .order_by(Message.created_at.desc())
            .limit(50)
        ).all()
        return [{"role": m.role, "content": m.content} for m in reversed(rows)]

    @app.get("/api/usage")
    def usage(user: User = Depends(authenticated), db: Session = Depends(db_dependency)):
        month, today = calendar()
        budget = db.get(Budget, month)
        calls = db.scalar(
            select(func.count())
            .select_from(AIRequest)
            .where(AIRequest.user_id == user.id, AIRequest.created_at >= today)
        )
        return {
            "month": month,
            "used_cny": (budget.used_micro if budget else 0) / 1_000_000,
            "limit_cny": float(settings.ai_monthly_budget_cny),
            "daily_calls": calls,
            "daily_limit": settings.daily_chat_limit,
            "mode": settings.ai_mode,
        }

    @app.post("/api/requests/{request_id}/cancel", status_code=204)
    def cancel(
        request_id: str, user: User = Depends(authenticated), db: Session = Depends(db_dependency)
    ):
        key = digest(f"{user.id}:{request_id}")
        db.execute(
            update(AIRequest)
            .where(AIRequest.id == key, AIRequest.user_id == user.id, AIRequest.status == "pending")
            .values(status="cancelled")
        )
        db.commit()
        return Response(status_code=204)

    @app.post("/api/issues/{issue_id}/chat")
    async def chat(
        issue_id: str,
        body: ChatInput,
        request: Request,
        user: User = Depends(authenticated),
        db: Session = Depends(db_dependency),
    ):
        return await run_chat(issue_id, body, request, user, db)

    async def run_chat(issue_id, body, request, user, db, conversation=None, progress=None):
        if progress is None and body.task == 'chat' and 'text/event-stream' in request.headers.get('accept', ''):
            if evaluation_guard is not None:
                # Frozen evaluations bind the exact non-streaming wire payload.
                # Changing transport requires a separately reviewed evaluation.
                raise HTTPException(409, {"code": "evaluation_parameters_changed"})
            user_id, conversation_id = user.id, conversation.id if conversation else None
            async def work(emit):
                # Own the session for the streaming lifetime, including cancellation.
                with sessions() as stream_db:
                    stream_user = stream_db.get(User, user_id)
                    if not stream_user:
                        raise HTTPException(401, '登录已失效')
                    stream_conversation = stream_db.get(Conversation, conversation_id) if conversation_id else None
                    if conversation_id and not stream_conversation:
                        raise HTTPException(404, '没有找到这段会话')
                    return await run_chat(issue_id, body, request, stream_user, stream_db, stream_conversation, emit)
            return stream_response(work)
        legacy = conversation is None
        # Serialize admission with consent/context edits, then refresh authenticated data.
        # A stale dependency read must never authorize a newly submitted provider call.
        locked = db.execute(
            update(User).where(User.id == user.id).values(use_memory=User.use_memory)
        )
        if locked.rowcount != 1:
            raise HTTPException(401, "登录已失效")
        db.refresh(user)
        item = owned(db, user, issue_id)
        db.refresh(item)
        active(item)
        if not conversation:
            legacy_conversation = db.get(Conversation, issue_id)
            if not legacy_conversation or legacy_conversation.archived_at:
                raise HTTPException(409, "原会话已删除或归档，请打开或新建一段会话")
            conversation = legacy_conversation
        if conversation:
            db.refresh(conversation)
            if conversation.archived_at:
                raise HTTPException(409, "这段会话已归档，请先恢复")
        if not user.ai_consent:
            raise HTTPException(403, "请先阅读并同意 AI 数据处理说明")
        user_id = user.id
        month, today = calendar()
        key = digest(f"{user_id}:{body.request_id}")
        if db.get(AIRequest, key):
            raise HTTPException(409, "这条请求已经处理过，请查看结果后再发送新消息")
        count = db.scalar(
            select(func.count())
            .select_from(AIRequest)
            .where(AIRequest.user_id == user_id, AIRequest.created_at >= today)
        )
        if count >= settings.daily_chat_limit:
            raise HTTPException(429, "今天的对话额度已用完，已保存的卡片仍可查看和修改")
        context = None
        history = None
        sources = None
        first_turn = False
        anchor = None
        if conversation:
            if db.scalar(
                select(AIRequest.id)
                .where(AIRequest.conversation_id == conversation.id, AIRequest.status == "pending")
                .limit(1)
            ):
                raise HTTPException(409, "这段会话有一条回复正在生成")
            anchor = edit_anchor(db, user, conversation, body)
            history, context, sources = context_for(db, user, conversation, body, anchor)
            first_turn = bool(context.get("first_turn"))
        # Per-turn web grounding: only when the user enabled it for this message
        # and a key is configured. A failed or absent search degrades to a
        # normal un-grounded turn; it never blocks the reply.
        web_results = None
        if body.web_search and body.task == "chat" and web_search.web_search_configured(settings):
            try:
                web_results = web_search.search_web(settings, body.message, web_search_transport)
            except web_search.WebSearchError:
                web_results = None
                sources_web_error = True
            else:
                sources_web_error = False
        else:
            sources_web_error = None
        request_theme = user.theme
        visual_candidates, visual_payload = [], None
        # Fixed evaluations retain their reviewed prompt contract.
        if (settings.visual_selection_enabled and body.task == "chat"
                and evaluation_guard is None
                and not visual_selection.should_omit_visuals(body.message)):
            try:
                visual_candidates, visual_payload = visual_selection.visual_context_for_chat(
                    user_theme=request_theme, message=body.message,
                    context=context, visible_visual_ids=body.visible_visual_ids,
                )
            except (OSError, KeyError, TypeError, ValueError):
                logging.getLogger("agency.ai").warning("visual_candidates_unavailable")
        prompt = ai.messages_for(
            item.card,
            issue_view(db, item)["feedback"][:5],
            body,
            user.support_style if legacy else conversation.support_style,
            item.life_contexts,
            item.concerns,
            current_issue={"title": item.title, "stage": item.stage},
            exploration=item.exploration,
            conversation_context=context,
            history=history,
            web_results=web_results,
            visual_selection=visual_payload,
            # Frozen Mock evaluations keep their reviewed prompt version.
            # Normal conversations use the explicitly versioned current style.
            reply_style='warm-v1' if evaluation_guard is None else None,
        )
        perspective = None
        if perspective_prototype is not None:
            perspective = perspective_prototype.prepare(db, user, conversation, body, history)
            prompt = perspective_prototype.augment(prompt, perspective)
        if sources is not None:
            supplied = json.loads(prompt[1]['content'].split('：', 1)[1])
            sources['recent_feedback'] = supplied['recent_feedback']
            strategy = supplied.get('psychology_strategy')
            sources['strategy'] = {k: strategy[k] for k in ('id', 'version')} if strategy else None
            if web_results is not None:
                sources['web_results'] = web_results
            if sources_web_error is not None:
                sources['web_search'] = 'failed' if sources_web_error else 'included'
        # Select once before reservation. Frozen evaluations and non-chat model
        # uses keep their reviewed configuration; no classifier model request.
        turn_settings = ai.settings_for_turn(settings, prompt) if evaluation_guard is None else settings
        reserved = ai.reservation_micro(turn_settings, prompt)
        if evaluation_guard is not None:
            try:
                reserved = evaluation_guard.reserve(
                    db, key, body, user_id, conversation.id if conversation else issue_id,
                    ai.provider_payload(settings, prompt), settings, ai_transport,
                )
            except GuardError as exc:
                db.rollback()
                with sessions.begin() as stopped:
                    evaluation_guard.stop(stopped, str(exc))
                raise HTTPException(409, {"code": str(exc)}) from None
        insert = sqlite_insert if sqlite else pg_insert
        db.execute(
            insert(Budget)
            .values(month=month, used_micro=0)
            .on_conflict_do_nothing(index_elements=["month"])
        )
        limit = int(settings.ai_monthly_budget_cny * Decimal(1_000_000))
        available = db.execute(
            update(Budget)
            .where(Budget.month == month, Budget.used_micro + reserved <= limit)
            .values(used_micro=Budget.used_micro + reserved)
        )
        if available.rowcount != 1:
            db.rollback()
            if evaluation_guard is not None:
                with sessions.begin() as stopped:
                    evaluation_guard.stop(stopped, "monthly_budget_exhausted")
            raise HTTPException(402, "本月 AI 服务额度已用完，卡片和反馈仍可继续使用")
        # Recheck while the monthly ledger row is locked, including across workers.
        count = db.scalar(
            select(func.count())
            .select_from(AIRequest)
            .where(AIRequest.user_id == user_id, AIRequest.created_at >= today)
        )
        if count >= settings.daily_chat_limit:
            db.rollback()
            raise HTTPException(429, "今天的对话额度已用完，卡片仍可继续使用")
        # The budget row lock also serializes admission of requests per conversation.
        if conversation and db.scalar(
            select(AIRequest.id)
            .where(AIRequest.conversation_id == conversation.id, AIRequest.status == "pending")
            .limit(1)
        ):
            db.rollback()
            raise HTTPException(409, "这段会话有一条回复正在生成")
        db.add(
            AIRequest(
                id=key,
                user_id=user_id,
                month=month,
                cost_micro=reserved,
                kind=body.task,
                conversation_id=conversation.id if conversation else issue_id,
            )
        )
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "这条请求已经提交，请勿重复发送") from None
        def dispatch_check(payload):
            with sessions.begin() as admitted:
                evaluation_guard.dispatch(admitted, key, payload, settings, ai_transport)

        task = asyncio.create_task(
            ai.generate_with_deadline(settings, prompt, ai_transport, dispatch_guard=dispatch_check, progress=progress)
            if evaluation_guard is not None else ai.generate_with_deadline(turn_settings, prompt, ai_transport, progress=progress)
        )
        try:
            while not task.done():
                await asyncio.wait([task], timeout=0.2)
                with sessions() as check:
                    cancelled = check.get(AIRequest, key).status != "pending"
                if cancelled or (progress is None and await request.is_disconnected()):
                    raise asyncio.CancelledError()
            generation = await task
            result, actual_cost = generation.output, generation.cost_micro
            # Only a manifest-approved candidate ID survives to response/storage.
            if body.task == "chat" and visual_payload:
                try:
                    manifest = visual_selection.load_manifest()
                    used_ids = body.visible_visual_ids
                    decision = visual_selection.validate_selection(
                        result.visual_id, visual_candidates, theme=request_theme,
                        used_visual_ids=used_ids,
                        used_source_groups=visual_selection.group_for_used(used_ids, manifest),
                        used_original_paths=visual_selection.original_paths_for_used(used_ids, manifest),
                        malformed=getattr(result, "_visual_selection_invalid", False),
                    )
                    result = result.model_copy(update={"visual_id": decision.visual_id})
                except (OSError, KeyError, TypeError, ValueError):
                    result = result.model_copy(update={"visual_id": None})
            else:
                result = result.model_copy(update={"visual_id": None})
            candidate = perspective_prototype.validate(result.perspective_shift, perspective) if perspective_prototype else None
            result = result.model_copy(update={"perspective_shift": candidate})
            saved_ids = {}
            with sessions.begin() as done:
                done.execute(
                    update(User).where(User.id == user_id).values(use_memory=User.use_memory)
                )
                record = done.get(AIRequest, key)
                live_user, live_issue = done.get(User, user_id), done.get(Issue, issue_id)
                live_conversation = (
                    done.get(Conversation, conversation.id if conversation else issue_id)
                )
                if (
                    record.status != "pending"
                    or not live_user
                    or not live_user.ai_consent
                    or not live_issue
                    or live_issue.ended_at
                    or not live_conversation
                    or live_conversation.archived_at
                ):
                    raise asyncio.CancelledError()
                if evaluation_guard is not None:
                    evaluation_guard.settle(done, key, generation)
                done.execute(
                    update(Budget)
                    .where(Budget.month == month)
                    .values(used_micro=Budget.used_micro - reserved + max(0, actual_cost))
                )
                record.cost_micro = max(0, actual_cost)
                record.usage = generation.usage
                transitioned = done.execute(
                    update(AIRequest)
                    .where(AIRequest.id == key, AIRequest.status == "pending")
                    .values(status="completed")
                )
                if transitioned.rowcount != 1:
                    raise asyncio.CancelledError()
                if live_conversation:
                    live_conversation.updated_at = now()
                    # The first completed chat turn can name a still-provisional
                    # conversation with the same provider response. A title the
                    # user already chose is never overwritten.
                    if (
                        body.task == "chat"
                        and first_turn
                        and result.conversation_title
                        and live_conversation.title
                        in {"", "新会话", "开始探索", body.message[:30]}
                    ):
                        live_conversation.title = result.conversation_title[:30]
                        live_conversation.version += 1

                if live_user.save_chat and body.task == "chat":
                    target_id = conversation.id if conversation else issue_id
                    if anchor is not None:
                        # Revalidate under the same user lock as context mutations.
                        live_anchor = edit_anchor(done, live_user, live_conversation, body)
                        done.execute(delete(Message).where(
                            Message.conversation_id == target_id,
                            ~before_message(live_anchor),
                        ))
                        live_conversation.summary = None
                        live_conversation.version += 1
                    user_message = Message(
                        **({"id": perspective.current_id} if perspective else {}),
                        issue_id=issue_id,
                        conversation_id=target_id,
                        role="user",
                        content=body.message,
                    )
                    done.add(user_message)
                    done.flush()
                    assistant_message = Message(
                        issue_id=issue_id,
                        conversation_id=target_id,
                        role="assistant",
                        content=result.reply,
                        payload={
                            "supplied_context": sources,
                            "suggestion": result.suggestion.model_dump()
                            if result.suggestion
                            else None,
                            "insight": result.insight.model_dump() if result.insight else None,
                            "request_id": str(body.request_id),
                            "visual_id": result.visual_id,
                            "reasoning_summary": [p.model_dump() for p in result.reasoning_summary] if result.reasoning_summary else None,
                        },
                    )
                    done.add(assistant_message)
                    done.flush()
                    saved_ids = {
                        "user_message_id": user_message.id,
                        "assistant_message_id": assistant_message.id,
                    }
            if perspective_prototype is not None:
                perspective_prototype.delivered(candidate, perspective)
            return (
                result.model_dump()
                | {
                    "mode": settings.ai_mode,
                    "perspective_token": perspective_fingerprint(candidate) if candidate else None,
                    "usage": generation.usage,
                    "reasoning_summary": [p.model_dump() for p in result.reasoning_summary] if result.reasoning_summary else None,
                }
                | ({"supplied_context": sources} if sources else {})
                | ({"web_sources": web_results} if web_results else {})
                | saved_ids
                | ({'speech_proof': speech.proof(user.id, conversation.id, key, result.reply)}
                   if body.task == 'chat' and conversation and not saved_ids else {})
            )
        except asyncio.CancelledError:
            logging.getLogger("agency.ai").info("generation_cancelled")
            task.cancel()
            with suppress(asyncio.CancelledError, Exception):
                await task
            with sessions.begin() as failed:
                if evaluation_guard is not None:
                    evaluation_guard.stop(failed, "provider_result_unknown")
                record = failed.get(AIRequest, key)
                if record:
                    record.status = "cancelled"
            raise HTTPException(409, "已停止本次回复，你输入的内容仍可继续编辑") from None
        except Exception as exc:
            kind = (
                "timeout"
                if isinstance(exc, httpx.TimeoutException)
                else "network"
                if isinstance(exc, httpx.RequestError)
                else "http"
                if isinstance(exc, httpx.HTTPStatusError)
                else "protocol"
            )
            status = exc.response.status_code if isinstance(exc, httpx.HTTPStatusError) else 0
            code = ai.failure_code(exc)
            fields = ','.join(exc.fields) if isinstance(exc, ai.ProviderOutputError) else ''
            # Do not log exception bodies, prompts, identifiers, URLs or credentials
            logging.getLogger("agency.ai").warning(
                "generation_failed kind=%s status=%s code=%s fields=%s", kind, status, code, fields
            )
            with sessions.begin() as failed:
                if evaluation_guard is not None:
                    evaluation_guard.stop(failed, "provider_result_unknown")
                record = failed.get(AIRequest, key)
                if record:
                    record.status = "failed"
            raise HTTPException(502, {"code": code}) from None

    @app.get("/api/requests/{request_id}")
    def request_status(
        request_id: str, user: User = Depends(authenticated), db: Session = Depends(db_dependency)
    ):
        record = db.get(AIRequest, digest(f"{user.id}:{request_id}"))
        if not record or record.user_id != user.id:
            raise HTTPException(404, "没有找到这条请求")
        return {
            "status": record.status,
            "conversation_id": record.conversation_id,
            "recoverable": bool(
                user.save_chat
                and record.conversation_id
                and record.kind == "chat"
                and record.status == "completed"
            ),
        }

    register_moment_routes(app, authenticated, db_dependency, sessions, settings, ai_transport,
                           evaluation=getattr(app.state, 'evaluation_sessions', None) is not None)
    register_discovery_routes(app, authenticated, db_dependency, owned, issue_view)
    register_journey_routes(app, authenticated, db_dependency, owned)
    register_routes(app, authenticated, db_dependency, owned, run_chat)
    speech.register(app, authenticated)
    return app


app = create_app()
