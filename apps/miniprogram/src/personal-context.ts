import type { Memory } from './domain'
// A view of user-confirmed records, not a separately persisted inferred profile.
export function sharedContext(memories: Memory[]) {
  return memories.filter(item => !item.issue_id && item.enabled &&
    (item.status ?? 'active') === 'active' && (item.horizon ?? 'long_term') === 'long_term')
}
