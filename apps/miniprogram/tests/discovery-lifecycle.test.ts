import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { useDiscovery } from '../src/use-discovery'
import { discoveryBatch, discoveryCandidates, emptyDiscoveryState, recordDiscoveryFeedback, selfDiscovery } from '../src/discovery'
import type { Issue, User } from '../src/domain'
const now = Date.UTC(2026, 9, 22)
const item = { id: 'topic', title: '产品工作', ended_at: null, card: { options: [], constraints: ['保持收入'], next_step: '', unknowns: [] } } as unknown as Issue
const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => { scopes.splice(0).forEach(s => s.stop()); vi.unstubAllGlobals() })
function setup(initial: unknown = '') {
  const storage = new Map<string, unknown>(initial ? [['agency.discovery.v1:a', initial]] : [])
  vi.stubGlobal('uni', { getStorageSync: (key: string) => structuredClone(storage.get(key)), setStorageSync: (key: string, value: unknown) => storage.set(key, JSON.parse(JSON.stringify(value))) })
  const user = ref<User | null>({ id: 'a' } as User)
  const request = vi.fn(async (_method: string, path: string) => path.startsWith('/issues') ? [item] : { items: [] })
  const scope = effectScope(); scopes.push(scope)
  const d = scope.run(() => useDiscovery(user, request as any, vi.fn()))!
  return { user, request, d, storage }
}
describe('Discovery replenishment lifecycle', () => {
  it('replenishes legacy all-dismissed state without resurrecting refused questions', () => {
    const candidates = discoveryCandidates([item], [])
    let state = emptyDiscoveryState()
    for (const c of candidates) state = recordDiscoveryFeedback(state, c, 'dismissed', now)
    const next = discoveryBatch(candidates, state, now)
    expect(next).toHaveLength(2)
    expect(next.every(c => c.sourceId === 'curated:v1')).toBe(true)
    expect(next.some(c => state.feedback.some(f => f.id === c.id))).toBe(false)
  })
  it('never drains the page, even after rejecting every available regular question', async () => {
    const { d } = setup()
    await d.load()
    for (let i = 0; i < 40; i++) {
      const rejected = d.recommendations.value.find(c => c.strategy !== 'self')
      if (!rejected) break
      const keep = d.recommendations.value.filter(c => c.id !== rejected.id).map(c => c.id)
      d.dismiss(rejected)
      expect(d.recommendations.value.length).toBeGreaterThanOrEqual(2)
      expect(d.recommendations.value.map(c => c.id)).toEqual(expect.arrayContaining(keep))
      expect(d.recommendations.value.some(c => c.id === rejected.id)).toBe(false)
    }
    expect(d.recommendations.value.every(c => c.strategy === 'self')).toBe(true)
    expect(new Set(d.recommendations.value.map(c => c.id)).size).toBe(2)
  })
  it('offers two fresh rounds, then new questions plus a voluntary self-directed prompt', async () => {
    const { d } = setup(); await d.load()
    const seen = new Set(d.recommendations.value.map(c => c.id))
    for (let round = 1; round <= 3; round++) {
      d.rotate()
      expect(d.recommendations.value).toHaveLength(round === 3 ? 3 : 2)
      expect(d.recommendations.value.every(c => !seen.has(c.id))).toBe(true)
      d.recommendations.value.forEach(c => seen.add(c.id))
    }
    expect(d.recommendations.value.some(c => c.strategy === 'self')).toBe(true)
    expect(selfDiscovery().every(c => c.issueId === null)).toBe(true)
  })
  it('keeps ordinary visits stable, refreshes login, and keeps rejection/account isolation', async () => {
    const { d, user } = setup(); await d.load()
    const rejected = d.recommendations.value[0]; d.dismiss(rejected)
    const before = d.recommendations.value.map(c => c.id)
    await d.load(); expect(d.recommendations.value.map(c => c.id)).toEqual(before)
    user.value = { id: 'a', theme: 'forest' } as User
    await d.load(); expect(d.recommendations.value.map(c => c.id)).toEqual(before)
    user.value = null; user.value = { id: 'a' } as User
    await d.load()
    expect(d.recommendations.value.map(c => c.id)).not.toEqual(before)
    expect(d.recommendations.value.some(c => c.id === rejected.id)).toBe(false)
    user.value = { id: 'b' } as User; await d.load()
    expect(d.recommendations.value).toHaveLength(2)
  })
  it('refreshes a restored session without resetting stored feedback', async () => {
    const first = setup(); await first.d.load(); const rejected = first.d.recommendations.value[0]; first.d.dismiss(rejected)
    const before = first.d.recommendations.value.map(c => c.id)
    const saved = first.storage.get('agency.discovery.v1:a')
    const second = setup(saved); await second.d.load()
    expect(second.d.recommendations.value.map(c => c.id)).not.toEqual(before)
    expect(second.d.recommendations.value.some(c => c.id === rejected.id)).toBe(false)
  })
  it('ignores stale account loads and does not clear cards on a temporary read failure', async () => {
    const { d, request, user } = setup(); await d.load()
    const before = d.recommendations.value
    request.mockRejectedValueOnce(new Error('offline')); await d.load()
    expect(d.error.value).toBe('offline'); expect(d.recommendations.value).toEqual(before)
    let resolve!: (v: any) => void
    request.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    const pending = d.load(); user.value = null
    resolve([item]); await pending
    expect(d.recommendations.value).toEqual([]); expect(d.loaded.value).toBe(false)
  })
})
