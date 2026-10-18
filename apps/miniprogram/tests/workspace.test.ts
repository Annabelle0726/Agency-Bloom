import { expect, it } from 'vitest'
import { createChatWorkspace } from '../src/chat-workspace'
import type { ChatResponse } from '../src/domain'

it('switches independent drafts and routes late responses to their originating conversation', async () => {
  const replies = new Map<string, (value: ChatResponse) => void>()
  let id = 0
  const workspace = createChatWorkspace({
    post: key => ({ promise: new Promise(resolve => replies.set(key, resolve)), cancel() {} }),
    cancelRemote: async () => {}, requestId: () => String(++id), onError() {}, onCancelled() {},
  })
  workspace.select('a'); workspace.active.value.draft.value = 'A的话'
  const pending = workspace.active.value.send('a')
  workspace.select('b'); workspace.active.value.draft.value = 'B的草稿'
  replies.get('a')!({ reply: 'A的回复', suggestion: null, mode: 'demo' }); await pending
  expect(workspace.active.value.draft.value).toBe('B的草稿')
  expect(workspace.active.value.messages.value).toEqual([])
  workspace.select('a')
  expect(workspace.active.value.messages.value.map(m => m.content)).toEqual(['A的话', 'A的回复'])
  workspace.reset(); expect(workspace.active.value.messages.value).toEqual([])
})

it('keeps generated summaries as drafts without fabricating messages or overwriting the composer', async () => {
  const summary = { overview: '讨论收入', decisions: [], open_questions: ['时间待核实'], next_steps: [] }
  const workspace = createChatWorkspace({
    post: () => ({ promise: Promise.resolve({ reply: '总结草稿', summary, suggestion: null, mode: 'demo' as const }), cancel() {} }),
    cancelRemote: async () => {}, requestId: () => 'summary', onError() {}, onCancelled() {},
  })
  workspace.select('a')
  const session = workspace.active.value
  session.draft.value = '未发送的想法'
  session.messages.value = [{ role: 'user', content: '收入不能大幅降低' }]
  await session.send('a', 'summary')
  expect(session.summary.value).toBeNull()
  expect(session.summaryDraft.value).toEqual(summary)
  expect(session.messages.value).toHaveLength(1)
  expect(session.draft.value).toBe('未发送的想法')
})
