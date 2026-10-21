import type { ThemeId } from './themes'
import type { Card } from './domain'
import { editFields } from './pages/index/data'

export interface PageArt { discover: string; plan: string; cards: [string, string, string] }
const image = (name: string) => `/static/bloom/${name}.jpg`
const pageArt: Record<ThemeId, PageArt> = {
  light: { discover: image('mist-lake'), plan: image('mist-reading'), cards: [image('forest-path'), image('reading-corner'), image('lake-reflection')] },
  forest: { discover: image('forest-hero'), plan: image('forest-reading'), cards: [image('forest-path'), image('reading-corner'), image('lake-reflection')] },
  dark: { discover: image('night-scene'), plan: image('night-scene'), cards: [image('night-landscape'), image('night-reading'), image('night-reflection')] },
  dawn: { discover: image('dusk-scene'), plan: image('dusk-scene'), cards: [image('dusk-landscape'), image('dusk-reading'), image('dusk-reflection')] },
  lavender: { discover: image('lavender-scene'), plan: image('lavender-scene'), cards: [image('lavender-landscape'), image('lavender-reading'), image('lavender-reflection')] },
  minimal: { discover: image('minimal-scene'), plan: image('minimal-scene'), cards: [image('minimal-landscape'), image('minimal-reading'), image('minimal-reflection')] },
}
export function resolvePageArt(theme: string): PageArt {
  return pageArt[theme as ThemeId] || pageArt.light
}
export function visibleDecisionFields(card: Card) {
  return editFields.filter(field => card[field.key].length > 0)
}
