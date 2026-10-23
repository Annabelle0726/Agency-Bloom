import { describe, expect, it } from 'vitest'
import { homeQuotes, selectHomeQuote } from '../src/home-quotes'
import { createHomeQuoteRotation, HOME_QUOTE_KEY } from '../src/use-home-quote'

describe('home quotation catalogue and rotation', () => {
  it('keeps original quotations in a separate catalogue with stable unique ids', () => {
    expect(homeQuotes.length).toBeGreaterThanOrEqual(10)
    expect(new Set(homeQuotes.map(quote => quote.id)).size).toBe(homeQuotes.length)
    for (const quote of homeQuotes) {
      expect(quote.id).toMatch(/^[a-z-]+$/)
      expect(quote.text.trim()).toBeTruthy()
      expect(quote.source).toBe('Agency Bloom')
      expect(quote.text.split('\n').length).toBeLessThanOrEqual(3)
    }
  })

  it('can reach every alternative while always excluding the previous quotation', () => {
    for (const previous of homeQuotes) {
      const seen = new Set<string>()
      for (let index = 0; index < homeQuotes.length - 1; index++) {
        const next = selectHomeQuote(previous.id, () => (index + .5) / (homeQuotes.length - 1))
        expect(next.id).not.toBe(previous.id)
        seen.add(next.id)
      }
      expect(seen.size).toBe(homeQuotes.length - 1)
    }
    expect(homeQuotes).toContain(selectHomeQuote('removed-id', () => 1))
    expect(homeQuotes).toContain(selectHomeQuote(undefined, () => Number.NaN))
  })

  it('persists only an id and does not repeat on a cold application launch', () => {
    const memory = new Map<string, unknown>()
    const storage = { getStorageSync: (key: string) => memory.get(key),
      setStorageSync: (key: string, value: string) => memory.set(key, value) }
    const firstSession = createHomeQuoteRotation(storage, () => 0)
    firstSession.refresh()
    const previous = firstSession.quote.value
    expect(memory.get(HOME_QUOTE_KEY)).toBe(previous.id)
    const nextSession = createHomeQuoteRotation(storage, () => 0)
    nextSession.refresh()
    expect(nextSession.quote.value.id).not.toBe(previous.id)
    expect([...memory.keys()]).toEqual([HOME_QUOTE_KEY])
  })

  it('stays stable between foreground events and advances when the app returns', () => {
    const storage = { getStorageSync: () => '', setStorageSync: () => {} }
    const session = createHomeQuoteRotation(storage, () => .4)
    session.refresh()
    const first = session.quote.value
    expect(session.quote.value).toBe(first)
    session.refresh()
    expect(session.quote.value.id).not.toBe(first.id)
    expect(session.quote.value).toBe(session.quote.value)
  })

  it('keeps working and avoids in-session repeats if local storage is unavailable', () => {
    const session = createHomeQuoteRotation({
      getStorageSync() { throw Error('unavailable') }, setStorageSync() { throw Error('unavailable') },
    }, () => 0)
    session.refresh()
    const first = session.quote.value.id
    expect(() => session.refresh()).not.toThrow()
    expect(session.quote.value.id).not.toBe(first)
  })
})
