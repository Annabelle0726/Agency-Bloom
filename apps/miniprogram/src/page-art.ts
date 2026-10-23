import type { ThemeId } from './themes'
import { resolveStoredVisualPath } from './visual-storage'
import type { Card } from './domain'
import { editFields } from './pages/index/data'

export interface PageArt { discover: string; plan: string; cards: [string, string, string] }
export interface PageArtVisualIds { discover: string; plan: string; cards: [string, string, string] }
const image = (name: string) => `/static/bloom/${name}.jpg`
const pageArt: Record<ThemeId, PageArt> = {
  light: { discover: image('mist-lake'), plan: image('mist-reading'), cards: [image('forest-path'), image('reading-corner'), image('lake-reflection')] },
  forest: { discover: image('forest-hero'), plan: image('forest-reading'), cards: [image('forest-path'), image('reading-corner'), image('lake-reflection')] },
  dark: { discover: image('night-scene'), plan: image('night-scene'), cards: [image('night-landscape'), image('night-reading'), image('night-reflection')] },
  dawn: { discover: image('dusk-scene'), plan: image('dusk-scene'), cards: [image('dusk-landscape'), image('dusk-reading'), image('dusk-reflection')] },
  lavender: { discover: image('lavender-scene'), plan: image('lavender-scene'), cards: [image('lavender-landscape'), image('lavender-reading'), image('lavender-reflection')] },
  minimal: { discover: image('minimal-scene'), plan: image('minimal-scene'), cards: [image('minimal-landscape'), image('minimal-reading'), image('minimal-reflection')] },
}
// Source IDs behind the approved legacy page-art paths. The visual resolver
// uses these only to keep a card from repeating its page hero; the legacy
// paths themselves remain unchanged in phase 1.
export const pageArtVisualIds: Record<ThemeId, PageArtVisualIds> = {
  light: {
    discover: 'misty_lake_meadow_01',
    plan: 'window_lake_desk_01',
    cards: ['forest_sunbeam_path_01', 'sunlit_desk_01', 'lakeside_sunset_01'],
  },
  forest: {
    discover: 'forest_sunbeam_path_01',
    plan: 'sunlit_desk_01',
    cards: ['forest_sunbeam_path_01', 'sunlit_desk_01', 'lakeside_sunset_01'],
  },
  dark: {
    discover: 'night_lake_reading_01',
    plan: 'night_lake_reading_01',
    cards: ['night_lake_reading_01', 'night_lake_reading_01', 'night_lake_reading_01'],
  },
  dawn: {
    discover: 'dusk_lake_reading_01',
    plan: 'dusk_lake_reading_01',
    cards: ['dusk_lake_reading_01', 'dusk_lake_reading_01', 'dusk_lake_reading_01'],
  },
  lavender: {
    discover: 'lavender_lake_reading_01',
    plan: 'lavender_lake_reading_01',
    cards: ['lavender_lake_reading_01', 'lavender_lake_reading_01', 'lavender_lake_reading_01'],
  },
  minimal: {
    discover: 'ivory_window_reading_01',
    plan: 'ivory_window_reading_01',
    cards: ['ivory_window_reading_01', 'ivory_window_reading_01', 'ivory_window_reading_01'],
  },
}
export function resolvePageArt(theme: string): PageArt {
  const art = pageArt[theme as ThemeId] || pageArt.light
  return {
    discover: resolveStoredVisualPath(art.discover),
    plan: resolveStoredVisualPath(art.plan),
    cards: art.cards.map(resolveStoredVisualPath) as [string, string, string],
  }
}
export function visibleDecisionFields(card: Card) {
  return editFields.filter(field => card[field.key].length > 0)
}
