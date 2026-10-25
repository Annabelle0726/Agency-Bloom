"""Persistent experiment admission. Live dispatch remains deliberately unavailable.

Separate metadata: normal application startup NEVER creates these tables.
Mock fixtures provision them in isolated storage; no production migration runs.
"""
import hashlib
import json
from decimal import Decimal
from pathlib import Path

import httpx
from sqlalchemy import JSON, Integer, String, UniqueConstraint, select, update
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

MANIFEST = Path(__file__).parents[1] / 'evaluation/live_first/manifest.json'
RUBRIC = MANIFEST.with_name('rubric.json')
MANIFEST_SHA = '414c87a168f3ef71557d39e7fa26c3a30c829617d7868194598e34034d975b3d'
RUBRIC_SHA = 'ec4857952af02bb84b6ca16dcd433bce2b5db1ab96f3c29e7b60e11f9e7ba9a8'
SYSTEM_SHA = 'd52d431c285a944e87ba9e9f28b8628a6b81be0a0ab567945e1e77cbf7ef5128'
EXPERIMENT = 'bloom-first-live-v1'
CAP = 3_050_000
PER_CALL = 380_592  # 30000 * 9 + 4096 * 27 micro-CNY, peak/cache-miss.
RATE_VERSION = 'deepseek-v4-pro-cny-2026-10-20'


def sha(value):
    return hashlib.sha256(value).hexdigest()


def payload_sha(payload):
    return sha(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode())


class GuardError(ValueError):
    """Fixed public diagnostic codes only."""


class EvaluationBase(DeclarativeBase):
    pass


class EvaluationRun(EvaluationBase):
    __tablename__ = 'evaluation_runs'
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    experiment: Mapped[str] = mapped_column(String(80), unique=True)
    manifest_sha: Mapped[str] = mapped_column(String(64))
    manifest_version: Mapped[int] = mapped_column(Integer, default=1)
    model: Mapped[str] = mapped_column(String(40), default='deepseek-v4-pro')
    thinking: Mapped[dict] = mapped_column(JSON, default=lambda: {'type': 'enabled'})
    rate_version: Mapped[str] = mapped_column(String(80), default=RATE_VERSION)
    contract: Mapped[dict] = mapped_column(JSON)
    bindings: Mapped[dict] = mapped_column(JSON, default=dict)
    attempted: Mapped[int] = mapped_column(Integer, default=0)
    settled_micro: Mapped[int] = mapped_column(Integer, default=0)
    reserved_micro: Mapped[int] = mapped_column(Integer, default=0)
    unknown_micro: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(32), default='ready')
    stop_reason: Mapped[str | None] = mapped_column(String(80), nullable=True)


class EvaluationAttempt(EvaluationBase):
    __tablename__ = 'evaluation_attempts'
    __table_args__ = (UniqueConstraint('run_id', 'case_id'),)
    request_key: Mapped[str] = mapped_column(String(64), primary_key=True)
    run_id: Mapped[str] = mapped_column(String(64), index=True)
    case_id: Mapped[str] = mapped_column(String(8))
    payload_sha: Mapped[str] = mapped_column(String(64))
    input_count: Mapped[int] = mapped_column(Integer)
    count_method: Mapped[str] = mapped_column(String(80))
    reserved_micro: Mapped[int] = mapped_column(Integer)
    settled_micro: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default='reserved')
    usage: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    review: Mapped[dict | None] = mapped_column(JSON, nullable=True)


def reviewed_system_prompt():
    """Exact approved Mock prompt; current product wording cannot change this run."""
    data = MANIFEST.with_name('system-prompt.txt').read_text(encoding='utf-8').encode('utf-8')
    if sha(data) != SYSTEM_SHA:
        raise GuardError('evaluation_system_changed')
    return data.decode('utf-8')


def fixed_cases():
    if sha(MANIFEST.read_bytes()) != MANIFEST_SHA or sha(RUBRIC.read_bytes()) != RUBRIC_SHA:
        raise GuardError('evaluation_manifest_changed')
    return [t for s in json.loads(MANIFEST.read_text(encoding='utf8'))['scenarios']
            for t in s['turns']]


def contract():
    return {'manifest_sha': MANIFEST_SHA, 'rubric_sha': RUBRIC_SHA, 'system_sha': SYSTEM_SHA,
            'max_attempts': 8, 'cap_micro': CAP, 'input_cap': 30000, 'output_cap': 4096,
            'peak_rates': ['9', '0.30', '27'], 'mode': 'MOCK_ONLY_LIVE_BLOCKED'}


