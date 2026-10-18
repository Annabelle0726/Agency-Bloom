import { computed, ref, shallowReactive } from 'vue'
import { createChatSession, type ChatOptions } from './chat'

// A window selects a session; requests always close over their originating session.
// Drafts and unconsented transcripts never enter device storage.
export function createChatWorkspace(options: ChatOptions) {
  const activeId = ref('')
  const sessions = shallowReactive<Record<string, ReturnType<typeof createChatSession>>>({})
  const empty = createChatSession(options)
  function get(id: string) { return sessions[id] ||= createChatSession(options) }
  const active = computed(() => activeId.value ? get(activeId.value) : empty)
  function select(id: string) { get(id); activeId.value = id }
  function cancelAll() { Object.values(sessions).forEach(session => session.cancel()) }
  function reset() { Object.values(sessions).forEach(session => session.reset()); for (const id of Object.keys(sessions)) delete sessions[id]; activeId.value = ''; empty.reset() }
  return { activeId, active, sessions, get, select, cancelAll, reset }
}
