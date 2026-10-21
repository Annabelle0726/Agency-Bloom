// Use tools/mock-response-reasoning-api.py on 8022 and the copied tourist project
// prepared by verify-response-reasoning-native.cjs --prepare, automation port 9442.
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const auto = require('../output/native-sdk/node_modules/miniprogram-automator');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'output/reasoning-summary');
let mp, page, auth;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function api(route, method = 'GET', data) {
  const res = await fetch('http://127.0.0.1:8022'+route, {method, headers:{'Content-Type':'application/json', ...(auth ? {Authorization:auth}: {})}, body:data ? JSON.stringify(data):undefined});
  assert.ok(res.ok, `${route}: ${res.status}`); return res.status === 204 ? null : res.json();
}
async function fresh() {
  if (mp) await mp.disconnect();
  mp = await auto.connect({wsEndpoint:'ws://127.0.0.1:9442'});
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

(async () => {
  const project = path.join(out, 'native-project');
  await fs.mkdir(out, {recursive:true});
  if(process.argv.includes('--prepare')) {
    const source=path.join(root,'apps/miniprogram/dist/build/mp-weixin');
    assert.match(await fs.readFile(path.join(source,'pages/index/useIndexPage.js'),'utf8'),/127\.0\.0\.1:8022/);
    await fs.cp(source,project,{recursive:true});
    const config=JSON.parse(await fs.readFile(path.join(project,'project.config.json'),'utf8'));
    config.appid='touristappid';config.projectname='Agency Bloom Response Explanation QA';config.setting.urlCheck=false;
    await fs.writeFile(path.join(project,'project.config.json'),JSON.stringify(config,null,2));
    console.log('Prepared isolated tourist project'); return;
  }
  assert.equal(JSON.parse(await fs.readFile(path.join(project,'project.config.json'),'utf8')).appid,'touristappid');
  assert.match(await fs.readFile(path.join(project,'pages/index/useIndexPage.js'),'utf8'),/127\.0\.0\.1:8022/);
  const start=await api('/qa/status'); assert.equal(start.provider,'reasoning-isolated-mock');
  const login=await api('/api/auth/dev','POST',{privacy_accepted:true}); auth='Bearer '+login.token;
  const me=await api('/api/me','PUT',{ai_consent:true,save_chat:true,theme:'forest'});
  await api('/api/issues','POST',{title:'回应思路测试',concerns:['choices'],background:'隔离合成数据'});
  await fresh(); await mp.callWxMethod('setStorageSync','agency.session',login.token); await mp.callWxMethod('setStorageSync','agency.theme.manual.v1:'+me.id,true); await relaunch();
  await until(async()=>!!await find('[data-tab="chat"]')||!!await find('.chat-input'),'workspace');
  let tab=await find('[data-tab="chat"]');if(tab)await tab.tap();
  await until(async()=>!!await find('.chat-input'),'chat');
  assert.ok(await find('.theme-forest'),'manual forest theme applied');
  await send('我需要保留稳定收入，每周只能投入两小时');
  await until(async()=>!!await find('.thinking'),'existing robot thinking state');
  assert.equal((await all('.reasoning-toggle')).length,0);
  await until(async()=>(await all('.message-row')).length===2,'reply');
  const toggle=await find('.reasoning-toggle');
  assert.equal((await toggle.text()).trim(),'查看回应思路');
  assert.equal(String(await toggle.attribute('aria-expanded')),'false');
  assert.equal((await all('.reasoning-point')).length,0);
  await mp.screenshot({path:path.join(out,'collapsed.png')});
  await toggle.tap();
  await until(async()=>(await all('.reasoning-point')).length===2,'expanded');
  assert.deepEqual(await Promise.all((await all('.reasoning-label')).map(x=>x.text())),['当前理解','建议取舍']);
  assert.equal((await all('.thinking-steps')).length,0);
  await mp.screenshot({path:path.join(out,'expanded-forest-verified.png')});
  await (await find('.reasoning-toggle')).tap();
  await until(async()=>(await all('.reasoning-point')).length===0,'collapsed again');
  await send('今天只是想聊聊');
  await until(async()=>(await all('.message-row')).length===4,'no summary reply');
  assert.equal((await all('.reasoning-toggle')).length,1);
  await api('/api/me','PUT',{theme:'dark'});
  await relaunch();
  await until(async()=>!!await find('[data-tab="chat"]')||!!await find('.chat-input'),'restart');
  tab=await find('[data-tab="chat"]');if(tab)await tab.tap();
  await until(async()=>(await all('.message-row')).length===4,'history restored');
  assert.equal((await all('.reasoning-point')).length,0);
  assert.equal((await all('.reasoning-toggle')).length,1);
  await (await find('.reasoning-toggle')).tap();
  await until(async()=>(await all('.reasoning-point')).length===2,'restored explanation');
  await mp.screenshot({path:path.join(out,'expanded-dark-verified.png')});
  const info=await mp.systemInfo(),end=await api('/qa/status');
  assert.equal(end.calls-start.calls,2);
  const report={passed:true,width:info.windowWidth,height:info.windowHeight,paid_requests:0,calls:2,
    flows:['robot waiting','default collapsed','two grounded rows','collapse','missing summary hidden','history recovery','forest and dark themes']};
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));await mp.disconnect();
})().catch(async e=>{console.error(e);if(mp)await mp.disconnect();process.exitCode=1;});
