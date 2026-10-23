// Auxiliary H5 verification; it never substitutes for native simulator acceptance.
// Requires tools/mock-conversations-api.py on 8018 and H5 with that API on 5188.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path')
const { randomUUID } = require('node:crypto')
const apiBase = 'http://127.0.0.1:8018', out = path.resolve(__dirname, '../output/release-acceptance/h5')
let browser, page, auth = '', failLookup = false
const results = [], exceptions = [], images = []
async function api(route, method = 'GET', body) {
  const response = await fetch(apiBase + route, { method, headers: { Authorization: auth, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  assert.ok(response.ok, route + ': ' + response.status)
  return response.status === 204 ? null : response.json()
}
async function check(name, work) {
  await work(); results.push({ name, passed: true }); console.log('PASS', name)
}
async function shot(name) {
  await page.evaluate(() => window.scrollTo(0, 0))
  // uni-image uses a background div; DOM image readiness alone is insufficient.
  await page.waitForFunction(() => [...document.querySelectorAll('uni-image > div')].every(e => e.style.backgroundImage.includes('url')))
  await page.evaluate(async () => { await Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a => a.finished.catch(() => {}))) })
  await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true })
}
async function tab(name) {
  if (await page.locator('[aria-label="返回主界面"]').count()) await page.locator('[aria-label="返回主界面"]').click()
  await page.locator(`[data-tab="${name}"]`).click()
}
async function readableFocusRows() {
  const styles = await page.locator('.focus-row').evaluateAll(rows => rows.map(row => ({
    fill: getComputedStyle(row).backgroundColor,
    gradient: getComputedStyle(row.closest('.glass-card')).backgroundImage,
    base: getComputedStyle(document.querySelector('.preview-stage')).getPropertyValue('--bg').trim(),
    ink: getComputedStyle(row.querySelector('.focus-row-copy > :first-child')).color,
    muted: getComputedStyle(row.querySelector('.focus-row-copy > :last-child')).color,
  })))
  const rgb = value => value.startsWith('#') ? value.slice(1).match(/../g).map(v => parseInt(v, 16)) : value.match(/[\d.]+/g).map(Number)
  const over = (color, base) => color.slice(0, 3).map((v, i) => v * (color[3] ?? 1) + base[i] * (1 - (color[3] ?? 1)))
  const lum = color => color.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0)
  for (const style of styles) {
    const row = rgb(style.fill), base = rgb(style.base)
    for (const stop of style.gradient.match(/rgba?\([^)]+\)/g) || [style.base]) {
      const fill = over(row, over(rgb(stop), base))
      for (const ink of [style.ink, style.muted]) {
        const a = lum(over(rgb(ink), fill)), b = lum(fill), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
        assert.ok(ratio >= 4.5, 'Focus row text contrast ' + ratio.toFixed(2) + ': ' + JSON.stringify(style))
      }
    }
  }
}
async function seed(theme = 'forest', consent = true) {
  const login = await api('/api/auth/dev', 'POST', { privacy_accepted: true }); auth = 'Bearer ' + login.token
  const user = await api('/api/me', 'PUT', { theme, ai_consent: consent, save_chat: true })
  const issue = await api('/api/issues', 'POST', { title: '虚构成年人的职业探索', concerns: ['choices'], background: '合成验收资料：有开发经验，想了解业务工作，每周可投入两小时' })
  const conversations = await api('/api/conversations'), conversation = conversations.find(item => item.issue_id === issue.id)
  await page.goto('http://127.0.0.1:5188/')
  await page.waitForFunction(() => typeof uni !== 'undefined')
  await page.evaluate(({ token, userId, conversationId }) => {
    uni.clearStorageSync(); uni.setStorageSync('agency.session', token)
    uni.setStorageSync('agency.theme.manual.v1:' + userId, true)
    uni.setStorageSync('agency.selected-conversation.v1:' + userId, conversationId)
  }, { token: login.token, userId: user.id, conversationId: conversation.id })
  await page.reload(); await page.locator('[data-tab="now"]').waitFor()
  return { user, issue, conversation }
}
async function send(text) {
  await page.locator('.chat-input textarea').fill(text); await page.locator('.send-button').click()
}
async function stableReply(count) {
  await page.waitForFunction(expected => !document.querySelector('.reply-wait') && document.querySelectorAll('.message-row.assistant').length === expected, count, { timeout: 30000 })
}
async function openDraft() {
  await page.locator('[aria-label="打开会话列表"]').click()
  await page.locator('.new-conversation').click()
  await page.locator('.chat-welcome').waitFor()
}
(async () => {
  assert.equal((await api('/qa/status')).provider, 'conversation-isolated-mock')
  assert.equal((await api('/qa/status')).paid_requests, 0)
  await fs.mkdir(out, { recursive: true })
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_BROWSER ? { executablePath: process.env.PLAYWRIGHT_BROWSER } : {}) })
  page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.on('pageerror', error => exceptions.push(error.message))
  page.on('requestfailed', request => { if (request.resourceType() === 'image') images.push(request.url()) })
  await page.route(apiBase + '/**', async route => {
    if (failLookup && new URL(route.request().url()).pathname.startsWith('/api/requests/')) return route.fulfill({ status: 503, json: { detail: 'Synthetic status lookup failure' }, headers: { 'access-control-allow-origin': '*' } })
    const response = await fetch(route.request().url(), { method: route.request().method(), headers: route.request().headers(), body: ['GET', 'HEAD'].includes(route.request().method()) ? undefined : route.request().postData() })
    await route.fulfill({ status: response.status, body: Buffer.from(await response.arrayBuffer()), headers: { 'content-type': response.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' } })
  })
  if (process.argv.includes('--focus-only')) { await seed('dark'); await shot('dark-focus'); await check('Focus action readability', readableFocusRows); return }
  await check('Anonymous opening and login consent', async () => {
    await page.goto('http://127.0.0.1:5188/'); await page.locator('.opening-story').waitFor(); await shot('opening')
    await page.locator('.story-skip').click(); await page.locator('.auth-welcome').waitFor()
    assert.equal(await page.locator('.auth-check').getAttribute('aria-pressed'), 'false')
    await shot('login')
  })
  await seed()
  await check('Six persisted themes across Home, Plan, Discover, Settings and chat', async () => {
    for (const theme of ['light', 'dark', 'dawn', 'forest', 'lavender', 'minimal']) {
      await tab('settings'); await page.locator('.setting-row').filter({ hasText: '外观设置' }).click()
      await page.locator(`[data-theme="${theme}"]`).click()
      await page.waitForFunction(id => document.querySelector('.preview-stage')?.classList.contains('theme-' + id), theme)
      await page.locator('.theme-applying').waitFor({ state: 'detached' })
      await page.locator('.appearance-footer .action-button').click()
      await page.locator('.modal-backdrop').waitFor({ state: 'detached' })
      assert.equal((await api('/api/me')).theme, theme)
      for (const name of ['now', 'plan', 'discover', 'settings', 'chat']) {
        await tab(name); await shot(theme + '-' + name)
        if (name === 'now') await readableFocusRows()
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), theme + '-' + name + ' overflows')
      }
    }
    await page.reload(); await page.locator('.theme-minimal').waitFor()
  })
  await check('Discovery opens an unsent independent draft', async () => {
    await tab('chat'); await page.locator('.chat-input textarea').fill('原窗口未发送的想法')
    const before = (await api('/api/conversations')).length, calls = (await api('/qa/status')).calls
    await tab('discover'); await page.locator('.discovery-card').first().click()
    assert.ok((await page.locator('.chat-input textarea').inputValue()).length > 0)
    assert.equal(await page.locator('.message-row').count(), 0)
    assert.equal((await api('/api/conversations')).length, before)
    assert.equal((await api('/qa/status')).calls, calls)
    await send('合成验收：希望比较两个工作方向'); await stableReply(1)
    assert.equal((await api('/api/conversations')).length, before + 1)
    assert.equal((await api('/qa/status')).calls, calls + 1)
    assert.ok(!(await page.locator('body').textContent()).includes('MOCK_PRIVATE_REASONING'))
    await page.reload(); await tab('chat'); await stableReply(1)
  })
  await check('Invalid reply preserves input and successful retry clears notice', async () => {
    const text = '异常格式测试：保留我的原问题'
    const calls = (await api('/qa/status')).calls
    await send(text); await page.locator('.composer-error').waitFor()
    assert.equal(await page.locator('.chat-input textarea').inputValue(), text)
    assert.equal(await page.locator('.message-row.assistant').count(), 1)
    assert.equal((await api('/qa/status')).calls, calls + 1)
    const notice = await page.locator('.composer-error').boundingBox(), input = await page.locator('.composer').boundingBox()
    assert.ok(notice.y >= 0 && notice.y + notice.height <= input.y + 1 && input.y < 844)
    await shot('reply-failure')
    await page.locator('.composer-error-recover').click()
    await page.waitForFunction(() => !document.querySelector('.composer-error-recover')?.hasAttribute('disabled'))
    assert.equal((await api('/qa/status')).calls, calls + 1)
    await send('合成验收：继续正常交流'); await stableReply(2)
    assert.equal(await page.locator('.composer-error').count(), 0)
  })
  await check('Failed status lookup stays in the originating conversation', async () => {
    await send('异常格式测试：再现恢复失败'); await page.locator('.composer-error').waitFor()
    const originalError = await page.locator('.composer-error-message').textContent()
    failLookup = true; await page.locator('.composer-error-recover').click()
    await page.waitForFunction(() => !document.querySelector('.composer-error-recover')?.hasAttribute('disabled'))
    failLookup = false
    assert.equal(await page.locator('.composer-error-message').textContent(), originalError)
    await openDraft()
    assert.equal(await page.locator('.composer-error').count(), 0, 'status failure from A must not become an error in the new draft')
    await shot('clean-new-draft')
  })
  await check('AI consent save failure keeps the draft and does not call the provider', async () => {
    await seed('light', false); await tab('chat')
    const calls = (await api('/qa/status')).calls
    await send('合成验收：同意后才开始'); await page.locator('.ai-consent-submit').waitFor()
    await api('/qa/fail-next-consent', 'POST'); await page.locator('.ai-consent-submit').click()
    await page.locator('.modal-sheet .notice').waitFor()
    assert.equal((await api('/api/me')).ai_consent, false); assert.equal((await api('/qa/status')).calls, calls)
    await shot('consent-save-failure')
    await page.locator('.ai-consent-dismiss').click()
    assert.equal(await page.locator('.chat-input textarea').inputValue(), '合成验收：同意后才开始')
    await page.locator('.send-button').click(); await page.locator('.ai-consent-submit').click(); await stableReply(1)
    assert.equal((await api('/qa/status')).calls, calls + 1)
  })
  await check('Reviewed summaries and confirmed memories stay separate', async () => {
    const fixture = await seed('forest'); await tab('chat')
    await send('合成验收：想认真比较当前的选择'); await stableReply(1)
    await page.locator('.chat-header-title').click(); await page.locator('.menu-rename').click()
    await page.locator('.conversation-rename-input input').fill('合成验收会话')
    await page.locator('.conversation-action-submit').click()
    await page.waitForFunction(() => !document.querySelector('.conversation-action-submit'))
    assert.equal((await api('/api/conversations/' + fixture.conversation.id)).title, '合成验收会话')
    await page.locator('.chat-header-title').click()
    await page.locator('.chat-menu-item').filter({ hasText: '整理当前会话' }).click()
    const calls = (await api('/qa/status')).calls
    await page.locator('.generate-summary').click(); await page.locator('.summary-status').waitFor()
    assert.equal((await api('/api/conversations/' + fixture.conversation.id)).summary, null)
    assert.equal((await api('/api/memories')).length, 0)
    assert.equal((await api('/qa/status')).calls, calls + 1)
    await page.locator('.confirm-summary').click()
    await page.waitForFunction(() => !document.querySelector('.summary-status'))
    assert.ok((await api('/api/conversations/' + fixture.conversation.id)).summary.overview)
    await page.locator('.drawer-tabs').first().locator('uni-button').filter({ hasText: '长期记忆' }).click()
    await page.locator('.memory-toolbar .secondary').first().click()
    await page.locator('.memory-editor textarea').fill('虚构成年人的已确认约束：每周最多投入两小时')
    assert.equal((await api('/api/memories')).length, 0, 'editing alone must not save a memory')
    await page.locator('.confirm-memory').click()
    await page.waitForFunction(() => !document.querySelector('.memory-editor'))
    assert.equal((await api('/api/memories')).length, 1)
    assert.equal((await api('/api/me')).use_memory, false, 'saving is separate from using memory')
    await shot('confirmed-memory')
    await page.locator('[aria-label="关闭会话面板"]').click()
  })
  await check('Card edits wait for explicit confirmation and survive reload', async () => {
    await tab('now'); await page.locator('[data-home="mission"]').click()
    await page.locator('.modal-sheet .text-field input').fill('合成验收：保留自己的决定')
    await page.locator('.modal-sheet textarea').last().fill('花十五分钟记录想进一步了解的问题')
    const issue = await api('/api/issues/current')
    assert.notEqual(issue.card.next_step, '花十五分钟记录想进一步了解的问题')
    await page.locator('.modal-sheet .primary').click()
    await page.waitForFunction(() => !document.querySelector('.modal-sheet'))
    const saved = await api('/api/issues/current')
    assert.equal(saved.card.next_step, '花十五分钟记录想进一步了解的问题')
    await page.reload(); await tab('plan')
    assert.equal(await page.locator('.next-title').textContent(), saved.card.next_step)
    await shot('confirmed-card')
  })
  await check('Archiving a conversation preserves its exploration and confirmed records', async () => {
    await tab('chat'); const id = (await api('/api/conversations')).find(c => c.title === '合成验收会话').id
    const before = await api('/api/issues/current'), calls = (await api('/qa/status')).calls
    await page.locator('.chat-header-title').click(); await page.locator('.menu-archive').click()
    await page.locator('.conversation-action-submit').click()
    await page.waitForFunction(() => !document.querySelector('.conversation-action-submit'))
    assert.ok((await api('/api/conversations/' + id)).archived_at)
    assert.equal((await api('/api/issues/current')).id, before.id)
    assert.equal((await api('/api/memories')).length, 1)
    assert.equal((await api('/qa/status')).calls, calls)
    await shot('archived-conversation')
  })
  await check('Narrow-screen layout', async () => {
    for (const width of [320, 360, 430]) {
      await page.setViewportSize({ width, height: 844 })
      for (const name of ['now', 'discover', 'settings', 'chat']) {
        await tab(name); await shot('width-' + width + '-' + name)
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), width + '-' + name + ' overflows')
      }
    }
  })
  assert.deepEqual(exceptions, []); assert.deepEqual(images, [])
  console.log(JSON.stringify({ passed: true, cases: results.length, paidRequests: 0 }))
})().catch(async error => {
  results.push({ passed: false, error: error.message }); console.error(error.stack); process.exitCode = 1
  if (page) await page.screenshot({ path: path.join(out, 'failed.png') }).catch(() => {})
}).finally(async () => {
  await fs.mkdir(out, { recursive: true }); await fs.writeFile(path.join(out, 'report.json'), JSON.stringify({ results, exceptions, images, paidRequests: 0, nativeAcceptance: false }, null, 2))
  if (browser) await browser.close()
})
