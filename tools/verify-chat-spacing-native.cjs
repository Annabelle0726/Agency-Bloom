// Native simulator geometry only: no API requests, storage changes or model calls
const auto = require('../output/native-sdk/node_modules/miniprogram-automator');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
(async () => {
  const mp = await auto.connect({ wsEndpoint: 'ws://127.0.0.1:9430' });
  try {
    const page = (await mp.pageStack())[0];
    assert.ok(page && await page.$('.chat-content'), 'Open the chat tab in the isolated native QA project');
    await mp.pageScrollTo(99999);
    await new Promise(resolve => setTimeout(resolve, 400));
    const disclosure = await page.$('.chat-disclosure'), composer = await page.$('.composer');
    const disclosureOffset = await disclosure.offset(), disclosureSize = await disclosure.size();
    const composerOffset = await composer.offset(), composerSize = await composer.size();
    const info = await mp.systemInfo();
    const result = {
      device: info.model, width: info.windowWidth, height: info.windowHeight,
      messages: (await page.$$('.message-row')).length,
      gap: composerOffset.top - disclosureOffset.top - disclosureSize.height,
      composerHeight: composerSize.height,
      composerBottom: composerOffset.top + composerSize.height,
    };
    await fs.mkdir('output/exploration', { recursive: true });
    await fs.writeFile('output/exploration/chat-spacing-report.json', JSON.stringify(result, null, 2));
    await mp.screenshot({ path: 'output/exploration/chat-spacing-current.png' });
    console.log(JSON.stringify(result));
    assert.ok(result.gap >= 12 && result.gap <= 24, 'Bottom clearance must leave a 12–24px gap above the composer');
    assert.ok(result.composerBottom < info.windowHeight, 'Composer must stay inside the viewport');
  } finally { await mp.disconnect(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
