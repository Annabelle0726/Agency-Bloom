// Prepare reviewed JPEG derivatives for manual Supabase upload.
// This tool never uploads, moves or deletes a cloud object.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const root = path.resolve(__dirname, '..')
const publicBaseUrl = 'https://ycombbpglsmbvjlrjtgc.supabase.co/storage/v1/object/public/visual-library/'
const categories = ['choices', 'connection', 'direction', 'growth', 'reflection', 'rest', 'transition']
const keyPattern = /^(choices|connection|direction|growth|reflection|rest|transition)\/[a-z][a-z0-9_]*\.jpg$/
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
const configPath = path.join(root, 'apps/miniprogram/src/visual-storage.json')
const planPath = path.join(root, 'assets/visual-library/storage-upload-plan.json')
const uploadRoot = path.join(root, 'output/visual-storage-upload')
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n')
}

function collectObjects(manifest, projectRoot = root) {
  const objects = new Map(), keys = new Set()
  for (const visual of manifest.visuals) {
    if (!visual.deploy || visual.status !== 'deployed') continue
    if (!categories.includes(visual.category)) throw new Error('Unsupported category: ' + visual.category)
    const stem = path.basename(visual.originalPath, path.extname(visual.originalPath))
    for (const [role, variants] of [['card', visual.runtimeVariants], ['hero', visual.heroVariants]]) {
      for (const [theme, localPath] of Object.entries(variants)) {
        if (!localPath.startsWith('/static/') || !localPath.endsWith('.jpg') || localPath.includes('..')) throw new Error('Invalid local runtime path')
        const key = visual.category + '/' + stem + (role === 'hero' ? '_hero' : '') + '.jpg'
        if (!keyPattern.test(key)) throw new Error('Invalid curated object key: ' + key)
        const existing = objects.get(localPath)
        if (existing) {
          if (existing.visualId !== visual.id || existing.key !== key) throw new Error('Runtime path has conflicting owners')
          existing.themes.push(theme)
          continue
        }
        if (keys.has(key)) throw new Error('Cloud key collision: ' + key)
        keys.add(key)
        const bytes = fs.readFileSync(path.join(projectRoot, 'apps/miniprogram/src', localPath.slice(1)))
        objects.set(localPath, {
          visualId: visual.id, category: visual.category, role, themes: [theme],
          localPath, key, url: publicBaseUrl + key, mime: 'image/jpeg',
          bytes: bytes.length, sha256: sha256(bytes),
          sourceSha256: visual.sourceSha256,
          uploadFile: 'output/visual-storage-upload/' + key,
        })
      }
    }
  }
  return [...objects.values()].sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
}

async function verifyObject(object, fetcher = fetch) {
  const response = await fetcher(object.url, { redirect: 'error', signal: AbortSignal.timeout(15000) })
  if (response.status !== 200) throw new Error(object.key + ': HTTP ' + response.status)
  if ((response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() !== 'image/jpeg') {
    throw new Error(object.key + ': expected image/jpeg')
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length !== object.bytes || sha256(bytes) !== object.sha256) throw new Error(object.key + ': content differs from the reviewed derivative')
}

async function main() {
  const args = new Set(process.argv.slice(2))
  if (args.has('--activate') && !args.has('--verify')) throw new Error('--activate requires --verify; upload the prepared files first')
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/visual-manifest.json'), 'utf8'))
  const objects = collectObjects(manifest)
  const routes = Object.fromEntries(objects.map(object => [object.localPath, object.key]))
  if (args.has('--verify')) {
    for (const object of objects) await verifyObject(object)
    const verifiedAt = new Date().toISOString()
    const current = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {}
    writeJson(configPath, { enabled: args.has('--activate') || (current.enabled === true && JSON.stringify(current.objects) === JSON.stringify(routes)), publicBaseUrl, verifiedAt, objects: routes })
    writeJson(planPath, { schemaVersion: 1, bucket: 'visual-library', publicBaseUrl, state: 'verified', verifiedAt, objects })
    console.log(JSON.stringify({ verified: objects.length, enabled: JSON.parse(fs.readFileSync(configPath, 'utf8')).enabled }))
    return
  }
  for (const object of objects) {
    const target = path.join(uploadRoot, object.key)
    const bytes = fs.readFileSync(path.join(root, 'apps/miniprogram/src', object.localPath.slice(1)))
    if (fs.existsSync(target) && sha256(fs.readFileSync(target)) !== object.sha256) throw new Error('Refusing to overwrite different upload file: ' + target)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    if (!fs.existsSync(target)) fs.writeFileSync(target, bytes, { flag: 'wx' })
  }
  const current = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {}
  const stillVerified = current.enabled === true && current.verifiedAt && current.publicBaseUrl === publicBaseUrl && JSON.stringify(current.objects) === JSON.stringify(routes)
  writeJson(configPath, { enabled: Boolean(stillVerified), publicBaseUrl, verifiedAt: stillVerified ? current.verifiedAt : null, objects: routes })
  writeJson(planPath, { schemaVersion: 1, bucket: 'visual-library', publicBaseUrl, state: stillVerified ? 'verified' : 'pending-manual-upload', verifiedAt: stillVerified ? current.verifiedAt : null, objects })
  console.log(JSON.stringify({ files: objects.length, bytes: objects.reduce((n, x) => n + x.bytes, 0), uploadRoot, state: stillVerified ? 'verified' : 'pending-manual-upload', uploaded: 0 }))
}
module.exports = { collectObjects, verifyObject, publicBaseUrl }
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1 })
