// Native SDK QA only; never targets the production backend or a paid provider
// Requires the existing local SDK at output/native-sdk/node_modules/miniprogram-automator
// Run --offline with port 8002 stopped, then run without it with mock-exploration-api.py running
const auto = require('../output/native-sdk/node_modules/miniprogram-automator');
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const dir = path.resolve(__dirname, '../output/exploration'), offline = process.argv.includes('--offline');
const wait = ms => new Promise(r => setTimeout(r, ms));
let mp, page, flow, originalSession, originalDraft, backed = false, auth;
const exceptions = [];
async function api(route, method = 'GET', body) {
  const response = await fetch('http://127.0.0.1:8002' + route, { method, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) }, body: body ? JSON.stringify(body) : undefined });
  assert.ok(response.ok, 'Mock API HTTP ' + response.status); return response.json();
}
async function fresh(allowLaunch = false) {
  if (mp) await mp.disconnect();
  mp = await auto.connect({ wsEndpoint: 'ws://127.0.0.1:9430' });
  mp.on('exception', e => exceptions.push(String(e)));
  for (let i = 0; i < 30; i++) { page = (await mp.pageStack())[0]; if (page) break; await wait(300); }
  if (!page && allowLaunch) { await mp.callWxMethod('reLaunch', { url: '/pages/index/index' }); await wait(5000); page = (await mp.pageStack())[0]; }
  assert.ok(page, 'Simulator has no loaded page after initialization');
  flow = await page.$('components\\/OnboardingFlow');
}
async function action(index = 0) { await fresh(); const element = (await flow.$$('components\\/ActionButton'))[index]; assert.ok(element, 'Missing action ' + index); await (await element.$('button')).tap(); await wait(260); }
async function select(index) { await fresh(); const element = (await flow.$$('components\\/SelectionCard'))[index]; assert.ok(element); await (await element.$('button')).tap(); await wait(100); }
async function shot(name, width) { await fresh(); await mp.screenshot({ path: path.join(dir, `${offline ? 'offline' : 'online'}-${width}-${name}.png`) }); }
async function tab(name) { await fresh(); await (await page.$(`[data-tab="${name}"]`)).tap(); await wait(250); }
async function send(text, count) {
  await fresh(); await (await page.$('.chat-input')).input(text); await (await page.$('.send-button')).tap();
  for (let i = 0; i < 35; i++) { await wait(160); await fresh(); if ((await page.$$('.message-row')).length === count && await (await page.$('.send-button')).attribute('aria-label') === '发送消息') return; }
  throw Error('Mock reply did not arrive');
}
(async () => {
  await fs.mkdir(dir, { recursive: true });
  if (offline) { let unavailable = false; try { await fetch('http://127.0.0.1:8002/api/config'); } catch { unavailable = true; } assert.ok(unavailable, 'Stop only the isolated Mock API before offline QA'); }
  else assert.equal((await api('/qa/status')).provider, 'MockTransport only');
  await wait(5000); await fresh(true); const info = await mp.systemInfo(); console.log(JSON.stringify({ phase: offline ? 'offline' : 'online', model: info.model, width: info.windowWidth, height: info.windowHeight }));
  if (process.argv.includes('--narrow')) assert.ok(info.windowWidth <= 375, 'Narrow QA needs an actual simulator width at most 375px');
  originalSession = await mp.callWxMethod('getStorageSync', 'agency.session'); originalDraft = await mp.callWxMethod('getStorageSync', 'agency.onboarding.v2'); backed = true;
  await mp.callWxMethod('removeStorageSync', 'agency.session'); await mp.callWxMethod('removeStorageSync', 'agency.onboarding.v2');
  await mp.callWxMethod('reLaunch', { url: '/pages/index/index' }); await wait(5000); await fresh();
  await action(); await select(1); await select(2); await select(5);
  await fresh(); await (await flow.$('.flow-textarea')).input('我想发现自己的经历还能用在哪');
  await shot('options', info.windowWidth); await action(); await select(0);
  await fresh(); assert.match(await (await flow.$('.branch-question')).text(), /别人经常找你帮忙/);
  await (await flow.$('.branch-response')).input('喜欢解释复杂问题');
  await shot('branch', info.windowWidth);
  await (await flow.$('.flow-back')).tap(); await wait(260); await action(); await fresh();
  assert.equal(await (await flow.$('.branch-response')).value(), '喜欢解释复杂问题');
  let saved = await mp.callWxMethod('getStorageSync', 'agency.onboarding.v2');
  assert.deepEqual(saved.form.concerns, ['change', 'choices', 'other']); assert.equal(saved.form.title, ''); assert.equal(saved.form.actual_question, '我想发现自己的经历还能用在哪');
  await action(); await fresh(); const fields = await flow.$$('.flow-textarea'); await fields[0].input('有软件开发经历'); await fields[1].input('每周两小时，不花钱');
  await mp.callWxMethod('reLaunch', { url: '/pages/index/index' }); await wait(5000); await fresh();
  saved = await mp.callWxMethod('getStorageSync', 'agency.onboarding.v2'); assert.equal(saved.step, 2); assert.equal(saved.form.background, '有软件开发经历');
  await action(); await select(1); await shot('modes', info.windowWidth); await action(); await fresh();
  const localNotice = await flow.$('.notice');
  assert.equal(localNotice ? await localNotice.text() : '', '', 'Anonymous reflection must not show a service error');
  assert.match(await (await flow.$('.reflection-title')).text(), /先从你的问题开始/);
  assert.ok((await (await flow.$('.reflection-record')).offset()).top < (await (await flow.$('.reflection-next')).offset()).top, 'User clues must precede fixed-rule guidance');
  await shot('reflection', info.windowWidth);
  await (await flow.$('.flow-scroll')).scrollTo(0, 9999); await shot('reflection-next', info.windowWidth);
  const footer = await flow.$('.flow-footer');
  assert.ok((await footer.offset()).top + Number((await footer.size()).height) <= info.windowHeight + 1, 'Onboarding footer extends below the viewport');
  await action(); await fresh();
  assert.equal(await (await flow.$('.consent-check-target')).attribute('aria-pressed'), 'false');
  await shot('login', info.windowWidth);
  await (await flow.$('.consent-check-target')).tap(); await wait(100);
  if (offline) {
    await action();
    for (let i = 0; i < 40; i++) { await fresh(); const first = (await flow.$$('components\\/ActionButton'))[0]; if (!(await (await first.$('button')).attribute('class')).includes('is-loading')) break; await wait(400); }
    await fresh(); assert.match(await (await flow.$('.notice')).text(), /暂时无法连接服务/);
    await (await flow.$('.login-back')).tap(); await wait(260); await fresh();
    const notice = await flow.$('.notice'); assert.equal(notice ? await notice.text() : '', '', 'Login failure leaked into local reflection');
    await (await flow.$('.flow-skip')).tap(); await wait(260); await fresh(); assert.ok(await flow.$('.guest-content'));
    await shot('guest', info.windowWidth);
  } else {
    await action(2); await fresh(); assert.ok(await flow.$('.guest-content'));
    await shot('guest', info.windowWidth); await action();
    await action(1);
    for (let i = 0; i < 40; i++) { await fresh(); if (await page.$('.workspace')) break; await wait(250); }
    assert.ok(await page.$('.workspace'), 'Development login/save did not reach the home page');
    auth = 'Bearer ' + await mp.callWxMethod('getStorageSync', 'agency.session');
    const initial = await api('/api/issues/current'); assert.equal(initial.title, ''); assert.deepEqual(initial.card.confirmed, ['有软件开发经历']); assert.equal(initial.focus_response, '喜欢解释复杂问题');
    await tab('chat'); await fresh(); assert.match(await (await page.$('.welcome-context')).text(), /喜欢解释复杂问题/);
    const beforeCalls = (await api('/qa/status')).calls.length;
    await (await page.$('.chat-input')).input('从我刚才的线索开始探索'); await (await page.$('.send-button')).tap(); await wait(180); await fresh();
    assert.equal((await api('/qa/status')).calls.length, beforeCalls); assert.ok(await page.$('.modal-sheet'));
    await (await page.$('.modal-sheet .primary')).tap();
    for (let i = 0; i < 30; i++) { await wait(200); await fresh(); if (await page.$('.insight-card')) break; }
    assert.ok(await page.$('.insight-card')); await mp.pageScrollTo(700); await shot('insight', info.windowWidth);
    await (await page.$('[data-insight="interested"]')).tap(); await wait(100); await fresh(); assert.match(await (await page.$('.chat-input')).value(), /这个角度有意思/);
    assert.equal((await api('/qa/status')).calls.length, beforeCalls + 1);
    await (await page.$('[data-insight="experiment"]')).tap(); await wait(150); await fresh(); assert.ok(await page.$('.confirm-experiment'));
    assert.equal((await api('/api/issues/current')).version, initial.version);
    await shot('experiment', info.windowWidth);
    const confirm = await page.$('.confirm-experiment'); await Promise.all([confirm.tap(), confirm.tap()]); await wait(400); await fresh();
    const after = await api('/api/issues/current'); assert.equal(after.version, initial.version + 1); assert.deepEqual(after.card.confirmed, initial.card.confirmed); assert.deepEqual(after.card.constraints, initial.card.constraints); assert.match(after.card.next_step, /验证：/);
    await send('再看一个待探索角度', 4); await (await page.$('[data-insight="dismissed"]')).tap(); await wait(100); await fresh(); assert.equal(await page.$('.insight-card'), null); assert.equal((await api('/api/issues/current')).version, after.version);
    await (await page.$('[data-mode="listen"]')).tap(); await wait(200); await send('我今天只想说说', 6); assert.equal(await page.$('.insight-card'), null);
    await shot('listen', info.windowWidth);
    await (await page.$('[data-mode="discover"]')).tap(); await wait(200);
    await send('测试超时', 6); // count stays unchanged on failure
    await fresh(); assert.equal(await (await page.$('.chat-input')).value(), '测试超时');
    await (await page.$('.chat-input')).input('测试取消'); await (await page.$('.send-button')).tap(); await wait(200); await fresh();
    assert.equal(await (await page.$('.send-button')).attribute('aria-label'), '停止回复');
    await tab('settings'); await tab('chat'); await fresh();
    assert.equal(await (await page.$('.chat-input')).value(), '测试取消');
    await (await page.$('.send-button')).tap(); await wait(400); await fresh();
    assert.equal(await (await page.$('.chat-input')).value(), '测试取消');
    await mp.callWxMethod('reLaunch', { url: '/pages/index/index' }); await wait(5000); await tab('chat'); await fresh();
    assert.equal((await page.$$('.message-row')).length, 0); assert.equal(await page.$('.insight-card'), null);
    assert.equal((await api('/api/issues/current')).version, after.version);
    assert.equal((await api('/qa/status')).paid_requests, 0);
  }
  const source = await fs.readFile(path.resolve(__dirname, '../apps/miniprogram/src/components/OnboardingFlow.vue'));
  const report = { phase: offline ? 'offline' : 'online', completed_at: new Date().toISOString(), onboarding_sha256: require('node:crypto').createHash('sha256').update(source).digest('hex'), model: info.model, width: info.windowWidth, height: info.windowHeight, passed: true, paid_requests: 0, runtime_exceptions: exceptions };
  assert.deepEqual(exceptions, []);
  await fs.writeFile(path.join(dir, `${report.phase}-${info.windowWidth}-report.json`), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
})().catch(error => { console.error(error.message, error.stack?.split('\n').slice(1, 3).join('\n')); process.exitCode = 1; }).finally(async () => {
  if (mp) { try { if (backed) { for (const [key, value] of [['agency.session', originalSession], ['agency.onboarding.v2', originalDraft]]) { if (value) await mp.callWxMethod('setStorageSync', key, value); else await mp.callWxMethod('removeStorageSync', key); } } } finally { await mp.disconnect(); } }
});
