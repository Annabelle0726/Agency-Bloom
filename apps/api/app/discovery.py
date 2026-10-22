"""Atomic, idempotent first-send promotion. No recommendation model calls."""
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException
from pydantic import StringConstraints
from sqlalchemy import update
from sqlalchemy.orm import Session

from .conversations import conversation_view
from .models import Conversation, Issue, User
from .schemas import Card, StrictModel, SupportStyle


class DiscoveryConversationInput(StrictModel):
    request_id: UUID
    issue_id: UUID | None = None
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    support_style: SupportStyle = "discover"


def register_discovery_routes(app, authenticated, db_dependency, owned, issue_view):
    @app.post("/api/discovery/conversations", status_code=201)
    def promote(body: DiscoveryConversationInput, user: User = Depends(authenticated),
                db: Session = Depends(db_dependency)):
        # Serialize first-send promotion per account across workers, on both DBs.
        db.execute(update(User).where(User.id == user.id).values(use_memory=User.use_memory))
        key = str(body.request_id)
        existing = db.get(Conversation, key)
        if existing:
            expected_issue = str(body.issue_id) if body.issue_id else key
            if existing.user_id != user.id or existing.issue_id != expected_issue:
                raise HTTPException(409, "请重新打开一段会话")
            issue = owned(db, user, existing.issue_id)
            if issue.ended_at or existing.archived_at:
                raise HTTPException(409, "请先恢复这段探索或会话")
            return {"conversation": conversation_view(db, existing), "issue": issue_view(db, issue)}
        if body.issue_id:
            issue = owned(db, user, str(body.issue_id))
            if issue.ended_at:
                raise HTTPException(409, "请先恢复这段探索")
        else:
            if db.get(Issue, key):
                raise HTTPException(409, "请重新打开一段会话")
            # The UI explicitly states that first send saves a new exploration.
            # Persist only the user-editable title; no inferred facts or history.
            issue = Issue(id=key, user_id=user.id, title=body.title,
                          card=Card(title=body.title).model_dump(),
                          exploration={"initial_title": body.title, "card_reviewed_at": None})
            db.add(issue)
            db.flush()
        item = Conversation(id=key, user_id=user.id, issue_id=issue.id,
                            title=body.title, support_style=body.support_style)
        db.add(item)
        db.commit()
        return {"conversation": conversation_view(db, item), "issue": issue_view(db, issue)}
