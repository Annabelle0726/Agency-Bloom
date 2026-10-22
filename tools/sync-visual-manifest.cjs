// Keep the Mini Program copy of the visual manifest byte-identical to the
// canonical library manifest. Use --check in CI to fail instead of writing.
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const source = path.join(root, 'assets/visual-manifest.json')
const target = path.join(root, 'apps/miniprogram/src/visual-manifest.json')
const check = process.argv.includes('--check')

const sourceBytes = fs.readFileSync(source)
if (check) {
  if (!fs.existsSync(target)) {
    console.error(`Missing generated manifest: ${path.relative(root, target)}`)
    process.exitCode = 1
  } else if (!sourceBytes.equals(fs.readFileSync(target))) {
    console.error('Visual manifest copy is stale. Run npm run visuals:sync.')
    process.exitCode = 1
  } else {
    console.log(`Visual manifest is synchronized (${sourceBytes.length} bytes).`)
  }
} else {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, sourceBytes)
  console.log(`Synced visual manifest to ${path.relative(root, target)} (${sourceBytes.length} bytes).`)
}
