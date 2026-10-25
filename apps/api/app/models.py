from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String, Text
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
    save_chat: Mapped[bool] = mapped_column(Boolean, default=True)
    ai_consent: Mapped[bool] = mapped_column(Boolean, default=False)
    theme: Mapped[str] = mapped_column(String(16), default="light")
    support_style: Mapped[str] = mapped_column(String(20), default="clarify")
    use_memory: Mapped[bool] = mapped_column(Boolean, default=False)
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
    exploration: Mapped[dict] = mapped_column(JSON, default=dict)
    stage: Mapped[str] = mapped_column(String(32), default="unsure")
    background: Mapped[str] = mapped_column(Text, default="")
    card: Mapped[dict] = mapped_column(JSON)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[str] = mapped_column(String(40), default=now)
    updated_at: Mapped[str] = mapped_column(String(40), default=now)
    ended_at: Mapped[str | None] = mapped_column(String(40), nullable=True)


class Conversation(Base):
    __tablename__ = "conversations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    issue_id: Mapped[str] = mapped_column(ForeignKey("issues.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(120), default="新会话")
    support_style: Mapped[str] = mapped_column(String(20), default="discover")
    summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    dismissed_change_ids: Mapped[list] = mapped_column(JSON, default=list)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[str] = mapped_column(String(40), default=now)
    updated_at: Mapped[str] = mapped_column(String(40), default=now)
    archived_at: Mapped[str | None] = mapped_column(String(40), nullable=True)

    # Presentation metadata only: pinning never changes AI context or recency.
    pinned_at: Mapped[str | None] = mapped_column(String(40), nullable=True)


class ChatDraft(Base):
    __tablename__ = "chat_drafts"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    conversation_id: Mapped[str | None] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), nullable=True, index=True)
    issue_id: Mapped[str | None] = mapped_column(
        ForeignKey("issues.id", ondelete="CASCADE"), nullable=True)
    content: Mapped[str] = mapped_column(Text, default="")
    version: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[str] = mapped_column(String(40), default=now)


class ConversationLink(Base):
    __tablename__ = "conversation_links"
    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), primary_key=True
    )
    issue_id: Mapped[str] = mapped_column(
        ForeignKey("issues.id", ondelete="CASCADE"), primary_key=True
    )


class Memory(Base):
    __tablename__ = "memories"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    issue_id: Mapped[str | None] = mapped_column(
        ForeignKey("issues.id", ondelete="CASCADE"), nullable=True
    )
    source_conversation_id: Mapped[str | None] = mapped_column(
        ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True
    )
    content: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(20), default="fact")
    horizon: Mapped[str] = mapped_column(String(20), default="long_term")
    status: Mapped[str] = mapped_column(String(20), default="active")
    source: Mapped[str] = mapped_column(String(30), default="user_confirmed")
    confirmed_at: Mapped[str | None] = mapped_column(String(40), default=now, nullable=True)
    last_verified_at: Mapped[str | None] = mapped_column(String(40), default=now, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[str] = mapped_column(String(40), default=now)
    updated_at: Mapped[str] = mapped_column(String(40), default=now)


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
    conversation_id: Mapped[str | None] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True, nullable=True
    )
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    role: Mapped[str] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String(40), default=now)


class Budget(Base):
    __tablename__ = "budgets"
    month: Mapped[str] = mapped_column(String(7), primary_key=True)
    used_micro: Mapped[int] = mapped_column(Integer, default=0)


class SpeechAudio(Base):
    __tablename__ = 'speech_audio'
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    conversation_id: Mapped[str] = mapped_column(ForeignKey('conversations.id', ondelete='CASCADE'), index=True)
    message_id: Mapped[str | None] = mapped_column(ForeignKey('messages.id', ondelete='CASCADE'), nullable=True)
    source: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(16), default='pending')
    audio: Mapped[list | None] = mapped_column(JSON, nullable=True)
    expires_at: Mapped[str] = mapped_column(String(40), index=True)


class SpeechUsage(Base):
    __tablename__ = 'speech_usage'
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    day: Mapped[str] = mapped_column(String(10))
    characters: Mapped[int] = mapped_column(Integer, default=0)
    requests: Mapped[int] = mapped_column(Integer, default=0)


class AIRequest(Base):
    __tablename__ = "ai_requests"
    # Key is derived from user ID and client request ID; stores no conversation text.
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True
    )
    conversation_id: Mapped[str | None] = mapped_column(
        ForeignKey("conversations.id", ondelete="SET NULL"), nullable=True, index=True
    )
    month: Mapped[str] = mapped_column(String(7))
    cost_micro: Mapped[int] = mapped_column(Integer)
    # Usage/pricing metadata only; no prompt, response text, key or private context.
    usage: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    kind: Mapped[str] = mapped_column(String(16), default="chat")
    created_at: Mapped[str] = mapped_column(String(40), default=now)
