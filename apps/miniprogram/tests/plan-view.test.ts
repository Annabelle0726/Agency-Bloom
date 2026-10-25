import { createRenderer, h } from 'vue'
import { expect, it } from 'vitest'
import PlanView from '../src/pages/index/views/PlanView.vue'
import type { Issue, PlanState } from '../src/domain'

type Node = { type:string; text:string; props:Record<string,any>; children:Node[]; parent?:Node }
const node=(type:string,text=''):Node=>({type,text,props:{},children:[]})
const renderer=createRenderer<Node,Node>({
  patchProp:(el,key,_old,value)=>{el.props[key]=value},createElement:node,createText:text=>node('#text',text),createComment:()=>node('#comment'),
  setText:(el,text)=>{el.text=text},setElementText:(el,text)=>{el.text=text;el.children=[]},parentNode:el=>el.parent!,nextSibling:()=>null,
  insert:(el,parent)=>{el.parent=parent;parent.children.push(el)},remove:el=>{if(el.parent)el.parent.children=el.parent.children.filter(c=>c!==el)},
})
const all=(n:Node):Node[]=>[n,...n.children.flatMap(all)]
const current:Issue={id:'issue',version:1,title:'当前方向',stage:'',background:'',concerns:[],feedback:[],created_at:'',updated_at:'',ended_at:null,card:{title:'',confirmed:[],constraints:[],options:[],hypotheses:[],unknowns:[],next_step:'问一位朋友'}}
const observation={id:'record:one',title:'进展',text:'唯一的一条最新进展',created_at:'2026-10-25T08:00:00Z',version:'1',kind:'thought',attempt_id:'attempt',editable:true}
const state:PlanState={issue_id:'issue',version:1,next_step:current.card.next_step,status:'active',attempt_id:'attempt',records:[observation],latest:observation}
it('renders the latest observation once instead of repeating it in history',()=>{
  const root=node('root'),app=renderer.createApp(()=>h(PlanView,{current,card:current.card,themeId:'dark',planState:state}))
  app.mount(root)
  expect(all(root).filter(n=>n.text===observation.text)).toHaveLength(1)
  app.unmount()
})
it('offers a new step after completion instead of continuing to prompt progress on the old one',()=>{
  const root=node('root'),app=renderer.createApp(()=>h(PlanView,{current,card:current.card,themeId:'dark',planState:{...state,status:'completed'}}))
  app.mount(root)
  expect(all(root).some(n=>n.text.includes('想想下一步'))).toBe(true)
  expect(all(root).some(n=>n.text.includes('记录新进展'))).toBe(false)
  app.unmount()
})
