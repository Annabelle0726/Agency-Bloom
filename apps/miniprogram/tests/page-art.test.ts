import { approvedVisualSources } from './visual-source-assert'
import { describe, expect, it } from 'vitest'
import { resolvePageArt, visibleDecisionFields } from '../src/page-art'
import { themes } from '../src/themes'
import type { Card } from '../src/domain'
const empty: Card = { title: '', options: [], constraints: [], confirmed: [], hypotheses: [], unknowns: [], next_step: '' }
describe('reflection page presentation', () => {
  it('hides repeated empty fields while keeping every populated field and its full content', () => {
    const card = { ...empty, confirmed: ['用户确认的原话'], hypotheses: ['仍待验证的可能'], unknowns: ['需要核实的问题'] }
    expect(visibleDecisionFields(card).map(field => field.key)).toEqual(['confirmed', 'hypotheses', 'unknowns'])
    expect(card.confirmed).toEqual(['用户确认的原话'])
    expect(visibleDecisionFields(empty)).toEqual([])
  })
  it('uses reviewed local or verified cloud artwork for every saved theme and falls back to morning mist', () => {
    for (const theme of themes) {
      const art = resolvePageArt(theme.id)
      expect([art.discover, art.plan, ...art.cards]).toHaveLength(5)
      for (const src of [art.discover, art.plan, ...art.cards]) expect(approvedVisualSources.has(src)).toBe(true)
    }
    expect(resolvePageArt('unknown')).toEqual(resolvePageArt('light'))
    expect(resolvePageArt('dark').discover).not.toEqual(resolvePageArt('light').discover)
  })
})
