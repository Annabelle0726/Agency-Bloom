import type { Issue } from './domain'
import type { JourneyEvent } from './journey'

export type DiscoveryIntent = 'continue' | 'perspective' | 'reality'
export interface DiscoveryRecommendation {
  id: string; issueId: string | null; intent: DiscoveryIntent; strategy: string
  title: string; question: string; sourceLabel: string; sourceId: string; score: number
}
export interface DiscoveryState {
  version: 1; round: number; lastShown?: string[]
  feedback: { id: string; group: string; kind: 'dismissed' | 'explored'; at: number }[]
}
export const discoveryStateKey = (userId: string) => `agency.discovery.v1:${userId}`
const DAY = 86400000
export const emptyDiscoveryState = (): DiscoveryState => ({ version: 1, round: 0, feedback: [] })
// Only opaque IDs and interaction dates are stored, never questions or user records.
export function readDiscoveryState(value: unknown): DiscoveryState {
  const state = value as DiscoveryState | null
  if (state?.version !== 1 || !Number.isSafeInteger(state.round) || state.round < 0 || !Array.isArray(state.feedback)) return emptyDiscoveryState()
  return { version: 1, round: state.round, lastShown: Array.isArray(state.lastShown) ? state.lastShown.filter(id => typeof id === 'string' && id.length < 180).slice(0, 3) : [], feedback: state.feedback.filter(f => f && typeof f.id === 'string' && f.id.length < 180 && typeof f.group === 'string' && f.group.length < 180 && ['dismissed', 'explored'].includes(f.kind) && Number.isFinite(f.at)).slice(-200) }
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
  // Confirmed topic wording supports different inquiry strategies, not inferred facts.
  for (const issue of issues.filter(i => !i.ended_at && clean(i.title))) {
    const name = quote(issue.title, 30)
    const angles: [DiscoveryIntent, string, string, string][] = [
      ['continue', 'priority', '先找到最在意的部分', `说到${name}，现在最值得花一点时间想清楚的是什么？`],
      ['perspective', 'keep', '变化里，也有想保留的', `考虑${name}时，有什么是你希望继续保留的？`],
      ['reality', 'learn', '先找到一个可以了解的入口', `关于${name}，有没有一位可以请教的人，或一件可以先了解的小事？`],
      ['continue', 'recent', '从一个具体的时刻说起', `最近有没有一个与${name}有关的时刻，让你想再说一说？`],
      ['perspective', 'permission', '也可以暂时不做决定', `面对${name}，哪些事需要现在决定，哪些可以给自己多一点时间？`],
      ['reality', 'evidence', '什么信息会让下一步更清楚', `关于${name}，如果能先验证一件事，你希望知道什么？`],
    ]
    angles.forEach(([intent, strategy, title, question], index) =>
      add(issue, intent, strategy, `issue:${issue.id}`, issue.title, title, question, '来自你保存的探索主题', 40 - index))
  }
  if (!result.length) result.push(...generalDiscovery())
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


// Curated fallbacks have explicit generic provenance. They are available after
// cooling too, so feedback can never remove the whole entry surface.
export function generalDiscovery(): DiscoveryRecommendation[] {
  const topics: [DiscoveryIntent, string, string][] = [
    ['continue', '从最近的一点变化开始', '最近有什么事情，让你觉得自己需要一点改变？'],
    ['perspective', '给好奇留一点空间', '有什么事情，你还没有试过，却愿意多了解一点？'],
    ['reality', '留住一次愿意投入的时刻', '最近有没有一个时刻，让你感到投入，或愿意再经历一次？'],
    ['continue', '先说一件放在心上的事', '最近有什么事，一直放在你心上，却还没有好好说过？'],
    ['perspective', '看看想保留的生活', '如果生活有一点变化，你最想保留哪一部分？'],
    ['reality', '从了解开始也可以', '有没有一件你想先了解的小事，不需要现在作出决定？'],
    ['continue', '给眼前的问题排个顺序', '如果现在只聊一件事，哪件事最值得先被听见？'],
    ['perspective', '把自己的需要放进来', '先放下别人的期待，你希望自己的日常多一点什么？'],
    ['reality', '找一个可以停下来的尝试', '有没有一个足够小、可以随时停下的尝试，是你愿意考虑的？'],
  ]
  return topics.map(([intent, title, question], index) => ({
    id: `general:v1:${index}`, issueId: null, intent, strategy: 'general',
    title, question, sourceLabel: '精选探索问题', sourceId: 'curated:v1', score: 10 - index,
  }))
}
export function selfDiscovery(): DiscoveryRecommendation[] {
  return [
    ['从你真正需要的开始', '这些问题还没贴近我。我想先想一想：现在最需要被帮助的是什么？'],
    ['还说不清，也可以开始', '我还说不清自己需要什么，想从最近一件让我在意的小事慢慢聊起。'],
  ].map(([title, question], index) => ({
    id: `self:v1:${index}`, issueId: null, intent: 'continue', strategy: 'self',
    title, question, sourceLabel: '由你决定聊什么 · 可以自由改写', sourceId: 'self', score: 0,
  }))
}
export function discoveryBatch(candidates: DiscoveryRecommendation[], state: DiscoveryState, now: number, seen: string[] = [], invite = false): DiscoveryRecommendation[] {
  // Keep exact refusals. Similar intent receives a ranking penalty, not a ban.
  const exactState = { ...state, feedback: state.feedback.map(f => ({ ...f, group: '' })) }
  const rank = (item: DiscoveryRecommendation) => item.score - (state.feedback.some(f =>
    f.kind === 'dismissed' && f.group === groupFor(item) && now - f.at < 14 * DAY) ? 50 : 0)
  const ordered = [...candidates].sort((a, b) => rank(b) - rank(a) || a.id.localeCompare(b.id))
  const choose = (items: DiscoveryRecommendation[], exclude: string[], limit: number) =>
    selectDiscovery(items.filter(c => !exclude.includes(c.id)), exactState, now, limit)
  let selected = choose(ordered, seen, 2)
  if (selected.length < 2) {
    const extra = choose(generalDiscovery(), [...seen, ...selected.map(c => c.id)], 2 - selected.length)
    selected.push(...extra)
  }
  // Exhaustion is finite: reuse non-rejected questions, then offer user-written
  // entry points. Never resurrect an exact refusal to fill a slot.
  if (selected.length < 2) selected.push(...choose([...ordered, ...generalDiscovery()],
    selected.map(c => c.id), 2 - selected.length))
  const self = selfDiscovery()
  for (const item of self) { if (selected.length >= 2) break; selected.push(item) }
  if (invite && !selected.some(c => c.strategy === 'self')) selected.push(self[0])
  return selected
}
