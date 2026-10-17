import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const source = path.join(root, 'apps/miniprogram/src/night-home.scss')
const artifact = path.join(root, 'apps/miniprogram/dist/dev/mp-weixin/app.wxss')
const marker = 'agency-watch-probe-' + Date.now()
const original = await readFile(source, 'utf8')
const probe = `\n.${marker} { width:17px; }\n`
async function waitFor(present) {
  const deadline = Date.now() + 25000
  while (Date.now() < deadline) {
    try { if ((await readFile(artifact, 'utf8')).includes(marker) === present) return }
    catch { /* The watcher can briefly replace the artifact */ }
    await new Promise(resolve => setTimeout(resolve, 400))
  }
  throw Error('SCSS watcher did not ' + (present ? 'compile the external style' : 'remove the restored probe') + '; start npm run dev:mp first')
}
try {
  await writeFile(source, original + probe)
  await waitFor(true)
  console.log('PASS external SCSS edit reached native app.wxss')
} finally {
  const current = await readFile(source, 'utf8')
  // Remove only this probe if another editor changed the file during the check
  await writeFile(source, current === original + probe ? original : current.replace(probe, ''))
  await waitFor(false)
  console.log('PASS source restored and native app.wxss updated again')
}
