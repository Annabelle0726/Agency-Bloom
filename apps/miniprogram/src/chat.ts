import { ref } from 'vue'
import type { ChatMessage, ChatResponse, Suggestion } from './domain'
import { ApiError } from './http'

interface ChatBody { request_id: string; message: string; history: ChatMessage[] }
interface Options {
  post: (issueId: string, body: ChatBody) => { promise: Promise<ChatResponse>; cancel: () => void }
  cancelRemote: (id: string) => Promise<unknown>
  requestId: () => string
  onError: (message: string) => void
  onCancelled: (message: string) => void
}

// Page-independent, in-memory state: tab changes keep context without persisting
// unconsented full transcripts or automatically retrying a paid request
export function createChatSession(options: Options) {
  const messages = ref<ChatMessage[]>([])
  const draft = ref(''), pendingText = ref(''), sending = ref(false)
  const suggestion = ref<Suggestion | null>(null)
  let activeId = '', abort: (() => void) | null = null, cancelSent = false
  function cancel() {
    if (!activeId || cancelSent) return
    cancelSent = true
    abort?.()
    void options.cancelRemote(activeId).catch(() => {})
  }
  function reset() {
    cancel()
    activeId = ''; abort = null; sending.value = false; pendingText.value = ''
    draft.value = ''; messages.value = []; suggestion.value = null
  }
  async function send(issueId: string) {
    if (sending.value || !draft.value.trim()) return
    const original = draft.value, text = original.trim(), id = options.requestId()
    activeId = id; cancelSent = false; sending.value = true; pendingText.value = text
    suggestion.value = null
    try {
      const operation = options.post(issueId, { request_id: id, message: text, history: messages.value.slice(-8) })
      abort = operation.cancel
      const response = await operation.promise
      if (activeId !== id || cancelSent) return
      messages.value.push({ role: 'user', content: text }, { role: 'assistant', content: response.reply })
      suggestion.value = response.suggestion ?? null
      if (draft.value === original) draft.value = ''
    } catch (err) {
      if (activeId !== id) return
      if (err instanceof ApiError && err.cancelled) options.onCancelled(err.message)
      else options.onError(err instanceof Error ? err.message : '回复没有完成，输入仍然保留')
    } finally {
      if (activeId === id) {
        activeId = ''; abort = null; sending.value = false; pendingText.value = ''
      }
    }
  }
  return { messages, draft, pendingText, sending, suggestion, send, cancel, reset }
}
