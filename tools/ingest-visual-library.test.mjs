import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import sharp from 'sharp'

const require = createRequire(import.meta.url)
const {
  applyApprovals,
  dryRun,
  scanInbox,
  sha256,
  validateManifestState,
} = require('./ingest-visual-library.cjs')

const themes = ['light', 'dark', 'dawn', 'forest', 'lavender', 'minimal']
const repoRoot = path.resolve(import.meta.dirname, '..')
const frozen = {
  'dawn.jpg': '87a53e63c9aca67fb70bfc38f09166a33b8231fed0fcdb83152c6326e264914c',
  'forest.jpg': 'c3941575581faf2984c9c87df33cc8de7db50a058226ae078434e1820073c55f',
  'lavender.jpg': 'da0e225a3e06d4548b96dd0d44c1403037c1ea2bb3cc17c11221d9af415bb49b',
  'minimal.jpg': '19cc1f4be7756c6a6e45c574a9f44a0a690d728aa0efd9b7c5b0b60be72b5733',
  'mist.png': '2c22ccfb33ea549297714b12bf19ecdbf678f09debd50f3ce887a270038091db',
  'night.jpg': '4413c84833bb8ad61eb0c484e476919578dff2d814be12754906b0e40cf26dda',
}

const svgs = {
  window: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f7e7c6"/><stop offset="1" stop-color="#8ba888"/>
    </linearGradient></defs>
    <rect width="1200" height="800" fill="url(#g)"/>
    <rect x="130" y="100" width="430" height="540" rx="16" fill="#faf6e9" opacity=".9"/>
    <rect x="175" y="145" width="340" height="300" fill="#c3d5c0"/>
    <path d="M 0 720 L 260 540 L 480 800 Z" fill="#6f8f62"/>
    <circle cx="940" cy="205" r="115" fill="#fff2c2"/>
    <rect x="780" y="520" width="310" height="26" rx="13" fill="#6c513b"/>
    <rect x="805" y="470" width="150" height="50" rx="5" fill="#fffaf0"/>
  </svg>`,
  forest: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#cfe3cb"/><stop offset="1" stop-color="#31523d"/>
    </linearGradient></defs>
    <rect width="1200" height="800" fill="url(#g)"/>
    <path d="M 520 800 C 470 620 690 540 600 380 C 560 300 620 220 710 150" stroke="#d8c39d" stroke-width="80" fill="none"/>
    <g fill="#24452f"><circle cx="150" cy="230" r="150"/><circle cx="1020" cy="190" r="180"/><circle cx="900" cy="470" r="130"/><circle cx="230" cy="520" r="110"/></g>
    <g fill="#7c9b70"><circle cx="350" cy="120" r="80"/><circle cx="850" cy="360" r="70"/></g>
  </svg>`,
  night: `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#10182f"/><stop offset="1" stop-color="#536b73"/>
    </linearGradient></defs>
    <rect width="1200" height="800" fill="url(#g)"/>
    <circle cx="880" cy="190" r="105" fill="#f4e7b6"/>
    <path d="M 0 560 L 240 440 L 430 570 L 640 390 L 870 560 L 1200 430 L 1200 800 L 0 800 Z" fill="#16243a"/>
    <path d="M 0 680 Q 300 620 600 680 T 1200 650 L 1200 800 L 0 800 Z" fill="#223b4d"/>
    <g fill="#f8e8a9"><circle cx="170" cy="160" r="4"/><circle cx="300" cy="250" r="3"/><circle cx="460" cy="120" r="3"/><circle cx="690" cy="230" r="4"/><circle cx="1080" cy="100" r="3"/></g>
  </svg>`,
}

