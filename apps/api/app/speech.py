"""Opt-in, user-scoped speech cache and independent durable usage reservations."""
import asyncio
import base64
import hashlib
import hmac
import json
import logging
import secrets
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import Depends, HTTPException, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import delete, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from .models import (
    AIRequest,
    Consent,
    Conversation,
    Message,
    SpeechAudio,
    SpeechUsage,
    User,
    WelcomeSpeechAudio,
    now,
)
from .reply_format import speech_text
from .tts_provider import (
    MockTTSProvider,
    SpeechFailure,
    TencentTTSProvider,
    TTSProvider,
    split_text,
)

POLICY = 'tts-2026-10-23'


def storage_error_code(error):
    original = getattr(error, 'orig', None)
    if (getattr(original, 'sqlstate', None) in {'42P01', '42703'}
            or 'no such table' in str(original).lower()):
        return 'speech_setup_required'
    return 'speech_storage_unavailable'


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


class SpeechInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    message_id: str | None = Field(default=None, max_length=36)
    text: str = Field(default='', max_length=3000)
    proof: str = Field(default='', max_length=2000)


class ConsentInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    accepted: bool


class SpeechService:
    def __init__(self, settings, sessions, transport=None):
        self.settings, self.sessions = settings, sessions
        # A Mock consent never silently authorizes first use of a real vendor.
        self.policy = POLICY + (':m' if settings.tts_mode == 'mock' else ':t')
        # Ephemeral reply proofs deliberately expire across an API restart.
        self.signing_key = secrets.token_bytes(32)
        self.provider: TTSProvider = MockTTSProvider() if settings.tts_mode == 'mock' else TencentTTSProvider(settings, transport)

    def consent(self, db, user_id):
        row = db.scalar(select(Consent).where(Consent.user_id == user_id, Consent.kind == 'tts')
                        .order_by(Consent.created_at.desc(), Consent.id.desc()).limit(1))
        return bool(row and row.accepted and row.policy_version == self.policy)

    def privacy_epoch(self, db, user_id):
        return db.scalar(select(Consent.id).where(Consent.user_id == user_id,
                         Consent.kind.in_(['ai_consent', 'save_chat']))
                         .order_by(Consent.created_at.desc(), Consent.id.desc()).limit(1))

    def proof(self, user_id, conversation_id, request_key, text):
        with self.sessions() as db:
            c, u = db.get(Conversation, conversation_id), db.get(User, user_id)
            if not c or not u or u.save_chat:
                return None
            claims = {'u': user_id, 'c': c.id, 'v': c.version, 'r': request_key,
                      'h': digest(text), 'e': int(time.time()) + 3600,
                      'p': self.privacy_epoch(db, user_id)}
        payload = base64.urlsafe_b64encode(json.dumps(claims, separators=(',', ':')).encode()).decode()
        return payload + '.' + hmac.new(self.signing_key, payload.encode(), hashlib.sha256).hexdigest()

    def read_proof(self, proof):
        try:
            payload, signature = proof.split('.')
            expected = hmac.new(self.signing_key, payload.encode(), hashlib.sha256).hexdigest()
            if not hmac.compare_digest(signature, expected):
                raise ValueError()
            claims = json.loads(base64.urlsafe_b64decode(payload))
            if claims['e'] <= time.time():
                raise ValueError()
            return claims
        except (ValueError, KeyError, TypeError):
            raise HTTPException(403, '朗读授权已失效，请重新打开这条回复') from None

    def source(self, db, user_id, conversation_id, body, require_consent=True):
        c = db.get(Conversation, conversation_id)
        if not c or c.user_id != user_id:
            raise HTTPException(404, '没有找到这条回复')
        u = db.get(User, user_id)
        if not u or (require_consent and not self.consent(db, user_id)):
            raise HTTPException(403, '请先同意朗读的数据处理说明')
        if body.message_id:
            m = db.get(Message, body.message_id)
            if not m or m.conversation_id != c.id or m.role != 'assistant' or not u.save_chat:
                raise HTTPException(404, '没有找到可以朗读的最终回复')
            return m.content
        claims = self.read_proof(body.proof)
        request = db.get(AIRequest, claims['r'])
        if (u.save_chat or claims['u'] != user_id or claims['c'] != c.id or claims['v'] != c.version
                or claims['p'] != self.privacy_epoch(db, user_id) or claims['h'] != digest(body.text)
                or not request or request.status != 'completed' or request.kind != 'chat'
                or request.user_id != user_id or request.conversation_id != c.id):
            raise HTTPException(403, '这段内容没有有效的最终回复授权')
        return body.text

    def cleanup(self):
        with self.sessions.begin() as db:
            db.execute(delete(SpeechAudio).where(SpeechAudio.expires_at <= now()))
            db.execute(delete(WelcomeSpeechAudio).where(WelcomeSpeechAudio.expires_at <= now()))
            # Quotas retain only rolling counters, never response text.
            cutoff = (datetime.now(ZoneInfo('Asia/Shanghai')) - timedelta(days=32)).strftime('%Y-%m-%d')
            db.execute(delete(SpeechUsage).where(SpeechUsage.day < cutoff))

    async def sweep(self):
        while True:
            try:
                self.cleanup()
            except SQLAlchemyError as error:
                # A missing deployment migration must not kill this task or leak SQL.
                logging.getLogger('agency.speech').warning('speech_cleanup_failed code=%s', storage_error_code(error))
            await asyncio.sleep(60)

    def reserve(self, db, user_id, chars):
        day = datetime.now(ZoneInfo('Asia/Shanghai')).strftime('%Y-%m-%d')
        insert = sqlite_insert if db.bind.dialect.name == 'sqlite' else pg_insert
        # Same order in every worker; SQL conditional increments enforce caps.
        for owner, limit in [('global', self.settings.tts_global_daily_chars),
                             (user_id, self.settings.tts_daily_chars)]:
            key = digest(owner + ':' + day)
            db.execute(insert(SpeechUsage).values(id=key, day=day, characters=0, requests=0)
                       .on_conflict_do_nothing(index_elements=['id']))
            changed = db.execute(update(SpeechUsage).where(SpeechUsage.id == key,
                        SpeechUsage.characters + chars <= limit,
                        SpeechUsage.requests < (self.settings.tts_daily_requests if owner != 'global' else 100))
                        .values(characters=SpeechUsage.characters + chars, requests=SpeechUsage.requests + 1))
            if changed.rowcount != 1:
                raise HTTPException(429, '今天的朗读额度已用完，文字对话仍可继续')

    def register(self, app, authenticated):
        from .welcome_speech import register_welcome_speech
        register_welcome_speech(app, self, authenticated)
        @app.exception_handler(SQLAlchemyError)
        async def speech_storage_failure(request, error):
            path = request.url.path
            if not (path.startswith('/api/speech/') or (path.startswith('/api/conversations/') and path.endswith('/speech'))):
                raise error
            code = storage_error_code(error)
            logging.getLogger('agency.speech').warning('speech_failed code=%s', code)
            return JSONResponse(status_code=503, content={'detail': {'code': code}})

        @app.get('/api/speech/config')
        def config(user=Depends(authenticated)):
            with self.sessions() as db:
                return {'mode': self.settings.tts_mode, 'consented': self.consent(db, user.id),
                        'available': self.settings.tts_mode == 'mock' or bool(self.settings.tts_paid_enabled
                         and self.settings.tts_secret_id.get_secret_value() and self.settings.tts_secret_key.get_secret_value()),
                        'max_chars': self.settings.tts_max_chars, 'cache_seconds': self.settings.tts_cache_seconds}

        @app.put('/api/speech/consent')
        def consent(body: ConsentInput, user=Depends(authenticated)):
            with self.sessions.begin() as db:
                db.scalar(select(User).where(User.id == user.id).with_for_update())
                db.add(Consent(user_id=user.id, kind='tts', accepted=body.accepted, policy_version=self.policy))
                if not body.accepted:
                    db.execute(delete(SpeechAudio).where(SpeechAudio.user_id == user.id))
                    db.execute(delete(WelcomeSpeechAudio).where(WelcomeSpeechAudio.user_id == user.id))
            return {'consented': body.accepted}

        @app.post('/api/conversations/{conversation_id}/speech')
        async def create(conversation_id: str, body: SpeechInput, user=Depends(authenticated)):
            self.cleanup()
            s = self.settings
            try:
                with self.sessions.begin() as db:
                    db.scalar(select(User).where(User.id == user.id).with_for_update())
                    raw_text = self.source(db, user.id, conversation_id, body)
                    text = speech_text(raw_text)
                    if not text.strip() or len(text) > s.tts_max_chars:
                        raise HTTPException(409, f'这条回复超过朗读上限（{s.tts_max_chars} 字），请先阅读文字')
                    if '<think' in text.lower() or '</think' in text.lower():
                        raise HTTPException(409, '这条回复含有无法朗读的内容')
                    if s.tts_mode == 'tencent' and (not s.tts_paid_enabled or not s.tts_secret_id.get_secret_value() or not s.tts_secret_key.get_secret_value()):
                        raise HTTPException(409, '真实语音服务尚未开启，文字对话仍可继续')
                    source = {'message_id': body.message_id, 'proof': body.proof, 'hash': digest(raw_text)}
                    key = digest('|'.join([user.id, conversation_id, body.message_id or body.proof,
                                           digest(raw_text), s.tts_mode, str(s.tts_voice_type), 'mp3-text-v2']))
                    cached = db.get(SpeechAudio, key)
                    if cached:
                        if cached.status == 'ready':
                            return self.view(cached)
                        raise HTTPException(409, '这条朗读正在处理或结果未确认，请稍后手动重试；不会重复合成')
                    self.reserve(db, user.id, len(text))
                    db.add(SpeechAudio(id=key, user_id=user.id, conversation_id=conversation_id,
                           message_id=body.message_id, source=source, status='pending',
                           expires_at=(datetime.now(timezone.utc) + timedelta(days=1)).isoformat()))
            except IntegrityError:
                raise HTTPException(409, '这条朗读已经在处理中，请稍后重试') from None
            try:
                # A single explicit gesture authorizes this bounded sequence.
                # No retries: uncertain submissions keep their durable reservation.
                audio = []
                async with asyncio.timeout(50):
                    for index, part in enumerate(split_text(text)):
                        with self.sessions() as db:
                            self.source(db, user.id, conversation_id, body)
                            if not db.get(SpeechAudio, key):
                                raise HTTPException(409, '朗读授权已撤回')
                        audio.append(base64.b64encode(await self.provider.synthesize(part, f'{key[:24]}-{index}')).decode())
                with self.sessions.begin() as db:
                    db.scalar(select(User).where(User.id == user.id).with_for_update())
                    self.source(db, user.id, conversation_id, body)
                    row = db.get(SpeechAudio, key)
                    if not row:
                        raise HTTPException(409, '朗读已取消，请重新选择回复')
                    row.audio, row.status = audio, 'ready'
                    row.expires_at = (datetime.now(timezone.utc) + timedelta(seconds=s.tts_cache_seconds)).isoformat()
                    return self.view(row)
            except (SpeechFailure, TimeoutError):
                # Keep the failed tombstone until tomorrow: timeout != unbilled.
                with self.sessions.begin() as db:
                    db.execute(update(SpeechAudio).where(SpeechAudio.id == key).values(status='uncertain'))
                raise HTTPException(409, '语音服务未能完成本次合成，请稍后再试；不会自动重新扣费') from None

        @app.get('/api/speech/audio/{audio_id}/{index}')
        def get_audio(audio_id: str, index: int, user=Depends(authenticated)):
            self.cleanup()
            with self.sessions() as db:
                row = db.get(SpeechAudio, audio_id)
                if not row or row.user_id != user.id or row.status != 'ready' or not row.audio or not 0 <= index < len(row.audio):
                    raise HTTPException(404, '朗读音频已过期或不可用，请重新点击朗读')
                # Source deletion/edit and privacy changes revoke cached audio too.
                m = row.source
                if row.message_id:
                    text = self.source(db, user.id, row.conversation_id, SpeechInput(message_id=row.message_id))
                    if digest(text) != m['hash']:
                        raise HTTPException(404, '原回复已更新，请重新选择朗读')
                else:
                    claims = self.read_proof(m['proof'])
                    u, c = db.get(User, user.id), db.get(Conversation, row.conversation_id)
                    r = db.get(AIRequest, claims['r'])
                    if (not self.consent(db, user.id) or u.save_chat or not c or c.version != claims['v']
                            or claims['p'] != self.privacy_epoch(db, user.id) or not r or r.status != 'completed'):
                        raise HTTPException(403, '朗读授权已失效')
                return Response(base64.b64decode(row.audio[index]), media_type='audio/mpeg')

    def view(self, row):
        return {'audio_id': row.id, 'mode': self.settings.tts_mode, 'expires_at': row.expires_at,
                'parts': [f'/speech/audio/{row.id}/{i}' for i in range(len(row.audio or []))]}
