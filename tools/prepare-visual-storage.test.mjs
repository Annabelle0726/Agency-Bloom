import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

const require = createRequire(import.meta.url)
const { collectObjects, verifyObject } = require('./prepare-visual-storage.cjs')
const root = path.resolve(import.meta.dirname, '..')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/visual-manifest.json'), 'utf8'))
const configPath = path.join(root, 'apps/miniprogram/src/visual-storage.json')
const hash = value => createHash('sha256').update(value).digest('hex')
const bytes = Buffer.from('reviewed jpeg content')
const object = { key: 'growth/growth_example_01.jpg', url: 'https://example.test/x.jpg', bytes: bytes.length, sha256: hash(bytes) }

test('manual upload plan includes every deployed derivative once and excludes archives', () => {
  const objects = collectObjects(manifest, root)
  const expected = new Set(manifest.visuals.filter(v => v.deploy).flatMap(v => [...Object.values(v.runtimeVariants), ...Object.values(v.heroVariants)]))
  assert.deepEqual(new Set(objects.map(o => o.localPath)), expected)
  assert.equal(new Set(objects.map(o => o.key)).size, objects.length)
  assert.ok(objects.every(o => manifest.visuals.some(v => v.id === o.visualId && v.deploy)))
  const plan = JSON.parse(fs.readFileSync(path.join(root, 'assets/visual-library/storage-upload-plan.json'), 'utf8'))
  assert.deepEqual(plan.objects, objects)
})

test('storage preparation rejects conflicting runtime ownership', () => {
  const first = manifest.visuals.find(v => v.deploy && Object.keys(v.runtimeVariants).length)
  assert.throws(() => collectObjects({ visuals: [first, { ...first, id: 'conflict' }] }, root), /conflicting owners/)
})

test('verification accepts only HTTP 200 JPEG with exact reviewed content', async () => {
  await verifyObject(object, async (_url, options) => {
    assert.equal(options.redirect, 'error')
    return new Response(bytes, { status: 200, headers: { 'content-type': 'image/jpeg; charset=binary' } })
  })
  await assert.rejects(verifyObject(object, async () => new Response(bytes, { status: 404 })), /HTTP 404/)
  await assert.rejects(verifyObject(object, async () => new Response(bytes, { status: 200, headers: { 'content-type': 'text/html' } })), /image\/jpeg/)
  await assert.rejects(verifyObject(object, async () => new Response('different', { status: 200, headers: { 'content-type': 'image/jpeg' } })), /content differs/)
})

test('activation without verification cannot change the runtime configuration', () => {
  const before = fs.readFileSync(configPath)
  const result = spawnSync(process.execPath, [path.join(root, 'tools/prepare-visual-storage.cjs'), '--activate'], { encoding: 'utf8' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /requires --verify/)
  assert.ok(before.equals(fs.readFileSync(configPath)))
})
