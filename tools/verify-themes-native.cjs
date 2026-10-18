// Requires output/themes/mp-weixin on native port 9434 and the isolated Mock API on 8004
// Creates a synthetic QA account only; never sends chat or paid provider requests
const auto = require('../output/native-sdk/node_modules/miniprogram-automator');
const fs = require('node:fs/promises'), assert = require('node:assert/strict');
const ids = ['light', 'dark', 'dawn', 'forest', 'lavender', 'minimal'];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let mp, page, auth = '';
const errors = [], results = [];
async function api(route, method = 'GET', body) {
  assert.ok(!route.endsWith('/chat'), 'This QA never sends model requests');
  const response = await fetch('http://127.0.0.1:8004' + route, { method,
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  assert.ok(response.ok, route + ' HTTP ' + response.status); return response.json();
}
async function fresh() {
  if (mp) await mp.disconnect();
  mp = await auto.connect({ wsEndpoint: 'ws://127.0.0.1:9434' });
  mp.on('exception', e => errors.push(String(e)));
  page = (await mp.pageStack())[0];
}
async function tab(name) { await fresh(); await (await page.$(`[data-tab="${name}"]`)).tap(); await wait(250); await fresh(); }
async function appearance() {
  await tab('settings'); await (await page.$('.setting-row')).tap(); await wait(200); await fresh();
  assert.equal((await page.$$('.theme-card')).length, 6);
}
async function shot(name) { await mp.screenshot({ path: `output/themes/native-${name}.png` }); }
(async () => {
  await fs.mkdir('output/themes', { recursive: true });
  const before = await api('/qa/status'); assert.equal(before.provider, 'MockTransport only');
  const login = await api('/api/auth/dev', 'POST', { privacy_accepted: true }); auth = 'Bearer ' + login.token;
  await api('/api/issues', 'POST', { title: '探索经历的新用处', concerns: ['change'], exploration_intent: 'change', focus_response: '喜欢把复杂问题解释清楚', support_style: 'discover' });
  await fresh(); await mp.callWxMethod('setStorageSync', 'agency.session', login.token);
  await mp.callWxMethod('reLaunch', { url: '/pages/index/index' }); await wait(4500); await fresh();
  const device = await mp.systemInfo(); await appearance();
  await shot('picker-top');
  const footer = await page.$('.appearance-footer');
  const bottom = (await footer.offset()).top + (await footer.size()).height;
  assert.ok(bottom <= device.windowHeight + 1, 'Done action must remain in the viewport');
  const initial = await api('/api/me');
  for (let index = 0; index < ids.length; index++) {
    const id = ids[index];
    await (await page.$('.appearance-scroll')).scrollTo(0, index < 2 ? 0 : index < 4 ? 170 : 9999); await wait(180);
    const card = await page.$(`[data-theme="${id}"]`);
    const preview = await (await card.$('image')).attribute('src');
    const image = await mp.callWxMethod('getImageInfo', { src: preview }); assert.ok(image.width > 0);
    await Promise.all([card.tap(), card.tap()]); await wait(350); await fresh();
    const saved = await api('/api/me'); assert.equal(saved.theme, id);
    for (const key of ['id', 'save_chat', 'ai_consent', 'support_style']) assert.equal(saved[key], initial[key]);
    assert.equal(await (await page.$(`[data-theme="${id}"]`)).attribute('aria-pressed'), 'true');
    await (await (await page.$('.appearance-footer')).$('components\\/ActionButton')).$('button').then(button => button.tap());
    await wait(180); await tab('now'); await mp.pageScrollTo(0); await shot(id + '-home');
    const background = await (await page.$('.theme-atmosphere image')).attribute('src');
    const picture = await mp.callWxMethod('getImageInfo', { src: background }); assert.equal(picture.width, 640);
    await tab('chat'); await shot(id + '-chat');
    results.push({ theme: id, preview, background, persisted: true });
    await appearance();
  }
  await (await page.$('.appearance-scroll')).scrollTo(0, 9999); await shot('picker-bottom');
  await mp.callWxMethod('reLaunch', { url: '/pages/index/index' }); await wait(4500); await fresh();
  assert.match(await (await page.$('.preview-stage')).attribute('class'), /theme-minimal/);
  await mp.callWxMethod('removeStorageSync', 'agency.session');
  await mp.callWxMethod('reLaunch', { url: '/pages/index/index' }); await wait(2500); await fresh();
  assert.match(await (await page.$('.preview-stage')).attribute('class'), /theme-light/);
  assert.equal(await page.$('.theme-card'), null);
  await api('/api/me', 'PUT', { theme: 'light' });
  await mp.callWxMethod('setStorageSync', 'agency.session', login.token);
  await mp.callWxMethod('reLaunch', { url: '/pages/index/index' }); await wait(4000); await appearance();
  await shot('picker-final');
  const after = await api('/qa/status'); assert.equal(after.calls.length, before.calls.length);
  assert.deepEqual(errors, []);
  const report = { completed: new Date().toISOString(), device, results, restartPreservesTheme: true, signedOutUsesDefault: true, providerCalls: after.calls.length - before.calls.length, exceptions: errors };
  await fs.writeFile('output/themes/native-report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ device: device.model, width: device.windowWidth, themes: results.length, providerCalls: report.providerCalls, exceptions: errors }));
})().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => { if (mp) await mp.disconnect() });
