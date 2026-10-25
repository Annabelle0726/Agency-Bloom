import { createRenderer,h,markRaw,nextTick } from 'vue'
import { afterEach,beforeEach,expect,it,vi } from 'vitest'
import CompanionAvatar from '../src/components/CompanionAvatar.vue'

type Node={type:string;props:Record<string,any>;children:Node[];parent?:Node;text?:string;addEventListener:()=>void;removeEventListener:()=>void}
const node=(type:string):Node=>markRaw({type,props:{},children:[],addEventListener:()=>{},removeEventListener:()=>{}})
const renderer=createRenderer<Node,Node>({
  patchProp:(el,key,_old,value)=>{el.props[key]=value},createElement:node,
  createText:text=>({...node('#text'),text}),createComment:()=>node('#comment'),
  setText:(el,text)=>{el.text=text},setElementText:(el,text)=>{el.text=text;el.children=[]},
  parentNode:el=>el.parent!,nextSibling:()=>null,insert:(el,parent)=>{el.parent=parent;parent.children.push(el)},
  remove:el=>{if(el.parent)el.parent.children=el.parent.children.filter(child=>child!==el)},
})
const find=(root:Node,name:string):Node|undefined=>String(root.props.class||'').split(/\s+/).includes(name)?root:root.children.map(child=>find(child,name)).find(Boolean)
let dispose=()=>{}
beforeEach(()=>{
  vi.stubGlobal('window',{matchMedia:()=>({matches:false,addEventListener:()=>{},removeEventListener:()=>{}})})
  vi.stubGlobal('document',{hidden:false,addEventListener:()=>{},removeEventListener:()=>{}})
  vi.stubGlobal('uni',{startAccelerometer:vi.fn(({success})=>success()),stopAccelerometer:vi.fn(),onAccelerometerChange:vi.fn(),offAccelerometerChange:vi.fn()})
})
afterEach(()=>{dispose();vi.unstubAllGlobals()})
it('shows a drawn fallback until the PNG is ready, never detached white eye sockets',async()=>{
  const root=node('root'),app=renderer.createApp(()=>h(CompanionAvatar,{followGaze:true,foreground:true}))
  app.mount(root);dispose=()=>app.unmount()
  expect(!!find(root,'gaze-layer')).toBe(false)
  expect(find(root,'bot-fallback')).toBeDefined()
  expect(uni.startAccelerometer).not.toHaveBeenCalled()
  const image=find(root,'bot-image')!
  image.props.onLoad();await nextTick()
  expect(find(root,'bot-fallback')).toBeUndefined()
  expect(find(root,'gaze-layer')).toBeDefined()
  image.props.onError();await nextTick()
  expect(find(root,'bot-fallback')).toBeDefined()
  expect(find(root,'gaze-layer')).toBeUndefined()
})
