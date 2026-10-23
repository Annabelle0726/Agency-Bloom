import { expect, it } from 'vitest'
import { resolveBloomStatus } from '../src/bloom-status'

it('shows Bloom as online when available and idle', () => {
  expect(resolveBloomStatus(false, false)).toBe('online')
})

it('shows Bloom as waiting while a reply is in flight, even over a previous error', () => {
  expect(resolveBloomStatus(true, false)).toBe('waiting')
  expect(resolveBloomStatus(true, true)).toBe('waiting')
})

it('shows Bloom as offline when the service or latest AI request is unavailable', () => {
  expect(resolveBloomStatus(false, true)).toBe('offline')
})
