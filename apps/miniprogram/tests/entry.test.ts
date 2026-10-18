import { expect, it } from 'vitest'
import { initialScreen, signedInScreen, questionStep, draftKeyFor, pauseKeyFor } from '../src/entry'
import { newOnboarding, saveDraft, restoreDraft } from '../src/onboarding'

it('waits for session restoration instead of flashing the opening or questions', () => {
  expect(initialScreen(true, false)).toBe('restore')
  expect(initialScreen(true, true)).toBe('restore')
})
it('shows the opening once to visitors and sends returning visitors to authentication', () => {
  expect(initialScreen(false, false)).toBe('opening')
  expect(initialScreen(false, true)).toBe('auth')
})
it('asks new accounts questions after authentication and respects a pause', () => {
  expect(signedInScreen(false, false, false)).toBe('onboard')
  expect(signedInScreen(false, false, true)).toBe('space')
})
it('restores existing accounts even when all their explorations were ended', () => {
  expect(signedInScreen(true, false, false)).toBe('space')
  expect(signedInScreen(false, true, false)).toBe('space')
})
it('isolates drafts and pause preferences by account', () => {
  const storage = new Map()
  storage.set(draftKeyFor('account-a'), saveDraft({ ...newOnboarding(), title: '我的问题' }, 2))
  storage.set(pauseKeyFor('account-a'), true)
  expect(restoreDraft(storage.get(draftKeyFor('account-b')))).toBeNull()
  expect(storage.get(pauseKeyFor('account-b'))).toBeUndefined()
  expect(restoreDraft(storage.get(draftKeyFor('account-a')))?.step).toBe(2)
})
it('resumes old login/guest drafts at review instead of reopening authentication', () => {
  for (const oldStep of [5, 6]) expect(questionStep(oldStep)).toBe(4)
  for (const oldStep of [-1, undefined, NaN]) expect(questionStep(oldStep)).toBe(0)
  expect(questionStep(2)).toBe(2)
})
