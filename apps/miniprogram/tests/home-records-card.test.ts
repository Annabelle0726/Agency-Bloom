import { createRenderer, h, nextTick, reactive } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import HomeRecordsCard from '../src/components/HomeRecordsCard.vue'
import type { Issue } from '../src/domain'
import { resolveHomeRecordVisual } from '../src/home-visual'

type Node={type:string;props:Record<string,any>;children:Node[];parent?:Node;text?:string}
const node=(type:string):Node=>({type,props:{},children:[]})
const renderer=createRenderer<Node,Node>({
  patchProp:(el,key,_old,value)=>{el.props[key]=value},createElement:node,
  createText:text=>({...node('#text'),text}),createComment:()=>node('#comment'),
  setText:(el,text)=>{el.text=text},setElementText:(el,text)=>{el.text=text;el.children=[]},
  parentNode:el=>el.parent!,nextSibling:()=>null,
  insert:(el,parent,anchor)=>{if(el.parent)el.parent.children=el.parent.children.filter(c=>c!==el);el.parent=parent;const i=anchor?parent.children.indexOf(anchor):-1;if(i<0)parent.children.push(el);else parent.children.splice(i,0,el)},
  remove:el=>{if(el.parent)el.parent.children=el.parent.children.filter(c=>c!==el)},
})
function find(root:Node,predicate:(n:Node)=>boolean):Node[]{return [...(predicate(root)?[root]:[]),...root.children.flatMap(child=>find(child,predicate))]}
const issue=(id='a'):Issue=>({id,title:'我的问题',concerns:[],stage:'',background:'',version:1,created_at:'2026-10-24T08:00:00Z',updated_at:'2026-10-24T08:00:00Z',ended_at:null,feedback:[],card:{title:'',options:[],confirmed:[],constraints:[],hypotheses:[],unknowns:[],next_step:''}})
let dispose=()=>{}
afterEach(()=>dispose())
function mount(current:Issue,withVisual=false){
  const root=node('root'),plan=vi.fn(),feedback=vi.fn(),state=reactive({issue:current})
  const app=renderer.createApp(()=>h(HomeRecordsCard,{issue:state.issue,visual:withVisual?resolveHomeRecordVisual(state.issue,'forest'):null,onPlan:plan,onFeedback:feedback}))
  app.mount(root);dispose=()=>app.unmount()
  const record=(id:string)=>find(root,n=>n.props['data-record']===id)[0]
  const action=(id:string)=>find(root,n=>n.props['data-home']===id)[0]
  return {root,state,plan,feedback,record,action}
}
it('offers one real recording entry when there is nothing saved, without placeholder insights',()=>{
  const {action,feedback,root}=mount(issue())
  expect(find(root,n=>!!n.props['data-record'])).toHaveLength(0)
  expect(action('records')).toBeUndefined()
  action('first-record').props.onClick()
  expect(feedback).toHaveBeenCalledOnce()
})
it('expands a saved observation locally and uses the existing Plan destination for an attempt',async()=>{
  const current=issue();current.card.next_step='试做一份作品'
  current.feedback=[{id:'1',kind:'change',text:'我想先留一些休息时间\n这并不意味着我要放弃原来的方向',created_at:current.created_at}]
  const {record,plan,feedback}=mount(current)
  record('a:feedback:1').props.onClick();await nextTick()
  expect(record('a:feedback:1').props['aria-expanded']).toBe(true)
  expect(plan).not.toHaveBeenCalled();expect(feedback).not.toHaveBeenCalled()
  record('a:step').props.onClick()
  expect(plan).toHaveBeenCalledOnce()
  record('a:feedback:1').props.onClick();await nextTick()
  expect(record('a:feedback:1').props['aria-expanded']).toBe(false)
})
it('clears expanded content when the selected exploration changes or the record is removed',async()=>{
  const first=issue();first.feedback=[{id:'1',kind:'progress',text:'第一件事的观察',created_at:first.created_at}]
  const {state,record}=mount(first)
  record('a:feedback:1').props.onClick();await nextTick()
  state.issue={...first,id:'b',feedback:[{...first.feedback[0],text:'另一个问题的记录'}]};await nextTick()
  expect(record('a:feedback:1')).toBeUndefined()
  expect(record('b:feedback:1').props['aria-expanded']).toBe(false)
  state.issue.feedback=[];await nextTick()
  expect(record('b:feedback:1')).toBeUndefined()
})
it('only offers a read destination for an ended empty exploration',()=>{
  const current=issue();current.ended_at=current.updated_at
  const {action,plan,feedback}=mount(current)
  expect(action('first-record')).toBeUndefined();expect(action('add-record')).toBeUndefined()
  action('ended-records').props.onClick()
  expect(plan).toHaveBeenCalledOnce();expect(feedback).not.toHaveBeenCalled()
})
it('removes a failed decorative thumbnail without leaving a blank frame or hiding the saved attempt',async()=>{
  const current=issue();current.card.next_step='看一看以前做过的项目'
  const {root,record,plan}=mount(current,true)
  const artwork=find(root,n=>n.type==='image'&&n.props.class==='home-record-art')[0]
  expect(artwork).toBeDefined()
  artwork.props.onError();await nextTick()
  expect(find(root,n=>n.type==='image'&&n.props.class==='home-record-art')).toHaveLength(0)
  expect(record('a:step')).toBeDefined()
  record('a:step').props.onClick()
  expect(plan).toHaveBeenCalledOnce()
})
