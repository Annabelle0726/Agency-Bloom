import type { Card, Conversation, Issue } from './domain'
import { concernOptions, startingConcernOptions } from './onboarding'

// Local presentation only: opening Home never generates a summary or a reply.
export function homeConversationFor(issue: Issue | null, conversations: Conversation[], activeId?: string) {
  if (!issue) return null
  const available = conversations.filter(item => item.issue_id === issue.id && !item.archived_at)
  return available.find(item => item.id === activeId)
    || [...available].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0] || null
}

export function homeEntryFor(issue: Issue | null, card: Card, conversation: Conversation | null, retainChat: boolean) {
  if (!issue) return {
    title: '留一点空间给自己', detail: '从工作、生活，或一个还没理清的念头聊起',
    kicker:'从这里开始',topic:'',kept:'',stamp:'',hasInitialContext:false,bubble:'你想先聊聊什么？',action:'开始聊聊',
  }
  const topics = issue.concerns.map(id => startingConcernOptions.find(item => item.id === id)?.title
    || concernOptions.find(item => item.id === id)?.title).filter(Boolean)
  const questionnaireLabels = new Set([...startingConcernOptions,...concernOptions].map(item=>item.title))
  const first=(values:Array<string|undefined>)=>values.map(value=>value?.trim()||'')
    .find(value=>value&&!questionnaireLabels.has(value))||''
  const selected=[...new Set(issue.concerns)]
  const focusId=issue.exploration_intent&&selected.includes(issue.exploration_intent)
    ?issue.exploration_intent:selected.length===1?selected[0]:selected.length===0?'general':''
  const focus=focusId?issue.follow_ups?.[focusId]:undefined
  const response=focusId?issue.focus_response:''
  const topic=first([card.title,issue.actual_question,issue.title])
  const title=topic||first([response,focus?.note,...(focus?.selections||[])])||(issue.ended_at?'这段探索的记录':'从你想接着说的事开始')
  const primary=focus?.selections.find(value=>value===title)||focus?.selections[0]
  const refinements=primary?focus?.refinements?.[primary]||[]:[]
  // Reviewed summaries follow retention; onboarding clues stay explicitly dated.
  const relevant = conversation?.issue_id === issue.id && !conversation.archived_at ? conversation : null
  const overview = retainChat ? relevant?.summary?.overview?.trim() : ''
  // One related source, not a flattened questionnaire. Full answers remain in
  // the existing initial-snapshot viewer; no user record is rewritten here.
  const supportingSelections=focus?.selections.includes(title)?[]:focus?.selections||[]
  const detail=first([overview,...card.confirmed,response,focus?.note,...refinements,...supportingSelections]
    .filter(value=>value?.trim()!==title))||'可以接着想，也可以换一个话题'
  const fromSummary=!!overview&&detail===overview
  const fromCard=card.confirmed.some(value=>value.trim()===detail)
  const hasInitialContext=issue.concerns.length>0||Object.entries(issue.follow_ups||{}).some(([key])=>selected.includes(key)||(key==='general'&&!selected.length))
  const source=fromSummary?'已回顾的对话':fromCard?'已确认的卡片':topic?'探索记录':'起点记录'
  const date = new Date(fromSummary?relevant!.updated_at:fromCard||topic?issue.updated_at:issue.created_at)
  const dateLabel = Number.isNaN(date.getTime()) ? '' : `${date.getMonth() + 1}月${date.getDate()}日`
  return {
    title,topic,detail,kept:'',hasInitialContext,kicker:issue.ended_at?'这段探索里':'此刻，我在意的',
    stamp:`${source}${dateLabel?' · '+dateLabel:''}`,
    bubble: relevant || topic || response || topics.length || focus || card.confirmed.length
      ? '想接着聊，还是有新情况？' : '你想先聊聊什么？',
    action:issue.ended_at?(relevant?'回看这段对话':'查看这段探索'):'接着聊聊',
  }
}
export type HomeEntry = ReturnType<typeof homeEntryFor>
