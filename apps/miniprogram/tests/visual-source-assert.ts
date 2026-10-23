import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import manifest from '../src/visual-manifest.json'
import storage from '../src/visual-storage.json'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const runtimePaths = manifest.visuals.filter(v => v.deploy)
  .flatMap(v => [...Object.values(v.runtimeVariants), ...Object.values(v.heroVariants)])
const legacyPaths = readdirSync(path.join(root, 'apps/miniprogram/src/static/bloom'))
  .filter(name => name.endsWith('.jpg')).map(name => '/static/bloom/' + name)
export const approvedVisualSources = new Set([
  ...runtimePaths,
  ...legacyPaths,
  ...Object.entries(storage.objects).filter(([local]) => runtimePaths.includes(local))
    .map(([, key]) => storage.publicBaseUrl + key),
])
