import { expect, it } from 'vitest'
import { newOnboarding, toggleConcern, reflectionFor, restoreDraft, saveDraft } from '../src/onboarding'

it('keeps unsure exclusive while allowing the first five concerns together', () => {
  expect(toggleConcern(['direction', 'relationships'], 'unsure')).toEqual(['unsure'])
  expect(toggleConcern(['unsure'], 'other')).toEqual(['other'])
  expect(toggleConcern(['direction'], 'overload')).toEqual(['direction', 'overload'])
  expect(toggleConcern(['unsure'], 'unsure')).toEqual([])
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
  expect(reflection).toContain('未来的方向')
  expect(reflection).toContain('先听我说')
  expect(reflection).not.toContain('工作')
  expect(reflection).not.toContain('焦虑型')
})
