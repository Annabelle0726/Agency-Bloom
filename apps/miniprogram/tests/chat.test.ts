import { expect, it, vi } from 'vitest'
import { createChatSession } from '../src/chat'
import { ApiError } from '../src/http'
import type { ChatResponse } from '../src/domain'

function harness(requestId: () => string = () => 'one-request') {
  let resolve!: (reply: ChatResponse) => void
  let reject!: (error: Error) => void
  const abort = vi.fn(() => reject(new ApiError('已停止回复', 0, true)))
  const post = vi.fn(() => ({ promise: new Promise<ChatResponse>((yes, no) => { resolve = yes; reject = no }), cancel: abort }))
  const remote = vi.fn(async () => {})
  const error = vi.fn(), notice = vi.fn()
  const chat = createChatSession({ post, cancelRemote: remote, onError: error, onCancelled: notice, requestId })
  return { chat, post, abort, remote, error, notice, resolve: (value: ChatResponse) => resolve(value), reject: (value: Error) => reject(value) }
}

it('keeps an exception visible until a subsequent reply succeeds', async () => {
  const h = harness()
  h.chat.draft.value = '保留的问题'
  const first = h.chat.send('c')
  h.reject(new Error('回复格式异常')); await first
  expect(h.chat.error.value).toBe('回复格式异常')
  const second = h.chat.send('c')
  expect(h.chat.error.value).toBe('回复格式异常')
  expect(h.chat.draft.value).toBe('保留的问题')
  h.resolve({reply:'已恢复，可以继续聊',suggestion:null,mode:'demo'}); await second
  expect(h.chat.error.value).toBe('')
})

it('keeps the failed request reference during a new attempt and isolates other sessions', async () => {
  let id = 0
  const first = harness(() => `request-${++id}`), other = harness()
  first.chat.draft.value = '问题'
  let pending = first.chat.send('first')
  first.reject(new Error('首次失败')); await pending
  expect(first.chat.errorRequestId.value).toBe('request-1')
  pending = first.chat.send('first')
  expect(first.chat.lastRequestId.value).toBe('request-2')
  expect(first.chat.errorRequestId.value).toBe('request-1')
  other.chat.draft.value = '另一个会话'
  const another = other.chat.send('other')
  other.resolve({reply:'正常',suggestion:null,mode:'demo'}); await another
  expect(first.chat.error.value).toBe('首次失败')
  first.reject(new Error('再次失败')); await pending
  expect(first.chat.errorRequestId.value).toBe('request-2')
})

it('edits a branch only after success, preserves draft on failure, and omits old summary', async () => {
  const h = harness()
  h.chat.messages.value = [
    { id: 'u1', role: 'user', content: '之前' }, { id: 'a1', role: 'assistant', content: '回复' },
    { id: 'u2', role: 'user', content: '写错了' }, { id: 'a2', role: 'assistant', content: '旧回复' },
  ]
  h.chat.draft.value = '未发送草稿'
  h.chat.summary.value = { overview: '旧总结', decisions: [], open_questions: [], next_steps: [] }
  h.chat.beginEdit(2)
  h.chat.editText.value = '修改后的消息'
  const first = h.chat.send('c', 'chat', true)
  expect(h.post.mock.calls[0][1]).toMatchObject({
    edit_message_id: 'u2', edit_tail_id: 'a2', session_summary: null,
    history: [{ role: 'user', content: '之前' }, { role: 'assistant', content: '回复' }],
  })
  h.reject(new Error('失败'))
  await first
  expect(h.chat.messages.value[2].content).toBe('写错了')
  expect(h.chat.editText.value).toBe('修改后的消息')
  const second = h.chat.send('c', 'chat', true)
  h.resolve({ reply: '新回复', suggestion: null, mode: 'demo', user_message_id: 'u3', assistant_message_id: 'a3' })
  await second
  expect(h.chat.messages.value.map(m => m.content)).toEqual(['之前', '回复', '修改后的消息', '新回复'])
  expect(h.chat.messages.value[2].id).toBe('u3')
  expect(h.chat.summary.value).toBeNull()
  expect(h.chat.editIndex.value).toBeNull()
  expect(h.chat.draft.value).toBe('未发送草稿')
})

