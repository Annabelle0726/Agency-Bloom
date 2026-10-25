// Generate committed visual-library contact sheets and a page-composition preview.
// Source originals are used for the sheets; runtime derivatives are used for the preview.
const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')
const { resolveSourcePath } = require('./source-archive.cjs')

const root = path.resolve(__dirname, '..')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/visual-manifest.json'), 'utf8'))
const outputDir = path.join(root, 'docs/visual-library/contact-sheets')
const previewDir = path.join(root, 'docs/visual-library')
fs.mkdirSync(outputDir, { recursive: true })

const byId = new Map(manifest.visuals.map(visual => [visual.id, visual]))
const deployed = manifest.visuals.filter(visual => visual.status === 'deployed')

function escapeText(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function linesFor(value, max) {
  const words = String(value).split(/\s+/)
  const lines = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (next.length > max && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

function sourceFile(visual) {
  return resolveSourcePath(visual.originalPath)
}

async function thumb(visual) {
  const image = await sharp(sourceFile(visual))
    .rotate()
    .resize({ width: 320, height: 220, fit: 'contain', background: '#e9e0d3', withoutEnlargement: false })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer()
  return `data:image/jpeg;base64,${image.toString('base64')}`
}

const groups = [
  {
    file: 'discover',
    title: 'DISCOVER',
    subtitle: 'Hero and question-card candidates. Cards are rendered at 224x360 on screen.',
    items: () => deployed.filter(visual => visual.intendedPage.includes('discover')),
  },
  {
    file: 'explore',
    title: 'EXPLORE',
    subtitle: 'Compact welcome-screen visual inside the chat/exploration surface.',
    items: () => deployed.filter(visual => visual.intendedPage.includes('explore')),
  },
  {
    file: 'plan',
    title: 'PLAN',
    subtitle: 'Plan atmosphere and the top-right decision-card image.',
    items: () => deployed.filter(visual => visual.intendedPage.includes('plan')),
  },
  {
    file: 'shared-decorative',
    title: 'SHARED / DECORATIVE',
    subtitle: 'Page backgrounds and atmosphere assets shared by more than one surface.',
    items: () => deployed.filter(visual =>
      visual.intendedPage.includes('shared') ||
      visual.visualRole.includes('page-background') ||
      visual.visualRole.includes('decorative')),
  },
  {
    file: 'archive-reference',
    title: 'ARCHIVE / REFERENCE-ONLY',
    subtitle: 'Masters kept for provenance or design intent. None of these are runtime candidates.',
    items: () => manifest.visuals.filter(visual => visual.status !== 'deployed'),
  },
]

async function writeSheet(group) {
  const items = group.items().sort((left, right) =>
    (left.status === right.status ? 0 : left.status === 'deployed' ? -1 : 1) ||
    left.category.localeCompare(right.category) ||
    left.id.localeCompare(right.id))
  const columns = 4
  const cellWidth = 340
  const cellImageHeight = 220
  const cellHeight = 396
  const gap = 24
  const margin = 48
  const headerHeight = 116
  const width = margin * 2 + columns * cellWidth + (columns - 1) * gap
  const rows = Math.ceil(items.length / columns)
  const height = headerHeight + rows * cellHeight + (rows - 1) * gap + margin
  const parts = []
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`)
  parts.push(`<rect width="${width}" height="${height}" fill="#f4eee4"/>`)
  parts.push(`<text x="${margin}" y="54" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="30" font-weight="700" fill="#342b25">${escapeText(group.title)} CONTACT SHEET</text>`)
  parts.push(`<text x="${margin}" y="82" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="13" fill="#655b51">${escapeText(group.subtitle)}</text>`)
  parts.push(`<text x="${width - margin}" y="54" text-anchor="end" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="13" fill="#655b51">${items.length} assets · source originals · 2026-10-22</text>`)
  parts.push(`<line x1="${margin}" y1="98" x2="${width - margin}" y2="98" stroke="#d9ccbd"/>`)

  for (let index = 0; index < items.length; index++) {
    const visual = items[index]
    const column = index % columns
    const row = Math.floor(index / columns)
    const x = margin + column * (cellWidth + gap)
    const y = headerHeight + row * (cellHeight + gap)
    const uri = await thumb(visual)
    const pages = visual.intendedPage.join(', ')
    const roles = visual.visualRole.join(', ')
    const themes = visual.themeCompatibility.length ? visual.themeCompatibility.join(', ') : 'none (reference)'
    const original = visual.originalPath.split('/').pop()
    parts.push(`<rect x="${x}" y="${y}" width="${cellWidth}" height="${cellHeight}" rx="16" fill="#fffaf2" stroke="#ded2c3"/>`)
    parts.push(`<rect x="${x + 10}" y="${y + 10}" width="${cellWidth - 20}" height="${cellImageHeight}" rx="10" fill="#e9e0d3"/>`)
    parts.push(`<image x="${x + 10}" y="${y + 10}" width="${cellWidth - 20}" height="${cellImageHeight}" preserveAspectRatio="xMidYMid meet" href="${uri}"/>`)
    parts.push(`<text x="${x + 18}" y="${y + 258}" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="17" font-weight="700" fill="#2f2823">${escapeText(visual.id)}</text>`)
    parts.push(`<text x="${x + 18}" y="${y + 278}" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="11.5" fill="#655b51">${escapeText(visual.category)} · ${escapeText(visual.status)} · ${visual.dimensions.width}x${visual.dimensions.height}</text>`)
    let labelY = y + 296
    for (const line of linesFor(`page: ${pages}`, 50).slice(0, 2)) {
      parts.push(`<text x="${x + 18}" y="${labelY}" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="11.5" fill="#4f463d">${escapeText(line)}</text>`)
      labelY += 14
    }
    for (const line of linesFor(`role: ${roles}`, 52).slice(0, 2)) {
      parts.push(`<text x="${x + 18}" y="${labelY}" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="11.5" fill="#4f463d">${escapeText(line)}</text>`)
      labelY += 14
    }
    for (const line of linesFor(`theme: ${themes}`, 54).slice(0, 2)) {
      parts.push(`<text x="${x + 18}" y="${labelY}" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="11.5" fill="#4f463d">${escapeText(line)}</text>`)
      labelY += 14
    }
    parts.push(`<text x="${x + 18}" y="${y + cellHeight - 12}" font-family="Consolas, Segoe UI, monospace" font-size="10" fill="#8b7d6e">${escapeText(original)}</text>`)
  }

  parts.push(`<text x="${margin}" y="${height - 16}" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="11" fill="#7c7064">Source masters stay outside the Mini Program package. Runtime card derivatives are 224x360 JPEG quality 73/MozJPEG.</text>`)
  parts.push('</svg>')
  const file = path.join(outputDir, `${group.file}.jpg`)
  await sharp(Buffer.from(parts.join(''))).jpeg({ quality: 90, mozjpeg: true }).toFile(file)
  console.log(`Wrote ${path.relative(root, file)} (${items.length} assets)`)
}

function runtimePath(visual, theme, role = 'card-thumbnail') {
  const variants = role === 'hero' || role === 'page-background' ? visual.heroVariants : visual.runtimeVariants
  const relative = variants[theme] || visual.runtimeVariants[theme] || visual.heroVariants[theme]
  if (!relative) throw new Error(`No ${theme} runtime path for ${visual.id}`)
  return path.join(root, 'apps/miniprogram/src', relative.replace(/^\//, ''))
}

async function runtimeUri(visual, theme, width, height, role = 'card-thumbnail') {
  const image = await sharp(runtimePath(visual, theme, role))
    .rotate()
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer()
  return `data:image/jpeg;base64,${image.toString('base64')}`
}

function phone(x, y, width, height, title) {
  return [
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="34" fill="#fffdf8" stroke="#dfd2c2" stroke-width="2"/>`,
    `<rect x="${x + 14}" y="${y + 14}" width="${width - 28}" height="${height - 28}" rx="24" fill="#fbf5ed"/>`,
    `<text x="${x + 32}" y="${y + 45}" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="10" letter-spacing="2" fill="#916348">${escapeText(title)}</text>`,
  ]
}

function miniText(x, y, text, size = 12, fill = '#503d32', weight = 400) {
  return `<text x="${x}" y="${y}" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeText(text)}</text>`
}

async function writeCompositionPreview() {
  const theme = 'dawn'
  const width = 1440
  const height = 980
  const panelY = 112
  const panelW = 420
  const panelH = 820
  const gap = 30
  const startX = (width - panelW * 3 - gap * 2) / 2
  const parts = []
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`)
  parts.push(`<defs>`)
  for (let i = 0; i < 3; i++) parts.push(`<clipPath id="p${i}"><rect x="${startX + i * (panelW + gap) + 14}" y="${panelY + 14}" width="${panelW - 28}" height="${panelH - 28}" rx="24"/></clipPath>`)
  parts.push(`</defs>`)
  parts.push(`<rect width="${width}" height="${height}" fill="#eee7db"/>`)
  parts.push(miniText(60, 54, 'PAGE COMPOSITION PREVIEW', 28, '#342b25', 700))
  parts.push(miniText(60, 80, 'Dawn theme · real runtime imagery · one composition per surface', 13, '#655b51'))

  const discoverHero = await runtimeUri(byId.get('dusk_lake_reading_01'), theme, panelW - 28, 270, 'hero')
  const discoverCards = []
  for (const id of ['golden_desk_book_01', 'autumn_forest_path_01', 'sunlit_meadow_path_01']) {
    discoverCards.push(await runtimeUri(byId.get(id), theme, 116, 164))
  }
  const exploreImage = await runtimeUri(byId.get('window_seat_01'), theme, 160, 208)
  const planHero = await runtimeUri(byId.get('dusk_lake_reading_01'), theme, panelW - 28, 236, 'hero')
  const planDecision = await runtimeUri(byId.get('misty_lake_canoe_01'), theme, 122, 156)

  for (let i = 0; i < 3; i++) {
    const x = startX + i * (panelW + gap)
    parts.push(phone(x, panelY, panelW, panelH, ['DISCOVER', 'EXPLORE', 'PLAN'][i]))
  }

  // Discover.
  let x = startX + 14
  let y = panelY + 62
  parts.push(`<image x="${x}" y="${y}" width="${panelW - 28}" height="270" preserveAspectRatio="xMidYMid slice" clip-path="url(#p0)" href="${discoverHero}"/>`)
  parts.push(`<rect x="${x}" y="${y + 182}" width="${panelW - 28}" height="88" fill="#fbf5ed" opacity="0.88"/>`)
  parts.push(miniText(x + 26, y + 230, '换个角度，看看生活', 22, '#503d32', 600))
  parts.push(miniText(x + 26, y + 252, '有些答案，会从一个新的问题开始', 11, '#7b6858'))
  y += 296
  parts.push(miniText(x + 26, y, 'A DIFFERENT PERSPECTIVE', 9, '#916348'))
  parts.push(miniText(x + 26, y + 26, '从一个新的问题开始', 17, '#503d32', 600))
  for (let card = 0; card < 3; card++) {
    const cx = x + 24 + card * 124
    parts.push(`<image x="${cx}" y="${y + 50}" width="116" height="164" rx="8" preserveAspectRatio="xMidYMid slice" href="${discoverCards[card]}"/>`)
    parts.push(miniText(cx, y + 236, ['辨认意愿', '看见选择', '从体验出发'][card], 11, '#503d32', 600))
    parts.push(miniText(cx, y + 252, ['先听听内心的声音', '方向不止一条', '从一次尝试开始'][card], 8.5, '#7b6858'))
  }

  // Explore.
  x = startX + panelW + gap + 14
  y = panelY + 62
  parts.push(miniText(x + 24, y + 2, '开始探索', 20, '#503d32', 600))
  parts.push(miniText(x + 24, y + 24, '先停一停，再决定往哪里走', 11, '#7b6858'))
  parts.push(`<rect x="${x + 20}" y="${y + 52}" width="${panelW - 68}" height="232" rx="12" fill="#fffaf2" stroke="#e2d5c5"/>`)
  parts.push(`<image x="${x + 34}" y="${y + 66}" width="160" height="208" rx="8" preserveAspectRatio="xMidYMid slice" href="${exploreImage}"/>`)
  parts.push(miniText(x + 210, y + 96, '窗边的一页', 14, '#503d32', 600))
  parts.push(miniText(x + 210, y + 118, '给自己一段不被打断的时间，', 9.5, '#7b6858'))
  parts.push(miniText(x + 210, y + 134, '把今天最真实的感觉写下来。', 9.5, '#7b6858'))
  parts.push(miniText(x + 210, y + 164, '先试一点点', 9, '#916348'))
  parts.push(`<rect x="${x + 24}" y="${y + 310}" width="${panelW - 76}" height="44" rx="22" fill="#f4e8da" stroke="#e2d5c5"/>`)
  parts.push(miniText(x + 42, y + 337, '我想试一点，但不想冒太大风险', 10, '#503d32'))
  parts.push(`<rect x="${x + 24}" y="${y + 366}" width="${panelW - 76}" height="44" rx="22" fill="#fffaf2" stroke="#e2d5c5"/>`)
  parts.push(miniText(x + 42, y + 393, '和我一起设计一次小实验', 10, '#503d32'))
  parts.push(miniText(x + 24, y + 460, '图片只解释气氛，不替代对话。', 9.5, '#8b7d6e'))

  // Plan.
  x = startX + 2 * (panelW + gap) + 14
  y = panelY + 62
  parts.push(`<image x="${x}" y="${y}" width="${panelW - 28}" height="236" preserveAspectRatio="xMidYMid slice" clip-path="url(#p2)" href="${planHero}"/>`)
  parts.push(`<rect x="${x}" y="${y + 160}" width="${panelW - 28}" height="76" fill="#fbf5ed" opacity="0.9"/>`)
  parts.push(miniText(x + 26, y + 200, '我的计划', 20, '#503d32', 600))
  parts.push(miniText(x + 26, y + 222, '这次探索，还可以继续', 11, '#7b6858'))
  y += 270
  parts.push(`<rect x="${x + 20}" y="${y}" width="${panelW - 68}" height="210" rx="14" fill="#fffaf2" stroke="#e2d5c5"/>`)
  parts.push(miniText(x + 38, y + 30, '这次探索，还可以继续', 13, '#503d32', 600))
  parts.push(`<image x="${x + 238}" y="${y + 18}" width="122" height="156" rx="8" preserveAspectRatio="xMidYMid slice" href="${planDecision}"/>`)
  for (let row = 0; row < 4; row++) {
    parts.push(`<line x1="${x + 38}" y1="${y + 58 + row * 30}" x2="${x + 214}" y2="${y + 58 + row * 30}" stroke="#e6d8c9"/>`)
    parts.push(`<circle cx="${x + 46}" cy="${y + 78 + row * 30}" r="4" fill="#916348"/>`)
    parts.push(miniText(x + 58, y + 82 + row * 30, ['我想守住的事', '这次先不做什么', '我的猜测', '还不确定的部分'][row], 10, '#503d32'))
  }
  parts.push(miniText(x + 38, y + 190, '可以随时编辑', 9, '#916348'))
  parts.push(miniText(x + 24, y + 240, '决定卡图片是 78x104 的独立氛围图。', 9.5, '#8b7d6e'))

  parts.push(miniText(60, height - 34, 'IDs — Discover: dusk_lake_reading_01 + golden_desk_book_01 / autumn_forest_path_01 / sunlit_meadow_path_01 · Explore: window_seat_01 · Plan: dusk_lake_reading_01 + misty_lake_canoe_01', 11, '#655b51'))
  parts.push('</svg>')
  const file = path.join(previewDir, 'page-composition-preview.jpg')
  await sharp(Buffer.from(parts.join(''))).jpeg({ quality: 91, mozjpeg: true }).toFile(file)
  console.log(`Wrote ${path.relative(root, file)}`)
}

async function main() {
  for (const group of groups) await writeSheet(group)
  await writeCompositionPreview()
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
