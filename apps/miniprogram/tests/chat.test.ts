import { expect, it, vi } from 'vitest'
import { createChatSession } from '../src/chat'
import { ApiError } from '../src/http'
import type { ChatResponse } from '../src/domain'

function harness() {
  let resolve!: (reply: ChatResponse) => void
  let reject!: (error: Error) => void
  const abort = vi.fn(() => reject(new ApiError('已停止回复', 0, true)))
  const post = vi.fn(() => ({ promise: new Promise<ChatResponse>((yes, no) => { resolve = yes; reject = no }), cancel: abort }))
  const remote = vi.fn(async () => {})
  const error = vi.fn(), notice = vi.fn()
  const chat = createChatSession({ post, cancelRemote: remote, onError: error, onCancelled: notice, requestId: () => 'one-request' })
  return { chat, post, abort, remote, error, notice, resolve: (value: ChatResponse) => resolve(value), reject: (value: Error) => reject(value) }
}

it('accepts a natural reply with no card and blocks fast duplicate sends', async () => {
  const h = harness()
  h.chat.draft.value = '我想你了'
  const pending = h.chat.send('issue')
  await h.chat.send('issue')
  expect(h.post).toHaveBeenCalledTimes(1)
  expect(h.chat.sending.value).toBe(true)
  h.resolve({ reply: '今天过得怎么样？', suggestion: null, mode: 'deepseek' })
  await pending
  expect(h.chat.messages.value).toHaveLength(2)
  expect(h.chat.suggestion.value).toBeNull()
  expect(h.chat.draft.value).toBe('')
})

it('retains the full input on timeout/failure and never retries automatically', async () => {
  const h = harness()
  h.chat.draft.value = '  我不知道未来做什么  '
  const pending = h.chat.send('issue')
  h.reject(new ApiError('请求超时'))
  await pending
  expect(h.chat.draft.value).toBe('  我不知道未来做什么  ')
  expect(h.chat.messages.value).toEqual([])
  expect(h.chat.sending.value).toBe(false)
  expect(h.post).toHaveBeenCalledTimes(1)
  expect(h.error).toHaveBeenCalledWith('请求超时')
})

it('cancels promptly, reports the remote request and preserves the input', async () => {
  const h = harness()
  h.chat.draft.value = '我尝试过了，但失败了'
  const pending = h.chat.send('issue')
  h.chat.cancel()
  await pending
  expect(h.abort).toHaveBeenCalledOnce()
  expect(h.remote).toHaveBeenCalledWith('one-request')
  expect(h.chat.draft.value).toBe('我尝试过了，但失败了')
  expect(h.chat.messages.value).toEqual([])
})

it('holds a proposal as an unconfirmed draft and bounds sent recent history', async () => {
  const h = harness()
  h.chat.messages.value = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? 'assistant' as const : 'user' as const, content: String(i) }))
  h.chat.draft.value = '程序员和 AI 产品经理怎么选'
  const pending = h.chat.send('issue')
  expect(h.post.mock.calls[0][1].history).toHaveLength(8)
  const suggestion = { options: ['继续开发', '探索产品'], hypotheses: [], unknowns: ['岗位要求'], next_step: '访谈一位从业者' }
  h.resolve({ reply: '先看现实约束', suggestion, mode: 'deepseek' })
  await pending
  expect(h.chat.suggestion.value).toEqual(suggestion)
})

it('does not erase new edits or deliver an old response into a reset session', async () => {
  const h = harness()
  h.chat.draft.value = '第一条'
  const pending = h.chat.send('issue')
  h.chat.reset()
  h.chat.draft.value = '新的问题'
  await pending
  expect(h.chat.draft.value).toBe('新的问题')
  expect(h.chat.messages.value).toEqual([])
  expect(h.chat.suggestion.value).toBeNull()
})

it('keeps text typed after a request started when the response completes', async () => {
  const h = harness()
  h.chat.draft.value = '原来的输入'
  const pending = h.chat.send('issue')
  h.chat.draft.value = '下一个想法'
  h.resolve({ reply: '已理解', suggestion: null, mode: 'deepseek' })
  await pending
  expect(h.chat.draft.value).toBe('下一个想法')
})
