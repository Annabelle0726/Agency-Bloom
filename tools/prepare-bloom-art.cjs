// Local-only derivatives. Never rewrites approved source art or theme references.
// Source masters live in assets/visual-library/originals; only optimized JPEGs
// are written into the Mini Program package.
const sharp = require('sharp')
const fs = require('node:fs/promises')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const library = path.join(root, 'assets/visual-library/originals')
const runtime = path.join(root, 'apps/miniprogram/src/static/bloom')
const recipePath = path.join(root, 'assets/visual-library/recipes/bloom-pages.json')
const crops = []

async function output(name, src, width, height, extract) {
  let task = sharp(src)
  if (extract) task = task.extract(extract)
  await task
    .resize(width, height, { fit: 'cover', position: name.endsWith('-scene') ? 'east' : 'centre' })
    .jpeg({ quality: 73, mozjpeg: true })
    .toFile(path.join(runtime, `${name}.jpg`))
  crops.push({
    name,
    source: path.relative(root, src).replaceAll('\\', '/'),
    width,
    height,
    extract: extract || null,
    bytes: (await fs.stat(path.join(runtime, `${name}.jpg`))).size,
  })
}

;(async () => {
  await fs.mkdir(runtime, { recursive: true })
  // The five approved page-art sources keep their original, readable names in
  // code so the crop recipe remains easy to audit.
  const page = {
    1: path.join(library, 'rest/rest_misty_lake_meadow_01.png'),
    2: path.join(library, 'direction/direction_forest_sunbeam_path_01.png'),
    3: path.join(library, 'reflection/reflection_sunlit_desk_01.png'),
    4: path.join(library, 'reflection/reflection_lakeside_sunset_01.png'),
    5: path.join(library, 'reflection/reflection_window_lake_desk_01.png'),
  }
  await output('mist-lake', page[1], 750, 940)
  await output('mist-reading', page[5], 750, 940)
  await output('forest-hero', page[2], 750, 940)
  await output('forest-reading', page[3], 750, 940)
  await output('forest-path', page[2], 224, 360)
  await output('reading-corner', page[3], 224, 360)
  await output('lake-reflection', page[4], 224, 360)

  const themeSources = {
    dark: 'rest/rest_night_lake_reading_01.png',
    dawn: 'rest/rest_dusk_lake_reading_01.png',
    lavender: 'growth/growth_lavender_lake_reading_01.png',
    minimal: 'reflection/reflection_ivory_window_reading_01.png',
  }
  const names = {
    dark: 'night',
    dawn: 'dusk',
    lavender: 'lavender',
    minimal: 'minimal',
  }
  for (const [id, name] of Object.entries(names)) {
    const src = path.join(library, themeSources[id])
    const metadata = await sharp(src).metadata()
    await output(`${name}-scene`, src, 750, 940)
    const crop = (left, top, width, height) => ({
      left: Math.round(metadata.width * left),
      top: Math.round(metadata.height * top),
      width: Math.floor(metadata.width * width),
      height: Math.floor(metadata.height * height),
    })
    await output(`${name}-landscape`, src, 224, 360, id === 'dark' ? crop(.56, .02, .42, .82) : crop(0, .12, .4, .82))
    await output(`${name}-reading`, src, 224, 360, crop(.57, .23, .42, .77))
    await output(`${name}-reflection`, src, 224, 360, crop(.25, .17, .4, .8))
  }

  await fs.writeFile(recipePath, `${JSON.stringify(crops, null, 2)}\n`)
  console.log(JSON.stringify({ images: crops.length, bytes: crops.reduce((sum, crop) => sum + crop.bytes, 0), crops }))
})().catch(error => {
  console.error(error)
  process.exitCode = 1
})
