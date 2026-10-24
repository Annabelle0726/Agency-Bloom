import { expect, it } from 'vitest'
import { newOnboarding, branchFor, focusChoicesFor, selectMainline, followUpFor, toggleFollowUp, setFollowUpNote, updateConcerns, submissionFor, restoreDraft, saveDraft, refinementPromptsFor, toggleRefinement } from '../src/onboarding'

it('narrows selected blockers again and excludes descendants when their parent is removed', () => {
  const form = newOnboarding()
  updateConcerns(form, 'job_search'); toggleFollowUp(form, '投递后反馈很少')
  const prompt = refinementPromptsFor(form)[0]
  expect(prompt.question).toContain('投递')
  expect(prompt.choices).toContain('投递后一直没有回复')
  toggleRefinement(form, prompt.topic, prompt.parent, prompt.choices[0])
  expect(submissionFor(form).follow_ups?.job_search.refinements?.[prompt.parent]).toEqual([prompt.choices[0]])
  toggleFollowUp(form, prompt.parent)
  expect(refinementPromptsFor(form)).toEqual([])
  expect(submissionFor(form).follow_ups?.job_search).toBeUndefined()
  toggleFollowUp(form, prompt.parent)
  expect(refinementPromptsFor(restoreDraft(saveDraft(form, 2, 1000), 2000)!.form)[0].answers).toEqual([prompt.choices[0]])
  toggleRefinement(form, 'job_search', prompt.parent, 'not a provided choice')
  expect(refinementPromptsFor(form)[0].answers).toHaveLength(1)
})

it('offers different third-level questions for direction, CV and interviews', () => {
  const form = newOnboarding(); updateConcerns(form, 'job_search')
  for (const parent of focusChoicesFor(form).slice(0, 4)) toggleFollowUp(form, parent)
  const prompts = refinementPromptsFor(form)
  expect(new Set(prompts.map(item => item.question)).size).toBe(4)
  expect(prompts.find(item => item.parent.includes('简历'))?.choices).toContain('经历不知道怎样对应岗位要求')
  expect(prompts.find(item => item.parent.includes('面试'))?.choices).toContain('项目或经历讲不清楚')
})

it('branches into relationship and daily-life problems without career assumptions', () => {
  for (const [topic, parent, expected] of [
    ['relationships', '自己的想法和家人的期待不同', '知道自己想要什么，但难以表达'],
    ['overload', '要做的事太多，不知道先放下什么', '责任没有人可以分担'],
  ]) {
    const form = newOnboarding(); updateConcerns(form, topic)
    expect(focusChoicesFor(form)).toContain(parent)
    toggleFollowUp(form, parent)
    const prompt = refinementPromptsFor(form)[0]
    expect(prompt.choices).toContain(expected)
    toggleRefinement(form, topic, parent, expected)
    expect(submissionFor(form).follow_ups?.[topic].refinements?.[parent]).toEqual([expected])
    expect(form.life_contexts).toEqual([])
    expect(form.stage).toBe('unsure')
  }
})

it('asks concrete job-search follow-ups and permits several blockers together', () => {
  const form = newOnboarding()
  updateConcerns(form, 'job_search')
  expect(form.exploration_intent).toBe('job_search')
  expect(branchFor(form).question).toContain('求职')
  const choices = focusChoicesFor(form)
  expect(choices).toContain('还没确定岗位或行业方向')
  expect(choices).toContain('投递后反馈很少')
  toggleFollowUp(form, choices[0]); toggleFollowUp(form, choices[2])
  expect(followUpFor(form).selections).toEqual([choices[0], choices[2]])
  toggleFollowUp(form, choices[0])
  expect(followUpFor(form).selections).toEqual([choices[2]])
})

it('keeps each mainline answer independent while switching and changing Q1', () => {
  const form = newOnboarding()
  updateConcerns(form, 'job_search')
  toggleFollowUp(form, focusChoicesFor(form)[0]); setFollowUpNote(form, '考虑产品设计和用户研究')
  updateConcerns(form, 'change'); selectMainline(form, 'change')
  expect(followUpFor(form)).toEqual({ selections: [], note: '' })
  toggleFollowUp(form, focusChoicesFor(form)[0]); setFollowUpNote(form, '想了解 AI 对设计工作的影响')
  selectMainline(form, 'job_search')
  expect(followUpFor(form).note).toBe('考虑产品设计和用户研究')
  updateConcerns(form, 'job_search')
  expect(submissionFor(form).follow_ups).not.toHaveProperty('job_search')
  updateConcerns(form, 'job_search'); selectMainline(form, 'job_search')
  expect(followUpFor(form).note).toBe('考虑产品设计和用户研究')
})

it('round-trips multi-select answers and free writing without inventing basic context', () => {
  const form = newOnboarding()
  updateConcerns(form, 'job_search'); toggleFollowUp(form, focusChoicesFor(form)[0])
  setFollowUpNote(form, '还没决定职业方向')
  const restored = restoreDraft(saveDraft(form, 2, 1000), 2000)!
  expect(restored.form).toEqual(form)
  expect(restored.form.stage).toBe('unsure')
  expect(restored.form.life_contexts).toEqual([])
  expect(restored.form.background).toBe('')
  expect(restored.form.constraints).toEqual([])
})

it('retains legacy free writing under its original mainline and rejects malformed drafts', () => {
  const form = { ...newOnboarding(), concerns: ['direction', 'change'], exploration_intent: 'direction', focus_response: '希望工作能留出时间陪家人' }
  selectMainline(form, 'change'); expect(form.focus_response).toBe('')
  selectMainline(form, 'direction'); expect(followUpFor(form).note).toBe('希望工作能留出时间陪家人')
  const draft = saveDraft(form, 1, 1000)
  expect(restoreDraft({ ...draft, form: { ...form, follow_ups: { direction: { selections: 'wrong', note: '' } } } }, 2000)).toBeNull()
})

it('allows an unanswered start and keeps general answers separate from later topics', () => {
  const form = newOnboarding()
  expect(submissionFor(form).concerns).toEqual([])
  expect(submissionFor(form).support_style).toBe('')
  expect(submissionFor(form, 'listen').support_style).toBe('listen')
  setFollowUpNote(form, '想说说最近的一件事')
  expect(submissionFor(form).follow_ups?.general.note).toBe('想说说最近的一件事')
  updateConcerns(form, 'job_search')
  expect(submissionFor(form).follow_ups).not.toHaveProperty('general')
  expect(followUpFor(form).note).toBe('')
})