def check_payload(payload, settings, transport):
    """Count the WHOLE Mock wire payload. NOT a hosted tokenizer/billing claim.

    There is no boolean/certificate/configuration switch that enables live mode.
    Unknown hosted framing is a blocker, not an invented +2048 allowance.
    """
    if not isinstance(transport, httpx.MockTransport):
        raise GuardError('hosted_input_bound_unverified')
    if (settings.deepseek_base_url != 'https://offline.invalid'
            or settings.deepseek_api_key != 'mock-only'):
        raise GuardError('evaluation_requires_isolated_mock')
    rates = [settings.input_price_per_million, settings.cached_input_price_per_million,
             settings.output_price_per_million]
    if rates != [Decimal('9'), Decimal('0.30'), Decimal('27')]:
        raise GuardError('evaluation_rate_changed')
    keys = {'model', 'messages', 'thinking', 'max_tokens', 'reasoning_effort',
            'response_format', 'stream'}
    if (set(payload) != keys or payload['model'] != 'deepseek-v4-pro'
            or payload['thinking'] != {'type': 'enabled'} or payload['max_tokens'] != 4096
            or payload['stream'] is not False or payload['response_format'] != {'type': 'text'}
            or settings.ai_monthly_budget_cny != 100):
        raise GuardError('evaluation_parameters_changed')
    if sha(payload['messages'][0]['content'].encode()) != SYSTEM_SHA:
        raise GuardError('evaluation_system_changed')
    # This admission method is fully defined only for the synthetic Mock protocol.
    # JSON bytes include all assembled context and client framing; no trimming.
    count = len(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode())
    if count > 30000:
        raise GuardError('evaluation_input_limit')
    return count


