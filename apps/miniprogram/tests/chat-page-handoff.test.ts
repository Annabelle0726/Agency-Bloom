import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('vue', async original => ({ ...await original<typeof import('vue')>(), onMounted:vi.fn(),onUnmounted:vi.fn(),provide:vi.fn() }))
vi.mock('@dcloudio/uni-app', () => ({onShow:vi.fn(),onHide:vi.fn(),onReady:vi.fn()}))
import { nextTick } from 'vue'
import { useIndexPage } from '../src/pages/index/useIndexPage'
const issue = {id:'issue',title:'求职',version:2,ended_at:null,feedback:[],concerns:[],card:{title:'求职',options:[],confirmed:[],constraints:[],hypotheses:[],unknowns:[],next_step:'问朋友'}}
let requests:any[], held:boolean
beforeEach(() => {
 vi.useFakeTimers(); requests=[]; held=false
 vi.stubGlobal('uni', {
 getStorageSync:(key:string)=>key==='agency.session'?'synthetic-token':undefined,setStorageSync:vi.fn(),removeStorageSync:vi.fn(),
 getWindowInfo:()=>({statusBarHeight:20}),getMenuButtonBoundingClientRect:()=>({bottom:64}),getSystemInfoSync:()=>({windowHeight:844,windowWidth:390}),
 onKeyboardHeightChange:vi.fn(),offKeyboardHeightChange:vi.fn(),onNetworkStatusChange:vi.fn(),offNetworkStatusChange:vi.fn(),$on:vi.fn(),$off:vi.fn(),setNavigationBarColor:vi.fn(),pageScrollTo:vi.fn(),
 request:(options:any)=>{
  requests.push(options)
  const path=new URL(options.url).pathname.replace(/^\/api/,'')
  if (held && path==='/issues/issue') return {abort:vi.fn()}
  const data=path==='/issues/issue'?structuredClone(issue):path.endsWith('/plan')?{issue_id:'issue',version:2,next_step:'问朋友',status:'active',attempt_id:'a',records:[],latest:null}:path.endsWith('/messages')?{items:[],next_cursor:null}:[]
  queueMicrotask(()=>options.success({statusCode:200,data}));return{abort:vi.fn()}
 } })
})
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()})
async function setup() {
 const p=useIndexPage();p.user.value={id:'person',theme:'light',save_chat:false,ai_consent:false} as any
 p.current.value=structuredClone(issue) as any;p.tab.value='plan'
 p.conversations.value=[{id:'a',issue_id:'issue',updated_at:'2026-10-26',archived_at:null},{id:'b',issue_id:'issue',updated_at:'2026-10-25',archived_at:null}] as any
 p.workspace.select('a');p.workspace.get('a').loaded.value=true
 await nextTick();return p
}
it('asks before bringing Plan text into an existing composer and can append without sending',async()=>{
 const p=await setup();p.draft.value='我的原稿'
 const opening=p.openPlanChat('新进展')
 expect(p.chatHandoff.pending.value?.current).toBe('我的原稿')
 p.chatHandoff.resolve('append');await opening
 expect(p.workspace.activeId.value).toBe('a');expect(p.draft.value).toMatch(/^我的原稿\n\n/)
 expect(p.draft.value).toContain('新进展');expect(requests.some(r=>r.url.endsWith('/chat'))).toBe(false)
})
it('can create a separate conversation without altering the existing draft',async()=>{
 const p=await setup();p.draft.value='保留原稿'
 const opening=p.openPlanChat('另一个角度');p.chatHandoff.resolve('new');await opening
 expect(p.workspace.activeId.value).toMatch(/^draft:/)
 expect(p.workspace.get('a').draft.value).toBe('保留原稿')
 expect(p.draft.value).toContain('另一个角度')
})
it('cancel leaves the user on Plan and keeps the draft unchanged',async()=>{
 const p=await setup();p.draft.value='保留原稿'
 const opening=p.openPlanChat('暂不带入');p.chatHandoff.cancel();await opening
 expect(p.tab.value).toBe('plan');expect(p.draft.value).toBe('保留原稿')
})
it('does not inject a late Plan prompt into a conversation selected later',async()=>{
 const p=await setup();held=true
 const opening=p.openPlanChat('A的讨论')
 const old=requests.filter(r=>r.url.endsWith('/issues/issue')).slice(-1)[0]
 p.workspace.get('b').loaded.value=true
 const selecting=p.selectConversation(p.conversations.value[1])
 const newer=requests.filter(r=>r.url.endsWith('/issues/issue')).slice(-1)[0]
 newer.success({statusCode:200,data:structuredClone(issue)});await selecting
 old.success({statusCode:200,data:structuredClone(issue)});await opening
 expect(p.workspace.activeId.value).toBe('b');expect(p.draft.value).toBe('')
})
it('handles entry failure on Plan while preserving the existing composer',async()=>{
 const p=await setup();held=true
 const opening=p.openPlanChat('原来的难处')
 requests.filter(r=>r.url.endsWith('/issues/issue')).slice(-1)[0].fail({errMsg:'synthetic failure'})
 await expect(opening).resolves.toBeUndefined()
 expect(p.tab.value).toBe('plan');expect(p.plan.error.value).not.toBe('')
})
it('offers the same conflict choice for a never-sent conversation shell',async()=>{
 const p=await setup();p.startNewChat();p.draft.value='尚未发送过';p.tab.value='plan'
 const key=p.workspace.activeId.value,opening=p.openPlanChat('补充')
 expect(p.chatHandoff.pending.value?.current).toBe('尚未发送过')
 p.chatHandoff.resolve('append');await opening
 expect(p.workspace.activeId.value).toBe(key);expect(p.draft.value).toContain('尚未发送过\n\n')
})
it('restores the original selection if a draft appears while the destination is loading and the user cancels',async()=>{
 const p=await setup();held=true
 p.conversations.value[1].archived_at='2026-10-26'
 p.workspace.select('b')
 const opening=p.openPlanChat('新的讨论')
 p.workspace.get('a').draft.value='加载过程中同步回来的草稿'
 requests.filter(r=>r.url.endsWith('/issues/issue')).slice(-1)[0].success({statusCode:200,data:structuredClone(issue)})
 for(let i=0;i<12&&!p.chatHandoff.pending.value;i++)await Promise.resolve()
 expect(p.chatHandoff.pending.value?.current).toContain('同步回来的草稿')
 p.chatHandoff.cancel();await opening
 expect(p.workspace.activeId.value).toBe('b');expect(p.tab.value).toBe('plan')
 expect(p.workspace.get('a').draft.value).toContain('同步回来的草稿')
})
it('retries the same independent problem safely and gives changed content a fresh request identity',async()=>{
 const p=await setup();p.beginAnotherExploration();p.newExplorationDraft.title='关系沟通'
 const saves:any[]=[]
 ;(uni as any).request=(options:any)=>{saves.push(options);queueMicrotask(()=>options.fail({errMsg:'synthetic offline'}));return{abort:vi.fn()}}
 await p.saveNewExploration();await p.saveNewExploration()
 expect(saves[0].data.creation_request_id).toBe(saves[1].data.creation_request_id)
 p.newExplorationDraft.title='另一件需要整理的事';await p.saveNewExploration()
 expect(saves[2].data.creation_request_id).not.toBe(saves[1].data.creation_request_id)
 expect(p.newExplorationOpen.value).toBe(true)
})
it('keeps an overlong problem background editable and reports its limit before submitting',async()=>{
 const p=await setup();p.beginAnotherExploration();p.newExplorationDraft.title='关系沟通'
 p.newExplorationDraft.background='背景'.repeat(201)
 await p.saveNewExploration()
 expect(requests.some(r=>r.method==='POST'&&r.url.endsWith('/issues'))).toBe(false)
 expect(p.error.value).toContain('400');expect(p.newExplorationDraft.background).toHaveLength(402)
 expect(p.newExplorationOpen.value).toBe(true)
})
it('preserves an independent problem draft through a same-account preference refresh and clears it on account change',async()=>{
 const p=await setup();p.beginAnotherExploration();p.newExplorationDraft.title='尚未提交的关系问题'
 p.user.value={...p.user.value!,use_memory:true}
 expect(p.newExplorationOpen.value).toBe(true);expect(p.newExplorationDraft.title).toContain('尚未提交')
 p.user.value={...p.user.value!,id:'another-person'}
 expect(p.newExplorationOpen.value).toBe(false);expect(p.newExplorationDraft.title).toBe('')
})
it('keeps the first welcome out of transcript state and does not repeat it for a separate draft',async()=>{
 const p=await setup();p.conversations.value=[{id:'issue',issue_id:'issue',version:1,archived_at:null}] as any;p.workspace.select('issue')
 expect(p.firstWelcome.value).toBe(true);expect(p.messages.value).toEqual([])
 p.startNewChat();expect(p.firstWelcome.value).toBe(false);expect(p.messages.value).toEqual([])
})
