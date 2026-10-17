import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const target = path.resolve('apps/miniprogram/src/static')
await mkdir(path.join(target, 'icons'), { recursive: true })
if (process.argv[2] && process.argv[3]) {
  // Encoding only: keep the generated compositions and original dimensions.
  await sharp(process.argv[2]).jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(target, 'mountain-lake.jpg'))
  await sharp(process.argv[3]).jpeg({ quality: 78, mozjpeg: true }).toFile(path.join(target, 'morning-light.jpg'))
}
const icons = {
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5Z"/>',
  spark: '<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4Z"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M21 20v-2a6 6 0 0 0-4-5.7"/>',
  layers: '<rect x="5" y="7" width="14" height="14" rx="3"/><path d="M8 7V5a4 4 0 0 1 8 0v2M9 12h6M9 16h4"/>',
  chat: '<path d="M20 15a3 3 0 0 1-3 3H9l-5 3v-6a8 8 0 1 1 16 0Z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
  ear: '<path d="M6 9a6 6 0 0 1 12 0c0 5-4 4-4 8a3 3 0 0 1-6 0M10 9a2 2 0 0 1 4 0c0 2-2 2-2 4"/>',
  paths: '<path d="M7 21V5m-3 3 3-3 3 3M17 21V5m-3 3 3-3 3 3M7 15c0-4 10-2 10-6"/>',
  step: '<rect x="7" y="2" width="10" height="20" rx="3"/><path d="M11 17h2M10 8l2-2 2 2M12 6v7"/>',
  home: '<path d="m3 10 9-8 9 8v11h-6v-7H9v7H3Z"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3Z"/>',
  note: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 7h8M8 11h8M8 15h5"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  menu: '<path d="M4 6h16M4 12h11M4 18h16"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  moon: '<path d="M20 14A9 9 0 0 1 10 4a9 9 0 1 0 10 10Z"/>',
}
for (const [name, body] of Object.entries(icons)) {
  for (const [suffix, color] of [['', '#253148'], ['-white', '#ffffff']]) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24"><g fill="none" stroke="${color}" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`
    await sharp(Buffer.from(svg)).png().toFile(path.join(target, 'icons', name + suffix + '.png'))
  }
}
