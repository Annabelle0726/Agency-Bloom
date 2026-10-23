import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
// Preserve the approved corpus and frozen contracts; do not regenerate them.
const contracts = [
  ['apps/api/evaluation/cases.json', 'ff9eae83082b7c8e56f6b857b687507a55b3e7e6aec40cbf8811c3a1a4b13b41'],
  ['apps/api/evaluation/live_first/manifest.json', '414c87a168f3ef71557d39e7fa26c3a30c829617d7868194598e34034d975b3d'],
  ['apps/api/evaluation/live_first/rubric.json', 'ec4857952af02bb84b6ca16dcd433bce2b5db1ab96f3c29e7b60e11f9e7ba9a8'],
]

for (const [file, expected] of contracts) {
  test(`${file} keeps its hash through a Windows Git checkout`, () => {
    const temporary = mkdtempSync(path.join(tmpdir(), 'bloom-frozen-checkout-'))
    const original = readFileSync(path.join(root, file))
    try {
      const git = (...args) => execFileSync('git', args, { cwd: temporary, stdio: ['ignore', 'pipe', 'pipe'] })
      git('init', '--quiet')
      writeFileSync(path.join(temporary, '.gitattributes'), readFileSync(path.join(root, '.gitattributes')))
      mkdirSync(path.dirname(path.join(temporary, file)), { recursive: true })
      writeFileSync(path.join(temporary, file), original)
      assert.equal(sha(original), expected, 'Do not change the frozen input or rubric')
      const blob = git('hash-object', '-w', '--path=' + file, file).toString().trim()
      for (const automatic of ['true', 'false', 'input']) {
        const checkout = git('-c', 'core.autocrlf=' + automatic, 'cat-file', '--filters', '--path=' + file, blob)
        assert.equal(sha(checkout), expected, `core.autocrlf=${automatic} must preserve the approved hash`)
        assert.deepEqual(checkout, original)
      }
    } finally {
      rmSync(temporary, { recursive: true, force: true })
    }
  })
}
