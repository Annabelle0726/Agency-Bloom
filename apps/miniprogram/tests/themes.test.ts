import { expect, it } from 'vitest'
import { existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { themes, navigationItems, resolveTheme, themeForSession, themeStyle, themeNavSvg, themeByTimeOfDay } from '../src/themes'

it('offers six distinct reference images and keeps the original saved theme ids', () => {
  expect(themes.map(theme => theme.id)).toEqual(['light', 'dark', 'dawn', 'forest', 'lavender', 'minimal'])
  expect(new Set(themes.map(theme => theme.preview)).size).toBe(6)
  expect(resolveTheme('light').name).toBe('晨雾')
  expect(resolveTheme('dark').name).toBe('深夜')
  for (const theme of themes) {
    for (const asset of [theme.preview, theme.image]) {
      const file = fileURLToPath(new URL('../src' + asset, import.meta.url))
      expect(existsSync(file), asset).toBe(true)
      expect(statSync(file).size).toBeLessThan(160_000)
    }
  }
})

it('always uses Morning Mist outside an authenticated personal space', () => {
  expect(themeForSession({ theme: 'lavender' }, true).id).toBe('lavender')
  expect(themeForSession({ theme: 'dark' }, false).id).toBe('light')
  expect(themeForSession(null, true).id).toBe('light')
  expect(resolveTheme('unknown-old-value').id).toBe('light')
})

it('maps the day into themes: mist mornings, smoke dusk, quiet nights, forest days', () => {
  expect(themeByTimeOfDay(5)).toBe('light')
  expect(themeByTimeOfDay(9)).toBe('light')
  expect(themeByTimeOfDay(10)).toBe('forest')
  expect(themeByTimeOfDay(15)).toBe('forest')
  expect(themeByTimeOfDay(16)).toBe('dawn')
  expect(themeByTimeOfDay(18)).toBe('dawn')
  expect(themeByTimeOfDay(19)).toBe('dark')
  expect(themeByTimeOfDay(23)).toBe('dark')
  expect(themeByTimeOfDay(0)).toBe('dark')
  expect(themeByTimeOfDay(4)).toBe('dark')
  // hour wraps: 24 means midnight, so does 0
  expect(themeByTimeOfDay(24)).toBe('dark')
  expect(themeByTimeOfDay(-1)).toBe('dark')
})

function luminance(hex: string) {
  const rgb = hex.slice(1).match(/../g)!.map(channel => parseInt(channel, 16) / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722
}
function contrast(a: string, b: string) {
  const l = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l[0] + .05) / (l[1] + .05)
}
it('keeps body, muted text and button labels readable in every palette', () => {
  for (const theme of themes) {
    const style = themeStyle(theme)
    for (const [text, background] of [['--ink', '--bg'], ['--ink', '--paper'], ['--muted', '--paper']]) {
      expect(contrast(style[text], style[background]), theme.id + text).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrast('#ffffff', style['--button-fill']), theme.id + ' button').toBeGreaterThanOrEqual(4.5)
    expect(themeNavSvg(theme, 'now', true)).toContain(style['--accent'])
    expect(themeNavSvg(theme, 'chat', false)).toContain('#ffffff')
  }
})


it('provides five distinct themed navigation destinations and complete surface tokens', () => {
  expect(navigationItems.map(item => item.id)).toEqual(['now', 'plan', 'chat', 'discover', 'settings'])
  for (const theme of themes) {
    const style = themeStyle(theme)
    for (const token of ['--surface-glass', '--nav-glass', '--hero-top', '--nav-start', '--nav-end']) expect(style[token]).toBeTruthy()
    for (const item of navigationItems) expect(themeNavSvg(theme, item.id, true)).toContain('<svg')
    expect(themeNavSvg(theme, 'now', true)).toContain('fill="' + theme.palette.accent + '"')
    expect(themeNavSvg(theme, 'now', false)).toContain('fill="none"')
  }
})
