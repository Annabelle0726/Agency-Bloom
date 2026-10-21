// Native simulator QA against a separately copied tourist project and port 8018 only.
// 1. Build with VITE_API_BASE_URL=http://127.0.0.1:8018/api
// 2. node tools/verify-conversations-native.cjs --prepare
// 3. CLI auto --project output/conversations/native-project --auto-port 9438
// 4. Run mock-conversations-api.py, then this script without --prepare.
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const auto = require('../output/native-sdk/node_modules/miniprogram-automator');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'output/conversations');
const project = path.join(out, 'native-project');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let mp, page, auth;
const errors = [];
async function api(route, method = 'GET', body) {
  const response = await fetch('http://127.0.0.1:8018' + route, { method, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) }, body: body ? JSON.stringify(body) : undefined });
  assert.ok(response.ok, `Mock ${route}: ${response.status}`); return response.status === 204 ? null : response.json();
}
async function fresh() {
  // This Developer Tools build retains a stale app binding across reLaunch.
  // Reconnect to the same isolated project, as the existing native QA helpers do.
  if (mp) await mp.disconnect();
  mp = await auto.connect({ wsEndpoint: 'ws://127.0.0.1:9438' });
  mp.on('exception', error => errors.push(String(error)));
  for (let i = 0; i < 50; i++) {
    if (i && i % 10 === 0) { await mp.disconnect(); mp = await auto.connect({ wsEndpoint: 'ws://127.0.0.1:9438' }); mp.on('exception', error => errors.push(String(error))); }
    try { page = (await mp.pageStack())[0]; if (page) return; } catch { /* Native page registration may trail reLaunch. */ }
    await wait(300);
  }
  throw Error('Native page did not register after launch');
}
async function drawer() { for (let i = 0; i < 20; i++) { await fresh(); const value = await page.$('components\\/ConversationDrawer'); if (value) return value; await wait(100); } throw Error('Drawer component did not mount'); }
async function tapText(parent, text) {
  for (const button of await parent.$$('button')) { if ((await button.text()).trim() === text) { await button.tap(); await wait(180); return; } }
  throw Error('Missing button: ' + text);
}
async function until(check, label) { for (let i = 0; i < 50; i++) { await fresh(); if (await check()) return; await wait(200); } throw Error(label); }
async function shot(name) { await mp.screenshot({ path: path.join(out, name + '.png') }); }
(async () => {
  await fs.mkdir(out, { recursive: true });
  if (process.argv.includes('--prepare')) {
    const source = path.join(root, 'apps/miniprogram/dist/build/mp-weixin');
    assert.match(await fs.readFile(path.join(source, 'pages/index/useIndexPage.js'), 'utf8'), /127\.0\.0\.1:8018/);
    await fs.cp(source, project, { recursive: true });
    const config = JSON.parse(await fs.readFile(path.join(project, 'project.config.json'), 'utf8'));
    config.appid = 'touristappid'; config.projectname = 'AgencyOS Isolated Conversation QA'; config.setting.urlCheck = false;
    await fs.writeFile(path.join(project, 'project.config.json'), JSON.stringify(config, null, 2));
    console.log('Prepared separate tourist project; application storage will not be inspected'); return;
  }
  assert.equal(JSON.parse(await fs.readFile(path.join(project, 'project.config.json'), 'utf8')).appid, 'touristappid');
  assert.equal((await api('/qa/status')).provider, 'conversation-isolated-mock');
  const login = await api('/api/auth/dev', 'POST', { privacy_accepted: true }); auth = 'Bearer ' + login.token;
  await api('/api/me', 'PUT', { ai_consent: true, save_chat: true });
  const issue = await api('/api/issues', 'POST', { title: '测试：下一份工作的选择', background: '虚构测试：保留收入，每周两小时', concerns: ['choices'] });
  const all = await api('/api/conversations'); const first = all.find(c => c.issue_id === issue.id);
  mp = await auto.connect({ wsEndpoint: 'ws://127.0.0.1:9438' });
  mp.on('exception', error => errors.push(String(error)));
  await mp.mockWxMethod('showModal', { confirm: true, cancel: false });
  await mp.callWxMethod('setStorageSync', 'agency.session', login.token);
  await mp.callWxMethod('reLaunch', { url: '/pages/index/index' });
  await until(async () => !!await page.$('[data-tab="chat"]'), 'Signed-in workspace did not load');
  await (await page.$('[data-tab="chat"]')).tap(); await wait(300); await fresh();
  await (await page.$('.chat-input')).input('A的未发送草稿');
  await tapText(page, '会话与探索');
  let panel = await drawer();
  const info = await mp.systemInfo();
  // Measure after the slide-in animation has settled.
  await until(async () => { const el = await (await drawer()).$('.workspace-drawer'); const p = await el.offset(); return Math.abs(p.left) < 1; }, 'Drawer did not settle at left edge');
  panel = await drawer(); const box = await panel.$('.workspace-drawer');
  const pos = await box.offset(), size = await box.size();
  console.log(JSON.stringify({ phase: 'drawer-geometry', width: info.windowWidth, height: info.windowHeight, pos, size }));
  await shot('drawer');
  assert.ok(Math.abs(pos.left) < 1 && size.width < info.windowWidth, 'Drawer anchors on the left');
  assert.deepEqual(await Promise.all((await panel.$$('.conversation-sections button')).map(b => b.text())), ['进行中', '探索', '已归档']);
  await tapText(panel, '＋ 新会话'); panel = await drawer();
  console.log('phase:new-conversation');
  await (await panel.$('.text-input')).input('测试：并行会话 B');
  await tapText(panel, '开始这段会话');
  await until(async () => (await (await page.$('.chat-title')).text()).includes('并行会话 B'), 'New conversation did not open');
  await (await page.$('.chat-input')).input('B的未发送草稿');
  let tabs = await page.$$('.conversation-windows button'); await tabs[0].tap();
  await until(async () => (await (await page.$('.chat-title')).text()) === '开始探索', 'A did not become active');
  assert.equal(await (await page.$('.chat-input')).value(), 'A的未发送草稿');
  console.log('phase:parallel-send');
  await (await page.$('.chat-input')).input('慢回复：A的消息'); await (await page.$('.send-button')).tap();
  tabs = await page.$$('.conversation-windows button'); await tabs[1].tap();
  await until(async () => (await (await page.$('.chat-title')).text()).includes('并行会话 B'), 'B did not become active while A generated');
  assert.equal(await (await page.$('.chat-input')).value(), 'B的未发送草稿');
  await wait(3400); await fresh(); assert.equal((await page.$$('.message-row')).length, 0, 'A response must not enter B');
  tabs = await page.$$('.conversation-windows button'); await tabs[0].tap();
  await until(async () => (await page.$$('.message-row')).length === 2, 'Originating response was lost');
  await shot('parallel-chat');
  await tapText(page, '整理当前会话'); panel = await drawer();
  console.log('phase:summary');
  await (await panel.$('.generate-summary')).tap();
  await until(async () => !!await (await drawer()).$('.summary-status'), 'Summary draft missing');
  assert.equal((await api('/api/conversations/' + first.id)).summary, null);
  panel = await drawer(); await (await panel.$('.confirm-summary')).tap(); await wait(350);
  assert.ok((await api('/api/conversations/' + first.id)).summary.overview);
  await shot('summary');
  panel = await drawer(); await tapText(panel, '长期记忆'); panel = await drawer();
  console.log('phase:memory');
  await tapText(panel, '＋ 添加记忆'); panel = await drawer();
  await (await panel.$('.memory-editor textarea')).input('虚构测试：每周最多两小时');
  await (await panel.$('.confirm-memory')).tap(); await wait(300); panel = await drawer();
  assert.equal((await api('/api/memories')).length, 1);
  await (await panel.$('.memory-use')).tap(); await wait(250);
  assert.equal((await api('/api/me')).use_memory, true);
  panel = await drawer(); await tapText(panel, '＋ 添加记忆'); panel = await drawer();
  await (await panel.$('.memory-editor textarea')).input('虚构测试：愿意先做小尝试');
  await (await panel.$('.confirm-memory')).tap();
  await until(async () => (await api('/api/memories')).length === 2, 'Second memory missing');
  panel = await drawer(); for (const button of await panel.$$('.memory-select')) await button.tap();
  panel = await drawer(); await (await panel.$$('.memory-toolbar .secondary'))[1].tap(); panel = await drawer();
  await (await panel.$('.memory-editor textarea')).input('虚构测试：每周两小时做小尝试');
  await (await panel.$('.confirm-memory')).tap();
  await until(async () => (await api('/api/memories')).length === 1, 'Merge did not replace selected memories');
  assert.equal((await api('/api/memories'))[0].content, '虚构测试：每周两小时做小尝试');
  panel = await drawer(); await tapText(panel, '停用');
  await until(async () => (await api('/api/memories'))[0].enabled === false, 'Memory did not disable');
  panel = await drawer(); await tapText(panel, '启用');
  await until(async () => (await api('/api/memories'))[0].enabled === true, 'Memory did not enable');
  await shot('memory');
  panel = await drawer(); await tapText(panel, '会话'); panel = await drawer();
  const archiveButton = await panel.$('.archive-action'); await archiveButton.tap(); await wait(300);
  assert.equal((await api('/api/conversations?archived=true')).length, 1);
  panel = await drawer(); await tapText(panel, '已归档'); panel = await drawer(); await tapText(panel, '恢复会话'); await wait(300);
  assert.equal((await api('/api/conversations?archived=true')).length, 0);
  panel = await drawer(); await tapText(panel, '进行中'); panel = await drawer();
  for (const button of await panel.$$('.conversation-select')) { if ((await button.text()).includes('并行会话 B')) { await button.tap(); break; } }
  await until(async () => (await (await page.$('.chat-title')).text()).includes('并行会话 B'), 'B was not selected before restart');
  await mp.callWxMethod('reLaunch', { url: '/pages/index/index' });
  await until(async () => !!await page.$('[data-tab="chat"]'), 'Reload did not restore account');
  await (await page.$('[data-tab="chat"]')).tap(); await wait(300); await fresh();
  assert.ok((await (await page.$('.chat-title')).text()).includes('并行会话 B'), 'Last selected conversation not restored');
  assert.equal(await (await page.$('.chat-input')).value(), '', 'Draft must not persist to disk');
  await tapText(page, '会话与探索'); panel = await drawer();
  for (const button of await panel.$$('.conversation-select')) { if ((await button.text()).includes('开始探索')) { await button.tap(); break; } }
  await until(async () => (await page.$$('.message-row')).length === 2, 'Saved A messages not restored');
  console.log('phase:delete-and-empty-greeting');
  await tapText(page, '会话与探索'); panel = await drawer();
  // Delete through the native UI, including the selected conversation.
  for (let i = 0; i < 2; i++) {
    panel = await drawer(); await (await panel.$('.delete-conversation')).tap();
    await until(async () => (await api('/api/conversations')).length === 1 - i, 'Conversation deletion did not finish');
  }
  panel = await drawer();
  assert.ok((await (await panel.$('.empty-greeting')).text()).includes('每周两小时做小尝试'));
  assert.equal(await panel.$('.drawer-scroll-indicator'), null, 'An idle empty drawer needs no scrollbar');
  await shot('empty-memory');
  await (await panel.$('.empty-create')).tap();
  await until(async () => !!await (await drawer()).$('.text-input'), 'Empty-state creation form did not render');
  panel = await drawer();
  await (await panel.$('.text-input')).input('测试：空状态创建'); await tapText(panel, '开始这段会话');
  await until(async () => (await (await page.$('.chat-title')).text()).includes('空状态创建'), 'Empty-state create did not open a conversation');
  assert.equal((await page.$$('.message-row')).length, 0, 'Greeting must not fabricate chat turns');
  // Question fallback and six theme renders use this disposable account only.
  await api('/api/me', 'PUT', { use_memory: false });
  const question = await api('/api/issues', 'POST', { title: '测试：工作与学习', actual_question: '如何在保留收入的同时探索新方向？' });
  for (const item of await api('/api/conversations')) await api(`/api/conversations/${item.id}?version=${item.version}`, 'DELETE');
  const callsBeforeGreeting = (await api('/qa/status')).calls;
  for (const theme of ['light', 'dark', 'dawn', 'forest', 'lavender', 'minimal']) {
    await api('/api/me', 'PUT', { theme });
    await mp.callWxMethod('reLaunch', { url: '/pages/index/index' });
    await until(async () => !!await page.$('[data-tab="chat"]'), 'Theme reload did not restore account');
    await (await page.$('[data-tab="chat"]')).tap(); await wait(300); await fresh();
    await tapText(page, '会话与探索'); panel = await drawer();
    // Pin the specific exploration instead of depending on timestamp ordering.
    await tapText(panel, question.title); panel = await drawer();
    assert.ok((await (await panel.$('.empty-greeting')).text()).includes(question.actual_question));
    assert.equal(await panel.$('.drawer-scroll-indicator'), null);
    await shot('empty-' + theme);
    const overflow = [];
    for (let i = 0; i < 9; i++) overflow.push(await api('/api/conversations', 'POST', { issue_id: question.id, title: `测试：方向比较 ${i + 1}` }));
    await (await panel.$('.drawer-heading .icon-button')).tap(); await fresh(); await tapText(page, '会话与探索'); panel = await drawer();
    const scroller = await panel.$('.drawer-scroll');
    assert.ok(await scroller.scrollHeight() > (await scroller.size()).height, 'Overflow fixture must actually scroll');
    await scroller.scrollTo(0, 240); await wait(80);
    const indicator = await panel.$('.drawer-scroll-indicator > view');
    assert.ok(indicator, 'Themed indicator must appear during actual native scrolling');
    const colors = { light: 'rgb(101, 112, 134)', dark: 'rgb(162, 175, 176)', dawn: 'rgb(123, 104, 88)', forest: 'rgb(95, 113, 99)', lavender: 'rgb(116, 103, 127)', minimal: 'rgb(103, 110, 105)' };
    assert.equal(await indicator.style('background-color'), colors[theme]);
    await shot('scroll-' + theme);
    await wait(1000); assert.equal(await panel.$('.drawer-scroll-indicator'), null, 'Indicator must disappear while idle');
    for (const item of overflow) await api(`/api/conversations/${item.id}?version=${item.version}`, 'DELETE');
  }
  assert.equal((await api('/qa/status')).calls, callsBeforeGreeting, 'Greetings must not call a model');
  assert.equal((await api('/qa/status')).paid_requests, 0);
  assert.deepEqual(errors, []);
  const report = { passed: true, width: info.windowWidth, height: info.windowHeight, model: info.model, paid_requests: 0,
    flows: ['left drawer', 'tab order', 'independent drafts', 'late reply routing', 'summary review/save', 'memory create/use/merge/disable', 'archive/restore', 'last selected conversation restoration', 'no draft persistence', 'delete selected and other conversations', 'empty state creation', 'memory greeting', 'question fallback', 'six themes without idle scrollbar', 'six actual overflow scrolls with theme colors and idle dismissal', 'no model call for greetings'], runtime_errors: errors };
  await fs.writeFile(path.join(out, 'native-report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
})().catch(async error => { try { if (mp) await shot('failure'); } catch {} console.error(error.message, error.stack?.split('\n').slice(1, 7).join('\n'), errors); process.exitCode = 1; }).finally(async () => { if (mp) { try { await mp.restoreWxMethod('showModal'); } catch {} await mp.disconnect(); } });
