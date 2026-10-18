// Playwright CLI run-code callback. All Agency Bloom API traffic is intercepted: zero model requests.
async (sourcePage) => {
  const context = await sourcePage.context().browser().newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const card = { title: '我想探索适合自己的职业方向', options: [], constraints: [], confirmed: [], hypotheses: [], unknowns: [], next_step: '' }
  const issue = { id: 'preview-issue', title: card.title, concerns: [], life_contexts: [], stage: 'unsure',
    background: '', card, version: 1, feedback: [], created_at: '2026-10-17T12:00:00Z',
    updated_at: '2026-10-17T12:00:00Z', ended_at: null }
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    const data = path.endsWith('/config')
      ? { dev_auth: true, ai_mode: 'demo', privacy_version: 'preview' }
      : path.endsWith('/me')
        ? { id: 'preview-user', save_chat: false, ai_consent: true, theme: 'light', support_style: 'discover', created_at: '2026-10-17T00:00:00Z' }
        : path.endsWith('/issues/current') ? issue
        : path.endsWith('/messages')
          ? [{ role: 'user', content: '最近我有点想换工作。' }, { role: 'assistant', content: '你最希望新的工作带来什么变化？可以从一件事说起。' }]
          : path.endsWith('/usage') ? { daily_calls: 0, daily_limit: 10, limit_cny: 20, used_cny: 0, mode: 'demo' }
          : null
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
  })
  try {
    await page.goto('http://127.0.0.1:5173/')
    await page.evaluate(() => uni.setStorageSync('agency.session', 'avatar-visual-test'))
    await page.reload()
    await page.locator('.home-actions').waitFor({ timeout: 12000 })
    await page.locator('.tabbar uni-button').filter({ hasText: '对话' }).click()
    await page.locator('.chat-content .companion').waitFor({ timeout: 12000 })
    const avatars = await page.locator('.chat-content .companion').count()
    if (!avatars) throw Error('No companion avatar rendered')
    await page.screenshot({ path: 'output/companion/h5-chat.png', animations: 'disabled' })
    await page.locator('.chat-content .companion').last().click()
    await page.locator('.chat-content .companion-tap').waitFor({ timeout: 1000 })
    await page.screenshot({ path: 'output/companion/h5-tap.png' })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    if (overflow) throw Error('Horizontal overflow')
    if (errors.length) throw Error(errors.join('; '))
    console.log(JSON.stringify({ avatars, tap: true, overflow, api: 'all mocked; no paid calls' }))
  } finally {
    await context.close()
  }
}
