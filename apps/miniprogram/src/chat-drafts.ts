import { reactive } from 'vue'
import { CHAT_INPUT_LIMIT } from './chat-limits'

export interface DraftSourceRef { id: string; issue_id: string; strategy: string; quote: string; text: string }
export interface SavedChatDraft { key: string; content: string; issue_id: string | null; version: number; source_refs?: DraftSourceRef[] }
interface DraftBody { content: string; issue_id: string | null; version: number; source_refs: DraftSourceRef[] }
interface Entry { content: string; saved: string; sources: DraftSourceRef[]; savedSources: string; issueId: string | null; version: number; timer?: ReturnType<typeof setTimeout>; job?: Promise<void> }
const dirty = (entry: Entry) => entry.content !== entry.saved || JSON.stringify(entry.sources) !== entry.savedSources

// One serialized writer per composer. Late responses never erase newer typing.
export function createDraftSync(options: {
  list: () => Promise<SavedChatDraft[]>
  save: (key: string, body: DraftBody) => Promise<SavedChatDraft>
}) {
  const errors = reactive<Record<string, string>>({})
  const entries = new Map<string, Entry>()
  let account = '', epoch = 0, loaded = false
  function reset(next: string) {
    epoch++; account = next; loaded = false
    for (const entry of entries.values()) if (entry.timer) clearTimeout(entry.timer)
    entries.clear()
    for (const key of Object.keys(errors)) delete errors[key]
  }
  async function load() {
    if (!account || loaded) return []
    const revision = epoch
    try {
      const rows = await options.list()
      if (epoch !== revision) return []
      for (const row of rows) entries.set(row.key, {
        content: row.content, saved: row.content, issueId: row.issue_id, version: row.version,
        sources: row.source_refs || [], savedSources: JSON.stringify(row.source_refs || []),
      })
      loaded = true; delete errors['*']
      return rows
    } catch {
      if (epoch === revision) errors['*'] = '草稿暂未同步，输入仍保留在本次会话'
      return []
    }
  }
  function set(key: string, content: string, issueId: string | null, sources?: DraftSourceRef[]) {
    if (!account || !loaded || !key || content.length > CHAT_INPUT_LIMIT) return
    let entry = entries.get(key)
    if (!entry) {
      if (!content) return
      entry = { content: '', saved: '', sources: [], savedSources: '[]', issueId, version: 0 }; entries.set(key, entry)
    }
    entry.content = content; entry.issueId = issueId
    if (sources !== undefined) entry.sources = sources
    if (!content) entry.sources = []
    if (entry.timer) clearTimeout(entry.timer)
    if (dirty(entry)) entry.timer = setTimeout(() => { void flushKey(key) }, 500)
  }
  function flushKey(key: string): Promise<void> {
    const entry = entries.get(key)
    if (!account || !loaded || !entry) return Promise.resolve()
    if (entry.timer) { clearTimeout(entry.timer); entry.timer = undefined }
    if (entry.job) return entry.job
    if (!dirty(entry)) return Promise.resolve()
    const revision = epoch
    entry.job = (async () => {
      try {
        while (epoch === revision && entries.get(key) === entry && dirty(entry)) {
          const content = entry.content
          const sourceText = JSON.stringify(entry.sources)
          const row = await options.save(key, { content, issue_id: entry.issueId, version: entry.version, source_refs: JSON.parse(sourceText) })
          if (epoch !== revision) return
          entry.version = row.version; entry.saved = content; entry.savedSources = sourceText; delete errors[key]
        }
      } catch {
        if (epoch === revision && entries.get(key) === entry) errors[key] = '草稿暂未同步，输入仍保留在本次会话'
      } finally { entry.job = undefined }
    })()
    return entry.job
  }
  async function flush() { await Promise.all([...entries.keys()].map(flushKey)) }
  async function transfer(oldKey: string, key: string, content: string, issueId: string) {
    const revision = epoch
    set(key, content, issueId); await flushKey(key)
    if (revision !== epoch || errors[key]) return
    set(oldKey, '', issueId); await flushKey(oldKey)
  }
  function forget(key: string) {
    const entry = entries.get(key)
    if (entry?.timer) clearTimeout(entry.timer)
    entries.delete(key); delete errors[key]
  }
  return { reset, load, set, flush, transfer, forget, ready: () => loaded,
    error: (key: string) => errors[key] || errors['*'] || '' }
}
