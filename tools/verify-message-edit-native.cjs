// Use tools/mock-conversations-api.py on 8018 and the copied tourist project
// prepared by verify-conversations-native.cjs --prepare, automation port 9438.
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const auto = require('../output/native-sdk/node_modules/miniprogram-automator');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'output/message-edit');
let mp, page, auth;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function api(route, method = 'GET', data) {
  const res = await fetch('http://127.0.0.1:8018'+route, {method, headers:{'Content-Type':'application/json', ...(auth ? {Authorization:auth}: {})}, body:data ? JSON.stringify(data):undefined});
  assert.ok(res.ok, `${route}: ${res.status}`); return res.status === 204 ? null : res.json();
}
async function fresh() {
  if (mp) await mp.disconnect();
  mp = await auto.connect({wsEndpoint:'ws://127.0.0.1:9438'});
  page = (await mp.pageStack())[0];
}
async function until(check, label) {
  for (let i=0;i<20;i++) {
    try { await fresh(); if (page && await check()) return; }
    catch (error) { if (i >= 2) throw error; }
    await sleep(250);
  }
  throw Error(label);
}
async function relaunch() {
  try { await mp.callWxMethod('reLaunch',{url:'/pages/index/index'}); }
  catch (error) {
    // This SDK can lose its callback while reLaunch replaces the app binding.
    // Observe the new page; never repeat the mutation automatically.
    console.log('reLaunch callback unavailable; reconnecting to observe page');
  }
}
// Developer Tools exposes uni-app custom tags as generic "component" nodes;
// descend through component boundaries rather than relying on flattened DOM.
async function find(selector, scope = page) {
  const direct = await scope.$(selector);
  if (direct) return direct;
  for (const child of await scope.$$('component')) {
    const match = await find(selector, child); if (match) return match;
  }
  return null;
}
async function all(selector, scope = page) {
  const matches = await scope.$$(selector);
  for (const child of await scope.$$('component')) matches.push(...await all(selector, child));
  return matches;
}
async function send(text) {
  await (await find('.chat-input')).input(text); await (await find('.send-button')).tap();
}
async function choose(index, action) {
  await (await all('.message-bubble'))[index].longpress();
  await until(async()=>!!await find('.message-action-select'),'longpress actions');
  const edit = await find('.message-action-edit');
  const selectors = edit ? ['.message-action-edit','.message-action-copy','.message-action-select']
    : ['.message-action-copy','.message-action-select'];
  await (await find(selectors[action])).tap();
}
(async () => {
  const project = path.join(root, 'output/conversations/native-project');
  assert.equal(JSON.parse(await fs.readFile(path.join(project,'project.config.json'),'utf8')).appid,'touristappid');
  assert.match(await fs.readFile(path.join(project,'pages/index/useIndexPage.js'),'utf8'), /127\.0\.0\.1:8018/);
  const start = await api('/qa/status'); assert.equal(start.provider,'conversation-isolated-mock');
  console.log('isolated fixture verified');
  await fs.mkdir(out,{recursive:true});
  const login = await api('/api/auth/dev','POST',{privacy_accepted:true}); auth='Bearer '+login.token;
  await api('/api/me','PUT',{ai_consent:true,save_chat:true});
  await api('/api/issues','POST',{title:'消息修改测试',concerns:['choices'],background:'隔离合成数据'});
  await fresh(); await mp.callWxMethod('setStorageSync','agency.session',login.token);
  console.log('connected; synthetic session installed');
  await relaunch();
  await until(async()=>!!await find('[data-tab="chat"]') || !!await find('.chat-input'),'workspace');
  const tab = await find('[data-tab="chat"]'); if (tab) await tab.tap();
  await until(async()=>!!await find('.chat-input'),'chat');
  console.log('chat ready');
  await send('第一条原消息');
  await until(async()=>(await all('.message-row')).length===2 && await (await find('.chat-input')).value()==='','first turn');
  await send('随后的一条消息');
  await until(async()=>(await all('.message-row')).length===4 && await (await find('.chat-input')).value()==='','second turn');
  console.log('two turns saved');
  const conversations=await api('/api/conversations?limit=100&offset=0');
  const cid=conversations.items ? conversations.items[0].id : conversations[0].id;
  await choose(0,0);
  await until(async()=>!!await find('.message-edit-input'),'edit modal');
  console.log('edit modal opened by longpress');
  await mp.screenshot({path:path.join(out,'edit-confirmation.png')});
  await (await find('.message-edit-input')).input('修正后的第一条');
  await (await find('.message-edit-save')).tap();
  await until(async()=>(await all('.message-row')).length===2 && !await find('.message-edit-input'),'replacement');
  console.log('branch replaced');
  const rows=(await api(`/api/conversations/${cid}/messages`)).items;
  assert.equal(rows.length,2); assert.equal(rows[0].content,'修正后的第一条');
  assert.equal(await (await all('.message-bubble'))[0].text(),'修正后的第一条');
  // Leave the user's system clipboard untouched; check OS copying on a real device.
  await choose(1,1);
  await until(async()=>!!await find('.selectable-message'),'selection view');
  const selection = await find('.selectable-message');
  assert.equal(String(await selection.attribute('user-select')),'true');
  await mp.screenshot({path:path.join(out,'select-text.png')});
  await relaunch();
  await until(async()=>!!await find('[data-tab="chat"]') || !!await find('.chat-input'),'relaunch');
  const restartTab = await find('[data-tab="chat"]'); if (restartTab) await restartTab.tap();
  await until(async()=>(await all('.message-row')).length===2,'persisted edit');
  assert.equal(await (await all('.message-bubble'))[0].text(),'修正后的第一条');
  await mp.screenshot({path:path.join(out,'persisted-edit.png')});
  const info=await mp.systemInfo(), end=await api('/qa/status');
  assert.equal(end.calls-start.calls,3);
  const report={width:info.windowWidth,height:info.windowHeight,calls:end.calls-start.calls,paid_requests:0,
    flows:['longpress edit','replace downstream rows','selectable assistant text','restart recovery'],
    limitation:'OS clipboard writes and text-selection handle dragging require a real-device manual check.'};
  await fs.writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report)); await mp.disconnect();
})().catch(async e=>{ console.error(e); if(mp) await mp.disconnect(); process.exitCode=1; });
