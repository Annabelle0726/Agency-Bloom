import { ref } from 'vue'
import type { ChatMessage, ChatResponse, Suggestion, Insight } from './domain'
import { ApiError } from './http'

interface ChatBody { request_id: string; message: string; history: ChatMessage[]; insight_feedback: { possibility: string; reaction: 'dismissed' }[] }
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
  const insight = ref<Insight | null>(null)
  const insightReaction = ref<'' | 'interested' | 'experiment'>('')
  let insightFeedback: ChatBody['insight_feedback'] = []
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
    draft.value = ''; messages.value = []; suggestion.value = null; insight.value = null; insightReaction.value = ''; insightFeedback = []
  }
  async function send(issueId: string) {
    if (sending.value || !draft.value.trim()) return
    const original = draft.value, text = original.trim(), id = options.requestId()
    activeId = id; cancelSent = false; sending.value = true; pendingText.value = text
    suggestion.value = null
    try {
      const operation = options.post(issueId, { request_id: id, message: text, history: messages.value.slice(-8), insight_feedback: [...insightFeedback] })
      abort = operation.cancel
      const response = await operation.promise
      if (activeId !== id || cancelSent) return
      messages.value.push({ role: 'user', content: text }, { role: 'assistant', content: response.reply })
      suggestion.value = response.suggestion ?? null
      insight.value = response.insight ?? null; insightReaction.value = ''
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
  function reactToInsight(action: 'interested' | 'dismissed' | 'experiment') {
    if (sending.value || !insight.value) return null
    if (action === 'dismissed') {
      insightFeedback = [...insightFeedback.filter(f => f.possibility !== insight.value!.possibility), { possibility: insight.value.possibility, reaction: 'dismissed' as const }].slice(-3)
      insight.value = null; insightReaction.value = ''; return null
    }
    if (insightReaction.value === action) return action === 'experiment' ? insight.value.experiment : null
    if (action === 'experiment' && insight.value.experiment) { insightReaction.value = action; return { ...insight.value.experiment } }
    const text = action === 'interested' ? `这个角度有意思：${insight.value.possibility}。请沿着我提供的真实线索继续探索，哪些地方还需要了解？` :
      `关于这个可能性：${insight.value.possibility}，请帮我提出一个可验证、代价可控的低成本小实验，先了解我的时间与资源限制`
    const combined = [draft.value, text].filter(Boolean).join('\n\n')
    if (combined.length > 2000) return null
    draft.value = combined; insightReaction.value = action
    return null
  }
  return { messages, draft, pendingText, sending, suggestion, insight, insightReaction, reactToInsight, send, cancel, reset }
}
