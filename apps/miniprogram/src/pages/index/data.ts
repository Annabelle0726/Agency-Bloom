import type { Card } from '../../domain'

export const newChatStarters = [
  '我想聊聊最近困扰我的事',
  '帮我比较几个选择',
  '给我一个没想过的新角度',
] as const

export const experimentFields = [
  { key: 'action', label: '我愿意试的事情', max: 200 },
  { key: 'tests', label: '想验证什么', max: 200 },
  { key: 'effort', label: '时间、精力与资源上限', max: 120 },
  { key: 'stop_rule', label: '什么时候可以停下来', max: 120 },
] as const

export const editFields = [
  { key: 'options', label: '正在考虑的方向', hint: '每行一个；暂时没有也没关系' },
  { key: 'constraints', label: '现实约束', hint: '时间、收入、地点或其他重要条件' },
  { key: 'confirmed', label: '我确认的信息', hint: '只留下你认为准确的内容' },
  { key: 'hypotheses', label: '可能性 · 尚未证实', hint: '推测可以保留，也可以删掉' },
  { key: 'unknowns', label: '还需要了解的', hint: '每行一个需要核实的问题' },
] as const satisfies ReadonlyArray<{
  key: keyof Pick<Card, 'options' | 'constraints' | 'confirmed' | 'hypotheses' | 'unknowns'>
  label: string
  hint: string
}>

export const feedbackOptions = [
  { id: 'progress', label: '有了进展' },
  { id: 'stuck', label: '遇到阻碍' },
  { id: 'change', label: '想法变了' },
] as const

export const discoveryPrompts = [
  { icon: 'compass', label: '辨认意愿', title: '如果少一点比较', question: '如果没有别人的赞许，我依然愿意把时间交给什么？' },
  { icon: 'paths', label: '看见选择', title: '想要的自由，有什么模样', question: '现在的努力，会让我拥有哪一种具体的选择？为此付出的代价，我还愿意承担吗？' },
  { icon: 'sun', label: '从体验出发', title: '什么让我想再来一次', question: '最近有没有一个时刻，让我感到投入、舒展，或愿意再经历一次？' },
] as const

export const todayLabel = new Date().toLocaleDateString('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'short',
})

export const greeting = new Date().getHours() < 12
  ? '早安，按自己的节奏来'
  : new Date().getHours() < 18
    ? '午后好，给自己一点空间'
    : '晚上好，今天辛苦了'

export const prettyDate = (date: string) =>
  new Date(date).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
