"""Replaceable MP3 provider; no LLM calls, web learning, or automatic retries."""
import base64
import hashlib
import hmac
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol

import httpx


class SpeechFailure(Exception):
    def __init__(self, code='unavailable'):
        self.code = code
        super().__init__(code)


class TTSProvider(Protocol):
    async def synthesize(self, text: str, session_id: str) -> bytes: ...


def split_text(text: str) -> list[str]:
    # <=120 Unicode codepoints AND <=450 UTF-8 bytes, below the basic API's
    # 150 Chinese / 500 English limit. Preserve all visible text in order.
    parts, start = [], 0
    while start < len(text):
        end = min(start + 120, len(text))
        while len(text[start:end].encode()) > 450:
            end -= 1
        if end < len(text):
            boundary = max((text.rfind(p, start, end) for p in '。！？；\n.!?;'), default=-1)
            if boundary >= start + 30:
                end = boundary + 1
        parts.append(text[start:end])
        start = end
    return parts


class MockTTSProvider:
    async def synthesize(self, text, session_id):
        # Repository-owned neutral tone, clearly labelled Mock by the client.
        return Path(__file__).with_name('fixtures').joinpath('speech-mock.mp3').read_bytes()


class TencentTTSProvider:
    def __init__(self, settings, transport=None):
        self.settings, self.transport = settings, transport

    async def synthesize(self, text, session_id):
        s = self.settings
        if not s.tts_paid_enabled:
            raise SpeechFailure('disabled')
        secret_id, secret_key = s.tts_secret_id.get_secret_value(), s.tts_secret_key.get_secret_value()
        if not secret_id or not secret_key:
            raise SpeechFailure('configuration')
        if len(split_text(text)) != 1:
            raise SpeechFailure('length')
        body = json.dumps({'Text': text, 'SessionId': session_id, 'ModelType': 1,
                           'VoiceType': s.tts_voice_type, 'Codec': 'mp3', 'SampleRate': 16000,
                           'Speed': 0}, ensure_ascii=False, separators=(',', ':')).encode()
        timestamp = int(time.time())
        date = datetime.fromtimestamp(timestamp, timezone.utc).strftime('%Y-%m-%d')
        host = 'tts.tencentcloudapi.com'
        canonical = 'POST\n/\n\ncontent-type:application/json\nhost:' + host + '\n\ncontent-type;host\n' + hashlib.sha256(body).hexdigest()
        scope = date + '/tts/tc3_request'
        to_sign = 'TC3-HMAC-SHA256\n' + str(timestamp) + '\n' + scope + '\n' + hashlib.sha256(canonical.encode()).hexdigest()
        def sign(key, value):
            return hmac.new(key, value.encode(), hashlib.sha256).digest()
        key = sign(sign(sign(('TC3' + secret_key).encode(), date), 'tts'), 'tc3_request')
        signature = hmac.new(key, to_sign.encode(), hashlib.sha256).hexdigest()
        headers = {'Content-Type': 'application/json', 'Host': host,
                   'Authorization': f'TC3-HMAC-SHA256 Credential={secret_id}/{scope}, SignedHeaders=content-type;host, Signature={signature}',
                   'X-TC-Action': 'TextToVoice', 'X-TC-Version': '2019-08-23',
                   'X-TC-Timestamp': str(timestamp), 'X-TC-Region': s.tts_region}
        try:
            async with httpx.AsyncClient(transport=self.transport, timeout=s.tts_timeout_seconds, trust_env=False) as client:
                async with client.stream('POST', 'https://' + host, content=body, headers=headers) as response:
                    if response.status_code != 200:
                        raise SpeechFailure()
                    data = bytearray()
                    async for chunk in response.aiter_bytes():
                        data.extend(chunk)
                        if len(data) > 2_000_000:
                            raise SpeechFailure('format')
            result = json.loads(data)['Response']
            if 'Error' in result:
                code = str(result['Error'].get('Code', ''))
                raise SpeechFailure('auth' if code.startswith(('AuthFailure', 'UnauthorizedOperation')) else 'unavailable')
            audio = base64.b64decode(result['Audio'], validate=True)
            if not (audio.startswith(b'ID3') or (len(audio) > 2 and audio[0] == 255 and audio[1] & 224 == 224)):
                raise SpeechFailure('format')
            return audio
        except SpeechFailure:
            raise
        except (httpx.HTTPError, KeyError, ValueError, TypeError):
            # Never log upstream bodies, text, signing headers or credentials.
            raise SpeechFailure() from None
