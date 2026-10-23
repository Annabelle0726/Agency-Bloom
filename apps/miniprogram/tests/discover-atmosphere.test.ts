import { expect, it } from 'vitest'
import { discoverAtmosphere } from '../src/discover-atmosphere'
import { themes } from '../src/themes'

it('uses a local SVG for each theme, with no external media, scripts or user information', () => {
  const sources = new Set<string>()
  for (const theme of themes) {
    const uri = discoverAtmosphere(theme.id), svg = Buffer.from(uri.split(',')[1], 'base64').toString('utf8')
    expect(svg).toContain(theme.palette.accent); expect(svg).toContain(theme.palette.gold)
    expect(svg).toContain('viewBox="0 0 900 1600"')
    expect(svg).not.toMatch(/<script|<image|foreignObject|https?:\/\/(?!www.w3.org)/)
    expect(Buffer.byteLength(svg)).toBeLessThan(5000)
    expect(discoverAtmosphere(theme.id)).toBe(uri); sources.add(uri)
  }
  expect(sources.size).toBe(6)
  expect(discoverAtmosphere('unknown-theme')).toBe(discoverAtmosphere('light'))
})