it('edits non-retained history in memory and keeps the target after earlier rows load', async () => {
  const h = harness()
  h.chat.messages.value = [{ role: 'user', content: '原文' }, { role: 'assistant', content: '旧回答' }]
  h.chat.beginEdit(0)
  h.chat.messages.value.unshift({ role: 'user', content: '更早的内容' })
  h.chat.editText.value = '修正'
  const pending = h.chat.send('c', 'chat', true)
  expect(h.post.mock.calls[0][1].edit_message_id).toBeUndefined()
  expect(h.post.mock.calls[0][1].history).toEqual([{ role: 'user', content: '更早的内容' }])
  h.resolve({ reply: '新回答', suggestion: null, mode: 'demo' })
  await pending
  expect(h.chat.messages.value.map(m => m.content)).toEqual(['更早的内容', '修正', '新回答'])
  h.chat.beginEdit(2)
  expect(h.chat.editIndex.value).toBeNull()
})

it('cancelled editing keeps original messages and the edit draft', async () => {
  const h = harness()
  h.chat.messages.value = [{ role: 'user', content: '原文' }, { role: 'assistant', content: '旧回答' }]
  h.chat.beginEdit(0)
  h.chat.editText.value = '修正'
  const pending = h.chat.send('c', 'chat', true)
  h.chat.cancel()
  await pending
  expect(h.chat.messages.value[0].content).toBe('原文')
  expect(h.chat.editText.value).toBe('修正')
  h.chat.closeEdit()
  expect(h.chat.editIndex.value).toBeNull()
})

it('keeps a phase candidate unconfirmed and suppresses it after skipping in this session', async () => {
  const h = harness()
  const change = { source_id: 'memory-1', source_kind: 'memory' as const, source_version: 2, previous: '稳定工作', evidence: '现在更想探索成长空间' }
  h.chat.draft.value = change.evidence
  const pending = h.chat.send('conversation-a')
  h.resolve({ reply: '先聊聊现在的想法', suggestion: null, mode: 'deepseek', phase_change: change })
  await pending
  expect(h.chat.phaseChange?.value).toEqual(change)
  expect(h.chat.phaseConfirmed.value).toBe(false)
  h.chat.confirmPhaseChange()
  expect(h.chat.phaseConfirmed.value).toBe(true)
  expect(h.post).toHaveBeenCalledTimes(1)
  h.chat.skipPhaseChange()
  expect(h.chat.phaseChange.value).toBeNull()
  h.chat.draft.value = '继续聊工作'
  const again = h.chat.send('conversation-a')
  expect(h.post.mock.calls[1][1].dismissed_changes).toEqual(['memory-1'])
  h.resolve({ reply: '好的', suggestion: null, mode: 'deepseek', phase_change: change })
  await again
  expect(h.chat.phaseChange.value).toBeNull()
  h.chat.reset()
  expect(h.chat.phaseConfirmed.value).toBe(false)
})

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
  h.chat.messages.value = Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? 'assistant' as const : 'user' as const, content: String(i) }))
  h.chat.draft.value = '程序员和 AI 产品经理怎么选'
  const pending = h.chat.send('issue')
  expect(h.post.mock.calls[0][1].history).toHaveLength(32)
  expect(h.post.mock.calls[0][1].history[0].content).toBe('8')
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

const insight = { title: '还有一种可能' as const, observation: '开发经历与解释复杂问题的经历', possibility: '探索技术与业务的连接', uncertainty: '仍需要了解实际工作', evidence: ['开发经历', '解释复杂问题'],
  experiment: { action: '向朋友解释一个技术概念', tests: '是否享受解释的过程', effort: '二十分钟，不花钱', stop_rule: '不愿继续就停止' } }

it('keeps optional insights in memory and clears them on session reset', async () => {
  const h = harness(); h.chat.draft.value = '看看我的经历'
  const pending = h.chat.send('issue'); h.resolve({ reply: '一个待探索角度', suggestion: null, insight, mode: 'deepseek' }); await pending
  expect(h.chat.insight.value).toEqual(insight)
  h.chat.reset(); expect(h.chat.insight.value).toBeNull()
})

it('interest prepares a follow-up without sending or overwriting existing input', () => {
  const h = harness(); h.chat.insight.value = insight; h.chat.draft.value = '我还有一点补充'
  h.chat.reactToInsight('interested'); h.chat.reactToInsight('interested')
  expect(h.chat.draft.value).toContain('我还有一点补充')
  expect(h.chat.draft.value).toContain('探索技术与业务的连接')
  expect(h.chat.draft.value.match(/探索技术与业务的连接/g)).toHaveLength(1)
  expect(h.post).not.toHaveBeenCalled()
})

