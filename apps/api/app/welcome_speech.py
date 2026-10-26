"""Speech for two fixed, public welcome messages, independent of chat history."""
import asyncio
import base64
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from .models import User, WelcomeSpeechAudio
from .tts_provider import SpeechFailure, split_text

WelcomeVariant = Literal['first-context-v1', 'first-open-v1']
WELCOME_TEXT = {
    'first-context-v1': '嗨，我是 Bloom，很高兴认识你，我们可以从你刚才留下的想法慢慢聊起，还没想清楚也没关系，想到哪里就先说到哪里，也许聊着聊着，就会发现一件你愿意试试的小事。',
    'first-open-v1': '嗨，我是 Bloom，很高兴认识你，还没想清楚也没关系，想到哪里就先说到哪里，也许聊着聊着，就会发现一件你愿意试试的小事。',
}


class WelcomeSpeechInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    variant: WelcomeVariant


def register_welcome_speech(app, service, authenticated):
    from .speech import digest

    def key_for(owner, variant):
        return digest('|'.join([owner, variant, WELCOME_TEXT[variant], service.policy,
                                str(service.settings.tts_voice_type), 'welcome-mp3-v1']))

    def authorized(db, owner):
        if not db.get(User, owner) or not service.consent(db, owner):
            raise HTTPException(403, '请先同意朗读的数据处理说明')

    def view(row):
        return service.view(row) | {'parts': [f'/speech/welcome/audio/{row.id}/{i}' for i in range(len(row.audio or []))]}

    @app.post('/api/speech/welcome')
    async def create(body: WelcomeSpeechInput, user=Depends(authenticated)):
        service.cleanup()
        s = service.settings
        key, text = key_for(user.id, body.variant), WELCOME_TEXT[body.variant]
        try:
            with service.sessions.begin() as db:
                db.scalar(select(User).where(User.id == user.id).with_for_update())
                authorized(db, user.id)
                if len(text) > s.tts_max_chars:
                    raise HTTPException(409, f'这条回复超过朗读上限（{s.tts_max_chars} 字），请先阅读文字')
                if s.tts_mode == 'tencent' and (not s.tts_paid_enabled or not s.tts_secret_id.get_secret_value() or not s.tts_secret_key.get_secret_value()):
                    raise HTTPException(409, '真实语音服务尚未开启，文字对话仍可继续')
                cached = db.get(WelcomeSpeechAudio, key)
                if cached:
                    if cached.status == 'ready':
                        return view(cached)
                    raise HTTPException(409, '这条朗读正在处理或结果未确认，请稍后手动重试；不会重复合成')
                service.reserve(db, user.id, len(text))
                db.add(WelcomeSpeechAudio(id=key, user_id=user.id, variant=body.variant,
                       status='pending', expires_at=(datetime.now(timezone.utc) + timedelta(days=1)).isoformat()))
        except IntegrityError:
            raise HTTPException(409, '这条朗读已经在处理中，请稍后重试') from None
        try:
            audio = []
            async with asyncio.timeout(50):
                for index, part in enumerate(split_text(text)):
                    with service.sessions() as db:
                        authorized(db, user.id)
                        if not db.get(WelcomeSpeechAudio, key):
                            raise HTTPException(409, '朗读授权已撤回')
                    audio.append(base64.b64encode(await service.provider.synthesize(part, f'{key[:24]}-{index}')).decode())
            with service.sessions.begin() as db:
                db.scalar(select(User).where(User.id == user.id).with_for_update())
                authorized(db, user.id)
                row = db.get(WelcomeSpeechAudio, key)
                if not row:
                    raise HTTPException(409, '朗读已取消，请重新选择回复')
                row.audio, row.status = audio, 'ready'
                row.expires_at = (datetime.now(timezone.utc) + timedelta(seconds=s.tts_cache_seconds)).isoformat()
                return view(row)
        except (SpeechFailure, TimeoutError):
            with service.sessions.begin() as db:
                row = db.get(WelcomeSpeechAudio, key)
                if row:
                    row.status = 'uncertain'
            raise HTTPException(409, '语音服务未能完成本次合成，请稍后再试；不会自动重新扣费') from None

    @app.get('/api/speech/welcome/audio/{audio_id}/{index}')
    def audio(audio_id: str, index: int, user=Depends(authenticated)):
        service.cleanup()
        with service.sessions() as db:
            row = db.get(WelcomeSpeechAudio, audio_id)
            if not row or row.user_id != user.id or row.status != 'ready' or not row.audio or not 0 <= index < len(row.audio):
                raise HTTPException(404, '朗读音频已过期或不可用，请重新点击朗读')
            authorized(db, user.id)
            if row.variant not in WELCOME_TEXT or row.id != key_for(user.id, row.variant):
                raise HTTPException(404, '欢迎语已更新，请重新选择朗读')
            return Response(base64.b64decode(row.audio[index]), media_type='audio/mpeg')
