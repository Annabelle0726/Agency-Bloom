import { existsSync } from 'node:fs'
// Rebuild compressed derivatives from approved references; never rewrite reference artwork.
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
const source = path.resolve(existsSync('design/themes/references') ? 'design/themes/references' : 'output/visual-source-cache/design/themes/references')
const target = path.resolve('apps/miniprogram/src/static/themes')
const recipes = {
  mist: { file:'mist.png', left:0, top:786, width:941, height:586 },
  night: { file:'night.jpg', left:0, top:130, width:1024, height:640 },
  dawn: { file:'dawn.jpg', left:0, top:540, width:1024, height:640 },
  forest: { file:'forest.jpg', left:0, top:500, width:1024, height:640 },
  lavender: { file:'lavender.jpg', left:0, top:750, width:1024, height:640 },
  minimal: { file:'minimal.jpg', left:0, top:550, width:1024, height:640 },
}
const selected = process.argv.slice(2)
const keys = selected.length ? selected : Object.keys(recipes)
if (keys.some(key => !Object.hasOwn(recipes,key))) throw Error('Pass theme asset names only: mist night dawn forest lavender minimal')
await fs.mkdir(target,{recursive:true})
for (const key of keys) {
  const {file,...crop} = recipes[key]
  const reference = path.join(source,file)
  await sharp(reference).resize(640,960,{fit:'cover',position:'centre'}).jpeg({quality:68,mozjpeg:true}).toFile(path.join(target,key+'.jpg'))
  await sharp(reference).extract(crop).resize(360,224).jpeg({quality:77,mozjpeg:true}).toFile(path.join(target,key+'-preview.jpg'))
  console.log(key,(await fs.stat(path.join(target,key+'.jpg'))).size,'bytes; reference unchanged')
}
