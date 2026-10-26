import { ref, toRaw, watch, type Ref } from 'vue'
import type { Issue, PlanDraft, PlanRecord, PlanState } from './domain'

export interface PlanEditor {
  issueId: string; version: number; requestId: string; title: string; text: string; nextStep: string
  includeRecord: boolean; includeStep: boolean; status: '' | 'active' | 'paused' | 'completed'
  stepAction: 'revise' | 'replace'; baseStep: string
  attemptId?: string | null
  rememberPlan: boolean; memoryVersion: number | null
  recordId?: string; recordVersion?: string; sourceId?: string; sourceDraft?: PlanDraft; instruction: string
}
interface Options {
  current: Ref<Issue | null>; userKey: Ref<string>; retained?: Ref<boolean>
  request: <T>(method: 'GET' | 'POST', path: string, body?: unknown) => Promise<T>
  chat: (text: string) => Promise<object | null>; id: () => string; changed: (sourceId?: string, draft?: PlanDraft) => void
}
export function usePlan(options: Options) {
  const state = ref<PlanState | null>(null), error = ref(''), loading = ref(false), busy = ref(false)
  const editor = ref<PlanEditor | null>(null), visible = ref(false)
  const incoming = ref<{ draft: PlanDraft; sourceId?: string } | null>(null)
  const drafts = new Map<string, PlanEditor>(), revisions = new Map<object, PlanEditor>()
  let epoch = 0, scope = 0
  watch(options.userKey, () => { scope++; epoch++; drafts.clear(); revisions.clear(); state.value = null; editor.value = null; visible.value = false; incoming.value = null; busy.value = false; loading.value = false }, { flush: 'sync' })
  watch(() => options.current.value?.id, () => { scope++; epoch++; state.value = null; visible.value = false; editor.value = null; incoming.value = null; busy.value = false; loading.value = false }, { flush: 'sync' })
  watch(() => options.current.value?.plan, saved => {
    if (saved && saved.issue_id === options.current.value?.id && (!state.value || saved.version >= state.value.version)) state.value = saved
  }, { immediate: true })
  function applyState(saved: PlanState, writtenVersion?: number) {
    const issue = options.current.value
    if (!issue || saved.issue_id !== issue.id || saved.version < issue.version || saved.version < (state.value?.version || 0)) return
    state.value = saved
    // Plan is a partial card view. Only our own write can advance a known full-card version.
    options.current.value = { ...issue, version: writtenVersion === issue.version ? saved.version : issue.version,
      card: { ...issue.card, next_step: saved.next_step }, plan: saved }
  }
  async function load() {
    const issue = options.current.value, account = options.userKey.value, ticket = ++epoch
    if (!issue || !account) return
    loading.value = true; error.value = ''
    try {
      const saved = await options.request<PlanState>('GET', `/issues/${issue.id}/plan`)
      if (ticket === epoch && options.userKey.value === account && options.current.value?.id === issue.id) {
        applyState(saved)
      }
      return saved
    } catch (err) { if (ticket === epoch) error.value = err instanceof Error ? err.message : '暂时无法读取计划' }
    finally { if (ticket === epoch) loading.value = false }
  }
  function fresh(): PlanEditor | null {
    const issue = options.current.value
    if (!issue || issue.ended_at) return null
    const step = state.value?.issue_id === issue.id ? state.value.next_step : issue.card.next_step
    return { issueId: issue.id, version: state.value?.issue_id === issue.id ? state.value.version : issue.version,
      requestId: options.id(), title: '这次的经历', text: '', nextStep: step,
      includeRecord: false, includeStep: false, status: '', instruction: '', baseStep: step,
      attemptId: state.value?.issue_id === issue.id ? state.value.attempt_id : issue.plan?.attempt_id,
      rememberPlan: (state.value?.issue_id === issue.id ? state.value.memory_sync : issue.plan?.memory_sync) !== false,
      memoryVersion: (state.value?.issue_id === issue.id ? state.value.memory_version : issue.plan?.memory_version) ?? null,
      stepAction: state.value?.status === 'completed' ? 'replace' : 'revise' }
  }
  function open(mode: 'step' | 'next' | 'record' | 'paused' | 'completed' | 'active', record?: PlanRecord) {
    const value = fresh(); if (!value || busy.value) return
    const key = `${value.issueId}:${record?.id || `${value.attemptId ?? value.baseStep}:${mode}`}`
    const existing = drafts.get(key)
    if (existing) editor.value = existing
    else {
      value.includeStep = mode === 'step' || mode === 'next'; value.includeRecord = mode === 'record'
      if (mode === 'next') { value.stepAction = 'replace'; value.nextStep = '' }
      if (mode === 'step') value.stepAction = 'revise'
      if (record) { value.title = record.title; value.text = record.text; value.recordId = record.id; value.recordVersion = record.version }
      if (['active', 'paused', 'completed'].includes(mode)) value.status = mode as PlanEditor['status']
      drafts.set(key, value); editor.value = value
    }
    incoming.value = null; visible.value = true; error.value = ''
  }
  function review(draft: PlanDraft, sourceId: string | undefined, session: object) {
    const pending = revisions.get(toRaw(session))
    if (pending && pending.issueId === options.current.value?.id) {
      editor.value = pending; incoming.value = pending.sourceDraft && toRaw(pending.sourceDraft) === toRaw(draft) ? null : { draft, sourceId }
    } else {
      const value = fresh(); if (!value) return
      Object.assign(value, { title: draft.title, text: draft.text, nextStep: draft.next_step ?? value.nextStep,
        includeRecord: !!draft.text, includeStep: !draft.text && !!draft.next_step, sourceId, sourceDraft: draft })
      editor.value = value; incoming.value = null
      revisions.set(toRaw(session), value)
    }
    visible.value = true; error.value = ''
  }
  function adopt() {
    if (!editor.value || !incoming.value) return
    const { draft, sourceId } = incoming.value
    Object.assign(editor.value, { title: draft.title, text: draft.text, sourceId, sourceDraft: draft,
      nextStep: draft.next_step ?? editor.value.nextStep, requestId: options.id() })
    incoming.value = null
  }
  function keep() {
    if (!editor.value || !incoming.value) return
    editor.value.sourceId = incoming.value.sourceId
    editor.value.sourceDraft = incoming.value.draft
    incoming.value = null
  }
  async function refine() {
    const value = editor.value, account = options.userKey.value, ownerScope = scope
    if (!value || busy.value || value.issueId !== options.current.value?.id) return
    const purpose = value.stepAction === 'replace' && value.includeStep ? '我想重新选择一个尝试，原来的一步仅作背景。请先了解我想改变什么，不默认延续旧目标' : '请帮我微调这份待确认的计划草稿，只调整表达，不替我改变行动'
    const text = `${purpose}。以我当前修改后的内容为准，保留未决定的部分，不添加没有发生的事。请整理成可编辑的草稿。\n\n标题：${value.title}\n记录：${value.text}\n下一步：${value.nextStep}\n\n修改要求：${value.instruction.trim() || '整理得清楚、简洁，保留我的意思'}`
    busy.value = true
    try {
      const session = await options.chat(text)
      if (account !== options.userKey.value || ownerScope !== scope) return
      if (session) { revisions.set(toRaw(session), toRaw(value)); visible.value = false }
    } catch (err) { if (ownerScope === scope) error.value = err instanceof Error ? err.message : '暂时无法打开对话' }
    finally { if (ownerScope === scope) busy.value = false }
  }
  async function reload() {
    const value = editor.value
    const saved = await load()
    if (!value || !saved || value !== editor.value || value.issueId !== saved.issue_id) return
    value.version = saved.version; value.requestId = options.id()
    value.memoryVersion = saved.memory_version ?? null
    if (value.recordId) {
      const row = saved.records.find(r => r.id === value.recordId)
      if (row) value.recordVersion = row.version
      else error.value = '最新列表中未找到这条记录，编辑已保留；可以去 Journey 核对原记录'
    }
  }
  async function refreshMemory() {
    const saved = await load(); if (!saved) return
    const pending = new Set([editor.value, ...drafts.values(), ...revisions.values()])
    for (const value of pending) if (value?.issueId === saved.issue_id) {
      value.rememberPlan = saved.memory_sync !== false
      value.memoryVersion = saved.memory_version ?? null
    }
  }
  async function save() {
    const value = editor.value, account = options.userKey.value, ownerScope = scope
    if (!value || busy.value || loading.value || value.issueId !== options.current.value?.id || options.current.value.ended_at) return
    if (value.includeRecord && (!value.title.trim() || !value.text.trim())) { error.value = '请写下标题和要保存的内容'; return }
    if (!value.includeRecord && !value.includeStep && !value.status) { error.value = '请选择要保存的内容'; return }
    const body = { request_id: value.requestId, version: value.version,
      remember_plan: value.rememberPlan, memory_version: value.memoryVersion,
      ...(value.includeRecord ? { record: { title: value.title.trim(), text: value.text.trim(), ...(value.recordId ? { id: value.recordId, version: value.recordVersion } : {}) } } : {}),
      ...(value.includeStep && !value.status ? { next_step: value.nextStep.trim(), step_action: value.stepAction } : {}),
      ...((value.includeStep || value.status) && value.attemptId !== undefined ? { attempt_id: value.attemptId } : {}),
      ...(value.includeRecord && !value.recordId && value.attemptId !== undefined ? { record_attempt_id: value.attemptId } : {}),
      ...(value.status ? { status: value.status } : {}), ...(value.sourceId && options.retained?.value !== false ? { source_message_id: value.sourceId } : {}) }
    busy.value = true; error.value = ''
    try {
      const saved = await options.request<PlanState>('POST', `/issues/${value.issueId}/plan`, body)
      if (account !== options.userKey.value || ownerScope !== scope) return
      if (options.current.value?.id === value.issueId) {
        applyState(saved, value.version)
      }
      for (const [key, item] of drafts) if (item === toRaw(value)) drafts.delete(key)
      for (const [key, item] of revisions) if (item === toRaw(value)) revisions.delete(key)
      if (editor.value === value) { visible.value = false; editor.value = null; incoming.value = null }
      options.changed(value.sourceId, value.sourceDraft)
    } catch (err) { if (account === options.userKey.value && ownerScope === scope) error.value = err instanceof Error ? err.message : '保存失败，你的文字仍保留' }
    finally { if (ownerScope === scope) busy.value = false }
  }
  return { state, editor, incoming, visible, error, loading, busy, load, open, review, adopt, keep, refine, reload, refreshMemory, save }
}
