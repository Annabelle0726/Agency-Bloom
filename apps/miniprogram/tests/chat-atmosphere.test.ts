import { expect, it } from 'vitest'
import { chatAtmosphere } from '../src/chat-atmosphere'
import { themes } from '../src/themes'

it('keeps complete static contours inside the canvas for every theme', () => {
  const sources = new Set<string>()
  for (const theme of themes) {
    const uri = chatAtmosphere(theme.id)
    const svg = Buffer.from(uri.split(',')[1], 'base64').toString('utf8')
    expect(svg).toContain(theme.palette.accent)
    expect(svg).not.toMatch(/<animate|<script|<image|foreignObject|https?:\/\/(?!www.w3.org)/)
    expect(Buffer.byteLength(svg)).toBeLessThan(3500)
    // These paths use absolute M/C coordinates, including the full control hull.
    for (const path of svg.matchAll(/<path d="([^"]+)"/g)) {
      const values = (path[1].match(/-?\d+(?:\.\d+)?/g) || []).map(Number)
      for (let i = 0; i < values.length; i += 2) {
        expect(values[i]).toBeGreaterThan(12)
        expect(values[i]).toBeLessThan(888)
        expect(values[i + 1]).toBeGreaterThan(12)
        expect(values[i + 1]).toBeLessThan(1588)
      }
    }
    expect(chatAtmosphere(theme.id)).toBe(uri)
    sources.add(uri)
  }
  expect(sources.size).toBe(6)
  expect(chatAtmosphere('unknown')).toBe(chatAtmosphere('light'))
})
