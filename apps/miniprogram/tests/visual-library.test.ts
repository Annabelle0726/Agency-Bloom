import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { themes } from '../src/themes'
import { pageArtVisualIds } from '../src/page-art'
import {
  getVisual,
  resolveDiscoverVisuals,
  resolveExploreVisual,
  resolvePlanVisual,
  resolveVisual,
  resolveVisualPath,
  visuals,
} from '../src/visual-library'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const manifestFile = path.join(root, 'assets/visual-manifest.json')
const runtimeManifestFile = path.join(root, 'apps/miniprogram/src/visual-manifest.json')
const referenceDir = path.join(root, 'design/themes/references')
const referenceHashes: Record<string, string> = {
  'dawn.jpg': '87a53e63c9aca67fb70bfc38f09166a33b8231fed0fcdb83152c6326e264914c',
  'forest.jpg': 'c3941575581faf2984c9c87df33cc8de7db50a058226ae078434e1820073c55f',
  'lavender.jpg': 'da0e225a3e06d4548b96dd0d44c1403037c1ea2bb3cc17c11221d9af415bb49b',
  'minimal.jpg': '19cc1f4be7756c6a6e45c574a9f44a0a690d728aa0efd9b7c5b0b60be72b5733',
  'mist.png': '2c22ccfb33ea549297714b12bf19ecdbf678f09debd50f3ce887a270038091db',
  'night.jpg': '4413c84833bb8ad61eb0c484e476919578dff2d814be12754906b0e40cf26dda',
}

