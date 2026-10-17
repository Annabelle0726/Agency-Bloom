// Run with playwright-cli run-code --filename=tools/verify-onboarding.playwright.js
// Uses a fresh browser context. Does not register an account or upload answers.
async (sourcePage) => {
  const browser = sourcePage.context().browser()
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  const errors = []
  const uploads = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => {
    if (request.url().includes('/api/') && request.method() === 'POST') uploads.push(request.url())
  })
  const button = text => page.locator('uni-button:not([disabled])').filter({ hasText: text })
  const next = () => page.locator('uni-button.action-button:not([disabled])').filter({ hasText: /^继续$/ }).click()
  try {
    await page.goto('http://127.0.0.1:5173/')
    await button('开始探索').click()
    await button('暂时说不清，先看看').click()
    await button('还有别的事，我想自己说说').click()
    if (await page.locator('.selection-card.chosen').count() !== 1) throw Error('Unsure is not exclusive')
    await page.locator('.flow-textarea textarea').fill('希望为自己留出一点时间')
    await next()
    await page.locator('uni-button.selection-card').filter({ hasText: '希望为自己留出一点时间' }).click()
    await next()
    await button('在职工作').click()
    await button('家庭与照护').click()
    await page.reload()
    await page.locator('.context-chip').first().waitFor()
    if (await page.locator('.context-chip.chosen').count() !== 2) throw Error('Context lost on reload')
    await next()
    await button('先听我说').click()
    await next()
    await page.locator('.reflection-card').waitFor()

    // Regression: numeric step keys previously collided with Vue's login branch key.
    await button('保存我的方向').click()
    await page.locator('.login-content').waitFor()
    await button('返回整理').click()
    await page.locator('.reflection-card').waitFor()
    await button('暂时不注册').click()
    await page.locator('.guest-content').waitFor()
    await button('登录，留下这份思考').click()
    await page.locator('.login-content').waitFor()
    if (await page.locator('uni-button').filter({ hasText: '体验本地演示' }).getAttribute('disabled') === null) throw Error('Consent was preselected')
    await page.setViewportSize({ width: 320, height: 740 })
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Login overflows')
    await button('返回整理').click()
    await page.addStyleTag({ content: '.flow-title {font-size:32px}.reflection-copy {font-size:19px}' })
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Large text overflows')
    await page.locator('[aria-label="草稿与隐私"]').click()
    await button('清除本机草稿').click()
    await page.locator('.welcome-content').waitFor()
    if (uploads.length) throw Error('Anonymous answers were uploaded')
    if (errors.length) throw Error(errors.join('\n'))
  } finally {
    await context.close()
  }
}
