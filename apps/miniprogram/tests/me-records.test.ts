import { afterEach, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { snapshotRows, useMeRecords, phaseRecords } from '../src/me-records'
import type { InitialSnapshot, Memory } from '../src/domain'
const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => scopes.splice(0).forEach(s => s.stop()))
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); await nextTick() }
const snapshot: InitialSnapshot = { id: 'snapshot:a', version: 2, direction: '', source: 'onboarding', captured_at: '2026-10-24', background: '', stage: 'unsure', life_contexts: [], constraints: [], concerns: ['relationships'], answers: { follow_ups: { relationships: { selections: ['自己的想法和家人的期待不同'], note: '', refinements: { '自己的想法和家人的期待不同': ['还没理清自己的选择'] } } } } }
it('shows selection-only initial answers verbatim, including refinements and honest unanswered fields', () => {
  const rows = snapshotRows(snapshot)
  expect(JSON.stringify(rows)).toContain('关系和期待让我为难')
  expect(JSON.stringify(rows)).toContain('自己的想法和家人的期待不同')
  expect(JSON.stringify(rows)).toContain('还没理清自己的选择')
  expect(rows.find(r => r.label === '当时想聊的问题')?.value).toBe('未填写')
  expect(rows.find(r => r.label === '当时的回应偏好')?.value).toBe('未记录')
  expect(snapshot.answers.follow_ups?.relationships.note).toBe('')
})
it('never promotes an old snapshot or a historical/other-scope memory to current intent', () => {
  const memory = { horizon: 'current_phase', status: 'active', enabled: true, issue_id: 'a' } as Memory
  expect(phaseRecords([memory, { ...memory, status: 'historical' }, { ...memory, issue_id: 'b' }], 'a')).toEqual([memory])
  expect(phaseRecords([{ ...memory, issue_id: null }], '')).toHaveLength(1)
})
it('keeps snapshot failures separate from a valid empty memory list and permits retry', async () => {
  let failed = true
  const request = vi.fn(async (_m: string, path: string) => { if (path === '/memories') return []; if (failed) throw Error('初始资料读取失败'); return null })
  const scope = effectScope(); scopes.push(scope)
  const state = scope.run(() => useMeRecords(() => 'u', () => 'a', () => 0, request as any))!
  await flush()
  expect(state.memories.value).toEqual([])
  expect(state.memoryError.value).toBe('')
  expect(state.snapshotError.value).toContain('初始资料读取失败')
  failed = false; await state.reload(); await flush()
  expect(state.snapshot.value).toBeNull(); expect(state.snapshotError.value).toBe('')
})
it('clears private data immediately on account switch and ignores the old response', async () => {
  const user = ref('first'), pending: ((v: unknown) => void)[] = []
  const request = vi.fn(() => new Promise(resolve => pending.push(resolve)))
  const scope = effectScope(); scopes.push(scope)
  const state = scope.run(() => useMeRecords(() => user.value, () => '', () => 0, request as any))!
  user.value = 'second'; await nextTick()
  expect(state.memories.value).toEqual([])
  pending[0]([{ id: 'first-private' }]); await flush()
  expect(state.memories.value).toEqual([])
  pending[1]([]); await flush()
  expect(state.loading.value).toBe(false)
})
