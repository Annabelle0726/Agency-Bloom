import { svgDataUri, type IconPalette } from './icon-system'

const cache = new Map<string, { canopy: string; stem: string }>()

/** Small edge studies rather than a scaled copy of the Settings composition. */
export function drawerAtmosphere(palette: IconPalette) {
  const { accent, muted } = palette
  const key = `${accent}:${muted}`
  const existing = cache.get(key)
  if (existing) return existing
  const leaf = `<defs><g id="leaf"><path d="M0 0C-8-14-23-10-24 5C-25 21-4 37 1 52C7 34 26 18 22 4C18-10 6-12 0 0Z" fill="${accent}" fill-opacity=".025"/><path d="M0 0Q-1 25 1 48M0 15L-14 7M0 25L13 15M1 34L-11 25" opacity=".55"/></g></defs>`
  const svg = (body: string, width: number, height: number) => svgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" stroke="${accent}" stroke-opacity=".13" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round">${leaf}${body}</svg>`)
  const canopy = svg(`<path d="M188-24C149 13 115 7 112 47C109 83 155 99 155 134C155 157 139 176 142 199" stroke-width="1.7"/>
<path d="M177-22C167 17 103 25 120 65C136 101 171 117 150 158" stroke="${muted}" opacity=".65"/>
<path d="M134 13L118 8M112 47L96 49M140 96L150 83M154 139L133 131"/>
<use xlink:href="#leaf" transform="translate(118 8) rotate(60) scale(.65)"/>
<use xlink:href="#leaf" transform="translate(96 49) rotate(32) scale(.8)"/>
<use xlink:href="#leaf" transform="translate(150 83) rotate(-44) scale(.7)"/>
<use xlink:href="#leaf" transform="translate(133 131) rotate(42) scale(.56)"/>`, 180, 210)
  const stem = svg(`<path d="M-15 270C53 228 18 184 39 144C56 111 92 110 86 72C82 47 64 35 76 7" stroke-width="1.7"/>
<path d="M-8 258C17 225 45 211 33 178C18 139 79 118 81 91" stroke="${muted}" opacity=".65"/>
<path d="M30 208L47 198M39 144L26 133M81 97L99 86M71 39L59 32"/>
<use xlink:href="#leaf" transform="translate(47 198) rotate(-54) scale(.75)"/>
<use xlink:href="#leaf" transform="translate(26 133) rotate(34) scale(.65)"/>
<use xlink:href="#leaf" transform="translate(99 86) rotate(-42) scale(.58)"/>
<use xlink:href="#leaf" transform="translate(59 32) rotate(42) scale(.45)"/>`, 140, 260)
  const result = { canopy, stem }
  cache.set(key, result)
  return result
}
