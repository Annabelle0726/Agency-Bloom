import { reactive } from 'vue'

export interface SavedChatDraft { key: string; content: string; issue_id: string | null; version: number }
interface DraftBody { content: string; issue_id: string | null; version: number }
interface Entry { content: string; saved: string; issueId: string | null; version: number; timer?: ReturnType<typeof setTimeout>; job?: Promise<void> }

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
      })
      loaded = true; delete errors['*']
      return rows
    } catch {
      if (epoch === revision) errors['*'] = '草稿暂未同步，输入仍保留在本次会话'
      return []
    }
  }
  function set(key: string, content: string, issueId: string | null) {
    if (!account || !loaded || !key || content.length > 2000) return
    let entry = entries.get(key)
    if (!entry) {
      if (!content) return
      entry = { content: '', saved: '', issueId, version: 0 }; entries.set(key, entry)
    }
    entry.content = content; entry.issueId = issueId
    if (entry.timer) clearTimeout(entry.timer)
    if (entry.content !== entry.saved) entry.timer = setTimeout(() => { void flushKey(key) }, 500)
  }
  function flushKey(key: string): Promise<void> {
    const entry = entries.get(key)
    if (!account || !loaded || !entry) return Promise.resolve()
    if (entry.timer) { clearTimeout(entry.timer); entry.timer = undefined }
    if (entry.job) return entry.job
    const revision = epoch
    entry.job = (async () => {
      try {
        while (epoch === revision && entries.get(key) === entry && entry.content !== entry.saved) {
          const content = entry.content
          const row = await options.save(key, { content, issue_id: entry.issueId, version: entry.version })
          if (epoch !== revision) return
          entry.version = row.version; entry.saved = content; delete errors[key]
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
