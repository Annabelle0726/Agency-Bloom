import { afterEach, expect, it, vi } from 'vitest'
import { createRenderer, h, nextTick, reactive } from 'vue'
import MeRecordsPanel from '../src/components/MeRecordsPanel.vue'
import MemorySource from '../src/components/MemorySource.vue'
import ConversationDrawer from '../src/components/ConversationDrawer.vue'
import SettingsView from '../src/pages/index/views/SettingsView.vue'
import { resolveTheme } from '../src/themes'
import type { InitialSnapshot, Issue, User } from '../src/domain'
interface Node { type: string; props: Record<string, any>; children: Node[]; parent?: Node; text?: string; [key: string]: any }
const node = (type: string): Node => ({ type, tagName: type.toUpperCase(), props: {}, children: [], addEventListener() {}, setAttribute() {} })
const renderer = createRenderer<Node, Node>({
  createElement: node, createText: text => ({ ...node('#text'), text }), createComment: node,
  setText: (el, text) => { el.text = text }, setElementText: (el, text) => { el.text = text },
  parentNode: el => el.parent, nextSibling: () => null,
  patchProp: (el, key, _old, value) => { el.props[key] = value },
  insert(el, parent, anchor) {
    if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1)
    const at = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(at < 0 ? parent.children.length : at, 0, el); el.parent = parent
  },
  remove(el) { if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1) },
})
function find(root: Node, className: string): Node[] {
  return [...(String(root.props.class || '').split(' ').includes(className) ? [root] : []), ...root.children.flatMap(child => find(child, className))]
}
const text = (el: Node): string => (el.text || '') + el.children.map(text).join('')

let dispose = () => {}
afterEach(() => { dispose(); vi.unstubAllGlobals() })
const flush = async () => { for (let i=0;i<16;i++) await Promise.resolve(); await nextTick() }
const user: User = { id:'u', theme:'forest', save_chat:true, ai_consent:true, use_memory:false, support_style:'listen' }
const current = { id:'i', title:'我的选择', card:{}, feedback:[] } as unknown as Issue
const snapshot: InitialSnapshot = { id:'snapshot:i', version:7, captured_at:'2026-10-24', source:'onboarding', direction:'', background:'', stage:'unsure', concerns:['relationships'], constraints:[], life_contexts:[], answers:{follow_ups:{relationships:{selections:['自己的想法和家人的期待不同'],note:'',refinements:{'自己的想法和家人的期待不同':['还没理清自己的选择']}}}} }
function mount(component: any = MeRecordsPanel, overrides: Record<string, any> = {}) {
  vi.stubGlobal('document', {activeElement:null})
  vi.stubGlobal('uni', { createSelectorQuery: () => ({ in() { return this }, select() { return this }, boundingClientRect(cb: Function) { cb({height:550}); return this }, exec() {} }), showModal: vi.fn((options: any) => options.success({confirm:true})), navigateTo:vi.fn() })
  const request=vi.fn(async (method: string, path: string) => path === '/memories' ? [] : path === '/me' ? {...user,use_memory:true} : snapshot)
  const changed=vi.fn(), userChanged=vi.fn(), logout=vi.fn()
  const props=reactive({ user:{...user}, current, request, revision:0, busy:false, themeId:'forest', onChanged:changed, onUserChanged:userChanged, ...overrides })
  const root=node('root'), app=renderer.createApp(() => h(component,{...props, ...(component === SettingsView ? {activeTheme:resolveTheme('forest'),themeAuto:true,themeBusy:false,nextThemeBoundary:'19:00',usage:{daily_calls:2,daily_limit:30},aiMode:'demo',recordsRevision:0,userAvatar:'',avatarBusy:false,onLogout:logout} : {})}))
  app.mount(root); dispose=()=>app.unmount()
  return {root,props,request,changed,userChanged,logout}
}
it('expands all supplied initial answers without inferring unanswered text and opens scoped Journey',async()=>{
  const {root}=mount();await flush()
  await find(root,'me-snapshot-entry')[0].props.onClick();await flush()
  expect(text(root)).toContain('自己的想法和家人的期待不同')
  expect(text(root)).toContain('还没理清自己的选择')
  expect(text(root)).toContain('未填写')
  await find(root,'me-journey-entry')[0].props.onClick()
  expect(uni.navigateTo).toHaveBeenCalledWith({url:'/pages/journey/index?from=me&theme=forest&issue=i'})
})
it('reads the acknowledged memory-use state and preserves the old preference when updating fails',async()=>{
  const {root,request,userChanged,changed}=mount();await flush()
  const toggle=()=>find(root,'me-record-row').find(el=>el.props['aria-pressed'] !== undefined)!
  await toggle().props.onClick();await flush()
  expect(request).toHaveBeenCalledWith('PUT','/me',{use_memory:true})
  expect(request).toHaveBeenCalledWith('GET','/me')
  expect(userChanged).toHaveBeenCalledWith(expect.objectContaining({use_memory:true}));expect(changed).toHaveBeenCalledOnce()
  request.mockRejectedValueOnce(Error('保存失败'))
  await toggle().props.onClick();await flush()
  expect(userChanged).toHaveBeenCalledTimes(1);expect(text(root)).toContain('保存失败')
})
it('confirms snapshot deletion with its version and keeps the original visible after a failed deletion',async()=>{
  const {root,request,changed}=mount();await flush()
  await find(root,'me-snapshot-entry')[0].props.onClick();await flush()
  request.mockRejectedValueOnce(Error('版本已变化，请重新读取'))
  await find(root,'me-delete-snapshot')[0].props.onClick();await flush()
  expect(uni.showModal).toHaveBeenCalledOnce()
  expect(request).toHaveBeenCalledWith('DELETE','/issues/i/snapshot?version=7')
  expect(changed).not.toHaveBeenCalled();expect(text(root)).toContain('版本已变化')
  expect(text(root)).toContain('自己的想法和家人的期待不同')
})
it('keeps the existing logout button label, hover feedback and event',async()=>{
  const {root,logout}=mount(SettingsView);await flush()
  const button=find(root,'logout-button')[0]
  expect(text(button).trim()).toBe('退出登录')
  expect(button.props['hover-class']).toBe('gem-logout-pressed')
  await button.props.onClick();expect(logout).toHaveBeenCalledOnce()
})
it('does not fetch a source without retention and keeps unavailable sources separate from saved records',async()=>{
  const request=vi.fn(async()=>{throw Error('404')})
  const {root,props}=mount(MemorySource,{item:{id:'m',source_conversation_id:'c'},userId:'u',retainChat:false,request})
  await flush();expect(request).not.toHaveBeenCalled();expect(text(root)).toContain('来源原文不可用')
  Object.assign(props,{retainChat:true});await flush()
  await find(root,'memory-source-toggle')[0].props.onClick();await flush()
  expect(text(root)).toContain('已确认的记录仍保留')
})

