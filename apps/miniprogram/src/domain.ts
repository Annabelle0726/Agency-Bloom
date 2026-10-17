export interface Onboarding {
  title: string; concerns: string[]; stage: string; background: string; constraints: string[]
  life_contexts?: string[]; support_style?: string
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
}
export interface User { id: string; theme: 'light' | 'dark'; save_chat: boolean; ai_consent: boolean; support_style: string }
export interface ChatMessage { role: 'user' | 'assistant'; content: string }

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
