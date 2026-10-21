import { computed } from 'vue'
import { expect, it } from 'vitest'
import { createManualThemePreference } from '../src/theme-preference'
it('invalidates the displayed auto theme immediately after a manual choice and restores per account', () => {
  const storage = new Map<string, boolean>()
  const preference = createManualThemePreference({
    read: key => storage.get(key),
    write: (key, value) => { storage.set(key, value) },
  })
  const displayed = computed(() => preference.isChosen('account-a') ? 'light' : 'forest')
  expect(displayed.value).toBe('forest')
  preference.markChosen('account-a')
  expect(displayed.value).toBe('light')
  expect(preference.isChosen('account-b')).toBe(false)
  const restored = createManualThemePreference({ read: key => storage.get(key), write: () => {} })
  expect(restored.isChosen('account-a')).toBe(true)
})
it('keeps a successful manual choice in the current session if local storage is unavailable', () => {
  const preference = createManualThemePreference({ read: () => false, write: () => { throw Error('storage full') } })
  expect(preference.isChosen('a')).toBe(false)
  preference.markChosen('a')
  expect(preference.isChosen('a')).toBe(true)
  expect(preference.isChosen('b')).toBe(false)
})
