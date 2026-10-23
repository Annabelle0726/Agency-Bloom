import catalogue from './home-quotes.json'

export interface HomeQuote { id: string; text: string; source: string }
export const homeQuotes: readonly HomeQuote[] = catalogue

/** A local editorial selection, never generated from private user content. */
export function selectHomeQuote(previousId?: string, random: () => number = Math.random): HomeQuote {
  const alternatives = homeQuotes.filter(quote => quote.id !== previousId)
  const value = random()
  const index = Number.isFinite(value) ? Math.min(alternatives.length - 1, Math.max(0, Math.floor(value * alternatives.length))) : 0
  return alternatives[index]
}
