import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { themes, navigationItems, resolveTheme, themeForSession, themeStyle, themeNavSvg, themeByTimeOfDay } from '../src/themes'

it('offers six distinct reference images and keeps the original saved theme ids', () => {
  expect(themes.map(theme => theme.id)).toEqual(['light', 'dark', 'dawn', 'forest', 'lavender', 'minimal'])
  expect(new Set(themes.map(theme => theme.preview)).size).toBe(6)
  expect(resolveTheme('light').name).toBe('晨雾')
  expect(resolveTheme('dark').name).toBe('深夜')
  for (const theme of themes) {
    for (const asset of [theme.preview, theme.image]) {
      const archive = JSON.parse(readFileSync(new URL('../../../assets/visual-library/source-archive.json', import.meta.url), 'utf8'))
      expect(archive.objects.some((o: {url:string;verifiedAt:string}) => o.url === asset && !!o.verifiedAt)).toBe(true)
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
it('keeps compact action labels readable on their soft theme background', () => {
  for (const theme of themes) {
    const style = themeStyle(theme)
    expect(contrast(style['--action-text'] || style['--accent'], style['--soft']), theme.id + ' soft action label').toBeGreaterThanOrEqual(4.5)
  }
})
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


it('keeps tag surfaces, borders and check marks legible in every palette', () => {
  for (const theme of themes) {
    const style = themeStyle(theme)
    for (const token of ['--tag-surface', '--tag-surface-pressed', '--tag-surface-selected', '--tag-border',
      '--tag-border-pressed', '--tag-border-selected', '--tag-ink', '--tag-check-bg', '--tag-check-ink', '--tag-focus-ring', '--tag-shadow']) {
      expect(style[token], theme.id + token).toBeTruthy()
    }
    expect(contrast(style['--tag-ink'], style['--tag-surface']), theme.id + ' tag ink').toBeGreaterThanOrEqual(4.5)
    expect(contrast(style['--tag-ink'], style['--tag-surface-selected']), theme.id + ' selected tag ink').toBeGreaterThanOrEqual(4.5)
    expect(contrast(style['--tag-check-ink'], style['--tag-check-bg']), theme.id + ' tag check').toBeGreaterThanOrEqual(3)
    expect(style['--tag-border-selected']).toBe(theme.palette.accent)
    expect(style['--tag-surface']).not.toBe(style['--tag-surface-selected'])
  }
})

it('keeps quiet onboarding cards restrained but legible in every palette', () => {
  for (const theme of themes) {
    const style = themeStyle(theme)
    for (const token of ['--quiet-surface', '--quiet-surface-pressed', '--quiet-surface-selected',
      '--quiet-border', '--quiet-border-selected', '--quiet-title', '--quiet-detail', '--quiet-tile',
      '--quiet-tile-selected', '--quiet-control', '--quiet-check', '--quiet-check-ink', '--quiet-shadow',
      '--cta-fill', '--cta-highlight', '--cta-deep', '--cta-ink', '--cta-border', '--cta-pressed-border',
      '--cta-disabled', '--cta-shadow', '--cta-pressed-shadow',
      '--onboarding-wash-top', '--onboarding-wash-mid', '--onboarding-wash-bottom']) {
      expect(style[token], theme.id + token).toBeTruthy()
    }
    expect(contrast(style['--quiet-title'], style['--quiet-surface']), theme.id + ' quiet title').toBeGreaterThanOrEqual(4.5)
    expect(contrast(style['--quiet-detail'], style['--quiet-surface']), theme.id + ' quiet detail').toBeGreaterThanOrEqual(4.5)
    expect(contrast(style['--quiet-title'], style['--quiet-surface-selected']), theme.id + ' selected title').toBeGreaterThanOrEqual(4.5)
    expect(contrast(style['--quiet-detail'], style['--quiet-surface-selected']), theme.id + ' selected detail').toBeGreaterThanOrEqual(4.5)
    expect(contrast(style['--quiet-check-ink'], style['--quiet-check']), theme.id + ' quiet check').toBeGreaterThanOrEqual(3)
    expect(contrast(style['--cta-ink'], style['--cta-fill']), theme.id + ' quiet cta').toBeGreaterThanOrEqual(4.5)
    expect(contrast(style['--cta-ink'], style['--cta-highlight']), theme.id + ' cta highlight').toBeGreaterThanOrEqual(4.5)
    expect(contrast(style['--cta-ink'], style['--cta-deep']), theme.id + ' cta deep').toBeGreaterThanOrEqual(4.5)
    expect(style['--quiet-surface']).not.toBe(style['--quiet-surface-selected'])
    expect(style['--quiet-tile']).not.toBe(style['--quiet-tile-selected'])
    expect(style['--cta-highlight']).not.toBe(style['--cta-deep'])
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
