"""User-selected milestones; no summary generation, model calls or inferred history."""
import hashlib
from datetime import datetime
from typing import Literal

from fastapi import Depends, HTTPException, Query, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import ForeignKey, Integer, String, Text, delete, literal, select, union_all, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, Session, mapped_column

from .models import Base, Feedback, Issue, Message, User, now, uid
from .plan_continuity import lock_plan_owner, sync_plan_context

Kind = Literal["thought", "decision", "change", "action", "pause"]
LABELS = {"thought": "留下一个想法", "decision": "重新选择", "change": "想法变了",
          "action": "一次尝试", "pause": "选择暂停", "progress": "有了新进展",
          "stuck": "遇到一点阻碍", "start": "探索开始", "end": "暂告一段落"}


class JourneyRecord(Base):
    __tablename__ = "journey_records"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    issue_id: Mapped[str] = mapped_column(ForeignKey("issues.id", ondelete="CASCADE"), index=True)
    source_message_id: Mapped[str | None] = mapped_column(
        ForeignKey("messages.id", ondelete="SET NULL"), unique=True, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="confirmed")
    kind: Mapped[str] = mapped_column(String(16), default="thought")
    title: Mapped[str] = mapped_column(String(120), default="")
    text: Mapped[str] = mapped_column(Text, default="")
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[str] = mapped_column(String(40), default=now)


class WriteRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")
    issue_id: str = Field(min_length=1, max_length=36)
    kind: Kind = "thought"
    title: str = Field(min_length=1, max_length=120)
    text: str = Field(min_length=1, max_length=2000)
    source_message_id: str | None = Field(None, max_length=36)
    source_version: str | None = Field(None, max_length=64)
    request_id: str | None = Field(None, pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")

    @field_validator("title", "text")
    @classmethod
    def not_blank(cls, value):
        if not value.strip():
            raise ValueError("blank content")
        return value.strip()


class EditRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=120)
    text: str = Field(min_length=1, max_length=2000)
    version: str = Field(min_length=1, max_length=64)

    @field_validator("title", "text")
    @classmethod
    def not_blank(cls, value):
        return WriteRecord.not_blank(value)


class DirectionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: int = Field(ge=1)
    next_step: str = Field(max_length=600)


class DismissInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_version: str = Field(min_length=64, max_length=64)


def revision(value):
    return hashlib.sha256(value.encode()).hexdigest()


def candidate(message):
    payload = message.payload if isinstance(message.payload, dict) else {}
    insight = payload.get("insight")
    if not isinstance(insight, dict):
        return None
    observation, possibility = insight.get("observation"), insight.get("possibility")
    if not isinstance(observation, str) or not isinstance(possibility, str):
        return None
    if not observation.strip() or not possibility.strip():
        return None
    text = observation.strip() + "\n" + possibility.strip()
    return {"id": message.id, "issue_id": message.issue_id, "title": "一个值得留下的想法",
            "text": text[:2000], "uncertainty": str(insight.get("uncertainty") or "")[:600],
            "created_at": message.created_at, "source_version": revision(text)}


