import type { Issue, Conversation } from './domain'
import type { JourneyEvent } from './journey'
import type { DiscoveryRecommendation } from './discovery'
import { startingConcernOptions } from './onboarding'

export interface DiscoveryAngle extends DiscoveryRecommendation {
  evidence: string; sourceDate: string; angle: string; investigation: string
}
export function discoveryTitle(issue: Issue): string {
  return issue.title || issue.actual_question || (issue.concerns || []).map(id => startingConcernOptions.find(c => c.id === id)?.title).filter(Boolean).join(' · ') || '未命名的探索'
}
export function discoveryDestination(conversations: Conversation[], issueId: string | null, activeId?: string) {
  const available = conversations.filter(c => c.issue_id === issueId && !c.archived_at)
  return available.find(c => c.id === activeId) || [...available].sort((a, b) => b.updated_at.localeCompare(a.updated_at) || a.id.localeCompare(b.id))[0] || null
}
function fingerprint(text: string) {
  let n = 2166136261
  for (const c of text) n = Math.imul(n ^ c.charCodeAt(0), 16777619)
  return (n >>> 0).toString(36)
}
export function relevantAngles(issue: Issue, events: JourneyEvent[]): DiscoveryAngle[] {
  if (issue.ended_at) return []
  const answers = Object.values(issue.follow_ups || {}).flatMap(a => [...a.selections, ...Object.values(a.refinements || {}).flat(), a.note]).filter(Boolean)
  const initial = [...answers, issue.focus_response, issue.actual_question].filter(Boolean).join('；')
  if (/先缓一缓|只想缓一缓|不急着找办法|先听我说|只想被听见/.test(initial)) return []
  const result: DiscoveryAngle[] = []
  const add = (strategy: string, evidence: string, sourceLabel: string, sourceDate: string, title: string, angle: string, investigation: string, intent: DiscoveryAngle['intent'] = 'perspective') => {
    if (!evidence.trim()) return
    result.push({ id: `${issue.id}:angle-v1:${strategy}:${fingerprint(evidence)}`, issueId: issue.id, strategy, intent, evidence, sourceLabel, sourceDate, sourceId: `${issue.id}:${strategy}`, title, angle, investigation, question: angle, score: 100 - result.length })
  }
  const boundary = (issue.card.constraints || []).join('；')
  if (boundary) add('boundary', boundary, '决策卡 · 现实条件', issue.updated_at,
    /收入|稳定/.test(boundary) ? '了解一个方向，可以先不改变收入来源' : '先保留重要条件，再看看还有哪些选择',
    /收入|稳定/.test(boundary) ? '也许可以把了解新方向和改变收入安排分开。先弄清它的真实日常，再考虑怎样安排收入过渡' : '这些条件里，哪些需要保留，哪些还值得了解？也许可以在保留重要条件的前提下，找到另一种安排',
    '如果愿意，可以选一个正在考虑的方向，了解它实际需要的时间、费用和日常安排，再与这些条件对照')
  if (initial) {
    const relationship = /表达|沟通|期待|关系|家人/.test(initial)
    const overload = /精力|责任|休息|放下|打断/.test(initial)
    const job = /求职|投递|简历|面试|岗位/.test(initial)
    const change = /AI|变化|能力|技能/.test(initial)
    const title = relationship ? '准备好怎么说，与争取协商空间' : overload ? '先分清需要调整的安排，和需要分担的责任' : job ? '把求职的困难，放回具体的一步' : change ? '先看任务怎样变化，再看经历怎样迁移' : '把需要决定的事，与还需要了解的事分开'
    const angle = relationship ? '也许可以先区分：是还没找到合适的表达，还是说清楚之后仍缺少协商空间？两种情况可能需要不同的帮助' : overload ? '有些消耗可以通过调整安排减少，有些可能需要与别人重新分担。你提到的情况，更接近哪一种，也可能都不是？' : job ? '方向、材料、投递反馈和面试是不同环节。也许可以先看具体卡在哪一步，再判断需要补充什么信息或调整什么' : change ? '一种工具能完成部分任务，不等于它说明了整份工作的变化。也许可以从一件你实际做过的事，看看哪些环节变了、哪些判断仍需要人' : '也许不必一次作出完整决定。可以先看看：有哪些未知，弄清之后会真正改变你的选择？'
    add('initial', initial, '初次整理 · 你选择或填写的回答', issue.created_at, title, angle,
      relationship ? '如果愿意，可以回想一次具体交流：你想表达什么，对方实际回应了什么。先保留事实，不急着判断谁对谁错' : overload ? '如果愿意，可以从最近一天挑一件最消耗精力的事，看看它能否减少、推迟或与人分担' : job ? '如果愿意，可以选一次真实投递或面试，只整理已经得到的反馈和仍不知道的部分' : change ? '如果愿意，可以拆开一件熟悉的工作，分别记下工具能协助的部分和仍需要你判断的部分' : '如果愿意，可以写下一条仍不确定的信息，以及从哪里能了解它')
  } else if (!boundary && (issue.concerns || []).length) {
    const evidence = (issue.concerns || []).map(id => startingConcernOptions.find(c => c.id === id)?.title).filter(Boolean).join('；')
    add('selected-topic', evidence, '初次整理 · 你选择的关注点', issue.created_at, '先从一件真实发生的事看起', '这些是你当时选择的关注点。如果现在仍想了解它，也许可以从一个具体时刻，分清实际发生的事和自己还不确定的部分', '如果愿意，可以选一个相关时刻，先说发生了什么、你当时在意什么')
  }
  const latest = events.filter(e => e.issue_id === issue.id && (e.kind === 'action' || e.id.startsWith('feedback:'))).sort((a,b) => b.created_at.localeCompare(a.created_at))[0]
  if (latest) add('observation', latest.text, '你保存的经历', latest.created_at, '这次经历，改变了哪一点判断？', '回看这次记录，哪些与原先想象一致，哪些让你想调整原来的判断？没有行动或想暂停，也可以是需要认真对待的信息', '如果愿意，可以把实际发生的事与自己的解释分开写，再看看还缺什么信息', 'continue')
  const unknown = (issue.card.unknowns || []).find(v => v !== '我需要哪些信息，才能更清楚地选择？')
  if (unknown) add('unknown', unknown, '决策卡 · 还需要了解的', issue.updated_at, '哪条信息，会真正改变你的选择？', '也许可以先判断：这个未知有哪些可能的答案？不同答案会不会改变你的选择？', '如果愿意，可以先写出两种可能答案，再决定是否值得花时间去了解', 'reality')
  if (!result.length && issue.title) add('topic', issue.title, '你保存的探索主题', issue.created_at, '哪些需要现在决定，哪些可以先了解？', '围绕这个主题，也许可以先分开眼前必须决定的事，和仍可以留出了解空间的事', '如果愿意，可以选一项未知，看看怎样获得一点真实信息')
  return result
}
export function discoveryDraft(item: DiscoveryAngle) {
  return `我想聊聊这个角度：${item.title}\n\n我留下的线索（${item.sourceLabel}）：${discoveryQuotedEvidence(item)}\n\n想讨论的可能性：${item.angle}${item.investigation ? '\n\n可选的了解方式：' + item.investigation : ''}\n\n这些只是待讨论的角度，我想看看它是否适合现在的情况`
}
export function discoveryQuotedEvidence(item: DiscoveryAngle) { return item.evidence.length > 900 ? item.evidence.slice(0, 900) + '…（节选，完整内容可在发现页查看）' : item.evidence }
