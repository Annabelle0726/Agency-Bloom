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
    kept: '', stamp: '', bubble: '你想先聊聊什么？', action: '开始聊聊',
  }
  const topics = issue.concerns.map(id => startingConcernOptions.find(item => item.id === id)?.title
    || concernOptions.find(item => item.id === id)?.title).filter(Boolean)
  const followUps = Object.entries(issue.follow_ups || {}).filter(([key]) => issue.concerns.includes(key) || key === 'general')
  const clues = followUps.flatMap(([, answer]) => [
    ...answer.selections.flatMap(selection => [selection, ...(answer.refinements?.[selection] || [])]), answer.note,
  ]).filter(value => value?.trim())
  const questionnaireLabels = new Set([...startingConcernOptions,...concernOptions].map(item=>item.title))
  const areas: Record<string,string> = { relationships:'关系与期待',overload:'生活节奏',job_search:'求职',direction:'方向',change:'面对变化',choices:'选择与取舍',start:'尝试改变',possibility:'新的可能' }
  const area = [...new Set(issue.concerns.map(id=>areas[id]).filter(Boolean))].join('、')
  // A selected difficulty is a dated clue, never a headline diagnosing the present.
  const title = [card.title,issue.title,issue.actual_question].map(value=>value?.trim())
    .find(value=>value && !questionnaireLabels.has(value)) || '接着聊聊近况'
  // Reviewed summaries follow retention; onboarding clues stay explicitly dated.
  const relevant = conversation?.issue_id === issue.id && !conversation.archived_at ? conversation : null
  const overview = retainChat ? relevant?.summary?.overview?.trim() : ''
  const detail = [overview, issue.focus_response?.trim(), clues.join(' · ')]
    .find(value => value && value !== title && !questionnaireLabels.has(value)) || '可以接着想，也可以换一个话题'
  const date = new Date(overview ? relevant!.updated_at : issue.created_at)
  const dateLabel = Number.isNaN(date.getTime()) ? '' : `${date.getMonth() + 1}月${date.getDate()}日`
  return {
    title, detail, kept: card.confirmed.find(value => value.trim() && value.trim() !== title && value.trim() !== detail && !questionnaireLabels.has(value.trim())) || '',
    stamp: `${overview ? '已回顾的对话' : '起点记录'}${dateLabel ? ' · ' + dateLabel : ''}${area ? ' · ' + area : ''}`,
    bubble: relevant || issue.title?.trim() || issue.actual_question?.trim() || issue.focus_response?.trim() || topics.length || clues.length || card.confirmed.length
      ? '想接着聊，还是有新情况？' : '你想先聊聊什么？',
    action: relevant ? '继续对话' : '聊聊这件事',
  }
}
export type HomeEntry = ReturnType<typeof homeEntryFor>
