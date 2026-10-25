import { expect, it } from 'vitest'
import { homeEntryFor } from '../src/home-entry'
import type { Card, Conversation, Issue } from '../src/domain'
const card:Card={title:'技能派不上用场',options:[],constraints:[],confirmed:[],hypotheses:[],unknowns:[],next_step:''}
const issue:Issue={id:'a',title:card.title,card,concerns:['direction'],stage:'',background:'',feedback:[],version:1,created_at:'2026-10-25T08:00:00Z',updated_at:'2026-10-25T08:00:00Z',ended_at:null,follow_ups:{direction:{selections:['技能派不上用场'],note:'',refinements:{'技能派不上用场':['已有经验和技能']}}}}
const conversation:Conversation={id:'c',issue_id:'a',title:'方向',support_style:'listen',linked_issue_ids:[],version:1,created_at:issue.created_at,updated_at:issue.updated_at,archived_at:null,summary:null}
it('uses a reviewed next step instead of a questionnaire refinement, without making it a confirmed fact',()=>{
  const entry=homeEntryFor(issue,card,{...conversation,summary:{overview:'回顾',decisions:[],open_questions:[],next_steps:['先挑一个做过的项目，看看其中哪项能力还想继续用']}},true)
  expect(entry.detail).toBe('先挑一个做过的项目，看看其中哪项能力还想继续用')
  expect(entry.detailLabel).toBe('对话中的建议')
  expect(card.confirmed).toEqual([])
})
it('shows a scoped assistant excerpt without a new model call or transcript rewrite',()=>{
  const reply={conversationId:'c',content:'可以先选一个做过的项目，找出其中最想继续用的能力。\n\n再考虑下一步。'}
  const before=JSON.stringify(reply),entry=homeEntryFor(issue,card,conversation,true,reply)
  expect(entry.detail).toBe('可以先选一个做过的项目，找出其中最想继续用的能力。')
  expect(entry.detailLabel).toBe('对话摘录')
  expect(JSON.stringify(reply)).toBe(before)
})
it('never substitutes questionnaire answers or fabricated advice for a missing conversation excerpt',()=>{
  const entry=homeEntryFor(issue,card,null,true)
  expect(entry.detail).toBe('')
  expect(entry.detailLabel).toBe('')
  expect(entry.hasInitialContext).toBe(true)
})
it('excludes excerpts with retention off, a different conversation, another issue or an archived conversation',()=>{
  const reply={conversationId:'c',content:'不可越界的回复'}
  expect(homeEntryFor(issue,card,conversation,false,reply).detail).toBe('')
  expect(homeEntryFor(issue,card,conversation,true,{...reply,conversationId:'other'}).detail).toBe('')
  expect(homeEntryFor(issue,card,{...conversation,issue_id:'other'},true,reply).detail).toBe('')
  expect(homeEntryFor(issue,card,{...conversation,archived_at:issue.updated_at},true,reply).detail).toBe('')
})
it('skips markdown headings and code fences without changing identifiers in the excerpt',()=>{
  const entry=homeEntryFor(issue,card,conversation,true,{conversationId:'c',content:'## 一个小尝试\n\n可以先整理 project_one 的经历。\n\n```js\nsecretCode()\n```'})
  expect(entry.detail).toBe('可以先整理 project_one 的经历。')
})
