import { expect, it } from 'vitest'
import { createEventStream } from '../src/chat-stream'
import { createChatFollow } from '../src/chat-follow'
import { createChatSession } from '../src/chat'
import { ApiError, createApi } from '../src/http'

it('previews text without committing a turn and drops late chunks after cancellation', async () => {
  let emit: any, reject: (error: Error) => void = () => {}
  const session = createChatSession({ requestId: () => 'one', onError() {}, onCancelled() {}, cancelRemote: async () => {},
    post: (_id, _body, callback) => {
      emit = callback
      return { promise: new Promise((_resolve, fail) => { reject = fail }), cancel: () => reject(new ApiError('停止', 0, true)) }
    } })
  session.draft.value = '这周有点累'
  const request = session.send('conversation')
  emit({ type: 'phase', phase: 'thinking' }); emit({ type: 'reply', text: '听起来' })
  expect(session.streamText.value).toBe('听起来')
  expect(session.messages.value).toHaveLength(0)
  session.cancel(); await request
  emit({ type: 'reply', text: '迟到的回复' })
  expect(session.streamText.value).toBe('')
  expect(session.draft.value).toBe('这周有点累')
  expect(session.messages.value).toHaveLength(0)
})

it('consumes real native chunks and resolves only the completed event', async () => {
  let listener: any, native: any
  const api = createApi(options => { native = options; return { abort() {}, onChunkReceived(callback) { listener = callback } } }, () => '', () => {}, '')
  const progress: any[] = []
  const request = api.request<any>('POST', '/conversations/id/chat', {}, event => progress.push(event))
  expect(native.enableChunked).toBe(true)
  listener({ data: new TextEncoder().encode('data: {"type":"reply","text":"收到 🌿"}\n\n').buffer })
  expect(progress[0].text).toBe('收到 🌿')
  listener({ data: new TextEncoder().encode('data: {"type":"done","response":{"reply":"收到 🌿"}}\n\n').buffer })
  expect((await request.promise).reply).toBe('收到 🌿')
})

it('surfaces a streamed provider failure without saving the preview', async () => {
  let listener: any
  const api = createApi(() => ({ abort() {}, onChunkReceived(callback) { listener = callback } }), () => '', () => {}, '', () => {})
  const request = api.request('POST', '/conversations/id/chat', {}, () => {})
  listener({ data: new TextEncoder().encode('data: {"type":"reply","text":"部分回复"}\n\ndata: {"type":"error","status":502,"detail":{"code":"output_truncated"}}\n\n').buffer })
  await expect(request.promise).rejects.toMatchObject({ status: 502, kind: 'model', message: 'AI 回复达到长度上限，未能完整返回；输入已保留' })
})

it('decodes split UTF-8 and SSE frames without exposing private fields', () => {
  const events: any[] = []
  const stream = createEventStream(event => events.push(event))
  const text = 'data: {"type":"phase","phase":"thinking"}\r\n\r\ndata: {"type":"reply","text":"你好 🌿"}\n\ndata: {"type":"done","response":{"reply":"你好 🌿"}}\n\n'
  const bytes = new TextEncoder().encode(text)
  for (const byte of bytes) stream.push(new Uint8Array([byte]).buffer)
  stream.finish()
  expect(events.map(e => e.type)).toEqual(['phase', 'reply', 'done'])
  expect(events[1].text).toBe('你好 🌿')
})

it('rejects a disconnected stream with no completed response', () => {
  const stream = createEventStream(() => {})
  stream.push(new TextEncoder().encode('data: {"type":"reply","text":"部分"}\n\n').buffer)
  expect(() => stream.finish()).toThrow()
})

it('follows new text until the reader scrolls up, then offers an explicit return', () => {
  const follow = createChatFollow()
  expect(follow.following).toBe(true)
  follow.scroll(400, false)
  follow.scroll(100, false)
  expect(follow.following).toBe(false)
  follow.scroll(420, true)
  expect(follow.following).toBe(true)
  follow.scroll(100, false)
  follow.resume()
  expect(follow.following).toBe(true)
})
