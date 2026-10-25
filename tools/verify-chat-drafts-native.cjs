// Isolated native QA only. Start tools/mock-conversations-api.py on 8018.
// Build with VITE_API_BASE_URL=http://127.0.0.1:8018/api into a separate tourist
// project, then CLI auto --project <copy> --auto-port 9472. Pass that copy here.
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict')
const auto = require('../output/native-sdk/node_modules/miniprogram-automator')
const WS = require('../output/native-sdk/node_modules/ws')
const out = path.resolve(__dirname, '../output/chat-drafts')
const project = process.argv[2]
let mp, page, auth
const errors = []
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
async function info() {
  return new Promise((resolve, reject) => {
    const socket = new WS('ws://127.0.0.1:9472')
    const timer = setTimeout(() => { socket.terminate(); reject(Error('Native automation endpoint timed out')) }, 8000)
    socket.on('open', () => socket.send(JSON.stringify({ id: 1, method: 'Tool.getInfo', params: {} })))
    socket.on('error', error => { clearTimeout(timer); reject(error) })
    socket.on('message', bytes => {
      const result = JSON.parse(bytes.toString())
      if (result.id !== 1) return
      clearTimeout(timer); socket.close(); resolve(result.result || {})
    })
  })
}
async function api(route, method = 'GET', body) {
  const response = await fetch('http://127.0.0.1:8018' + route, { method,
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
    body: body ? JSON.stringify(body) : undefined })
  assert.ok(response.ok, `Isolated API ${route}: ${response.status}`)
  return response.status === 204 ? null : response.json()
}
async function fresh() {
  if (mp) await mp.disconnect()
  mp = await auto.connect({ wsEndpoint: 'ws://127.0.0.1:9472' })
  mp.on('exception', error => errors.push(String(error)))
  page = (await mp.pageStack())[0]
}
async function until(check, label) {
  for (let i = 0; i < 40; i++) { await fresh(); if (page && await check()) return; await wait(250) }
  throw Error(label)
}
async function reopen() {
  await mp.callWxMethod('reLaunch', { url: '/pages/index/index' })
  await until(async () => !!await page.$('[data-tab="chat"]'), 'Account did not restore')
  await (await page.$('[data-tab="chat"]')).tap()
  await until(async () => !!await page.$('.chat-input'), 'Composer did not mount')
}
;(async () => {
  await fs.mkdir(out, { recursive: true })
  assert.ok(project, 'Pass the separately copied QA project path')
  const config = JSON.parse(await fs.readFile(path.join(project, 'project.config.json'), 'utf8'))
  assert.equal(config.appid, 'touristappid')
  assert.equal(config.projectname, 'Chat Drafts Isolated QA')
  assert.match(await fs.readFile(path.join(project, 'pages/index/useIndexPage.js'), 'utf8'), /127\.0\.0\.1:8018/)
  const runtime = await info()
  assert.ok(runtime.SDKVersion, 'Developer Tools returned IDE metadata without SDKVersion; Mini Program runtime unavailable')
  assert.equal((await api('/qa/status')).provider, 'conversation-isolated-mock')
  const login = await api('/api/auth/dev', 'POST', { privacy_accepted: true }); auth = 'Bearer ' + login.token
  await api('/api/me', 'PUT', { ai_consent: true, save_chat: true })
  const issue = await api('/api/issues', 'POST', { title: '虚构测试：未发送草稿' })
  const conversation = (await api('/api/conversations')).find(row => row.issue_id === issue.id)
  await fresh()
  await mp.callWxMethod('setStorageSync', 'agency.session', login.token)
  await reopen()
  const text = '尚未发送的临时草稿\n保留第二行'
  await (await page.$('.chat-input')).input(text)
  await until(async () => (await api('/api/chat-drafts')).some(row => row.key === conversation.id && row.content === text), 'Draft did not sync')
  assert.deepEqual((await api(`/api/conversations/${conversation.id}/messages`)).items, [])
  await reopen()
  assert.equal(await (await page.$('.chat-input')).value(), text)
  await mp.screenshot({ path: path.join(out, 'native-restored-draft.png') })
  await (await page.$('.send-button')).tap()
  await until(async () => (await api(`/api/conversations/${conversation.id}/messages`)).items.length === 2, 'Mock send failed')
  await until(async () => (await api('/api/chat-drafts')).find(row => row.key === conversation.id)?.content === '', 'Sent draft did not clear')
  await reopen(); assert.equal(await (await page.$('.chat-input')).value(), '')
  assert.deepEqual(errors, [])
  const device = await mp.systemInfo()
  const report = { verified: true, width: device.windowWidth, height: device.windowHeight,
    model: device.model, checks: ['unsent sync', 'no fabricated messages', 'restart restoration', 'successful send clears draft'], runtime_errors: errors,
    paid_requests: (await api('/qa/status')).paid_requests }
  assert.equal(report.paid_requests, 0)
  await fs.writeFile(path.join(out, 'native-result.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
})().catch(async error => {
  await fs.mkdir(out, { recursive: true })
  const report = { verified: false, error: String(error), runtime_errors: errors, committed: false }
  await fs.writeFile(path.join(out, 'native-result.json'), JSON.stringify(report, null, 2))
  console.error(report); process.exitCode = 1
}).finally(async () => { if (mp) await mp.disconnect() })
