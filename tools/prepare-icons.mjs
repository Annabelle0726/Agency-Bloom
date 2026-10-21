import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

// Agency Bloom icon system: Lucide geometry, normalized for the Mini Program.
// Lucide Icons v1.60.0 is licensed ISC. Source: https://lucide.dev/license
// We keep the upstream 24×24 geometry and only adjust the project stroke width.
const lucide = {
  arrow: { name: 'arrow-right', body: '<path d="M5 12h14" /> <path d="m12 5 7 7-7 7" />' },
  'arrow-up': { name: 'arrow-up', body: '<path d="m5 12 7-7 7 7" /> <path d="M12 19V5" />' },
  'arrow-diagonal': { name: 'arrow-up-right', body: '<path d="M7 7h10v10" /> <path d="M7 17 17 7" />' },
  back: { name: 'arrow-left', body: '<path d="m12 19-7-7 7-7" /> <path d="M19 12H5" />' },
  chevron: { name: 'chevron-right', body: '<path d="m9 18 6-6-6-6" />' },
  check: { name: 'check', body: '<path d="M20 6 9 17l-5-5" />' },
  close: { name: 'x', body: '<path d="M18 6 6 18" /> <path d="m6 6 12 12" />' },
  plus: { name: 'plus', body: '<path d="M5 12h14" /> <path d="M12 5v14" />' },
  stop: { name: 'square', body: '<rect width="18" height="18" x="3" y="3" rx="2" />' },
  more: { name: 'ellipsis', body: '<circle cx="12" cy="12" r="1" /> <circle cx="19" cy="12" r="1" /> <circle cx="5" cy="12" r="1" />' },
  compass: { name: 'compass', body: '<circle cx="12" cy="12" r="10" /> <path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" />' },
  spark: { name: 'sparkles', body: '<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" /> <path d="M20 2v4" /> <path d="M22 4h-4" /> <circle cx="4" cy="20" r="2" />' },
  people: { name: 'users', body: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /> <path d="M16 3.128a4 4 0 0 1 0 7.744" /> <path d="M22 21v-2a4 4 0 0 0-3-3.87" /> <circle cx="9" cy="7" r="4" />' },
  layers: { name: 'layers', body: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" /> <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" /> <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />' },
  chat: { name: 'message-circle', body: '<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />' },
  sun: { name: 'sun', body: '<circle cx="12" cy="12" r="4" /> <path d="M12 2v2" /> <path d="M12 20v2" /> <path d="m4.93 4.93 1.41 1.41" /> <path d="m17.66 17.66 1.41 1.41" /> <path d="M2 12h2" /> <path d="M20 12h2" /> <path d="m6.34 17.66-1.41 1.41" /> <path d="m19.07 4.93-1.41 1.41" />' },
  sunrise: { name: 'sunrise', body: '<path d="M12 2v8" /> <path d="m4.93 10.93 1.41 1.41" /> <path d="M2 18h2" /> <path d="M20 18h2" /> <path d="m19.07 10.93-1.41 1.41" /> <path d="M22 22H2" /> <path d="m8 6 4-4 4 4" /> <path d="M16 18a4 4 0 0 0-8 0" />' },
  ear: { name: 'ear', body: '<path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0" /> <path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4" />' },
  paths: { name: 'signpost', body: '<path d="M12 13v8" /> <path d="M12 3v3" /> <path d="M2.354 10.354a1.207 1.207 0 0 1 0-1.708l2.06-2.06A2 2 0 0 1 5.828 6h12.344a2 2 0 0 1 1.414.586l2.06 2.06a1.207 1.207 0 0 1 0 1.708l-2.06 2.06a2 2 0 0 1-1.414.586H5.828a2 2 0 0 1-1.414-.586z" />' },
  step: { name: 'footprints', body: '<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z" /> <path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z" /> <path d="M16 17h4" /> <path d="M4 13h4" />' },
  home: { name: 'house', body: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /> <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />' },
  user: { name: 'user-round', body: '<circle cx="12" cy="8" r="5" /> <path d="M20 21a8 8 0 0 0-16 0" />' },
  note: { name: 'notebook-text', body: '<path d="M2 6h4" /> <path d="M2 10h4" /> <path d="M2 14h4" /> <path d="M2 18h4" /> <rect width="16" height="20" x="4" y="2" rx="2" /> <path d="M9.5 8h5" /> <path d="M9.5 12H16" /> <path d="M9.5 16H14" />' },
  menu: { name: 'menu', body: '<path d="M4 5h16" /> <path d="M4 12h16" /> <path d="M4 19h16" />' },
  lock: { name: 'lock', body: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2" /> <path d="M7 11V7a5 5 0 0 1 10 0v4" />' },
  moon: { name: 'moon', body: '<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />' },
  camera: { name: 'camera', body: '<path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z" /> <circle cx="12" cy="13" r="3" />' },
  orbit: { name: 'orbit', body: '<path d="M20.341 6.484A10 10 0 0 1 10.266 21.85" /> <path d="M3.659 17.516A10 10 0 0 1 13.74 2.152" /> <circle cx="12" cy="12" r="3" /> <circle cx="19" cy="5" r="2" /> <circle cx="5" cy="19" r="2" />' },
  split: { name: 'split', body: '<path d="M16 3h5v5" /> <path d="M8 3H3v5" /> <path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" /> <path d="m15 9 6-6" />' },
  'shield-check': { name: 'shield-check', body: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /> <path d="m9 12 2 2 4-4" />' },
  'message-heart': { name: 'message-circle-heart', body: '<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" /> <path d="M7.828 13.07A3 3 0 0 1 12 8.764a3 3 0 0 1 5.004 2.224 3 3 0 0 1-.832 2.083l-3.447 3.62a1 1 0 0 1-1.45-.001z" />' },
  'door-open': { name: 'door-open', body: '<path d="M10 21H2" /> <path d="M10 3H7a2 2 0 00-2 2v16" /> <path d="M14 12h.01" /> <path d="M19 21V5a2 2 0 00-1.675-1.974l-6.163-1.013A1 1 0 0010 3v18a1 1 0 001.124.992z" /> <path d="M22 21h-3" />' },
  'message-more': { name: 'message-circle-more', body: '<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" /> <path d="M8 12h.01" /> <path d="M12 12h.01" /> <path d="M16 12h.01" />' },
  scale: { name: 'scale', body: '<path d="M12 3v18" /> <path d="m19 8 3 8a5 5 0 0 1-6 0zV7" /> <path d="M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1" /> <path d="m5 8 3 8a5 5 0 0 1-6 0zV7" /> <path d="M7 21h10" />' },
  flask: { name: 'flask-conical', body: '<path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2" /> <path d="M6.453 15h11.094" /> <path d="M8.5 2h7" />' },
}

const STROKE_WIDTH = 1.75
const INK = '#29374b'
const LIGHT = '#ffffff'
const target = path.resolve('apps/miniprogram/src/static/icons')
await mkdir(target, { recursive: true })

function render(body, color, comment = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">${comment}${body}</svg>`
}

const bodies = {}
const names = {}
const sources = {}
const dataUri = (body, color) => 'data:image/svg+xml;base64,' + Buffer.from(render(body, color)).toString('base64')
for (const [key, icon] of Object.entries(lucide)) {
  bodies[key] = icon.body
  names[key] = icon.name
  sources[key] = { ink: dataUri(icon.body, INK), light: dataUri(icon.body, LIGHT) }
  await writeFile(path.join(target, `${key}.svg`), render(icon.body, INK) + '\n')
  await writeFile(path.join(target, `${key}-white.svg`), render(icon.body, LIGHT) + '\n')
}

const output = `// Generated by tools/prepare-icons.mjs
// Lucide Icons v1.60.0 geometry, ISC License, https://lucide.dev/license
// Stroke width is normalized to ${STROKE_WIDTH}px for Agency Bloom; do not mix libraries.
export const iconStrokeWidth = ${STROKE_WIDTH}
export const iconLucideNames = ${JSON.stringify(names, null, 2)} as const
export const iconBodies = ${JSON.stringify(bodies, null, 2)} as const
export const iconSources = ${JSON.stringify(sources, null, 2)} as const
export type IconName = keyof typeof iconBodies
`
await writeFile('apps/miniprogram/src/icons.ts', output)
console.log(`Prepared ${Object.keys(lucide).length} Lucide icons at ${STROKE_WIDTH}px stroke.`)
