import type { Issue } from './domain'
import type { JourneyEvent } from './journey'

export type DiscoveryIntent = 'continue' | 'perspective' | 'reality'
export interface DiscoveryRecommendation {
  id: string; issueId: string | null; intent: DiscoveryIntent; strategy: string
  title: string; question: string; sourceLabel: string; sourceId: string; score: number
}
export interface DiscoveryState {
  version: 1; round: number
  feedback: { id: string; group: string; kind: 'dismissed' | 'explored'; at: number }[]
}
export const discoveryStateKey = (userId: string) => `agency.discovery.v1:${userId}`
const DAY = 86400000
export const emptyDiscoveryState = (): DiscoveryState => ({ version: 1, round: 0, feedback: [] })
// Only opaque IDs and interaction dates are stored, never questions or user records.
export function readDiscoveryState(value: unknown): DiscoveryState {
  const state = value as DiscoveryState | null
  if (state?.version !== 1 || !Number.isSafeInteger(state.round) || state.round < 0 || !Array.isArray(state.feedback)) return emptyDiscoveryState()
  return { version: 1, round: state.round, feedback: state.feedback.filter(f => f && typeof f.id === 'string' && f.id.length < 180 && typeof f.group === 'string' && f.group.length < 180 && ['dismissed', 'explored'].includes(f.kind) && Number.isFinite(f.at)).slice(-200) }
}
function hash(text: string) {
  let a = 2166136261, b = 5381
  for (const char of text) { a = Math.imul(a ^ char.charCodeAt(0), 16777619); b = Math.imul(b, 33) ^ char.charCodeAt(0) }
  return `${(a >>> 0).toString(36)}-${(b >>> 0).toString(36)}`
}
const clean = (text?: string) => (text || '').trim().replace(/\s+/g, ' ')
const quote = (text: string, limit = 64) => `「${clean(text).length > limit ? clean(text).slice(0, limit) + '…' : clean(text)}」`
const groupFor = (item: DiscoveryRecommendation) => `${item.issueId || 'general'}:${item.intent}`
export function recordDiscoveryFeedback(state: DiscoveryState, item: DiscoveryRecommendation, kind: 'dismissed' | 'explored', now: number): DiscoveryState {
  return { ...state, feedback: [...state.feedback.filter(f => f.id !== item.id), { id: item.id, group: groupFor(item), kind, at: now }].slice(-200) }
}

