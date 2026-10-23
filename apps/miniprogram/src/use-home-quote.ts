import { readonly, shallowRef } from 'vue'
import { homeQuotes, selectHomeQuote } from './home-quotes'

export const HOME_QUOTE_KEY = 'agency.home.quote.v1'
interface QuoteStorage {
  getStorageSync(key: string): unknown
  setStorageSync(key: string, value: string): unknown
}

export function createHomeQuoteRotation(storage: QuoteStorage, random: () => number = Math.random) {
  const quote = shallowRef(homeQuotes[0])
  let displayed = false
  function refresh() {
    let previous = displayed ? quote.value.id : undefined
    if (!displayed) {
      try { const saved = storage.getStorageSync(HOME_QUOTE_KEY); if (typeof saved === 'string') previous = saved }
      catch { /* Storage is optional; the quotation still works in memory. */ }
    }
    quote.value = selectHomeQuote(previous, random)
    displayed = true
    try { storage.setStorageSync(HOME_QUOTE_KEY, quote.value.id) }
    catch { /* Preserve the in-memory id to prevent repeats in this session. */ }
  }
  return { quote: readonly(quote), refresh }
}

const rotation = createHomeQuoteRotation({
  getStorageSync: key => uni.getStorageSync(key),
  setStorageSync: (key, value) => uni.setStorageSync(key, value),
})
export const homeQuote = rotation.quote
export const refreshHomeQuote = rotation.refresh
