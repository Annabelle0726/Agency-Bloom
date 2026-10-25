import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const source = readFileSync(new URL('../src/components/WelcomeOpening.vue', import.meta.url), 'utf8')
const stylesheet = readFileSync(new URL('../src/opening-serif.scss', import.meta.url), 'utf8')
const manifest = JSON.parse(readFileSync(new URL('../../../design/fonts/opening-serif/manifest.json', import.meta.url), 'utf8'))

it('ships a small WOFF without a runtime font download and preserves its recorded integrity', () => {
  const match = stylesheet.match(/data:font\/woff;base64,([A-Za-z0-9+/=]+)/)
  expect(match).toBeTruthy()
  const font = Buffer.from(match![1], 'base64')
  expect(font.subarray(0, 4).toString()).toBe('wOFF')
  expect(font.length).toBeLessThan(40_000)
  expect(font.length).toBe(manifest.woffBytes)
  expect(createHash('sha256').update(font).digest('hex')).toBe(manifest.woffSha256)
  expect(stylesheet).not.toMatch(/url\(['"]?https?:/)
})

it('covers every opening title and closing character so copy edits cannot silently fall back', () => {
  const texts = [...source.matchAll(/title:\s*\[([^\]]+)\]/g)]
    .flatMap(match => [...match[1].matchAll(/'((?:\\.|[^'])*)'/g)].map(item => item[1]))
  texts.push(...[...source.matchAll(/emphasis:\s*'((?:\\.|[^'])*)'/g)].map(match => match[1].replaceAll('\\n', '\n')))
  expect(texts).toHaveLength(15)
  texts.push('给自己一点空间')
  const available = new Set<number>(manifest.codepoints)
  const missing = [...new Set([...texts.join('')].filter(char => char.trim() && !available.has(char.codePointAt(0)!)))]
  expect(missing).toEqual([])
})