function hashFile(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

async function writeImage(file, variant, { format = 'png', quality = 90 } = {}) {
  const image = sharp(Buffer.from(svgs[variant]))
  if (format === 'jpeg') await image.jpeg({ quality }).toFile(file)
  else await image.png().toFile(file)
}

async function fixture({ descriptions = true } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agency-bloom-ingest-'))
  const inbox = path.join(root, 'assets/visual-library/inbox')
  const manifest = {
    $schema: './visual-manifest.schema.json',
    schemaVersion: 1,
    generatedAt: '2026-10-22',
    themes,
    visuals: [],
  }
  await mkdir(inbox, { recursive: true })
  await writeFile(path.join(root, 'assets/visual-manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  await mkdir(path.join(root, 'apps/miniprogram/src'), { recursive: true })
  await writeFile(path.join(root, 'apps/miniprogram/src/visual-manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  const names = {
    window: '晨光窗边.png',
    forest: 'file-b 002.jpeg',
    night: 'tree-3.jpg',
  }
  await writeImage(path.join(inbox, names.window), 'window')
  await writeImage(path.join(inbox, names.forest), 'forest', { format: 'jpeg', quality: 88 })
  await writeImage(path.join(inbox, names.night), 'night', { format: 'jpeg', quality: 88 })
  if (descriptions) {
    await writeFile(path.join(inbox, 'descriptions.json'), JSON.stringify({
      [names.window]: {
        description: '晨光里的窗边阅读，木桌和翻开的书，安静而温暖。',
        category: 'reflection',
        tags: ['window', 'reading', 'morning'],
        mood: ['quiet', 'warm'],
        intendedPage: ['discover', 'explore'],
        visualRole: ['card-thumbnail'],
        themeCompatibility: ['light', 'dawn'],
      },
      [names.forest]: {
        description: '林间小径通向远处，适合探索下一步方向。',
        category: 'direction',
        tags: ['forest', 'path', 'next-step'],
        mood: ['grounded', 'hopeful'],
        intendedPage: ['explore', 'plan'],
        visualRole: ['card-thumbnail', 'hero'],
        themeCompatibility: ['forest', 'light'],
      },
      [names.night]: {
        description: '夜色湖面和月亮，适合安静地停一停。',
        category: 'rest',
        tags: ['night', 'moon', 'lake'],
        mood: ['quiet'],
        intendedPage: ['discover', 'explore'],
        visualRole: ['card-thumbnail'],
        themeCompatibility: ['dark', 'minimal'],
      },
    }, null, 2) + '\n')
  }
  return { root, inbox, names }
}

async function approve(reviewDir, count = Infinity) {
  const file = path.join(reviewDir, 'approvals.json')
  const data = JSON.parse(await readFile(file, 'utf8'))
  data.approvals.forEach((item, index) => { item.approved = index < count })
  await writeFile(file, JSON.stringify(data, null, 2) + '\n')
  return file
}

test('dry-run is the default and keeps inbox, manifest and runtime untouched', async () => {
  const { root, inbox, names } = await fixture()
  try {
    const manifestBefore = readFileSync(path.join(root, 'assets/visual-manifest.json'))
    const inboxBefore = Object.fromEntries(await Promise.all(Object.values(names).map(async name => [name, hashFile(path.join(inbox, name))])))
    const result = await dryRun({ root, reviewDir: path.join(root, 'review') })
    assert.equal(result.status, 'dry-run')
    assert.equal(result.images, 3)
    assert.equal(result.readyToApprove, 3)
    assert.equal(result.manifestUntouched, true)
    assert.ok(readFileSync(path.join(root, 'assets/visual-manifest.json')).equals(manifestBefore))
    for (const [name, expected] of Object.entries(inboxBefore)) assert.equal(hashFile(path.join(inbox, name)), expected)

    const review = path.join(root, 'review')
    const checklist = readFileSync(path.join(review, 'approval-checklist.md'), 'utf8')
    assert.match(checklist, /晨光里的窗边阅读/)
    assert.match(checklist, /发现页/)
    assert.match(checklist, /dawn/)
    assert.ok(existsSync(path.join(review, 'contact-sheet.jpg')))
    assert.ok(existsSync(path.join(review, 'thumbs')))
    assert.ok(existsSync(path.join(review, 'crops')))
    const proposal = JSON.parse(readFileSync(path.join(review, 'proposal.json'), 'utf8'))
    assert.equal(proposal.proposals.length, 3)
    assert.ok(proposal.proposals.every(item => item.reviewStatus === 'needs-review'))
    assert.ok(proposal.proposals.every(item => item.cropPreview?.startsWith('review/crops/')))
    const approvals = JSON.parse(readFileSync(path.join(review, 'approvals.json'), 'utf8'))
    assert.ok(approvals.approvals.every(item => item.approved === false))
    assert.ok(approvals.approvals.every(item => item.suggestedName || item.id))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('apply preserves original bytes/extensions and creates role-specific derivatives', async () => {
  const { root, inbox, names } = await fixture()
  try {
    const review = path.join(root, 'review')
    await dryRun({ root, reviewDir: review })
    const approvals = await approve(review)
    const originalBytes = {
      window: await readFile(path.join(inbox, names.window)),
      forest: await readFile(path.join(inbox, names.forest)),
      night: await readFile(path.join(inbox, names.night)),
    }
    const result = await applyApprovals({ root, approvalsPath: approvals })
    assert.equal(result.status, 'applied', JSON.stringify(result.errors || result))
    assert.equal(result.entriesAdded.length, 3)
    assert.equal(result.validation.visuals, 3)
    const manifest = JSON.parse(readFileSync(path.join(root, 'assets/visual-manifest.json'), 'utf8'))
    assert.equal(manifest.visuals.length, 3)
    assert.deepEqual(manifest.visuals.map(item => item.id), result.entriesAdded)
    const canonical = readFileSync(path.join(root, 'assets/visual-manifest.json'))
    const runtimeCopy = readFileSync(path.join(root, 'apps/miniprogram/src/visual-manifest.json'))
    assert.ok(canonical.equals(runtimeCopy))
    for (const visual of manifest.visuals) {
      const source = readFileSync(path.join(root, visual.originalPath))
      assert.equal(sha256(source), visual.sourceSha256)
      assert.equal(source.length, visual.sourceBytes)
      if (visual.id.includes('window')) assert.deepEqual(source, originalBytes.window)
      for (const runtime of Object.values(visual.runtimeVariants)) {
        const meta = await sharp(path.join(root, 'apps/miniprogram/src', runtime.replace(/^\//, ''))).metadata()
        assert.equal(meta.format, 'jpeg')
        assert.equal(meta.width, 224)
        assert.equal(meta.height, 360)
      }
      for (const runtime of Object.values(visual.heroVariants)) {
        const meta = await sharp(path.join(root, 'apps/miniprogram/src', runtime.replace(/^\//, ''))).metadata()
        assert.equal(meta.width, 750)
        assert.equal(meta.height, 940)
      }
    }
    assert.ok(manifest.visuals.some(item => Object.keys(item.heroVariants).length > 0))
    assert.ok(manifest.visuals.some(item => item.originalPath.endsWith('.jpeg')))
    assert.ok(manifest.visuals.some(item => item.originalPath.endsWith('.png')))
    const validation = await validateManifestState({ root, manifest })
    assert.deepEqual(validation.errors, [])
    // Inbox files stay in place for a human to see what was imported.
    for (const name of Object.values(names)) assert.ok(existsSync(path.join(inbox, name)))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('unapproved files remain in inbox and repeated apply is idempotent', async () => {
  const { root, inbox, names } = await fixture()
  try {
    const review = path.join(root, 'review')
    await dryRun({ root, reviewDir: review })
    const approvals = await approve(review, 1)
    const first = await applyApprovals({ root, approvalsPath: approvals })
    assert.equal(first.status, 'applied', JSON.stringify(first.errors || first))
    assert.equal(first.entriesAdded.length, 1)
    const manifestAfterFirst = readFileSync(path.join(root, 'assets/visual-manifest.json'))
    const afterFirst = JSON.parse(manifestAfterFirst)
    assert.equal(afterFirst.visuals.length, 1)
    const approved = JSON.parse(readFileSync(approvals, 'utf8')).approvals
    assert.equal(approved.filter(item => item.approved).length, 1)
    for (const name of Object.values(names)) assert.ok(existsSync(path.join(inbox, name)))

    const second = await applyApprovals({ root, approvalsPath: approvals })
    assert.equal(second.status, 'already-applied')
    assert.equal(second.entriesAdded.length, 0)
    assert.ok(readFileSync(path.join(root, 'assets/visual-manifest.json')).equals(manifestAfterFirst))
    assert.equal(JSON.parse(readFileSync(path.join(root, 'assets/visual-manifest.json'), 'utf8')).visuals.length, 1)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('exact duplicates and likely visual duplicates are flagged without importing', async () => {
  const { root, inbox } = await fixture({ descriptions: false })
  try {
    const source = path.join(inbox, 'a-source.png')
    await writeImage(source, 'forest')
    await copyFile(source, path.join(inbox, 'b-exact-copy.png'))
    await writeImage(path.join(inbox, 'c-likely-copy.jpg'), 'forest', { format: 'jpeg', quality: 35 })
    await writeFile(path.join(inbox, 'descriptions.json'), JSON.stringify({
      'c-likely-copy.jpg': {
        description: '林间小径，适合探索方向。',
        category: 'direction',
        tags: ['path'],
        mood: ['hopeful'],
        intendedPage: ['explore'],
        visualRole: ['card-thumbnail'],
        themeCompatibility: ['forest'],
      },
    }, null, 2) + '\n')
    const scan = await scanInbox({ root, reviewDir: path.join(root, 'review') })
    const byFile = Object.fromEntries(scan.proposals.map(item => [item.file, item]))
    assert.equal(byFile['b-exact-copy.png'].reviewStatus, 'duplicate')
    assert.equal(byFile['b-exact-copy.png'].duplicateOf, 'a-source.png')
    assert.equal(byFile['c-likely-copy.jpg'].reviewStatus, 'needs-review')
    assert.ok(byFile['c-likely-copy.jpg'].likelyDuplicates.some(item => item.of === 'a-source.png'))
    assert.equal(byFile['c-likely-copy.jpg'].readyToApprove, false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('semantic proposals come from reviewed descriptions, never filenames', async () => {
  const { root, inbox, names } = await fixture({ descriptions: false })
  try {
    await writeFile(path.join(inbox, 'descriptions.json'), JSON.stringify({
      [names.night]: {
        description: '晨光里的窗边阅读，安静而温暖。',
      },
    }, null, 2) + '\n')
    const scan = await scanInbox({ root })
    const proposal = scan.proposals.find(item => item.file === names.night)
    assert.equal(proposal.category, 'reflection')
    assert.ok(proposal.tags.includes('window'))
    assert.ok(proposal.tags.includes('reading'))
    assert.ok(proposal.themeCompatibility.includes('dawn'))
    assert.ok(!proposal.themeCompatibility.includes('dark'))
    assert.ok(!proposal.tags.includes('night'))
    assert.equal(proposal.visualRole[0], 'card-thumbnail')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('dry-run reports id and runtime path conflicts without guessing from filenames', async () => {
  const { root, inbox, names } = await fixture({ descriptions: false })
  try {
    const manifestFile = path.join(root, 'assets/visual-manifest.json')
    const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
    manifest.visuals = [{
      id: 'taken_01',
      category: 'reflection',
      description: 'existing',
      tags: ['existing'],
      mood: [],
      intendedPage: ['explore'],
      visualRole: ['card-thumbnail'],
      themeCompatibility: ['light'],
      source: 'chatgpt-generated',
      originalPath: 'assets/visual-library/originals/reflection/taken_01.jpg',
      sourceSha256: 'a'.repeat(64),
      sourceBytes: 1,
      dimensions: { width: 1, height: 1, aspectRatio: 1 },
      status: 'deployed',
      deploy: true,
      sourceGroup: 'taken',
      runtimeVariants: {},
      heroVariants: {},
    }]
    await writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n')
    await writeFile(path.join(inbox, 'descriptions.json'), JSON.stringify({
      [names.window]: {
        id: 'taken_01',
        description: '经过复核的描述，但 ID 已被占用。',
        category: 'reflection',
        tags: ['reviewed'],
        mood: [],
        intendedPage: ['explore'],
        visualRole: ['card-thumbnail'],
        themeCompatibility: ['light'],
        sourceGroup: 'taken',
      },
      [names.night]: {
        id: 'path_conflict_01',
        description: '经过复核的描述，但运行路径已被占用。',
        category: 'rest',
        tags: ['reviewed'],
        mood: [],
        intendedPage: ['explore'],
        visualRole: ['card-thumbnail'],
        themeCompatibility: ['dark'],
        sourceGroup: 'night-path',
      },
    }, null, 2) + '\n')
    const blockedRuntime = path.join(root, 'apps/miniprogram/src/static/visuals/rest/path_conflict_01.jpg')
    await mkdir(path.dirname(blockedRuntime), { recursive: true })
    await writeFile(blockedRuntime, 'occupied')
    const scan = await scanInbox({ root })
    const proposal = scan.proposals.find(item => item.file === names.window)
    assert.equal(proposal.reviewStatus, 'conflict', JSON.stringify(proposal))
    assert.ok(proposal.conflicts.some(item => item.includes('id already exists')))
    assert.ok(proposal.conflicts.some(item => item.includes('sourceGroup already exists')))
    assert.equal(proposal.category, 'reflection')
    const pathProposal = scan.proposals.find(item => item.file === names.night)
    assert.equal(pathProposal.reviewStatus, 'conflict', JSON.stringify(pathProposal))
    assert.ok(pathProposal.conflicts.some(item => item.includes('runtime path already exists')))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('derivative repair is idempotent and does not duplicate an entry', async () => {
  const { root } = await fixture()
  try {
    const review = path.join(root, 'review')
    await dryRun({ root, reviewDir: review })
    const approvals = await approve(review)
    const first = await applyApprovals({ root, approvalsPath: approvals })
    assert.equal(first.status, 'applied', JSON.stringify(first.errors || first))
    const manifest = JSON.parse(readFileSync(path.join(root, 'assets/visual-manifest.json'), 'utf8'))
    const visual = manifest.visuals[0]
    const runtime = Object.values(visual.runtimeVariants)[0]
    const runtimeFile = path.join(root, 'apps/miniprogram/src', runtime.replace(/^\//, ''))
    await rm(runtimeFile)
    const repaired = await applyApprovals({ root, approvalsPath: approvals })
    assert.equal(repaired.status, 'repaired', JSON.stringify(repaired.errors || repaired))
    assert.equal(repaired.entriesAdded.length, 0)
    assert.ok(existsSync(runtimeFile))
    assert.equal(JSON.parse(readFileSync(path.join(root, 'assets/visual-manifest.json'), 'utf8')).visuals.length, 3)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a failed final validation rolls back manifests and newly created files', async () => {
  const { root } = await fixture()
  try {
    const review = path.join(root, 'review')
    await dryRun({ root, reviewDir: review })
    const approvals = await approve(review, 1)
    const manifestFile = path.join(root, 'assets/visual-manifest.json')
    const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'))
    manifest.visuals.push({
      id: 'broken_01',
      category: 'rest',
      description: 'broken fixture entry',
      tags: ['broken'],
      mood: [],
      intendedPage: ['explore'],
      visualRole: ['card-thumbnail'],
      themeCompatibility: ['light'],
      source: 'chatgpt-generated',
      originalPath: 'assets/visual-library/originals/rest/broken_01.jpg',
      sourceSha256: '0'.repeat(64),
      sourceBytes: 1,
      dimensions: { width: 1, height: 1, aspectRatio: 1 },
      status: 'deployed',
      deploy: true,
      sourceGroup: 'broken',
      runtimeVariants: { light: '/static/visuals/rest/broken_01.jpg' },
      heroVariants: {},
    })
    await writeFile(manifestFile, JSON.stringify(manifest, null, 2) + '\n')
    await writeFile(path.join(root, 'apps/miniprogram/src/visual-manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
    const before = readFileSync(manifestFile)
    const result = await applyApprovals({ root, approvalsPath: approvals })
    assert.equal(result.status, 'failed')
    assert.ok(readFileSync(manifestFile).equals(before))
    assert.equal(JSON.parse(readFileSync(manifestFile, 'utf8')).visuals.length, 1)
    const proposed = JSON.parse(readFileSync(approvals, 'utf8')).approvals[0]
    assert.equal(
      existsSync(path.join(root, `assets/visual-library/originals/${proposed.category}/${proposed.id}${path.extname(proposed.file)}`)),
      false,
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('frozen theme references stay byte-identical', () => {
  for (const [name, expected] of Object.entries(frozen)) {
    assert.equal(hashFile(path.join(repoRoot, 'design/themes/references', name)), expected)
  }
})

test('apply preserves a pre-existing staged Git change', { skip: spawnSync('git', ['--version']).status !== 0 }, async () => {
  const { root } = await fixture()
  try {
    const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' })
    assert.equal(git('init').status, 0)
    await writeFile(path.join(root, 'sentinel.txt'), 'do not touch\n')
    assert.equal(git('add', 'sentinel.txt').status, 0)
    const review = path.join(root, 'review')
    await dryRun({ root, reviewDir: review })
    const approvals = await approve(review, 1)
    const result = await applyApprovals({ root, approvalsPath: approvals })
    assert.equal(result.status, 'applied', JSON.stringify(result.errors || result))
    const staged = git('diff', '--cached', '--name-only')
    assert.equal(staged.status, 0)
    assert.equal(staged.stdout.trim(), 'sentinel.txt')
    assert.equal(readFileSync(path.join(root, 'sentinel.txt'), 'utf8'), 'do not touch\n')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
