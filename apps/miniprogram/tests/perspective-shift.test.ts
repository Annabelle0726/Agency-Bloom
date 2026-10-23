import { afterEach, expect, it, vi } from 'vitest'
import { publicPerspective, prototypeAllowed } from '../src/perspective-shift'
import type { ChatMessage, PerspectiveShift } from '../src/domain'

const token = 'a'.repeat(64)
const candidate: PerspectiveShift = {
  title: '换个角度', observation: '我们比较了兴趣，还没有核实实际条件',
  possible_blind_spot: '也许遗漏了收入保障这一条件', alternative_perspective: '可以先保留现职，了解内部产品协作机会',
  uncertainty: '团队是否支持仍然需要核实', optional_next_question: null,
  supporting_message_ids: ['u1', 'u2'], trigger: 'new_constraint',
  evidence: [
    { message_id: 'u1', quote: '我喜欢整理业务需求', supports: ['observation'] },
    { message_id: 'u2', quote: '不能裸辞，需要稳定收入', supports: ['possible_blind_spot', 'alternative_perspective'] },
  ],
}
const messages: ChatMessage[] = [
  { id: 'u1', role: 'user', content: '我喜欢整理业务需求' },
  { id: 'a1', role: 'assistant', content: '先了解产品工作' },
  { id: 'u2', role: 'user', content: '不能裸辞，需要稳定收入' },
  { id: 'a2', role: 'assistant', content: '我们也可以先了解内部机会', payload: { perspective_shift: candidate, perspective_token: token } },
]
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

it('is off by default and only permits the isolated Mock build URL', () => {
  expect(prototypeAllowed(undefined, undefined)).toBe(false)
  expect(prototypeAllowed('true', 'https://api.example.com/api')).toBe(false)
  expect(prototypeAllowed('true', 'http://127.0.0.1:8019/api')).toBe(true)
})
it('accepts anchored public evidence and hides cross-session or missing sources', () => {
  expect(publicPerspective(candidate, token, messages)).toEqual(candidate)
  expect(publicPerspective(candidate, token, messages.slice(2))).toBeNull()
  expect(publicPerspective(candidate, 'invalid', messages)).toBeNull()
  expect(publicPerspective({ ...candidate, supporting_message_ids: ['u1', 'foreign'] }, token, messages)).toBeNull()
})
it('hides malformed, internal, ungrounded and unsupported-claim payloads', () => {
  for (const invalid of [null, {}, [], { ...candidate, uncertainty: '<think>hidden</think>' },
    { ...candidate, evidence: [] },
    { ...candidate, evidence: candidate.evidence.map(e => ({ ...e, quote: '没有说过的事实' })) },
    { ...candidate, evidence: candidate.evidence.map(e => ({ ...e, supports: ['observation'] })) }]) {
    expect(publicPerspective(invalid, token, messages)).toBeNull()
  }
})
async function harness(enabled = true) {
  vi.stubEnv('VITE_PERSPECTIVE_PROTOTYPE', enabled ? 'true' : 'false')
  vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:8019/api')
  vi.resetModules()
  const { createChatSession } = await import('../src/chat')
  const post = vi.fn(() => ({ promise: Promise.resolve({ reply: '离线回复', suggestion: null, mode: 'demo' as const }), cancel: vi.fn() }))
  const session = createChatSession({ post, cancelRemote: async () => {}, requestId: () => 'one', onError: vi.fn(), onCancelled: vi.fn() })
  session.messages.value = structuredClone(messages)
  return { session, post }
}
it('follow prepares an editable draft, preserves existing text and never sends automatically', async () => {
  const { session, post } = await harness()
  session.draft.value = '我还想补充一点'
  session.reactToPerspective('follow', 3)
  expect(session.draft.value).toContain('我还想补充一点')
  expect(session.draft.value).toContain(candidate.alternative_perspective)
  const once = session.draft.value
  session.reactToPerspective('follow', 3)
  expect(session.draft.value).toBe(once)
  expect(post).not.toHaveBeenCalled()
  expect(session.messages.value).toEqual(messages)
})
it('dismiss suppresses the angle and carries explicit feedback on the next ordinary call only', async () => {
  const { session, post } = await harness()
  session.reactToPerspective('dismiss', 3)
  expect(session.perspectiveDismissed.value).toEqual([token])
  expect(post).not.toHaveBeenCalled()
  session.draft.value = '这是我新的输入'
  await session.send('conversation')
  expect(post).toHaveBeenCalledTimes(1)
  expect(post.mock.calls[0][1].perspective_control).toEqual({ disabled: false, dismissed: [token] })
})
it('close suppresses every hint in this session and does not infer or persist a profile', async () => {
  const { session, post } = await harness()
  session.reactToPerspective('disable', 3)
  expect(session.perspectiveDisabled.value).toBe(true)
  session.reactToPerspective('follow', 3)
  expect(session.draft.value).toBe('')
  expect(post).not.toHaveBeenCalled()
  session.draft.value = '新的限制'
  await session.send('c')
  expect(post.mock.calls[0][1].perspective_control.disabled).toBe(true)
})
it('default build does not send new controls or change frozen request content', async () => {
  const { session, post } = await harness(false)
  session.reactToPerspective('follow', 3)
  expect(session.draft.value).toBe('')
  session.draft.value = '固定输入'
  await session.send('c')
  expect(post.mock.calls[0][1]).not.toHaveProperty('perspective_control')
})
it('sending disables reactions; sessions do not share rejection state', async () => {
  const a = await harness(), b = await harness()
  a.session.sending.value = true
  a.session.reactToPerspective('disable', 3)
  expect(a.session.perspectiveDisabled.value).toBe(false)
  a.session.sending.value = false
  a.session.reactToPerspective('disable', 3)
  expect(b.session.perspectiveDisabled.value).toBe(false)
})