class EvaluationGuard:
    def __init__(self):
        self.run_id = sha(EXPERIMENT.encode())  # Restart/new caller IDs cannot create a fresh run.

    def provision_mock(self, engine):
        if engine.dialect.name != 'sqlite':
            raise GuardError('formal_database_provisioning_forbidden')
        EvaluationBase.metadata.create_all(engine)
        from sqlalchemy.orm import Session
        with Session(engine) as db, db.begin():
            if db.get(EvaluationRun, self.run_id) is None:
                fixed_cases()
                db.add(EvaluationRun(id=self.run_id, experiment=EXPERIMENT,
                                     manifest_sha=MANIFEST_SHA, contract=contract()))

    def bind_mock_fixtures(self, db, bindings):
        """Explicit offline provisioning: every fixed case is bound to user+conversation."""
        if set(bindings) != {c['id'] for c in fixed_cases()}:
            raise GuardError('evaluation_bindings_invalid')
        run = db.get(EvaluationRun, self.run_id)
        if run.attempted or run.bindings:
            raise GuardError('evaluation_bindings_frozen')
        run.bindings = bindings

    def reserve(self, db, key, body, user_id, conversation_id, payload, settings, transport):
        count = check_payload(payload, settings, transport)
        cases = fixed_cases()
        # Acquire a write lock on the run before reading its mutable counters.
        locked = db.execute(update(EvaluationRun).where(
            EvaluationRun.id == self.run_id, EvaluationRun.status == 'ready',
            EvaluationRun.attempted < 8,
            EvaluationRun.settled_micro + EvaluationRun.reserved_micro
            + EvaluationRun.unknown_micro + PER_CALL <= CAP,
        ).values(status='admitting'))
        if locked.rowcount != 1:
            raise GuardError('evaluation_stopped_busy_or_exhausted')
        run = db.get(EvaluationRun, self.run_id, populate_existing=True)
        if (run.contract != contract() or run.manifest_sha != MANIFEST_SHA
                or run.model != 'deepseek-v4-pro' or run.thinking != {'type': 'enabled'}
                or run.rate_version != RATE_VERSION):
            raise GuardError('evaluation_contract_changed')
        case = cases[run.attempted]
        if (body.message != case['input'] or body.task != 'chat' or body.web_search
                or body.history or body.session_summary or body.insight_feedback
                or body.dismissed_changes or body.perspective_control is not None or getattr(body, 'edit_message_id', None)
                or getattr(body, 'edit_in_memory', False)
                or run.bindings.get(case['id']) != [user_id, conversation_id]
                or payload['reasoning_effort'] != ('low' if case['id'] in {'B1', 'B3'} else 'high')):
            raise GuardError('evaluation_case_changed')
        run.attempted += 1
        run.reserved_micro += PER_CALL
        run.status = 'inflight'
        db.add(EvaluationAttempt(request_key=key, run_id=self.run_id, case_id=case['id'],
                                 payload_sha=payload_sha(payload), input_count=count,
                                 count_method='mock-wire-utf8-bytes-not-hosted-tokens',
                                 reserved_micro=PER_CALL))
        db.flush()
        return PER_CALL

    def dispatch(self, db, key, payload, settings, transport):
        check_payload(payload, settings, transport)
        fixed_cases()
        locked = db.execute(update(EvaluationRun).where(
            EvaluationRun.id == self.run_id, EvaluationRun.status == 'inflight',
        ).values(status='inflight'))
        run = db.get(EvaluationRun, self.run_id, populate_existing=True)
        if locked.rowcount != 1 or not run or run.contract != contract():
            raise GuardError('evaluation_not_inflight')
        result = db.execute(update(EvaluationAttempt).where(
            EvaluationAttempt.request_key == key, EvaluationAttempt.run_id == self.run_id,
            EvaluationAttempt.status == 'reserved',
            EvaluationAttempt.payload_sha == payload_sha(payload),
        ).values(status='dispatched'))
        if result.rowcount != 1:
            raise GuardError('evaluation_dispatch_replay_or_changed')

    def settle(self, db, key, generation):
        # Caller uses the SAME transaction for monthly ledger settlement and chat save.
        locked = db.execute(update(EvaluationRun).where(
            EvaluationRun.id == self.run_id, EvaluationRun.status == 'inflight',
        ).values(status='settling'))
        if locked.rowcount != 1:
            raise GuardError('evaluation_not_inflight')
        run = db.get(EvaluationRun, self.run_id, populate_existing=True)
        attempt = db.get(EvaluationAttempt, key)
        usage = generation.usage or {}
        cost = generation.cost_micro
        if (not attempt or attempt.status != 'dispatched' or run.status != 'settling'
                or type(cost) is not int or not 0 <= cost <= attempt.reserved_micro
                or usage.get('price_version') != RATE_VERSION
                or usage.get('prompt_tokens', 30001) > 30000
                or usage.get('cost_micro') != cost):
            raise GuardError('evaluation_usage_invalid')
        attempt.status = 'completed'
        attempt.settled_micro = cost
        attempt.usage = {k: usage.get(k) for k in (
            'prompt_tokens', 'completion_tokens', 'reasoning_tokens', 'cost_micro',
            'currency', 'price_version', 'provider_model', 'thinking', 'reasoning_effort')}
        run.reserved_micro -= attempt.reserved_micro
        run.settled_micro += cost
        run.status = 'review_required'

    def stop(self, db, reason):
        # Fixed diagnostic codes, no provider body, prompts or private reasoning.
        db.execute(update(EvaluationRun).where(EvaluationRun.id == self.run_id)
                   .values(status='stopped', stop_reason=reason))
        run = db.get(EvaluationRun, self.run_id, populate_existing=True)
        if run is None:
            return
        for attempt in db.scalars(select(EvaluationAttempt).where(
            EvaluationAttempt.run_id == self.run_id,
            EvaluationAttempt.status.in_(['reserved', 'dispatched']),
        )):
            attempt.status = 'unknown'
            run.reserved_micro -= attempt.reserved_micro
            run.unknown_micro += attempt.reserved_micro

    def review(self, db, key, *, reviewer, proceed, note):
        """Operator-only function; no HTTP endpoint and never called automatically."""
        changed = db.execute(update(EvaluationRun).where(
            EvaluationRun.id == self.run_id, EvaluationRun.status == 'review_required',
        ).values(status='reviewing'))
        if changed.rowcount != 1:
            raise GuardError('evaluation_not_awaiting_review')
        run, attempt = db.get(EvaluationRun, self.run_id), db.get(EvaluationAttempt, key)
        if (not reviewer.strip() or not note.strip() or not attempt
                or attempt.run_id != self.run_id or attempt.status != 'completed'
                or attempt.review is not None):
            raise GuardError('evaluation_review_invalid')
        attempt.review = {'reviewer': reviewer, 'proceed': bool(proceed), 'note': note}
        run.status = ('completed' if run.attempted == 8 else 'ready') if proceed else 'stopped'
        run.stop_reason = None if proceed else 'human_review_stop'

    def recover(self, db):
        """Explicit crash recovery never resumes/retries an ambiguous dispatch."""
        run = db.get(EvaluationRun, self.run_id)
        if run and run.status in {'inflight', 'admitting'}:
            self.stop(db, 'restart_with_unknown_attempt')
