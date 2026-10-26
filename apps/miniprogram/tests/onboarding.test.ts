import { expect, it } from 'vitest'
import { focusChoicesFor, focusChoiceViewsFor, explorationIntroFor, uncertaintyStarts, startingConcernOptions, concernOptions, newOnboarding, toggleConcern, reflectionFor, restoreDraft, saveDraft, branchFor, selectMainline, canonicalSupportStyle, reflectionHeading, loginSummaryFor } from '../src/onboarding'

it('keeps unsure exclusive while allowing the first five concerns together', () => {
  expect(toggleConcern(['direction', 'relationships'], 'unsure')).toEqual(['unsure'])
  expect(toggleConcern(['unsure'], 'other')).toEqual(['other'])
  expect(toggleConcern(['direction'], 'overload')).toEqual(['direction', 'overload'])
  expect(toggleConcern(['unsure'], 'unsure')).toEqual([])
})

it('renders a login summary from actual clues without treating an exploration name as a person', () => {
  const form = { ...newOnboarding(), title: 'Anna', concerns: ['change'], exploration_intent: 'change', focus_response: '喜欢解释复杂问题', support_style: 'listen' }
  expect(loginSummaryFor(form)).toEqual({ name: 'Anna', clue: '喜欢解释复杂问题', intent: '看看我的能力还能用在哪里', support: '先听我说' })
})

it('keeps login summary empty fields honest and does not repeat the exploration name', () => {
  expect(loginSummaryFor(newOnboarding())).toEqual({ name: '', clue: '', intent: '', support: '' })
  expect(loginSummaryFor({ ...newOnboarding(), title: '比较两个机会', actual_question: '比较两个机会', focus_response: '收入与通勤很重要' }).clue).toBe('收入与通勤很重要')
})

it('changes the question by the chosen mainline without losing other selected interests', () => {
  const form = { ...newOnboarding(), concerns: ['change', 'choices'], background: '做过开发', actual_question: '我的能力还能用在哪里' }
  selectMainline(form, 'change')
  expect(branchFor(form).question).toContain('AI 或行业变化')
  expect(form.title).toBe('')
  expect(form.concerns).toEqual(['change', 'choices'])
  selectMainline(form, 'choices')
  expect(branchFor(form).question).toContain('正在考虑的方向')
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
  expect(restoreDraft(saveDraft(form, 3, 1000), 8 * 86400000)?.form).toEqual(form)
  expect(restoreDraft({ ...saveDraft(form, 3, 1000), version: 3 }, 8 * 86400000)).toBeNull()
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


it('keeps a choice-only onboarding draft valid without inventing written details', () => {
  const form = { ...newOnboarding(), concerns: ['direction'], exploration_intent: 'direction', support_style: 'listen' }
  const restored = restoreDraft(saveDraft(form, 5, 1000), 2000)!
  expect(restored.form).toEqual(form)
  expect([restored.form.title, restored.form.background, restored.form.actual_question, restored.form.focus_response]).toEqual(['', '', '', ''])
})

it('persists the exact quick answer chosen by the user', () => {
  const form = { ...newOnboarding(), concerns: ['start'], exploration_intent: 'start', support_style: 'experiment' }
  form.focus_response = focusChoicesFor(form)[0]
  expect(restoreDraft(saveDraft(form, 4, 1000), 2000)?.form.focus_response).toBe('想找到可以先试的一小步')
})

it('keeps the three gentle exploration entries mapped to existing draft values', () => {
  const unsure = { ...newOnboarding(), concerns: ['unsure'], exploration_intent: 'unsure' }
  expect(focusChoicesFor(unsure)).toEqual(uncertaintyStarts.map(item => item.value))
  expect(focusChoiceViewsFor(unsure)).toEqual(uncertaintyStarts)
  expect(focusChoiceViewsFor(unsure).map(item => item.title)).toEqual(['聊聊最近的感受', '更了解自己', '看看新的可能'])
  expect(explorationIntroFor(unsure)).toMatchObject({ label: 'LET’S EXPLORE', title: '还没有方向，也没关系' })

  const specific = { ...newOnboarding(), concerns: ['change'], exploration_intent: 'change' }
  expect(focusChoiceViewsFor(specific).map(item => item.title)).toEqual(focusChoicesFor(specific))
  expect(focusChoiceViewsFor(specific).every(item => !item.icon && !item.detail)).toBe(true)
  expect(explorationIntroFor(specific).title).not.toContain('还没有方向')
})

it('does not carry a suggested answer into a different question or erase free writing', () => {
  const form = { ...newOnboarding(), concerns: ['direction', 'change'], exploration_intent: 'direction', focus_response: '工作之外有自己的时间' }
  selectMainline(form, 'change')
  expect(form.focus_response).toBe('')
  form.focus_response = '我喜欢陪家人，也想试试远程工作'
  selectMainline(form, 'direction')
  expect(form.focus_response).toBe('工作之外有自己的时间')
  expect(form.follow_ups?.change.note).toBe('我喜欢陪家人，也想试试远程工作')
  selectMainline(form, 'change')
  expect(form.focus_response).toBe('我喜欢陪家人，也想试试远程工作')
  selectMainline(form, 'direction')
  selectMainline(form, 'choices')
  expect(form.exploration_intent).toBe('direction')
})

it('keeps curiosity and uncertainty available without requiring an anxiety label', () => {
  expect(startingConcernOptions.every(item => concernOptions.some(option => option.id === item.id))).toBe(true)
  for (const intent of ['possibility', 'unsure']) {
    const form = { ...newOnboarding(), concerns: [intent], exploration_intent: intent, support_style: 'listen' }
    expect(restoreDraft(saveDraft(form, 5, 1000), 2000)?.form).toEqual(form)
  }
})
