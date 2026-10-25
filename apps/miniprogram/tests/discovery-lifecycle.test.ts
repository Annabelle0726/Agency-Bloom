import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { useDiscovery } from '../src/use-discovery'
import type { Issue, User } from '../src/domain'
const item = { id: 'topic', title: '产品工作', concerns: [], created_at: '2026-10-24', updated_at: '2026-10-24', ended_at: null, card: { options: [], constraints: ['保持收入'], next_step: '', unknowns: ['岗位的日常'], confirmed: [] } } as unknown as Issue
const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => { scopes.splice(0).forEach(s => s.stop()); vi.unstubAllGlobals() })
function setup() {
  const storage = new Map<string, unknown>()
  vi.stubGlobal('uni', { getStorageSync: (key: string) => storage.get(key), setStorageSync: (key: string, value: unknown) => storage.set(key, JSON.parse(JSON.stringify(value))) })
  const user = ref<User | null>({ id: 'a' } as User), current = ref<Issue | null>(item)
  const request = vi.fn(async (_method: string, path: string) => path.startsWith('/issues') ? [item] : { items: [] })
  const scope = effectScope(); scopes.push(scope)
  const d = scope.run(() => useDiscovery(user, request as any, vi.fn(), current))!
  return { user, request, d, storage }
}
describe('Discover focus and source lifecycle', () => {
  it('dismisses only the selected card without replenishment and permits exhaustion', async () => {
    const { d } = setup(); await d.load()
    const [first, second] = d.recommendations.value
    expect(first).toBeTruthy(); expect(second).toBeTruthy()
    d.dismiss(first)
    expect(d.recommendations.value.map(c => c.id)).toEqual([second.id])
    d.dismiss(second); expect(d.recommendations.value).toEqual([])
    expect(d.emptyReason.value).toBe('exhausted')
    await d.load(); expect(d.recommendations.value).toEqual([])
  })
  it('keeps the selected exploration and ordinary visits stable', async () => {
    const { d, request } = setup()
    request.mockImplementation(async (_m, path) => path.startsWith('/issues') ? [item, { ...item, id: 'other', title: 'OTHER' }] : { items: [] })
    await d.load()
    expect(d.recommendations.value.every(c => c.issueId === 'topic')).toBe(true)
    const ids = d.recommendations.value.map(c => c.id)
    await d.load(); expect(d.recommendations.value.map(c => c.id)).toEqual(ids)
    d.chooseFocus('other'); expect(d.recommendations.value.every(c => c.issueId === 'other')).toBe(true)
    d.chooseFocus('topic'); expect(d.recommendations.value.map(c => c.id)).toEqual(ids)
    d.chooseFocus(null); expect(d.recommendations.value).toEqual([])
  })
  it('never makes requests for dismissal or rotation', async () => {
    const { d, request } = setup(); await d.load(); request.mockClear()
    d.dismiss(d.recommendations.value[0]); d.rotate()
    expect(request).not.toHaveBeenCalled()
  })
  it('removes revoked evidence even if the subsequent history refresh fails', async () => {
    const { d, request } = setup(); await d.load()
    request.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('offline'))
    await d.load(); expect(d.recommendations.value).toEqual([])
    expect(d.error.value).toBe('offline')
  })
  it('does not expose sources after an unverifiable refresh and recovers on retry', async () => {
    const { d, request } = setup(); await d.load()
    const ids = d.recommendations.value.map(c => c.id)
    request.mockRejectedValueOnce(new Error('offline')); await d.load()
    expect(d.recommendations.value).toEqual([])
    await d.load(); expect(d.recommendations.value.map(c => c.id)).toEqual(ids)
  })
  it('ignores stale loads and isolates account feedback', async () => {
    const { d, request, user } = setup(); await d.load()
    const first = d.recommendations.value[0]; d.dismiss(first)
    let resolve!: (v: any) => void
    request.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    const pending = d.load(); user.value = null; resolve([item]); await pending
    expect(d.recommendations.value).toEqual([]); expect(d.loaded.value).toBe(false)
    user.value = { id: 'b' } as User; await d.load()
    expect(d.recommendations.value.some(c => c.id === first.id)).toBe(true)
  })
})
