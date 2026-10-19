// Compose the hybrid hero: SVG layout + real Morning Mist theme art as the raster layer.
// Publishes assets/readme/hero.png; keeps source layers editable.
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const sharp = require('sharp')

const root = process.cwd()
const src = p => path.join(root, p)

const mistArt = src('apps/miniprogram/src/static/themes/mist.jpg')
const layoutSvg = src('assets/readme/source/hero-layout.svg')
const outPng = src('assets/readme/hero.png')
const artCache = src('assets/readme/source/mist-art.png')

// 1. Prepare the raster art layer: crop a band from the real theme reference and soften it.
await sharp(mistArt)
  .extract({ left: 0, top: 120, width: 640, height: 560 })
  .blur(1.2)
  .modulate({ brightness: 1.06, saturation: 0.88 })
  .png()
  .toFile(artCache)

// 2. Render the SVG layout at 2x for crisp text.
const layout = await fs.readFile(layoutSvg)
const layoutPng = await sharp(layout, { density: 192 }).png().toBuffer()

// 3. Composite: the real theme photo fills the layout's reserved art box (790..1152, 48..372 at 1200 scale).
const meta = await sharp(layoutPng).metadata()
const scale = meta.width / 1200
const artBox = { left: Math.round(790 * scale), top: Math.round(48 * scale), width: Math.round(362 * scale), height: Math.round(324 * scale) }

// Cover-fit the art into the box.
const fitted = await sharp(artCache)
  .resize(artBox.width, artBox.height, { fit: 'cover' })
  .png()
  .toBuffer()

await sharp(layoutPng)
  .composite([{ input: fitted, left: artBox.left, top: artBox.top }])
  .png({ compressionLevel: 9 })
  .toFile(outPng)

const stat = await fs.stat(outPng)
console.log('hero.png', meta.width + 'x' + meta.height, stat.size, 'bytes')