it('rejection dismisses an insight without saving or requesting another response', () => {
  const h = harness(); h.chat.insight.value = insight
  h.chat.reactToInsight('dismissed')
  expect(h.chat.insight.value).toBeNull()
  expect(h.chat.draft.value).toBe('')
  expect(h.post).not.toHaveBeenCalled()
})

it('trying an experiment prepares review data without auto-saving or calling the model', () => {
  const h = harness(); h.chat.insight.value = insight
  expect(h.chat.reactToInsight('experiment')).toEqual(insight.experiment)
  expect(h.chat.suggestion.value).toBeNull()
  expect(h.post).not.toHaveBeenCalled()
})

it('prepares an editable request when the insight has no experiment', () => {
  const h = harness(); h.chat.insight.value = { ...insight, experiment: null }
  h.chat.reactToInsight('experiment')
  expect(h.chat.draft.value).toContain('低成本')
  expect(h.post).not.toHaveBeenCalled()
})

it('sends a rejected angle as bounded session feedback, then forgets it on reset', async () => {
  const h = harness(); h.chat.insight.value = insight; h.chat.reactToInsight('dismissed')
  h.chat.draft.value = '换个角度看看'
  const pending = h.chat.send('issue')
  expect(h.post.mock.calls[0][1].insight_feedback).toEqual([{ possibility: '探索技术与业务的连接', reaction: 'dismissed' }])
  h.resolve({ reply: '好，我们换个起点', suggestion: null, mode: 'deepseek' }); await pending
  h.chat.reset(); h.chat.draft.value = '重新开始'
  const next = h.chat.send('another-issue')
  expect(h.post.mock.calls[1][1].insight_feedback).toEqual([])
  h.resolve({ reply: '好', suggestion: null, mode: 'deepseek' }); await next
})

it('does not truncate a full user draft or falsely mark a follow-up as prepared', () => {
  const h = harness(); h.chat.insight.value = insight; h.chat.draft.value = '原'.repeat(4000)
  h.chat.reactToInsight('interested')
  expect(h.chat.draft.value).toBe('原'.repeat(4000))
  expect(h.chat.insightReaction.value).toBe('')
})

const suppliedContext = {
  memories: [{ id: 'm1', content: '每周最多投入两小时', category: 'constraint' as const }],
  summary: true, history_count: 2, history_retained: true, linked_explorations: [],
}

it('stores the supplied context with the reply for later disclosure', async () => {
  const h = harness()
  h.chat.draft.value = '最近时间紧张'
  const pending = h.chat.send('issue')
  h.resolve({ reply: '这个限制现在还适用吗', suggestion: null, mode: 'deepseek', supplied_context: suppliedContext })
  await pending
  expect(h.chat.suppliedContext.value).toEqual(suppliedContext)
  const reply = h.chat.messages.value[1]
  expect(reply.payload?.supplied_context).toEqual(suppliedContext)
})

it('keeps an empty inventory honest when no context was supplied', async () => {
  const h = harness()
  h.chat.draft.value = '你好'
  const pending = h.chat.send('issue')
  h.resolve({ reply: '今天过得怎么样？', suggestion: null, mode: 'deepseek' })
  await pending
  expect(h.chat.suppliedContext.value).toBeNull()
  expect(h.chat.messages.value[1].payload?.supplied_context).toBeNull()
})

it('clears the supplied context on session reset', async () => {
  const h = harness()
  h.chat.draft.value = '你好'
  const pending = h.chat.send('issue')
  h.resolve({ reply: '好', suggestion: null, mode: 'deepseek', supplied_context: suppliedContext })
  await pending
  h.chat.reset()
  expect(h.chat.suppliedContext.value).toBeNull()
})

it('tracks the active wait from submission and clears it after failure without losing the draft', async () => {
  const h = harness()
  h.chat.draft.value = '长消息也只在等待消息中展示'
  const before = Date.now()
  const pending = h.chat.send('issue')
  expect(h.chat.sendingStartedAt.value).toBeGreaterThanOrEqual(before)
  const started = h.chat.sendingStartedAt.value
  await h.chat.send('issue')
  expect(h.chat.sendingStartedAt.value).toBe(started)
  h.reject(new ApiError('请求超时'))
  await pending
  expect(h.chat.sendingStartedAt.value).toBe(0)
  expect(h.chat.draft.value).toBe('长消息也只在等待消息中展示')
})
