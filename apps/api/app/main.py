import asyncio
import hashlib
import logging
import secrets
from contextlib import asynccontextmanager, suppress
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import create_engine, delete, event, func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from . import ai
from .config import Settings
from .local_schema import upgrade_local
from .models import (
    AIRequest,
    AuthSession,
    Base,
    Budget,
    Consent,
    Feedback,
    Issue,
    Message,
    User,
    now,
)
from .schemas import (
    Card,
    CardUpdate,
    ChatInput,
    FeedbackInput,
    IssueInput,
    Login,
    Preferences,
    WechatLogin,
)


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


def create_app(ai_transport=None, wechat_transport=None, **overrides):
    settings = Settings(**overrides)
    sqlite = settings.database_url.startswith("sqlite")
    args = {"check_same_thread": False, "timeout": 30} if sqlite else {"prepare_threshold": None}
    engine = create_engine(settings.database_url, connect_args=args, pool_pre_ping=True)
    if sqlite:

        @event.listens_for(engine, "connect")
        def foreign_keys(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")

    sessions = sessionmaker(engine, expire_on_commit=False)

    @asynccontextmanager
    async def lifespan(app):
        if settings.environment == "development" and sqlite:
            Base.metadata.create_all(engine)
            upgrade_local(engine)
        yield
        engine.dispose()

    app = FastAPI(
        title="Agency OS API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.environment == "development" else None,
        redoc_url=None,
    )
    app.state.settings = settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type"],
    )

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

    def sign_in(db, user):
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
        db.commit()
        return {"token": raw, "user": user_view(user)}

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.get("/api/config")
    def public_config():
        return {
            "dev_auth": settings.allow_dev_auth and settings.environment == "development",
            "ai_mode": settings.ai_mode,
            "privacy_version": "2026-10-16",
        }

    @app.post("/api/auth/dev")
    def dev_login(body: Login, db: Session = Depends(db_dependency)):
        if not settings.allow_dev_auth or settings.environment != "development":
            raise HTTPException(404)
        return sign_in(db, User())

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
        if values.get("save_chat") is False:
            ids = select(Issue.id).where(Issue.user_id == user.id)
            db.execute(delete(Message).where(Message.issue_id.in_(ids)))
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
        item = db.scalar(select(Issue).where(Issue.user_id == user.id, Issue.ended_at.is_(None)))
        return issue_view(db, item) if item else None

    @app.get("/api/issues")
    def issue_list(user: User = Depends(authenticated), db: Session = Depends(db_dependency)):
        return [
            issue_view(db, row)
            for row in db.scalars(
                select(Issue)
                .where(Issue.user_id == user.id)
                .order_by(Issue.created_at.desc())
                .limit(50)
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
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "你已经有一个正在跟进的问题，先回到它或将它结束") from None
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
        item = owned(db, user, issue_id)
        active(item)
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
        prompt = ai.messages_for(
            item.card,
            issue_view(db, item)["feedback"][:5],
            body,
            user.support_style,
            item.life_contexts,
            item.concerns,
            current_issue={"title": item.title, "stage": item.stage},
            exploration=item.exploration,
        )
        reserved = ai.reservation_micro(settings, prompt)
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
        db.add(AIRequest(id=key, user_id=user_id, month=month, cost_micro=reserved))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "这条请求已经提交，请勿重复发送") from None
        task = asyncio.create_task(ai.generate(settings, prompt, ai_transport))
        try:
            while not task.done():
                await asyncio.wait([task], timeout=0.2)
                with sessions() as check:
                    cancelled = check.get(AIRequest, key).status != "pending"
                if cancelled or await request.is_disconnected():
                    raise asyncio.CancelledError()
            generation = await task
            result, actual_cost = generation.output, generation.cost_micro
            with sessions.begin() as done:
                record = done.get(AIRequest, key)
                live_user, live_issue = done.get(User, user_id), done.get(Issue, issue_id)
                if (
                    record.status != "pending"
                    or not live_user
                    or not live_user.ai_consent
                    or not live_issue
                    or live_issue.ended_at
                ):
                    raise asyncio.CancelledError()
                done.execute(
                    update(Budget)
                    .where(Budget.month == month)
                    .values(used_micro=Budget.used_micro - reserved + max(0, actual_cost))
                )
                record.cost_micro = max(0, actual_cost)
                record.usage = generation.usage
                record.status = "completed"
                if live_user.save_chat:
                    done.add(Message(issue_id=issue_id, role="user", content=body.message))
                    done.add(Message(issue_id=issue_id, role="assistant", content=result.reply))
            return result.model_dump() | {"mode": settings.ai_mode, "usage": generation.usage}
        except asyncio.CancelledError:
            logging.getLogger("agency.ai").info("generation_cancelled")
            task.cancel()
            with suppress(asyncio.CancelledError, Exception):
                await task
            with sessions.begin() as failed:
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
            # Do not log exception bodies, prompts, identifiers, URLs or credentials
            logging.getLogger("agency.ai").warning(
                "generation_failed kind=%s status=%s", kind, status
            )
            with sessions.begin() as failed:
                record = failed.get(AIRequest, key)
                if record:
                    record.status = "failed"
            raise HTTPException(502, "这次回复没有完成，你的输入还在，稍后可手动重试") from None

    return app


app = create_app()