// A rule has an explicit source and intent. No transcript, hypothesis, inferred
// personality, model candidate, clock-based randomizer or provider is an input.
export function discoveryCandidates(issues: Issue[], events: JourneyEvent[]): DiscoveryRecommendation[] {
  const result: DiscoveryRecommendation[] = []
  const add = (issue: Issue, intent: DiscoveryIntent, strategy: string, sourceId: string, evidence: string, title: string, question: string, sourceLabel: string, score: number) => {
    if (!clean(evidence)) return
    result.push({ id: `${issue.id}:${strategy}:${hash(evidence)}`, issueId: issue.id, intent, strategy, sourceId, title, question, sourceLabel, score })
  }
  for (const issue of [...issues].filter(i => !i.ended_at).sort((a, b) => a.id.localeCompare(b.id))) {
    const card = issue.card, name = issue.title ? quote(issue.title, 30) : '这段探索'
    const latest = events.filter(e => e.issue_id === issue.id && (e.kind === 'action' || e.id.startsWith('feedback:')))
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))[0]
    if (latest) add(issue, 'continue', 'reflect', latest.id, latest.text, latest.kind === 'action' ? '试过之后，回看感受' : '沿着这次记录，再想一想',
      `你留下了${quote(latest.text)}。现在回看，有什么和原先的想法不同？`, '来自你保存的经历', 100)
    for (const unknown of (card.unknowns || []).filter(v => v !== '我需要哪些信息，才能更清楚地选择？').slice(0, 3)) {
      add(issue, 'continue', 'unknown', `card:${issue.id}:unknowns`, unknown, '还有什么值得弄清楚', `关于${quote(unknown)}，你现在最想先弄清哪一部分？`, '来自决策卡 · 还需要了解的', 80)
    }
    if (card.constraints?.length) {
      const boundary = card.constraints.join('；')
      add(issue, 'perspective', 'boundary', `card:${issue.id}:constraints`, boundary, '把重要的条件放回来',
        `你保留的条件里有${quote(boundary)}。考虑${name}时，还有哪些符合这些条件的可能？`, '来自你确认的现实条件', 85)
    }
    if (card.next_step) add(issue, 'reality', 'direction', `card:${issue.id}:next_step`, card.next_step + '\n' + (card.constraints || []).join('\n'), '先看这一步是否适合现在',
      `对于你留下的${quote(card.next_step)}，开始前还想确认什么条件，或怎样判断可以暂停？`, '来自你确认的下一步', 90)
    else if (card.options?.length) add(issue, 'reality', 'option', `card:${issue.id}:options`, card.options.join('；') + '\n' + (card.constraints || []).join('\n'), '先了解一种真实的日常',
      `你正在考虑${quote(card.options.join('、'))}。如果愿意，有没有一个可随时停下的小尝试，能帮你了解其中的日常？`, '来自决策卡 · 正在考虑的方向', 70)
    const clue = clean(issue.focus_response) || clean(issue.actual_question)
    if (clue) add(issue, 'continue', 'clue', `issue:${issue.id}:answer`, clue, '从你留下的线索继续',
      `关于你提到的${quote(clue)}，现在有什么值得再说一点？`, '来自你主动留下的回答', 60)
    else if (clean(issue.title)) add(issue, 'continue', 'topic', `issue:${issue.id}`, issue.title, '回到仍在探索的问题',
      `关于${name}，现在还有哪个部分让你想继续了解？`, '来自你保存的探索主题', 50)
    const intent = issue.exploration_intent || issue.concerns?.[0]
    const starts: Record<string, string> = {
      direction: '最近有什么具体的时刻，让你觉得自己需要一点改变？',
      change: '过去做过的事情里，有哪一件你想看看还能用在哪里？',
      choices: '面对选择，你最希望保留的是什么？',
      start: '如果先保留现在的稳定，你愿意了解哪一种小小的改变？',
      possibility: '有什么你一直好奇、但还没认真了解过的事情？',
    }
    if (!clue && starts[intent || '']) add(issue, 'perspective', 'onboarding', `issue:${issue.id}:intent`, intent!, '从你选择的牵挂出发', starts[intent!], '来自你主动选择的探索方向', 55)
  }
  // General topics are only a fallback for insufficient confirmed information.
  if (!result.length) {
    const topics: [string, string][] = [
      ['从最近的一点变化开始', '最近有什么事情，让你觉得自己需要一点改变？'],
      ['给好奇留一点空间', '有什么事情，你还没有试过，却愿意多了解一点？'],
      ['留住一次愿意投入的时刻', '最近有没有一个时刻，让你感到投入，或愿意再经历一次？'],
    ]
    topics.forEach(([title, question], index) => result.push({ id: `general:v1:${index}`, issueId: null, intent: 'continue', strategy: 'general', title, question, sourceLabel: '精选探索问题', sourceId: 'curated:v1', score: 10 - index }))
  }
  const unique = new Map<string, DiscoveryRecommendation>()
  for (const item of result.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))) {
    const key = clean(item.question).replace(/[\s，。？！、]/g, '')
    if (!unique.has(key)) unique.set(key, item)
  }
  return [...unique.values()]
}
export function selectDiscovery(candidates: DiscoveryRecommendation[], state: DiscoveryState, now: number, limit = 3) {
  const eligible = candidates.filter(item => !state.feedback.some(f => {
    // Reject a specific wording for 90 days; similar intent in this exploration
    // rests for 14 days. An explored question rests for 30 days, without claiming
    // that the real-world action was completed. No personality inference.
    const age = now - f.at
    return (f.id === item.id && age < (f.kind === 'dismissed' ? 90 : 30) * DAY) ||
      (f.kind === 'dismissed' && item.issueId !== null && f.group === groupFor(item) && age < 14 * DAY)
  }))
  if (!eligible.length) return []
  const start = state.round % eligible.length
  const ordered = [...eligible.slice(start), ...eligible.slice(0, start)]
  const chosen: DiscoveryRecommendation[] = [], groups = new Set<string>()
  for (const item of ordered) {
    // One question per intent/exploration, rather than padding all three slots.
    const group = item.issueId ? groupFor(item) : item.id
    if (groups.has(group)) continue
    chosen.push(item); groups.add(group)
    if (chosen.length >= limit) break
  }
  return chosen
}
