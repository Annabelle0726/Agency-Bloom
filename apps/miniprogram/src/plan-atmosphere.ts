import { svgDataUri, type IconPalette } from './icon-system'

const cache = new Map<string, string>()

/** An open book and loose notebook pages, with complete outlines inside the canvas. */
export function planAtmosphere({ accent, muted }: IconPalette) {
  const key = `${accent}:${muted}`
  const existing = cache.get(key)
  if (existing) return existing
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1600" viewBox="0 0 900 1600" fill="none" stroke-linecap="round" stroke-linejoin="round">
<g transform="translate(460 160) rotate(12 170 120)" stroke="${accent}" stroke-opacity=".15" stroke-width="2">
 <path d="M18 51C64 32 114 37 165 66C215 37 264 32 312 51L312 223C260 204 213 208 165 236C117 208 68 204 18 223Z" fill="${accent}" fill-opacity=".025"/>
 <path d="M165 66V236M18 62L7 69V236C65 216 116 221 165 248C215 221 267 216 323 236V69L312 62"/>
 <path d="M18 75C63 56 111 63 151 86M18 91C63 72 111 79 151 102M179 86C221 63 267 56 312 75M179 102C221 79 267 72 312 91" opacity=".45"/>
 <path d="M42 116C72 108 109 114 139 128M42 143C72 135 109 141 139 155M42 170C72 162 109 168 139 182M190 128C221 114 258 108 288 116M190 155C221 141 258 135 288 143M190 182C221 168 258 162 288 170" opacity=".6"/>
 <path d="M244 45V107L258 96L273 103V40" fill="${accent}" fill-opacity=".04" stroke-width="1.6"/>
</g>
<g transform="translate(55 1090) rotate(-13 145 150)" stroke="${muted}" stroke-opacity=".11" stroke-width="1.8">
 <path d="M34 31L262 45L246 324L18 310Z"/>
 <path d="M20 18L250 18L250 300L20 300Z" fill="${accent}" fill-opacity=".018"/>
 <path d="M4 4H234V282H4ZM36 4V282"/>
 <path d="M62 57H207M62 85H207M62 113H191M62 165H207M62 193H177M62 221H200" opacity=".55"/>
 <path d="M184 4V69L197 58L210 69V4" stroke="${accent}"/>
 <path d="M234 245L205 282H234Z" fill="${accent}" fill-opacity=".025"/>
</g></svg>`
  const result = svgDataUri(source)
  cache.set(key, result)
  return result
}
