import { approvedVisualSources } from './visual-source-assert'
import { effectScope, ref } from 'vue'
import { describe, it, expect, vi } from 'vitest'
import { useBloomMoment, momentDraft, momentVisual, type MomentContent } from '../src/bloom-moment'
import type { User } from '../src/domain'
const content: MomentContent = { kind: 'light', title: '一小片天空', invitation: '给云取个名字', question: '像什么？', sources: [] }
const item = { id: 'one', status: 'completed', content, dismissed: false, demo: false }
function fixture() {
  const user = ref({ id: 'a', ai_consent: true, save_chat: true, use_memory: false } as User)
  let current: any = null
  const request = vi.fn(async (method, path) => {
    if (method === 'GET') return { day: '2026-10-23', moment: current }
    if (path.endsWith('/dismiss')) { current = { ...current, content: null, dismissed: true }; return }
    if (path === '/me') return { ...user.value, ai_consent: true }
    current = item; return { day: '2026-10-23', moment: current }
  })
  const scope = effectScope()
  const state = scope.run(() => useBloomMoment(user, request as any, () => 'request-one'))!
  return { user, state, request, scope }
}
describe('Bloom Moment explicit interaction', () => {
  it('reads without generating; repeated opening does not POST again', async () => {
    const f = fixture(); await f.state.load()
    expect(f.request.mock.calls.every(c => c[0] === 'GET')).toBe(true)
    await f.state.open(); await f.state.open()
    expect(f.request.mock.calls.filter(c => c[0] === 'POST')).toHaveLength(1)
    f.scope.stop()
  })
  it('dismissal never generates; another is a separate deliberate request', async () => {
    const f = fixture(); await f.state.open(); await f.state.dismiss()
    expect(f.state.moment.value?.dismissed).toBe(true)
    expect(f.request.mock.calls.filter(c => c[1] === '/moments/open')).toHaveLength(1)
    await f.state.open(true)
    expect(f.request.mock.calls.filter(c => c[1] === '/moments/open')).toHaveLength(2)
    f.scope.stop()
  })
  it('requires consent and does not send another chat draft when agreeing', async () => {
    const f = fixture(); f.user.value = { ...f.user.value, ai_consent: false }
    await f.state.open(); expect(f.state.consentOpen.value).toBe(true)
    expect(f.request).not.toHaveBeenCalled()
    await f.state.consent()
    expect(f.request.mock.calls.some(c => c[1] === '/moments/open')).toBe(true)
    expect(f.request.mock.calls.some(c => c[1].includes('/chat'))).toBe(false)
    f.scope.stop()
  })
  it('late replies cannot leak into another account and a failure is not retried', async () => {
    const f = fixture(); let release: (r: any) => void = () => {}
    f.request.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    const pending = f.state.load(); f.user.value = { ...f.user.value, id: 'b' }
    release({ day: '2026-10-23', moment: item }); await pending
    expect(f.state.moment.value).toBeNull()
    f.request.mockRejectedValueOnce(new Error('offline'))
    await f.state.open(); expect(f.state.error.value).toBe('offline')
    expect(f.request.mock.calls.filter(c => c[0] === 'POST')).toHaveLength(0)
    f.scope.stop()
  })
  it('double taps while loading cannot send twice', async () => {
    const f = fixture(); await Promise.all([f.state.open(), f.state.open()])
    expect(f.request.mock.calls.filter(c => c[1] === '/moments/open')).toHaveLength(1)
    f.scope.stop()
  })
  it('labels AI material in an editable draft and never claims it as user history', () => {
    expect(momentDraft(content)).toContain('AI 给出的邀请（不是我的经历）')
    expect(momentDraft({ ...content, sources: [{ id: 'm', quote: '曾喜欢解释技术', date: '2026-01-01', version: 1 }] })).toContain('现在可能不同')
  })
  it('resolves only actual local assets for all themes and flavors', () => {
    for (const theme of ['light', 'dark', 'dawn', 'forest', 'lavender', 'minimal']) {
      for (const kind of ['light', 'echo', 'perspective', 'experiment'] as const) {
        const art = momentVisual(kind, theme, '2026-10-23')
        if (art) { expect(art.theme).toBe(theme); expect(approvedVisualSources.has(art.src)).toBe(true) }
      }
    }
  })
})
