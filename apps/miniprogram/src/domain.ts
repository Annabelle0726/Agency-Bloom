import type { ThemeId } from './themes'

export interface Onboarding {
  title: string; concerns: string[]; stage: string; background: string; constraints: string[]
  life_contexts?: string[]; support_style?: string
  exploration_intent?: string; actual_question?: string; focus_response?: string
}
export interface Card {
  title: string; options: string[]; constraints: string[]; confirmed: string[];
  hypotheses: string[]; unknowns: string[]; next_step: string
}
export interface Suggestion {
  options: string[]; hypotheses: string[]; unknowns: string[]; next_step: string
}
export interface Issue {
  id: string; title: string; concerns: string[]; stage: string; background: string;
  card: Card; version: number; created_at: string; updated_at: string; ended_at: string | null;
  feedback: { id: string; kind: string; text: string; created_at: string }[]
  exploration_intent?: string; actual_question?: string; focus_response?: string
}
export interface User { id: string; theme: ThemeId; save_chat: boolean; ai_consent: boolean; support_style: string; use_memory?: boolean }
export interface ReasoningPoint {
  kind: 'understanding' | 'basis' | 'tradeoff'
  text: string
  evidence?: { source_id: string; quote: string }[]
}
export interface PerspectiveShift {
  title: '换个角度'
  observation: string; possible_blind_spot: string; alternative_perspective: string
  uncertainty: string; optional_next_question?: string | null
  supporting_message_ids: string[]
  evidence: { message_id: string; quote: string; supports: ('observation' | 'possible_blind_spot' | 'alternative_perspective')[] }[]
  trigger: 'repeated_choice' | 'new_constraint' | 'assistant_revision'
}
export interface ChatMessage { id?: string; created_at?: string; role: 'user' | 'assistant'; content: string; payload?: { perspective_shift?: PerspectiveShift | null; perspective_token?: string | null; suggestion?: Suggestion | null; insight?: Insight | null; request_id?: string; supplied_context?: SuppliedContext | null; tail_line?: string; reasoning_summary?: ReasoningPoint[]; web_sources?: WebSource[] | null; visual_id?: string | null } | null }
export interface ConversationSummary { overview: string; decisions: string[]; open_questions: string[]; next_steps: string[] }
export interface Conversation {
  dismissed_change_ids?: string[]
  id: string; issue_id: string; title: string; support_style: string; summary: ConversationSummary | null;
  linked_issue_ids: string[]; version: number; created_at: string; updated_at: string; archived_at: string | null
}
export interface Memory {
  id: string; content: string; category: 'fact' | 'preference' | 'constraint'; issue_id: string | null;
  source_conversation_id: string | null; enabled: boolean; version: number; updated_at: string
  horizon?: 'long_term' | 'current_phase'; status?: 'active' | 'needs_review' | 'historical'
  source?: string; created_at?: string; confirmed_at?: string | null; last_verified_at?: string | null
}
export interface InitialSnapshot {
  id: string; version: number; direction: string; source: string; captured_at: string;
  background: string; stage: string; life_contexts: string[]; concerns: string[]; constraints: string[];
  answers: { intent?: string; question?: string; response?: string }
}
export interface PhaseChange {
  source_id: string; source_kind: 'memory' | 'snapshot'; source_version: number; previous: string; evidence: string
}
export interface Experiment { action: string; tests: string; effort: string; stop_rule: string }
export interface Insight {
  title: '还有一种可能'; observation: string; possibility: string; uncertainty: string
  evidence: string[]; experiment: Experiment | null
}
export interface SuppliedContext {
  memories: { id: string; content: string; category: 'fact' | 'preference' | 'constraint'; horizon?: Memory['horizon']; status?: Memory['status'] }[]
  initial_snapshot?: InitialSnapshot | null
  primary_card?: Partial<Card>
  strategy?: { id: string; version: string } | null
  recent_feedback?: { text: string }[]
  summary: boolean
  history_count: number
  history_retained: boolean
  linked_explorations: { id: string; title: string }[]
}
export interface WebSource {
  name?: string; url: string; snippet?: string; site?: string; published?: string
}
export interface ChatResponse {
  perspective_shift?: PerspectiveShift | null
  perspective_token?: string | null
  user_message_id?: string
  assistant_message_id?: string
  reply: string; suggestion: Suggestion | null; mode: 'demo' | 'deepseek'
  insight?: Insight | null
  phase_change?: PhaseChange | null
  summary?: ConversationSummary | null
  conversation_title?: string | null
  usage?: { prompt_tokens: number; completion_tokens: number; cost_cny: string; currency: string } | null
  supplied_context?: SuppliedContext | null
  tail_line?: string | null
  reasoning_summary?: ReasoningPoint[] | null
  web_sources?: WebSource[] | null
  visual_id?: string | null
}

export const concerns = [
  { id: 'direction', title: '还没找到想走的方向', description: '想探索，也想更了解自己', icon: 'compass' },
  { id: 'change', title: '担心跟不上 AI 和变化', description: '想知道自己的能力还能去哪里', icon: 'spark' },
  { id: 'choices', title: '几个机会，不知道怎么选', description: '每条路都有吸引我和让我犹豫的地方', icon: 'paths' },
  { id: 'start', title: '有了方向，却迟迟没开始', description: '想找到一个真正迈得出去的下一步', icon: 'step' },
]
export const stages = [
  { id: 'studying', label: '学习 / 即将毕业' }, { id: 'searching', label: '正在求职' },
  { id: 'working', label: '在职，考虑变化' }, { id: 'transition', label: '正在转向' },
  { id: 'unsure', label: '暂时说不清' },
]
export function toggleConcern(selected: string[], id: string): string[] {
  return selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id]
}
export function makePreview(input: Onboarding): Card {
  return { title: input.title.trim(), options: [], constraints: [...input.constraints],
    confirmed: input.background.trim() ? [input.background.trim()] : [], hypotheses: [],
    unknowns: ['我需要哪些信息，才能更清楚地选择？'], next_step: '' }
}
export function mergeSuggestion(card: Card, suggestion: Suggestion): Card {
  return { ...card, options: suggestion.options.length ? [...suggestion.options] : [...card.options],
    constraints: [...card.constraints], confirmed: [...card.confirmed],
    hypotheses: [...suggestion.hypotheses], unknowns: [...suggestion.unknowns], next_step: suggestion.next_step }
}
export function experimentProposal(card: Card, experiment: Experiment): Card {
  return { ...card, options: [...card.options], constraints: [...card.constraints], confirmed: [...card.confirmed],
    hypotheses: [...card.hypotheses], unknowns: [...card.unknowns],
    next_step: `${experiment.action}\n验证：${experiment.tests}\n投入：${experiment.effort}\n停止条件：${experiment.stop_rule}` }
}
