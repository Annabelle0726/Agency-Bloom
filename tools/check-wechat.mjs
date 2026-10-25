import { spawnSync } from 'node:child_process'
import mediaBudget from './check-mp-media.cjs'
import { access, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const mode = process.argv[2] || 'build'
const optional = process.argv.includes('--if-available')
const install = process.env.WECHAT_DEVTOOLS_HOME || path.dirname(process.env.WECHAT_DEVTOOLS_CLI || 'C:\\Software\\Tencent\\微信web开发者工具\\cli.bat')
const compilerCandidates = [
  path.join(install, 'resources', 'app.asar.unpacked', 'node_modules', 'wcc-exec'),
  path.join(install, 'code', 'package.nw', 'node_modules', 'wcc-exec'),
]
const binaries = (await Promise.all(compilerCandidates.map(async directory =>
  await exists(path.join(directory, 'wcsc.exe')) && await exists(path.join(directory, 'wcc.exe')) ? directory : null,
))).find(Boolean) || compilerCandidates[0]
const output = path.join(root, 'apps', 'miniprogram', 'dist', mode, 'mp-weixin')
const evidence = path.join(root, 'output', 'wechat', mode)

async function filesIn(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await filesIn(file))
    else files.push(file)
  }
  return files
}
async function exists(file) { try { await access(file); return true } catch { return false } }
function relative(file) { return path.relative(output, file).split(path.sep).join('/') }
function compile(binary, args) {
  const result = spawnSync(path.join(binaries, binary), args, { cwd: output, encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 })
  if (result.error) throw result.error
  if (result.status !== 0) throw Error(binary + ' failed\n' + result.stdout + result.stderr)
}

try {
  if (!['dev', 'build'].includes(mode)) throw Error('Use dev or build')
  if (!await exists(path.join(output, 'app.json'))) throw Error('Compile the ' + mode + ' output first')
  console.log('Image/audio budget: ' + JSON.stringify(mediaBudget.assertMediaBudget(output)))
  const manifest = JSON.parse(await readFile(path.join(output, 'app.json'), 'utf8'))
  for (const page of manifest.pages || []) {
    for (const extension of ['.json', '.js', '.wxml']) {
      if (!await exists(path.join(output, page + extension))) throw Error('Missing page artifact: ' + page + extension)
    }
  }
  const files = await filesIn(output)
  const wxss = files.filter(file => file.endsWith('.wxss'))
  const wxml = files.filter(file => file.endsWith('.wxml'))
  const assets = ['static/mountain-lake.jpg', 'static/morning-light.jpg']
  for (const asset of assets) {
    if (await exists(path.join(output, asset))) {
      if ((await stat(path.join(output, asset))).size === 0) throw Error('Empty image: ' + asset)
    } else {
      const archive = JSON.parse(await readFile(path.join(root, 'apps/miniprogram/src/app-media.json'), 'utf8'))
      if (!archive.objects.some(item => item.localPath === '/' + asset && item.verifiedAt)) throw Error('Missing local or cloud image: ' + asset)
    }
  }
  for (const file of files.filter(file => file.endsWith('.json') && !file.endsWith('project.private.config.json'))) {
    const config = JSON.parse(await readFile(file, 'utf8'))
    for (const component of Object.values(config.usingComponents || {})) {
      if (component.startsWith('plugin://')) continue
      const base = component.startsWith('/') ? path.join(output, component.slice(1)) : path.resolve(path.dirname(file), component)
      for (const extension of ['.json', '.js', '.wxml']) {
        if (!await exists(base + extension)) throw Error('Missing component artifact: ' + relative(base) + extension)
      }
    }
  }
  const available = await exists(path.join(binaries, 'wcsc.exe')) && await exists(path.join(binaries, 'wcc.exe'))
  if (!available) {
    if (!optional) throw Error('Bundled WeChat WXML/WXSS compilers unavailable; set WECHAT_DEVTOOLS_HOME to the installed tools directory')
    console.log('Artifact references and images exist; SKIP native WXML/WXSS compiler check (Developer Tools not installed here)')
  } else {
    await mkdir(evidence, { recursive: true })
    for (const file of wxss) compile('wcsc.exe', ['-lc', '-o', path.join(evidence, relative(file).replaceAll('/', '_') + '.compiled.css'), relative(file)])
    compile('wcc.exe', ['-o', path.join(evidence, 'wxml-compiled.js'), ...wxml.map(relative)])
    const report = { mode, output, checkedAt: new Date().toISOString(), compilerDirectory: binaries, wxss: wxss.map(relative), wxml: wxml.map(relative), assets, simulatorVerified: false }
    await writeFile(path.join(evidence, 'artifacts.json'), JSON.stringify(report, null, 2) + '\n')
    console.log('PASS WeChat bundled compilers: ' + wxss.length + ' WXSS, ' + wxml.length + ' WXML; references and images checked')
    console.log('This is a native compiler check, not simulator UI acceptance')
  }
} catch (error) { console.error(error.message); process.exitCode = 1 }
