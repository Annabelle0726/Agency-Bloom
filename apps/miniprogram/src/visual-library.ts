import manifest from './visual-manifest.json'
import { resolveStoredVisualPath } from './visual-storage'
import { pageArtVisualIds, resolvePageArt } from './page-art'
import { resolveTheme } from './themes'
import type { ThemeId } from './themes'

export type VisualCategory =
  | 'choices'
  | 'connection'
  | 'direction'
  | 'growth'
  | 'reflection'
  | 'rest'
  | 'transition'
export type VisualPage = 'discover' | 'explore' | 'plan' | 'shared' | 'reference-only'
export type VisualRole =
  | 'hero'
  | 'page-background'
  | 'card-thumbnail'
  | 'section-illustration'
  | 'decorative'
  | 'reference-only'

export interface VisualDimensions {
  width: number
  height: number
  aspectRatio: number
}

export interface VisualEntry {
  id: string
  category: VisualCategory
  description: string
  tags: string[]
  mood: string[]
  intendedPage: VisualPage[]
  visualRole: VisualRole[]
  themeCompatibility: ThemeId[]
  source: 'chatgpt-generated' | 'user-supplied-design-reference'
  originalPath: string
  sourceSha256: string
  sourceBytes: number
  dimensions: VisualDimensions
  status: 'deployed' | 'archived' | 'reference-only'
  deploy: boolean
  sourceGroup: string
  runtimeVariants: Partial<Record<ThemeId, string>>
  heroVariants: Partial<Record<ThemeId, string>>
}

export interface ResolvedVisual {
  id: string
  category: VisualCategory
  src: string
  description: string
  theme: ThemeId
  role: VisualRole
}

export interface VisualContext {
  page: VisualPage
  category?: VisualCategory
  tags?: readonly string[]
  /** Soft target for the source aspect ratio; preferred IDs still win. */
  aspect?: number
  preferredIds?: readonly string[]
  excludeSourceGroups?: readonly string[]
}

export interface VisualRequest extends VisualContext {
  role: VisualRole
}

export const visuals = manifest.visuals as unknown as VisualEntry[]
const byId = new Map(visuals.map(visual => [visual.id, visual]))

export function normalizeTheme(theme: string): ThemeId {
  return resolveTheme(theme).id
}

export function getVisual(id: string): VisualEntry | undefined {
  return byId.get(id)
}

export function resolveVisualPath(id: string, theme: string, role: VisualRole = 'card-thumbnail'): string | null {
  const visual = getVisual(id)
  if (!visual || !visual.deploy || visual.status !== 'deployed') return null
  if (!visual.visualRole.includes(role)) return null
  return variantFor(visual, normalizeTheme(theme), role)
}

export function resolveVisual(
  context: VisualContext,
  theme: string,
  role: VisualRole,
  usedVisualIds: readonly string[] = [],
): ResolvedVisual | null {
  const normalized = normalizeTheme(theme)
  const used = new Set(usedVisualIds)
  const usedGroups = new Set(usedVisualIds.map(id => byId.get(id)?.sourceGroup).filter(Boolean))
  const usedSources = new Set(
    usedVisualIds
      .map(id => byId.get(id)?.originalPath)
      .filter((value): value is string => Boolean(value)),
  )
  const excludedGroups = new Set(context.excludeSourceGroups || [])
  const candidates = visuals
    .filter(visual => visual.deploy && visual.status === 'deployed')
    .filter(visual => visual.intendedPage.includes(context.page))
    .filter(visual => visual.visualRole.includes(role))
    .filter(visual => !context.category || visual.category === context.category)
    .filter(visual => visual.themeCompatibility.includes(normalized))
    .filter(visual => Boolean(variantFor(visual, normalized, role)))
    .filter(visual => !used.has(visual.id))
    .filter(visual => !usedSources.has(visual.originalPath))
    .filter(visual => !usedGroups.has(visual.sourceGroup))
    .filter(visual => !excludedGroups.has(visual.sourceGroup))

  const preferred = (context.preferredIds || [])
    .map(id => candidates.find(visual => visual.id === id))
    .find((visual): visual is VisualEntry => Boolean(visual))
  if (preferred) return resolved(preferred, normalized, role)

  const requestedTags = new Set(context.tags || [])
  const requestedAspect = context.aspect && Number.isFinite(context.aspect) && context.aspect > 0
    ? context.aspect
    : null
  const ranked = candidates
    .map(visual => {
      const tagScore = visual.tags.reduce((score, tag) => score + (requestedTags.has(tag) ? 10 : 0), 0)
      const categoryScore = context.category && visual.category === context.category ? 100 : 0
      const themeScore = visual.themeCompatibility.includes(normalized) ? 5 : 0
      const aspectScore = requestedAspect
        ? -Math.abs(visual.dimensions.aspectRatio - requestedAspect) * 10
        : 0
      return { visual, score: categoryScore + tagScore + themeScore + aspectScore }
    })
    .sort((left, right) => right.score - left.score || (left.visual.id < right.visual.id ? -1 : left.visual.id > right.visual.id ? 1 : 0))
  const best = ranked[0]?.visual
  return best ? resolved(best, normalized, role) : null
}

