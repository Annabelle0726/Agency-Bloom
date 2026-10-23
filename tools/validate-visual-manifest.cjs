// Validate the visual library contract against the real filesystem.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const sharp = require('sharp')

const root = path.resolve(__dirname, '..')
const manifestPath = path.join(root, 'assets/visual-manifest.json')
const schemaPath = path.join(root, 'assets/visual-manifest.schema.json')
const runtimeCopy = path.join(root, 'apps/miniprogram/src/visual-manifest.json')
const themes = ['light', 'dark', 'dawn', 'forest', 'lavender', 'minimal']
const themeReferenceHashes = {
  'dawn.jpg': '87a53e63c9aca67fb70bfc38f09166a33b8231fed0fcdb83152c6326e264914c',
  'forest.jpg': 'c3941575581faf2984c9c87df33cc8de7db50a058226ae078434e1820073c55f',
  'lavender.jpg': 'da0e225a3e06d4548b96dd0d44c1403037c1ea2bb3cc17c11221d9af415bb49b',
  'minimal.jpg': '19cc1f4be7756c6a6e45c574a9f44a0a690d728aa0efd9b7c5b0b60be72b5733',
  'mist.png': '2c22ccfb33ea549297714b12bf19ecdbf678f09debd50f3ce887a270038091db',
  'night.jpg': '4413c84833bb8ad61eb0c484e476919578dff2d814be12754906b0e40cf26dda',
}
const errors = []

