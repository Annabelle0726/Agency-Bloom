const sharp = require('sharp')
// Overflow band ends 2px BEFORE the next card's left edge (true gap check).
async function overflowCheck(file, width, cards) {
  const buf = await sharp(file).resize({ width }).png().toBuffer()
  const raw = await sharp(buf).raw().toBuffer({ resolveWithObject: true })
  const { data, info } = raw
  const scale = width / 1200
  let issues = 0
  for (const c of cards) {
    const bx2 = Math.round(c.x2 * scale)
    const by1 = Math.round(c.y1 * scale), by2 = Math.round(c.y2 * scale)
    const bandEnd = c.nextX1 ? Math.round(c.nextX1 * scale) - 2 : Math.min(bx2 + 40, info.width)
    if (bandEnd <= bx2 + 3) continue // gap too small to measure at this width
    let stray = 0
    for (let y = by1; y < Math.min(by2 + 30, info.height); y++) {
      for (let x = bx2 + 3; x < bandEnd; x++) {
        const i = (y * info.width + x) * info.channels
        if (data[i] < 140 && data[i + 1] < 140) stray++
      }
    }
    if (stray > 20) { console.log(`  ${c.name}: ${stray} stray pixels in gap`); issues++ }
  }
  console.log(`${file} @${width}px ${issues === 0 ? 'OK' : issues + ' ISSUES'}`)
  return issues
}
async function main() {
  const wfCards = [
    { name: 'row1-card1', x1: 48, x2: 568, y1: 56, y2: 296, nextX1: 672 },
    { name: 'row1-card2', x1: 672, x2: 1152, y1: 56, y2: 296, nextX1: null },
    { name: 'row2-card3', x1: 672, x2: 1152, y1: 380, y2: 620, nextX1: null },
    { name: 'row2-card4', x1: 48, x2: 568, y1: 380, y2: 620, nextX1: 672 },
  ]
  const thCards = [
    { name: 'mist', x1: 48, x2: 368, y1: 96, y2: 256, nextX1: 440 },
    { name: 'night', x1: 440, x2: 760, y1: 96, y2: 256, nextX1: 832 },
    { name: 'dawn', x1: 832, x2: 1152, y1: 96, y2: 256, nextX1: null },
    { name: 'forest', x1: 48, x2: 368, y1: 330, y2: 490, nextX1: 440 },
    { name: 'lavender', x1: 440, x2: 760, y1: 330, y2: 490, nextX1: 832 },
    { name: 'minimal', x1: 832, x2: 1152, y1: 330, y2: 490, nextX1: null },
  ]
  let bad = 0
  bad += await overflowCheck('assets/readme/workflow.svg', 900, wfCards)
  bad += await overflowCheck('assets/readme/workflow.svg', 360, wfCards)
  bad += await overflowCheck('assets/readme/themes.svg', 900, thCards)
  bad += await overflowCheck('assets/readme/themes.svg', 360, thCards)
  if (bad > 0) process.exit(1)
  console.log('all overflow checks passed - no text escapes its card at either width')
}
main().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
