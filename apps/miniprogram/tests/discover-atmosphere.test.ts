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

it('separates the two botanical forms for independent motion without changing their resting composition', () => {
  for (const theme of themes) {
    const decode = (uri: string) => Buffer.from(uri.split(',')[1], 'base64').toString('utf8')
    const petals = decode(discoverAtmosphere(theme.id, 'petals'))
    const leaves = decode(discoverAtmosphere(theme.id, 'leaves'))
    const combined = decode(discoverAtmosphere(theme.id))
    expect(petals).toContain('M941-96')
    expect(petals).not.toContain('M-72 1036')
    expect(leaves).toContain('M-72 1036')
    expect(leaves).not.toContain('M941-96')
    const paths = (svg: string) => svg.match(/<path\b[^>]*\/>/g) || []
    expect([...paths(petals), ...paths(leaves)]).toEqual(paths(combined))
    for (const svg of [petals, leaves]) {
      expect(svg).toContain('viewBox="0 0 900 1600"')
      expect(svg).not.toMatch(/<animate|<script|<image|foreignObject/)
    }
    expect(discoverAtmosphere(theme.id, 'petals')).toBe(discoverAtmosphere(theme.id, 'petals'))
  }
  expect(discoverAtmosphere('unknown', 'leaves')).toBe(discoverAtmosphere('light', 'leaves'))
})

it('deepens the botanical outlines by seven percentage points while preserving theme colors', () => {
  for (const theme of themes) {
    const svg = Buffer.from(discoverAtmosphere(theme.id).split(',')[1], 'base64').toString('utf8')
    const opacity = [...svg.matchAll(/<g\s[^>]*stroke-opacity="([\d.]+)"/g)].map(match => Number(match[1]))
    expect(opacity).toHaveLength(2)
    expect(opacity[0] - (theme.dark ? .085 : .065)).toBeCloseTo(.07)
    expect(opacity[1] - .065).toBeCloseTo(.07)
  }
})
