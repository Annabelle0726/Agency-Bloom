import { ref } from 'vue'
import type { ChatMessage, ChatResponse, Suggestion, Insight, ConversationSummary, SuppliedContext, PhaseChange, WebSource } from './domain'
import { ApiError } from './http'

interface ChatBody { request_id: string; message: string; history: { role: 'user' | 'assistant'; content: string }[]; insight_feedback: { possibility: string; reaction: 'dismissed' }[]; task?: 'chat' | 'summary'; session_summary?: ConversationSummary | null; dismissed_changes?: string[]; web_search?: boolean; edit_message_id?: string; edit_tail_id?: string; edit_in_memory?: boolean }
export interface ChatOptions {
  post: (issueId: string, body: ChatBody) => { promise: Promise<ChatResponse>; cancel: () => void }
  cancelRemote: (id: string) => Promise<unknown>
  requestId: () => string
  onError: (message: string) => void
  onCancelled: (message: string) => void
}

// Page-independent, in-memory state: tab changes keep context without persisting
// unconsented full transcripts or automatically retrying a paid request
export function createChatSession(options: ChatOptions) {
  const messages = ref<ChatMessage[]>([])
  const draft = ref(''), pendingText = ref(''), sending = ref(false)
  const editIndex = ref<number | null>(null), editText = ref('')
  let editTarget: ChatMessage | null = null
  function beginEdit(index: number) {
    if (sending.value || messages.value[index]?.role !== 'user') return
    editIndex.value = index; editTarget = messages.value[index]; editText.value = editTarget.content
  }
  function closeEdit() {
    if (sending.value) return
    editIndex.value = null; editTarget = null; editText.value = ''
  }
  const suggestion = ref<Suggestion | null>(null)
  const insight = ref<Insight | null>(null)
  const insightReaction = ref<'' | 'interested' | 'experiment'>('')
  const summary = ref<ConversationSummary | null>(null), summaryDraft = ref<ConversationSummary | null>(null)
  const suppliedContext = ref<SuppliedContext | null>(null)
  const phaseChange = ref<PhaseChange | null>(null), phaseConfirmed = ref(false), phaseOpen = ref(false)
  let dismissedChanges: string[] = []
  function confirmPhaseChange() { if (phaseChange.value) phaseConfirmed.value = true }
  function skipPhaseChange() {
    if (phaseChange.value) dismissedChanges = [...new Set([...dismissedChanges, phaseChange.value.source_id])].slice(-40)
    phaseChange.value = null; phaseConfirmed.value = false; phaseOpen.value = false
  }
  const tailLine = ref('')
  const webSearchOn = ref(false)
  const error = ref(''), sendingTask = ref<'chat' | 'summary'>('chat'), lastRequestId = ref('')
  const loaded = ref(false), olderCursor = ref<string | null>(null)
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
    phaseChange.value = null; phaseConfirmed.value = false; phaseOpen.value = false; dismissedChanges = []
    activeId = ''; abort = null; sending.value = false; pendingText.value = ''
    closeEdit()
    draft.value = ''; messages.value = []; suggestion.value = null; insight.value = null; insightReaction.value = ''; insightFeedback = []
    summary.value = null; summaryDraft.value = null; suppliedContext.value = null; tailLine.value = ''; error.value = ''; loaded.value = false; olderCursor.value = null; lastRequestId.value = ''
  }
  async function send(issueId: string, task: 'chat' | 'summary' = 'chat', editing = false) {
    if (sending.value || (editing && (!editTarget || task !== 'chat'))) return
    const original = editing ? editText.value : draft.value
    if (task === 'chat' && !original.trim()) return
    // Locate by object identity so loading earlier pages cannot shift the edit target.
    const index = editing ? messages.value.indexOf(editTarget!) : -1
    if (editing && index < 0) return
    const history = editing ? messages.value.slice(0, index) : messages.value
    const text = task === 'summary' ? '请整理当前会话，保留未解决的问题' : original.trim(), id = options.requestId()
    activeId = id; cancelSent = false; sending.value = true; pendingText.value = text
    sendingTask.value = task; error.value = ''; lastRequestId.value = id
    if (task === 'chat' && !editing) { suggestion.value = null; phaseChange.value = null; phaseConfirmed.value = false; phaseOpen.value = false }
    try {
      const operation = options.post(issueId, { request_id: id, message: text,
        history: history.slice(task === 'summary' ? -80 : -8).map(({ role, content }) => ({ role, content })),
        insight_feedback: editing ? [] : [...insightFeedback], dismissed_changes: [...dismissedChanges], task, session_summary: editing ? null : summary.value,
        ...(editing && editTarget?.id ? { edit_message_id: editTarget.id, edit_tail_id: messages.value[messages.value.length - 1]?.id } : {}),
        ...(editing && !editTarget?.id ? { edit_in_memory: true } : {}),
        web_search: task === 'chat' && webSearchOn.value })
      abort = operation.cancel
      const response = await operation.promise
      if (activeId !== id || cancelSent) return
      if (task === 'summary') { summaryDraft.value = response.summary ?? null; return }
      if (editing) {
        messages.value = history
        summary.value = null; summaryDraft.value = null; insightFeedback = []
        phaseConfirmed.value = false; phaseOpen.value = false
        editIndex.value = null; editTarget = null; editText.value = ''
      }
      messages.value.push({ id: response.user_message_id, role: 'user', content: text }, { id: response.assistant_message_id, role: 'assistant', content: response.reply, payload: { suggestion: response.suggestion, insight: response.insight, request_id: id, supplied_context: response.supplied_context ?? null, tail_line: response.tail_line ?? '', reasoning_summary: response.reasoning_summary ?? [], web_sources: response.web_sources ?? null } })
      tailLine.value = response.tail_line?.trim() || ''
      suppliedContext.value = response.supplied_context ?? null
      phaseChange.value = response.phase_change && !dismissedChanges.includes(response.phase_change.source_id) ? response.phase_change : null
      suggestion.value = response.suggestion ?? null
      insight.value = response.insight ?? null; insightReaction.value = ''
      if (!editing && draft.value === original) draft.value = ''
    } catch (err) {
      if (activeId !== id) return
      if (err instanceof ApiError && err.cancelled) options.onCancelled(err.message)
      else { error.value = err instanceof Error ? err.message : '回复没有完成，输入仍然保留'; options.onError(error.value) }
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
  return { messages, draft, editIndex, editText, beginEdit, closeEdit, pendingText, sending, sendingTask, suggestion, insight, insightReaction, summary, summaryDraft,
    phaseChange, phaseConfirmed, phaseOpen, confirmPhaseChange, skipPhaseChange,
    suppliedContext, tailLine, webSearchOn, error, lastRequestId, loaded, olderCursor, reactToInsight, send, cancel, reset }
}
