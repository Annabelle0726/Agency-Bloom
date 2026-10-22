import { computed, ref, shallowReactive } from 'vue'
import { createChatSession, type ChatOptions } from './chat'
import type { DiscoveryRecommendation } from './discovery'

// A window selects a session; requests always close over their originating session.
// Drafts and unconsented transcripts never enter device storage.
// A "draft:" id is a local, unsaved conversation shell: it exists only in
// memory until the first real send promotes it to a persisted conversation.
export function createChatWorkspace(options: ChatOptions) {
  const activeId = ref('')
  const drafts = shallowReactive<Record<string, { requestId: string; issueId: string | null; recommendation?: DiscoveryRecommendation }>>({})
  function startDraft(issueId: string | null, prompt = '', recommendation?: DiscoveryRecommendation) {
    const requestId = options.requestId(), key = `draft:${requestId}`
    drafts[key] = { requestId, issueId, recommendation }
    const session = get(key)
    session.draft.value = prompt; session.loaded.value = true
    select(key)
    return key
  }
  const sessions = shallowReactive<Record<string, ReturnType<typeof createChatSession>>>({})
  const empty = createChatSession(options)
  function get(id: string) { return sessions[id] ||= createChatSession(options) }
  const active = computed(() => activeId.value ? get(activeId.value) : empty)
  function select(id: string) { get(id); activeId.value = id }
  function cancelAll() { Object.values(sessions).forEach(session => session.cancel()) }
  function remove(id: string) {
    sessions[id]?.reset(); delete sessions[id]; delete drafts[id]
    if (activeId.value === id) { activeId.value = ''; empty.reset() }
  }
  function reset() { Object.values(sessions).forEach(session => session.reset()); for (const id of Object.keys(sessions)) delete sessions[id]; activeId.value = ''; empty.reset(); for (const key of Object.keys(drafts)) delete drafts[key] }
  // Promote a draft shell to a real conversation id, carrying over messages,
  // drafts and request state so the first send continues seamlessly.
  function promote(draftKey: string, realId: string) {
    if (draftKey === realId) return
    const existing = sessions[draftKey]
    if (existing) {
      sessions[realId] = existing
      delete sessions[draftKey]
    }
    if (drafts[draftKey]) drafts[realId] = drafts[draftKey]
    delete drafts[draftKey]
    if (activeId.value === draftKey) activeId.value = realId
  }
  return { drafts, startDraft, activeId, active, sessions, get, select, cancelAll, remove, reset, promote }
}
