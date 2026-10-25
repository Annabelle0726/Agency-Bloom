import { afterEach, expect, it, vi } from 'vitest'
import { createRenderer, h, nextTick, reactive } from 'vue'
import ConversationDrawer from '../src/components/ConversationDrawer.vue'
import type { InitialSnapshot, Issue, User } from '../src/domain'

interface Node { type:string;props:Record<string,any>;children:Node[];parent?:Node;text?:string;[key:string]:any }
const node=(type:string):Node=>({type,tagName:type.toUpperCase(),props:{},children:[],style:{},addEventListener(){},removeEventListener(){},setAttribute(){}})
const renderer=createRenderer<Node,Node>({createElement:node,createText:text=>({...node('#text'),text}),createComment:()=>node('#comment'),setText:(el,text)=>{el.text=text},setElementText:(el,text)=>{el.text=text;el.children=[]},patchProp:(el,key,_old,value)=>{el.props[key]=value},parentNode:el=>el.parent!,nextSibling:el=>el.parent?.children[(el.parent.children.indexOf(el))+1]||null,insert:(el,parent,anchor)=>{if(el.parent)el.parent.children=el.parent.children.filter(n=>n!==el);el.parent=parent;const i=anchor?parent.children.indexOf(anchor):-1;if(i<0)parent.children.push(el);else parent.children.splice(i,0,el)},remove:el=>{if(el.parent)el.parent.children=el.parent.children.filter(n=>n!==el)}})
const find=(root:Node,test:(n:Node)=>boolean):Node[]=>[...(test(root)?[root]:[]),...root.children.flatMap(child=>find(child,test))]
const text=(root:Node):string=>(root.text||'')+root.children.map(text).join('')
const cls=(root:Node,name:string)=>find(root,n=>String(n.props.class||'').split(' ').includes(name))
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();await nextTick()}
const snapshot=(id:string):InitialSnapshot=>({id:'snapshot:'+id,version:2,direction:'当时记录的方向 '+id,source:'onboarding',captured_at:'2026-10-25T08:00:00Z',background:'',stage:'unsure',life_contexts:[],constraints:[],concerns:['direction'],answers:{follow_ups:{direction:{selections:['技能派不上用场'],note:'保留自己的选择',refinements:{'技能派不上用场':['想重新看看做过的项目']}}}}})
const issue=(id:string):Issue=>({id,title:id,concerns:[],stage:'',background:'',created_at:'2026-10-25',updated_at:'2026-10-25',ended_at:null,version:1,feedback:[],card:{title:'',options:[],constraints:[],confirmed:[],hypotheses:[],unknowns:[],next_step:''}})
const user:User={id:'user-a',theme:'forest',save_chat:true,ai_consent:false,support_style:'listen',use_memory:false}
type View='list'|'memories'|'direction'|'summary'|'details'|'snapshots'
let dispose=()=>{}
afterEach(()=>{dispose();vi.unstubAllGlobals()})
function mount(view:View='list',handler:(_method:string,path:string,data?:any)=>Promise<any>=async(_m,p)=>p==='/memories'?[]:snapshot(p.split('/')[2])){
  vi.stubGlobal('document',{activeElement:null,querySelector:()=>null})
  vi.stubGlobal('uni',{showModal:(options:any)=>options.success({confirm:true})})
  const request=vi.fn(handler),refresh=vi.fn(),contextChanged=vi.fn()
  const props=reactive({view,initialIssueId:'two',issues:[issue('one'),issue('two')],conversations:[],active:null,user:{...user},summary:null,summaryDraft:null,generating:false,running:[],request})
  const root=node('root'),app=renderer.createApp(()=>h(ConversationDrawer,{...props,onViewChanged:(next:View)=>{props.view=next},onRefresh:refresh,onContextChanged:contextChanged}))
  app.component('scroll-view',{render(){return h('scroll-view',this.$attrs,this.$slots.default?.())}})
  app.mount(root);dispose=()=>app.unmount()
  return {root,props,request,refresh,contextChanged}
}
it('exposes an independent snapshot tab and loads it without reading or enabling memories',async()=>{
  const {root,request}=mount()
  const tab=find(root,n=>n.props['data-view']==='snapshots')[0]
  expect(tab).toBeDefined()
  await tab.props.onClick();await flush()
  expect(request.mock.calls.every(call=>call[1]!=='/memories')).toBe(true)
  expect(cls(root,'snapshot-item').map(text)).toHaveLength(2)
  expect(text(cls(root,'snapshot-item')[0])).toContain('方向 two')
  expect(text(root)).toContain('想重新看看做过的项目')
  expect(text(root)).toContain('初始快照仅供查看，不能修改')
  expect(cls(root,'memory-use')).toHaveLength(0)
})
it('does not conflate absent snapshots with a load failure and supports retry',async()=>{
  let fail=true
  const {root}=mount('snapshots',async()=>{if(fail)throw Error('暂时无法读取起点记录');return null})
  await flush()
  expect(cls(root,'snapshot-load-error')).toHaveLength(1)
  expect(cls(root,'snapshot-empty')).toHaveLength(0)
  fail=false;await cls(root,'snapshot-retry')[0].props.onClick();await flush()
  expect(cls(root,'snapshot-load-error')).toHaveLength(0)
  expect(cls(root,'snapshot-empty')).toHaveLength(1)
})
it('keeps readable snapshots when only one request fails',async()=>{
  const {root}=mount('snapshots',async(_m,p)=>{if(p.includes('/one/'))throw Error('读取失败');return snapshot('two')})
  await flush()
  expect(cls(root,'snapshot-item')).toHaveLength(1)
  expect(cls(root,'snapshot-load-error')).toHaveLength(1)
  expect(text(root)).toContain('方向 two')
})
it('discards a late snapshot response after switching accounts',async()=>{
  let release!:(value:InitialSnapshot)=>void
  const late=new Promise<InitialSnapshot>(resolve=>{release=resolve})
  const {root,props}=mount('snapshots',async()=>late)
  props.user={...user,id:'user-b'};props.issues=[];props.initialIssueId='';await flush()
  release(snapshot('private-user-a'));await flush()
  expect(text(root)).not.toContain('private-user-a')
  expect(cls(root,'snapshot-item')).toHaveLength(0)
})
it('deletes the chosen snapshot with its version and leaves unrelated snapshots visible',async()=>{
  const {root,request,refresh,contextChanged}=mount('snapshots',async(method,p)=>method==='DELETE'?{}:snapshot(p.split('/')[2]))
  await flush();const before=cls(root,'snapshot-item')
  await cls(before[0],'delete-snapshot')[0].props.onClick();await flush()
  expect(request).toHaveBeenCalledWith('DELETE','/issues/two/snapshot?version=2')
  expect(cls(root,'snapshot-item')).toHaveLength(1)
  expect(text(cls(root,'snapshot-item')[0])).toContain('方向 one')
  expect(refresh).toHaveBeenCalledOnce();expect(contextChanged).toHaveBeenCalledOnce()
})
it('shares the conversation filter styling and retains actual category filtering',async()=>{
  const {root}=mount('memories',async()=>[
    {id:'fact',content:'一条事实',category:'fact',enabled:true,horizon:'long_term',status:'active',version:1,updated_at:'2026-10-25'},
    {id:'preference',content:'一条偏好',category:'preference',enabled:true,horizon:'long_term',status:'active',version:1,updated_at:'2026-10-25'},
  ])
  await flush();const filters=cls(root,'memory-filters')[0]
  expect(String(filters.props.class)).toContain('drawer-filter-tabs')
  const fact=find(filters,n=>n.type==='button'&&text(n)==='事实')[0]
  await fact.props.onClick();await flush()
  expect(cls(root,'memory-item').map(text).join('')).toContain('一条事实')
  expect(cls(root,'memory-item').map(text).join('')).not.toContain('一条偏好')
})
