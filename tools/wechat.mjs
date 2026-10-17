import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(import.meta.dirname, '..')
const app = path.join(root, 'apps', 'miniprogram')
const [command = 'help', mode = 'dev'] = process.argv.slice(2)

function projectPath(target) {
  if (!['dev', 'build'].includes(target)) throw Error('Use dev or build for the WeChat output mode')
  return path.join(app, 'dist', target, 'mp-weixin')
}

async function openProject(target) {
  const project = projectPath(target)
  try { await access(path.join(project, 'app.json')) }
  catch { throw Error('Missing ' + project + '\nRun npm run ' + (target === 'dev' ? 'dev:mp' : 'build:mp') + ' first') }
  const cli = process.env.WECHAT_DEVTOOLS_CLI || 'C:\\Software\\Tencent\\微信web开发者工具\\cli.bat'
  try { await access(cli) }
  catch { throw Error('WeChat CLI not found; set WECHAT_DEVTOOLS_CLI to your installed cli.bat path') }
  console.log('WeChat output directory: ' + project)
  await runWeChatCli(cli, project)
  console.log('Opened WeChat project: ' + project)
}

export async function runWeChatCli(cli, project) {
  // Pass paths through environment variables, never interpolate them as shell code
  const child = process.platform === 'win32'
    ? spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '& $env:AGENCY_WECHAT_CLI open --project $env:AGENCY_WECHAT_PROJECT'], {
      cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, AGENCY_WECHAT_CLI: cli, AGENCY_WECHAT_PROJECT: project },
    })
    : spawn(cli, ['open', '--project', project], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
    output = (output + chunk.toString()).slice(-65536)
    process.stdout.write(chunk)
  })
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve) })
  // This installed CLI returns zero even when the service port is disabled
  if (/service port disabled|服务端口.*关闭/i.test(output)) {
    throw Error('WeChat service port is disabled; enable it manually in Settings > Security Settings > Service Port\nNo setting was changed; you can also import the output directory manually')
  }
  if (code !== 0 || /\[error\]|× initialize/i.test(output)) throw Error('WeChat CLI did not open the project successfully')
}

async function watchAndOpen() {
  // This command only watches the Mini Program; it does not own the Python API
  try {
    const response = await fetch('http://127.0.0.1:8000/api/health', { signal: AbortSignal.timeout(1500) })
    if (!response.ok) throw Error('API unavailable')
    console.log('Local API reachable at http://127.0.0.1:8000')
  } catch {
    console.warn('Local API is not reachable. Run npm run dev:api in a separate terminal for login and saved data. Anonymous onboarding still works offline.')
  }
  const child = spawn(process.execPath, [path.join(app, 'node_modules', '@dcloudio', 'vite-plugin-uni', 'bin', 'uni.js'), '-p', 'mp-weixin'], {
    cwd: app, stdio: ['inherit', 'pipe', 'pipe'], windowsHide: true,
  })
  let started = false
  let tail = ''
  console.log('Watching Vue/TypeScript/SCSS -> ' + projectPath('dev'))
  child.stdout.on('data', chunk => {
    process.stdout.write(chunk)
    tail = (tail + chunk.toString()).slice(-4000)
    if (!started && /Build complete|编译成功/.test(tail)) {
      started = true
      void openProject('dev').catch(error => {
        console.error(error.message + '\nThe compiler is still watching; import the directory above to continue manually')
      })
    }
  })
  child.stderr.on('data', chunk => process.stderr.write(chunk))
  const stop = () => child.kill()
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  try {
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve) })
    process.exitCode = Number(code) || 0
  } finally { process.off('SIGINT', stop); process.off('SIGTERM', stop) }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) try {
  if (command === 'open') await openProject(mode)
  else if (command === 'dev') await watchAndOpen()
  else if (['help', '--help', '-h'].includes(command)) {
    console.log('npm run dev:wechat         Watch dev output and open it after the first successful compile\nnpm run wechat:open        Open dist/dev/mp-weixin\nnpm run wechat:open:build  Open dist/build/mp-weixin\nSet WECHAT_DEVTOOLS_CLI for a different install path; service port must be enabled manually')
  } else throw Error('Unknown command; use open, dev or --help')
} catch (error) { console.error(error.message); process.exitCode = 1 }
