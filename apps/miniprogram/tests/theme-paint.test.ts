import { expect, it } from 'vitest'
import { createThemePaintCache, themeBootstrapScript, THEME_PAINT_KEY } from '../src/theme-paint'
import { themes } from '../src/themes'

const morning = new Date(2026, 9, 24, 8).getTime()
const evening = new Date(2026, 9, 24, 20).getTime()
function setup() {
  const values = new Map<string, unknown>()
  const storage = {
    read: (key: string) => values.get(key),
    write: (key: string, value: unknown) => { values.set(key, value) },
    remove: (key: string) => { values.delete(key) },
  }
  return { values, storage, cache: createThemePaintCache(storage) }
}

it('restores a pinned night palette synchronously without another copy of the session secret', () => {
  const { cache, values, storage } = setup()
  cache.remember('session-a', 'dark', false)
  expect(createThemePaintCache(storage).read('session-a', morning).id).toBe('dark')
  expect(JSON.stringify(values.get(THEME_PAINT_KEY))).not.toContain('session-a')
})

it('does not carry a previous account palette into logout or a new session', () => {
  const { cache, values } = setup()
  cache.remember('session-a', 'dark', false)
  expect(cache.read('', evening).id).toBe('light')
  expect(cache.read('session-b', morning).id).toBe('light')
  cache.clear()
  expect(values.has(THEME_PAINT_KEY)).toBe(false)
})

it('uses the current automatic slot and expires temporary overrides at the real boundary', () => {
  const { cache } = setup()
  cache.remember('session-a', 'lavender', true, new Date(2026, 9, 24, 10).getTime())
  expect(cache.read('session-a', morning).id).toBe('lavender')
  expect(cache.read('session-a', evening).id).toBe('dark')
  cache.remember('session-a', 'dark', true)
  expect(cache.read('session-a', morning).id).toBe('light')
})

it('handles absent, corrupt, or unavailable paint hints without blocking startup', () => {
  const { cache, values } = setup()
  for (const bad of [undefined, '{', 'null', '{}', JSON.stringify({ theme: 'bad' })]) {
    values.set(THEME_PAINT_KEY, bad)
    expect(cache.read('session-a', evening).id).toBe('dark')
  }
  const failing = createThemePaintCache({ read() { throw Error('blocked') }, write() { throw Error('full') }, remove() { throw Error('blocked') } })
  expect(failing.read('', morning).id).toBe('light')
  expect(() => failing.remember('session-a', 'dark', false)).not.toThrow()
  expect(() => failing.clear()).not.toThrow()
})

it('paints the same palette before the H5 application module executes for every theme', () => {
  const { cache, values } = setup()
  for (const theme of themes) {
    cache.remember('session-a', theme.id, false)
    values.set('agency.session', 'session-a')
    const properties: Record<string, string> = {}
    const style = { setProperty: (key: string, value: string) => { properties[key] = value }, backgroundColor: '', colorScheme: '' }
    const document = { documentElement: { style } }
    const localStorage = { getItem: (key: string) => values.get(key) }
    new Function('document', 'localStorage', themeBootstrapScript())(document, localStorage)
    expect(properties['--startup-bg']).toBe(theme.palette.bg)
    expect(properties['--startup-ink']).toBe(theme.palette.ink)
    expect(style.backgroundColor).toBe(theme.palette.bg)
    expect(style.colorScheme).toBe(theme.dark ? 'dark' : 'light')
  }
})
