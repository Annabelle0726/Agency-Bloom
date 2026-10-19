export type SpaceTab = 'now' | 'plan' | 'chat' | 'discover' | 'settings'
export const navigationItems: { id: SpaceTab; label: string }[] = [
  { id: 'now', label: '首页' }, { id: 'plan', label: '计划' }, { id: 'chat', label: '对话' },
  { id: 'discover', label: '发现' }, { id: 'settings', label: '我的' },
]
export type ThemeId = 'light' | 'dark' | 'dawn' | 'forest' | 'lavender' | 'minimal'
interface Palette {
  bg: string; paper: string; ink: string; muted: string; line: string
  accent: string; fill: string; soft: string; gold: string
}
export interface ThemeDefinition {
  id: ThemeId; name: string; english: string; detail: string; image: string; preview: string
  dark: boolean; photoOpacity: number; palette: Palette
}
function defineTheme(id: ThemeId, name: string, english: string, detail: string, art: string, palette: Palette, photoOpacity = .24): ThemeDefinition {
  return { id, name, english, detail, image: `/static/themes/${art}.jpg`, preview: `/static/themes/${art}-preview.jpg`, dark: id === 'dark', photoOpacity, palette }
}
export const themes: ThemeDefinition[] = [
  defineTheme('light', '晨雾', 'Morning Mist', '山间晨光 · 雾蓝与柔白', 'mist', {
    bg: '#f4f6fa', paper: '#ffffff', ink: '#29374b', muted: '#657086', line: '#e1e7f0', accent: '#4d6bc4', fill: '#4c66b9', soft: '#eaf0fc', gold: '#98713d',
  }),
  defineTheme('dark', '深夜', 'Quiet Night', '黑色夜幕 · 淡淡璀璨星空', 'night', {
    bg: '#06090f', paper: '#10151d', ink: '#e8edf4', muted: '#8f9aa8', line: '#232c38', accent: '#c3d3e8', fill: '#42576e', soft: '#141b25', gold: '#d7c59d',
  }, .35),
  defineTheme('dawn', '暮烟', 'Evening Smoke', '暮色渐染 · 夕照金褐与暖白', 'dawn', {
    bg: '#fbf5ed', paper: '#fffdf8', ink: '#503d32', muted: '#7b6858', line: '#e9ddd1', accent: '#916348', fill: '#875a41', soft: '#f4e8da', gold: '#916b38',
  }, .26),
  defineTheme('forest', '森林', 'Forest', '林间天光 · 苔绿与玉白', 'forest', {
    bg: '#edf2eb', paper: '#fbfdf8', ink: '#293e32', muted: '#5f7163', line: '#d8e2d5', accent: '#426a50', fill: '#3f634b', soft: '#e1ebde', gold: '#747443',
  }, .16),
  defineTheme('lavender', '薰衣草', 'Lavender', '花穗轻影 · 灰紫与柔白', 'lavender', {
    bg: '#f3f0f7', paper: '#fdfbff', ink: '#453c55', muted: '#74677f', line: '#e1d9e8', accent: '#79618e', fill: '#705881', soft: '#eae3f0', gold: '#907251',
  }, .20),
  defineTheme('minimal', '极简', 'Minimal', '一束光 · 一页留白', 'minimal', {
    bg: '#f5f5f2', paper: '#ffffff', ink: '#303733', muted: '#676e69', line: '#dfe2dc', accent: '#4e5a52', fill: '#424c45', soft: '#eceee9', gold: '#716b58',
  }, .18),
]
export function resolveTheme(value?: string): ThemeDefinition {
  return themes.find(theme => theme.id === value) || themes[0]
}
export function themeByTimeOfDay(hour: number): ThemeId {
  const h = ((Math.floor(hour) % 24) + 24) % 24
  // Early morning until mid-morning: morning mist.
  if (h >= 5 && h < 10) return 'light'
  // Late afternoon into dusk: the warm evening-smoke palette.
  if (h >= 16 && h < 19) return 'dawn'
  // Night: quiet night.
  if (h >= 19 || h < 5) return 'dark'
  // The rest of the day: forest.
  return 'forest'
}
export function themeForSession(user: { theme: string } | null | undefined, inPersonalSpace: boolean) {
  return resolveTheme(user && inPersonalSpace ? user.theme : 'light')
}
export function themeStyle(theme: ThemeDefinition): Record<string, string> {
  const p = theme.palette
  const gradients: Record<ThemeId, [string, string]> = {
    light: ['#9bb4ff', '#66c4eb'], dark: ['#7e93b8', '#3d5a78'],
    dawn: ['#eac59f', '#b97e59'], forest: ['#9fc8a0', '#548e78'],
    lavender: ['#c6b1e3', '#9a7ab5'], minimal: ['#adb8b0', '#6e8479'],
  }
  const gem: Record<ThemeId, { hi: string; deep: string }> = {
    light: { hi: '#e3ecff', deep: '#2f4bb3' },
    dark: { hi: '#b9c9e4', deep: '#24405e' },
    dawn: { hi: '#ffe9cd', deep: '#6f4028' },
    forest: { hi: '#d5ecd2', deep: '#2c5340' },
    lavender: { hi: '#eadcf7', deep: '#4f3b68' },
    minimal: { hi: '#dfe7db', deep: '#374440' },
  }
  const rgba = (hex: string, alpha: number) => {
    const value = parseInt(hex.slice(1), 16)
    return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`
  }
  return {
    '--bg': p.bg, '--paper': p.paper, '--ink': p.ink, '--muted': p.muted, '--line': p.line,
    '--accent': p.accent, '--button-fill': p.fill, '--soft': p.soft, '--accent-light': p.soft,
    '--scrollbar-thumb': p.muted, '--scrollbar-track': p.soft,
    '--selection': p.soft, '--selection-border': p.accent, '--disabled-fill': p.soft, '--gold': p.gold,
    '--icon-filter': theme.dark ? 'brightness(0) invert(.91)' : 'none',
    '--shadow': theme.dark ? 'none' : '0 8px 30px #25314809',
    '--theme-photo-opacity': '1',
    '--surface-glass': p.paper + 'ed', '--nav-glass': p.paper + 'f2',
    '--hero-top': p.bg + 'ee', '--hero-middle': p.bg + '00',
    '--nav-start': gradients[theme.id][0], '--nav-end': gradients[theme.id][1],
    '--nav-gem-hi': gem[theme.id].hi, '--nav-gem-deep': gem[theme.id].deep,
    '--nav-gem-hi-soft': rgba(gem[theme.id].hi, .55), '--nav-gem-glow': rgba(gem[theme.id].hi, .42),
    '--theme-glow': p.accent + '30', '--radius-card': '24px', '--radius-button': '18px',
  }
}
export function themeNavSvg(theme: ThemeDefinition, id: SpaceTab, active: boolean) {
  const color = id === 'chat' ? '#ffffff' : active ? theme.palette.accent : theme.palette.muted
  const paths = {
    now: '<path d="M3.5 10.5 12 3.8l8.5 6.7v9a1 1 0 0 1-1 1h-5v-6.7h-5v6.7h-5a1 1 0 0 1-1-1z"/>',
    plan: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2.8h6V4M8.5 10l2 2 4-4M9 16h6"/>',
    discover: '<circle cx="12" cy="12" r="8.5"/><path d="m15.8 8.2-2.1 5.5-5.5 2.1 2.1-5.5zM20 4l-2 2"/>',
    chat: '<path d="M12 5v14M5 12h14"/>',
    settings: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="9" r="2.6"/><path d="M7.2 18v-1.2a4.8 4.8 0 0 1 9.6 0V18"/>',
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${id === 'now' && active ? color : 'none'}" stroke="${color}" stroke-width="${active ? 1.9 : 1.7}" stroke-linecap="round" stroke-linejoin="round">${paths[id]}</svg>`
}
