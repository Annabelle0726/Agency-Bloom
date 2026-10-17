// Independent browser context; local anonymous flow only
async (sourcePage) => {
  const context = await sourcePage.context().browser().newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  try {
    await page.goto('http://127.0.0.1:5173/')
    const button = text => page.locator('uni-button').filter({ hasText: text })
    await button('开始探索').click()
    await button('看不到未来的方向').click()
    const progress = await page.locator('.progress-fill').elementHandle()
    const next = page.locator('uni-button.action-button:not([disabled])').filter({ hasText: /^继续$/ })
    await next.waitFor()
    const firstPosition = await next.boundingBox()
    await next.click()
    await page.locator('.flow-title').filter({ hasText: '开始' }).waitFor()
    if (!await progress.evaluate(element => element.isConnected)) throw Error('Progress is remounted on every step')
    const secondPosition = await page.locator('.flow-footer .action-button').boundingBox()
    if (Math.abs(firstPosition.y - secondPosition.y) > 2) throw Error('Primary action jumps between steps')
    await page.locator('uni-button.selection-card').filter({ hasText: '看不到未来的方向' }).click()
    await next.waitFor()
    await next.evaluate(element => { element.click(); element.click() })
    await page.locator('.life-contexts').waitFor()
    if (!await page.locator('.flow-title').filter({ hasText: '生活' }).isVisible()) throw Error('Double tap skipped a step')
    await page.setViewportSize({ width: 320, height: 640 })
    const cta = await next.boundingBox()
    if (cta.y + cta.height > 640 || cta.y < 0) throw Error('Primary action is outside the viewport')
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw Error('Horizontal overflow')
    const back = page.locator('uni-button[aria-label="返回上一步"]:not([disabled])')
    await back.click()
    await back.click()
    await page.locator('uni-button.selection-card').last().scrollIntoViewIfNeeded()
    await next.click()
    await page.locator('.flow-title').filter({hasText:'开始'}).waitFor()
    await page.waitForFunction(() => {
      const title = document.querySelector('.flow-title').getBoundingClientRect()
      const chrome = document.querySelector('.flow-chrome').getBoundingClientRect()
      return title.top >= chrome.bottom && title.top < chrome.bottom + 100
    })
  } finally {
    await context.close()
  }
}
