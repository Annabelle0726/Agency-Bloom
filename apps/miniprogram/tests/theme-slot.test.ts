import { expect, it } from 'vitest'
import { formatThemeBoundary, nextThemeBoundary, themeSlotAt } from '../src/theme-preference'

const at = (day: number, hour: number, minute = 0, second = 0) =>
  new Date(2026, 9, day, hour, minute, second).getTime()

it('maps the four local boundaries to slots whose start key does not change at midnight', () => {
  const justBeforeDawn = themeSlotAt(at(24, 4, 59, 59))
  expect(justBeforeDawn.theme).toBe('dark')
  expect(justBeforeDawn.key).toBe('2026-10-23T19')
  expect(justBeforeDawn.end).toBe(at(24, 5))

  const morning = themeSlotAt(at(24, 5))
  expect(morning.theme).toBe('light')
  expect(morning.key).toBe('2026-10-24T05')
  expect(morning.end).toBe(at(24, 10))

  const lateMorning = themeSlotAt(at(24, 9, 59, 59))
  expect(lateMorning.theme).toBe('light')
  expect(lateMorning.key).toBe('2026-10-24T05')

  const day = themeSlotAt(at(24, 10))
  expect(day.theme).toBe('forest')
  expect(day.key).toBe('2026-10-24T10')
  expect(day.end).toBe(at(24, 16))

  const afternoon = themeSlotAt(at(24, 15, 59, 59))
  expect(afternoon.theme).toBe('forest')
  expect(afternoon.key).toBe('2026-10-24T10')

  const dusk = themeSlotAt(at(24, 16))
  expect(dusk.theme).toBe('dawn')
  expect(dusk.key).toBe('2026-10-24T16')
  expect(dusk.end).toBe(at(24, 19))

  const lateDusk = themeSlotAt(at(24, 18, 59, 59))
  expect(lateDusk.theme).toBe('dawn')
  expect(lateDusk.key).toBe('2026-10-24T16')

  const night = themeSlotAt(at(24, 19))
  expect(night.theme).toBe('dark')
  expect(night.key).toBe('2026-10-24T19')
  expect(night.end).toBe(at(25, 5))
})

it('keeps the previous evening key through 00:00 until the 05:00 boundary', () => {
  const beforeMidnight = themeSlotAt(at(24, 23, 59, 59))
  const afterMidnight = themeSlotAt(at(25, 0, 0, 1))
  const earlyMorning = themeSlotAt(at(25, 4, 59, 59))
  expect(beforeMidnight.key).toBe('2026-10-24T19')
  expect(afterMidnight.key).toBe('2026-10-24T19')
  expect(earlyMorning.key).toBe('2026-10-24T19')
  expect(afterMidnight.end).toBe(at(25, 5))
  expect(themeSlotAt(at(25, 5)).key).toBe('2026-10-25T05')
})

it('reports the next boundary and formats it for the appearance hint', () => {
  expect(nextThemeBoundary(at(24, 9, 59))).toBe(at(24, 10))
  expect(nextThemeBoundary(at(24, 23, 59))).toBe(at(25, 5))
  expect(formatThemeBoundary(at(24, 16))).toBe('16:00')
  expect(formatThemeBoundary(at(25, 5))).toBe('05:00')
})