function fail(message) {
  errors.push(message)
}
function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}
function assert(condition, message) {
  if (!condition) fail(message)
}
function absoluteRuntime(runtimePath) {
  return path.join(root, 'apps/miniprogram/src', runtimePath.replace(/^\//, ''))
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'))
assert(schema.title === 'Agency Bloom visual manifest', 'Unexpected manifest schema title')
assert(manifest.schemaVersion === 1, 'schemaVersion must be 1')
assert(Array.isArray(manifest.visuals), 'visuals must be an array')
assert(manifest.visuals.length > 0, 'Visual library must not be empty')
const allowedCategories = new Set(schema.$defs.visual.properties.category.enum)
assert(JSON.stringify(manifest.themes) === JSON.stringify(themes), 'Theme list or order changed')
assert(fs.existsSync(runtimeCopy), 'Missing runtime manifest copy')
if (fs.existsSync(runtimeCopy)) {
  assert(fs.readFileSync(manifestPath).equals(fs.readFileSync(runtimeCopy)), 'Runtime manifest copy is stale')
}
assert(!fs.existsSync(path.join(root, 'design/img')), 'Legacy design/img directory still exists')
assert(!fs.existsSync(path.join(root, 'assets/gen-img')), 'Legacy assets/gen-img directory still exists')

const ids = new Set()
const originalPaths = new Set()
const runtimeOwners = new Map()
const statusCounts = { deployed: 0, archived: 0, 'reference-only': 0 }
const themeReferenceDir = path.join(root, 'design/themes/references')
for (const [name, expected] of Object.entries(themeReferenceHashes)) {
  const file = path.join(themeReferenceDir, name)
  assert(fs.existsSync(file), `Missing frozen theme reference ${name}`)
  if (fs.existsSync(file)) assert(sha256(file) === expected, `Frozen theme reference changed: ${name}`)
}
const referenceFiles = fs.readdirSync(themeReferenceDir).filter(name => fs.statSync(path.join(themeReferenceDir, name)).isFile()).sort()
assert(JSON.stringify(referenceFiles) === JSON.stringify(Object.keys(themeReferenceHashes).sort()), 'Frozen theme reference file list changed')

for (const visual of manifest.visuals) {
  const label = visual.id || '(missing id)'
  for (const field of ['id', 'category', 'description', 'tags', 'mood', 'intendedPage', 'visualRole', 'themeCompatibility', 'source', 'originalPath', 'sourceSha256', 'sourceBytes', 'dimensions', 'status', 'deploy', 'sourceGroup', 'runtimeVariants', 'heroVariants']) {
    assert(Object.prototype.hasOwnProperty.call(visual, field), `${label}: missing ${field}`)
  }
  assert(allowedCategories.has(visual.category), label + ': invalid category')
  assert(/^[a-z0-9_]+$/.test(visual.id), `${label}: invalid id`)
  assert(!ids.has(visual.id), `${label}: duplicate id`)
  ids.add(visual.id)
  assert(!originalPaths.has(visual.originalPath), `${label}: duplicate original path`)
  originalPaths.add(visual.originalPath)
  assert(['deployed', 'archived', 'reference-only'].includes(visual.status), `${label}: invalid status`)
  statusCounts[visual.status]++
  assert(visual.deploy === (visual.status === 'deployed'), `${label}: deploy/status mismatch`)
  assert(visual.source === 'chatgpt-generated' || visual.source === 'user-supplied-design-reference', `${label}: invalid source`)
  assert(Array.isArray(visual.tags) && visual.tags.length > 0, `${label}: tags required`)
  assert(Array.isArray(visual.intendedPage) && visual.intendedPage.length > 0, `${label}: intendedPage required`)
  assert(Array.isArray(visual.visualRole) && visual.visualRole.length > 0, `${label}: visualRole required`)
  assert(Array.isArray(visual.themeCompatibility), `${label}: themeCompatibility must be an array`)
  for (const theme of visual.themeCompatibility) assert(themes.includes(theme), `${label}: invalid theme ${theme}`)
  assert(new Set(visual.themeCompatibility).size === visual.themeCompatibility.length, `${label}: duplicate theme compatibility`)
  assert(/^[a-f0-9]{64}$/.test(visual.sourceSha256), `${label}: invalid sha256`)
  assert(Number.isInteger(visual.sourceBytes) && visual.sourceBytes > 0, `${label}: invalid sourceBytes`)
  assert(visual.dimensions && Number.isInteger(visual.dimensions.width) && visual.dimensions.height > 0, `${label}: invalid dimensions`)
  assert(Number.isFinite(visual.dimensions.aspectRatio) && visual.dimensions.aspectRatio > 0, `${label}: invalid aspect ratio`)
  assert(visual.source === 'user-supplied-design-reference' || visual.originalPath.startsWith('assets/visual-library/originals/'), `${label}: original path outside originals`)
  if (visual.status === 'reference-only') {
    assert(visual.originalPath.startsWith('assets/visual-library/references/'), `${label}: reference outside references`)
  }
  const sourceFile = path.join(root, visual.originalPath)
  assert(fs.existsSync(sourceFile), `${label}: missing original ${visual.originalPath}`)
  if (fs.existsSync(sourceFile)) {
    assert(sha256(sourceFile) === visual.sourceSha256, `${label}: original SHA-256 mismatch`)
    assert(fs.statSync(sourceFile).size === visual.sourceBytes, `${label}: original byte size mismatch`)
  }
  if (visual.status !== 'deployed') {
    assert(Object.keys(visual.runtimeVariants).length === 0, `${label}: archived/reference visual has runtime variants`)
    assert(Object.keys(visual.heroVariants).length === 0, `${label}: archived/reference visual has hero variants`)
  }
  for (const [theme, runtimePath] of Object.entries(visual.runtimeVariants)) {
    assert(themes.includes(theme), `${label}: invalid runtime theme ${theme}`)
    assert(visual.themeCompatibility.includes(theme), `${label}: runtime theme ${theme} is not compatible`)
    assert(runtimePath.startsWith('/static/') && runtimePath.endsWith('.jpg'), `${label}: invalid runtime path ${runtimePath}`)
    const file = absoluteRuntime(runtimePath)
    assert(fs.existsSync(file), `${label}: missing runtime file ${runtimePath}`)
    if (runtimeOwners.has(runtimePath) && runtimeOwners.get(runtimePath) !== label) fail(`${label}: runtime path shared with ${runtimeOwners.get(runtimePath)} (${runtimePath})`)
    runtimeOwners.set(runtimePath, label)
  }
  for (const [theme, runtimePath] of Object.entries(visual.heroVariants)) {
    assert(themes.includes(theme), `${label}: invalid hero theme ${theme}`)
    assert(visual.themeCompatibility.includes(theme), `${label}: hero theme ${theme} is not compatible`)
    assert(runtimePath.startsWith('/static/') && runtimePath.endsWith('.jpg'), `${label}: invalid hero path ${runtimePath}`)
    const file = absoluteRuntime(runtimePath)
    assert(fs.existsSync(file), `${label}: missing hero file ${runtimePath}`)
    if (runtimeOwners.has(runtimePath) && runtimeOwners.get(runtimePath) !== label) fail(`${label}: hero path shared with ${runtimeOwners.get(runtimePath)} (${runtimePath})`)
    runtimeOwners.set(runtimePath, label)
  }
}

// Validate actual source coverage as the library grows.
const sourceRoot = path.join(root, 'assets/visual-library/originals')
const sourceFiles = walk(sourceRoot).filter(file => /\.(png|jpe?g|jfif)$/i.test(file))
const registeredSources = manifest.visuals.filter(visual => visual.originalPath.startsWith('assets/visual-library/originals/'))
assert(sourceFiles.length === registeredSources.length, 'Source inventory and manifest counts differ')
for (const file of sourceFiles) assert(originalPaths.has(path.relative(root, file).replaceAll('\\', '/')), 'Unregistered original: ' + file)
const deployedHashes = manifest.visuals.filter(visual => visual.deploy).map(visual => visual.sourceSha256)
assert(new Set(deployedHashes).size === deployedHashes.length, 'Byte-identical images must not be deployed twice')
assert([...allowedCategories].sort().join(',') === ['choices', 'connection', 'direction', 'growth', 'reflection', 'rest', 'transition'].sort().join(','), 'Expected exactly seven semantic categories')

const oldPathPattern = /(?:^|[^a-z0-9_-])(?:design[\\/]img|assets[\\/]gen-img)(?:[\\/]|$)/i
for (const relative of ['apps/miniprogram/src', 'apps/api', 'tools']) {
  const directory = path.join(root, relative)
  if (!fs.existsSync(directory)) continue
  for (const file of walk(directory)) {
    if (!/\.(?:ts|vue|scss|css|js|cjs|mjs|json|py|md)$/i.test(file)) continue
    if (file.includes(`${path.sep}node_modules${path.sep}`) || file.includes(`${path.sep}dist${path.sep}`)) continue
    const text = fs.readFileSync(file, 'utf8')
    if (oldPathPattern.test(text)) fail(`Stale legacy image path in ${path.relative(root, file)}`)
  }
}

async function checkDerivativeDimensions() {
  for (const visual of manifest.visuals) {
    for (const runtimePath of Object.values(visual.runtimeVariants)) {
      const file = absoluteRuntime(runtimePath)
      if (!fs.existsSync(file)) continue
      const meta = await sharp(file).metadata()
      assert(meta.format === 'jpeg', `${visual.id}: runtime ${runtimePath} is not JPEG`)
      assert(meta.width === 224 && meta.height === 360, `${visual.id}: runtime ${runtimePath} is ${meta.width}x${meta.height}, expected 224x360`)
    }
  }
}

function walk(directory) {
  const result = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) result.push(...walk(full))
    else if (entry.isFile()) result.push(full)
  }
  return result
}

checkDerivativeDimensions().then(() => {
  if (errors.length) {
    console.error(`Visual manifest validation failed (${errors.length} error${errors.length === 1 ? '' : 's'}):`)
    for (const error of errors) console.error(`- ${error}`)
    process.exitCode = 1
    return
  }
  console.log(JSON.stringify({
    visuals: manifest.visuals.length,
    deployed: statusCounts.deployed,
    archived: statusCounts.archived,
    referenceOnly: statusCounts['reference-only'],
    cardCapable: manifest.visuals.filter(visual => Object.keys(visual.runtimeVariants).length > 0).length,
    heroCapable: manifest.visuals.filter(visual => Object.keys(visual.heroVariants).length > 0).length,
    runtimeFiles: runtimeOwners.size,
    themeReferencesUnchanged: true,
  }, null, 2))
}).catch(error => {
  console.error(error)
  process.exitCode = 1
})
