import { expect, it } from 'vitest'
import { createChatWorkspace } from '../src/chat-workspace'
import type { ChatResponse } from '../src/domain'
import { conversationGreeting } from '../src/conversation-greeting'

it('never presents historical or unverified memory as a current greeting', () => {
  expect(conversationGreeting(true, [
    { content: '过去必须稳定', enabled: true, issue_id: null, status: 'historical' },
    { content: '可能已变的限制', enabled: true, issue_id: null, status: 'needs_review' },
  ])).toBe('今天有什么想聊的？从一个问题或一个念头开始就好')
})

it('greets with enabled scoped memory only after consent, otherwise the provided question', () => {
  const issue = { id: 'a', actual_question: '如何保留收入？' }
  const memories = [
    { content: '别的探索', enabled: true, issue_id: 'b' },
    { content: '停用的记忆', enabled: false, issue_id: null },
    { content: '每周两小时', enabled: true, issue_id: 'a' },
  ]
  expect(conversationGreeting(true, memories, issue)).toContain('每周两小时')
  expect(conversationGreeting(false, memories, issue)).toContain('如何保留收入？')
  expect(conversationGreeting(true, memories.slice(0, 2), issue)).toContain('如何保留收入？')
  expect(conversationGreeting(true, memories)).not.toContain('每周两小时')
  expect(conversationGreeting(false, [], undefined)).toBe('今天有什么想聊的？从一个问题或一个念头开始就好')
})

it('removes a window, discards late replies and preserves another window draft', async () => {
  let reply!: (value: ChatResponse) => void
  const workspace = createChatWorkspace({
    post: () => ({ promise: new Promise(resolve => { reply = resolve }), cancel() {} }),
    cancelRemote: async () => {}, requestId: () => 'deleted', onError() {}, onCancelled() {},
  })
  workspace.select('a'); const old = workspace.active.value; old.draft.value = 'A'
  const pending = old.send('a')
  workspace.select('b'); workspace.active.value.draft.value = 'B'
  workspace.remove('a')
  reply({ reply: '已删除会话的迟到回复', suggestion: null, mode: 'demo' }); await pending
  expect(old.messages.value).toEqual([])
  expect(workspace.sessions.a).toBeUndefined()
  expect(workspace.active.value.draft.value).toBe('B')
  workspace.remove('b'); expect(workspace.activeId.value).toBe('')
})

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
