// Isolated tourist project and temporary localhost API only; never the personal project.
// Build with VITE_API_BASE_URL=http://127.0.0.1:8022/api, run --prepare,
// CLI auto --project output/journey/native-project --auto-port 9442,
// run mock-journey-api.py, then run this script (three runs for asynchronous flows).
const fs = require('node:fs/promises'), path = require('node:path'), assert = require('node:assert/strict');
const themeAtHour = h => h >= 5 && h < 10 ? 'light' : h >= 10 && h < 16 ? 'forest' : h >= 16 && h < 19 ? 'dawn' : 'dark';
const auto = require('../output/native-sdk/node_modules/miniprogram-automator');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'output/journey'), project = path.join(out, 'native-project');
let mp, page, auth; const errors = [], results = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function api(route, method = 'GET', data) {
  const res = await fetch('http://127.0.0.1:8022' + route, {method, headers:{'Content-Type':'application/json', ...(auth ? {Authorization: auth} : {})}, body:data ? JSON.stringify(data) : undefined});
  assert.ok(res.ok, route + ': ' + res.status); return res.status === 204 ? null : res.json();
}
async function refresh() {
  if (mp) await mp.disconnect();
  mp = await auto.connect({ wsEndpoint:'ws://127.0.0.1:9442' });
  mp.on('exception', error => errors.push(String(error)));
  page = await mp.currentPage();
}
async function until(check, label) {
  for (let i=0; i<100; i++) { await refresh(); if (page && await check()) return; await sleep(200); }
  throw Error(label);
}
async function shot(name) { await mp.screenshot({path:path.join(out,name+'.png')}); }
async function tap(selector) { const element = await page.$(selector); assert.ok(element,selector); await element.tap(); }
async function textButton(label) {
  for (const button of await page.$$('button')) if ((await button.text()).trim() === label) { await button.tap(); return; }
  throw Error('Missing button: '+label);
}
async function enter(seed, url='/pages/journey/index') {
  auth = 'Bearer '+seed.token;
  await refresh(); await mp.callWxMethod('setStorageSync','agency.session',seed.token);
  await mp.callWxMethod('setStorageSync','agency.theme.manual.v1:'+seed.user_id,true);
  await mp.callWxMethod('setStorageSync','agency.onboarding.paused.v1:'+seed.user_id,true);
  await mp.callWxMethod('reLaunch',{url});
  await until(async()=>page.path===url.split('?')[0].replace(/^\//,'') && !!await page.$('.journey-reflection'),'Journey loaded');
}
async function backToJourney() {
  await mp.callWxMethod('navigateBack');
  await until(async()=>page.path==='pages/journey/index' && !!await page.$('.journey-reflection'),'Returned to journey');
}
(async()=>{
  await fs.mkdir(out,{recursive:true});
  if (process.argv.includes('--prepare')) {
    const source=path.join(root,'apps/miniprogram/dist/build/mp-weixin');
    assert.match(await fs.readFile(path.join(source,'journey.js'),'utf8'),/127\.0\.0\.1:8022/);
    await fs.cp(source,project,{recursive:true});
    const config=JSON.parse(await fs.readFile(path.join(project,'project.config.json'),'utf8'));
    config.appid='touristappid'; config.projectname='Agency Bloom Journey QA'; config.setting.urlCheck=false;
    await fs.writeFile(path.join(project,'project.config.json'),JSON.stringify(config,null,2)); return;
  }
  assert.equal(JSON.parse(await fs.readFile(path.join(project,'project.config.json'),'utf8')).appid,'touristappid');
  assert.equal((await api('/qa/status')).provider,'journey-isolated');
  for (const theme of (process.argv.includes('--flows-only') ? [] : ['dawn','forest','light','dark','lavender','minimal'])) {
    const seed=await api('/qa/seed?theme='+theme,'POST');
    await enter(seed); console.log('theme: '+theme);
    const info=await mp.systemInfo(); assert.ok((await page.$$('.journey-event')).length===3);
    const title=await page.$('.journey-title'); assert.equal((await title.text()).trim(),'走过的路');
    await shot(theme+'-top');
    await mp.callWxMethod('pageScrollTo',{scrollTop:10000,duration:0}); await sleep(160);
    const footer=await page.$('.journey-footer'); const footerSize=await footer.size(); assert.ok(footerSize.height<60);
    await shot(theme+'-bottom');
    results.push({theme,width:info.windowWidth,height:info.windowHeight,events:3});
  }
  const seed=await api('/qa/seed?theme=dawn','POST'); await enter(seed);
  await mp.callWxMethod('pageScrollTo',{scrollTop:430,duration:0}); await sleep(120);
  await tap('.journey-event');
  await until(async()=>page.path==='pages/journey/detail' && !!await page.$('.journey-detail-text'),'Event detail');
  await tap('.journey-source-toggle'); await until(async()=>!!await page.$('.journey-source'),'Source expands'); await shot('detail-source');
  await backToJourney();
  await tap('.journey-pending-entry');
  await until(async()=>page.path==='pages/journey/detail' && !!await page.$('.journey-candidate'),'Pending separate');
  await shot('pending');
  assert.equal((await api('/api/journey/events')).items.length,3);
  await textButton('审阅并决定'); await until(async()=>!!await page.$('.journey-textarea'),'Review candidate');
  await (await page.$('.journey-input')).input('我想先体验真实的日常工作');
  await (await page.$('.journey-textarea')).input('我愿意先完成一次访谈，再决定是否调整方向');
  await api('/qa/fail-next','POST'); await tap('.journey-save');
  await until(async()=>!!await page.$('.journey-error'),'Save error visible');
  assert.equal(await (await page.$('.journey-textarea')).value(),'我愿意先完成一次访谈，再决定是否调整方向');
  assert.equal((await api('/api/journey/events')).items.length,3);
  await shot('save-failure'); await tap('.journey-save');
  await until(async()=>page.path==='pages/journey/index' && (await page.$$('.journey-event')).length===4,'Confirmed candidate joins journey');
  assert.equal((await api('/api/journey/candidates')).items.length,0);
  await tap('.journey-direction');
  await until(async()=>!!await page.$('.journey-textarea'),'Direction editor');
  await (await page.$('.journey-textarea')).input('周末试一次访谈');
  await tap('.journey-save');
  await until(async()=>page.path==='pages/journey/index' && (await page.$$('.journey-event')).length===5,'Direction saved');
  assert.equal((await api('/api/issues/'+seed.issue_id)).card.next_step,'周末试一次访谈');
  await tap('.journey-direction'); await until(async()=>!!await page.$('.journey-textarea'),'Clear direction editor');
  await (await page.$('.journey-textarea')).input(''); await tap('.journey-save');
  await until(async()=>page.path==='pages/journey/index' && !!await page.$('.journey-future-empty'),'Direction can be put down');
  await shot('future-empty');
  const rootSeed=await api('/qa/seed?theme=dawn','POST');
  await mp.callWxMethod('setStorageSync','agency.session',rootSeed.token);
  await mp.callWxMethod('removeStorageSync','agency.theme.manual.v1:'+rootSeed.user_id);
  await mp.callWxMethod('reLaunch',{url:'/pages/index/index'});
  await until(async()=>!!await page.$('pages\\/index\\/views\\/AppTabbar'),'Workspace entry');
  const bar=await page.$('pages\\/index\\/views\\/AppTabbar');
  await (await bar.$('[data-tab="discover"]')).tap();
  await until(async()=>!!await page.$('pages\\/index\\/views\\/DiscoverView'),'Discover entry');
  const discover=await page.$('pages\\/index\\/views\\/DiscoverView');
  await (await discover.$('.bloom-history')).tap();
  await until(async()=>page.path==='pages/journey/index' && !!await page.$('.journey-reflection'),'Real discover navigation');
  const journeyClass=await (await page.$('.journey-page')).attribute('class');
  assert.ok(journeyClass.includes('theme-'+themeAtHour(new Date().getHours())), 'Automatic theme must match the workspace');
  await shot('automatic-theme-parity');
  await mp.callWxMethod('navigateBack');
  await until(async()=>page.path==='pages/index/index' && !!await page.$('pages\\/index\\/views\\/DiscoverView'),'Return to discover');
  const empty=await api('/qa/seed?theme=light&empty=true','POST'); await enter(empty);
  assert.equal((await page.$$('.journey-event')).length,0); assert.ok(await page.$('.journey-future-empty'));
  await shot('empty-account');
  assert.deepEqual(errors,[]); assert.equal((await api('/qa/status')).paid_requests,0);
  await fs.writeFile(path.join(out,'report-'+Date.now()+'.json'),JSON.stringify({results,flows:['automatic theme parity from real discover entry','detail source','candidate isolation','failed save preserves input','confirm','edit direction','put down direction','empty account'],errors},null,2));
  console.log(JSON.stringify({passed:true,results,errors}));
})().catch(error=>{console.error(error); process.exitCode=1}).finally(async()=>{if(mp)await mp.disconnect()});
