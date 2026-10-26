import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('vue', async original => ({ ...await original<typeof import('vue')>(), onMounted: vi.fn(), onUnmounted: vi.fn(), provide: vi.fn() }))
vi.mock('@dcloudio/uni-app', () => ({ onShow: vi.fn(), onHide: vi.fn(), onReady: vi.fn() }))
import { useIndexPage } from '../src/pages/index/useIndexPage'
import { discoveryDraft, relevantAngles } from '../src/discover-angles'

const issue = { id: 'issue', version: 1, title: '方向', card: { title: '方向', options: [], constraints: [], confirmed: [], hypotheses: [], unknowns: [], next_step: '' } }
const conversation = { id: 'conversation', issue_id: 'issue', version: 1, title: '现有会话', summary: null }
let drafts: Record<string, any>
beforeEach(() => {
  vi.useFakeTimers()
  issue.title='方向'
  drafts = {}
  const storage = new Map<string, unknown>([['agency.session', 'test-session']])
  vi.stubGlobal('uni', {
    onNetworkStatusChange: vi.fn(), offNetworkStatusChange: vi.fn(),
    getStorageSync: (key: string) => storage.get(key), setStorageSync: (key: string, value: unknown) => storage.set(key, value), removeStorageSync: (key: string) => storage.delete(key),
    getWindowInfo: () => ({ statusBarHeight: 20 }), getMenuButtonBoundingClientRect: () => ({ bottom: 64 }), getSystemInfoSync: () => ({ windowHeight: 932, windowWidth: 430 }),
    onKeyboardHeightChange: vi.fn(), offKeyboardHeightChange: vi.fn(), $on: vi.fn(), $off: vi.fn(), setNavigationBarColor: vi.fn(), pageScrollTo: vi.fn(),
    request: (options: any) => {
      const path = new URL(options.url).pathname.replace(/^\/api/, '')
      let data: any = []
      if (path === '/config') data = { ai_mode: 'demo' }
      if (path === '/me') data = { id: 'alice', save_chat: true, ai_consent: false, theme: 'light' }
      if (path === '/issues/current' || path === '/issues/issue') data = issue
      if (path === '/issues') data = [issue]
      if (path === '/conversations') data = options.url.includes('archived=true') ? [] : [conversation]
      if (path.endsWith('/messages')) data = { items: [], next_cursor: null }
      if (path === '/chat-drafts') data = Object.values(drafts).map(row => ({ ...row }))
      if (path.startsWith('/chat-drafts/')) {
        const key = decodeURIComponent(path.slice('/chat-drafts/'.length))
        if ((drafts[key]?.version || 0) !== options.data.version) throw Error('Unexpected stale writer')
        data = drafts[key] = { key, ...options.data, version: options.data.version + 1 }
      }
      queueMicrotask(() => options.success({ statusCode: 200, data }))
      return { abort: vi.fn() }
    },
  })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

it('restores a retained conversation composer without adding a chat message', async () => {
  drafts.conversation = { key: 'conversation', issue_id: 'issue', version: 3, content: '  未发送\n第二行  ' }
  const page = useIndexPage(); await page.initialize()
  expect(page.draft.value).toBe('  未发送\n第二行  ')
  expect(page.messages.value).toEqual([])
  page.draft.value = '继续编辑'
  await vi.advanceTimersByTimeAsync(600)
  expect(drafts.conversation.content).toBe('继续编辑')
})

it('saves and restores a never-sent conversation shell after a page restart', async () => {
  const page = useIndexPage(); await page.initialize()
  page.startNewChat(); page.draft.value = '第一次发送前先留着'
  const key = page.workspace.activeId.value
  await vi.advanceTimersByTimeAsync(600)
  expect(drafts[key].content).toBe('第一次发送前先留着')
  const restored = useIndexPage(); await restored.initialize()
  expect(restored.workspace.activeId.value).toBe(key)
  expect(restored.draft.value).toBe('第一次发送前先留着')
  expect(restored.messages.value).toEqual([])
})

it('withdraws invalid saved Discover excerpts on restart while preserving the user draft', async () => {
  drafts.conversation = {key:'conversation',issue_id:'issue',version:1,content:'  我的原稿\n\n过期的完整建议',source_refs:[
    {id:'withdrawn',issue_id:'issue',strategy:'boundary',quote:'过期线索',text:'过期的完整建议'},
  ]}
  const page=useIndexPage();await page.initialize()
  expect(page.draft.value).toBe('  我的原稿\n\n')
  expect(page.workspace.active.value.error.value).toContain('已不可用')
  await vi.advanceTimersByTimeAsync(600)
  expect(drafts.conversation.source_refs).toEqual([])
  expect(drafts.conversation.content).toBe('  我的原稿\n\n')
})

it('removes withdrawn source metadata when send-time verification keeps the manual draft instead of sending', async () => {
  const angle=relevantAngles(issue as any,[])[0],text=discoveryDraft(angle)
  drafts.conversation={key:'conversation',issue_id:'issue',version:1,content:'我的原稿\n\n'+text,source_refs:[
    {id:angle.id,issue_id:'issue',strategy:angle.strategy,quote:angle.evidence,text},
  ]}
  const page=useIndexPage();await page.initialize()
  page.user.value={...page.user.value!,ai_consent:true}
  issue.title='我修改后的方向'
  await page.sendChat();await vi.advanceTimersByTimeAsync(600)
  expect(page.draft.value).toBe('我的原稿\n\n')
  expect(page.messages.value).toEqual([])
  expect(drafts.conversation.source_refs).toEqual([])
})
