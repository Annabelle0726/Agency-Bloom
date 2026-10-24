import { resolveTheme, themeByTimeOfDay, themes } from './themes'
import type { ThemeId } from './themes'
import type { PreferenceStorage } from './theme-preference'

export const THEME_PAINT_KEY = 'agency.theme.paint.v1'

// A paint hint is scoped to the existing session; it never contains a credential
// and is never used to decide whether someone is authenticated.
function sessionTag(session: string) {
  if (!session) return ''
  let hash = 2166136261
  for (let index = 0; index < session.length; index++) {
    hash = Math.imul(hash ^ session.charCodeAt(index), 16777619)
  }
  return session.length + ':' + (hash >>> 0).toString(16)
}

// Keep these functions self-contained: the H5 head uses the exact same policy
// before loading Vue, CSS, or account data.
function paintThemeId(raw: unknown, tag: string, scheduled: ThemeId, now: number, ids: string[]): ThemeId {
  if (!tag) return 'light'
  try {
    const hint = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!hint || hint.session !== tag || !ids.includes(hint.theme)
      || typeof hint.auto !== 'boolean' || !Number.isFinite(hint.overrideUntil)) return scheduled
    return !hint.auto || now < hint.overrideUntil ? hint.theme : scheduled
  } catch { return scheduled }
}

export function createThemePaintCache(storage: PreferenceStorage) {
  return {
    read(session: string, now = Date.now()) {
      let raw: unknown
      try { raw = storage.read(THEME_PAINT_KEY) } catch { /* Use the local time slot. */ }
      return resolveTheme(paintThemeId(raw, sessionTag(session), themeByTimeOfDay(new Date(now).getHours()), now, themes.map(theme => theme.id)))
    },
    remember(session: string, theme: ThemeId, auto: boolean, overrideUntil = 0) {
      if (!session) return
      try { storage.write(THEME_PAINT_KEY, JSON.stringify({ session: sessionTag(session), theme, auto, overrideUntil })) }
      catch { /* Painting must still work when local storage is unavailable. */ }
    },
    clear() {
      try { storage.remove?.(THEME_PAINT_KEY) } catch { /* A removed session invalidates the hint too. */ }
    },
  }
}

/** Generated from the same palettes and pure selector as the native first view. */
export function themeBootstrapScript() {
  const colors = Object.fromEntries(themes.map(theme => [theme.id, { bg: theme.palette.bg, ink: theme.palette.ink, dark: theme.dark }]))
  return `(()=>{
    const colors=${JSON.stringify(colors)};
    const tag=${sessionTag.toString()};
    const pick=${paintThemeId.toString()};
    const scheduled=${themeByTimeOfDay.toString()};
    let session='',hint;
    try{session=localStorage.getItem('agency.session')||'';hint=localStorage.getItem(${JSON.stringify(THEME_PAINT_KEY)});}catch{}
    const now=Date.now();
    const color=colors[pick(hint,tag(session),scheduled(new Date(now).getHours()),now,Object.keys(colors))];
    const style=document.documentElement.style;
    style.setProperty('--startup-bg',color.bg);
    style.setProperty('--startup-ink',color.ink);
    style.backgroundColor=color.bg;
    style.colorScheme=color.dark?'dark':'light';
  })();`
}
