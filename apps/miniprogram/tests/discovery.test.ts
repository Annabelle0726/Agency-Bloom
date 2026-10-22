import { describe, expect, it } from 'vitest'
import { discoveryCandidates, emptyDiscoveryState, readDiscoveryState, recordDiscoveryFeedback, selectDiscovery, discoveryStateKey } from '../src/discovery'
import { createChatWorkspace } from '../src/chat-workspace'
import type { Issue } from '../src/domain'
import type { JourneyEvent } from '../src/journey'
const issue = (extra: Partial<Issue> = {}): Issue => ({ id: 'a', title: '工作方向', concerns: [], stage: 'working', background: '', card: { title: '工作方向', options: [], constraints: [], confirmed: [], hypotheses: [], unknowns: [], next_step: '' }, version: 1, created_at: '2026-01-01', updated_at: '2026-01-01', ended_at: null, feedback: [], ...extra })
const now = Date.UTC(2026, 9, 22)
describe('confirmed-source discovery rules', () => {
  it('uses curated fallback without padding a single real recommendation', () => {
    expect(discoveryCandidates([], []).every(c => c.sourceId === 'curated:v1')).toBe(true)
    const list = discoveryCandidates([issue()], [])
    expect(selectDiscovery(list, emptyDiscoveryState(), now)).toHaveLength(1)
    expect(list[0].question).toContain('工作方向')
  })
  it('does not use hypotheses, arbitrary chats, pending insights, or ended issues', () => {
    const item = issue(); item.card.hypotheses = ['UNCONFIRMED']; item.background = 'BACKGROUND_NOT_NEEDED'
    const list = discoveryCandidates([item, issue({ id: 'ended', title: 'OLD', ended_at: '2026-10-01' })], [])
    expect(JSON.stringify(list)).not.toMatch(/UNCONFIRMED|BACKGROUND_NOT_NEEDED|OLD/)
  })
  it('grounds questions in constraints, chosen directions and explicit action records', () => {
    const item = issue(); item.card.constraints = ['保留收入']; item.card.next_step = '一次访谈'
    const record = { id: 'record:1', issue_id: 'a', kind: 'action', text: '完成一次访谈', created_at: '2026-10-22' } as JourneyEvent
    const list = discoveryCandidates([item], [record])
    expect(list.find(c => c.strategy === 'reflect')?.question).toContain('完成一次访谈')
    expect(list.find(c => c.strategy === 'boundary')?.question).toContain('保留收入')
    const before = list.find(c => c.strategy === 'direction')!.id
    item.card.constraints = ['只投入两小时']
    expect(discoveryCandidates([item], []).find(c => c.strategy === 'direction')!.id).not.toBe(before)
  })
  it('does not call generic progress feedback a completed action', () => {
    const e = { id: 'feedback:f', issue_id: 'a', kind: 'progress', text: '还没有开始', created_at: '2026-10-22' } as JourneyEvent
    expect(discoveryCandidates([issue()], [e])[0].title).toBe('沿着这次记录，再想一想')
  })
  it('is stable across visits, clocks, server ordering and metadata-only updates', () => {
    const a = issue(), b = issue({ id: 'b', title: '学习方向' })
    const first = discoveryCandidates([a, b], [])
    a.version++; a.updated_at = '2026-10-23'
    expect(discoveryCandidates([b, a], [])).toEqual(first)
    expect(selectDiscovery(first, emptyDiscoveryState(), now)).toEqual(selectDiscovery(first, emptyDiscoveryState(), now + 300 * 86400000))
  })
  it('deduplicates identical questions and cools down refusals without user traits', () => {
    const a = issue(), b = issue({ id: 'b' })
    expect(discoveryCandidates([a, b], [])).toHaveLength(1)
    const candidates = discoveryCandidates([a], []), chosen = candidates[0]
    const state = recordDiscoveryFeedback(emptyDiscoveryState(), chosen, 'dismissed', now)
    expect(selectDiscovery(candidates, state, now + 86400000)).toEqual([])
    expect(selectDiscovery(candidates, state, now + 91 * 86400000)).toHaveLength(1)
    expect(JSON.stringify(state)).not.toContain('工作方向')
    expect(discoveryStateKey('a')).not.toBe(discoveryStateKey('b'))
  })
  it('rotates only on explicit state and validates persisted state', () => {
    const candidates = discoveryCandidates([], []), state = emptyDiscoveryState()
    const first = selectDiscovery(candidates, state, now, 2)
    expect(selectDiscovery(candidates, readDiscoveryState(JSON.parse(JSON.stringify(state))), now, 2)).toEqual(first)
    expect(selectDiscovery(candidates, { ...state, round: 1 }, now, 2)).not.toEqual(first)
    expect(readDiscoveryState({ version: 1, round: -1, feedback: [] })).toEqual(state)
    expect(readDiscoveryState({ version: 1, round: 0, feedback: [null, { id: 'x' }] }).feedback).toEqual([])
    const explored = recordDiscoveryFeedback(state, first[0], 'explored', now)
    expect(selectDiscovery(candidates, explored, now).some(r => r.id === first[0].id)).toBe(false)
  })
  it('keeps old messages and unsent draft while a fresh draft promotes into the same exploration', () => {
    let seq = 0
    const workspace = createChatWorkspace({ post: () => { throw Error('must not send') }, cancelRemote: async () => {}, requestId: () => `id-${++seq}`, onError: () => {}, onCancelled: () => {} })
    workspace.select('old'); const old = workspace.active.value
    old.messages.value = [{ role: 'user', content: '职业选择' }]; old.draft.value = '还没有说完的话'
    const key = workspace.startDraft('same-issue', '可修改的问题')
    expect(workspace.active.value.messages.value).toEqual([])
    expect(workspace.drafts[key].issueId).toBe('same-issue')
    workspace.active.value.draft.value = '我的修改'
    workspace.select('old'); expect(workspace.active.value.draft.value).toBe('还没有说完的话')
    workspace.promote(key, 'new-id')
    expect(workspace.activeId.value).toBe('old')
    expect(workspace.get('new-id').draft.value).toBe('我的修改')
    expect(old.messages.value).toHaveLength(1)
    workspace.reset(); expect(Object.keys(workspace.drafts)).toEqual([])
  })
})
