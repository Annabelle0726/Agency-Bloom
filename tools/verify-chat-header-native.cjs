// Synthetic accounts only: tools/mock-conversations-api.py on 8018.
// Build with VITE_API_BASE_URL=http://127.0.0.1:8018/api, run this with --prepare,
// then CLI auto --project output/conversations/native-project --auto-port 9438.
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const auto = require('../output/native-sdk/node_modules/miniprogram-automator');
const root = path.resolve(__dirname,'..'), project = path.join(root,'output/conversations/native-project');
const out = path.join(root,'output/header-actions');
let mp, page, auth;
const sleep = ms => new Promise(r=>setTimeout(r,ms));
async function api(route, method='GET', body) {
  const res = await fetch('http://127.0.0.1:8018'+route,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:auth}:{})},body:body?JSON.stringify(body):undefined});
  assert.ok(res.ok, `${route}: ${res.status}`); return res.status===204?null:res.json();
}
async function fresh() {
  if(mp) await mp.disconnect();
  mp=await auto.connect({wsEndpoint:'ws://127.0.0.1:9438'}); page=(await mp.pageStack())[0];
}
async function find(selector, scope=page) {
  const direct=await scope.$(selector); if(direct) return direct;
  for(const child of await scope.$$('component')) { const found=await find(selector,child); if(found) return found; }
  return null;
}
async function until(check,label) {
  for(let i=0;i<20;i++) {
    try { await fresh(); if(page && await check()) return; } catch(e) { if(i>2) throw e; }
    await sleep(200);
  }
  throw Error(label);
}
async function tap(selector) { const element=await find(selector); assert.ok(element,selector); await element.tap(); }
async function relaunch() {
  try { await mp.callWxMethod('reLaunch',{url:'/pages/index/index'}); }
  catch { console.log('reLaunch callback unavailable; observing new page'); }
  await until(async()=>!!await find('.topbar') || !!await find('.chat-header-title'),'workspace');
}
async function home() {
  if(await find('.chat-header-title')) await tap('[aria-label="返回主界面"]');
  await until(async()=>!!await find('.topbar'),'home');
}
async function chat() {
  if(await find('[data-tab="chat"]')) await tap('[data-tab="chat"]');
  await until(async()=>!!await find('.chat-header-title'),'chat');
}
async function geometry() {
  const button=await find('[aria-label="打开会话列表"]');
  const size=await button.size(), offset=await button.offset();
  return {width:Number(size.width),height:Number(size.height),left:offset.left,top:offset.top};
}
async function openAction(name) {
  await tap('.chat-header-title'); await until(async()=>!!await find('.chat-menu'),'menu');
  await tap('.menu-'+name); await until(async()=>!!await find('.conversation-action-submit'),'confirmation');
}
(async()=>{
  await fs.mkdir(out,{recursive:true});
  if(process.argv.includes('--prepare')) {
    const source=path.join(root,'apps/miniprogram/dist/build/mp-weixin');
    assert.match(await fs.readFile(path.join(source,'pages/index/useIndexPage.js'),'utf8'),/127\.0\.0\.1:8018/);
    await fs.cp(source,project,{recursive:true});
    const config=JSON.parse(await fs.readFile(path.join(project,'project.config.json'),'utf8'));
    config.appid='touristappid'; config.projectname='AgencyOS Isolated Conversation QA'; config.setting.urlCheck=false;
    await fs.writeFile(path.join(project,'project.config.json'),JSON.stringify(config,null,2));
    console.log('Prepared isolated tourist project'); return;
  }
  assert.equal(JSON.parse(await fs.readFile(path.join(project,'project.config.json'),'utf8')).appid,'touristappid');
  assert.match(await fs.readFile(path.join(project,'pages/index/useIndexPage.js'),'utf8'),/127\.0\.0\.1:8018/);
  const before=await api('/qa/status'); assert.equal(before.provider,'conversation-isolated-mock');
  console.log('isolated fixture verified');
  const login=await api('/api/auth/dev','POST',{privacy_accepted:true}); auth='Bearer '+login.token;
  const me=await api('/api/me','PUT',{ai_consent:true,save_chat:true,theme:'light'});
  const issue=await api('/api/issues','POST',{title:'标题菜单测试',concerns:['choices'],background:'合成数据'});
  const primary=await api('/api/conversations','POST',{issue_id:issue.id,title:'要整理的会话'});
  const other=await api('/api/conversations','POST',{issue_id:issue.id,title:'保留的另一段会话'});
  await fresh(); await mp.callWxMethod('setStorageSync','agency.session',login.token);
  await mp.callWxMethod('setStorageSync',`agency.theme.manual.v1:${me.id}`,true);
  await mp.callWxMethod('setStorageSync',`agency.selected-conversation.v1:${me.id}`,primary.id);
  console.log('synthetic session installed');
  const layouts={};
  for(const theme of ['light','dark']) {
    await api('/api/me','PUT',{theme}); await relaunch(); await home();
    const homeGeometry=await geometry();
    await mp.screenshot({path:path.join(out,`${theme}-home.png`)});
    await chat(); const chatGeometry=await geometry();
    assert.deepEqual(chatGeometry,homeGeometry);
    assert.equal(chatGeometry.width,44); assert.equal(chatGeometry.height,44);
    await tap('.chat-header-title'); await until(async()=>!!await find('.chat-menu'),'title dropdown');
    for(const name of ['rename','archive','delete']) assert.ok(await find('.menu-'+name));
    assert.equal(await (await find('.chat-header-title')).attribute('aria-expanded'),'true');
    await mp.screenshot({path:path.join(out,`${theme}-menu.png`)});
    await tap('.chat-menu-backdrop'); await until(async()=>!await find('.chat-menu'),'outside dismiss');
    layouts[theme]={home:homeGeometry,chat:chatGeometry};
    console.log(theme,'header geometry verified');
  }
  console.log('light/dark geometry and dropdown passed');
  await openAction('rename');
  await (await find('.conversation-rename-input')).input('已重命名的会话');
  await tap('.conversation-action-submit');
  await until(async()=>!await find('.conversation-action-submit') && (await (await find('.chat-header-title')).text()).includes('已重命名'),'rename');
  assert.equal((await api(`/api/conversations/${primary.id}`)).title,'已重命名的会话');
  await relaunch(); await chat();
  assert.ok((await (await find('.chat-header-title')).text()).includes('已重命名'));
  await openAction('delete'); await tap('.conversation-action-cancel');
  assert.equal((await api(`/api/conversations/${primary.id}`)).title,'已重命名的会话');
  await openAction('archive'); await tap('.conversation-action-submit');
  await until(async()=>!await find('.conversation-action-submit'),'archive complete');
  assert.ok((await api(`/api/conversations/${primary.id}`)).archived_at);
  await openAction('delete');
  await mp.screenshot({path:path.join(out,'delete-confirmation.png')});
  await tap('.conversation-action-submit');
  await until(async()=>!await find('.conversation-action-submit'),'delete complete');
  const items=[...await api('/api/conversations'),...await api('/api/conversations?archived=true')];
  assert.ok(!items.some(c=>c.id===primary.id)); assert.ok(items.some(c=>c.id===other.id));
  assert.equal((await api(`/api/issues/${issue.id}`)).ended_at,null);
  const after=await api('/qa/status'); assert.equal(after.calls,before.calls);
  const info=await mp.systemInfo();
  const report={width:info.windowWidth,height:info.windowHeight,layouts,model_calls:0,paid_requests:0,
    flows:['title dropdown','outside dismissal','rename and restart','cancel deletion','archive','confirmed deletion','other conversation and exploration preserved']};
  await fs.writeFile(path.join(out,'result.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report)); await mp.disconnect();
})().catch(async error=>{console.error(error);if(mp) await mp.disconnect();process.exitCode=1});
