import type { ChatEvent, ReplyPhase } from './chat-stream'
import { ref } from 'vue'
import type { ChatMessage, ChatResponse, Suggestion, Insight, ConversationSummary, SuppliedContext, PhaseChange, WebSource } from './domain'
import { ApiError } from './http'
import { PERSPECTIVE_PROTOTYPE, publicPerspective, type PerspectiveAction } from './perspective-shift'

interface ChatBody { perspective_control?: { disabled: boolean; dismissed: string[] }; request_id: string; message: string; history: { role: 'user' | 'assistant'; content: string }[]; insight_feedback: { possibility: string; reaction: 'dismissed' }[]; task?: 'chat' | 'summary'; session_summary?: ConversationSummary | null; dismissed_changes?: string[]; web_search?: boolean; visible_visual_ids?: string[]; edit_message_id?: string; edit_tail_id?: string; edit_in_memory?: boolean }
export interface ChatOptions {
  post: (issueId: string, body: ChatBody, onEvent?: (event: ChatEvent) => void) => { promise: Promise<ChatResponse>; cancel: () => void }
  cancelRemote: (id: string) => Promise<unknown>
  requestId: () => string
  onError: (message: string) => void
  onCancelled: (message: string) => void
}

// Page-independent, in-memory state: tab changes keep context without persisting
// unconsented full transcripts or automatically retrying a paid request
export function createChatSession(options: ChatOptions) {
  const messages = ref<ChatMessage[]>([])
  const perspectiveDisabled = ref(false), perspectiveDismissed = ref<string[]>([])
  function reactToPerspective(action: PerspectiveAction, index: number) {
    if (!PERSPECTIVE_PROTOTYPE || sending.value) return
    const message = messages.value[index], token = message?.payload?.perspective_token
    const candidate = publicPerspective(message?.payload?.perspective_shift, token, messages.value)
    if (!candidate || !token || perspectiveDisabled.value || perspectiveDismissed.value.includes(token)) return
    if (action === 'disable') { perspectiveDisabled.value = true; return }
    if (action === 'dismiss') { perspectiveDismissed.value = [...perspectiveDismissed.value, token].slice(-40); return }
    const text = `我想沿这个角度聊聊：${candidate.alternative_perspective}`
    const combined = [draft.value, text].filter(Boolean).join('\n\n')
    if (combined.length <= 2000 && !draft.value.includes(text)) draft.value = combined
  }
  const selectedQuote = ref('')
  const draft = ref(''), pendingText = ref(''), sending = ref(false)
  const sendingStartedAt = ref(0)
  const streamText = ref(''), replyPhase = ref<ReplyPhase>('waiting')
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
  const error = ref(''), sendingTask = ref<'chat' | 'summary'>('chat'), lastRequestId = ref(''), errorRequestId = ref('')
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
    perspectiveDisabled.value = false; perspectiveDismissed.value = []
    phaseChange.value = null; phaseConfirmed.value = false; phaseOpen.value = false; dismissedChanges = []
    activeId = ''; abort = null; sending.value = false; pendingText.value = ''
    sendingStartedAt.value = 0; streamText.value = ''; replyPhase.value = 'waiting'
    closeEdit()
    selectedQuote.value = ''; draft.value = ''; messages.value = []; suggestion.value = null; insight.value = null; insightReaction.value = ''; insightFeedback = []
    summary.value = null; summaryDraft.value = null; suppliedContext.value = null; tailLine.value = ''; error.value = ''; errorRequestId.value = ''; loaded.value = false; olderCursor.value = null; lastRequestId.value = ''
  }
  async function send(issueId: string, task: 'chat' | 'summary' = 'chat', editing = false) {
    if (sending.value || (editing && (!editTarget || task !== 'chat'))) return
    const original = editing ? editText.value : draft.value
    const quote = !editing && task === 'chat' ? selectedQuote.value : ''
    if (task === 'chat' && !original.trim()) return
    // Locate by object identity so loading earlier pages cannot shift the edit target.
    const index = editing ? messages.value.indexOf(editTarget!) : -1
    if (editing && index < 0) return
    const history = editing ? messages.value.slice(0, index) : messages.value
    const text = task === 'summary' ? '请整理当前会话，保留未解决的问题' : quote ? `关于这段话：\n「${quote}」\n\n${original.trim()}` : original.trim(), id = options.requestId()
    if (text.length > 2000) { error.value = '选中文字和问题合计过长，请缩短后再发送'; return }
    activeId = id; cancelSent = false; sending.value = true; pendingText.value = text
    sendingStartedAt.value = Date.now(); streamText.value = ''; replyPhase.value = 'waiting'
    sendingTask.value = task; lastRequestId.value = id
    if (task === 'chat' && !editing) { suggestion.value = null; phaseChange.value = null; phaseConfirmed.value = false; phaseOpen.value = false }
    const visibleVisualIds = [...new Set(history
      .map(message => message.payload?.visual_id)
      .filter((id): id is string => Boolean(id)))].slice(-40)
    try {
      const operation = options.post(issueId, { request_id: id, message: text,
        ...(PERSPECTIVE_PROTOTYPE ? { perspective_control: { disabled: perspectiveDisabled.value, dismissed: [...perspectiveDismissed.value] } } : {}),
        history: history.slice(task === 'summary' ? -80 : -32).map(({ role, content }) => ({ role, content })),
        insight_feedback: editing ? [] : [...insightFeedback], dismissed_changes: [...dismissedChanges], task, session_summary: editing ? null : summary.value,
        ...(editing && editTarget?.id ? { edit_message_id: editTarget.id, edit_tail_id: messages.value[messages.value.length - 1]?.id } : {}),
        ...(editing && !editTarget?.id ? { edit_in_memory: true } : {}),
        web_search: task === 'chat' && webSearchOn.value, visible_visual_ids: task === 'chat' ? visibleVisualIds : [] }, task === 'chat' ? event => {
          if (activeId !== id || cancelSent) return
          if (event.type === 'phase') replyPhase.value = event.phase
          if (event.type === 'reply') { streamText.value = event.text; replyPhase.value = 'writing' }
        } : undefined)
      abort = operation.cancel
      const response = await operation.promise
      if (activeId !== id || cancelSent) return
      error.value = ''; errorRequestId.value = ''
      if (task === 'summary') { summaryDraft.value = response.summary ?? null; return }
      if (editing) {
        messages.value = history
        summary.value = null; summaryDraft.value = null; insightFeedback = []
        phaseConfirmed.value = false; phaseOpen.value = false
        editIndex.value = null; editTarget = null; editText.value = ''
      }
      messages.value.push({ id: response.user_message_id, role: 'user', content: text }, { id: response.assistant_message_id, role: 'assistant', content: response.reply, payload: { plan_draft: response.plan_draft, speech_proof: response.speech_proof, perspective_shift: PERSPECTIVE_PROTOTYPE ? response.perspective_shift : null, perspective_token: PERSPECTIVE_PROTOTYPE ? response.perspective_token : null, suggestion: response.suggestion, insight: response.insight, request_id: id, supplied_context: response.supplied_context ?? null, tail_line: response.tail_line ?? '', reasoning_summary: response.reasoning_summary ?? [], web_sources: response.web_sources ?? null, visual_id: response.visual_id ?? null } })
      tailLine.value = response.tail_line?.trim() || ''
      suppliedContext.value = response.supplied_context ?? null
      phaseChange.value = response.phase_change && !dismissedChanges.includes(response.phase_change.source_id) ? response.phase_change : null
      suggestion.value = response.suggestion ?? null
      insight.value = response.insight ?? null; insightReaction.value = ''
      if (!editing && draft.value === original) { draft.value = ''; if (selectedQuote.value === quote) selectedQuote.value = '' }
    } catch (err) {
      if (activeId !== id) return
      if (err instanceof ApiError && err.cancelled) options.onCancelled(err.message)
      else { error.value = err instanceof Error ? err.message : '回复没有完成，输入仍然保留'; errorRequestId.value = id; options.onError(error.value) }
    } finally {
      if (activeId === id) {
        activeId = ''; abort = null; sending.value = false; pendingText.value = ''
        sendingStartedAt.value = 0; streamText.value = ''; replyPhase.value = 'waiting'
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
  return { perspectiveDisabled, perspectiveDismissed, reactToPerspective, messages, selectedQuote, draft, editIndex, editText, beginEdit, closeEdit, pendingText, streamText, replyPhase, sending, sendingStartedAt, sendingTask, suggestion, insight, insightReaction, summary, summaryDraft,
    phaseChange, phaseConfirmed, phaseOpen, confirmPhaseChange, skipPhaseChange,
    suppliedContext, tailLine, webSearchOn, error, lastRequestId, errorRequestId, loaded, olderCursor, reactToInsight, send, cancel, reset }
}
