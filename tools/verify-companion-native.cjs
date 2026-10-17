// Read-only native simulator smoke check. No backend requests or model calls.
const auto = require('../output/native-sdk/node_modules/miniprogram-automator')
const fs = require('node:fs/promises')
;(async () => {
  const mp = await auto.connect({ wsEndpoint: 'ws://127.0.0.1:9430' })
  try {
    const page = (await mp.pageStack())[0]
    if (!page) throw Error('No active mini-program page')
    const chat = await page.$('.chat-content')
    const companion = await page.$('.companion')
    const report = {
      chatVisible: !!chat,
      companionVisible: !!companion,
      componentCount: (await page.$$('components\\/CompanionAvatar')).length
    }
    await fs.mkdir('output/companion', { recursive: true })
    await mp.screenshot({ path: 'output/companion/native-current.png' })
    console.log(JSON.stringify(report))
  } finally { await mp.disconnect() }
})().catch(error => { console.error(error.message); process.exitCode = 1 })
