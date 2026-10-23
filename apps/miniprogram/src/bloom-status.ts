export type BloomStatus = 'online' | 'waiting' | 'offline'

// Bloom has one shared presence indicator. Waiting for a reply is still an
// available Bloom, so it takes precedence over a stale error from an earlier turn.
export function resolveBloomStatus(sending: boolean, unavailable: boolean): BloomStatus {
  if (sending) return 'waiting'
  return unavailable ? 'offline' : 'online'
}