function sha256(file: string) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}
function runtimeFile(src: string) {
  return path.join(root, 'apps/miniprogram/src', src.replace(/^\//, ''))
}

describe('visual library contract', () => {
  it('keeps one stable record for every original and mirrors the canonical manifest', () => {
    expect(visuals).toHaveLength(28)
    expect(new Set(visuals.map(visual => visual.id)).size).toBe(28)
    expect(new Set(visuals.map(visual => visual.originalPath)).size).toBe(28)
    expect(readFileSync(runtimeManifestFile).equals(readFileSync(manifestFile))).toBe(true)
    expect(visuals.filter(visual => visual.status === 'deployed')).toHaveLength(22)
    expect(visuals.filter(visual => visual.status === 'archived')).toHaveLength(5)
    expect(visuals.filter(visual => visual.status === 'reference-only')).toHaveLength(1)
  })

  it('references only real originals and deployed runtime files with the recorded hashes', () => {
    for (const visual of visuals) {
      const source = path.join(root, visual.originalPath)
      expect(existsSync(source), visual.originalPath).toBe(true)
      expect(statSync(source).size, visual.id).toBe(visual.sourceBytes)
      expect(sha256(source), visual.id).toBe(visual.sourceSha256)
      for (const src of [...Object.values(visual.runtimeVariants), ...Object.values(visual.heroVariants)]) {
        expect(existsSync(runtimeFile(src)), src).toBe(true)
      }
      if (visual.status !== 'deployed') {
        expect(Object.keys(visual.runtimeVariants), visual.id).toHaveLength(0)
        expect(Object.keys(visual.heroVariants), visual.id).toHaveLength(0)
      }
    }
  })

  it('keeps the six frozen theme references byte-identical', () => {
    expect(Object.keys(referenceHashes).sort()).toEqual(
      ['dawn.jpg', 'forest.jpg', 'lavender.jpg', 'minimal.jpg', 'mist.png', 'night.jpg'].sort(),
    )
    for (const [name, expected] of Object.entries(referenceHashes)) {
      const file = path.join(referenceDir, name)
      expect(existsSync(file), name).toBe(true)
      expect(sha256(file), name).toBe(expected)
    }
  })
})

describe('local visual resolver', () => {
  it('is deterministic for the same request and theme', () => {
    for (const theme of themes) {
      expect(resolveDiscoverVisuals(theme.id)).toEqual(resolveDiscoverVisuals(theme.id))
      expect(resolvePlanVisual(theme.id)).toEqual(resolvePlanVisual(theme.id))
      expect(resolveExploreVisual(theme.id)).toEqual(resolveExploreVisual(theme.id))
    }
  })

  it('uses an aspect preference as a deterministic soft ranking signal', () => {
    expect(resolveVisual({ page: 'discover', category: 'direction' }, 'dawn', 'card-thumbnail')?.id).toBe('autumn_forest_path_01')
    expect(resolveVisual({ page: 'discover', category: 'direction', aspect: 1.45 }, 'dawn', 'card-thumbnail')?.id).toBe('sunlit_meadow_path_01')
  })

  it('keeps every page free of repeated images and hero/card duplicates', () => {
    for (const theme of themes) {
      const discover = resolveDiscoverVisuals(theme.id)
      const cards = discover.cards.filter((card): card is NonNullable<typeof card> => Boolean(card))
      const ids = cards.map(card => card.id)
      const sources = cards.map(card => getVisual(card.id)?.originalPath)
      const groups = cards.map(card => getVisual(card.id)?.sourceGroup)
      expect(new Set(ids).size, theme.id).toBe(ids.length)
      expect(new Set(sources).size, theme.id).toBe(sources.length)
      expect(new Set(groups).size, theme.id).toBe(groups.length)
      expect(ids).not.toContain(pageArtVisualIds[theme.id].discover)
      expect(cards.length, theme.id).toBeGreaterThanOrEqual(theme.id === 'dark' ? 2 : 3)

      const plan = resolvePlanVisual(theme.id)
      expect(plan, theme.id).not.toBeNull()
      expect(plan!.id, theme.id).not.toBe(pageArtVisualIds[theme.id].plan)
      expect(getVisual(plan!.id)?.originalPath, theme.id).not.toBe(getVisual(pageArtVisualIds[theme.id].plan)?.originalPath)

      const explore = resolveExploreVisual(theme.id)
      expect(explore, theme.id).not.toBeNull()
      for (const src of [discover.hero, ...cards.map(card => card.src), plan!.src, explore!.src]) {
        expect(existsSync(runtimeFile(src)), `${theme.id}: ${src}`).toBe(true)
      }
    }
  })

  it('uses a text-only third discovery card when the night pool is exhausted', () => {
    const dark = resolveDiscoverVisuals('dark')
    expect(dark.cards.filter(Boolean)).toHaveLength(2)
    expect(dark.cards[2]).toBeNull()
  })

  it('prefers distinct visual sets across pages for daylight themes', () => {
    for (const theme of themes.filter(theme => theme.id !== 'dark')) {
      const discover = resolveDiscoverVisuals(theme.id)
      const ids = new Set(discover.cards.filter(Boolean).map(card => card!.id))
      ids.add(resolvePlanVisual(theme.id)!.id)
      ids.add(resolveExploreVisual(theme.id)!.id)
      expect(ids.size, theme.id).toBe(discover.cards.filter(Boolean).length + 2)
    }
  })

  it('falls back lawfully when a preferred visual is missing or the pool is exhausted', () => {
    expect(resolveVisual({ page: 'discover', preferredIds: ['missing'], tags: ['reflection'] }, 'light', 'card-thumbnail')).not.toBeNull()
    expect(resolveVisualPath('missing', 'light')).toBeNull()
    expect(resolveVisualPath('moonlit_lake_01', 'light')).toBeNull()
    const darkIds = visuals
      .filter(visual => visual.themeCompatibility.includes('dark') && Object.keys(visual.runtimeVariants).length > 0)
      .map(visual => visual.id)
    expect(resolveVisual({ page: 'discover' }, 'dark', 'card-thumbnail', darkIds)).toBeNull()
  })

  it('switches paths without changing the visual id or making a model request', () => {
    const lightPath = resolveVisualPath('misty_lake_canoe_01', 'light')
    const dawnPath = resolveVisualPath('misty_lake_canoe_01', 'dawn')
    expect(lightPath).toBe(dawnPath)
    expect(resolveVisualPath('sunlit_book_desk_01', 'light')).toBe(resolveVisualPath('sunlit_book_desk_01', 'lavender'))
    const source = readFileSync(path.join(root, 'apps/miniprogram/src/visual-library.ts'), 'utf8')
    expect(source).not.toMatch(/fetch\(|deepseek|https?:\/\//i)
  })
})
