import { describe, expect, it } from 'vitest'
import { journeyDate, mergeJourneyEvents, reflectionFor } from '../src/journey'
import type { JourneyEvent } from '../src/journey'
import type { Issue } from '../src/domain'
const event = (id: string, created_at: string, kind = 'thought', text = '我想试一次') => ({
  id, issue_id: 'a', issue_title: '这段探索', kind, title: '留下一个想法', text, created_at, editable: true,
  source_label: '你确认留下的记录', source_available: false,
}) satisfies JourneyEvent

describe('journey evidence and dates', () => {
  it('does not infer a retrospective from a card, empty history, or a start alone', () => {
    const issues = [{ id: 'a', title: '当前标题', card: { next_step: '尚未行动' } }] as Issue[]
    expect(reflectionFor([], issues)).toBeNull()
    expect(reflectionFor([event('start:a', '2026-10-01', 'start')], issues)).toBeNull()
    expect(reflectionFor([event('snapshot:a', '2026-10-01', 'snapshot')], issues)).toBeNull()
  })
  it('quotes confirmed text and bounds the first-screen retrospective', () => {
    const text = '我真实留下的想法'.repeat(50)
    const result = reflectionFor([event('record:a', '2026-10-21T16:30:00+00:00', 'thought', text)], [{ id: 'a', title: '探索' }] as Issue[])
    expect(result?.quote.length).toBe(141)
    expect(result?.quote).toBe(text.slice(0, 140) + '…')
    expect(result?.date).toBe('2026年10月22日')
  })
  it('uses the product time zone across day and year boundaries', () => {
    expect(journeyDate('2026-12-31T18:00:00+00:00')).toBe('2027年1月1日')
    expect(journeyDate('bad date')).toBe('日期未记录')
  })
  it('deduplicates page boundaries and keeps deterministic chronology', () => {
    const a = event('record:a', '2026-10-21'), b = event('record:b', '2026-10-22')
    expect(mergeJourneyEvents([a], [a, b]).map(item => item.id)).toEqual(['record:b', 'record:a'])
  })
})
