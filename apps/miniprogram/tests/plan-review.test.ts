import { ref } from 'vue'
import { expect, it, vi } from 'vitest'
import { usePlan } from '../src/use-plan'
import type { Issue } from '../src/domain'

function setup() {
  const current = ref({ id: 'a', version: 2, ended_at: null, card: { next_step: '原先的一步' } } as Issue)
  const userKey = ref('user')
  const calls: any[] = []
  const request = vi.fn(async (method, path, body) => { calls.push({ method, path, body }); return { issue_id: 'a', version: 3, next_step: body?.next_step ?? '原先的一步', status: 'active', records: [], latest: null } })
  const session = {}
  const chat = vi.fn(async () => session)
  const plan = usePlan({ current, userKey, request: request as any, chat, id: () => 'request', changed: vi.fn() })
  return { plan, current, userKey, calls, request, session, chat }
}
it('opens a new editor from the latest loaded step and version together', async () => {
  const { plan, request, calls } = setup()
  request.mockResolvedValueOnce({ issue_id:'a',version:4,next_step:'最新确认的一步',status:'active',attempt_id:'latest',records:[],latest:null } as any)
  await plan.load(); plan.open('step')
  expect(plan.editor.value!.nextStep).toBe('最新确认的一步')
  expect(plan.editor.value!.baseStep).toBe('最新确认的一步')
  await plan.save()
  expect(calls[0].body).toMatchObject({version:4,next_step:'最新确认的一步',attempt_id:'latest'})
})
it('keeps a stale full-card version stale when only Plan has been refreshed or saved', async () => {
  const {plan,current,request}=setup()
  request.mockResolvedValueOnce({issue_id:'a',version:4,next_step:'最新的一步',status:'active',attempt_id:'latest',records:[],latest:null} as any)
  await plan.load()
  expect(current.value!.card.next_step).toBe('最新的一步')
  expect(current.value!.version).toBe(2)
  plan.open('step')
  request.mockResolvedValueOnce({issue_id:'a',version:5,next_step:'我修改的一步',status:'active',attempt_id:'latest',records:[],latest:null} as any)
  await plan.save()
  expect(current.value!.version).toBe(2)
  expect(plan.state.value!.version).toBe(5)
})
it('keeps user edits while a Bloom revision is pending and previews the new version', async () => {
  const { plan, session, chat } = setup()
  plan.open('record')
  plan.editor.value!.text = '我还没决定，只想今天休息'
  plan.editor.value!.instruction = '请简短一点'
  await plan.refine()
  expect(chat.mock.calls[0][0]).toContain('我还没决定，只想今天休息')
  plan.review({ title: '今天', text: '今天想休息，尚未决定', next_step: null }, undefined, session)
  expect(plan.editor.value!.text).toBe('我还没决定，只想今天休息')
  expect(plan.incoming.value?.draft.text).toBe('今天想休息，尚未决定')
  plan.adopt()
  expect(plan.editor.value!.text).toBe('今天想休息，尚未决定')
  expect(plan.editor.value!.includeStep).toBe(false)
})
it('saves an edited observation without silently accepting a suggested step', async () => {
  const { plan, calls } = setup()
  plan.review({ title: '经历', text: '我不确定', next_step: '另一个建议' }, undefined, {})
  plan.editor.value!.text = '我仍不确定'
  plan.editor.value!.includeStep = false
  await plan.save()
  expect(calls[0].body.record.text).toBe('我仍不确定')
  expect(calls[0].body.next_step).toBeUndefined()
})
it('retains drafts after failures and account changes clear private drafts', async () => {
  const { plan, request, userKey } = setup()
  plan.open('record'); plan.editor.value!.text = '未保存的原话'
  request.mockRejectedValueOnce(Error('版本冲突'))
  await plan.save()
  expect(plan.editor.value!.text).toBe('未保存的原话')
  expect(plan.error.value).toBe('版本冲突')
  userKey.value = 'other'
  await Promise.resolve()
  expect(plan.editor.value).toBeNull()
})
it('keeps a visible comparison after reloading a conflicting record', async () => {
  const { plan, request } = setup()
  plan.open('record', { id: 'record:one', title: '原记录', text: '原内容', version: '1', kind: 'thought', created_at: '', attempt_id: null, editable: true })
  plan.editor.value!.text = '我的更正'
  request.mockResolvedValueOnce({ issue_id: 'a', version: 4, next_step: '一步', records: [{ id: 'record:one', text: '别处的更正', version: '2' }] } as any)
  await plan.reload()
  expect(plan.editor.value!.text).toBe('我的更正')
  expect(plan.state.value!.records[0].text).toBe('别处的更正')
  expect(plan.editor.value!.recordVersion).toBe('2')
})
it('reopens the same Bloom draft without losing manual changes or proposing it again', () => {
  const { plan, session } = setup()
  const draft = { title: '一段记录', text: '原始总结', next_step: null }
  plan.review(draft, 'source', session)
  plan.editor.value!.text = '我的表达'
  plan.visible.value = false
  plan.review(draft, 'source', session)
  expect(plan.editor.value!.text).toBe('我的表达')
  expect(plan.incoming.value).toBeNull()
})
it('refreshes state after editing the full card elsewhere without overwriting the open draft', async () => {
  const { plan, current } = setup()
  plan.open('step'); plan.editor.value!.nextStep = '还没保存'
  current.value = { ...current.value!, version: 4, plan: { issue_id: 'a', version: 4, status: 'active', next_step: '别处选的一步', attempt_id: 'new', records: [], latest: null } }
  await Promise.resolve()
  expect(plan.state.value!.next_step).toBe('别处选的一步')
  expect(plan.editor.value!.nextStep).toBe('还没保存')
  expect(plan.editor.value!.version).toBe(2)
})
it('distinguishes editing an existing attempt from choosing a new one', async () => {
  const { plan, calls } = setup()
  plan.open('step');plan.editor.value!.nextStep='调整表达'
  await plan.save()
  expect(calls[0].body.step_action).toBe('revise')
  plan.open('next')
  expect(plan.editor.value!.nextStep).toBe('')
  plan.editor.value!.nextStep='另一种尝试'
  await plan.save()
  expect(calls[1].body.step_action).toBe('replace')
})
it('reviews memory sync together with the update and sends its optimistic version', async () => {
  const { plan, calls, current } = setup()
  current.value = { ...current.value!, plan: { issue_id: 'a', version: 2, next_step: '原先的一步', status: 'active', attempt_id: 'attempt', records: [], latest: null, memory_sync: true, memory_version: 4 } }
  await Promise.resolve()
  plan.open('completed')
  expect(plan.editor.value!.rememberPlan).toBe(true)
  await plan.save()
  expect(calls[0].body.remember_plan).toBe(true)
  expect(calls[0].body.memory_version).toBe(4)
})
it('keeps a disabled memory sync off and preserves that choice on save', async () => {
  const { plan, calls, current } = setup()
  current.value = { ...current.value!, plan: { issue_id: 'a', version: 2, next_step: '原先的一步', status: 'active', attempt_id: 'attempt', records: [], latest: null, memory_sync: false, memory_version: null } }
  await Promise.resolve()
  plan.open('completed')
  expect(plan.editor.value!.rememberPlan).toBe(false)
  await plan.save()
  expect(calls[0].body.remember_plan).toBe(false)
})
it('refreshes memory controls after returning from memory management without losing record edits', async () => {
  const { plan, request } = setup()
  plan.open('record'); plan.editor.value!.text = '还没保存的进展'
  request.mockResolvedValueOnce({ issue_id:'a',version:2,next_step:'原先的一步',status:'active',attempt_id:'attempt',records:[],latest:null,memory_sync:false,memory_version:5 } as any)
  await plan.refreshMemory()
  expect(plan.editor.value!.text).toBe('还没保存的进展')
  expect(plan.editor.value!.rememberPlan).toBe(false)
  expect(plan.editor.value!.memoryVersion).toBe(5)
  plan.open('next')
  expect(plan.editor.value!.rememberPlan).toBe(false)
})

