import { expect, it } from 'vitest'
import { homeEntryFor } from '../src/home-entry'
import type { Card, Issue } from '../src/domain'
const card:Card={title:'',options:[],constraints:[],confirmed:[],hypotheses:[],unknowns:[],next_step:''}
const issue:Issue={id:'a',title:'',card,concerns:[],stage:'',background:'',feedback:[],version:1,created_at:'2026-10-25T08:00:00Z',updated_at:'2026-10-25T09:00:00Z',ended_at:null}
it('makes the saved user question the headline instead of an editorial invitation',()=>{
  const source={...issue,title:'技能派不上用场',concerns:['direction']}
  const entry=homeEntryFor(source,card,null,false)
  expect(entry.title).toBe(source.title)
  expect(entry.kicker).toBe('此刻，我在意的')
  expect(entry.stamp).not.toContain(' · 方向')
})
it('shows one specific selected starting point and one related clue without joining the questionnaire',()=>{
  const source={...issue,concerns:['direction'],follow_ups:{direction:{selections:['技能派不上用场','不知道学什么'],note:'',refinements:{'技能派不上用场':['想重新看看做过的设计项目']}}}}
  const entry=homeEntryFor(source,card,null,false)
  expect(entry.title).toBe('技能派不上用场')
  expect(entry.detail).toBe('想重新看看做过的设计项目')
  expect(entry.detail).not.toContain('不知道学什么')
  expect(entry.hasInitialContext).toBe(true)
  expect(entry.stamp).toBe('起点记录 · 10月25日')
})
it('does not select an arbitrary problem from several areas or use deselected refinements',()=>{
  const source={...issue,concerns:['direction','relationships'],follow_ups:{direction:{selections:['想比较已有方向'],note:'方向线索'},relationships:{selections:['沟通'],note:'关系线索'},overload:{selections:['休息'],note:'已取消的线索'}}}
  const entry=homeEntryFor(source,card,null,false)
  expect(entry.title).toBe('从你想接着说的事开始')
  expect(entry.detail).not.toContain('已取消')
  const focused=homeEntryFor({...source,exploration_intent:'direction'},card,null,false)
  expect(focused.title).toBe('方向线索')
  expect(focused.detail).toBe('想比较已有方向')
})
it('keeps ended content explicitly historical and does not modify saved user wording',()=>{
  const source={...issue,title:'先不急着转向',ended_at:'2026-10-25T09:00:00Z'}
  const before=JSON.stringify(source),entry=homeEntryFor(source,card,null,false)
  expect(entry.title).toBe(source.title)
  expect(entry.kicker).toBe('这段探索里')
  expect(entry.action).toBe('查看这段探索')
  expect(JSON.stringify(source)).toBe(before)
})
it('does not present a sibling questionnaire answer as supporting evidence for the selected problem',()=>{
  const entry=homeEntryFor({...issue,concerns:['direction'],follow_ups:{direction:{selections:['技能派不上用场','不知道学什么'],note:''}}},card,null,false)
  expect(entry.title).toBe('技能派不上用场')
  expect(entry.detail).not.toContain('不知道学什么')
})
