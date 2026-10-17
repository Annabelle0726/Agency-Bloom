import { describe, expect, it } from 'vitest'
import { toggleConcern, makePreview, mergeSuggestion, experimentProposal } from '../src/domain'

describe('onboarding and confirmation boundaries', () => {
  it('allows several concerns and toggles without duplicate entries', () => {
    expect(toggleConcern(['direction'], 'choices')).toEqual(['direction', 'choices'])
    expect(toggleConcern(['direction', 'choices'], 'direction')).toEqual(['choices'])
  })
  it('preview retains what the person said without inventing facts or options', () => {
    const card = makePreview({ title: '我想转行', concerns: ['direction'], stage: 'working', background: '三年设计经验', constraints: ['收入稳定'] })
    expect(card.confirmed).toEqual(['三年设计经验'])
    expect(card.options).toEqual([])
    expect(card.constraints).toEqual(['收入稳定'])
    expect(card.unknowns.length).toBeGreaterThan(0)
  })
  it('AI proposals preserve confirmed facts and do not mutate the saved card', () => {
    const saved = { title: '方向', options: [], constraints: ['收入稳定'], confirmed: ['设计师'], hypotheses: [], unknowns: [], next_step: '' }
    const merged = mergeSuggestion(saved, { options: ['产品方向'], hypotheses: ['也许喜欢调研'], unknowns: ['实际日常工作'], next_step: '访谈一次' })
    expect(merged.confirmed).toEqual(['设计师'])
    expect(saved.options).toEqual([])
    expect(merged.options).toEqual(['产品方向'])
  })
  it('experiment review creates an editable draft while preserving facts and the saved card', () => {
    const saved = { title: '', options: [], constraints: ['每周两小时'], confirmed: ['开发经历'], hypotheses: [], unknowns: [], next_step: '' }
    const draft = experimentProposal(saved, { action: '解释一个技术概念', tests: '是否享受解释的过程', effort: '二十分钟', stop_rule: '不想继续就停止' })
    expect(draft.next_step).toContain('验证：是否享受解释的过程')
    expect(draft.next_step).toContain('投入：二十分钟')
    expect(draft.confirmed).toEqual(['开发经历'])
    expect(draft.constraints).toEqual(['每周两小时'])
    expect(saved.next_step).toBe('')
    expect(draft.title).toBe('')
  })
})
