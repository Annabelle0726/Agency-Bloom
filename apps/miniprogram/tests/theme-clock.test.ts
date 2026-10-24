import { afterEach, expect, it, vi } from 'vitest'
import { createThemeClock } from '../src/theme-clock'

afterEach(() => { vi.useRealTimers() })

it('updates the reactive slot at the next boundary and reschedules', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 24, 9, 59, 50))
  const clock = createThemeClock()
  clock.start()
  expect(clock.slot.value.theme).toBe('light')
  expect(clock.slot.value.key).toBe('2026-10-24T05')

  vi.advanceTimersByTime(10_300)
  expect(clock.slot.value.theme).toBe('forest')
  expect(clock.slot.value.key).toBe('2026-10-24T10')
  expect(clock.slot.value.end).toBe(new Date(2026, 9, 24, 16).getTime())
  clock.stop()
})

it('keeps the night slot across midnight and switches at 05:00', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 24, 23, 59, 50))
  const clock = createThemeClock()
  clock.start()
  const nightKey = clock.slot.value.key
  expect(nightKey).toBe('2026-10-24T19')
  expect(clock.slot.value.theme).toBe('dark')

  vi.advanceTimersByTime(10_300)
  expect(clock.slot.value.key).toBe(nightKey)
  expect(clock.slot.value.theme).toBe('dark')

  vi.advanceTimersByTime(5 * 60 * 60 * 1000)
  expect(clock.slot.value.key).toBe('2026-10-25T05')
  expect(clock.slot.value.theme).toBe('light')
  clock.stop()
})

it('refresh catches up after a background gap and moves the boundary timer', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 24, 9, 59, 50))
  const clock = createThemeClock()
  clock.start()
  expect(clock.slot.value.theme).toBe('light')

  vi.setSystemTime(new Date(2026, 9, 24, 16, 0, 5))
  clock.refresh()
  expect(clock.slot.value.theme).toBe('dawn')
  expect(clock.slot.value.key).toBe('2026-10-24T16')

  vi.advanceTimersByTime(3 * 60 * 60 * 1000)
  expect(clock.slot.value.theme).toBe('dark')
  expect(clock.slot.value.key).toBe('2026-10-24T19')
  clock.stop()
})

it('stops scheduling after unmount', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 24, 9, 59, 50))
  const clock = createThemeClock()
  clock.start()
  clock.stop()
  vi.advanceTimersByTime(24 * 60 * 60 * 1000)
  expect(clock.slot.value.key).toBe('2026-10-24T05')
  expect(clock.now.value).toBe(new Date(2026, 9, 24, 9, 59, 50).getTime())
})
