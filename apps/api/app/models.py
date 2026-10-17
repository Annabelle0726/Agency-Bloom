from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import JSON, Boolean, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def uid():
    return str(uuid4())


def now():
    return datetime.now(timezone.utc).isoformat()


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    wechat_id: Mapped[str | None] = mapped_column(String(128), unique=True, nullable=True)
    save_chat: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_consent: Mapped[bool] = mapped_column(Boolean, default=False)
    theme: Mapped[str] = mapped_column(String(16), default="light")
    support_style: Mapped[str] = mapped_column(String(20), default="clarify")
    created_at: Mapped[str] = mapped_column(String(40), default=now)


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[str] = mapped_column(String(40))


class Consent(Base):
    __tablename__ = "consents"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    accepted: Mapped[bool] = mapped_column(Boolean)
    policy_version: Mapped[str] = mapped_column(String(20))
    created_at: Mapped[str] = mapped_column(String(40), default=now)


class Issue(Base):
    __tablename__ = "issues"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(120))
    concerns: Mapped[list] = mapped_column(JSON, default=list)
    life_contexts: Mapped[list] = mapped_column(JSON, default=list)
    stage: Mapped[str] = mapped_column(String(32), default="unsure")
    background: Mapped[str] = mapped_column(Text, default="")
    card: Mapped[dict] = mapped_column(JSON)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[str] = mapped_column(String(40), default=now)
    updated_at: Mapped[str] = mapped_column(String(40), default=now)
    ended_at: Mapped[str | None] = mapped_column(String(40), nullable=True)
    __table_args__ = (
        Index(
            "one_active_issue_per_user",
            "user_id",
            unique=True,
            sqlite_where=text("ended_at IS NULL"),
            postgresql_where=text("ended_at IS NULL"),
        ),
    )


class Feedback(Base):
    __tablename__ = "feedback"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    issue_id: Mapped[str] = mapped_column(ForeignKey("issues.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(16))
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String(40), default=now)


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    issue_id: Mapped[str] = mapped_column(ForeignKey("issues.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String(40), default=now)


class Budget(Base):
    __tablename__ = "budgets"
    month: Mapped[str] = mapped_column(String(7), primary_key=True)
    used_micro: Mapped[int] = mapped_column(Integer, default=0)


class AIRequest(Base):
    __tablename__ = "ai_requests"
    # Key is derived from user ID and client request ID; stores no conversation text.
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True
    )
    month: Mapped[str] = mapped_column(String(7))
    cost_micro: Mapped[int] = mapped_column(Integer)
    # Usage/pricing metadata only; no prompt, response text, key or private context.
    usage: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[str] = mapped_column(String(40), default=now)
