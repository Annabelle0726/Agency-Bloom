import type { Onboarding } from './domain'

export const concernOptions = [
  { id: 'direction', title: '看不到未来的方向', icon: 'compass' },
  { id: 'change', title: '担心被 AI 和时代淘汰', icon: 'spark' },
  { id: 'relationships', title: '人际关系让我疲惫', icon: 'people' },
  { id: 'overload', title: '事情太多，不知道从哪里开始', icon: 'layers' },
  { id: 'other', title: '还有别的事，我想自己说说', icon: 'chat' },
  { id: 'unsure', title: '暂时说不清，先看看', icon: 'sun' },
]
export const lifeContexts = [
  { id: 'studying', title: '学习或备考' }, { id: 'searching', title: '求职' },
  { id: 'working', title: '在职工作' }, { id: 'transition', title: '职业转换' },
  { id: 'freelance', title: '自由职业' }, { id: 'business', title: '创业或经营' },
  { id: 'creating', title: '内容创作' }, { id: 'care', title: '家庭与照护' },
  { id: 'rest', title: '休整与重新出发' }, { id: 'retired', title: '退休生活' },
  { id: 'other', title: '其他' },
]
export const supportStyles = [
  { id: 'listen', title: '先听我说', detail: '给自己一个可以安心倾诉的空间', icon: 'ear' },
  { id: 'clarify', title: '帮我理清问题', detail: '和我一起整理问题，理清思路', icon: 'compass' },
  { id: 'compare', title: '和我比较几个选择', detail: '帮我分析不同选项的利弊', icon: 'paths' },
  { id: 'act', title: '一起找到下一步', detail: '从今天开始，做一点点改变', icon: 'step' },
]
export const DRAFT_KEY = 'agency.onboarding.v2'
export function newOnboarding(): Onboarding {
  return { title: '', concerns: [], stage: 'unsure', background: '', constraints: [], life_contexts: [], support_style: '' }
}
export function toggleConcern(selected: string[], id: string) {
  if (selected.includes(id)) return selected.filter(value => value !== id)
  if (id === 'unsure') return ['unsure']
  return [...selected.filter(value => value !== 'unsure'), id]
}
export function reflectionFor(form: Onboarding) {
  const style = supportStyles.find(item => item.id === form.support_style)
  return `你提到了「${form.title || '还没有说清楚的事情'}」${style ? `\n此刻你希望「${style.title}」` : ''}\n\n我们可以先从这一件事开始，慢慢看清它`
}
export function saveDraft(form: Onboarding, step: number, now = Date.now()) {
  return { version: 2, form: JSON.parse(JSON.stringify(form)), step, savedAt: now }
}
export function restoreDraft(value: unknown, now = Date.now()): { form: Onboarding; step: number } | null {
  if (!value || typeof value !== 'object') return null
  const item = value as ReturnType<typeof saveDraft>
  if (item.version !== 2 || !Number.isInteger(item.step) || item.step < -1 || item.step > 6 ||
      typeof item.savedAt !== 'number' || item.savedAt > now || now - item.savedAt > 7 * 86400000) return null
  const form = item.form
  if (!form || typeof form.title !== 'string' || form.title.length > 120 ||
      typeof form.background !== 'string' || form.background.length > 400 ||
      !Array.isArray(form.concerns) || form.concerns.some((id: unknown) => !concernOptions.some(o => o.id === id)) ||
      (form.concerns.includes('unsure') && form.concerns.length > 1) ||
      !Array.isArray(form.life_contexts) || form.life_contexts.some((id: unknown) => !lifeContexts.some(o => o.id === id)) ||
      !['', ...supportStyles.map(o => o.id)].includes(form.support_style)) return null
  return { form: { ...newOnboarding(), title: form.title, background: form.background,
    concerns: [...new Set<string>(form.concerns)], life_contexts: [...new Set<string>(form.life_contexts)],
    support_style: form.support_style }, step: item.step }
}
