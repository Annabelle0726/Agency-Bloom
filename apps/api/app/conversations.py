"""Owned conversations and explicit, revocable context. No autonomous model calls."""

from fastapi import Depends, HTTPException, Query, Request, Response
from sqlalchemy import and_, delete, func, or_, select, update
from sqlalchemy.orm import Session

from .models import AIRequest, Conversation, ConversationLink, Issue, Memory, Message, User, now
from .schemas import (
    ConversationChatInput,
    ConversationInput,
    ConversationUpdate,
    MemoryInput,
    MemoryMerge,
    MemoryUpdate,
    SummaryUpdate,
)


def owned_conversation(db, user, conversation_id):
    item = db.scalar(
        select(Conversation).where(
            Conversation.id == conversation_id, Conversation.user_id == user.id
        )
    )
    if item is None:
        raise HTTPException(404, "没有找到这段会话")
    return item


def conversation_view(db, item):
    return {
        key: getattr(item, key)
        for key in (
            "id",
            "issue_id",
            "title",
            "support_style",
            "summary",
            "version",
            "created_at",
            "updated_at",
            "archived_at",
        )
    } | {
        "linked_issue_ids": list(
            db.scalars(
                select(ConversationLink.issue_id).where(ConversationLink.conversation_id == item.id)
            )
        )
    }


def memory_view(item):
    return {
        key: getattr(item, key)
        for key in (
            "id",
            "content",
            "category",
            "issue_id",
            "source_conversation_id",
            "enabled",
            "version",
            "created_at",
            "updated_at",
        )
    }


def cancel_pending(db, user_id, conversation_id=None):
    query = update(AIRequest).where(AIRequest.user_id == user_id, AIRequest.status == "pending")
    if conversation_id:
        query = query.where(AIRequest.conversation_id == conversation_id)
    db.execute(query.values(status="cancelled"))


def context_for(db, user, conversation, body):
    """Only this conversation's transcript and explicitly selected context reach AI.

    Returns (history, model_context, supplied_sources). supplied_sources is a
    factual inventory of what was handed to the model, never a claim about
    what the model actually used.
    """
    limit = 80 if body.task == "summary" else 8
    if user.save_chat:
        rows = db.scalars(
            select(Message)
            .where(Message.conversation_id == conversation.id)
            .order_by(Message.created_at.desc(), Message.id.desc())
            .limit(limit)
        ).all()
        history = [{"role": row.role, "content": row.content} for row in reversed(rows)]
        summary = conversation.summary
    else:
        history = [m.model_dump() for m in body.history[-limit:]]
        summary = body.session_summary.model_dump() if body.session_summary else None
    links = list(
        db.scalars(
            select(ConversationLink.issue_id).where(
                ConversationLink.conversation_id == conversation.id
            )
        )
    )
    related = db.scalars(select(Issue).where(Issue.id.in_(links), Issue.user_id == user.id)).all()
    scope_ids = [conversation.issue_id, *links]
    memories = []
    if user.use_memory:
        memories = [
            memory_view(m)
            for m in db.scalars(
                select(Memory)
                .where(
                    Memory.user_id == user.id,
                    Memory.enabled.is_(True),
                    or_(Memory.issue_id.is_(None), Memory.issue_id.in_(scope_ids)),
                )
                .order_by(Memory.updated_at.desc(), Memory.id)
                .limit(40)
            )
        ]
    model_context = {
        "reviewed_conversation_summary": summary,
        "confirmed_memories": [
            {
                "id": m["id"],
                "content": m["content"],
                "category": m["category"],
                "issue_id": m["issue_id"],
            }
            for m in memories
        ],
        "explicitly_linked_explorations": [
            {"id": i.id, "title": i.title, "card": i.card} for i in related
        ],
        "summary_scope": "已审阅总结及最近最多80条消息" if body.task == "summary" else None,
    }
    sources = {
        "memories": [
            {"id": m["id"], "content": m["content"], "category": m["category"]}
            for m in memories
        ],
        "summary": bool(summary),
        "history_count": len(history),
        "history_retained": user.save_chat,
        "linked_explorations": [{"id": i.id, "title": i.title} for i in related],
    }
    return history, model_context, sources


