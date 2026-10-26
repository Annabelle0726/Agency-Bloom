"""Account-owned questionnaire drafts; never conversation/model context."""
import json
from typing import Annotated, Literal

from fastapi import Depends, HTTPException
from pydantic import Field, StringConstraints, model_validator
from sqlalchemy import update
from sqlalchemy.orm import Session

from .models import OnboardingProgress, User, now
from .schemas import ExplorationIntent, LifeContext, Lines, StrictModel, SupportStyle

ShortAnswer = Annotated[str, StringConstraints(min_length=1, max_length=100)]


class DraftFollowUp(StrictModel):
    selections: list[ShortAnswer] = Field(default=[], max_length=6)
    note: str = Field(default='', max_length=800)
    # Inactive parents remain in a draft so reselecting a branch restores its answers.
    refinements: dict[ShortAnswer, Annotated[list[ShortAnswer], Field(max_length=6)]] | None = Field(default=None, max_length=6)


class DraftAnswers(StrictModel):
    title: str = Field(default='', max_length=120)
    concerns: list[Literal['job_search', 'direction', 'change', 'relationships', 'overload',
                           'other', 'unsure', 'choices', 'start', 'possibility']] = Field(default=[], max_length=8)
    life_contexts: list[LifeContext] = Field(default=[], max_length=11)
    stage: Literal['studying', 'searching', 'working', 'transition', 'unsure'] = 'unsure'
    background: str = Field(default='', max_length=400)
    constraints: Lines = []
    support_style: SupportStyle | Literal[''] = ''
    exploration_intent: ExplorationIntent = ''
    actual_question: str = Field(default='', max_length=400)
    focus_response: str = Field(default='', max_length=800)
    follow_ups: dict[ExplorationIntent | Literal['general'], DraftFollowUp] = Field(default={}, max_length=11)

    @model_validator(mode='after')
    def valid_draft(self):
        if '' in self.follow_ups:
            raise ValueError('draft follow-ups need a topic or general key')
        if 'unsure' in self.concerns and len(self.concerns) > 1:
            raise ValueError('uncertainty must be selected alone')
        if self.exploration_intent and self.exploration_intent not in self.concerns:
            raise ValueError('mainline must be selected')
        if len(json.dumps(self.model_dump(exclude_none=True), ensure_ascii=False).encode()) > 65536:
            raise ValueError('draft exceeds 64 KiB')
        return self


class ProgressUpdate(StrictModel):
    version: int = Field(ge=0)
    step: int = Field(ge=0, le=4)
    status: Literal['in_progress', 'paused'] = 'in_progress'
    answers: DraftAnswers


def progress_view(item):
    return {key: getattr(item, key) for key in ('step', 'status', 'answers', 'version', 'updated_at')}


def lock_owner(db, user):
    # Also serialize first inserts and final issue creation across devices.
    db.execute(update(User).where(User.id == user.id).values(use_memory=User.use_memory))


def complete_progress(db, user, version):
    lock_owner(db, user)
    item = db.get(OnboardingProgress, user.id)
    if item is None or item.version != version or item.status == 'completed':
        raise HTTPException(409, '问答进度已变化，回答仍保留，请重新确认后保存')
    item.step = 4
    item.status = 'completed'
    item.answers = None
    item.version += 1
    item.updated_at = now()


def register_progress_routes(app, authenticated, db_dependency):
    @app.get('/api/onboarding-progress')
    def get_progress(user: User = Depends(authenticated), db: Session = Depends(db_dependency)):
        item = db.get(OnboardingProgress, user.id)
        return progress_view(item) if item else None

    @app.put('/api/onboarding-progress')
    def save_progress(body: ProgressUpdate, user: User = Depends(authenticated),
                      db: Session = Depends(db_dependency)):
        lock_owner(db, user)
        item = db.get(OnboardingProgress, user.id)
        if (item.version if item else 0) != body.version:
            raise HTTPException(409, '另一处已更新问答进度，本机回答仍保留')
        if item is None:
            item = OnboardingProgress(user_id=user.id)
            db.add(item)
        item.step = body.step
        item.status = body.status
        item.answers = body.answers.model_dump(exclude_none=True)
        item.version = body.version + 1
        item.updated_at = now()
        db.commit()
        return progress_view(item)