export function resolveVisualSet(
  contexts: readonly VisualRequest[],
  theme: string,
  usedVisualIds: readonly string[] = [],
): Array<ResolvedVisual | null> {
  const used = [...usedVisualIds]
  return contexts.map(context => {
    const result = resolveVisual(context, theme, context.role, used)
    if (result) used.push(result.id)
    return result
  })
}

const discoverPreferences: Record<ThemeId, readonly (string | null)[]> = {
  light: ['window_seat_01', 'forest_path_pink_01', 'sunlit_meadow_path_01'],
  forest: ['sunlit_window_book_01', 'forest_path_green_01', 'bluebell_forest_01'],
  dawn: ['golden_desk_book_01', 'autumn_forest_path_01', 'sunlit_meadow_path_01'],
  lavender: ['window_seat_01', 'forest_path_violet_01', 'bluebell_forest_01'],
  minimal: ['sunlit_window_book_01', 'sunlit_meadow_path_01', 'window_seat_01'],
  dark: ['moonlit_forest_01', 'moonlit_lake_01', null],
}

const explorePreferences: Record<ThemeId, readonly (string | null)[]> = {
  light: ['sunlit_book_desk_01'],
  forest: ['sunlit_book_desk_01'],
  dawn: ['window_seat_01'],
  lavender: ['sunlit_book_desk_01'],
  minimal: ['sunlit_book_desk_01'],
  dark: ['night_lake_reading_01'],
}

const planPreferences: Record<ThemeId, readonly (string | null)[]> = {
  light: ['misty_lake_canoe_01'],
  forest: ['misty_lake_canoe_01'],
  dawn: ['misty_lake_canoe_01'],
  lavender: ['sunlit_window_book_01'],
  minimal: ['misty_lake_canoe_01'],
  dark: ['moonlit_lake_01'],
}

export interface DiscoverVisuals {
  hero: string
  cards: Array<ResolvedVisual | null>
}

export function resolveDiscoverVisuals(theme: string): DiscoverVisuals {
  const normalized = normalizeTheme(theme)
  const art = resolvePageArt(normalized)
  const used = [pageArtVisualIds[normalized].discover]
  const cards = resolveVisualSet(
    discoverPreferences[normalized].map((preferred, index) => ({
      page: 'discover' as const,
      role: 'card-thumbnail' as const,
      preferredIds: preferred ? [preferred] : [],
      tags: index === 0
        ? ['reflection', 'values', 'reading', '辨认意愿']
        : index === 1
          ? ['direction', 'choice', 'possibility', '看见选择']
          : ['growth', 'experience', 'new-beginning', '从体验出发'],
    })),
    normalized,
    used,
  )
  return { hero: art.discover, cards }
}

export function resolveExploreVisual(theme: string): ResolvedVisual | null {
  const normalized = normalizeTheme(theme)
  return resolveVisual({
    page: 'explore',
    preferredIds: explorePreferences[normalized].filter((id): id is string => Boolean(id)),
    tags: ['explore', 'reading', 'pause', 'reflection'],
  }, normalized, 'card-thumbnail')
}

export function resolvePlanVisual(theme: string): ResolvedVisual | null {
  const normalized = normalizeTheme(theme)
  const used = [pageArtVisualIds[normalized].plan]
  return resolveVisual({
    page: 'plan',
    preferredIds: planPreferences[normalized].filter((id): id is string => Boolean(id)),
    tags: ['plan', 'next-step', 'quiet', 'lake', 'reflection'],
  }, normalized, 'card-thumbnail', used)
}

function variantFor(visual: VisualEntry, theme: ThemeId, role: VisualRole): string | null {
  const isHero = role === 'hero' || role === 'page-background'
  const localPath = (isHero ? visual.heroVariants[theme] : visual.runtimeVariants[theme]) || null
  return localPath ? resolveStoredVisualPath(localPath) : null
}

function resolved(visual: VisualEntry, theme: ThemeId, role: VisualRole): ResolvedVisual {
  const src = variantFor(visual, theme, role)
  if (!src) throw new Error(`No ${role} variant for ${visual.id} on ${theme}`)
  return {
    id: visual.id,
    category: visual.category,
    src,
    description: visual.description,
    theme,
    role,
  }
}
