const sharp = require('sharp')
async function main() {
  const w = 900
  const hero = await sharp('assets/readme/hero.png').resize(w).png().toBuffer()
  const wf = await sharp('assets/readme/workflow.svg').resize({ width: w }).png().toBuffer()
  const th = await sharp('assets/readme/themes.svg').resize({ width: w }).png().toBuffer()
  const hm = await sharp(hero).metadata()
  const wm = await sharp(wf).metadata()
  const tm = await sharp(th).metadata()
  const gap = 24
  const height = hm.height + gap + wm.height + gap + tm.height
  await sharp({ create: { width: w, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite([
      { input: hero, left: 0, top: 0 },
      { input: wf, left: 0, top: hm.height + gap },
      { input: th, left: 0, top: hm.height + gap + wm.height + gap },
    ]).png().toFile('assets/readme/source/preview-stack.png')
  console.log('preview-stack.png', w + 'x' + height)
}
main().catch(e => { console.error(e.message); process.exit(1) })
