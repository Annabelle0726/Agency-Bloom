// Stage only the avatar badge hunks from index.vue.
const { execSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const file = 'apps/miniprogram/src/pages/index/index.vue'
const diff = execSync(`git --no-pager diff -- ${file}`, { encoding: 'utf8' })
const lines = diff.split('\n')
const firstHunk = lines.findIndex(l => l.startsWith('@@'))
if (firstHunk < 0) { console.log('no unstaged diff'); process.exit(0) }
const header = lines.slice(0, firstHunk).join('\n')
const markers = ['avatar-edit-badge', 'setting-description">可选']
const hunkBounds = []
lines.forEach((l, n) => { if (l.startsWith('@@')) hunkBounds.push(n) })
const wanted = new Set()
for (const marker of markers) {
  let hit = -1
  lines.forEach((l, n) => { if (hit < 0 && l.includes(marker)) hit = n })
  if (hit < 0) continue
  let start = 0, end = lines.length
  for (const b of hunkBounds) { if (b <= hit) start = b; else if (b > hit && b < end) { end = b; break } }
  for (let n = start; n < end; n++) wanted.add(n)
}
if (!wanted.size) { console.log('no matching hunks (already staged)'); process.exit(0) }
const sorted = [...wanted].sort((a, b) => a - b)
const ranges = []
let from = sorted[0], prev = sorted[0]
for (const v of sorted.slice(1)) { if (v === prev + 1) { prev = v; continue } ranges.push([from, prev]); from = prev = v }
ranges.push([from, prev])
const hunks = ranges.map(([a, b]) => lines.slice(a, b + 1).join('\n')).join('\n')
const patchPath = path.join(os.tmpdir(), 'badge-fix.patch')
fs.writeFileSync(patchPath, header + '\n' + hunks + '\n', 'utf8')
console.log('staged hunks:', ranges.length)
execSync(`git apply --cached "${patchPath}"`, { stdio: 'inherit' })
console.log(hunks.split('\n').filter(l => l.startsWith('+') || l.startsWith('-')).join('\n'))
