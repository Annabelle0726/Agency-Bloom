import { describe, expect, it } from 'vitest'
import { relevantAngles, discoveryTitle, discoveryDraft, discoveryDestination } from '../src/discover-angles'
import type { Issue } from '../src/domain'
const make = (extra: Partial<Issue> = {}): Issue => ({ id: 'a', title: '', concerns: [], stage: '', background: '', card: { title: '', options: [], constraints: [], confirmed: [], hypotheses: [], unknowns: [], next_step: '' }, version: 1, created_at: '2026-10-24', updated_at: '2026-10-24', ended_at: null, feedback: [], ...extra })
describe('grounded Discover angles', () => {
  it.each([
    ['责任太多，精力不够', '分担'],
    ['投递简历后没有反馈', '具体的一步'],
    ['AI 改变了工作需要的技能', '任务怎样变化'],
  ])('supports selected-only clues: %s', (selection, title) => {
    const issue = make({ follow_ups: { concern: { selections: [selection], refinements: {}, note: '' } } })
    const angle = relevantAngles(issue, [])[0]
    expect(angle.evidence).toBe(selection)
    expect(angle.title).toContain(title)
  })
  it('prefers the active matching conversation, then the most recent unarchived match', () => {
    const conversations = [
      { id: 'old', issue_id: 'a', updated_at: '2026-10-22', archived_at: null },
      { id: 'new', issue_id: 'a', updated_at: '2026-10-24', archived_at: null },
      { id: 'archived', issue_id: 'a', updated_at: '2026-10-25', archived_at: '2026-10-25' },
      { id: 'other', issue_id: 'b', updated_at: '2026-10-25', archived_at: null },
    ] as any
    expect(discoveryDestination(conversations, 'a', 'old')?.id).toBe('old')
    expect(discoveryDestination(conversations, 'a', 'other')?.id).toBe('new')
    expect(discoveryDestination(conversations, 'missing')).toBeNull()
  })
  it('keeps a long source editable within the message limit with an explicit excerpt label', () => {
    const angle = relevantAngles(make({ actual_question: '真实线索'.repeat(800) }), [])[0]
    expect(discoveryDraft(angle).length).toBeLessThan(2000)
    expect(discoveryDraft(angle)).toContain('节选')
    expect(angle.evidence).toHaveLength(3200)
  })
  it('does not fill an empty or ended exploration with generic questions', () => {
    expect(relevantAngles(make(), [])).toEqual([])
    expect(relevantAngles(make({ title: '旧目标', ended_at: '2026-10-25' }), [])).toEqual([])
  })
  it('preserves selected answers and refinements as dated initial clues', () => {
    const issue = make({ concerns: ['relationships'], follow_ups: { relationships: { selections: ['自己的想法和家人的期待不同'], note: '', refinements: { '自己的想法和家人的期待不同': ['知道自己想要什么，但难以表达'] } } } })
    const angle = relevantAngles(issue, [])[0]
    expect(discoveryTitle(issue)).toContain('关系')
    expect(angle.evidence).toContain('知道自己想要什么，但难以表达')
    expect(angle.sourceLabel).toContain('初次')
    expect(angle.sourceDate).toBe('2026-10-24')
    expect(angle.angle).toContain('表达')
    expect(discoveryDraft(angle)).toContain(angle.evidence)
  })
  it('uses only records in this exploration and keeps optional investigations separate', () => {
    const issue = make({ title: '转向', card: { ...make().card, constraints: ['近期需要稳定收入'] } })
    const angles = relevantAngles(issue, [{ id: 'record:b', issue_id: 'b', text: 'PRIVATE', kind: 'action', created_at: '2026-10-25' } as any])
    expect(JSON.stringify(angles)).not.toContain('PRIVATE')
    expect(angles[0].investigation).toBeTruthy()
    expect(angles[0].evidence).toContain('稳定收入')
    issue.card.constraints = []
    expect(relevantAngles(issue, []).some(a => a.id === angles[0].id)).toBe(false)
  })
  it('does not prescribe action to a user who selected rest or listening', () => {
    expect(relevantAngles(make({ concerns: ['overload'], focus_response: '现在只想缓一缓，不急着找办法' }), [])).toEqual([])
  })
})
