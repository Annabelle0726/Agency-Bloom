import { resolveTheme, themeByTimeOfDay, themeForSession } from './themes'
import { ref } from 'vue'
interface PreferenceStorage { read: (key: string) => unknown; write: (key: string, value: boolean) => void }
export function createManualThemePreference(storage: PreferenceStorage) {
  const revision = ref(0)
  const chosen = new Set<string>()
  const key = (id: string) => `agency.theme.manual.v1:${id}`
  return {
    isChosen(id: string) {
      revision.value
      if (chosen.has(id)) return true
      try { return !!storage.read(key(id)) } catch { return true }
    },
    markChosen(id: string) {
      try { storage.write(key(id), true) } catch { /* Keep the current session's explicit choice. */ }
      chosen.add(id)
      revision.value += 1
    },
  }
}

/** One policy for the root workspace and every authenticated subpage. */
export function personalSpaceTheme(user: { theme: string } | null, manuallyChosen: boolean, hour: number) {
  if (!user || manuallyChosen) return themeForSession(user, true)
  return resolveTheme(themeByTimeOfDay(hour))
}
