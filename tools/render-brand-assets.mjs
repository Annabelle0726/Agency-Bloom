import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const sharp = require('sharp')
const assetDir = path.resolve('apps/miniprogram/src/static')
const specs = [
  ['brand-sprout.svg', 'brand-sprout.png', 128],
  ['brand-sprout-night.svg', 'brand-sprout-night.png', 128],
  ['brand-app-icon.svg', 'brand-app-icon.png', 512],
]
for (const [source, target, size] of specs) {
  const bytes = await fs.readFile(path.join(assetDir, source))
  const info = await sharp(bytes, { density: 256 }).resize(size, size).png().toFile(path.join(assetDir, target))
  console.log(target, info.width, info.height, info.size, 'bytes')
}
