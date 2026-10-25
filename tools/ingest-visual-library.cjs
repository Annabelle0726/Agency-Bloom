#!/usr/bin/env node
/*
 * Reusable visual-library inbox ingester.
 *
 * Dry-run is the default and writes only review artifacts. --apply reads an
 * approved checklist, then stages originals/derivatives and updates both
 * manifests as one rollback-safe batch. Inbox files are never moved or deleted.
 */
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const sharpDefault = require('sharp')

const THEMES = ['light', 'dark', 'dawn', 'forest', 'lavender', 'minimal']
const CATEGORIES = [
  'choices', 'connection', 'direction', 'growth', 'reflection',
  'rest', 'transition',
]
// 'reference' exists in the manifest for the reference-only design screenshot;
// it can never be set on a new inbox approval, only tolerated during validation.
const MANIFEST_CATEGORIES = [...CATEGORIES, 'reference']
const PAGES = ['discover', 'explore', 'plan', 'shared']
const ROLES = ['hero', 'page-background', 'card-thumbnail', 'section-illustration', 'decorative']
const CARD_ROLES = new Set(['card-thumbnail', 'section-illustration', 'decorative'])
const HERO_ROLES = new Set(['hero', 'page-background'])
const SOURCE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.jfif'])
const LIKELY_DUPLICATE_DISTANCE = 5
const PAGE_LABELS = {
  discover: '发现页',
  explore: '聊天探索',
  plan: '计划页',
  shared: '分享',
}
const DEFAULT_ROOT = path.resolve(__dirname, '..')
const IGNORED_INBOX = new Set(['.gitignore', 'README.md', 'approvals.json', 'approvals.template.json', 'descriptions.json'])
const CATEGORY_HINTS = [
  ['choices', ['选择', '比较', '取舍', '岔路', 'offer', 'choice', 'choose', 'compare', 'decision', 'branch']],
  ['connection', ['沟通', '朋友', '同事', '关系', '连接', 'connect', 'friend', 'people', 'together']],
  ['direction', ['方向', '路径', '出发', '未来', 'path', 'direction', 'journey']],
  ['growth', ['生长', '花', '学习', '成长', 'grow', 'flower', 'spring', 'learn', 'meadow']],
  ['reflection', ['阅读', '书', '窗边', '回看', '反思', 'read', 'book', 'window', 'desk', 'write', 'reflection']],
  ['rest', ['休息', '安静', '夜', '湖', '暂停', 'rest', 'quiet', 'night', 'moon', 'pause', 'lake']],
  ['transition', ['过渡', '转变', '季节', '换季', 'turn', 'transition', 'season', 'shift']],
]
const TAG_HINTS = [
  ['window', ['窗', 'window']],
  ['reading', ['阅读', '书', 'read', 'book']],
  ['desk', ['桌', 'desk']],
  ['morning', ['晨', '早', 'morning', 'dawn']],
  ['sunlight', ['阳光', '日光', 'sunlight', 'sun']],
  ['forest', ['森林', '树林', 'forest', 'woods']],
  ['path', ['路', '小径', 'path', 'trail']],
  ['lake', ['湖', 'lake']],
  ['night', ['夜', '晚', 'night']],
  ['moon', ['月', 'moon']],
  ['quiet', ['安静', '宁静', '静', 'quiet', 'calm', 'still']],
  ['warm', ['温暖', '暖', 'warm']],
  ['new-beginning', ['开始', '出发', '新', 'begin', 'start']],
  ['choice', ['选择', 'choice', 'decide']],
  ['rest', ['休息', '停一停', 'rest', 'pause']],
]
const MOOD_HINTS = [
  ['quiet', ['安静', '宁静', 'quiet', 'calm']],
  ['warm', ['温暖', '暖', 'warm']],
  ['hopeful', ['希望', '晨光', '新', 'hopeful', 'morning']],
  ['reflective', ['阅读', '书', 'reflection', 'reflective']],
  ['grounded', ['森林', '树', 'grounded', 'forest']],
]
const SLUG_HINTS = [
  ['window', ['窗', 'window']],
  ['reading', ['阅读', '书', 'read', 'book']],
  ['desk', ['桌', 'desk']],
  ['morning', ['晨', '早', 'morning', 'dawn']],
  ['forest', ['森林', '树', 'forest']],
  ['path', ['路', '小径', 'path', 'trail']],
  ['lake', ['湖', 'lake']],
  ['night', ['夜', 'night']],
  ['moon', ['月', 'moon']],
  ['quiet', ['安静', '宁静', 'quiet', 'calm']],
  ['meadow', ['草地', '草甸', 'meadow']],
  ['book', ['书', 'book']],
]

