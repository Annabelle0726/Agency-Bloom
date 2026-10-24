import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
const hooks = vi.hoisted(() => ({ show: [] as (() => void)[], hide: [] as (() => void)[], keyboard: null as null | ((e: {height:number}) => void), requests: [] as any[] }))
vi.mock('vue', async original => ({ ...await original<typeof import('vue')>(), onMounted: vi.fn(), onUnmounted: vi.fn(), provide: vi.fn() }))
vi.mock('@dcloudio/uni-app', () => ({ onShow: (fn: () => void) => hooks.show.push(fn), onHide: (fn: () => void) => hooks.hide.push(fn), onReady: vi.fn() }))
import { useIndexPage } from '../src/pages/index/useIndexPage'

beforeEach(() => {
 vi.useFakeTimers();vi.setSystemTime(new Date(2026,9,24,9,59,59))
 hooks.show=[];hooks.hide=[];hooks.requests=[]
 const storage = new Map<string, unknown>()
 vi.stubGlobal('uni', {
 getStorageSync: (key:string) => storage.get(key), setStorageSync:(key:string,value:unknown)=>storage.set(key,value), removeStorageSync:(key:string)=>storage.delete(key),
 getWindowInfo:()=>({statusBarHeight:20}), getMenuButtonBoundingClientRect:()=>({bottom:64}), getSystemInfoSync:()=>({windowHeight:932,windowWidth:430}),
 onKeyboardHeightChange:(fn:any)=>{hooks.keyboard=fn},offKeyboardHeightChange:vi.fn(), $on:vi.fn(),$off:vi.fn(),
 setNavigationBarColor:vi.fn(),pageScrollTo:vi.fn(), request:(options:any)=>{hooks.requests.push(options);return {abort:vi.fn()}}
 })
})
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()})
function workspace() {
 const page=useIndexPage()
 page.user.value={id:'a',theme:'light',save_chat:true,ai_consent:false} as any
 page.screen.value='space'
 return page
}
it('defers a boundary repaint while typing, then catches up when the keyboard closes', async()=>{
 const p=workspace();await nextTick();expect(p.activeTheme.value.id).toBe('light')
 hooks.keyboard!({height:300});await nextTick()
 vi.advanceTimersByTime(1300);await nextTick();expect(p.activeTheme.value.id).toBe('light')
 hooks.keyboard!({height:0});await nextTick();expect(p.activeTheme.value.id).toBe('forest')
})
it('records a manual choice against wall-clock time even before the boundary timer fires',async()=>{
 const p=workspace();await nextTick()
 vi.setSystemTime(new Date(2026,9,24,10,0,0))
 const pending=p.setTheme('lavender');await nextTick()
 expect(uni.getStorageSync('agency.theme.override.v1:a')).toEqual({theme:'lavender',slot:'2026-10-24T10'})
 hooks.requests.at(-1).success({statusCode:200,data:{}});await pending
 vi.advanceTimersByTime(6*60*60*1000+300);await nextTick()
 expect(p.activeTheme.value.id).toBe('dawn')
})
it('ignores a failed save after an account switch',async()=>{
 const p=workspace();await nextTick()
 const pending=p.setTheme('lavender')
 p.user.value={id:'b',theme:'minimal'} as any
 hooks.requests.at(-1).fail({errMsg:'synthetic network failure'});await pending;await nextTick()
 expect(p.error.value).toBe('')
 expect(p.themeAuto.value).toBe(true);expect(p.activeTheme.value.id).toBe('light')
})
it('onShow catches up across days without reusing an expired manual override',async()=>{
 const p=workspace();await nextTick()
 const pending=p.setTheme('lavender');hooks.requests.at(-1).success({statusCode:200,data:{}});await pending
 vi.setSystemTime(new Date(2026,9,25,19,5))
 for(const hook of hooks.show)hook()
 await nextTick();expect(p.activeTheme.value.id).toBe('dark')
})

it("resumes after hiding with the keyboard open, without waiting for a missing close event",async()=>{
 const p=workspace();await nextTick();hooks.keyboard!({height:300});await nextTick();
 for(const hide of hooks.hide)hide();await nextTick();
 vi.setSystemTime(new Date(2026,9,25,16,5));for(const show of hooks.show)show();
 await nextTick();expect(p.activeTheme.value.id).toBe("dawn")
 vi.advanceTimersByTime(3*60*60*1000);await nextTick();expect(p.activeTheme.value.id).toBe("dark")
})

it('pins the visible theme when auto is off and restores time themes when re-enabled',async()=>{
 const p=workspace();await nextTick()
 const off=p.toggleThemeAuto()
 hooks.requests.at(-1).success({statusCode:200,data:{}});await off
 expect(p.themeAuto.value).toBe(false)
 vi.advanceTimersByTime(10*60*60*1000);await nextTick()
 expect(p.activeTheme.value.id).toBe('light')
 const pick=p.setTheme('minimal');hooks.requests.at(-1).success({statusCode:200,data:{}});await pick
 expect(p.activeTheme.value.id).toBe('minimal')
 await p.toggleThemeAuto();await nextTick()
 expect(p.themeAuto.value).toBe(true);expect(p.activeTheme.value.id).toBe('dark')
})
it('rolls back an unsuccessful auto-off save without losing the slot override',async()=>{
 const p=workspace();await nextTick()
 const pick=p.setTheme('lavender');hooks.requests.at(-1).success({statusCode:200,data:{}});await pick
 const off=p.toggleThemeAuto();hooks.requests.at(-1).fail({errMsg:'synthetic failure'});await off;await nextTick()
 expect(p.themeAuto.value).toBe(true);expect(p.activeTheme.value.id).toBe('lavender')
})
