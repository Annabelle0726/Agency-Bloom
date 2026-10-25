// Build card thumbnails for the visual library. Source masters stay untouched.
const fs = require('node:fs/promises')
const path = require('node:path')
const sharp = require('sharp')
const { resolveSourcePath } = require('./source-archive.cjs')

const root = path.resolve(__dirname, '..')
const recipePath = path.join(root, 'assets/visual-library/recipes/visual-cards.json')
const runtime = path.join(root, 'apps/miniprogram/src/static/visuals')

;(async () => {
  const recipe = JSON.parse(await fs.readFile(recipePath, 'utf8'))
  const outputs = []
  const onlyId = process.argv[2] === '--id' ? process.argv[3] : null
  if (onlyId && !recipe.some(item => item.id === onlyId)) throw new Error('Unknown visual ID: ' + onlyId)
  for (const item of recipe.filter(item => !onlyId || item.id === onlyId)) {
    const source = resolveSourcePath(item.source)
    const output = path.join(runtime, item.category, `${path.basename(item.source, path.extname(item.source))}.jpg`)
    await fs.access(source)
    await fs.mkdir(path.dirname(output), { recursive: true })
    const image = sharp(source).rotate()
    if (item.crop) image.extract(item.crop)
    await image
      .resize(item.width, item.height, { fit: 'cover', position: item.position || 'attention' })
      .jpeg({ quality: item.quality || 73, mozjpeg: true })
      .toFile(output)
    outputs.push({
      id: item.id,
      category: item.category,
      source: item.source,
      output: path.relative(root, output).replaceAll('\\', '/'),
      bytes: (await fs.stat(output)).size,
    })
  }
  console.log(JSON.stringify({
    images: outputs.length,
    bytes: outputs.reduce((sum, output) => sum + output.bytes, 0),
    outputs,
  }, null, 2))
})().catch(error => {
  console.error(error)
  process.exitCode = 1
})