it('offers a read-only recovery when the setting was saved but readback failed',async()=>{
  const {root,request,userChanged,changed}=mount();await flush()
  request.mockResolvedValueOnce(null as any).mockRejectedValueOnce(Error('网络中断'))
  const toggle=find(root,'me-record-row').find(el=>el.props['aria-pressed'] !== undefined)!
  await toggle.props.onClick();await flush()
  expect(changed).toHaveBeenCalledOnce();expect(userChanged).not.toHaveBeenCalled()
  expect(text(root)).toContain('未能确认当前状态')
  await find(root,'me-confirm-preference')[0].props.onClick();await flush()
  expect(userChanged).toHaveBeenCalledWith(expect.objectContaining({use_memory:true}))
  expect(request.mock.calls.filter(([method])=>method==='PUT')).toHaveLength(1)
})
it('does not attach a manually added direction to an unrelated active conversation',async()=>{
  const request=vi.fn(async(method:string,path:string)=>path==='/memories' ? [] : null)
  const {root}=mount(ConversationDrawer,{view:'direction',issues:[],conversations:[],active:{id:'unrelated',issue_id:'other'},summary:null,summaryDraft:null,generating:false,running:[],request})
  await flush()
  const toolbar=find(root,'memory-toolbar')[0]
  const button=toolbar.children.find(n=>n.type==='button')!
  await button.props.onClick();await flush()
  const textarea=find(root,'text-area')[0]
  textarea.props['onUpdate:modelValue']('希望每周留一点时间创作');await flush()
  await find(root,'confirm-memory')[0].props.onClick();await flush()
  expect(request).toHaveBeenCalledWith('POST','/memories',expect.objectContaining({content:'希望每周留一点时间创作',horizon:'current_phase',source_conversation_id:null,issue_id:null,confirmed:true}))
})

it('opens a record for editing when its text is tapped and keeps merge selection separate',async()=>{
  const item={id:'m',content:'每周留半天',category:'constraint',horizon:'current_phase',status:'active',enabled:true,issue_id:null,source_conversation_id:null,version:1,updated_at:'2026-10-24'}
  const request=vi.fn(async(_method:string,path:string)=>path==='/memories' ? [item] : null)
  const {root}=mount(ConversationDrawer,{view:'direction',issues:[],conversations:[],active:null,summary:null,summaryDraft:null,generating:false,running:[],request})
  await flush();await find(root,'memory-select')[0].props.onClick();await flush()
  expect(find(root,'memory-editor')).toHaveLength(1)
  expect(find(root,'memory-merge-select')[0].props['aria-pressed']).toBe(false)
  await find(root,'memory-merge-select')[0].props.onClick();await flush()
  expect(find(root,'memory-merge-select')[0].props['aria-pressed']).toBe(true)
})

it('groups Me into three initially collapsed sections and opens only one at a time',async()=>{
  const {root}=mount(SettingsView);await flush()
  const headers=()=>find(root,'me-accordion-trigger')
  expect(headers()).toHaveLength(3)
  expect(headers().map(n=>n.props['aria-expanded'])).toEqual([false,false,false])
  await headers()[0].props.onClick();await flush()
  expect(headers().map(n=>n.props['aria-expanded'])).toEqual([true,false,false])
  await headers()[1].props.onClick();await flush()
  expect(headers().map(n=>n.props['aria-expanded'])).toEqual([false,true,false])
  await headers()[1].props.onClick();await flush()
  expect(headers().map(n=>n.props['aria-expanded'])).toEqual([false,false,false])
  expect(find(root,'logout-button')).toHaveLength(1)
})
