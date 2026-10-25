"""Unsent composer text, never part of model context or conversation recency."""

from uuid import UUID

from fastapi import Depends, HTTPException
from pydantic import Field
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from .conversations import owned_conversation
from .models import ChatDraft, User, now
from .schemas import StrictModel


class DraftUpdate(StrictModel):
    version: int = Field(ge=0)
    content: str = Field(max_length=2000)
    issue_id: UUID | None = None


def draft_view(item):
    return {key: getattr(item, key) for key in ('key', 'content', 'issue_id', 'version', 'updated_at')}


def register_draft_routes(app, authenticated, db_dependency, owned_issue):
    @app.get('/api/chat-drafts')
    def list_drafts(user: User = Depends(authenticated), db: Session = Depends(db_dependency)):
        if not user.save_chat:
            return []
        return [draft_view(item) for item in db.scalars(select(ChatDraft).where(
            ChatDraft.user_id == user.id).order_by(ChatDraft.updated_at, ChatDraft.key))]

    @app.put('/api/chat-drafts/{key}')
    def save_draft(key: str, body: DraftUpdate, user: User = Depends(authenticated),
                   db: Session = Depends(db_dependency)):
        shell = key.startswith('draft:')
        try:
            if str(UUID(key[6:] if shell else key)) != (key[6:] if shell else key):
                raise ValueError()
        except ValueError:
            raise HTTPException(422, '草稿标识无效') from None
        # Same user lock as privacy updates: an in-flight write cannot revive a purge.
        db.execute(update(User).where(User.id == user.id).values(use_memory=User.use_memory))
        db.refresh(user)
        if not user.save_chat:
            raise HTTPException(409, '聊天保存已关闭，草稿仅保留在本次会话')
        issue_id = str(body.issue_id) if body.issue_id else None
        if shell:
            if issue_id:
                owned_issue(db, user, issue_id)
        else:
            conversation = owned_conversation(db, user, key)
            if issue_id and issue_id != conversation.issue_id:
                raise HTTPException(409, '草稿所属探索已变化')
            issue_id = conversation.issue_id
        item = db.get(ChatDraft, (user.id, key))
        if (item.version if item else 0) != body.version:
            raise HTTPException(409, '草稿已在别处更新，当前输入仍保留')
        if item is None:
            item = ChatDraft(user_id=user.id, key=key, conversation_id=None if shell else key)
            db.add(item)
        item.issue_id = issue_id
        item.content = body.content
        item.version = body.version + 1
        item.updated_at = now()
        db.commit()
        return draft_view(item)