it('does not clear another account busy state when an earlier save finishes', async () => {
  const { plan, userKey, request } = setup()
  let oldDone: (value: any) => void = () => {}
  let newDone: (value: any) => void = () => {}
  request.mockImplementationOnce(() => new Promise(resolve => { oldDone = resolve }))
  plan.open('record'); plan.editor.value!.text = 'old account draft'
  const oldSave = plan.save()
  userKey.value = 'other'
  expect(plan.editor.value).toBeNull()
  request.mockImplementationOnce(() => new Promise(resolve => { newDone = resolve }))
  plan.open('record'); plan.editor.value!.text = 'new account draft'
  const newSave = plan.save()
  oldDone({issue_id:'a',version:3,next_step:'old',status:'active',records:[],latest:null})
  await oldSave
  expect(plan.busy.value).toBe(true)
  expect(plan.editor.value!.text).toBe('new account draft')
  newDone({issue_id:'a',version:3,next_step:'new',status:'active',records:[],latest:null})
  await newSave
  expect(plan.busy.value).toBe(false)
})
it('does not show an old refinement error in a newly selected exploration', async () => {
  const { plan, current, chat } = setup()
  let fail: (error: Error) => void = () => {}
  chat.mockImplementationOnce(() => new Promise((_,reject) => { fail = reject }))
  plan.open('record'); plan.editor.value!.text = 'old exploration'
  const refining = plan.refine()
  current.value = {...current.value!,id:'b'}
  plan.open('record');plan.editor.value!.text = 'new exploration'
  fail(Error('old failure'))
  await refining
  expect(plan.error.value).toBe('')
  expect(plan.editor.value!.text).toBe('new exploration')
})
