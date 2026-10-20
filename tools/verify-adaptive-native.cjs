// Use the SAME isolated setup documented in verify-conversations-native.cjs.
// Requires its separately copied tourist project, Mock API 8018 and port 9438.
// Does not read or operate on the normal application project or private database.
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const auto = require('../output/native-sdk/node_modules/miniprogram-automator');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'output/adaptive');
const project = path.join(root, 'output/conversations/native-project');
let mp, page, auth;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function api(route, method = 'GET', body) {
  const response = await fetch('http://127.0.0.1:8018' + route, { method, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) }, body: body ? JSON.stringify(body) : undefined });
  assert.ok(response.ok, `Mock ${route}: ${response.status}`); return response.status === 204 ? null : response.json();
}
async function fresh() {
  if (mp) await mp.disconnect();
  mp = await auto.connect({ wsEndpoint: 'ws://127.0.0.1:9438' });
  page = (await mp.pageStack())[0];
}
async function until(check, label) {
  for (let i = 0; i < 40; i++) { try { await fresh(); if (page && await check()) return; } catch (e) { if (i === 39) throw e; } await wait(300); }
  throw Error(label);
}
async function tapText(parent, text) {
  for (const button of await parent.$$('button')) if ((await button.text()).trim() === text) { await button.tap(); await wait(180); return; }
  throw Error('Missing button: ' + text);
}
async function component(name) { return page.$(`components\\/${name}`); }
async function send(text) {
  await fresh(); await (await page.$('.chat-input')).input(text);
  await (await page.$('.send-button')).tap();
  await until(async () => !!await page.$('.review-phase-change'), 'Phase candidate not rendered');
}
(async () => {
  assert.equal(JSON.parse(await fs.readFile(path.join(project, 'project.config.json'), 'utf8')).appid, 'touristappid');
  assert.equal((await api('/qa/status')).provider, 'conversation-isolated-mock');
  await fs.mkdir(out, { recursive: true });
  const login = await api('/api/auth/dev', 'POST', { privacy_accepted: true }); auth = 'Bearer ' + login.token;
  await api('/api/me', 'PUT', { ai_consent: true, use_memory: true, save_chat: true });
  const issue = await api('/api/issues', 'POST', { title: '测试：工作方向', background: '虚构测试：上个月希望稳定', concerns: ['direction'] });
  const original = await api('/api/memories', 'POST', { content: '希望找到稳定工作', horizon: 'current_phase', issue_id: issue.id, confirmed: true });
  mp = await auto.connect({ wsEndpoint: 'ws://127.0.0.1:9438' });
  await mp.mockWxMethod('showModal', { confirm: true, cancel: false });
  await mp.callWxMethod('setStorageSync', 'agency.session', login.token);
  await mp.callWxMethod('reLaunch', { url: '/pages/index/index' });
  await until(async () => !!await page.$('[data-tab="chat"]'), 'Workspace missing');
  await (await page.$('[data-tab="chat"]')).tap(); await wait(300);
  const info = await mp.systemInfo();
  console.log(JSON.stringify({ width: info.windowWidth, height: info.windowHeight, phase: 'adaptive-start' }));
  await send('现在更想探索有成长空间的新工作方向');
  assert.equal((await api('/api/memories')).length, 1);
  await (await page.$('.review-phase-change')).tap();
  await until(async () => !!await component('PhaseChangeReview'), 'Review missing');
  await mp.screenshot({ path: path.join(out, 'verify-change.png') });
  let panel = await component('PhaseChangeReview');
  await (await panel.$('.confirm-phase-change')).tap();
  await until(async () => { const p = await component('PhaseChangeReview'); return p && !!await p.$('.phase-content'); }, 'Editable change missing after confirmation');
  panel = await component('PhaseChangeReview');
  assert.equal((await api('/api/memories'))[0].content, original.content);
  await (await panel.$('.phase-content')).input('先探索一份有成长空间的工作');
  await mp.screenshot({ path: path.join(out, 'review-before-save.png') });
  await (await panel.$('.save-phase-change')).tap();
  await until(async () => (await api('/api/memories'))[0].content === '先探索一份有成长空间的工作', 'Explicit save missing');
  const saved = (await api('/api/memories'))[0];
  assert.notEqual(saved.id, original.id); assert.equal(saved.horizon, 'current_phase');
  await send('现在更想探索自由职业工作');
  await (await page.$('.review-phase-change')).tap();
  await until(async () => !!await component('PhaseChangeReview'), 'Second review missing');
  panel = await component('PhaseChangeReview'); await (await panel.$('.skip-phase-change')).tap();
  await wait(250); await fresh();
  assert.equal((await api('/api/memories'))[0].content, saved.content);
  assert.equal(await page.$('.review-phase-change'), null);
  await until(async () => (await api('/api/conversations')).some(c => c.dismissed_change_ids.includes(saved.id)), 'Skip metadata missing');
  await mp.callWxMethod('reLaunch', { url: '/pages/index/index' });
  await until(async () => !!await page.$('[data-tab="chat"]'), 'Restart workspace missing');
  await (await page.$('[data-tab="chat"]')).tap(); await wait(250); await fresh();
  await (await page.$('.chat-input')).input('现在更想探索自由职业工作');
  await (await page.$('.send-button')).tap();
  await until(async () => (await api(`/api/conversations/${issue.id}/messages`)).items.length >= 6, 'Reply after restart missing');
  assert.equal(await page.$('.review-phase-change'), null);
  await mp.callWxMethod('reLaunch', { url: '/pages/index/index' });
  await until(async () => !!await page.$('[data-tab="settings"]'), 'Home settings tab missing');
  await (await page.$('[data-tab="settings"]')).tap(); await wait(250); await fresh();
  await (await page.$('.current-direction')).tap();
  await until(async () => { const p = await component('ConversationDrawer'); return p && !!await p.$('.memory-item'); }, 'Direction management missing');
  panel = await component('ConversationDrawer');
  await mp.screenshot({ path: path.join(out, 'current-direction.png') });
  assert.ok((await panel.text()).includes(saved.content));
  await (await panel.$('.delete-snapshot')).tap();
  await until(async () => (await api(`/api/issues/${issue.id}/snapshot`)) === null, 'Snapshot deletion missing');
  await fs.writeFile(path.join(out, 'result.json'), JSON.stringify({ dimensions: [info.windowWidth, info.windowHeight], flows: ['candidate does not save', 'confirmation does not save', 'edit then explicit save', 'default replaces without history', 'skip does not change memory', 'skip survives restart', 'My direction list', 'delete initial snapshot'], paid_requests: (await api('/qa/status')).paid_requests }, null, 2));
  console.log('Adaptive native flows passed');
})().catch(async e => { console.error(e); process.exitCode = 1; if (mp) await mp.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {}); }).finally(async () => { if (mp) await mp.disconnect(); });
