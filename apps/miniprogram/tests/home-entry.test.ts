import { describe, expect, it } from 'vitest'
import { homeConversationFor, homeEntryFor } from '../src/home-entry'
import type { Card, Conversation, Issue } from '../src/domain'

const card: Card = { title:'', options:[], constraints:[], confirmed:[], hypotheses:[], unknowns:[], next_step:'' }
const issue: Issue = { id:'a', title:'', concerns:[], background:'', stage:'', card, version:1,
  feedback:[], created_at:'2026-10-23T09:00:00Z', updated_at:'2026-10-24T09:00:00Z', ended_at:null }
const conversation = (id: string, issueId = 'a', date = '2026-10-24T10:00:00Z'): Conversation => ({
  id, issue_id:issueId, title:id, summary:{ overview:'用户回顾并保留的理解', decisions:[], open_questions:[], next_steps:[] },
  linked_issue_ids:[], version:1, support_style:'listen', created_at:date, updated_at:date, archived_at:null,
})

describe('Home continuation uses available, authorized context', () => {
  it('resumes the selected conversation in the current exploration, otherwise the most recent live one', () => {
    const older = conversation('older', 'a', '2026-10-22T10:00:00Z'), recent = conversation('recent')
    const archived = { ...conversation('archived'), archived_at:'2026-10-24T10:00:00Z' }
    const other = conversation('other', 'b')
    const list = [older, recent, archived, other]
    expect(homeConversationFor(issue, list, 'older')).toBe(older)
    expect(homeConversationFor(issue, list, 'other')).toBe(recent)
    expect(homeConversationFor(issue, [archived, other])).toBeNull()
    expect(homeConversationFor(null, list)).toBeNull()
    expect(list[0]).toBe(older)
  })
  it('shows dated selection-only clues, including refinements, without inventing a conclusion', () => {
    const entry = homeEntryFor({ ...issue, concerns:['relationships'], follow_ups:{ relationships:{
      selections:['家人的期待'], note:'', refinements:{ '家人的期待':['想保留自己的选择'] },
    } } }, card, null, true)
    expect(entry.title).toBe('家人的期待')
    expect(entry.stamp).toContain('起点记录')
    expect(entry.detail).toContain('想保留自己的选择')
    expect(entry.stamp).toContain('10月23日')
    expect(entry.kept).toBe('')
  })
  it('never uses a retained summary when retention is off, or the conversation belongs elsewhere', () => {
    const context = { ...issue, title:'我的实际问题', focus_response:'我选择的起点' }
    expect(homeEntryFor(context, card, conversation('retained'), false).detail).toBe('我选择的起点')
    expect(homeEntryFor(context, card, conversation('wrong', 'b'), true).detail).toBe('我选择的起点')
    expect(homeEntryFor(context, card, conversation('reviewed'), true).detail).toBe('用户回顾并保留的理解')
  })
  it('offers an honest empty entry and keeps unconfirmed guesses out of the card', () => {
    const speculative = { ...card, hypotheses:['猜测你害怕改变'], next_step:'尚未确认的行动' }
    expect(homeEntryFor(null, speculative, null, true).bubble).toBe('你想先聊聊什么？')
    expect(homeEntryFor(issue, speculative, null, true).bubble).toBe('你想先聊聊什么？')
    expect(JSON.stringify(homeEntryFor(issue, speculative, null, true))).not.toContain('猜测你害怕改变')
    expect(homeEntryFor({ ...issue, title:'想换个方向' }, { ...card, confirmed:['我想保留创作时间'] }, null, true).detail).toBe('我想保留创作时间')
  })
  it('uses one empty-state headline and avoids echoing a title as its description or saved line', () => {
    const empty = homeEntryFor(null, card, null, false)
    expect(empty.stamp).toBe('')
    expect(empty.title).toBe('留一点空间给自己')
    const titled = { ...issue, title:'我想给创作留一点时间', focus_response:'我想给创作留一点时间' }
    const entry = homeEntryFor(titled, { ...card, confirmed:[titled.title] }, null, true)
    expect(entry.detail).not.toBe(entry.title)
    expect(entry.kept).toBe('')
  })
  it('uses the concrete user response rather than a broad questionnaire category as the headline', () => {
    const selected='生活有些满，精力跟不上'
    const entry=homeEntryFor({ ...issue,title:selected,concerns:['overload'],focus_response:'现在只想缓一缓，不急着找办法' },{...card,title:selected},null,true)
    expect(entry.title).toBe('现在只想缓一缓，不急着找办法')
    expect(entry.stamp).toContain('起点记录')
    expect(entry.stamp).toContain('10月23日')
    expect(entry.detail).not.toBe(entry.title)
    expect(JSON.stringify(entry)).not.toContain(selected)
    const personal=homeEntryFor({...issue,title:'我想给照顾家人留出时间',concerns:['overload']},card,null,true)
    expect(personal.title).toBe('我想给照顾家人留出时间')
    expect(personal.topic).toBe('我想给照顾家人留出时间')
  })
  it('prioritizes the saved free-text topic without rewriting it or inferring a diagnosis',()=>{
    const source={...issue,title:'最近工作很乱，快要撑不住了',concerns:['overload']}
    const before=JSON.stringify(source)
    const entry=homeEntryFor(source,card,null,true)
    expect(entry.title).toBe(source.title)
    expect(entry.topic).toBe(source.title)
    expect(JSON.stringify(source)).toBe(before)
    expect(entry.kicker).toBe('此刻，我在意的')
  })
  it('does not pick an arbitrary pain point from multiple selections, but respects an explicit focus',()=>{
    const multiple={...issue,concerns:['overload','choices']}
    expect(homeEntryFor(multiple,card,null,true).title).toBe('从你想接着说的事开始')
    expect(homeEntryFor({...multiple,exploration_intent:'choices',follow_ups:{choices:{selections:['我想比较两个机会'],note:''}}},card,null,true).title).toBe('我想比较两个机会')
    expect(homeEntryFor({...multiple,exploration_intent:'job_search'},card,null,true).title).toBe('从你想接着说的事开始')
  })
  it('keeps unknown topics neutral and treats an ended exploration as a past record',()=>{
    expect(homeEntryFor({...issue,concerns:['unknown-topic']},card,null,true).title).toBe('从你想接着说的事开始')
    const ended=homeEntryFor({...issue,ended_at:'2026-10-24T10:00:00Z',concerns:['choices']},card,null,true)
    expect(ended.title).toBe('这段探索的记录')
    expect(ended.kicker).toBe('这段探索里')
  })
})
