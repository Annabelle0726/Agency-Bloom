import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
vi.mock('vue', async original => ({ ...await original<typeof import('vue')>(), onMounted: vi.fn(), onUnmounted: vi.fn(), provide: vi.fn() }))
vi.mock('@dcloudio/uni-app', () => ({ onShow: vi.fn(), onHide: vi.fn(), onReady: vi.fn() }))
import { useIndexPage } from '../src/pages/index/useIndexPage'
let requests: any[]
beforeEach(() => {
  requests = []
  vi.stubGlobal('uni', {
    onNetworkStatusChange: vi.fn(), offNetworkStatusChange: vi.fn(),
    getStorageSync: vi.fn(), setStorageSync: vi.fn(), removeStorageSync: vi.fn(),
    getWindowInfo: () => ({ statusBarHeight: 20 }), getMenuButtonBoundingClientRect: () => ({ bottom: 64 }),
    getSystemInfoSync: () => ({ windowHeight: 844, windowWidth: 390 }),
    onKeyboardHeightChange: vi.fn(), offKeyboardHeightChange: vi.fn(), onNetworkStatusChange: vi.fn(), offNetworkStatusChange: vi.fn(), $on: vi.fn(), $off: vi.fn(),
    setNavigationBarColor: vi.fn(), pageScrollTo: vi.fn(), showToast: vi.fn(),
    request: (options: any) => { requests.push(options); return { abort: vi.fn() } },
  })
})
afterEach(async () => { await nextTick(); await Promise.resolve(); await nextTick(); vi.unstubAllGlobals() })
function setup() {
  const page = useIndexPage()
  page.user.value = { id: 'person', theme: 'light', save_chat: false, ai_consent: false, support_style: 'listen' }
  page.current.value = { id: 'issue', version: 3, ended_at: null, feedback: [], card: {
    title: '想换工作', options: [], constraints: ['不能中断收入'], confirmed: ['有两年经验'], hypotheses: [], unknowns: [], next_step: '问一位朋友',
  } } as any
  page.tab.value = 'plan'
  return page
}
it('opens a reviewable planning draft after choosing a separate conversation', async () => {
  const page = setup()
  page.startNewChat(); page.draft.value = '还没写完的问题'; page.tab.value = 'plan'
  const oldKey = page.workspace.activeId.value
  const opening = page.openPlanChat('不知道怎样开始')
  expect(page.chatHandoff.pending.value?.current).toBe('还没写完的问题')
  page.chatHandoff.resolve('new')
  await opening
  expect(page.tab.value).toBe('chat')
  expect(page.draft.value).toContain('不知道怎样开始')
  expect(page.draft.value).toContain('现实条件')
  expect(page.messages.value).toHaveLength(0)
  expect(requests.some(request => request.url.endsWith('/chat'))).toBe(false)
  expect(page.workspace.get(oldKey).draft.value).toBe('还没写完的问题')
  const draft = page.draft.value
  page.openPlanChat('第二次点击')
  expect(page.draft.value).toBe(draft)
})
it('compares a conflicting step against the refreshed card while keeping new constraints', async () => {
  const page = setup()
  page.openPlanStep(); page.editor.next_step = '我的调整'
  const reload = page.reloadVersion()
  requests.at(-1).success({ statusCode: 200, data: { ...page.current.value, version: 4, card: { ...page.current.value!.card, constraints: ['新的收入条件'], next_step: '另一端的调整' } } })
  await reload
  expect(page.editor.next_step).toBe('我的调整')
  expect(page.current.value!.card.next_step).toBe('另一端的调整')
  const save = page.saveEditor()
  expect(requests.at(-1).data.card.constraints).toEqual(['新的收入条件'])
  expect(requests.at(-1).data.version).toBe(4)
  requests.at(-1).success({ statusCode: 200, data: { ...page.current.value, version: 5, card: requests.at(-1).data.card } })
  await save
})
it('saves only the chosen next step and retains other card fields without AI consent', async () => {
  const page = setup()
  page.openPlanStep()
  page.editor.next_step = '用半小时了解工作日常'
  page.editor.constraints = '不应覆盖原条件'
  const pending = page.saveEditor()
  const request = requests.at(-1)
  expect(request.data.version).toBe(3)
  expect(request.data.card.constraints).toEqual(['不能中断收入'])
  expect(request.data.card.next_step).toBe('用半小时了解工作日常')
  request.success({ statusCode: 200, data: { ...page.current.value, card: request.data.card, version: 4 } })
  await pending
  expect(page.current.value?.card.next_step).toBe('用半小时了解工作日常')
})
it('preserves a step draft on conflict and does not mutate an ended exploration', async () => {
  const page = setup()
  page.openPlanStep(); page.editor.next_step = '我的新想法'
  const pending = page.saveEditor()
  requests.at(-1).success({ statusCode: 409, data: { detail: '版本冲突' } }); await pending
  expect(page.editor.next_step).toBe('我的新想法')
  expect(page.modal.value).toBe('edit')
  page.modal.value = ''; page.current.value!.ended_at = '2026-10-25'
  page.openPlanStep(); page.openPlanChat('想法')
  expect(page.modal.value).toBe(''); expect(page.tab.value).toBe('plan')
})
it('offers an explicit pause record for review without ending or clearing the exploration', () => {
  const page = setup()
  page.openPlanPause()
  expect(page.modal.value).toBe('feedback')
  expect(page.feedbackKind.value).toBe('change')
  expect(page.feedbackText.value).toContain('先放一放')
  expect(page.current.value!.ended_at).toBeNull()
  expect(page.current.value!.card.next_step).toBe('问一位朋友')
  expect(requests).toHaveLength(0)
  page.feedbackText.value = '尚未保存的观察'
  page.openPlanPause()
  expect(page.feedbackText.value).toBe('尚未保存的观察')
})
it('hides the completed summary action until this conversation has new user content', async () => {
  const page = setup(); page.startNewChat(); await Promise.resolve()
  page.messages.value = [{role:'user',content:'帮我整理记录'}, {role:'assistant',content:'待你确认',payload:{plan_draft:{title:'记录',text:'刚才的经历',next_step:null}}}]
  page.reviewPlanDraft()
  const pending = page.plan.save()
  requests.at(-1).success({statusCode:200,data:{issue_id:'issue',version:4,next_step:'问一位朋友',status:'active',attempt_id:'attempt',records:[],latest:null}})
  await pending
  expect(page.planDraft.value).toBeNull()
  expect(page.canSummarizePlan?.value).toBe(false)
  expect(page.messages.value[1].payload?.plan_saved).toBe(true)
  page.messages.value.push({role:'user',content:'现在有个新进展'},{role:'assistant',content:'我们接着看看'})
  expect(page.canSummarizePlan?.value).toBe(true)
  page.startNewChat()
  expect(page.canSummarizePlan?.value).toBe(false)
})
