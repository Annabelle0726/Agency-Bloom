import { computed, ref } from 'vue'
import type { Onboarding } from './domain'
import { draftKeyFor, pauseKeyFor, questionStep } from './entry'
import { newOnboarding, restoreDraft, saveDraft } from './onboarding'

export type OnboardingSnapshot = ReturnType<typeof saveDraft>
export type ProgressStatus = 'in_progress' | 'paused' | 'completed'
export interface ProgressRow { version: number; step: number; status: ProgressStatus; answers: Onboarding | null; updated_at: string }
interface ProgressWrite { version: number; step: number; status: 'in_progress' | 'paused'; answers: Onboarding }
interface Options {
  storage: { read: (key: string) => unknown; write: (key: string, value: unknown) => void; remove: (key: string) => void }
  transport: { get: () => Promise<ProgressRow | null>; save: (body: ProgressWrite) => Promise<ProgressRow> }
  debounceMs?: number
}
interface Envelope { account: string; version: number; status: ProgressStatus; dirty: boolean; draft: OnboardingSnapshot | null }
export const progressKeyFor = (account: string) => `agency.onboarding.sync.v1:${account}`
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value))
function stable(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']'
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stable((value as Record<string, unknown>)[key])).join(',') + '}'
  return JSON.stringify(value)
}
function content(form: Onboarding) { return { ...newOnboarding(), ...form, follow_ups: form.follow_ups || {} } }