function posix(value) {
  return value.split(path.sep).join('/')
}
function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n')
}
function manifestPath(root) {
  return path.join(root, 'assets/visual-manifest.json')
}
function runtimeManifestPath(root) {
  return path.join(root, 'apps/miniprogram/src/visual-manifest.json')
}
function runtimeFile(root, runtimePath) {
  return path.join(root, 'apps/miniprogram/src', runtimePath.replace(/^\//, ''))
}
function safeBasename(name) {
  if (typeof name !== 'string' || !name.trim()) throw new Error('file must be a non-empty basename')
  const base = path.basename(name)
  if (base !== name || base === '.' || base === '..') throw new Error('file must stay inside inbox')
  return base
}
function extensionOf(file) {
  const ext = path.extname(file).toLowerCase()
  return SOURCE_EXTENSIONS.has(ext) ? ext : null
}
function isImageCandidate(name) {
  return !IGNORED_INBOX.has(name) &&
    !name.startsWith('review-') &&
    !name.startsWith('.') &&
    Boolean(extensionOf(name))
}
function uniqueStrings(values) {
  return [...new Set((values || []).filter(value => typeof value === 'string' && value.trim()))]
}
function hasAny(text, words) {
  return words.some(word => text.includes(word.toLowerCase()))
}
function inferCategory(description) {
  let best = null, bestScore = 0
  for (const [category, words] of CATEGORY_HINTS) {
    const score = words.reduce((sum, word) => sum + (description.includes(word.toLowerCase()) ? 1 : 0), 0)
    if (score > bestScore) { best = category; bestScore = score }
  }
  return bestScore > 0 ? best : null
}
function inferTags(description) {
  return uniqueStrings(TAG_HINTS.filter(([, words]) => hasAny(description, words)).map(([tag]) => tag)).slice(0, 10)
}
function inferMood(description) {
  return uniqueStrings(MOOD_HINTS.filter(([, words]) => hasAny(description, words)).map(([mood]) => mood)).slice(0, 6)
}
function inferPages(description) {
  const pages = []
  if (hasAny(description, ['发现', 'discover'])) pages.push('discover')
  if (hasAny(description, ['探索', '聊天', 'explore', 'chat'])) pages.push('explore')
  if (hasAny(description, ['计划', '下一步', 'plan', 'next step'])) pages.push('plan')
  if (hasAny(description, ['分享', 'share'])) pages.push('shared')
  return uniqueStrings(pages)
}
function inferThemes(description) {
  const themes = []
  if (hasAny(description, ['深夜', '夜色', '暗', '夜', 'dark', 'night'])) themes.push('dark')
  if (hasAny(description, ['晨', '黎明', '日出', '暖光', 'dawn', 'morning'])) themes.push('dawn')
  if (hasAny(description, ['森林', '树林', '绿', 'forest', 'green'])) themes.push('forest')
  if (hasAny(description, ['紫', '薰衣草', 'lavender', 'violet'])) themes.push('lavender')
  if (hasAny(description, ['极简', '留白', 'minimal', 'ivory'])) themes.push('minimal')
  if (hasAny(description, ['浅色', '明亮', '白天', 'light', 'bright'])) themes.push('light')
  return uniqueStrings(themes)
}
function inferRoles(description) {
  const roles = []
  if (hasAny(description, ['主图', '首图', 'hero', 'banner'])) roles.push('hero')
  if (hasAny(description, ['背景', 'background'])) roles.push('page-background')
  if (roles.length === 0 || hasAny(description, ['卡片', '缩略', 'card', 'thumbnail'])) roles.push('card-thumbnail')
  return uniqueStrings(roles)
}
function slugWords(description) {
  const words = []
  for (const [word, hints] of SLUG_HINTS) {
    if (hasAny(description, hints)) words.push(word)
  }
  const ascii = description.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) || []
  return uniqueStrings([...words, ...ascii.filter(word => !['the', 'and', 'with', 'from', 'this', 'that'].includes(word))]).slice(0, 4)
}
function suggestId(description, category, sha, existingIds) {
  const words = slugWords(description)
  const base = (words.length ? words.join('_') : `${category || 'visual'}_${sha.slice(0, 8)}`)
    .replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').slice(0, 52) || `visual_${sha.slice(0, 8)}`
  let index = 1
  while (existingIds.has(`${base}_${String(index).padStart(2, '0')}`)) index++
  const id = `${base}_${String(index).padStart(2, '0')}`
  existingIds.add(id)
  return id
}
function sourceGroupFor(id, existingGroups) {
  const base = id.replace(/_\d+$/, '').replace(/_/g, '-')
  let group = base, index = 2
  while (existingGroups.has(group)) { group = `${base}-${index}`; index++ }
  existingGroups.add(group)
  return group
}
async function dHash(input, sharpModule) {
  const { data } = await sharpModule(input).rotate().resize(9, 8, { fit: 'fill' }).greyscale().raw()
    .toBuffer({ resolveWithObject: true })
  let bits = ''
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) bits += data[y * 9 + x] < data[y * 9 + x + 1] ? '1' : '0'
  }
  return BigInt(`0b${bits}`).toString(16).padStart(16, '0')
}
function hamming(left, right) {
  let value = BigInt(`0x${left}`) ^ BigInt(`0x${right}`)
  let count = 0
  while (value) { count += Number(value & 1n); value >>= 1n }
  return count
}
function findLikelyDuplicates(hash, known) {
  return known
    .map(item => ({ ...item, distance: hamming(hash, item.hash) }))
    .filter(item => item.distance <= LIKELY_DUPLICATE_DISTANCE)
    .sort((left, right) => left.distance - right.distance || (left.label < right.label ? -1 : left.label > right.label ? 1 : 0))
}
function normalizeDescriptions(value) {
  const map = new Map()
  if (!value) return map
  const entries = Array.isArray(value) ? value : (Array.isArray(value.images) ? value.images : Object.entries(value).map(([file, info]) => ({ file, ...(typeof info === 'string' ? { description: info } : info) })))
  for (const item of entries) {
    if (!item || typeof item !== 'object') continue
    const file = typeof item.file === 'string' ? path.basename(item.file) : null
    if (file) map.set(file, item)
  }
  return map
}
function entryFromApproval(approval, bytes, metadata, paths) {
  return {
    id: approval.id,
    category: approval.category,
    description: approval.description.trim(),
    tags: uniqueStrings(approval.tags),
    mood: uniqueStrings(approval.mood),
    intendedPage: uniqueStrings(approval.intendedPage),
    visualRole: uniqueStrings(approval.visualRole),
    themeCompatibility: uniqueStrings(approval.themeCompatibility),
    source: 'user-supplied-design-reference',
    originalPath: paths.originalPath,
    sourceSha256: sha256(bytes),
    sourceBytes: bytes.length,
    dimensions: {
      width: metadata.width,
      height: metadata.height,
      aspectRatio: Number((metadata.width / metadata.height).toFixed(3)),
    },
    status: 'deployed',
    deploy: true,
    sourceGroup: approval.sourceGroup,
    runtimeVariants: paths.runtimeVariants,
    heroVariants: paths.heroVariants,
  }
}
function validateApproval(approval) {
  const errors = []
  if (!approval || typeof approval !== 'object') return ['approval is not an object']
  if (approval.approved !== true) return []
  if (!/^[a-z0-9_]+$/.test(approval.id || '')) errors.push('id must use lowercase letters, numbers and underscores')
  if (!CATEGORIES.includes(approval.category)) errors.push('category is not approved')
  if (typeof approval.description !== 'string' || !approval.description.trim()) errors.push('description is required')
  if (!Array.isArray(approval.tags) || !uniqueStrings(approval.tags).length) errors.push('at least one tag is required')
  if (!Array.isArray(approval.intendedPage) || !approval.intendedPage.length) errors.push('intendedPage is required')
  if (!Array.isArray(approval.visualRole) || !approval.visualRole.length) errors.push('visualRole is required')
  if (!Array.isArray(approval.themeCompatibility) || !approval.themeCompatibility.length) errors.push('Theme compatibility is required')
  if (!Array.isArray(approval.mood)) errors.push('mood must be an array')
  if (typeof approval.sourceGroup !== 'string' || !approval.sourceGroup.trim()) errors.push('sourceGroup is required')
  for (const page of approval.intendedPage || []) if (!PAGES.includes(page)) errors.push(`invalid page ${page}`)
  for (const role of approval.visualRole || []) if (!ROLES.includes(role)) errors.push(`invalid role ${role}`)
  for (const theme of approval.themeCompatibility || []) if (!THEMES.includes(theme)) errors.push(`invalid Theme ${theme}`)
  if (!Array.isArray(approval.intendedPage) || !approval.intendedPage.some(page => PAGES.includes(page))) errors.push('no legal page use')
  if (!Array.isArray(approval.visualRole) || !approval.visualRole.some(role => ROLES.includes(role))) errors.push('no legal visual role')
  return errors
}
function approvalPaths(approval) {
  const runtimeVariants = {}
  const heroVariants = {}
  const themes = uniqueStrings(approval.themeCompatibility)
  if (themes.some(theme => THEMES.includes(theme)) && approval.visualRole.some(role => CARD_ROLES.has(role))) {
    const file = `/static/visuals/${approval.category}/${approval.id}.jpg`
    for (const theme of themes) runtimeVariants[theme] = file
  }
  if (themes.some(theme => THEMES.includes(theme)) && approval.visualRole.some(role => HERO_ROLES.has(role))) {
    const file = `/static/visuals/hero/${approval.id}.jpg`
    for (const theme of themes) heroVariants[theme] = file
  }
  return {
    originalPath: `assets/visual-library/originals/${approval.category}/${approval.id}${extensionOf(approval.file) || '.jpg'}`,
    runtimeVariants,
    heroVariants,
  }
}
function collectRuntimeOwners(visuals) {
  const owners = new Map()
  for (const visual of visuals) {
    for (const runtime of [...Object.values(visual.runtimeVariants || {}), ...Object.values(visual.heroVariants || {})]) {
      if (owners.has(runtime)) owners.set(runtime, `${owners.get(runtime)}|${visual.id}`)
      else owners.set(runtime, visual.id)
    }
  }
  return owners
}
async function validateManifestState({ root, manifest, sharpModule = sharpDefault }) {
  const errors = []
  const ids = new Set(), originals = new Set(), owners = new Map()
  const archiveFile = path.join(root, "assets/visual-library/source-archive.json")
  const archived = fs.existsSync(archiveFile) ? JSON.parse(fs.readFileSync(archiveFile, "utf8")).objects : []
  const themes = new Set(THEMES)
  for (const visual of manifest.visuals || []) {
    const label = visual.id || '(missing id)'
    // Reference-only design screenshots use the dedicated 'reference' category
    // and the 'reference-only' page/role markers, which are not inbox values.
    const referenceLane = visual.status === 'reference-only'
    for (const field of ['id', 'category', 'description', 'tags', 'mood', 'intendedPage', 'visualRole', 'themeCompatibility', 'source', 'originalPath', 'sourceSha256', 'sourceBytes', 'dimensions', 'status', 'deploy', 'sourceGroup', 'runtimeVariants', 'heroVariants']) {
      if (!Object.prototype.hasOwnProperty.call(visual, field)) errors.push(`${label}: missing ${field}`)
    }
    if (!/^[a-z0-9_]+$/.test(visual.id || '')) errors.push(`${label}: invalid id`)
    if (ids.has(visual.id)) errors.push(`${label}: duplicate id`)
    ids.add(visual.id)
    if (originals.has(visual.originalPath)) errors.push(`${label}: duplicate original path`)
    originals.add(visual.originalPath)
    if (!MANIFEST_CATEGORIES.includes(visual.category)) errors.push(`${label}: invalid category`)
    if (typeof visual.description !== 'string' || !visual.description.trim()) errors.push(`${label}: description required`)
    if (!Array.isArray(visual.tags) || !visual.tags.length) errors.push(`${label}: tags required`)
    if (!Array.isArray(visual.mood)) errors.push(`${label}: mood must be an array`)
    if (!referenceLane && (!Array.isArray(visual.intendedPage) || !visual.intendedPage.length || visual.intendedPage.some(page => !PAGES.includes(page)))) errors.push(`${label}: invalid intendedPage`)
    if (!referenceLane && (!Array.isArray(visual.visualRole) || !visual.visualRole.length || visual.visualRole.some(role => !ROLES.includes(role)))) errors.push(`${label}: invalid visualRole`)
    if (!Array.isArray(visual.themeCompatibility) || visual.themeCompatibility.some(theme => !themes.has(theme))) errors.push(`${label}: invalid themeCompatibility`)
    if (!/^[a-f0-9]{64}$/.test(visual.sourceSha256 || '')) errors.push(`${label}: invalid source SHA-256`)
    if (!Number.isInteger(visual.sourceBytes) || visual.sourceBytes <= 0) errors.push(`${label}: invalid sourceBytes`)
    if (!visual.dimensions || !Number.isInteger(visual.dimensions.width) || !Number.isInteger(visual.dimensions.height) || visual.dimensions.width <= 0 || visual.dimensions.height <= 0) errors.push(`${label}: invalid dimensions`)
    if (!['deployed', 'archived', 'reference-only'].includes(visual.status)) errors.push(`${label}: invalid status`)
    if (visual.deploy !== (visual.status === 'deployed')) errors.push(`${label}: deploy/status mismatch`)
    if (!visual.source || !['chatgpt-generated', 'user-supplied-design-reference'].includes(visual.source)) errors.push(`${label}: invalid source`)
    if (typeof visual.sourceGroup !== 'string' || !visual.sourceGroup) errors.push(`${label}: sourceGroup required`)
    const original = path.join(root, visual.originalPath || '')
    if (!fs.existsSync(original)) {
      const receipt = archived.find(o => o.localPath === visual.originalPath && o.verifiedAt)
      if (!receipt || receipt.sha256 !== visual.sourceSha256 || receipt.bytes !== visual.sourceBytes || receipt.url !== visual.originalUrl) errors.push(`${label}: missing verified original ${visual.originalPath}`)
    }
    else {
      const bytes = fs.readFileSync(original)
      if (sha256(bytes) !== visual.sourceSha256) errors.push(`${label}: original SHA-256 mismatch`)
      if (bytes.length !== visual.sourceBytes) errors.push(`${label}: original byte size mismatch`)
    }
    if (visual.status !== 'deployed' && (Object.keys(visual.runtimeVariants || {}).length || Object.keys(visual.heroVariants || {}).length)) {
      errors.push(`${label}: non-deployed visual has runtime files`)
    }
    for (const [theme, runtimePath] of Object.entries(visual.runtimeVariants || {})) {
      if (!themes.has(theme)) errors.push(`${label}: invalid runtime Theme ${theme}`)
      if (!visual.themeCompatibility.includes(theme)) errors.push(`${label}: runtime Theme ${theme} is not compatible`)
      if (!runtimePath.startsWith('/static/') || !runtimePath.endsWith('.jpg')) errors.push(`${label}: invalid runtime path`)
      if (owners.has(runtimePath) && owners.get(runtimePath) !== label) errors.push(`${label}: runtime path shared with ${owners.get(runtimePath)} (${runtimePath})`)
      owners.set(runtimePath, label)
      const file = runtimeFile(root, runtimePath)
      if (!fs.existsSync(file)) errors.push(`${label}: missing runtime file ${runtimePath}`)
      else {
        try {
          const meta = await sharpModule(file).metadata()
          if (meta.format !== 'jpeg') errors.push(`${label}: runtime is not JPEG`)
          if (meta.width !== 224 || meta.height !== 360) errors.push(`${label}: runtime is ${meta.width}x${meta.height}, expected 224x360`)
        } catch { errors.push(`${label}: cannot read runtime ${runtimePath}`) }
      }
    }
    for (const [theme, runtimePath] of Object.entries(visual.heroVariants || {})) {
      if (!themes.has(theme)) errors.push(`${label}: invalid hero Theme ${theme}`)
      if (!visual.themeCompatibility.includes(theme)) errors.push(`${label}: hero Theme ${theme} is not compatible`)
      if (!runtimePath.startsWith('/static/') || !runtimePath.endsWith('.jpg')) errors.push(`${label}: invalid hero path`)
      if (owners.has(runtimePath) && owners.get(runtimePath) !== label) errors.push(`${label}: hero path shared with ${owners.get(runtimePath)} (${runtimePath})`)
      owners.set(runtimePath, label)
      const file = runtimeFile(root, runtimePath)
      if (!fs.existsSync(file)) errors.push(`${label}: missing hero file ${runtimePath}`)
      else {
        try {
          const meta = await sharpModule(file).metadata()
          if (meta.format !== 'jpeg') errors.push(`${label}: hero is not JPEG`)
          if (meta.width !== 750 || meta.height !== 940) errors.push(`${label}: hero is ${meta.width}x${meta.height}, expected 750x940`)
        } catch { errors.push(`${label}: cannot read hero ${runtimePath}`) }
      }
    }
  }
  const runtimeCopy = runtimeManifestPath(root)
  const canonical = manifestPath(root)
  if (fs.existsSync(runtimeCopy) && fs.existsSync(canonical)) {
    if (!fs.readFileSync(canonical).equals(fs.readFileSync(runtimeCopy))) errors.push('runtime manifest copy is stale')
  }
  return {
    errors,
    stats: {
      visuals: (manifest.visuals || []).length,
      runtimeFiles: owners.size,
    },
  }
}
async function knownDhash(manifest, root, sharpModule) {
  const result = []
  for (const visual of manifest.visuals || []) {
    if (!visual.originalPath) continue
    const file = path.join(root, visual.originalPath)
    if (!fs.existsSync(file)) continue
    try {
      result.push({ label: visual.id, hash: await dHash(fs.readFileSync(file), sharpModule) })
    } catch { /* An unreadable legacy original is reported by manifest validation. */ }
  }
  return result
}
function proposalFields(info, description, sha, existingIds, existingGroups) {
  const category = info.category || inferCategory(description) || null
  const tags = uniqueStrings(info.tags || inferTags(description))
  const mood = uniqueStrings(info.mood || inferMood(description))
  const intendedPage = uniqueStrings(info.intendedPage || inferPages(description))
  const visualRole = uniqueStrings(info.visualRole || inferRoles(description))
  const themeCompatibility = uniqueStrings(info.themeCompatibility || inferThemes(description))
  const id = info.id || suggestId(description, category, sha, existingIds)
  return {
    id,
    sourceGroup: info.sourceGroup || sourceGroupFor(id, existingGroups),
    category,
    description,
    tags,
    mood,
    intendedPage,
    visualRole,
    themeCompatibility,
  }
}
function proposalSummary(proposal) {
  return {
    file: proposal.file,
    sourceSha256: proposal.sourceSha256,
    bytes: proposal.bytes,
    format: proposal.format,
    width: proposal.width,
    height: proposal.height,
    suggestedId: proposal.id,
    suggestedName: proposal.proposedName,
    category: proposal.category,
    description: proposal.description,
    tags: proposal.tags,
    mood: proposal.mood,
    intendedPage: proposal.intendedPage,
    visualRole: proposal.visualRole,
    themeCompatibility: proposal.themeCompatibility,
    sourceGroup: proposal.sourceGroup,
    reviewStatus: proposal.reviewStatus,
    readyToApprove: proposal.readyToApprove,
    duplicateOf: proposal.duplicateOf || null,
    likelyDuplicates: proposal.likelyDuplicates || [],
    conflicts: proposal.conflicts || [],
    cropPreview: proposal.cropPreview || null,
    heroCropPreview: proposal.heroCropPreview || null,
  }
}
function approvalTemplate(proposals) {
  return {
    generatedAt: new Date().toISOString(),
    note: 'Review the checklist first. Set approved=true only for files you have inspected and approved. Unconfirmed files stay in inbox.',
    approvals: proposals.map(proposal => ({
      file: proposal.file,
      approved: false,
      id: proposal.id,
      description: proposal.description,
      category: proposal.category,
      tags: proposal.tags,
      mood: proposal.mood,
      intendedPage: proposal.intendedPage,
      visualRole: proposal.visualRole,
      themeCompatibility: proposal.themeCompatibility,
      sourceGroup: proposal.sourceGroup,
      sourceSha256: proposal.sourceSha256,
      reviewStatus: proposal.reviewStatus,
      readyToApprove: proposal.readyToApprove,
    })),
  }
}
async function scanInbox({ root = DEFAULT_ROOT, inboxDir, descriptionsPath, reviewDir, sharpModule = sharpDefault } = {}) {
  root = path.resolve(root)
  inboxDir = path.resolve(inboxDir || path.join(root, 'assets/visual-library/inbox'))
  const canonical = manifestPath(root)
  if (!fs.existsSync(canonical)) throw new Error(`Missing manifest: ${canonical}`)
  const manifest = readJson(canonical)
  const descriptions = normalizeDescriptions(
    descriptionsPath && fs.existsSync(descriptionsPath)
      ? readJson(descriptionsPath)
      : (fs.existsSync(path.join(inboxDir, 'descriptions.json')) ? readJson(path.join(inboxDir, 'descriptions.json')) : null),
  )
  const existingIds = new Set((manifest.visuals || []).map(visual => visual.id))
  const existingGroups = new Set((manifest.visuals || []).map(visual => visual.sourceGroup).filter(Boolean))
  const existingBySha = new Map((manifest.visuals || []).map(visual => [visual.sourceSha256, visual]))
  const runtimeOwners = collectRuntimeOwners(manifest.visuals || [])
  const known = await knownDhash(manifest, root, sharpModule)
  const priorBySha = new Map()
  const priorHashes = []
  const proposals = []
  const files = new Map()
  const skipped = []
  if (!fs.existsSync(inboxDir)) {
    return { root, inboxDir, manifest, proposals, files, skipped, known }
  }
  const entries = (await fsp.readdir(inboxDir, { withFileTypes: true }))
    .filter(entry => entry.isFile() && isImageCandidate(entry.name))
    .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))
  for (const entry of entries) {
    const file = entry.name
    const sourcePath = path.join(inboxDir, file)
    const ext = extensionOf(file)
    const bytes = await fsp.readFile(sourcePath)
    const sourceSha256 = sha256(bytes)
    let metadata, hash
    try {
      metadata = await sharpModule(bytes, { failOn: 'error' }).metadata()
      hash = await dHash(bytes, sharpModule)
    } catch {
      proposals.push({
        file, sourceSha256, bytes: bytes.length, format: null, width: null, height: null,
        reviewStatus: 'invalid', readyToApprove: false, conflicts: ['cannot read image'],
        id: null, suggestedName: null, category: null, description: '', tags: [], mood: [],
        intendedPage: [], visualRole: [], themeCompatibility: [], sourceGroup: null,
      })
      files.set(file, sourcePath)
      continue
    }
    const format = metadata.format
    const conflicts = []
    if (!['jpeg', 'png'].includes(format)) conflicts.push(`unsupported format ${format}`)
    if (!metadata.width || !metadata.height) conflicts.push('missing dimensions')
    const duplicateExisting = existingBySha.get(sourceSha256)
    const duplicatePrior = priorBySha.get(sourceSha256)
    let duplicateOf = null
    if (duplicatePrior || duplicateExisting) {
      duplicateOf = duplicatePrior || duplicateExisting.id
      conflicts.push(`exact duplicate of ${duplicateOf}`)
    }
    const likelyDuplicates = duplicateOf ? [] : findLikelyDuplicates(
      hash,
      [...known, ...priorHashes],
    ).map(item => ({ of: item.label, distance: item.distance }))
    const info = descriptions.get(file) || {}
    const description = typeof info.description === 'string' ? info.description.trim() : ''
    const fields = proposalFields(info, description, sourceSha256, existingIds, existingGroups)
    if (info.id && !existingIds.has(fields.id)) existingIds.add(fields.id)
    if (info.id && (manifest.visuals || []).some(visual => visual.id === fields.id)) {
      conflicts.push(`id already exists: ${fields.id}`)
    }
    if (info.sourceGroup && !existingGroups.has(fields.sourceGroup)) existingGroups.add(fields.sourceGroup)
    if (info.sourceGroup && (manifest.visuals || []).some(visual => visual.sourceGroup === fields.sourceGroup)) {
      conflicts.push(`sourceGroup already exists: ${fields.sourceGroup}`)
    }
    const paths = approvalPaths({ ...fields, file, category: fields.category || 'review' })
    if (fields.category && fs.existsSync(path.join(root, paths.originalPath))) conflicts.push(`original path already exists: ${paths.originalPath}`)
    for (const runtimePath of [...Object.values(paths.runtimeVariants), ...Object.values(paths.heroVariants)]) {
      if (runtimeOwners.has(runtimePath) || fs.existsSync(runtimeFile(root, runtimePath))) {
        conflicts.push(`runtime path already exists: ${runtimePath}`)
      }
    }
    const reviewStatus = duplicateOf ? 'duplicate' : conflicts.length ? 'conflict' : 'needs-review'
    const readyToApprove = reviewStatus === 'needs-review' && likelyDuplicates.length === 0 && Boolean(description && fields.category && fields.tags.length && fields.intendedPage.length && fields.themeCompatibility.length && fields.visualRole.length)
    const proposal = {
      file,
      sourceSha256,
      bytes: bytes.length,
      format,
      width: metadata.width,
      height: metadata.height,
      originalExtension: ext,
      ...fields,
      reviewStatus,
      readyToApprove,
      duplicateOf,
      likelyDuplicates,
      conflicts,
      proposedName: fields.id ? `${fields.id}${ext || '.jpg'}` : null,
      proposedRuntimeName: fields.id ? `${fields.id}.jpg` : null,
    }
    priorBySha.set(sourceSha256, file)
    priorHashes.push({ label: file, hash })
    proposals.push(proposal)
    files.set(file, sourcePath)
  }
  if (reviewDir) {
    await writeReviewArtifacts({ root, inboxDir, reviewDir, proposals, files, sharpModule })
  }
  return { root, inboxDir, manifest, proposals, files, skipped, known }
}
function mdEscape(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
}
function reviewLabel(status) {
  return {
    duplicate: '重复，不导入',
    conflict: '冲突，需处理',
    invalid: '无法读取',
    'needs-review': '待确认',
  }[status] || status
}
async function writeReviewArtifacts({ root, inboxDir, reviewDir, proposals, files, sharpModule }) {
  const thumbs = path.join(reviewDir, 'thumbs')
  const crops = path.join(reviewDir, 'crops')
  await fsp.mkdir(thumbs, { recursive: true })
  await fsp.mkdir(crops, { recursive: true })
  for (const [index, proposal] of proposals.entries()) {
    const source = files.get(proposal.file)
    if (!source) continue
    const safe = `p${index + 1}-${proposal.sourceSha256.slice(0, 8)}`
    const thumb = path.join(thumbs, `${safe}.jpg`)
    const crop = path.join(crops, `${safe}.jpg`)
    try {
      await sharpModule(source).rotate().resize(180, 180, { fit: 'cover', position: 'attention' })
        .jpeg({ quality: 82 }).toFile(thumb)
      await sharpModule(source).rotate().resize(224, 360, { fit: 'cover', position: 'attention' })
        .jpeg({ quality: 75, mozjpeg: true }).toFile(crop)
      proposal.cropPreview = posix(path.relative(root, crop))
      proposal.thumbnail = posix(path.relative(root, thumb))
      if (proposal.visualRole?.some(role => HERO_ROLES.has(role))) {
        const hero = path.join(crops, `${safe}-hero.jpg`)
        await sharpModule(source).rotate().resize(750, 940, { fit: 'cover', position: 'attention' })
          .jpeg({ quality: 75, mozjpeg: true }).toFile(hero)
        proposal.heroCropPreview = posix(path.relative(root, hero))
      }
    } catch {
      proposal.cropPreview = null
      proposal.thumbnail = null
    }
  }
  const sheetPath = path.join(reviewDir, 'contact-sheet.jpg')
  await writeContactSheet(proposals, thumbs, sheetPath, sharpModule)
  const summary = proposals.map(proposalSummary)
  writeJson(path.join(reviewDir, 'proposal.json'), {
    generatedAt: new Date().toISOString(),
    inbox: posix(path.relative(root, inboxDir)),
    proposals: summary,
    skipped: [],
  })
  const template = approvalTemplate(proposals)
  writeJson(path.join(reviewDir, 'approvals.json'), template)
  const lines = [
    '# 视觉入库审批清单',
    '',
    '先看缩略图、建议名称、类别、页面用途、Theme 和裁切预览，再只把确认过的条目设为 `approved: true`。未确认的文件继续留在 inbox。',
    '',
    `审批文件：\`${posix(path.relative(root, path.join(reviewDir, 'approvals.json')))}\``,
    '',
    '![contact sheet](contact-sheet.jpg)',
    '',
    '| # | 缩略图 | 文件 | 建议 ID / 文件名 | 类别 | 页面用途 | Theme | 裁切预览 | 状态 | 复核描述 |',
    '| - | - | - | - | - | - | - | - | - | - |',
  ]
  for (const [index, proposal] of proposals.entries()) {
    const thumb = proposal.thumbnail ? `![thumb](${posix(path.relative(reviewDir, path.join(root, proposal.thumbnail)))})` : '—'
    const crop = proposal.cropPreview ? `[card](${posix(path.relative(reviewDir, path.join(root, proposal.cropPreview)))})` : '—'
    const hero = proposal.heroCropPreview ? ` [hero](${posix(path.relative(reviewDir, path.join(root, proposal.heroCropPreview)))})` : ''
    const pages = (proposal.intendedPage || []).map(page => PAGE_LABELS[page] || page).join('、') || '待确认'
    const themes = (proposal.themeCompatibility || []).join('、') || '待确认'
    lines.push(`| ${index + 1} | ${thumb} | \`${mdEscape(proposal.file)}\` | \`${mdEscape(proposal.proposedName || proposal.id || '待确认')}\` | ${mdEscape(proposal.category || '待确认')} | ${mdEscape(pages)} | ${mdEscape(themes)} | ${crop}${hero} | ${reviewLabel(proposal.reviewStatus)} | ${mdEscape(proposal.description || '待确认')} |`)
  }
  lines.push('', '## 说明', '', '- 工具不会从文件名推断语义标签；缺少经过复核的描述时，条目保持待确认。', '- 重复图片、路径冲突或无法读取的文件不会因为勾选 `approved` 就绕过检查。', '- `--apply` 只处理明确标为 `approved: true` 的条目。')
  await fsp.writeFile(path.join(reviewDir, 'approval-checklist.md'), lines.join('\n') + '\n')
}
async function writeContactSheet(proposals, thumbs, target, sharpModule) {
  const count = proposals.length
  if (!count) return
  const columns = Math.min(4, count)
  const cellW = 200, cellH = 232, pad = 12
  const rows = Math.ceil(count / columns)
  const width = columns * cellW + pad, height = rows * cellH + pad
  const composites = []
  for (const [index, proposal] of proposals.entries()) {
    const thumb = path.join(thumbs, `p${index + 1}-${proposal.sourceSha256.slice(0, 8)}.jpg`)
    if (!fs.existsSync(thumb)) continue
    const left = pad + (index % columns) * cellW
    const top = pad + Math.floor(index / columns) * cellH
    composites.push({ input: thumb, left, top, label: false })
    const label = mdEscape(proposal.file).slice(0, 23)
    const svg = Buffer.from(`<svg width="180" height="34" xmlns="http://www.w3.org/2000/svg"><text x="0" y="20" font-family="sans-serif" font-size="11" fill="#574b3d">${label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`)
    composites.push({ input: svg, left: left + 10, top: top + 184, label: true })
  }
  try {
    await sharpModule({ create: { width, height, channels: 3, background: '#f5f0e7' } })
      .composite(composites).jpeg({ quality: 84 }).toFile(target)
  } catch {
    // A contact sheet is a review aid. If the SVG labels cannot render, keep
    // the thumbnails and checklist usable rather than failing ingestion.
    const simple = composites.filter(item => item.label === false)
    await sharpModule({ create: { width, height, channels: 3, background: '#f5f0e7' } })
      .composite(simple).jpeg({ quality: 84 }).toFile(target)
  }
}
function planStageFiles(entry, bytes) {
  return {
    original: { relative: entry.originalPath, bytes },
    runtime: Object.values(entry.runtimeVariants)[0] || null,
    hero: Object.values(entry.heroVariants)[0] || null,
  }
}
async function stageDerivative(sharpModule, bytes, relative, kind, stageRoot) {
  const target = path.join(stageRoot, relative)
  await fsp.mkdir(path.dirname(target), { recursive: true })
  const image = sharpModule(bytes).rotate()
  if (kind === 'hero') image.resize(750, 940, { fit: 'cover', position: 'attention' })
  else image.resize(224, 360, { fit: 'cover', position: 'attention' })
  await image.jpeg({ quality: 73, mozjpeg: true }).toFile(target)
  const meta = await sharpModule(target).metadata()
  if (meta.format !== 'jpeg' || meta.width !== (kind === 'hero' ? 750 : 224) || meta.height !== (kind === 'hero' ? 940 : 360)) {
    throw new Error(`bad staged derivative dimensions for ${relative}`)
  }
}
async function writeManifests(root, manifest) {
  const bytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n')
  await fsp.mkdir(path.dirname(manifestPath(root)), { recursive: true })
  await fsp.mkdir(path.dirname(runtimeManifestPath(root)), { recursive: true })
  await fsp.writeFile(manifestPath(root), bytes)
  await fsp.writeFile(runtimeManifestPath(root), bytes)
  return bytes
}
async function applyApprovals({
  root = DEFAULT_ROOT,
  inboxDir,
  approvalsPath,
  reviewDir,
  sharpModule = sharpDefault,
} = {}) {
  root = path.resolve(root)
  inboxDir = path.resolve(inboxDir || path.join(root, 'assets/visual-library/inbox'))
  approvalsPath = path.resolve(approvalsPath || path.join(inboxDir, 'approvals.json'))
  if (!fs.existsSync(approvalsPath)) {
    return { status: 'no-approvals', message: '没有找到审批文件；请先 dry-run 并填写 approvals.json。', entriesAdded: [], filesAdded: [] }
  }
  const manifest = readJson(manifestPath(root))
  const raw = readJson(approvalsPath)
  const approvals = (Array.isArray(raw) ? raw : raw.approvals || []).filter(item => item && item.approved === true)
  if (!approvals.length) {
    return { status: 'no-approved-items', message: '审批文件中没有 approved: true 的条目；inbox 和 manifest 未改动。', entriesAdded: [], filesAdded: [] }
  }
  const errors = []
  const newPlans = []
  const repairs = []
  const plannedIds = new Set()
  const plannedOriginals = new Set()
  const plannedRuntimes = new Set()
  const plannedGroups = new Set()
  const repairedIds = new Set()
  const byId = new Map((manifest.visuals || []).map(visual => [visual.id, visual]))
  const bySha = new Map((manifest.visuals || []).map(visual => [visual.sourceSha256, visual]))
  const owners = collectRuntimeOwners(manifest.visuals || [])
  const groups = new Set((manifest.visuals || []).map(visual => visual.sourceGroup).filter(Boolean))
  for (const approval of approvals) {
    let file
    try { file = safeBasename(approval.file) } catch (error) { errors.push(`${approval.file || '(missing file)'}: ${error.message}`); continue }
    const sourcePath = path.join(inboxDir, file)
    if (!fs.existsSync(sourcePath)) { errors.push(`${file}: missing from inbox`); continue }
    const bytes = await fsp.readFile(sourcePath)
    const sourceSha256 = sha256(bytes)
    if (approval.sourceSha256 && approval.sourceSha256 !== sourceSha256) {
      errors.push(`${file}: source changed since review; run dry-run again`)
      continue
    }
    const fieldErrors = validateApproval({ ...approval, file })
    if (fieldErrors.length) { errors.push(...fieldErrors.map(error => `${file}: ${error}`)); continue }
    const existingById = byId.get(approval.id)
    const existingBySha = bySha.get(sourceSha256)
    if (existingById) {
      if (existingById.sourceSha256 !== sourceSha256) {
        errors.push(`${file}: id ${approval.id} already exists with different bytes`)
        continue
      }
      const missing = []
      const missingByKey = new Map()
      if (!fs.existsSync(path.join(root, existingById.originalPath))) {
        missing.push({ kind: 'original', relative: existingById.originalPath })
        missingByKey.set(existingById.originalPath, true)
      }
      for (const runtimePath of Object.values(existingById.runtimeVariants || {})) {
        if (!missingByKey.has(runtimePath) && !fs.existsSync(runtimeFile(root, runtimePath))) {
          missing.push({ kind: 'card', relative: runtimePath })
          missingByKey.set(runtimePath, true)
        }
      }
      for (const runtimePath of Object.values(existingById.heroVariants || {})) {
        if (!missingByKey.has(runtimePath) && !fs.existsSync(runtimeFile(root, runtimePath))) {
          missing.push({ kind: 'hero', relative: runtimePath })
          missingByKey.set(runtimePath, true)
        }
      }
      if (missing.length && !repairedIds.has(existingById.id)) {
        repairs.push({ approval, file, bytes, entry: existingById, missing })
        repairedIds.add(existingById.id)
      }
      continue
    }
    if (existingBySha) {
      errors.push(`${file}: identical bytes already exist as ${existingBySha.id}`)
      continue
    }
    const ext = extensionOf(file)
    if (!ext) { errors.push(`${file}: unsupported original extension`); continue }
    if (plannedIds.has(approval.id)) { errors.push(`${file}: duplicate id in this approval batch: ${approval.id}`); continue }
    if (groups.has(approval.sourceGroup) || plannedGroups.has(approval.sourceGroup)) {
      errors.push(`${file}: sourceGroup already exists: ${approval.sourceGroup}`)
      continue
    }
    let metadata
    try { metadata = await sharpModule(bytes).metadata() } catch { errors.push(`${file}: cannot read image`); continue }
    if (!['jpeg', 'png'].includes(metadata.format) || !metadata.width || !metadata.height) {
      errors.push(`${file}: unsupported image format or dimensions`)
      continue
    }
    const fields = approval
    const paths = approvalPaths({ ...fields, file })
    if (plannedIds.has(fields.id)) { errors.push(`${file}: duplicate id ${fields.id}`); continue }
    if (plannedOriginals.has(paths.originalPath)) { errors.push(`${file}: duplicate original path ${paths.originalPath}`); continue }
    if (fs.existsSync(path.join(root, paths.originalPath))) {
      errors.push(`${file}: original path already exists: ${paths.originalPath}`)
      continue
    }
    let runtimeConflict = false
    for (const runtimePath of [...Object.values(paths.runtimeVariants), ...Object.values(paths.heroVariants)]) {
      if (plannedRuntimes.has(runtimePath) || owners.has(runtimePath) || fs.existsSync(runtimeFile(root, runtimePath))) {
        errors.push(`${file}: runtime path already exists: ${runtimePath}`)
        runtimeConflict = true
      }
    }
    if (runtimeConflict) continue
    if (!Object.keys(paths.runtimeVariants).length && !Object.keys(paths.heroVariants).length) {
      errors.push(`${file}: role/Theme combination produced no legal derivative`)
      continue
    }
    const entry = entryFromApproval({ ...fields, file }, bytes, metadata, paths)
    plannedIds.add(entry.id)
    plannedGroups.add(entry.sourceGroup)
    plannedOriginals.add(entry.originalPath)
    for (const runtimePath of [...Object.values(entry.runtimeVariants), ...Object.values(entry.heroVariants)]) plannedRuntimes.add(runtimePath)
    newPlans.push({ approval, file, bytes, entry, paths })
  }
  if (errors.length) return { status: 'failed', errors, entriesAdded: [], filesAdded: [], entriesPreserved: (manifest.visuals || []).length }
  if (!newPlans.length && !repairs.length) {
    return { status: 'already-applied', message: '所有已批准条目都已存在，未生成重复记录。', entriesAdded: [], filesAdded: [], entriesPreserved: (manifest.visuals || []).length }
  }
  const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'agency-visual-ingest-'))
  const staged = []
  try {
    for (const plan of newPlans) {
      const original = path.join(tempRoot, plan.entry.originalPath)
      await fsp.mkdir(path.dirname(original), { recursive: true })
      await fsp.writeFile(original, plan.bytes)
      staged.push({ relative: plan.entry.originalPath, source: original })
      if (Object.keys(plan.entry.runtimeVariants).length) {
        const runtimePath = Object.values(plan.entry.runtimeVariants)[0]
        const relative = `apps/miniprogram/src${runtimePath}`
        await stageDerivative(sharpModule, plan.bytes, relative, 'card', tempRoot)
        staged.push({ relative, source: path.join(tempRoot, relative) })
      }
      if (Object.keys(plan.entry.heroVariants).length) {
        const heroPath = Object.values(plan.entry.heroVariants)[0]
        const relative = `apps/miniprogram/src${heroPath}`
        await stageDerivative(sharpModule, plan.bytes, relative, 'hero', tempRoot)
        staged.push({ relative, source: path.join(tempRoot, relative) })
      }
    }
    for (const repair of repairs) {
      if (repair.missing.some(item => item.kind === 'original')) {
        const original = path.join(tempRoot, repair.entry.originalPath)
        await fsp.mkdir(path.dirname(original), { recursive: true })
        await fsp.writeFile(original, repair.bytes)
        staged.push({ relative: repair.entry.originalPath, source: original })
      }
      for (const item of repair.missing.filter(item => item.kind !== 'original')) {
        const relative = `apps/miniprogram/src${item.relative}`
        await stageDerivative(sharpModule, repair.bytes, relative, item.kind, tempRoot)
        staged.push({ relative, source: path.join(tempRoot, relative) })
      }
    }
    const nextManifest = newPlans.length
      ? { ...manifest, visuals: [...(manifest.visuals || []), ...newPlans.map(plan => plan.entry)] }
      : manifest
    const manifestBefore = fs.existsSync(manifestPath(root)) ? fs.readFileSync(manifestPath(root)) : null
    const runtimeBefore = fs.existsSync(runtimeManifestPath(root)) ? fs.readFileSync(runtimeManifestPath(root)) : null
    const created = []
    try {
      for (const item of staged) {
        const target = path.join(root, item.relative)
        if (fs.existsSync(target)) throw new Error(`refusing to overwrite existing file ${item.relative}`)
        await fsp.mkdir(path.dirname(target), { recursive: true })
        created.push(target)
        await fsp.copyFile(item.source, target)
      }
      if (newPlans.length) await writeManifests(root, nextManifest)
      const validation = await validateManifestState({ root, manifest: nextManifest, sharpModule })
      if (validation.errors.length) throw new Error(validation.errors.join('; '))
      return {
        status: newPlans.length ? 'applied' : 'repaired',
        entriesAdded: newPlans.map(plan => plan.entry.id),
        entriesPreserved: (manifest.visuals || []).length,
        filesAdded: created.map(file => posix(path.relative(root, file))),
        repaired: repairs.map(repair => repair.entry.id),
        validation: validation.stats,
        inboxUntouched: true,
      }
    } catch (error) {
      if (manifestBefore) await fsp.writeFile(manifestPath(root), manifestBefore)
      else await fsp.rm(manifestPath(root), { force: true })
      if (runtimeBefore) await fsp.writeFile(runtimeManifestPath(root), runtimeBefore)
      else await fsp.rm(runtimeManifestPath(root), { force: true })
      for (const file of created.reverse()) await fsp.rm(file, { force: true })
      return { status: 'failed', errors: [error.message], entriesAdded: [], filesAdded: [], entriesPreserved: (manifest.visuals || []).length }
    }
  } finally {
    await fsp.rm(tempRoot, { recursive: true, force: true })
  }
}
async function dryRun(options = {}) {
  const root = path.resolve(options.root || DEFAULT_ROOT)
  const inboxDir = path.resolve(options.inboxDir || path.join(root, 'assets/visual-library/inbox'))
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-')
  const reviewDir = path.resolve(options.reviewDir || path.join(inboxDir, `review-${stamp}`))
  const scan = await scanInbox({
    root,
    inboxDir,
    descriptionsPath: options.descriptionsPath || path.join(inboxDir, 'descriptions.json'),
    reviewDir,
    sharpModule: options.sharpModule,
  })
  const summary = scan.proposals.map(proposalSummary)
  return {
    status: 'dry-run',
    reviewDirectory: posix(path.relative(root, reviewDir)),
    approvalsFile: posix(path.relative(root, path.join(reviewDir, 'approvals.json'))),
    checklist: posix(path.relative(root, path.join(reviewDir, 'approval-checklist.md'))),
    contactSheet: posix(path.relative(root, path.join(reviewDir, 'contact-sheet.jpg'))),
    images: summary.length,
    readyToApprove: summary.filter(proposal => proposal.readyToApprove).length,
    needsReview: summary.filter(proposal => proposal.reviewStatus === 'needs-review').length,
    exactDuplicates: summary.filter(proposal => proposal.reviewStatus === 'duplicate').length,
    likelyDuplicates: summary.filter(proposal => proposal.likelyDuplicates.length).length,
    conflicts: summary.filter(proposal => proposal.reviewStatus === 'conflict').length,
    invalid: summary.filter(proposal => proposal.reviewStatus === 'invalid').length,
    proposals: summary,
    inboxUntouched: true,
    manifestUntouched: true,
  }
}
function parseArgs(argv) {
  const flags = new Set(), values = {}
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (!arg.startsWith('--')) continue
    const [key, inline] = arg.slice(2).split('=', 2)
    if (inline !== undefined) values[key] = inline
    else if (argv[index + 1] && !argv[index + 1].startsWith('--')) values[key] = argv[++index]
    else flags.add(key)
  }
  return { flags, values }
}
async function main() {
  const { flags, values } = parseArgs(process.argv.slice(2))
  const root = path.resolve(values.root || DEFAULT_ROOT)
  const inboxDir = path.resolve(values.inbox || path.join(root, 'assets/visual-library/inbox'))
  const common = {
    root,
    inboxDir,
    descriptionsPath: values.descriptions ? path.resolve(values.descriptions) : path.join(inboxDir, 'descriptions.json'),
    sharpModule: sharpDefault,
  }
  let result
  if (flags.has('apply')) {
    result = await applyApprovals({
      ...common,
      approvalsPath: values.approvals ? path.resolve(values.approvals) : path.join(inboxDir, 'approvals.json'),
    })
  } else {
    result = await dryRun({ ...common, reviewDir: values['review-dir'] ? path.resolve(values['review-dir']) : undefined })
  }
  console.log(JSON.stringify(result, null, 2))
  if (result.status === 'failed') process.exitCode = 1
}
module.exports = {
  THEMES,
  CATEGORIES,
  PAGES,
  ROLES,
  approvalPaths,
  approvalTemplate,
  applyApprovals,
  dHash,
  dryRun,
  hamming,
  inferCategory,
  inferPages,
  inferTags,
  inferThemes,
  normalizeDescriptions,
  proposalSummary,
  scanInbox,
  sha256,
  validateApproval,
  validateManifestState,
  writeReviewArtifacts,
}
if (require.main === module) {
  main().catch(error => { console.error(error); process.exitCode = 1 })
}
