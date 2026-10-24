import { expect, it } from 'vitest'
import { settingsAtmosphere } from '../src/settings-atmosphere'
import { discoverAtmosphere } from '../src/discover-atmosphere'
import { themes } from '../src/themes'

it('provides a small static, local vine drawing in each theme without reusing the Discover leaves', () => {
  const sources = new Set<string>()
  for (const theme of themes) {
    const uri = settingsAtmosphere(theme.id)
    const svg = Buffer.from(uri.split(',')[1], 'base64').toString('utf8')
    expect(uri).toMatch(/^data:image\/svg\+xml;base64,/)
    expect(svg).toContain(theme.palette.accent)
    expect(svg).toContain(theme.palette.gold)
    expect(svg).toContain('viewBox="0 0 900 1600"')
    expect(svg).toContain('fill="none"')
    expect(svg).not.toMatch(/<animate|<script|<style|<image|foreignObject|https?:\/\/(?!www.w3.org)/)
    expect(svg).not.toMatch(/M941-96|M-72 1036/)
    expect(uri).not.toBe(discoverAtmosphere(theme.id))
    expect(Buffer.byteLength(svg)).toBeLessThan(3500)
    expect(settingsAtmosphere(theme.id)).toBe(uri)
    sources.add(uri)
  }
  expect(sources.size).toBe(6)
  expect(settingsAtmosphere('unknown')).toBe(settingsAtmosphere('light'))
})
