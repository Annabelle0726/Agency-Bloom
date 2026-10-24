import { ref } from 'vue'
import { resolveTheme, themeByTimeOfDay, themes } from './themes'
import type { ThemeDefinition, ThemeId } from './themes'

const BOUNDARY_HOURS = [5, 10, 16, 19] as const

export interface ThemeSlot {
  /** Local start of the slot. The night slot keeps its previous-day 19:00 key across midnight. */
  key: string
  theme: ThemeId
  start: number
  end: number
}

function localBoundary(base: Date, dayOffset: number, hour: number) {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, hour, 0, 0, 0).getTime()
}

function slotKey(start: number) {
  const date = new Date(start)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}`
}

/** Resolve the current local theme slot from the four daily boundaries. */
export function themeSlotAt(now: number): ThemeSlot {
  const time = Number.isFinite(now) ? now : Date.now()
  const base = new Date(time)
  const today = BOUNDARY_HOURS.map(hour => localBoundary(base, 0, hour))
  const passed = today.filter(boundary => boundary <= time)
  const start = time < today[0]
    // 00:00-04:59 still belongs to the previous evening's quiet-night slot.
    ? localBoundary(base, -1, 19)
    : passed[passed.length - 1]
  const end = today.find(boundary => boundary > time) ?? localBoundary(base, 1, 5)
  const startDate = new Date(start)
  return {
    key: slotKey(start),
    theme: themeByTimeOfDay(startDate.getHours()),
    start,
    end,
  }
}

/** The next automatic boundary. Midnight itself is not a boundary. */
export function nextThemeBoundary(now: number) {
  return themeSlotAt(now).end
}

export function formatThemeBoundary(timestamp: number) {
  const date = new Date(timestamp)
  return `${String(date.getHours()).padStart(2, '0')}:00`
}

export interface PreferenceStorage {
  read: (key: string) => unknown
  write: (key: string, value: unknown) => void
  remove?: (key: string) => void
}

interface StoredOverride {
  theme: ThemeId
  slot: string
}

const themeIds = new Set<string>(themes.map(theme => theme.id))
const autoKey = (id: string) => `agency.theme.auto.v1:${id}`
const overrideKey = (id: string) => `agency.theme.override.v1:${id}`
// Kept only for one-time migration: the old flag meant "do not auto switch again".
const legacyManualKey = (id: string) => `agency.theme.manual.v1:${id}`

function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && themeIds.has(value)
}

function parseOverride(value: unknown): StoredOverride | null {
  if (!value || typeof value !== 'object') return null
  const record = value as { theme?: unknown; slot?: unknown }
  if (!isThemeId(record.theme) || typeof record.slot !== 'string' || !record.slot) return null
  return { theme: record.theme, slot: record.slot }
}

export function createThemePreference(storage: PreferenceStorage) {
  const revision = ref(0)
  const autoById = new Map<string, boolean>()
  const overrideById = new Map<string, StoredOverride | null>()

  function readOverride(id: string): StoredOverride | null {
    if (overrideById.has(id)) return overrideById.get(id) ?? null
    let value: StoredOverride | null = null
    try { value = parseOverride(storage.read(overrideKey(id))) } catch { /* Treat unreadable state as no override. */ }
    overrideById.set(id, value)
    return value
  }

  function clearOverrideValue(id: string) {
    try {
      if (storage.remove) storage.remove(overrideKey(id))
      else storage.write(overrideKey(id), null)
    } catch { /* Keep the in-memory state. */ }
    overrideById.set(id, null)
  }

  function clearOverride(id: string) {
    if (!id) return
    clearOverrideValue(id)
    revision.value += 1
  }

  return {
    isAuto(id: string) {
      revision.value
      if (!id) return true
      const cached = autoById.get(id)
      if (cached !== undefined) return cached
      let enabled = true
      try {
        const stored = storage.read(autoKey(id))
        if (stored === false) enabled = false
        else if (stored === true) enabled = true
        // Existing accounts that explicitly stopped auto switching keep their choice.
        else if (storage.read(legacyManualKey(id))) enabled = false
      } catch { /* Default on when there is no readable preference. */ }
      autoById.set(id, enabled)
      return enabled
    },
    overrideFor(id: string, slot: string) {
      revision.value
      if (!id) return null
      const stored = readOverride(id)
      return stored && stored.slot === slot ? stored.theme : null
    },
    setAuto(id: string, enabled: boolean) {
      if (!id) return
      try { storage.write(autoKey(id), enabled) } catch { /* Keep the current session's choice. */ }
      if (enabled) {
        try { storage.remove?.(legacyManualKey(id)) } catch { /* The new explicit flag already wins. */ }
      }
      clearOverrideValue(id)
      autoById.set(id, enabled)
      revision.value += 1
    },
    setOverride(id: string, theme: ThemeId, slot: string) {
      if (!id) return
      const value = { theme, slot }
      try { storage.write(overrideKey(id), value) } catch { /* Keep the override for this session. */ }
      overrideById.set(id, value)
      revision.value += 1
    },
    clearOverride,
    pruneOverride(id: string, slot: string) {
      if (!id) return
      const stored = readOverride(id)
      if (stored && stored.slot !== slot) clearOverride(id)
    },
  }
}

export interface PersonalThemeOptions {
  auto: boolean
  overrideTheme?: ThemeId | null
  slot: Pick<ThemeSlot, 'theme'>
}

/** One policy for the root workspace and every authenticated subpage. */
export function personalSpaceTheme(user: { theme: string } | null, options: PersonalThemeOptions): ThemeDefinition {
  if (!user) return resolveTheme('light')
  if (!options.auto) return resolveTheme(user.theme)
  return resolveTheme(options.overrideTheme || options.slot.theme)
}
