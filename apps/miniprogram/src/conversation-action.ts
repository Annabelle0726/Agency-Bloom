import { ref } from 'vue'
import type { Conversation } from './domain'

export type ConversationAction = 'rename' | 'archive' | 'delete'
export type ConversationMenuAction = ConversationAction | 'preference' | 'summary' | 'details'
export type ConversationActionRequest = (method: 'PUT' | 'DELETE', path: string, data?: unknown) => Promise<unknown>

// Capture the selected identity/version. A later window switch cannot redirect a save.
export function createConversationAction(
  action: ConversationAction, conversation: Conversation, request: ConversationActionRequest,
  changed: (item: Conversation) => void, deleted: (id: string) => void,
) {
  const { id, version } = conversation
  const title = ref(conversation.title), busy = ref(false), error = ref('')
  async function save() {
    if (busy.value) return false
    if (action === 'rename' && (!title.value.trim() || title.value.trim().length > 120)) {
      error.value = '请填写 1–120 字的会话名称'; return false
    }
    busy.value = true; error.value = ''
    try {
      if (action === 'delete') {
        await request('DELETE', `/conversations/${id}?version=${version}`)
        deleted(id)
      } else {
        const values = action === 'rename' ? { title: title.value.trim() } : { archived: true }
        const result = await request('PUT', `/conversations/${id}`, { version, ...values })
        changed(result as Conversation)
      }
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : '没有保存成功，请稍后再试'
      return false
    } finally { busy.value = false }
  }
  return { title, busy, error, save }
}
