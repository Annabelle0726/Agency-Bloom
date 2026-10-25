import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('vue', async original => ({ ...await original<typeof import('vue')>(), onMounted: vi.fn(), onUnmounted: vi.fn(), provide: vi.fn() }))
vi.mock('@dcloudio/uni-app', () => ({ onShow: vi.fn(), onHide: vi.fn(), onReady: vi.fn() }))
import { useIndexPage } from '../src/pages/index/useIndexPage'

let requests: any[]
beforeEach(() => {
  requests = []
  vi.stubGlobal('uni', {
    getStorageSync: vi.fn(), setStorageSync: vi.fn(), removeStorageSync: vi.fn(),
    getWindowInfo: () => ({ statusBarHeight: 20 }), getMenuButtonBoundingClientRect: () => ({ bottom: 64 }),
    getSystemInfoSync: () => ({ windowHeight: 932, windowWidth: 430 }),
    onKeyboardHeightChange: vi.fn(), offKeyboardHeightChange: vi.fn(), $on: vi.fn(), $off: vi.fn(),
    setNavigationBarColor: vi.fn(), pageScrollTo: vi.fn(),
    request: (options: any) => { requests.push(options); return { abort: vi.fn() } },
  })
})
afterEach(() => vi.unstubAllGlobals())

function setup() {
  const page = useIndexPage()
  page.current.value = { id: 'issue', version: 1, card: {
    title: '方向', options: [], constraints: [], confirmed: [], hypotheses: [], unknowns: [], next_step: '',
  } } as any
  const suggestion = { options: ['设计'], hypotheses: [], unknowns: [], next_step: '聊聊实际工作' }
  page.messages.value = [{ id: 'reply', role: 'assistant', content: '回答', payload: { suggestion } }]
  page.suggestion.value = suggestion
  return page
}

it('consumes the source proposal only after a successful reviewed save', async () => {
  const page = setup()
  page.openEditor(true)
  expect(page.suggestion.value).not.toBeNull()
  const pending = page.saveEditor()
  expect(page.suggestion.value).not.toBeNull()
  const request = requests.at(-1)
  expect(request.data.suggestion_message_id).toBe('reply')
  request.success({ statusCode: 200, data: { ...page.current.value, version: 2 } })
  await pending
  expect(page.suggestion.value).toBeNull()
  expect(page.messages.value[0].payload?.suggestion).toBeNull()
})

it('keeps the proposal after a failed save', async () => {
  const page = setup()
  page.openEditor(true)
  const pending = page.saveEditor()
  requests.at(-1).success({ statusCode: 409, data: { detail: '版本冲突' } })
  await pending
  expect(page.suggestion.value).not.toBeNull()
  expect(page.messages.value[0].payload?.suggestion).not.toBeNull()
})

it('does not consume a proposal when saving the existing card without reviewing it', async () => {
  const page = setup()
  page.openEditor()
  const pending = page.saveEditor()
  expect(requests.at(-1).data.suggestion_message_id).toBeUndefined()
  requests.at(-1).success({ statusCode: 200, data: { ...page.current.value, version: 2 } })
  await pending
  expect(page.suggestion.value).not.toBeNull()
  expect(page.messages.value[0].payload?.suggestion).not.toBeNull()
})

it('consumes a non-retained proposal in memory without persisting a transcript', async () => {
  const page = setup()
  delete page.messages.value[0].id
  page.openEditor(true)
  const pending = page.saveEditor()
  expect(requests.at(-1).data.suggestion_message_id).toBeUndefined()
  requests.at(-1).success({ statusCode: 200, data: { ...page.current.value, version: 2 } })
  await pending
  expect(page.suggestion.value).toBeNull()
  expect(page.messages.value[0].payload?.suggestion).toBeNull()
})