def register_journey_routes(app, authenticated, db_dependency, owned):
    def source(db, user, message_id, expected):
        message = db.scalar(select(Message).join(Issue, Issue.id == Message.issue_id).where(
            Message.id == message_id, Message.role == "assistant", Issue.user_id == user.id))
        value = candidate(message) if message and user.save_chat else None
        if value is None:
            raise HTTPException(404, "这条候选的来源已不可用")
        if value["source_version"] != expected:
            raise HTTPException(409, "来源已变化，请重新审阅")
        return message, value

    def record_view(row, issue):
        return {"id": "record:" + row.id, "issue_id": issue.id, "issue_title": issue.title,
                "kind": row.kind, "title": row.title, "text": row.text, "created_at": row.created_at,
                "version": str(row.version), "editable": True, "source_label": "你确认留下的记录",
                "source_available": bool(row.source_message_id)}

    def detail(db, user, event_id):
        prefix, _, key = event_id.partition(":")
        if prefix == "record":
            row = db.scalar(select(JourneyRecord).where(
                JourneyRecord.id == key, JourneyRecord.user_id == user.id,
                JourneyRecord.status == "confirmed"))
            if row:
                value = record_view(row, owned(db, user, row.issue_id))
                message = db.get(Message, row.source_message_id) if row.source_message_id else None
                value["source_text"] = ((candidate(message) or {}).get("text") or message.content) if message else ""
                return value
        if prefix == "feedback":
            row = db.scalar(select(Feedback).join(Issue).where(
                Feedback.id == key, Issue.user_id == user.id))
            if row:
                issue = owned(db, user, row.issue_id)
                return {"id": event_id, "issue_id": issue.id, "issue_title": issue.title,
                        "kind": row.kind, "title": LABELS.get(row.kind, "留下一次记录"),
                        "text": row.text, "created_at": row.created_at,
                        "version": revision(row.text), "editable": True,
                        "source_label": "你保存的探索反馈", "source_available": True,
                        "source_text": row.text}
        if prefix in ("start", "end"):
            issue = owned(db, user, key)
            if prefix == "end" and not issue.ended_at:
                raise HTTPException(404, "这条记录已不可用")
            initial = issue.exploration or {}
            text = ("你选择让这段探索暂告一段落" if prefix == "end" else
                    initial.get("initial_title") or "这一天，你在 Agency Bloom 保存了一段探索")
            return {"id": event_id, "issue_id": issue.id, "issue_title": issue.title,
                    "kind": prefix, "title": LABELS[prefix], "text": text,
                    "created_at": issue.created_at if prefix == "start" else issue.ended_at,
                    "editable": False, "source_label": "探索的保存记录", "source_available": True,
                    "source_text": text}
        raise HTTPException(404, "没有找到这条记录")

    @app.get("/api/journey/events")
    def events(user: User = Depends(authenticated), db: Session = Depends(db_dependency),
               issue_id: str | None = None, before: str | None = Query(None, max_length=160),
               limit: int = Query(30, ge=1, le=100)):
        if issue_id:
            owned(db, user, issue_id)
        issues = select(Issue.id).where(Issue.user_id == user.id)
        if issue_id:
            issues = issues.where(Issue.id == issue_id)
        starts = select((literal("start:") + Issue.id).label("id"),
                        Issue.created_at.label("at")).where(Issue.id.in_(issues))
        ends = select((literal("end:") + Issue.id).label("id"),
                      Issue.ended_at.label("at")).where(Issue.id.in_(issues), Issue.ended_at.is_not(None))
        feedback = select((literal("feedback:") + Feedback.id).label("id"),
                          Feedback.created_at.label("at")).where(Feedback.issue_id.in_(issues))
        records = select((literal("record:") + JourneyRecord.id).label("id"),
                         JourneyRecord.created_at.label("at")).where(
                             JourneyRecord.user_id == user.id, JourneyRecord.issue_id.in_(issues),
                             JourneyRecord.status == "confirmed")
        combined = union_all(starts, ends, feedback, records).subquery()
        query = select(combined)
        if before:
            at, sep, key = before.partition("|")
            try:
                datetime.fromisoformat(at)
                if not sep or not key:
                    raise ValueError()
            except ValueError as exc:
                raise HTTPException(422, "分页位置无效") from exc
            query = query.where((combined.c.at < at) |
                                ((combined.c.at == at) & (combined.c.id < key)))
        rows = db.execute(query.order_by(combined.c.at.desc(), combined.c.id.desc()).limit(limit + 1)).all()
        shown = rows[:limit]
        return {"items": [detail(db, user, row.id) for row in shown],
                "next_cursor": f"{shown[-1].at}|{shown[-1].id}" if len(rows) > limit else None}

    @app.get("/api/journey/candidates")
    def candidates(user: User = Depends(authenticated), db: Session = Depends(db_dependency),
                   issue_id: str | None = None, offset: int = Query(0, ge=0),
                   limit: int = Query(20, ge=1, le=50)):
        if issue_id:
            owned(db, user, issue_id)
        if not user.save_chat:
            return {"items": [], "next_offset": None}
        # Paginate examined messages as well as candidates: old chats are not scanned at startup.
        query = select(Message).join(Issue, Issue.id == Message.issue_id).where(
            Issue.user_id == user.id, Message.role == "assistant",
            ~Message.id.in_(select(JourneyRecord.source_message_id).where(
                JourneyRecord.source_message_id.is_not(None))))
        if issue_id:
            query = query.where(Message.issue_id == issue_id)
        rows = db.scalars(query.order_by(Message.created_at.desc(), Message.id.desc())
                          .offset(offset).limit(limit + 1)).all()
        return {"items": [value for row in rows[:limit] if (value := candidate(row))],
                "next_offset": offset + limit if len(rows) > limit else None}

    @app.post("/api/journey/records", status_code=201)
    def create(body: WriteRecord, user: User = Depends(authenticated), db: Session = Depends(db_dependency)):
        lock_plan_owner(db, user.id)
        issue = owned(db, user, body.issue_id)
        if body.request_id and (existing := db.get(JourneyRecord, body.request_id)):
            if (existing.user_id == user.id and existing.issue_id == issue.id and
                    existing.status == "confirmed" and existing.kind == body.kind and
                    existing.title == body.title and existing.text == body.text and
                    existing.source_message_id == body.source_message_id):
                return record_view(existing, issue)
            raise HTTPException(409, "这次保存已处理，请刷新后核对")
        if body.source_message_id:
            message, _ = source(db, user, body.source_message_id, body.source_version)
            if message.issue_id != issue.id:
                raise HTTPException(409, "候选不属于这段探索")
        row = JourneyRecord(id=body.request_id or uid(), user_id=user.id, issue_id=issue.id, kind=body.kind,
                            title=body.title, text=body.text, source_message_id=body.source_message_id)
        db.add(row)
        try:
            sync_plan_context(db, issue)
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(409, "这条候选已经处理，请刷新后查看") from exc
        return record_view(row, issue)

    @app.post("/api/journey/candidates/{message_id}/dismiss", status_code=204)
    def dismiss(message_id: str, body: DismissInput, user: User = Depends(authenticated),
                db: Session = Depends(db_dependency)):
        message, _ = source(db, user, message_id, body.source_version)
        db.add(JourneyRecord(user_id=user.id, issue_id=message.issue_id,
                             source_message_id=message.id, status="dismissed"))
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(409, "这条候选已经处理，请刷新后查看") from exc
        return Response(status_code=204)

    @app.get("/api/journey/events/{event_id}")
    def event_detail(event_id: str, user: User = Depends(authenticated), db: Session = Depends(db_dependency)):
        return detail(db, user, event_id)

    @app.put("/api/journey/events/{event_id}")
    def edit(event_id: str, body: EditRecord, user: User = Depends(authenticated),
             db: Session = Depends(db_dependency)):
        lock_plan_owner(db, user.id)
        value = detail(db, user, event_id)
        if not value["editable"]:
            raise HTTPException(409, "这条记录来自探索状态，不能在这里改写")
        prefix, _, key = event_id.partition(":")
        if prefix == "record":
            changed = db.execute(update(JourneyRecord).where(
                JourneyRecord.id == key, JourneyRecord.user_id == user.id,
                JourneyRecord.version == int(body.version) if body.version.isdigit() and len(body.version) <= 9 else literal(False)
            ).values(title=body.title, text=body.text, version=JourneyRecord.version + 1))
        else:
            if revision(value["text"]) != body.version:
                raise HTTPException(409, "记录已变化，请重新打开核对；你的文字仍保留")
            changed = db.execute(update(Feedback).where(
                Feedback.id == key, Feedback.text == value["text"]).values(text=body.text))
        if changed.rowcount != 1:
            db.rollback()
            raise HTTPException(409, "记录已变化，请重新打开核对；你的文字仍保留")
        sync_plan_context(db, owned(db, user, value['issue_id']))
        db.commit()
        return detail(db, user, event_id)

    @app.delete("/api/journey/events/{event_id}", status_code=204)
    def remove(event_id: str, version: str = Query(max_length=64),
               user: User = Depends(authenticated), db: Session = Depends(db_dependency)):
        lock_plan_owner(db, user.id)
        value = detail(db, user, event_id)
        if not value["editable"] or value["version"] != version:
            raise HTTPException(409, "记录已变化，或不能在这里删除")
        prefix, _, key = event_id.partition(":")
        if prefix == "record":
            # Keep a content-free dismissal marker, so a confirmed AI source is not re-offered.
            changed = db.execute(update(JourneyRecord).where(
                JourneyRecord.id == key, JourneyRecord.user_id == user.id,
                JourneyRecord.version == int(version)).values(
                    status="dismissed", title="", text="", version=JourneyRecord.version + 1))
        else:
            changed = db.execute(delete(Feedback).where(
                Feedback.id == key, Feedback.text == value["text"]))
        if changed.rowcount != 1:
            db.rollback()
            raise HTTPException(409, "记录已变化，请刷新")
        sync_plan_context(db, owned(db, user, value['issue_id']))
        db.commit()
        return Response(status_code=204)

    @app.put("/api/journey/directions/{issue_id}")
    def direction(issue_id: str, body: DirectionInput, user: User = Depends(authenticated),
                  db: Session = Depends(db_dependency)):
        from .plan import plan_from_card_edit

        lock_plan_owner(db, user.id)
        issue = owned(db, user, issue_id)
        if issue.ended_at:
            raise HTTPException(409, "这段探索已结束，请先恢复探索")
        next_step = body.next_step.strip()
        exploration = plan_from_card_edit(db, issue, next_step)
        changed = db.execute(update(Issue).where(
            Issue.id == issue.id, Issue.user_id == user.id, Issue.version == body.version,
            Issue.ended_at.is_(None)).values(
                card={**issue.card, "next_step": next_step}, exploration=exploration,
                version=Issue.version + 1, updated_at=now()))
        if changed.rowcount != 1:
            db.rollback()
            raise HTTPException(409, "决策卡已变化，请重新打开核对；你的文字仍保留")
        sync_plan_context(db, issue)
        db.commit()
        return {"next_step": next_step, "version": body.version + 1}
