import type { FollowUpAnswer, Onboarding } from './domain'
import { refinementFor } from './onboarding-refinements'

export const concernOptions = [
  { id: 'relationships', title: '理清关系和期待', detail: '从自己的需要、沟通和边界开始', icon: 'people' },
  { id: 'overload', title: '找回适合自己的生活节奏', detail: '照顾责任、休息和自己的需要', icon: 'moon' },
  { id: 'job_search', title: '理清求职中的困难', detail: '从岗位方向、投递或面试中的具体问题开始', icon: 'compass' },
  { id: 'direction', title: '找到更适合我的方向', detail: '还不知道往哪里走，或者想重新选择', icon: 'compass' },
  { id: 'change', title: '看看我的能力还能用在哪里', detail: '面对 AI 和行业变化，发现已有经历的新用处', icon: 'orbit' },
  { id: 'choices', title: '认真比较几个选择', detail: '不只看哪个更好，也看看哪个适合现在的我', icon: 'split' },
  { id: 'start', title: '改变现状，但不贸然冒险', detail: '先找到一个代价可控的尝试', icon: 'shield-check' },
  { id: 'possibility', title: '发现一点没想过的可能', detail: '带着好奇，看看还有哪些值得探索的方向', icon: 'door-open' },
  { id: 'other', title: '我想自己说说', detail: '可选，留下一点自己的想法', icon: 'message-heart' },
  { id: 'unsure', title: '还不知道，先看看', detail: '还没有方向，也可以开始', icon: 'message-more' },
]
// First question describes the user's situation; concernOptions remain exploration directions.
export const startingConcernOptions = [
  { id: 'direction', title: '不知道未来该往哪里走', detail: '工作、学习或生活的方向还不清楚', icon: 'compass' },
  { id: 'relationships', title: '关系和期待让我为难', detail: '家人、伴侣、朋友，或别人的期待', icon: 'people' },
  { id: 'overload', title: '生活有些满，精力跟不上', detail: '责任、日常安排、休息和自己的需要', icon: 'moon' },
  { id: 'job_search', title: '求职不顺，有些焦虑', detail: '方向、简历、投递、面试与机会取舍', icon: 'note' },
  { id: 'change', title: '担心跟不上变化', detail: '担心 AI 或行业变化带来的影响', icon: 'orbit' },
  { id: 'choices', title: '有选择要做，却害怕选错', detail: '每条路都有让我犹豫的地方', icon: 'split' },
  { id: 'start', title: '想改变，又怕失去稳定', detail: '想照顾收入，也想试着迈出一步', icon: 'shield-check' },
  { id: 'unsure', title: '暂时说不清，先聊聊', detail: '还没有明确问题，也可以从最近的感受开始', icon: 'message-more' },
]
export interface ExplorationStart {
  value: string
  title: string
  detail: string
  icon: string
}
// The values stay in sync with the original focus answers, so drafts created
// before the visual redesign keep the exact selected state.
export const uncertaintyStarts: ExplorationStart[] = [
  { value: '想先说说最近的感受', title: '聊聊最近的感受', detail: '先把心里的事情说出来', icon: 'chat' },
  { value: '想更了解自己', title: '更了解自己', detail: '慢慢发现自己的需要', icon: 'user' },
  { value: '想看看新的可能', title: '看看新的可能', detail: '探索还没尝试过的方向', icon: 'sunrise' },
]
const focusChoices: Record<string, string[]> = {
  relationships: ['自己的想法和家人的期待不同', '亲密关系里有难以沟通的事', '朋友或同事之间的边界让我为难', '承担了责任，却很难表达自己的需要', '有一段关系，不知道要怎样继续'],
  overload: ['要做的事太多，不知道先放下什么', '总在照顾别人，很少留时间给自己', '休息之后，还是觉得精力不够', '想做些改变，但每天都被打断', '现在只想缓一缓，不急着找办法'],
  job_search: ['还没确定岗位或行业方向', '简历或作品集没有把握', '投递后反馈很少', '面试准备让我没底', '有几个机会，不知道怎么选', '压力有些大，想先说说'],
  direction: ['不知道自己想要怎样的工作或生活', '想理清目前有哪些方向', '已有方向，但不知道怎么开始', '想重新考虑原来的目标', '想先说说最近的感受'],
  change: ['想了解 AI 或行业变化对我的影响', '不知道现在值得学什么', '想了解已有能力还能用在哪里', '想比较继续深耕和转向的代价', '压力有些大，想先说说'],
  choices: ['想把正在比较的选项列清楚', '想比较收入与稳定', '想比较兴趣与投入感', '想比较时间、地点与家庭安排', '缺少信息，还不能做决定'],
  start: ['想找到可以先试的一小步', '想估算收入和投入的底线', '想看看能否保留现状来尝试', '不知道怎样判断尝试是否值得继续', '想先照顾身体与精力'],
  possibility: ['从做过的事发现新的用途', '进一步了解一个感兴趣的领域', '试试创作或做一个小作品', '看看工作之外的生活可能', '先随便聊聊，不急着找方向'],
  other: ['关系与他人的期待', '家庭责任或照护', '生活节奏与身体精力', '一个还没整理好的念头', '想用自己的话说'],
  unsure: uncertaintyStarts.map(item => item.value),
}
export function focusChoicesFor(form: Onboarding): string[] {
  return focusChoices[form.exploration_intent || 'unsure'] || focusChoices.other
}
export function focusChoiceViewsFor(form: Onboarding) {
  if (form.exploration_intent === 'unsure') return uncertaintyStarts
  return focusChoicesFor(form).map(value => ({ value, title: value, detail: '', icon: '' }))
}
export function explorationIntroFor(form: Onboarding) {
  if (form.exploration_intent === 'job_search') return {
    label: 'LET’S EXPLORE', title: '求职时，你卡在哪一步？', detail: '可多选，也可以补充目前考虑的方向',
  }
  if (form.exploration_intent === 'unsure') {
    return {
      label: 'LET’S EXPLORE',
      title: '还没有方向，也没关系',
      detail: '从此刻最想了解的事情开始',
    }
  }
  return {
    label: 'LET’S EXPLORE',
    title: form.exploration_intent ? '沿着这件事，再具体一点' : '此刻，你想从哪里聊起？',
    detail: '选接近你的情况，可多选，也可以留空继续',
  }
}
// One-line page headings. Keep each title short enough for the narrowest
// supported viewport (320px) so the approved five-page flow never truncates.
export const onboardingHeadings = [
  { label: '', title: '最近，你想先聊些什么？', detail: '至少选择一项，可以多选' },
  { label: 'A FIRST THREAD', title: '我们先从一件小事聊起', detail: '至少选择一项，或写下自己的话' },
  { label: '', title: '先了解一点你现在的生活', detail: '选填，可以多选，也可以留空继续' },
  { label: '', title: '希望我怎样陪你聊？', detail: '选填，不选则沿用当前的回应偏好' },
  { label: '', title: '从这里，开始这次对话', detail: '核对后确认，随时可以返回修改' },
]
export const lifeContexts = [
  { id: 'studying', title: '学习或备考' }, { id: 'searching', title: '求职' },
  { id: 'working', title: '在职工作' }, { id: 'transition', title: '职业转换' },
  { id: 'freelance', title: '自由职业' }, { id: 'business', title: '创业或经营' },
  { id: 'creating', title: '内容创作' }, { id: 'care', title: '家庭与照护' },
  { id: 'rest', title: '休整与重新出发' }, { id: 'retired', title: '退休生活' },
  { id: 'other', title: '其他' },
]
export const constraintChoices = ['近期需要稳定收入', '能投入的时间有限', '精力有限，想慢一点', '需要照顾家人', '暂时不方便搬家', '可投入的费用有限']
export type SupportMode = 'listen' | 'discover' | 'compare' | 'experiment'
export function canonicalSupportStyle(value?: string): SupportMode {
  if (value === 'clarify') return 'discover'
  if (value === 'act') return 'experiment'
  return ['listen', 'discover', 'compare', 'experiment'].includes(value || '') ? value as SupportMode : 'discover'
}
export const supportStyles = [
  { id: 'listen', title: '先听我说', detail: '不用急着建议，先认真听听我的想法', icon: 'ear' },
  { id: 'discover', title: '带我发现新的可能', detail: '从我的经历里，看看有没有没想过的方向', icon: 'spark' },
  { id: 'compare', title: '陪我比较几个选择', detail: '把选择背后的代价、条件和未知说清楚', icon: 'scale' },
  { id: 'experiment', title: '给我一个值得试的小实验', detail: '不用一下改变人生，先试一点点', icon: 'flask' },
]
export const DRAFT_KEY = 'agency.onboarding.v2'
export function newOnboarding(): Onboarding {
  return { title: '', concerns: [], stage: 'unsure', background: '', constraints: [], life_contexts: [], support_style: '',
    exploration_intent: '', actual_question: '', focus_response: '', follow_ups: {} }
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
  relationships: { heading: '这段关系，卡在哪里？', question: '这段关系里，哪部分最让你为难？', placeholder: '可以只讲一件具体的事，不必写姓名，也不急着判断谁对谁错' },
  overload: { heading: '最近的生活，哪里吃力？', question: '最近的生活，哪里让你觉得吃力？', placeholder: '比如一天里最费力的一段，或你希望留给自己的时间' },
  job_search: { heading: '求职主要卡在哪一步？', question: '目前的求职，主要卡在哪些地方？', placeholder: '比如目前考虑的岗位、行业，或还没想好方向；有想法再写' },
  direction: { heading: '目前的方向，哪里不清楚？', question: '关于目前的方向，哪些地方还不清楚？', placeholder: '比如正在考虑的工作或生活方向，以及你希望保留的部分' },
  change: { heading: '面对变化，先了解什么？', question: '面对 AI 或行业变化，你想先了解哪些事？', placeholder: '比如现在做的工作、担心的变化，或已有的经历与能力' },
  choices: { heading: '取舍时，最难的是什么？', question: '面对正在考虑的方向，你最难取舍的是什么？', placeholder: '写下你正在比较的选择，也可以先说一个' },
  start: { heading: '改变时，最不想失去什么？', question: '这次改变里，你最不想失去的是什么？', placeholder: '比如收入、时间、地点，或已经拥有的生活' },
  possibility: { heading: '想从哪种可能开始？', question: '你更愿意从过去做过的事情、感兴趣的领域，还是一次新的体验开始探索？', placeholder: '选一个起点，或者留下一点线索' },
  other: { heading: '这个念头，想再说点什么？', question: '关于这个念头，你最想再说一点什么？', placeholder: '不必整理好，可以用自己的话说' },
  unsure: { heading: '还没有方向，也没关系', question: '还没有方向，也可以开始探索', placeholder: '最近让你有一点好奇、投入或想改变的事，可选' },
}
export function branchFor(form: Onboarding) {
  return branches[form.exploration_intent as keyof typeof branches] || (form.exploration_intent ? branches.other : branches.unsure)
}
export function followUpFor(form: Onboarding, intent = form.exploration_intent || 'general'): FollowUpAnswer {
  return form.follow_ups?.[intent] || { selections: [], note: intent === (form.exploration_intent || 'general') ? form.focus_response || '' : '' }
}
export function setFollowUpNote(form: Onboarding, note: string) {
  const key = form.exploration_intent || 'general'
  form.follow_ups = { ...form.follow_ups, [key]: { ...followUpFor(form), note } }
  form.focus_response = note
}
export function toggleFollowUp(form: Onboarding, selection: string) {
  if (!focusChoicesFor(form).includes(selection)) return
  const key = form.exploration_intent || 'general', answer = followUpFor(form)
  const selections = answer.selections.includes(selection) ? answer.selections.filter(value => value !== selection) : [...answer.selections, selection].slice(0, 6)
  form.follow_ups = { ...form.follow_ups, [key]: { ...answer, selections } }
}
function keepMainlineAnswer(form: Onboarding) {
  const key = form.exploration_intent || 'general'
  if (!form.follow_ups?.[key] && form.focus_response) {
    // Legacy answers also stay with their original question, verbatim.
    form.follow_ups = { ...form.follow_ups, [key]: { selections: [], note: form.focus_response } }
  }
}
export function selectMainline(form: Onboarding, intent: string) {
  if (!form.concerns.includes(intent) || form.exploration_intent === intent) return
  keepMainlineAnswer(form)
  form.exploration_intent = intent
  form.focus_response = form.follow_ups?.[intent]?.note || ''
}
export function updateConcerns(form: Onboarding, id: string) {
  keepMainlineAnswer(form)
  form.concerns = toggleConcern(form.concerns, id)
  if (!form.concerns.includes(form.exploration_intent || '')) {
    form.exploration_intent = form.concerns[0] || ''
    form.focus_response = form.follow_ups?.[form.exploration_intent || 'general']?.note || ''
  }
}
export function followUpRecords(form: Onboarding) {
  return Object.entries(form.follow_ups || {}).filter(([key, answer]) =>
    (form.concerns.includes(key) || (key === 'general' && !form.concerns.length)) && (answer.note.trim() || answer.selections.length))
    .map(([key, answer]) => ({ key, title: startingConcernOptions.find(item => item.id === key)?.title || '你想聊的起点', ...answer,
      ...(answer.refinements ? { refinements: Object.fromEntries(Object.entries(answer.refinements).filter(([parent, values]) => answer.selections.includes(parent) && values.length)) } : {}),
    }))
}
export function refinementPromptsFor(form: Onboarding) {
  return followUpRecords(form).flatMap(answer => answer.selections.flatMap(parent => {
    const prompt = refinementFor(parent)
    return prompt ? [{ id: answer.key + ':' + parent, topic: answer.key, topicTitle: answer.title, parent, ...prompt, answers: answer.refinements?.[parent] || [] }] : []
  }))
}
export function toggleRefinement(form: Onboarding, topic: string, parent: string, value: string) {
  const prompt = refinementPromptsFor(form).find(item => item.topic === topic && item.parent === parent)
  if (!prompt?.choices.includes(value)) return
  const answer = followUpFor(form, topic), values = answer.refinements?.[parent] || []
  form.follow_ups = { ...form.follow_ups, [topic]: { ...answer, refinements: { ...answer.refinements,
    [parent]: values.includes(value) ? values.filter(item => item !== value) : [...values, value].slice(0, 6),
  } } }
}
export function hasOnboardingClues(form: Onboarding) {
  return !!(form.title.trim() || form.concerns.length || form.actual_question?.trim() || form.focus_response?.trim() || form.background.trim() || form.constraints.length || form.life_contexts?.length || form.support_style || followUpRecords(form).length)
}
export function hasRequiredFollowUp(form: Onboarding) {
  return !!(form.actual_question?.trim() || form.focus_response?.trim() || followUpRecords(form).some(answer =>
    answer.note.trim() || answer.selections.some(value => value.trim())))
}
export function submissionFor(form: Onboarding, defaultStyle?: string): Onboarding {
  const support = form.support_style || defaultStyle
  return { ...form, support_style: support ? canonicalSupportStyle(support) : '',
    follow_ups: Object.fromEntries(followUpRecords(form).map(({ key, selections, note, refinements }) => [key, { selections, note, ...(refinements && Object.keys(refinements).length ? { refinements } : {}) }])) }
}
export function reflectionFor(form: Onboarding) {
  const hasClues = !!(form.actual_question?.trim() || form.focus_response?.trim() || form.background.trim() || followUpRecords(form).length)
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
  if (form.focus_response?.trim() || form.background.trim() || followUpRecords(form).length) return '先沿着这些线索探索'
  return form.exploration_intent === 'unsure' ? '还没有方向，也可以开始探索' : '这次探索，不急着下结论'
}
export function saveDraft(form: Onboarding, step: number, now = Date.now()) {
  return { version: 4, form: JSON.parse(JSON.stringify(form)), step, savedAt: now }
}
export function restoreDraft(value: unknown, now = Date.now()): { form: Onboarding; step: number } | null {
  if (!value || typeof value !== 'object') return null
  const item = value as ReturnType<typeof saveDraft>
  if (![2, 3, 4].includes(item.version) || !Number.isInteger(item.step) || item.step < -1 || item.step > 6 ||
      !Number.isFinite(item.savedAt) || item.savedAt < 0 ||
      (item.version !== 4 && (item.savedAt > now || now - item.savedAt > 7 * 86400000))) return null
  const raw = item.form
  const allowed = [...concernOptions.map(o => o.id), 'relationships', 'overload']
  const text = (v: unknown, n: number) => typeof v === 'string' && v.length <= n
  if (!raw || !text(raw.title, 120) || !text(raw.background, 400) ||
      !Array.isArray(raw.concerns) || raw.concerns.length > 8 || raw.concerns.some((id: unknown) => typeof id !== 'string' || !allowed.includes(id)) ||
      (raw.concerns.includes('unsure') && raw.concerns.length > 1) ||
      !Array.isArray(raw.life_contexts) || raw.life_contexts.some((id: unknown) => !lifeContexts.some(o => o.id === id)) ||
      !['', 'clarify', 'act', ...supportStyles.map(o => o.id)].includes(raw.support_style)) return null
  const form: Onboarding = { ...newOnboarding(), ...raw }
  if (!['studying', 'searching', 'working', 'transition', 'unsure'].includes(form.stage) ||
      !Array.isArray(form.constraints) || form.constraints.length > 12 || form.constraints.some(v => !text(v, 400)) ||
      !text(form.actual_question, 400) || !text(form.focus_response, 800) || !text(form.exploration_intent, 30)) return null
  if (form.exploration_intent && !form.concerns.includes(form.exploration_intent)) return null
  if (form.follow_ups !== undefined) {
    if (!form.follow_ups || typeof form.follow_ups !== 'object' || Array.isArray(form.follow_ups) || Object.keys(form.follow_ups).length > 11) return null
    for (const [key, answer] of Object.entries(form.follow_ups)) {
      if (![...allowed, 'general'].includes(key) || !answer || !Array.isArray(answer.selections) || answer.selections.length > 6 ||
        answer.selections.some(value => !text(value, 100)) || !text(answer.note, 800)) return null
      if (answer.refinements !== undefined && (!answer.refinements || typeof answer.refinements !== 'object' || Array.isArray(answer.refinements) || Object.keys(answer.refinements).length > 6 ||
          Object.entries(answer.refinements).some(([parent, values]) => !text(parent, 100) || !Array.isArray(values) || values.length > 6 || values.some(value => !text(value, 100))))) return null
    }
  }
  if (item.version === 2 && ['我也不知道，帮我一起理清', '我也不知道，帮我一起理清。'].includes(form.title)) form.title = ''
  form.concerns = [...new Set<string>(form.concerns)]
  form.life_contexts = [...new Set<string>(form.life_contexts)]
  return { form, step: item.step }
}
