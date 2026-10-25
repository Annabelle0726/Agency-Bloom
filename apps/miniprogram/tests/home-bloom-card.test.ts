import { createRenderer, h, nextTick } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import HomeBloomCard from '../src/components/HomeBloomCard.vue'
import { homeEntryFor } from '../src/home-entry'
import type { HomeEntry } from '../src/home-entry'

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
function mount(busy=false,providedEntry?:HomeEntry) {
  const root=node('root'), resume=vi.fn(), details=vi.fn(),context=vi.fn()
  const entry=providedEntry||homeEntryFor(null,{title:'',options:[],constraints:[],confirmed:[],hypotheses:[],unknowns:[],next_step:''},null,false)
  const app=renderer.createApp(()=>h(HomeBloomCard,{entry,busy,hasConcern:true,onContinue:resume,onDetails:details,onContext:context}))
  app.mount(root);dispose=()=>app.unmount()
  const area=(name:string)=>find(root,n=>n.props['data-home']===name)[0]
  return {root,resume,details,context,area}
}
it('uses Bloom as the conversation entry without a duplicate card CTA',()=>{
  const {resume,area}=mount()
  area('bloom').props.onClick()
  expect(area('continue')).toBeUndefined()
  expect(resume.mock.calls).toEqual([[]])
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
  expect(area('continue')).toBeUndefined()
  area('bloom').props.onClick()
  expect(resume).not.toHaveBeenCalled()
  area('details').props.onClick()
  expect(details).toHaveBeenCalledOnce()
})
it('frames the real question with separate decorative corners without inserting literal brackets',()=>{
  const base=homeEntryFor(null,{title:'',options:[],constraints:[],confirmed:[],hypotheses:[],unknowns:[],next_step:''},null,false)
  const {area}=mount(false,{...base,title:'技能派不上用场',topic:'技能派不上用场',kicker:'此刻，我在意的'})
  expect(area('question').text).toBe('技能派不上用场')
  expect(area('question').props.selectable).toBe(true)
  expect(area('question-opening').type).toBe('view')
  expect(area('question-closing').type).toBe('view')
  expect(area('question-opening').text).toBeUndefined()
  expect(area('question-closing').text).toBeUndefined()
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
it('opens starting-record details independently of the conversation entry',()=>{
  const base=homeEntryFor(null,{title:'',options:[],constraints:[],confirmed:[],hypotheses:[],unknowns:[],next_step:''},null,false)
  const {area,context,resume}=mount(false,{...base,stamp:'起点记录 · 10月25日',hasInitialContext:true})
  area('context').props.onClick()
  expect(area('context').text).toBe('初始快照')
  expect(area('context').props['aria-label']).toContain('只读')
  const footer=area('context').parent!
  expect(footer.children.indexOf(area('details'))).toBeLessThan(footer.children.indexOf(area('context')))
  expect(context).toHaveBeenCalledOnce()
  expect(resume).not.toHaveBeenCalled()
})
