import { createRenderer, h, nextTick } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import HomeBloomCard from '../src/components/HomeBloomCard.vue'
import { homeEntryFor } from '../src/home-entry'

type Node = { type:string; props:Record<string,any>; children:Node[]; parent?:Node; text?:string }
const node = (type:string):Node => ({ type,props:{},children:[] })
const renderer = createRenderer<Node,Node>({
  patchProp:(el,key,_old,value)=>{el.props[key]=value}, createElement:node,
  createText:text=>({...node('#text'),text}), createComment:()=>node('#comment'),
  setText:(el,text)=>{el.text=text}, setElementText:(el,text)=>{el.text=text;el.children=[]},
  parentNode:el=>el.parent!, nextSibling:()=>null, insert:(el,parent)=>{el.parent=parent;parent.children.push(el)},
  remove:el=>{if(el.parent)el.parent.children=el.parent.children.filter(item=>item!==el)},
})
function find(root:Node, predicate:(node:Node)=>boolean):Node[] {
  return [...(predicate(root)?[root]:[]),...root.children.flatMap(child=>find(child,predicate))]
}
let dispose=()=>{}
afterEach(()=>dispose())
function mount(busy=false) {
  const root=node('root'), resume=vi.fn(), details=vi.fn()
  const entry=homeEntryFor(null,{title:'',options:[],constraints:[],confirmed:[],hypotheses:[],unknowns:[],next_step:''},null,false)
  const app=renderer.createApp(()=>h(HomeBloomCard,{entry,busy,hasConcern:true,onContinue:resume,onDetails:details}))
  app.mount(root);dispose=()=>app.unmount()
  const area=(name:string)=>find(root,n=>n.props['data-home']===name)[0]
  return {root,resume,details,area}
}
it('Bloom is the only conversation entry and does not send a prepared message',()=>{
  const {resume,area}=mount()
  area('bloom').props.onClick()
  expect(resume.mock.calls).toEqual([[]])
  expect(area('continue')).toBeUndefined()
})
it('keeps the local invitation compact without a separate close action',()=>{
  const {root,resume,area}=mount()
  expect(find(root,n=>n.props['aria-label']==='收起 Bloom 的邀请')).toHaveLength(0)
  expect(area('invitation')).toBeDefined()
  expect(area('bloom')).toBeDefined()
  expect(resume).not.toHaveBeenCalled()
})
it('disables Bloom during opening without dispatching duplicate entries and keeps the independent detail action',()=>{
  const {area,details,resume}=mount(true)
  expect(area('bloom').props.disabled).toBe(true)
  area('bloom').props.onClick()
  expect(resume).not.toHaveBeenCalled()
  area('details').props.onClick()
  expect(details).toHaveBeenCalledOnce()
})
it('finishes the greeting before revealing its invitation and ignores unrelated animation events',async()=>{
  const {area}=mount()
  expect(area('greeting-stage')).toBeDefined()
  expect(area('greeting-stage').props['data-phase']).toBe('waiting')
  const sprite=area('greeting-sprite')
  sprite.props.onLoad();await nextTick()
  expect(area('greeting-stage').props['data-phase']).toBe('playing')
  area('greeting-animation').props.onAnimationend({detail:{animationName:'another-animation'}});await nextTick()
  expect(area('greeting-stage').props['data-phase']).toBe('playing')
  area('greeting-animation').props.onAnimationend({detail:{animationName:'bloom-greet-scoped'}});await nextTick()
  expect(area('greeting-stage').props['data-phase']).toBe('complete')
})
it('keeps Bloom actionable and reveals static content if the greeting asset fails',async()=>{
  const {area,resume}=mount()
  expect(area('greeting-stage')).toBeDefined()
  area('greeting-sprite').props.onError();await nextTick()
  expect(area('greeting-stage').props['data-phase']).toBe('fallback')
  area('bloom').props.onClick();expect(resume).toHaveBeenCalledOnce()
})
