import type { Onboarding } from './domain'

export const concernOptions = [
  { id: 'direction', title: '找到更适合我的方向', detail: '还不知道往哪里走，或者想重新选择', icon: 'compass' },
  { id: 'change', title: '看看我的能力还能用在哪里', detail: '面对 AI 和行业变化，发现已有经历的新用处', icon: 'spark' },
  { id: 'choices', title: '认真比较几个选择', detail: '不只看哪个更好，也看看哪个适合现在的我', icon: 'paths' },
  { id: 'start', title: '改变现状，但不贸然冒险', detail: '先找到一个代价可控的尝试', icon: 'step' },
  { id: 'possibility', title: '发现一点没想过的可能', detail: '带着好奇，看看还有哪些值得探索的方向', icon: 'sun' },
  { id: 'other', title: '我想自己说说', detail: '可选，留下一点自己的想法', icon: 'chat' },
  { id: 'unsure', title: '还不知道，先看看', detail: '还没有方向，也可以开始', icon: 'compass' },
]
// First question describes the user's situation; concernOptions remain exploration directions.
export const startingConcernOptions = [
  { id: 'direction', title: '不知道未来该往哪里走', detail: '工作、学习或生活的方向还不清楚', icon: 'compass' },
  { id: 'change', title: '担心跟不上 AI 或行业变化', detail: '想知道自己的能力，还能用在哪里', icon: 'spark' },
  { id: 'choices', title: '有选择要做，却害怕选错', detail: '每条路都有让我犹豫的地方', icon: 'paths' },
  { id: 'start', title: '想改变，又怕失去收入或稳定', detail: '希望找到代价可承受的一小步', icon: 'step' },
  { id: 'other', title: '有别的事，让我放不下', detail: '关系、期待、精力，或其他牵挂，不必马上说明', icon: 'chat' },
  { id: 'possibility', title: '也想看看生活还有哪些可能', detail: '没有明显不安，也欢迎带着好奇来', icon: 'sun' },
  { id: 'unsure', title: '暂时说不清，先看看', detail: '现在不想细说，也可以继续', icon: 'compass' },
]
const focusChoices: Record<string, string[]> = {
  direction: ['收入更稳定一点', '工作之外有自己的时间', '做自己愿意投入的事', '少一点疲惫和消耗'],
  change: ['解释问题、与人沟通', '整理信息、发现规律', '解决具体的技术问题', '协调事情、照顾他人的需要'],
  choices: ['收入和稳定', '兴趣和投入感', '时间和精力', '发展空间与风险'],
  start: ['稳定的收入', '身体与精力', '重要的关系', '属于自己的时间'],
  possibility: ['过去做过的事', '一直感兴趣的领域', '一次新的体验'],
  other: ['工作或学习', '关系与他人的期待', '生活与精力', '对未来的不确定'],
  unsure: ['想先说说最近的感受', '想更了解自己', '想看看新的可能'],
}
export function focusChoicesFor(form: Onboarding): string[] {
  return focusChoices[form.exploration_intent || ''] || []
}
export const lifeContexts = [
  { id: 'studying', title: '学习或备考' }, { id: 'searching', title: '求职' },
  { id: 'working', title: '在职工作' }, { id: 'transition', title: '职业转换' },
  { id: 'freelance', title: '自由职业' }, { id: 'business', title: '创业或经营' },
  { id: 'creating', title: '内容创作' }, { id: 'care', title: '家庭与照护' },
  { id: 'rest', title: '休整与重新出发' }, { id: 'retired', title: '退休生活' },
  { id: 'other', title: '其他' },
]
export type SupportMode = 'listen' | 'discover' | 'compare' | 'experiment'
export function canonicalSupportStyle(value?: string): SupportMode {
  if (value === 'clarify') return 'discover'
  if (value === 'act') return 'experiment'
  return ['listen', 'discover', 'compare', 'experiment'].includes(value || '') ? value as SupportMode : 'discover'
}
export const supportStyles = [
  { id: 'listen', title: '先听我说', detail: '不用急着建议，先认真听听我的想法', icon: 'ear' },
  { id: 'discover', title: '带我发现新的可能', detail: '从我的经历里，看看有没有没想过的方向', icon: 'spark' },
  { id: 'compare', title: '陪我比较几个选择', detail: '把选择背后的代价、条件和未知说清楚', icon: 'paths' },
  { id: 'experiment', title: '给我一个值得试的小实验', detail: '不用一下改变人生，先试一点点', icon: 'step' },
]
export const DRAFT_KEY = 'agency.onboarding.v2'
export function newOnboarding(): Onboarding {
  return { title: '', concerns: [], stage: 'unsure', background: '', constraints: [], life_contexts: [], support_style: '',
    exploration_intent: '', actual_question: '', focus_response: '' }
}
export function loginSummaryFor(form: Onboarding) {
  const name = form.title.trim()
  return {
    name,
    clue: [form.actual_question, form.focus_response, form.background].map(value => value?.trim() || '').find(value => value && value !== name) || '',
    intent: concernOptions.find(item => item.id === form.exploration_intent)?.title || '',
    support: form.support_style ? supportStyles.find(item => item.id === canonicalSupportStyle(form.support_style))?.title || '' : '',
  }
}
export function toggleConcern(selected: string[], id: string) {
  if (selected.includes(id)) return selected.filter(value => value !== id)
  if (id === 'unsure') return ['unsure']
  return [...selected.filter(value => value !== 'unsure'), id]
}
const branches = {
  direction: { question: '如果方向更清楚了，你希望日常生活有什么不同？', placeholder: '比如怎样度过一天、留住什么，或少承担什么，也可以暂时留空' },
  change: { question: '有没有一件事，别人经常找你帮忙，而你自己觉得做起来还挺自然？', placeholder: '说一件具体的小事就好，不需要给自己贴标签' },
  choices: { question: '面对正在考虑的方向，你最难取舍的是什么？', placeholder: '写下你正在比较的选择，也可以先说一个' },
  start: { question: '这次改变里，你最不想失去的是什么？', placeholder: '比如收入、时间、地点，或已经拥有的生活' },
  possibility: { question: '你更愿意从过去做过的事情、感兴趣的领域，还是一次新的体验开始探索？', placeholder: '选一个起点，或者留下一点线索' },
  other: { question: '关于这个念头，你最想再说一点什么？', placeholder: '不必整理好，可以用自己的话说' },
  unsure: { question: '还没有方向，也可以开始探索', placeholder: '最近让你有一点好奇、投入或想改变的事，可选' },
}
export function branchFor(form: Onboarding) {
  return branches[form.exploration_intent as keyof typeof branches] || branches.other
}
export function selectMainline(form: Onboarding, intent: string) {
  if (!form.concerns.includes(intent) || form.exploration_intent === intent) return
  // A suggested answer belongs to its question; preserve user-written details.
  if (focusChoicesFor(form).includes(form.focus_response || '')) form.focus_response = ''
  form.exploration_intent = intent
}
export function reflectionFor(form: Onboarding) {
  const hasClues = !!(form.actual_question?.trim() || form.focus_response?.trim() || form.background.trim())
  const mode = canonicalSupportStyle(form.support_style)
  if (mode === 'listen') return '从你此刻最想展开的部分说起\n不需要马上得到建议，也不急着决定'
  if (mode === 'compare') return '如果已有选项，可以比较它们的代价与条件\n还没有时，先留下值得了解的方向，不急着选出答案'
  if (mode === 'experiment') return '先以你愿意投入的时间与资源为边界，再提出一个可验证、可停止的小尝试\n不要求你作出大的改变'
  return hasClues ? '围绕你提供的内容，看看是否有新的连接\n每个新角度都需要说明依据，再由你判断是否值得继续' :
    '可以先从一次真实经历开始，找到具体线索\n再看看它们能否连接到新的可能，不急着下结论'
}
export function reflectionHeading(form: Onboarding) {
  if (form.title.trim()) return '下一步，由你选择'
  if (form.actual_question?.trim()) return '先从你的问题开始'
  if (form.focus_response?.trim() || form.background.trim()) return '先沿着这些线索探索'
  return form.exploration_intent === 'unsure' ? '还没有方向，也可以开始探索' : '这次探索，不急着下结论'
}
export function saveDraft(form: Onboarding, step: number, now = Date.now()) {
  return { version: 3, form: JSON.parse(JSON.stringify(form)), step, savedAt: now }
}
export function restoreDraft(value: unknown, now = Date.now()): { form: Onboarding; step: number } | null {
  if (!value || typeof value !== 'object') return null
  const item = value as ReturnType<typeof saveDraft>
  if (![2, 3].includes(item.version) || !Number.isInteger(item.step) || item.step < -1 || item.step > 6 ||
      typeof item.savedAt !== 'number' || item.savedAt > now || now - item.savedAt > 7 * 86400000) return null
  const raw = item.form
  const allowed = [...concernOptions.map(o => o.id), 'relationships', 'overload']
  const text = (v: unknown, n: number) => typeof v === 'string' && v.length <= n
  if (!raw || !text(raw.title, 120) || !text(raw.background, 400) ||
      !Array.isArray(raw.concerns) || raw.concerns.length > 6 || raw.concerns.some((id: unknown) => typeof id !== 'string' || !allowed.includes(id)) ||
      (raw.concerns.includes('unsure') && raw.concerns.length > 1) ||
      !Array.isArray(raw.life_contexts) || raw.life_contexts.some((id: unknown) => !lifeContexts.some(o => o.id === id)) ||
      !['', 'clarify', 'act', ...supportStyles.map(o => o.id)].includes(raw.support_style)) return null
  const form: Onboarding = { ...newOnboarding(), ...raw }
  if (!['studying', 'searching', 'working', 'transition', 'unsure'].includes(form.stage) ||
      !Array.isArray(form.constraints) || form.constraints.length > 12 || form.constraints.some(v => !text(v, 400)) ||
      !text(form.actual_question, 400) || !text(form.focus_response, 800) || !text(form.exploration_intent, 30)) return null
  if (form.exploration_intent && !form.concerns.includes(form.exploration_intent)) return null
  if (item.version === 2 && ['我也不知道，帮我一起理清', '我也不知道，帮我一起理清。'].includes(form.title)) form.title = ''
  form.concerns = [...new Set<string>(form.concerns)]
  form.life_contexts = [...new Set<string>(form.life_contexts)]
  return { form, step: item.step }
}
