import { computed } from 'vue'
import { expect, it } from 'vitest'
import { createManualThemePreference, personalSpaceTheme } from '../src/theme-preference'
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

it('shares automatic theme resolution across the workspace and journey despite stale saved colors', () => {
  const user = { theme: 'dawn' }
  expect(personalSpaceTheme(user, false, 14).id).toBe('forest')
  expect(personalSpaceTheme(user, false, 20).id).toBe('dark')
  expect(personalSpaceTheme(user, true, 14).id).toBe('dawn')
  for (const theme of ['light', 'dark', 'dawn', 'forest', 'lavender', 'minimal']) {
    expect(personalSpaceTheme({ theme }, true, 14).id).toBe(theme)
  }
  expect(personalSpaceTheme(null, false, 14).id).toBe('light')
})
