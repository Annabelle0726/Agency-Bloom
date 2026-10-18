// Render the Quiet Night starfield background programmatically (no external service).
// Deep-black sky, faint Milky Way band, sparse soft stars — quiet, not busy.
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const sharp = require('sharp')

const W = 640
const H = 960
// Deterministic PRNG so the render is reproducible run to run.
let seed = 20261018
function rand() {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 0xffffffff
}

const stars = []
// Sparse soft stars: a modest count keeps the sky calm.
const starCount = 260
for (let i = 0; i < starCount; i++) {
  const x = rand() * W
  const y = rand() * H
  const r = 0.5 + rand() * 1.4
  const brightness = 0.25 + rand() * 0.65
  stars.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="rgb(232,240,255)" opacity="${brightness.toFixed(2)}"/>`)
}
// A few slightly larger glowing stars with a halo.
for (let i = 0; i < 14; i++) {
  const x = rand() * W
  const y = rand() * H
  const r = 1.6 + rand() * 1.2
  stars.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * 3.2).toFixed(1)}" fill="rgb(210,225,255)" opacity="0.10"/>`)
  stars.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="#f2f7ff" opacity="0.9"/>`)
}
// Faint diagonal Milky Way band, mostly in the upper half.
stars.push(`<ellipse cx="180" cy="180" rx="520" ry="150" fill="rgb(150,170,200)" opacity="0.05" transform="rotate(-24 320 240)"/>`)
stars.push(`<ellipse cx="200" cy="150" rx="430" ry="100" fill="rgb(170,190,220)" opacity="0.045" transform="rotate(-24 320 240)"/>`)
stars.push(`<ellipse cx="260" cy="120" rx="300" ry="60" fill="rgb(200,215,240)" opacity="0.05" transform="rotate(-24 320 240)"/>`)

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <radialGradient id="floor" cx="50%" cy="108%" r="90%">
    <stop offset="0%" stop-color="#0d1420"/>
    <stop offset="60%" stop-color="#080d16"/>
    <stop offset="100%" stop-color="#05080f"/>
  </radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="#04070d"/>
<rect width="${W}" height="${H}" fill="url(#floor)"/>
${stars.join('\n')}
</svg>`

const outDir = path.resolve('apps/miniprogram/src/static/themes')
await fs.mkdir(outDir, { recursive: true })
await sharp(Buffer.from(svg)).jpeg({ quality: 72, mozjpeg: true }).toFile(path.join(outDir, 'night.jpg'))

// Thumbnail for the theme picker: 360x224 center crop.
const previewSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="224" viewBox="0 0 360 224">
<defs>
  <radialGradient id="p" cx="50%" cy="110%" r="95%">
    <stop offset="0%" stop-color="#0d1420"/>
    <stop offset="100%" stop-color="#05080f"/>
  </radialGradient>
</defs>
<rect width="360" height="224" fill="url(#p)"/>
${(() => {
  let s = 777
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff }
  const dots = []
  for (let i = 0; i < 90; i++) {
    const x = rnd() * 360, y = rnd() * 224, r = 0.5 + rnd() * 1.2
    dots.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="rgb(232,240,255)" opacity="${(0.3 + rnd() * 0.6).toFixed(2)}"/>`)
  }
  dots.push(`<ellipse cx="90" cy="40" rx="260" ry="70" fill="rgb(170,190,220)" opacity="0.05" transform="rotate(-24 180 112)"/>`)
  for (let i = 0; i < 6; i++) {
    const x = rnd() * 360, y = rnd() * 224
    dots.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="rgb(210,225,255)" opacity="0.12"/>`)
    dots.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.6" fill="#f2f7ff" opacity="0.9"/>`)
  }
  return dots.join('\n')
})()}
</svg>`
await sharp(Buffer.from(previewSvg)).jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(outDir, 'night-preview.jpg'))

for (const file of ['night.jpg', 'night-preview.jpg']) {
  const stat = await fs.stat(path.join(outDir, file))
  console.log(file, stat.size, 'bytes')
}
