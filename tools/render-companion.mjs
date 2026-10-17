import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const sharp = require('sharp')
const source = path.resolve('apps/miniprogram/src/static/companion-ember.svg')
const target = path.resolve('apps/miniprogram/src/static/companion-ember.png')
await sharp(fs.readFileSync(source), { density: 320 }).resize(256, 256).png().toFile(target)
console.log('Rendered companion-ember.png (256x256)')