export function createOnboardingProgress({ storage, transport, debounceMs = 600 }: Options) {
  const mode = ref<'local' | 'syncing' | 'synced' | 'conflict'>('local')
  const restored = ref<OnboardingSnapshot | null>(null)
  const localWarning = ref('')
  let account = '', epoch = 0, version = 0, revision = 0
  let status: ProgressStatus = 'in_progress', draft: OnboardingSnapshot | null = null
  let dirty = false, loaded = false, finishing = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let sending: Promise<void> | undefined, loading: Promise<void> | undefined
  let remote: ProgressRow | null = null
  const message = computed(() => localWarning.value || (!draft ? (status === 'completed' ? '问答已保存' : '回答会自动保存，可稍后继续') : mode.value === 'conflict'
    ? '另一处已有新进度，本机回答仍保留，请选择要继续的版本'
    : mode.value === 'syncing' ? '正在同步进度'
    : mode.value === 'synced' ? '进度已同步，可稍后继续' : '已保存在本机，联网后继续同步'))

  function persist() {
    if (!account) return
    try {
      const envelope: Envelope = { account, version, status, dirty, draft: draft ? copy(draft) : null }
      storage.write(progressKeyFor(account), envelope)
      if (draft) storage.write(draftKeyFor(account), copy(draft))
      else storage.remove(draftKeyFor(account))
      if (status === 'paused') storage.write(pauseKeyFor(account), true)
      else storage.remove(pauseKeyFor(account))
      localWarning.value = ''
    } catch { localWarning.value = '本机暂时无法保存进度，请先不要关闭页面' }
  }
  function reset(id: string) {
    clearTimeout(timer); epoch++; revision++; account = id
    version = 0; status = 'in_progress'; draft = null; dirty = false; loaded = false; finishing = false
    sending = undefined; loading = undefined; remote = null; mode.value = 'local'; localWarning.value = ''
    if (id) {
      try {
        const saved = storage.read(progressKeyFor(id)) as Envelope | undefined
        if (saved?.account === id && Number.isInteger(saved.version) && saved.version >= 0 &&
          ['in_progress', 'paused', 'completed'].includes(saved.status)) {
          version = saved.version; status = saved.status
          const valid = saved.draft && restoreDraft(saved.draft)
          draft = valid ? saveDraft(valid.form, questionStep(valid.step), saved.draft!.savedAt) : null
          dirty = !!saved.dirty && !!draft
        } else {
          const legacy = restoreDraft(storage.read(draftKeyFor(id)))
          if (legacy) { draft = saveDraft(legacy.form, questionStep(legacy.step)); dirty = true }
          if (storage.read(pauseKeyFor(id))) status = 'paused'
        }
      } catch { /* The in-memory questionnaire remains usable. */ }
      persist()
    }
    restored.value = draft ? copy(draft) : null
  }
  function accept(row: ProgressRow | null) {
    const value = row?.answers ? restoreDraft(saveDraft(content(row.answers), row.step)) : null
    if (row && row.status !== 'completed' && !value) throw Error('已同步进度的格式无法读取，本机回答仍保留')
    version = row?.version || 0; status = row?.status || 'in_progress'
    draft = value ? saveDraft(value.form, questionStep(value.step)) : null
    dirty = false; mode.value = row ? 'synced' : 'local'; persist()
    restored.value = draft ? copy(draft) : null
  }
  function load(): Promise<void> {
    if (!account) return Promise.resolve()
    if (loading) return loading
    const generation = epoch
    loading = (async () => {
      try {
        const row = await transport.get()
        if (generation !== epoch) return
        remote = row; loaded = true
        if (dirty && draft) {
          const identical = row?.answers && row.step === draft.step && row.status === status && stable(content(row.answers)) === stable(content(draft.form))
          if (identical) { version = row!.version; dirty = false; mode.value = 'synced'; persist() }
          else if ((row?.version || 0) !== version) mode.value = 'conflict'
          else mode.value = 'local'
        } else accept(row)
      } catch { if (generation === epoch) { loaded = false; mode.value = 'local' } }
      finally { if (generation === epoch) loading = undefined }
    })()
    return loading
  }
  function set(value: OnboardingSnapshot, nextStatus: 'in_progress' | 'paused' = 'in_progress') {
    if (!account) return
    const valid = restoreDraft(value)
    if (!valid) return
    draft = saveDraft(valid.form, questionStep(valid.step), value.savedAt)
    status = nextStatus; revision++; dirty = true
    if (mode.value !== 'conflict') mode.value = 'local'
    persist(); clearTimeout(timer)
    if (!finishing) timer = setTimeout(() => { void flush() }, debounceMs)
  }
  function flush(): Promise<void> {
    clearTimeout(timer)
    if (sending) return sending
    if (!account || finishing) return Promise.resolve()
    const generation = epoch
    sending = (async () => {
      if (!loaded) await load()
      while (generation === epoch && loaded && dirty && draft && mode.value !== 'conflict' && !finishing) {
        const sentRevision = revision
        const body: ProgressWrite = { version, step: draft.step, status: status === 'paused' ? 'paused' : 'in_progress', answers: copy(draft.form) }
        mode.value = 'syncing'
        try {
          const row = await transport.save(body)
          if (generation !== epoch) return
          version = row.version; remote = row
          if (revision === sentRevision) dirty = false
          mode.value = dirty ? 'local' : 'synced'; persist()
        } catch (error) {
          if (generation !== epoch) return
          loaded = false
          if ((error as { status?: number }).status === 409) { await load(); if (dirty) mode.value = 'conflict' }
          else mode.value = 'local'
          break
        }
      }
    })().finally(() => { if (generation === epoch) sending = undefined })
    return sending
  }
  async function retry() { await load(); await flush() }
  async function keepLocal() {
    await load()
    if (!loaded || !draft) return
    version = remote?.version || 0; mode.value = 'local'; persist(); await flush()
  }
  async function useRemote() {
    await load()
    if (loaded) accept(remote)
  }
  async function prepareCompletion() {
    await flush()
    if (status === 'completed') throw Error('这份问答已经保存，请返回空间查看')
    if (!loaded || dirty || mode.value === 'conflict') throw Error(mode.value === 'conflict' ? message.value : '回答已留在本机，请联网后再保存')
    finishing = true
    return version
  }
  function completed() {
    clearTimeout(timer); epoch++; revision++; sending = undefined; loading = undefined
    version++; status = 'completed'; draft = null; dirty = false; loaded = true; finishing = false
    mode.value = 'synced'; restored.value = null; persist()
  }
  function completionFailed() { finishing = false; loaded = false }
  function pause() { set(draft || saveDraft(newOnboarding(), 0), 'paused'); void flush() }
  function resume() { set(draft || saveDraft(newOnboarding(), 0)); restored.value = draft ? copy(draft) : null }
  function forget() {
    if (account) { try { storage.remove(progressKeyFor(account)); storage.remove(draftKeyFor(account)); storage.remove(pauseKeyFor(account)) } catch { /* Account deletion still signs out. */ } }
    reset('')
  }
  function dispose() { clearTimeout(timer); epoch++; account = '' }
  return { mode, message, restored, reset, set, load, flush, retry, keepLocal, useRemote,
    pause, resume, paused: () => status === 'paused', isCompleted: () => status === 'completed',
    snapshot: () => draft ? copy(draft) : null, prepareCompletion, completed, completionFailed, forget, dispose }
}
