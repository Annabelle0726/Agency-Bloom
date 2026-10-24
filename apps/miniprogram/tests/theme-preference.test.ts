import { computed } from 'vue'
import { expect, it } from 'vitest'
import { createThemePreference, personalSpaceTheme } from '../src/theme-preference'
import type { ThemeSlot } from '../src/theme-preference'

function memoryStorage() {
  const data = new Map<string, unknown>()
  return {
    data,
    storage: {
      read: (key: string) => data.get(key),
      write: (key: string, value: unknown) => { data.set(key, value) },
      remove: (key: string) => { data.delete(key) },
    },
  }
}

const slot = (theme: ThemeSlot['theme'], key = '2026-10-24T10'): ThemeSlot => ({
  key,
  theme,
  start: 0,
  end: 0,
})

it('defaults to auto switching per account and persists an explicit off choice', () => {
  const { storage } = memoryStorage()
  const preference = createThemePreference(storage)
  expect(preference.isAuto('account-a')).toBe(true)
  expect(preference.isAuto('account-b')).toBe(true)

  preference.setAuto('account-a', false)
  expect(preference.isAuto('account-a')).toBe(false)
  expect(preference.isAuto('account-b')).toBe(true)

  const restored = createThemePreference(storage)
  expect(restored.isAuto('account-a')).toBe(false)
  expect(restored.isAuto('account-b')).toBe(true)
})

it('migrates the old permanent manual flag to a long-term manual choice', () => {
  const { data, storage } = memoryStorage()
  data.set('agency.theme.manual.v1:account-a', true)
  const preference = createThemePreference(storage)
  expect(preference.isAuto('account-a')).toBe(false)
  expect(preference.isAuto('account-b')).toBe(true)

  preference.setAuto('account-a', true)
  expect(data.has('agency.theme.manual.v1:account-a')).toBe(false)
  expect(createThemePreference(storage).isAuto('account-a')).toBe(true)
})

it('keeps a manual override only for its slot and across a restart', () => {
  const { data, storage } = memoryStorage()
  const current = slot('forest', '2026-10-24T10')
  const next = slot('dawn', '2026-10-24T16')
  const preference = createThemePreference(storage)

  preference.setOverride('account-a', 'lavender', current.key)
  expect(preference.overrideFor('account-a', current.key)).toBe('lavender')
  expect(preference.overrideFor('account-a', next.key)).toBeNull()
  expect(preference.overrideFor('account-b', current.key)).toBeNull()

  const restored = createThemePreference(storage)
  expect(restored.overrideFor('account-a', current.key)).toBe('lavender')
  restored.pruneOverride('account-a', next.key)
  expect(restored.overrideFor('account-a', current.key)).toBeNull()
  expect(data.has('agency.theme.override.v1:account-a')).toBe(false)
})

it('turning automatic switching off clears the slot override', () => {
  const { storage } = memoryStorage()
  const preference = createThemePreference(storage)
  preference.setOverride('account-a', 'dark', '2026-10-24T19')
  expect(preference.overrideFor('account-a', '2026-10-24T19')).toBe('dark')

  preference.setAuto('account-a', false)
  expect(preference.isAuto('account-a')).toBe(false)
  expect(preference.overrideFor('account-a', '2026-10-24T19')).toBeNull()
})

it('updates a read-only preference computed immediately after a toggle', () => {
  const { storage } = memoryStorage()
  const preference = createThemePreference(storage)
  const mode = computed(() => preference.isAuto('account-a') ? 'auto' : 'manual')
  expect(mode.value).toBe('auto')
  preference.setAuto('account-a', false)
  expect(mode.value).toBe('manual')
  preference.setAuto('account-a', true)
  expect(mode.value).toBe('auto')
})

it('keeps session choices when local storage is unavailable', () => {
  const preference = createThemePreference({
    read: () => { throw Error('storage unavailable') },
    write: () => { throw Error('storage full') },
  })
  expect(preference.isAuto('account-a')).toBe(true)
  preference.setAuto('account-a', false)
  expect(preference.isAuto('account-a')).toBe(false)
  preference.setOverride('account-a', 'minimal', '2026-10-24T16')
  expect(preference.overrideFor('account-a', '2026-10-24T16')).toBe('minimal')
  preference.setAuto('account-a', true)
  expect(preference.overrideFor('account-a', '2026-10-24T16')).toBeNull()
})

it('shares auto, override and long-term resolution across the workspace and journey', () => {
  const current = slot('forest', '2026-10-24T10')
  const next = slot('dawn', '2026-10-24T16')
  const { storage } = memoryStorage()
  const preference = createThemePreference(storage)
  preference.setOverride('account-a', 'lavender', current.key)

  expect(personalSpaceTheme(null, { auto: true, slot: current }).id).toBe('light')
  expect(personalSpaceTheme({ theme: 'dawn' }, { auto: true, slot: current }).id).toBe('forest')
  expect(personalSpaceTheme({
    theme: 'dawn',
  }, {
    auto: true,
    overrideTheme: preference.overrideFor('account-a', current.key),
    slot: current,
  }).id).toBe('lavender')
  expect(personalSpaceTheme({
    theme: 'dawn',
  }, {
    auto: true,
    overrideTheme: preference.overrideFor('account-a', next.key),
    slot: next,
  }).id).toBe('dawn')
  expect(personalSpaceTheme({ theme: 'dawn' }, { auto: false, slot: current }).id).toBe('dawn')
  expect(personalSpaceTheme({ theme: 'unknown-old-value' }, { auto: false, slot: current }).id).toBe('light')
})
