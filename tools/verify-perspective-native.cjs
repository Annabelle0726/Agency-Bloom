// Isolated tourist project only; never attach to the user's existing simulator.
// Build with VITE_API_BASE_URL=http://127.0.0.1:8019/api and VITE_PERSPECTIVE_PROTOTYPE=true.
// Run --prepare, open output/perspective/native-project with CLI auto port 9439,
// start tools/mock-perspective-api.py, then run without --prepare.
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const auto = require('../output/native-sdk/node_modules/miniprogram-automator');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'output/perspective');
const project = path.join(out, 'native-project');
let mp, page, auth; const errors = [];
const theme = process.argv.includes('--dark') ? 'dark' : 'light';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function api(route, method = 'GET', data) {
  const res = await fetch('http://127.0.0.1:8019' + route, { method,
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) },
    body: data ? JSON.stringify(data) : undefined });
  assert.ok(res.ok, `Mock route status ${res.status}`); return res.status === 204 ? null : res.json();
}
async function refresh() {
  if (mp) await mp.disconnect();
  mp = await auto.connect({ wsEndpoint: 'ws://127.0.0.1:9439' });
  mp.on('exception', e => errors.push(String(e)));
  page = (await mp.pageStack())[0];
}
async function until(check, label) {
  for (let i = 0; i < 40; i++) { await refresh(); if (page && await check()) return; await wait(250); }
  throw Error(label);
}
const compPath = name => name.replaceAll('/', '\\/');
async function tabbar() { return page.$(compPath('pages/index/views/AppTabbar')); }
async function composer() { return page.$(compPath('pages/index/chat/ChatComposer')); }
async function messageItems() {
  const view = await page.$(compPath('pages/index/ChatView'));
  return view ? view.$$(compPath('pages/index/chat/ChatMessage')) : [];
}
async function entry() {
  for (const item of await messageItems()) {
    const e = await item.$(compPath('pages/index/chat/PerspectiveShiftEntry'));
    if (e) return e;
  }
  return null;
}
async function reasoning() {
  for (const item of await messageItems()) if (await item.$('.reasoning-toggle')) return true;
  return false;
}
async function shot(name) { await mp.callWxMethod('pageScrollTo', { scrollTop: 100000, duration: 0 }); await wait(250); await mp.screenshot({ path: path.join(out, name + '.png') }); }
(async () => {
  await fs.mkdir(out, { recursive: true });
  if (process.argv.includes('--prepare')) {
    const source = path.join(root, 'apps/miniprogram/dist/build/mp-weixin');
    assert.match(await fs.readFile(path.join(source, 'pages/index/useIndexPage.js'), 'utf8'), /127\.0\.0\.1:8019/);
    await fs.cp(source, project, { recursive: true });
    const config = JSON.parse(await fs.readFile(path.join(project, 'project.config.json'), 'utf8'));
    config.appid = 'touristappid'; config.projectname = 'Agency Bloom Isolated Perspective QA'; config.setting.urlCheck = false;
    await fs.writeFile(path.join(project, 'project.config.json'), JSON.stringify(config, null, 2));
    console.log('Prepared isolated tourist project at ' + project); return;
  }
  assert.equal(JSON.parse(await fs.readFile(path.join(project, 'project.config.json'), 'utf8')).appid, 'touristappid');
  assert.equal((await api('/qa/status')).provider, 'perspective-isolated-mock');
  const signIn = await api('/api/auth/dev', 'POST', { privacy_accepted: true });
  auth = 'Bearer ' + signIn.token;
  const user = await api('/api/me', 'PUT', { ai_consent: true, save_chat: true, theme });
  const item = await api('/api/issues', 'POST', { title: '虚构测试：职业选择', background: '虚构成年人，29岁', concerns: ['choices'] });
  const conv = await api('/api/conversations', 'POST', { issue_id: item.id, title: '换个角度离线测试', support_style: 'compare' });
  const input = '我想比较软件工程师和 AI 产品经理，同时保留稳定收入';
  for (let i = 0; i < 2; i++) await api(`/api/conversations/${conv.id}/chat`, 'POST', { request_id: randomUUID(), message: input });
  await refresh();
  await mp.callWxMethod('setStorageSync', 'agency.session', signIn.token);
  await mp.callWxMethod('setStorageSync', `agency.selected-conversation.v1:${user.id}`, conv.id);
  await mp.callWxMethod('setStorageSync', `agency.theme.manual.v1:${user.id}`, true);
  await mp.callWxMethod('reLaunch', { url: '/pages/index/index' });
  await until(async () => !!await tabbar(), 'Workspace did not mount');
  await (await (await tabbar()).$('[data-tab="chat"]')).tap();
  await until(async () => !!await composer(), 'Composer did not mount');
  const info = await mp.systemInfo();
  await (await (await composer()).$('.chat-input')).input(input);
  await (await (await composer()).$('.send-button')).tap();
  await until(async () => !!await entry(), 'Perspective entry did not render');
  assert.equal(await (await entry()).$('.perspective-detail'), null, 'Default state must be collapsed');
  assert.ok(await reasoning(), 'Public response explanation remains available');
  await shot(theme + '-collapsed');
  await (await (await entry()).$('.perspective-toggle')).tap();
  await until(async () => !!await (await entry()).$('.perspective-detail'), 'Expansion did not render');
  const size = await (await (await entry()).$('.perspective-detail')).size();
  assert.ok(size.width <= info.windowWidth, 'Detail must fit the viewport');
  await shot(theme + '-expanded');
  const actions = await (await entry()).$('.perspective-actions');
  const actionBottom = (await actions.offset()).top + (await actions.size()).height;
  // Keep geometry in the report; UI scroll and native safe areas are checked visually.
  console.log(JSON.stringify({ theme, detailWidth: size.width, actionBottom, viewportHeight: info.windowHeight }));
  const before = (await api('/qa/status')).calls;
  const buttons = await (await entry()).$$('.perspective-actions button');
  assert.equal(buttons.length, 3);
  await buttons[0].tap();
  assert.ok((await (await (await composer()).$('.chat-input')).value()).includes('沿这个角度'));
  assert.equal((await api('/qa/status')).calls, before, 'Follow only prepares a draft');
  await buttons[theme === 'dark' ? 2 : 1].tap();
  await until(async () => !await entry(), 'Dismiss should hide the candidate');
  assert.equal((await api('/qa/status')).paid_requests, 0);
  assert.deepEqual(errors, []);
  const report = { passed: true, theme, width: info.windowWidth, height: info.windowHeight, model: info.model,
    paid_requests: 0, runtime_errors: errors,
    verified: ['collapsed entry', 'expanded layout', 'separate response reasoning', 'editable draft without call', theme === 'dark' ? 'close session hints' : 'dismiss'],
    limits: ['alternate narrow viewport and physical device not exercised'] };
  await fs.writeFile(path.join(out, 'native-report-' + theme + '.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
})().catch(async e => { try { if (mp) await shot('failure'); } catch {} console.error(e.message); process.exitCode = 1; })
  .finally(async () => { if (mp) await mp.disconnect(); });
