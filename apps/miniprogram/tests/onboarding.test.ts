import { expect, it } from 'vitest'
import { newOnboarding, toggleConcern, reflectionFor, restoreDraft, saveDraft, branchFor, selectMainline, canonicalSupportStyle, reflectionHeading } from '../src/onboarding'

it('keeps unsure exclusive while allowing the first five concerns together', () => {
  expect(toggleConcern(['direction', 'relationships'], 'unsure')).toEqual(['unsure'])
  expect(toggleConcern(['unsure'], 'other')).toEqual(['other'])
  expect(toggleConcern(['direction'], 'overload')).toEqual(['direction', 'overload'])
  expect(toggleConcern(['unsure'], 'unsure')).toEqual([])
})

it('changes the question by the chosen mainline without losing other selected interests', () => {
  const form = { ...newOnboarding(), concerns: ['change', 'choices'], background: '做过开发', actual_question: '我的能力还能用在哪里' }
  selectMainline(form, 'change')
  expect(branchFor(form).question).toContain('别人经常找你帮忙')
  expect(form.title).toBe('')
  expect(form.concerns).toEqual(['change', 'choices'])
  selectMainline(form, 'choices')
  expect(branchFor(form).question).toContain('正在考虑哪些方向')
  expect(form.actual_question).toBe('我的能力还能用在哪里')
  expect(branchFor({ ...form, exploration_intent: 'start' }).question).toContain('最不想失去')
  expect(branchFor({ ...form, exploration_intent: 'possibility' }).question).toContain('新的体验')
})

it('allows uncertainty without fabricating a career title and preserves the entire local draft', () => {
  const form = { ...newOnboarding(), concerns: ['unsure'], exploration_intent: 'unsure', focus_response: '喜欢解释复杂的事情', constraints: ['每周两小时'], stage: 'working', support_style: 'discover' }
  const restored = restoreDraft(saveDraft(form, 4, 1000), 2000)!
  expect(restored.form).toEqual(form)
  expect(form.title).toBe('')
  expect(reflectionFor(form)).toContain('新的连接')
  expect(reflectionFor(form)).not.toMatch(/天赋|潜力|帮我理清/)
})

it('migrates legacy draft action labels without rewriting ordinary user titles', () => {
  const old = { version: 2, savedAt: 1000, step: 4, form: { ...newOnboarding(), title: '我也不知道，帮我一起理清', concerns: ['unsure'], support_style: 'act' } }
  expect(restoreDraft(old, 2000)?.form.title).toBe('')
  expect(canonicalSupportStyle('act')).toBe('experiment')
  expect(canonicalSupportStyle('clarify')).toBe('discover')
  expect(restoreDraft({ ...old, form: { ...old.form, title: '想了解 UX 设计' } }, 2000)?.form.title).toBe('想了解 UX 设计')
})

it('restores the last step and exact local draft without inventing context', () => {
  const form = { ...newOnboarding(), concerns: ['direction'], title: '未来的方向', background: '自己的话', life_contexts: ['care'], support_style: 'listen' }
  const restored = restoreDraft(saveDraft(form, 3, 1000), 2000)!
  expect(restored.step).toBe(3)
  expect(restored.form).toEqual(form)
  expect(restoreDraft(saveDraft(form, 3, 1000), 8 * 86400000)).toBeNull()
  expect(restoreDraft({ version: 2, form: { title: 123 } }, 2000)).toBeNull()
})

it('reflection uses only selected context and marks itself as deterministic', () => {
  const form = { ...newOnboarding(), concerns: ['direction'], title: '未来的方向', support_style: 'listen' }
  const reflection = reflectionFor(form)
  expect(reflection).not.toContain('未来的方向') // The separate heading already presents the user's title
  expect(reflection).toContain('说起')
  expect(reflection).not.toContain('工作')
  expect(reflection).not.toContain('焦虑型')
})

it('does not equate an unnamed exploration with having no direction', () => {
  const form = { ...newOnboarding(), concerns: ['change'], exploration_intent: 'change', actual_question: '我想发现自己的经历还能用在哪', support_style: 'discover' }
  expect(reflectionHeading(form)).toBe('先从你的问题开始')
  expect(reflectionHeading(form) + reflectionFor(form)).not.toMatch(/还没有方向|没有确定想走/)
  expect(reflectionFor(form)).not.toContain(form.actual_question)
})

it('respects explicit uncertainty without deriving a trait or career direction', () => {
  const form = { ...newOnboarding(), concerns: ['unsure'], exploration_intent: 'unsure', support_style: 'discover' }
  expect(reflectionHeading(form)).toContain('还没有方向')
  expect(reflectionFor(form)).toContain('真实经历')
  expect(reflectionFor(form)).not.toMatch(/你适合|你擅长|天赋|潜力/)
})

it('uses the selected support behavior without repeating the user title or selected label', () => {
  const form = { ...newOnboarding(), title: '技术和业务之间', focus_response: '喜欢解释复杂问题' }
  expect(reflectionHeading(form)).toBe('下一步，由你选择')
  expect(reflectionFor({ ...form, support_style: 'listen' })).toContain('不需要马上得到建议')
  expect(reflectionFor({ ...form, support_style: 'discover' })).toContain('新的连接')
  expect(reflectionFor({ ...form, support_style: 'compare' })).toContain('代价与条件')
  expect(reflectionFor({ ...form, support_style: 'experiment' })).toContain('时间与资源')
  expect(reflectionFor(form)).not.toContain(form.title)
})