def register_routes(app, authenticated, db_dependency, owned_issue, run_chat):
    def memory_owned(db, user, memory_id):
        item = db.scalar(select(Memory).where(Memory.id == memory_id, Memory.user_id == user.id))
        if item is None:
            raise HTTPException(404, "没有找到这条记忆")
        return item

    def validate_memory(db, user, body):
        if body.issue_id:
            owned_issue(db, user, body.issue_id)
        if body.source_conversation_id:
            owned_conversation(db, user, body.source_conversation_id)

    def lock_user(db, user):
        # Serialize memory mutations (including count/merge) across workers.
        db.execute(update(User).where(User.id == user.id).values(use_memory=User.use_memory))

    @app.get("/api/conversations")
    def list_conversations(
        user: User = Depends(authenticated),
        db: Session = Depends(db_dependency),
        issue_id: str | None = None,
        archived: bool = False,
        offset: int = Query(0, ge=0),
        limit: int = Query(50, ge=1, le=100),
    ):
        query = select(Conversation).where(Conversation.user_id == user.id)
        query = query.where(
            Conversation.archived_at.is_not(None)
            if archived
            else Conversation.archived_at.is_(None)
        )
        if issue_id:
            owned_issue(db, user, issue_id)
            query = query.where(Conversation.issue_id == issue_id)
        return [
            conversation_view(db, c)
            for c in db.scalars(
                query.order_by(Conversation.updated_at.desc(), Conversation.id)
                .offset(offset)
                .limit(limit)
            )
        ]

    @app.post("/api/conversations", status_code=201)
    def create_conversation(
        body: ConversationInput,
        user: User = Depends(authenticated),
        db: Session = Depends(db_dependency),
    ):
        issue = owned_issue(db, user, body.issue_id)
        if issue.ended_at:
            raise HTTPException(409, "请先恢复这个探索")
        item = Conversation(user_id=user.id, **body.model_dump())
        db.add(item)
        db.commit()
        return conversation_view(db, item)

    @app.get("/api/conversations/{conversation_id}")
    def get_conversation(
        conversation_id: str,
        user: User = Depends(authenticated),
        db: Session = Depends(db_dependency),
    ):
        return conversation_view(db, owned_conversation(db, user, conversation_id))

    @app.delete("/api/conversations/{conversation_id}", status_code=204)
    def delete_conversation(
        conversation_id: str,
        version: int = Query(ge=1),
        user: User = Depends(authenticated),
        db: Session = Depends(db_dependency),
    ):
        lock_user(db, user)
        item = owned_conversation(db, user, conversation_id)
        if item.version != version:
            raise HTTPException(409, "会话已更新，请重新打开后核对")
        cancel_pending(db, user.id, item.id)
        # FK cascades remove messages/links; independently confirmed memories and
        # usage-only billing records survive with their source reference cleared.
        db.delete(item)
        db.commit()
        return Response(status_code=204)

    @app.put("/api/conversations/{conversation_id}")
    def change_conversation(
        conversation_id: str,
        body: ConversationUpdate,
        user: User = Depends(authenticated),
        db: Session = Depends(db_dependency),
    ):
        lock_user(db, user)
        item = owned_conversation(db, user, conversation_id)
        values = body.model_dump(
            exclude={"version", "archived", "linked_issue_ids"}, exclude_none=True
        )
        if body.archived is not None:
            if not body.archived and owned_issue(db, user, item.issue_id).ended_at:
                raise HTTPException(409, "请先恢复所属探索，再继续会话")
            values["archived_at"] = now() if body.archived else None
        if body.linked_issue_ids is not None:
            for linked in body.linked_issue_ids:
                owned_issue(db, user, linked)
        changed = db.execute(
            update(Conversation)
            .where(Conversation.id == item.id, Conversation.version == body.version)
            .values(**values, version=Conversation.version + 1, updated_at=now())
        )
        if changed.rowcount != 1:
            raise HTTPException(409, "会话已更新，请重新打开；你的输入仍可保留")
        if body.linked_issue_ids is not None:
            db.execute(delete(ConversationLink).where(ConversationLink.conversation_id == item.id))
            for linked in set(body.linked_issue_ids) - {item.issue_id}:
                db.add(ConversationLink(conversation_id=item.id, issue_id=linked))
        cancel_pending(db, user.id, item.id)
        db.commit()
        db.refresh(item)
        return conversation_view(db, item)

    @app.put("/api/conversations/{conversation_id}/summary")
    def save_summary(
        conversation_id: str,
        body: SummaryUpdate,
        user: User = Depends(authenticated),
        db: Session = Depends(db_dependency),
    ):
        lock_user(db, user)
        db.refresh(user)
        item = owned_conversation(db, user, conversation_id)
        if not user.save_chat:
            raise HTTPException(403, "未开启聊天保存，总结只能留在本次使用中")
        changed = db.execute(
            update(Conversation)
            .where(Conversation.id == item.id, Conversation.version == body.version)
            .values(
                summary=body.summary.model_dump() if body.summary else None,
                version=Conversation.version + 1,
                updated_at=now(),
            )
        )
        if changed.rowcount != 1:
            raise HTTPException(409, "总结已在别处更新，请重新打开后核对")
        cancel_pending(db, user.id, item.id)
        db.commit()
        db.refresh(item)
        return conversation_view(db, item)

    @app.get("/api/conversations/{conversation_id}/messages")
    def conversation_messages(
        conversation_id: str,
        user: User = Depends(authenticated),
        db: Session = Depends(db_dependency),
        before: str | None = None,
        limit: int = Query(50, ge=1, le=100),
    ):
        owned_conversation(db, user, conversation_id)
        query = select(Message).where(Message.conversation_id == conversation_id)
        if before:
            anchor = db.scalar(query.where(Message.id == before))
            if anchor is None:
                raise HTTPException(404, "没有找到这条消息")
            query = query.where(
                or_(
                    Message.created_at < anchor.created_at,
                    and_(Message.created_at == anchor.created_at, Message.id < anchor.id),
                )
            )
        rows = db.scalars(
            query.order_by(Message.created_at.desc(), Message.id.desc()).limit(limit + 1)
        ).all()
        more = len(rows) > limit
        rows = rows[:limit]
        return {
            "items": [
                {
                    "id": m.id,
                    "role": m.role,
                    "content": m.content,
                    "created_at": m.created_at,
                    "payload": m.payload,
                }
                for m in reversed(rows)
            ],
            "next_cursor": rows[-1].id if more else None,
        }

    @app.post("/api/conversations/{conversation_id}/chat")
    async def chat(
        conversation_id: str,
        body: ConversationChatInput,
        request: Request,
        user: User = Depends(authenticated),
        db: Session = Depends(db_dependency),
    ):
        conversation = owned_conversation(db, user, conversation_id)
        if conversation.archived_at:
            raise HTTPException(409, "这段会话已归档，请先恢复")
        return await run_chat(conversation.issue_id, body, request, user, db, conversation)

    @app.get("/api/memories")
    def list_memories(user: User = Depends(authenticated), db: Session = Depends(db_dependency)):
        return [
            memory_view(m)
            for m in db.scalars(
                select(Memory)
                .where(Memory.user_id == user.id)
                .order_by(Memory.updated_at.desc(), Memory.id)
            )
        ]

    @app.post("/api/memories", status_code=201)
    def create_memory(
        body: MemoryInput, user: User = Depends(authenticated), db: Session = Depends(db_dependency)
    ):
        lock_user(db, user)
        validate_memory(db, user, body)
        count = db.scalar(select(func.count()).select_from(Memory).where(Memory.user_id == user.id))
        if count >= 40:
            raise HTTPException(409, "记忆已达40条，请先整理或删除不再需要的内容")
        item = Memory(user_id=user.id, **body.model_dump(exclude={"confirmed"}))
        db.add(item)
        cancel_pending(db, user.id)
        db.commit()
        return memory_view(item)

    @app.put("/api/memories/{memory_id}")
    def change_memory(
        memory_id: str,
        body: MemoryUpdate,
        user: User = Depends(authenticated),
        db: Session = Depends(db_dependency),
    ):
        lock_user(db, user)
        item = memory_owned(db, user, memory_id)
        validate_memory(db, user, body)
        changed = db.execute(
            update(Memory)
            .where(Memory.id == item.id, Memory.version == body.version)
            .values(
                **body.model_dump(exclude={"confirmed", "version"}),
                version=Memory.version + 1,
                updated_at=now(),
            )
        )
        if changed.rowcount != 1:
            raise HTTPException(409, "记忆已更新，请重新读取后核对")
        cancel_pending(db, user.id)
        db.commit()
        db.refresh(item)
        return memory_view(item)

    @app.delete("/api/memories/{memory_id}", status_code=204)
    def forget_memory(
        memory_id: str,
        version: int = Query(ge=1),
        user: User = Depends(authenticated),
        db: Session = Depends(db_dependency),
    ):
        lock_user(db, user)
        item = memory_owned(db, user, memory_id)
        if item.version != version:
            raise HTTPException(409, "记忆已更新，请重新读取后核对")
        db.delete(item)
        cancel_pending(db, user.id)
        db.commit()
        return Response(status_code=204)

    @app.post("/api/memories/merge")
    def merge_memories(
        body: MemoryMerge, user: User = Depends(authenticated), db: Session = Depends(db_dependency)
    ):
        lock_user(db, user)
        validate_memory(db, user, body)
        if len({ref.id for ref in body.items}) != len(body.items):
            raise HTTPException(422, "请选择不同的记忆")
        rows = [memory_owned(db, user, ref.id) for ref in body.items]
        if any(row.version != ref.version for row, ref in zip(rows, body.items)):
            raise HTTPException(409, "部分记忆已更新，请重新整理")
        # Scope expansion must be explicit in the replacement; no inferred facts.
        for row in rows:
            db.delete(row)
        item = Memory(user_id=user.id, **body.model_dump(exclude={"confirmed", "items"}))
        db.add(item)
        cancel_pending(db, user.id)
        db.commit()
        return memory_view(item)
