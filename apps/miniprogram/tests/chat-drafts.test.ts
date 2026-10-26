import { afterEach, expect, it, vi } from 'vitest'
import { createDraftSync } from '../src/chat-drafts'

afterEach(() => vi.useRealTimers())

it('keeps saving edits after a page hide flushes an already synchronized composer', async () => {
  let stored={key:'a',content:'已同步的草稿',issue_id:'issue',version:1}
  const sync=createDraftSync({list:async()=>[stored],save:async(key,body)=>stored={key,...body,version:body.version+1}})
  sync.reset('person');await sync.load();await sync.flush()
  sync.set('a','回到页面后继续编辑','issue');await sync.flush()
  expect(stored.content).toBe('回到页面后继续编辑')
})

it('keeps the source references when another edit changes only the text', async () => {
  const source = {id:'angle',issue_id:'issue',strategy:'boundary',quote:'原线索',text:'完整带入文字'}
  const bodies:any[]=[]
  const sync=createDraftSync({list:async()=>[{key:'a',content:'原稿',issue_id:'issue',version:1,source_refs:[source]}],save:async(key,body)=>{bodies.push(body);return{key,...body,version:body.version+1}}})
  sync.reset('person');await sync.load();sync.set('a','原稿与新补充','issue');await sync.flush()
  expect(bodies[0].source_refs).toEqual([source])
})

it('restores exact unsent text and serializes edits made while a save is pending', async () => {
  const stored = new Map<string, any>([['a', { key: 'a', content: '  草稿\n', issue_id: 'i', version: 1 }]])
  let release!: () => void
  let paused = false
  const sync = createDraftSync({
    list: async () => [...stored.values()],
    save: async (key, body) => {
      if (paused) await new Promise<void>(resolve => { release = resolve })
      if ((stored.get(key)?.version || 0) !== body.version) throw Error('冲突')
      const row = { key, ...body, version: body.version + 1 }
      stored.set(key, row); return row
    },
  })
  sync.reset('alice')
  expect((await sync.load())[0].content).toBe('  草稿\n')
  sync.set('a', '第一版', 'i'); paused = true
  const saving = sync.flush()
  sync.set('a', '编辑中的第二版', 'i')
  paused = false; release(); await saving
  expect(stored.get('a').content).toBe('编辑中的第二版')
  expect(sync.error('a')).toBe('')
  sync.set('a', '', 'i'); await sync.flush()
  expect(stored.get('a').content).toBe('')
})

it('handles a save failure without losing local text or rejecting the caller', async () => {
  let online = false
  const stored: any[] = []
  const sync = createDraftSync({ list: async () => [], save: async (key, body) => {
    if (!online) throw Error('网络异常')
    const row = { key, ...body, version: body.version + 1 }; stored.push(row); return row
  } })
  sync.reset('alice'); await sync.load(); sync.set('a', '未发送内容', null)
  await expect(sync.flush()).resolves.toBeUndefined()
  expect(sync.error('a')).toContain('草稿')
  online = true; await sync.flush()
  expect(stored[0].content).toBe('未发送内容')
  expect(sync.error('a')).toBe('')
})

it('does not schedule persistence after retention is disabled or an account changes', async () => {
  vi.useFakeTimers()
  const stored: any[] = []
  const sync = createDraftSync({ list: async () => [], save: async (key, body) => {
    const row = { key, ...body, version: body.version + 1 }; stored.push(row); return row
  } })
  sync.reset('alice'); await sync.load(); sync.set('a', '私密文字', null)
  sync.reset(''); await vi.advanceTimersByTimeAsync(1000)
  expect(stored).toEqual([])
  sync.set('a', '仅内存', null); await sync.flush()
  expect(stored).toEqual([])
})
