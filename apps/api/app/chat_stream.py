"""Ephemeral SSE transport. Only public reply text and fixed phases leave here."""
import asyncio
import json
import re
from contextlib import suppress

from fastapi import HTTPException
from fastapi.responses import StreamingResponse


def reply_prefix(content):
    # Only the first, top-level public reply string can be previewed. Other JSON
    # fields (including provider reasoning) are never interpreted as display text.
    match = re.match(r'^\s*\{\s*"reply"\s*:\s*"', content)
    if not match:
        return ''
    raw = content[match.end():]
    escaped = False
    for index, char in enumerate(raw):
        if char == '"' and not escaped:
            raw = raw[:index]
            break
        escaped = char == '\\' and not escaped
    # A chunk may end inside an escape or surrogate pair.
    for trim in range(min(12, len(raw)) + 1):
        try:
            text = json.loads('"' + (raw[:-trim] if trim else raw) + '"')
            return text.rstrip(''.join(chr(i) for i in range(0xD800, 0xE000)))
        except (ValueError, UnicodeError):
            pass
    return ''


def stream_response(work):
    async def events():
        queue = asyncio.Queue(maxsize=16)
        closed = False

        async def emit(event):
            if not closed:
                await queue.put(event)

        async def produce():
            try:
                result = await work(emit)
                await emit({"type": "done", "response": result})
            except HTTPException as exc:
                await emit({"type": "error", "status": exc.status_code, "detail": exc.detail})
            except Exception:
                await emit({"type": "error", "status": 502, "detail": {"code": "internal_error"}})

        producer = asyncio.create_task(produce())
        try:
            yield ': connected\n\n'
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=5)
                except TimeoutError:
                    yield ': keepalive\n\n'
                    continue
                yield 'data: ' + json.dumps(event, ensure_ascii=False) + '\n\n'
                if event['type'] in ('done', 'error'):
                    break
        finally:
            closed = True
            producer.cancel()
            with suppress(asyncio.CancelledError, Exception):
                await producer

    return StreamingResponse(events(), media_type='text/event-stream',
                             headers={'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no'})
