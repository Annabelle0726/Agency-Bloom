import { iconBodies, iconStrokeWidth, type IconName } from './icons'

export { iconBodies, iconStrokeWidth }
export type { IconName }

/** Colors are supplied by the active six-theme palette, never hard-coded in pages. */
export interface IconPalette {
  ink: string
  accent: string
  muted: string
  paper: string
}

export const ICON_PALETTE_KEY = 'agency-bloom-icon-palette'

export const fallbackIconPalette: IconPalette = {
  ink: '#29374b',
  accent: '#58725f',
  muted: '#667180',
  paper: '#ffffff',
}

const sourceCache = new Map<string, string>()

export function iconSvg(name: IconName, color: string) {
  const body = iconBodies[name] || iconBodies.arrow
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${iconStrokeWidth}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
}

function base64Ascii(value: string) {
  if (typeof uni !== 'undefined' && typeof uni.arrayBufferToBase64 === 'function') {
    const bytes = new Uint8Array(value.length)
    for (let index = 0; index < value.length; index++) bytes[index] = value.charCodeAt(index) & 0xff
    return uni.arrayBufferToBase64(bytes.buffer)
  }
  if (typeof btoa === 'function') return btoa(value)
  throw Error('No base64 encoder is available for the icon system')
}

/**
 * WeChat Mini Program cannot render inline Vue SVG nodes reliably. The proven
 * path is a base64 SVG data source in an image, which also keeps the icon
 * offline and theme-aware without a network request.
 */
export function iconDataUri(name: IconName, color: string) {
  const key = `${name}:${color}`
  const cached = sourceCache.get(key)
  if (cached) return cached
  const source = 'data:image/svg+xml;base64,' + base64Ascii(iconSvg(name, color))
  sourceCache.set(key, source)
  return source
}
